-- ============================================================
-- GYMPARTNER: RETROSPECTIVE CLEANUP OF ORPHANED PROFILES
-- Description: Scans all 15+ database tables for records belonging
--              to users who have already been deleted from auth.users,
--              and cleanly deletes them. This completely erases
--              already-deleted users from rankings, radar, and search.
-- ============================================================

-- 1. Delete orphaned social connections (follows)
DELETE FROM public.follows 
WHERE follower_id NOT IN (SELECT id FROM auth.users) 
   OR following_id NOT IN (SELECT id FROM auth.users);

-- 2. Delete orphaned history and routine shares
DELETE FROM public.history_shares 
WHERE shared_by NOT IN (SELECT id FROM auth.users) 
   OR shared_with NOT IN (SELECT id FROM auth.users);

DELETE FROM public.routine_shares 
WHERE shared_by NOT IN (SELECT id FROM auth.users) 
   OR shared_with NOT IN (SELECT id FROM auth.users);

-- 3. Delete orphaned user gyms associations
DELETE FROM public.user_gyms 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 4. Delete orphaned notifications
DELETE FROM public.notifications 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 5. Delete orphaned chat messages and chat rooms
DELETE FROM public.chat_messages 
WHERE sender_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.chats 
WHERE user_a NOT IN (SELECT id FROM auth.users) 
   OR user_b NOT IN (SELECT id FROM auth.users);

-- 6. Delete orphaned comments & likes on posts
DELETE FROM public.comments 
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.post_likes 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 7. Delete orphaned posts and their multi-media files
DELETE FROM public.post_media 
WHERE post_id IN (
  SELECT id FROM public.posts 
  WHERE user_id NOT IN (SELECT id FROM auth.users)
);

DELETE FROM public.posts 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 8. Delete orphaned workout logs and training sessions
DELETE FROM public.workout_logs 
WHERE session_id IN (
  SELECT id FROM public.workout_sessions 
  WHERE user_id NOT IN (SELECT id FROM auth.users)
);

DELETE FROM public.workout_sessions 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 9. Delete orphaned routine exercises & routine setups
DELETE FROM public.routine_exercises 
WHERE routine_id IN (
  SELECT id FROM public.routines 
  WHERE user_id NOT IN (SELECT id FROM auth.users)
);

DELETE FROM public.routines 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 10. Delete orphaned referral logs
DELETE FROM public.referrals_log 
WHERE referrer_id NOT IN (SELECT id FROM auth.users) 
   OR referred_id NOT IN (SELECT id FROM auth.users);

-- 11. Delete orphaned Gym Alpha consistency records
DELETE FROM public.gym_alphas 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 12. Finally, delete the orphaned profiles from the platform
DELETE FROM public.profiles 
WHERE id NOT IN (SELECT id FROM auth.users);
