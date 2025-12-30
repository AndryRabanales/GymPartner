-- ==============================================================================
-- 🧠 SMART FEED ALGORITHM V2.0 (TikTok-Style)
-- ==============================================================================

-- 1. ENHANCED TRACKING: post_views
-- Added 'times_looped' to track obsessiveness (Rewatch Factor)
ALTER TABLE post_views ADD COLUMN IF NOT EXISTS times_looped INTEGER DEFAULT 0;

-- 2. CACHING & HEATING
-- viral_score: pre-calculated ranking score
-- boost_factor: manual or automated multiplier for "Heating" (New videos get 1.0, Paid/Featured get 2.0+)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'viral_score') THEN
        ALTER TABLE posts ADD COLUMN viral_score NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'boost_factor') THEN
        ALTER TABLE posts ADD COLUMN boost_factor NUMERIC DEFAULT 1.0;
    END IF;
END $$;


-- 3. ALGORITHM: log_view_v2 (Handles Loops)
CREATE OR REPLACE FUNCTION log_view_v2(
    p_post_id UUID,
    p_user_id UUID,
    p_duration NUMERIC,
    p_percentage NUMERIC,
    p_loops INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
    -- A. Insert raw record
    INSERT INTO post_views (post_id, user_id, duration_seconds, percentage_watched, times_looped)
    VALUES (p_post_id, p_user_id, p_duration, p_percentage, p_loops);

    -- B. Update Post Aggregates (Incremental)
    -- Complex weighted update for viral_score could happen here, or via cron. 
    -- For real-time effect, we update a simple score here.
    
    -- Retention Logic: Moving Average
    -- Viral Logic: (Loops * 5) + (Full Watches * 2)
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


-- 4. THE TIKTOK FORMULA: get_smart_feed_v2
CREATE OR REPLACE FUNCTION get_smart_feed_v2(
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
    debug_score NUMERIC
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
        
        -- Counts
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count,
        p.views_count,
        p.retention_score,
        
        -- User Context
        CASE WHEN p_user_id IS NOT NULL THEN
            EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = p_user_id)
        ELSE FALSE END as user_has_liked,

        -- Joins
        pr.username,
        pr.avatar_url,
        r.name as routine_name,

        -- � ALGORITHM V2.0
        (
            -- 1. ENGAGEMENT (The "Social Proof")
            ((SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) * 3.0) + 
            ((SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) * 6.0) +  
            
            -- 2. RETENTION (The "Quality Signal" - CRITICAL for TikTok)
            -- High retention (>80%) gets exponential boost
            (COALESCE(p.retention_score, 0) * 0.5) +
            (CASE WHEN p.retention_score > 90 THEN 100 WHEN p.retention_score > 80 THEN 50 ELSE 0 END) +

            -- 3. FRESHNESS (The "Heating")
            -- New videos (<24h) get massive boost to test them
            (CASE 
                WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN 100 
                WHEN p.created_at > NOW() - INTERVAL '3 days' THEN 50 
                ELSE 0 
            END) +

            -- 4. VIRALITY (Rewatchability - inferred from simple view count velocity if we had it, but here we use raw view count dampener)
            -- We don't want old viral videos to dominate forever, so we dampen high view counts: log(views)
            (LN(GREATEST(p.views_count, 1)) * 5.0) +
            
            -- 5. CHAOS (The "Discovery")
            (random() * 30.0)

        ) * p.boost_factor as rank_score

    FROM posts p
    LEFT JOIN profiles pr ON p.user_id = pr.id
    LEFT JOIN routines r ON p.linked_routine_id = r.id
    
    -- EXCLUSION FILTER: Don't show videos already deeply watched by this user? 
    -- For MVP we skip typical exclusions to ensure content availability.
    
    ORDER BY rank_score DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
