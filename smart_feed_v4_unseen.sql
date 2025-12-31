-- 🧠 SMART FEED V4: UNSEEN FIRST LOGIC
-- "Discover new content first. Re-watch only when necessary."

-- 1. CREATE TRACKING TABLE (If not exists)
CREATE TABLE IF NOT EXISTS post_views (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT NOW()
    -- PRIMARY KEY (user_id, post_id) -- [COMMENTED OUT: Handled below to ensure constraint exists]
);

-- [FIX] 1. Remove duplicates before adding constraint
DELETE FROM post_views a USING post_views b 
WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.post_id = b.post_id;

-- [FIX] 2. Force Constraint to exist for "ON CONFLICT" support
DO $$
BEGIN
    -- Drop old constraints if they exist to reset state
    ALTER TABLE post_views DROP CONSTRAINT IF EXISTS post_views_pkey;
    ALTER TABLE post_views DROP CONSTRAINT IF EXISTS post_views_user_id_post_id_key;

    -- Add the definitive Primary Key
    ALTER TABLE post_views ADD CONSTRAINT post_views_pkey PRIMARY KEY (user_id, post_id);
END $$;

-- [FIX] 3. Ensure column exists if table was created previously without it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'post_views' AND column_name = 'viewed_at') THEN
        ALTER TABLE post_views ADD COLUMN viewed_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Enable RLS
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own views" ON post_views;
CREATE POLICY "Users can insert their own views" ON post_views FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own history" ON post_views;
CREATE POLICY "Users can view their own history" ON post_views FOR SELECT USING (auth.uid() = user_id);


-- 2. UPDATE VIEW LOGGING RPC
-- Hooks into frontend 'logView' call. Records unique view + increments counter.

-- [FIX] Drop both potential signatures to resolve ambiguity error
DROP FUNCTION IF EXISTS log_view_v2(UUID, UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS log_view_v2(UUID, UUID, NUMERIC, NUMERIC, INTEGER);

CREATE OR REPLACE FUNCTION log_view_v2(
    p_post_id UUID,
    p_user_id UUID,
    p_duration NUMERIC, -- [FIX] Changed to NUMERIC to support 1.5s
    p_percentage NUMERIC, -- [FIX] Changed to NUMERIC
    p_loops INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
    -- 1. Track Unique View (Idempotent)
    -- Only insert if not already viewed.
    IF p_user_id IS NOT NULL THEN
        INSERT INTO post_views (user_id, post_id)
        VALUES (p_user_id, p_post_id)
        ON CONFLICT (user_id, post_id) 
        DO UPDATE SET viewed_at = NOW(); -- Touch timestamp for "Recently Viewed" logic if needed
    END IF;

    -- 2. Increment Global Stats (Approximate)
    UPDATE posts 
    SET views_count = views_count + 1
    WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. UPGRADE ALGORITHM (V3 -> V4 Logic)
-- We keep the name 'get_smart_feed_v3' to avoid breaking frontend, but logic is V4.
CREATE OR REPLACE FUNCTION get_smart_feed_v3(
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
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
    shares_count INTEGER,
    saves_count INTEGER,
    retention_score NUMERIC,
    user_has_liked BOOLEAN,
    user_has_saved BOOLEAN,
    username TEXT,
    avatar_url TEXT,
    routine_name TEXT,
    rank_score NUMERIC,
    is_viral BOOLEAN,
    is_cold_start BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH eng AS (
        SELECT 
            p.id as pid,
            (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) as lcl,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as ccl
        FROM posts p
    ),
    view_data AS (
        -- Check if user has seen the post (FIXED: Alias 'pv' to avoid ambiguity)
        SELECT pv.post_id 
        FROM post_views pv
        WHERE pv.user_id = p_user_id
    )
    SELECT 
        p.id, p.user_id, p.type, p.media_url, p.thumbnail_url, p.caption, 
        p.linked_routine_id, p.created_at,
        eng.lcl as likes_count,
        eng.ccl as comments_count,
        p.views_count, 
        COALESCE(p.shares_count, 0) as shares_count,
        COALESCE(p.saves_count, 0) as saves_count,
        p.retention_score,
        CASE WHEN p_user_id IS NOT NULL THEN
            EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = p_user_id)
        ELSE FALSE END as user_has_liked,
        CASE WHEN p_user_id IS NOT NULL THEN
            EXISTS (SELECT 1 FROM post_saves ps WHERE ps.post_id = p.id AND ps.user_id = p_user_id)
        ELSE FALSE END as user_has_saved,
        pr.username, pr.avatar_url, r.name as routine_name,
        
        -- 🧠 SCORING FORMULA V4 (UNSEEN FIRST) 🧠
        (
            (
                (
                    CASE 
                        -- REELS SCORING
                        WHEN p.type = 'video' THEN 
                            (p.retention_score * 50.0) +
                            (COALESCE(p.shares_count, 0) * 50.0) +
                            (COALESCE(p.saves_count, 0) * 60.0) +
                            (COALESCE(p.boost_factor, 1.0) * 30.0) +
                            (eng.lcl * 10.0) +
                            (eng.ccl * 20.0)

                        -- POSTS SCORING
                        ELSE 
                            (eng.lcl * 30.0) +
                            (COALESCE(p.saves_count, 0) * 50.0) +
                            (eng.ccl * 40.0) +
                            (COALESCE(p.shares_count, 0) * 20.0)
                    END
                ) 
                -- Jitter & Multipliers
                
                -- [FIX] INCREASED CHAOS: From 5.0 to 45.0
                -- Solves "Feed looks static" issue.
                -- Allows posts with similar scores to swap positions easily.
                + (RANDOM() * 45.0)
                * (CASE WHEN p.created_at > NOW() - INTERVAL '24 hours' AND p.views_count < 100 THEN 3.0 ELSE 1.0 END)
                * (CASE WHEN p.virality_score > 50 THEN 1.5 ELSE 1.0 END)
                / POWER((EXTRACT(EPOCH FROM (NOW() - p.created_at))/3600.0) + 2.0, 0.5)
            )

            -- 🚫 SEEN PENALTY (Atomic Bomb Method)
            -- If user has seen it, subtract 1,000,000 points.
            -- This guarantees all UNSEEN posts (Positive Score) appear before SEEN posts (Negative Score).
            - (CASE 
                WHEN EXISTS (SELECT 1 FROM view_data WHERE post_id = p.id) THEN 1000000.0 
                ELSE 0.0 
               END)

        )::NUMERIC as rank_score,
        
        (p.virality_score > 50) as is_viral,
        (p.created_at > NOW() - INTERVAL '24 hours' AND p.views_count < 100) as is_cold_start

    FROM posts p
    JOIN eng ON p.id = eng.pid
    LEFT JOIN profiles pr ON p.user_id = pr.id
    LEFT JOIN routines r ON p.linked_routine_id = r.id
    WHERE (p_type IS NULL OR p.type = p_type)
    ORDER BY rank_score DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
