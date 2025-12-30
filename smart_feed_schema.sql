-- ==============================================================================
-- 🧠 SMART FEED ALGORITHM & ANALYTICS SCHEMA
-- ==============================================================================

-- 1. TRACKING TABLE: post_views
-- Stores raw view data for historical analysis and precise recalculations
CREATE TABLE IF NOT EXISTS post_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable for anonymous views
    duration_seconds NUMERIC DEFAULT 0,
    percentage_watched NUMERIC DEFAULT 0, -- 0.0 to 1.0 (e.g. 0.85 = 85%)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast aggregation
CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_user_id ON post_views(user_id);


-- 2. CACHING COLUMNS on posts table
-- Avoids recalculating sums on every feed fetch
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'views_count') THEN
        ALTER TABLE posts ADD COLUMN views_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'retention_score') THEN
        ALTER TABLE posts ADD COLUMN retention_score NUMERIC DEFAULT 0; -- 0 to 100 score
    END IF;
END $$;


-- 3. FUNCTION: log_view
-- Atomically logs a view and updates the post's cached stats
CREATE OR REPLACE FUNCTION log_view(
    p_post_id UUID,
    p_user_id UUID,
    p_duration NUMERIC,
    p_percentage NUMERIC
) RETURNS VOID AS $$
BEGIN
    -- A. Insert raw record
    INSERT INTO post_views (post_id, user_id, duration_seconds, percentage_watched)
    VALUES (p_post_id, p_user_id, p_duration, p_percentage);

    -- B. Update Post Aggregate Stats 
    -- We use a simple incremental update for views, and a weighted rolling average for retention
    -- NewAvg = ((OldAvg * OldCount) + NewVal) / (OldCount + 1)
    UPDATE posts
    SET 
        views_count = views_count + 1,
        retention_score = CASE 
            WHEN views_count = 0 THEN (p_percentage * 100)
            ELSE ((retention_score * views_count) + (p_percentage * 100)) / (views_count + 1)
        END
    WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. FUNCTION: get_smart_feed
-- Returns posts sorted by the "Smart Score"
-- Score = (Likes * 3) + (Comments * 5) + (Views * 0.1) + (Retention * 2) + Chaos
CREATE OR REPLACE FUNCTION get_smart_feed(
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
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
    rank_score NUMERIC -- Debugging purposes
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.type,
        p.media_url,
        p.thumbnail_url,
        p.caption,
        p.linked_routine_id,
        p.created_at,
        
        -- Aggregates (Subqueries are faster than massive joins for paginated feeds sometimes, 
        -- but here we rely on the VIEW-like join structure or cached counts)
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count,
        p.views_count,
        p.retention_score,
        
        -- User Interaction
        CASE WHEN p_user_id IS NOT NULL THEN
            EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = p_user_id)
        ELSE FALSE END as user_has_liked,

        -- Profiles Join
        pr.username,
        pr.avatar_url,
        
        -- Routine Join
        r.name as routine_name,

        -- 🧮 THE ALGORITHM
        (
            ((SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) * 3.0) +  -- Likes weight: 3
            ((SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) * 5.0) +      -- Comments weight: 5
            (COALESCE(p.views_count, 0) * 0.1) +                                    -- Views weight: 0.1
            (COALESCE(p.retention_score, 0) * 2.0) +                                -- Retention weight: 2
            (random() * 20.0)                                                       -- Chaos Factor: 0-20
        ) as rank_score

    FROM posts p
    LEFT JOIN profiles pr ON p.user_id = pr.id
    LEFT JOIN routines r ON p.linked_routine_id = r.id
    ORDER BY rank_score DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
