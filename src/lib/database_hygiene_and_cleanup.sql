-- ============================================================
-- GINX: COMPLETE DATABASE HYGIENE & CLEANUP (ANTI-GHOST SANITIZATION)
-- Description: Safety-first SQL routine designed to audit, clean, and 
--              optimize the database. It eliminates stale multiplayer/single-player
--              "ghost" sessions, removes orphaned data belonging to deleted users, 
--              cleans up empty workout sessions, and re-indexes core tables.
-- INSTRUCTIONS: Run this script inside your Supabase SQL Editor.
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: CLEANING STALE & GHOST WORKOUT SESSIONS
-- ============================================================
RAISE NOTICE 'Step 1: Cleaning up stale/abandoned workout sessions...';

-- 1.1 Remove workout logs associated with stale unfinished sessions (older than 12 hours)
DELETE FROM public.workout_logs
WHERE session_id IN (
    SELECT id FROM public.workout_sessions
    WHERE finished_at IS NULL
      AND started_at < NOW() - INTERVAL '12 hours'
);

-- 1.2 Remove the stale active sessions themselves (abandoned workouts older than 12 hours)
DELETE FROM public.workout_sessions
WHERE finished_at IS NULL
  AND started_at < NOW() - INTERVAL '12 hours';

-- 1.3 Clean up "empty" active sessions (sessions that have been open for more than 1 hour but have 0 exercises/logs)
DELETE FROM public.workout_sessions
WHERE finished_at IS NULL
  AND started_at < NOW() - INTERVAL '1 hour'
  AND id NOT IN (SELECT DISTINCT session_id FROM public.workout_logs);

-- 1.4 Clean up orphaned workout logs that do not reference any existing session
DELETE FROM public.workout_logs
WHERE session_id NOT IN (SELECT id FROM public.workout_sessions);


-- ============================================================
-- SECTION 2: CLEANING ORPHANED DATA FROM DELETED USERS
-- ============================================================
RAISE NOTICE 'Step 2: Cleaning up orphaned records of already-deleted auth users...';

-- 2.1 Remove follows containing deleted users
DELETE FROM public.follows 
WHERE follower_id NOT IN (SELECT id FROM auth.users) 
   OR following_id NOT IN (SELECT id FROM auth.users);

-- 2.2 Remove shared workout history or routines from/to deleted users
DELETE FROM public.history_shares 
WHERE shared_by NOT IN (SELECT id FROM auth.users) 
   OR shared_with NOT IN (SELECT id FROM auth.users);

DELETE FROM public.routine_shares 
WHERE shared_by NOT IN (SELECT id FROM auth.users) 
   OR shared_with NOT IN (SELECT id FROM auth.users);

-- 2.3 Remove gym associations of deleted users
DELETE FROM public.user_gyms 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 2.4 Remove notifications linked to deleted users
DELETE FROM public.notifications 
WHERE user_id NOT IN (SELECT id FROM auth.users)
   OR sender_id NOT IN (SELECT id FROM auth.users);

-- 2.5 Remove chat messages and empty chat rooms of deleted users
DELETE FROM public.chat_messages 
WHERE sender_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.chats 
WHERE user_a NOT IN (SELECT id FROM auth.users) 
   OR user_b NOT IN (SELECT id FROM auth.users);

-- 2.6 Remove post interactions (likes, comments) of deleted users
DELETE FROM public.comments 
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.post_likes 
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.post_saves 
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.post_views 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 2.7 Remove posts and media files belonging to deleted users
DELETE FROM public.post_media 
WHERE post_id IN (
  SELECT id FROM public.posts 
  WHERE user_id NOT IN (SELECT id FROM auth.users)
);

DELETE FROM public.posts 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 2.8 Clean up workout data belonging to deleted users
DELETE FROM public.workout_logs 
WHERE owner_id NOT IN (SELECT id FROM auth.users)
   OR session_id IN (
       SELECT id FROM public.workout_sessions 
       WHERE user_id NOT IN (SELECT id FROM auth.users)
   );

