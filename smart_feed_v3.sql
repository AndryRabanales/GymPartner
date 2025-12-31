-- ==============================================================================
-- 🧠 SMART FEED ALGORITHM V3 (TikTok-Style Recommendation Engine)
-- Includes:
-- 1. Schema Updates (Shares, Saves, Virality)
-- 2. Unified Interaction Tracking
-- 3. Advanced Ranking Algorithm (Cold Start + Viral Boost)
-- ==============================================================================

-- 1. SCHEMA UPGRADES
-- Add new metrics columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'shares_count') THEN
        ALTER TABLE posts ADD COLUMN shares_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'saves_count') THEN
        ALTER TABLE posts ADD COLUMN saves_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'virality_score') THEN
        ALTER TABLE posts ADD COLUMN virality_score NUMERIC DEFAULT 0;
    END IF;

    -- Create post_saves table if not exists
    CREATE TABLE IF NOT EXISTS post_saves (
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, post_id)
    );
END $$;

-- Enable RLS for post_saves
ALTER TABLE post_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can save posts" ON post_saves;
DROP POLICY IF EXISTS "Users can view their saved posts" ON post_saves;
DROP POLICY IF EXISTS "Users can unsave posts" ON post_saves;

CREATE POLICY "Users can save posts" ON post_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their saved posts" ON post_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can unsave posts" ON post_saves FOR DELETE USING (auth.uid() = user_id);

-- 2. UNIFIED INTERACTION TRACKING
-- Handles generic interactions (Share, Save) and updates viral score
CREATE OR REPLACE FUNCTION track_interaction(
    p_user_id UUID,
    p_post_id UUID,
    p_type TEXT -- 'share', 'save'
) RETURNS VOID AS $$
BEGIN
    IF p_type = 'share' THEN
        -- Simply increment share count (no unique check for shares logic usually, or can use a separate table if tracking unique shares is critical. For now, simple counter)
        UPDATE posts 
        SET 
            shares_count = shares_count + 1,
            virality_score = virality_score + 5.0 -- Sharing is a strong viral signal
        WHERE id = p_post_id;
    
    ELSIF p_type = 'save' THEN
        -- Toggle save logic
        IF EXISTS (SELECT 1 FROM post_saves WHERE user_id = p_user_id AND post_id = p_post_id) THEN
            DELETE FROM post_saves WHERE user_id = p_user_id AND post_id = p_post_id;
            UPDATE posts SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = p_post_id;
        ELSE
            INSERT INTO post_saves (user_id, post_id) VALUES (p_user_id, p_post_id);
            UPDATE posts SET saves_count = saves_count + 1 WHERE id = p_post_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. THE ALGORITHM V3 (TikTok Logic)
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
        
        -- 🧠 SCORING FORMULA V3 🧠
        (
            -- Base Score
            (
                CASE 
                    -- REELS MODE: Prioritize Watch Time & Loop
                    WHEN p.type = 'video' THEN 
                        (p.retention_score * 50.0) +      -- W_Retention (High)
                        (COALESCE(p.shares_count, 0) * 50.0) + -- W_Share (Viral)
                        (COALESCE(p.saves_count, 0) * 60.0) +  -- W_Save (High Intent - [ADDED])
                        (COALESCE(p.boost_factor, 1.0) * 30.0) + -- W_Loop (Rewatch)
                        (eng.lcl * 10.0) +                -- W_Like (Low)
                        (eng.ccl * 20.0)                  -- W_Comment (Med)
                    

                    -- POSTS MODE: Prioritize Engagement & Saves
                    ELSE 
                        (eng.lcl * 30.0) +                -- W_Like (High)
                        (COALESCE(p.saves_count, 0) * 50.0) +  -- W_Save (Highest Intent)
                        (eng.ccl * 40.0) +                -- W_Comment (High)
                        (COALESCE(p.shares_count, 0) * 20.0)   -- W_Share (Med)
                END
            )
            -- 🎲 CHAOS FACTOR (Jitter)
            -- Adds 0-5 points randomly to break chronological ties for 0-engagement posts
            + (RANDOM() * 5.0)
            -- ❄️ COLD START BOOST (Fresh Content < 24h & < 100 views)
            * (CASE 
                WHEN p.created_at > NOW() - INTERVAL '24 hours' AND p.views_count < 100 THEN 3.0 -- Reduced from 5.0 (Balanced)
                ELSE 1.0 
               END)
            
            -- 🔥 VIRAL MULTIPLIER (High Virality Score)
            * (CASE 
                WHEN p.virality_score > 50 THEN 1.5 -- Standard Viral Boost
                WHEN p.virality_score > 100 THEN 2.0 -- Super Viral Boost
                ELSE 1.0 
               END)

            -- 📉 TIME DECAY (GRAVITY)
            -- Adjusted: Exponent 0.5 (Square Root) prevents crushing 24h+ posts.
            -- Example: 24h old post = /5 score (instead of /36).
            / POWER((EXTRACT(EPOCH FROM (NOW() - p.created_at))/3600.0) + 2.0, 0.5)

        )::NUMERIC as rank_score,
        
        -- Metadata Flags
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
