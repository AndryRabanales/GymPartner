-- ==============================================================================
-- FIX SOCIAL FOREIGN KEYS (Fix Generic 400 Bad Request on Feed)
-- This Repoints FKs from auth.users -> public.profiles to allow joining 'profiles' in queries.
-- ==============================================================================

-- 1. POSTS TABLE
ALTER TABLE posts 
    DROP CONSTRAINT IF EXISTS posts_user_id_fkey,
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. COMMENTS TABLE
ALTER TABLE comments 
    DROP CONSTRAINT IF EXISTS comments_user_id_fkey,
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. FOLLOWS TABLE
ALTER TABLE follows 
    DROP CONSTRAINT IF EXISTS follows_follower_id_fkey,
    DROP CONSTRAINT IF EXISTS follows_following_id_fkey,
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE,
    ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. POST_LIKES TABLE
ALTER TABLE post_likes 
    DROP CONSTRAINT IF EXISTS post_likes_user_id_fkey,
    ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload config';
