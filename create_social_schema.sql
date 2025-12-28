-- ==============================================================================
-- GYMPARTNER SOCIAL CORE (GymTok) SCHEMA
-- ==============================================================================

-- 1. Create POSTS Table
CREATE TABLE IF NOT EXISTS posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    type TEXT CHECK (type IN ('image', 'video')) NOT NULL,
    media_url TEXT NOT NULL,
    thumbnail_url TEXT, -- For videos
    caption TEXT,
    linked_routine_id UUID REFERENCES routines(id), -- Optional: Link a routine to the post
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 2. Create POST_LIKES Table
CREATE TABLE IF NOT EXISTS post_likes (
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id) -- Prevent duplicate likes
);

-- Enable RLS for Likes
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- 3. Create FOLLOWS Table
CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id <> following_id) -- Cannot follow self
);

-- Enable RLS for Follows
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- 4. Create COMMENTS Table (Forward thinking)
CREATE TABLE IF NOT EXISTS comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

-- POSTS Policies
CREATE POLICY "Public Posts are viewable by everyone" 
ON posts FOR SELECT 
USING (true); -- Ideally, filter by follower graph later, but for now: Global Feed

CREATE POLICY "Users can create their own posts" 
ON posts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" 
ON posts FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" 
ON posts FOR DELETE 
USING (auth.uid() = user_id);

-- LIKES Policies
CREATE POLICY "Likes are viewable by everyone" 
ON post_likes FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own likes" 
ON post_likes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" 
ON post_likes FOR DELETE 
USING (auth.uid() = user_id);

-- FOLLOWS Policies
CREATE POLICY "Follows are viewable by everyone" 
ON follows FOR SELECT 
USING (true);

CREATE POLICY "Users can follow others" 
ON follows FOR INSERT 
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" 
ON follows FOR DELETE 
USING (auth.uid() = follower_id);

-- COMMENTS Policies
CREATE POLICY "Comments are viewable by everyone" 
ON comments FOR SELECT 
USING (true);

CREATE POLICY "Users can comment" 
ON comments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- STORAGE BUCKETS (Attempting to create if not exists via SQL)
-- Note: This often requires superuser/admin role in Supabase. 
-- If it fails, create 'gym-social-media' bucket in Dashboard.
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('gym-social-media', 'gym-social-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Allow Public Read
CREATE POLICY "Public Access Social Media"
ON storage.objects FOR SELECT
USING ( bucket_id = 'gym-social-media' );

-- Storage Policy: Allow Authenticated Upload
CREATE POLICY "Authenticated Upload Social Media"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'gym-social-media' 
    AND auth.role() = 'authenticated'
);

-- Storage Policy: Allow Owner Delete
CREATE POLICY "Owner Delete Social Media"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'gym-social-media' 
    AND auth.uid() = owner
);

-- Notify schema cache reload
NOTIFY pgrst, 'reload config';
