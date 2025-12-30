-- 1. RESET ROW LEVEL SECURITY CLAUSES
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Public media are viewable by everyone" ON post_media;
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
DROP POLICY IF EXISTS "Users can insert media" ON post_media;
DROP POLICY IF EXISTS "Users can update media" ON post_media;
DROP POLICY IF EXISTS "Users can delete media" ON post_media;

CREATE POLICY "Public posts are viewable by everyone" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can insert their own posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON posts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public media are viewable by everyone" ON post_media FOR SELECT USING (true);
CREATE POLICY "Users can insert media" ON post_media FOR INSERT WITH CHECK (true);

-- 2. SCHEMA HARDENING (Ensure all tracking columns exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'post_views' AND column_name = 'times_looped') THEN
        ALTER TABLE post_views ADD COLUMN times_looped INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'views_count') THEN
        ALTER TABLE posts ADD COLUMN views_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'retention_score') THEN
        ALTER TABLE posts ADD COLUMN retention_score NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'boost_factor') THEN
        ALTER TABLE posts ADD COLUMN boost_factor NUMERIC DEFAULT 1.0;
    END IF;
END $$;

-- 3. INTERACTION ENGINE: log_view_v2 (Real-time Rank Updates)
CREATE OR REPLACE FUNCTION log_view_v2(
    p_post_id UUID,
    p_user_id UUID,
    p_duration NUMERIC,
    p_percentage NUMERIC,
    p_loops INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
    v_boost_inc NUMERIC;
BEGIN
    -- Log raw view
    INSERT INTO post_views (post_id, user_id, duration_seconds, percentage_watched, times_looped)
    VALUES (p_post_id, p_user_id, p_duration, p_percentage, p_loops);

    -- Calculate Influence (Loops are heavy)
    v_boost_inc := (p_loops * 0.5) + 0.05;

    -- Update Post metrics immediately
    UPDATE posts
    SET 
        views_count = views_count + 1,
        boost_factor = LEAST(boost_factor + v_boost_inc, 10.0), -- Max 10x boost
        retention_score = ((retention_score * views_count) + (p_percentage * 100)) / (views_count + 1)
    WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. THE RANKING ENGINE: get_smart_feed_v2 (V4 Aggressive Interest)
CREATE OR REPLACE FUNCTION get_smart_feed_v2(
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 40,
    p_offset INTEGER DEFAULT 0,
    p_type TEXT DEFAULT NULL 
) RETURNS TABLE (
    id UUID,
    user_id UUID,
    type TEXT,
    media_url TEXT,
    thumbnail_url TEXT,
    caption TEXT,
    linked_routine_id UUID,
    created_at TIMESTAMPTZ,
    likes_count BIGINT,
    comments_count BIGINT,
    views_count INTEGER,
    retention_score NUMERIC,
    user_has_liked BOOLEAN,
    username TEXT,
    avatar_url TEXT,
    routine_name TEXT,
    rank_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH eng AS (
        SELECT 
            p.id as pid,
            (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) as lcl,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as ccl
        FROM posts p
    )
    SELECT 
        p.id, p.user_id, p.type, p.media_url, p.thumbnail_url, p.caption, 
        p.linked_routine_id, p.created_at,
        eng.lcl as likes_count,
        eng.ccl as comments_count,
        p.views_count, p.retention_score,
        CASE WHEN p_user_id IS NOT NULL THEN
            EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = p_user_id)
        ELSE FALSE END as user_has_liked,
        pr.username, pr.avatar_url, r.name as routine_name,
        --  ALGORITHM V4 (Interests Over Time)
        (
            (
                500.0 +                    -- Base Visibility
                (eng.lcl * 250.0) +        -- 1 Like = +250
                (eng.ccl * 500.0) +        -- 1 Comment = +500
                (p.retention_score * 5.0)  -- 100% Retention = +500
            ) 
            * COALESCE(p.boost_factor, 1.0) -- Boost Factor (Loops/Rewatches)
            / POWER((EXTRACT(EPOCH FROM (NOW() - p.created_at))/3600.0) + 1.2, 1.5)
        )::NUMERIC as rank_score
    FROM posts p
    JOIN eng ON p.id = eng.pid
    LEFT JOIN profiles pr ON p.user_id = pr.id
    LEFT JOIN routines r ON p.linked_routine_id = r.id
    WHERE (p_type IS NULL OR p.type = p_type)
    ORDER BY rank_score DESC, p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
