-- ==============================================================================
-- 🧹 SOCIAL DATA CLEANUP & FIX (The "Nuclear" Option)
-- Use this if the previous script failed or if you still get 400 Errors.
-- ==============================================================================

-- 1. CLEANUP ORPHANED DATA (Delete social actions from users who don't have a Profile)
-- This is necessary because we can't create the Foreign Key if bad data exists.

DELETE FROM post_likes WHERE user_id NOT IN (SELECT id FROM profiles);
DELETE FROM comments WHERE user_id NOT IN (SELECT id FROM profiles);
DELETE FROM follows WHERE follower_id NOT IN (SELECT id FROM profiles);
DELETE FROM follows WHERE following_id NOT IN (SELECT id FROM profiles);
DELETE FROM posts WHERE user_id NOT IN (SELECT id FROM profiles);

-- 2. RE-APPLY FOREIGN KEYS (Pointing to Profiles)

-- Posts
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Comments
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Follows
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE follows ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey;
ALTER TABLE follows ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Likes
ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS post_likes_user_id_fkey;
ALTER TABLE post_likes ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. REFRESH CACHE
NOTIFY pgrst, 'reload config';