DELETE FROM public.workout_sessions 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 2.9 Clean up routines belonging to deleted users
DELETE FROM public.routine_exercises 
WHERE routine_id IN (
  SELECT id FROM public.routines 
  WHERE user_id NOT IN (SELECT id FROM auth.users)
);

DELETE FROM public.routines 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 2.10 Clean up streak logs and gym alphas of deleted users
DELETE FROM public.streak_logs 
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.user_streaks 
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.gym_alphas 
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.alpha_history 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 2.11 Clean up challenges involving deleted users
DELETE FROM public.challenges
WHERE challenger_id NOT IN (SELECT id FROM auth.users)
   OR defender_id NOT IN (SELECT id FROM auth.users);

-- 2.12 Clean up orphaned profiles
DELETE FROM public.profiles 
WHERE id NOT IN (SELECT id FROM auth.users);


-- ============================================================
-- SECTION 3: SYSTEMATIZATION & INTEGRITY ASSURANCE
-- ============================================================
RAISE NOTICE 'Step 3: Creating an automatic trigger to prevent future orphans...';

-- Create or replace user deletion cascade trigger function
CREATE OR REPLACE FUNCTION public.fn_cascade_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete user data across all tables atomically
    DELETE FROM public.follows WHERE follower_id = OLD.id OR following_id = OLD.id;
    DELETE FROM public.history_shares WHERE shared_by = OLD.id OR shared_with = OLD.id;
    DELETE FROM public.routine_shares WHERE shared_by = OLD.id OR shared_with = OLD.id;
    DELETE FROM public.user_gyms WHERE user_id = OLD.id;
    DELETE FROM public.notifications WHERE user_id = OLD.id OR sender_id = OLD.id;
    DELETE FROM public.chat_messages WHERE sender_id = OLD.id;
    DELETE FROM public.chats WHERE user_a = OLD.id OR user_b = OLD.id;
    DELETE FROM public.comments WHERE user_id = OLD.id;
    DELETE FROM public.post_likes WHERE user_id = OLD.id;
    DELETE FROM public.post_saves WHERE user_id = OLD.id;
    DELETE FROM public.post_views WHERE user_id = OLD.id;
    
    DELETE FROM public.post_media WHERE post_id IN (SELECT id FROM public.posts WHERE user_id = OLD.id);
    DELETE FROM public.posts WHERE user_id = OLD.id;
    
    DELETE FROM public.workout_logs WHERE owner_id = OLD.id OR session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = OLD.id);
    DELETE FROM public.workout_sessions WHERE user_id = OLD.id;
    
    DELETE FROM public.routine_exercises WHERE routine_id IN (SELECT id FROM public.routines WHERE user_id = OLD.id);
    DELETE FROM public.routines WHERE user_id = OLD.id;
    
    DELETE FROM public.streak_logs WHERE user_id = OLD.id;
    DELETE FROM public.user_streaks WHERE user_id = OLD.id;
    DELETE FROM public.gym_alphas WHERE user_id = OLD.id;
    DELETE FROM public.alpha_history WHERE user_id = OLD.id;
    DELETE FROM public.challenges WHERE challenger_id = OLD.id OR defender_id = OLD.id;
    
    DELETE FROM public.profiles WHERE id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users table (if it does not already exist)
DROP TRIGGER IF EXISTS tr_cascade_user_deletion ON auth.users;
CREATE TRIGGER tr_cascade_user_deletion
    BEFORE DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_cascade_user_deletion();

COMMIT;

-- ============================================================
-- SECTION 4: PERFORMANCE OPTIMIZATION (POST-COMMIT)
-- ============================================================
-- Re-index high-query tables to optimize speeds for matches, rankings, radar and profiles
ANALYZE public.profiles;
ANALYZE public.workout_sessions;
ANALYZE public.workout_logs;
ANALYZE public.gyms;
ANALYZE public.chats;
ANALYZE public.posts;
