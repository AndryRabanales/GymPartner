-- ==============================================================================
-- 🛠️ MASTER FIX FOR GYM PARTNER LIKES (V3 - No ID Column Version)
-- Run this in Supabase SQL Editor.
-- ==============================================================================

-- 1. CLEANUP BAD DATA
DELETE FROM post_likes 
WHERE user_id NOT IN (SELECT id FROM profiles) 
   OR post_id NOT IN (SELECT id FROM posts);

-- 2. ELIMINATE DUPLICATE LIKES (Using CTID since ID column is missing)
-- Keeps one row per user/post pair
DELETE FROM post_likes
WHERE ctid NOT IN (
  SELECT min(ctid)
  FROM post_likes
  GROUP BY user_id, post_id
);

-- 3. FK CONSTRAINTS
-- POSTS
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- POST_LIKES
ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS post_likes_user_id_fkey;
ALTER TABLE post_likes ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS post_likes_post_id_fkey;
ALTER TABLE post_likes ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

-- 4. UNIQUE CONSTRAINT
ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS post_likes_user_id_post_id_key;
ALTER TABLE post_likes ADD CONSTRAINT post_likes_user_id_post_id_key UNIQUE (user_id, post_id);

-- 5. 🚨 ROW LEVEL SECURITY (RLS)
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Likes are viewable by everyone" ON post_likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON post_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON post_likes;
DROP POLICY IF EXISTS "Enable read access for all users" ON post_likes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON post_likes;

CREATE POLICY "Likes are viewable by everyone" 
ON post_likes FOR SELECT 
USING ( true );

CREATE POLICY "Users can insert their own likes" 
ON post_likes FOR INSERT 
WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can delete their own likes" 
ON post_likes FOR DELETE 
USING ( auth.uid() = user_id );

-- 6. REFRESH
NOTIFY pgrst, 'reload config';
