-- ==============================================================================
-- 🔗 FIX AMBIGUOUS RELATIONS (UNIQUE NAMING STRATEGY)
-- We rename constraints to something UNIQUE to distinguish them from auto-generated ones.
-- ==============================================================================

-- 1. POSTS (Constraint: fk_posts_profiles)
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS fk_posts_profiles;
ALTER TABLE posts ADD CONSTRAINT fk_posts_profiles FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. COMMENTS (Constraint: fk_comments_profiles)
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS fk_comments_profiles;
ALTER TABLE comments ADD CONSTRAINT fk_comments_profiles FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. FOLLOWS (Constraints: fk_follows_follower, fk_follows_following)
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE follows DROP CONSTRAINT IF EXISTS fk_follows_follower;
ALTER TABLE follows ADD CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey;
ALTER TABLE follows DROP CONSTRAINT IF EXISTS fk_follows_following;
ALTER TABLE follows ADD CONSTRAINT fk_follows_following FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. POST_LIKES (Constraint: fk_likes_profiles)
ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS post_likes_user_id_fkey;
ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS fk_likes_profiles;
ALTER TABLE post_likes ADD CONSTRAINT fk_likes_profiles FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- RELOAD CACHE
NOTIFY pgrst, 'reload config';
