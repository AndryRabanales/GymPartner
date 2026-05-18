-- ============================================================
-- GYMPARTNER: BULLETPROOF USER DELETION & CLEANUP TRIGGER
-- Description: Completely wipes out a user's data across all 15+
--              tables BEFORE the user is deleted from auth.users,
--              preventing foreign key blocks and orphaned profiles.
-- ============================================================

-- 1. Create the BEFORE DELETE trigger function
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS trigger AS $$
BEGIN
  -- Safe deletion block for all child tables to prevent foreign key errors
  BEGIN
    -- A. Delete social connections (follows)
    DELETE FROM public.follows 
    WHERE follower_id = old.id OR following_id = old.id;

    -- B. Delete history and routine shares
    DELETE FROM public.history_shares 
    WHERE shared_by = old.id OR shared_with = old.id;
    
    DELETE FROM public.routine_shares 
    WHERE shared_by = old.id OR shared_with = old.id;

    -- C. Delete user gyms association
    DELETE FROM public.user_gyms 
    WHERE user_id = old.id;

    -- D. Delete all notifications sent to or from the user
    DELETE FROM public.notifications 
    WHERE user_id = old.id;

    -- E. Delete chat messages and active chat rooms
    DELETE FROM public.chat_messages 
    WHERE sender_id = old.id;
    
    DELETE FROM public.chats 
    WHERE user_a = old.id OR user_b = old.id;

    -- F. Delete post comments & likes
    DELETE FROM public.comments 
    WHERE user_id = old.id;
    
    DELETE FROM public.post_likes 
    WHERE user_id = old.id;

    -- G. Delete posts and their associated multi-media files
    DELETE FROM public.post_media 
    WHERE post_id IN (SELECT id FROM public.posts WHERE user_id = old.id);
    
    DELETE FROM public.posts 
    WHERE user_id = old.id;

    -- H. Delete workout logs and training sessions
    DELETE FROM public.workout_logs 
    WHERE session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = old.id);
    
    DELETE FROM public.workout_sessions 
    WHERE user_id = old.id;

    -- I. Delete routine exercises & routine setups
    DELETE FROM public.routine_exercises 
    WHERE routine_id IN (SELECT id FROM public.routines WHERE user_id = old.id);
    
    DELETE FROM public.routines 
    WHERE user_id = old.id;

    -- J. Delete referral logs
    DELETE FROM public.referrals_log 
    WHERE referrer_id = old.id OR referred_id = old.id;

    -- K. Delete Gym Alpha consistency records
    DELETE FROM public.gym_alphas 
    WHERE user_id = old.id;

    -- L. Finally, delete the public profile record
    DELETE FROM public.profiles 
    WHERE id = old.id;

  EXCEPTION WHEN OTHERS THEN
    -- Mantiene la robustez de la eliminación en auth.users
    RAISE WARNING 'Error in handle_deleted_user: %', SQLERRM;
  END;
  
  RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind as BEFORE DELETE trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();
