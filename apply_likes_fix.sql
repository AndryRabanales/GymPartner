
-- 1. Ensure `post_likes` has a UNIQUE composite key to prevent duplicates
ALTER TABLE post_likes
ADD CONSTRAINT post_likes_user_id_post_id_key UNIQUE (user_id, post_id);

-- 2. Execute the FK fixes from the user's file (inlining them here for atomicity)
-- POSTS TABLE
ALTER TABLE posts 
    DROP CONSTRAINT IF EXISTS posts_user_id_fkey,
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- COMMENTS TABLE
ALTER TABLE comments 
    DROP CONSTRAINT IF EXISTS comments_user_id_fkey,
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- FOLLOWS TABLE
ALTER TABLE follows 
    DROP CONSTRAINT IF EXISTS follows_follower_id_fkey,
    DROP CONSTRAINT IF EXISTS follows_following_id_fkey,
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE,
    ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- POST_LIKES TABLE
ALTER TABLE post_likes 
    DROP CONSTRAINT IF EXISTS post_likes_user_id_fkey,
    ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- RELOAD MAP
NOTIFY pgrst, 'reload config';
