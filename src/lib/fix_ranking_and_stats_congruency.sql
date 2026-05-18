-- ============================================================
-- GYMPARTNER: RANKING & SOCIAL STATS CONGRUENCY FIX
-- Description: Ensures followers counts are identical between
--              the ranking list and individual player profiles,
--              excluding deleted profiles and bypassing RLS.
-- ============================================================

-- 1. CREATE UNIFIED SECURITY DEFINER PROFILE STATS RPC
-- This counts statistics bypassing RLS and excludes deleted profiles.
CREATE OR REPLACE FUNCTION get_profile_stats(user_id_param UUID)
RETURNS JSONB AS $$
DECLARE
    followers_count BIGINT;
    following_count BIGINT;
    workouts_count BIGINT;
    likes_count BIGINT;
BEGIN
    -- Count followers (only count active profiles who still exist!)
    SELECT COUNT(*) INTO followers_count
    FROM public.follows f
    JOIN public.profiles p ON f.follower_id = p.id
    WHERE f.following_id = user_id_param;

    -- Count following (only count active profiles who still exist!)
    SELECT COUNT(*) INTO following_count
    FROM public.follows f
    JOIN public.profiles p ON f.following_id = p.id
    WHERE f.follower_id = user_id_param;

    -- Count completed workout sessions
    SELECT COUNT(*) INTO workouts_count
    FROM public.workout_sessions
    WHERE user_id = user_id_param 
      AND (finished_at IS NOT NULL OR end_time IS NOT NULL);

    -- Count total likes received on posts
    SELECT COALESCE(SUM(pl_count), 0) INTO likes_count
    FROM (
        SELECT COUNT(pl.id) as pl_count
        FROM public.posts po
        LEFT JOIN public.post_likes pl ON po.id = pl.post_id
        WHERE po.user_id = user_id_param
        GROUP BY po.id
    ) sub;

    RETURN jsonb_build_object(
        'followersCount', followers_count,
        'followingCount', following_count,
        'workoutsCount', workouts_count,
        'totalLikes', likes_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. UPDATE GYM LEADERBOARD RPC TO EXCLUDE DELETED PROFILES
-- Ensures the leaderboard counts match get_profile_stats exactly.
CREATE OR REPLACE FUNCTION get_gym_followers_leaderboard(gym_id_param UUID)
RETURNS TABLE (
    id UUID,
    username TEXT,
    avatar_url TEXT,
    gym_name TEXT,
    banner_url TEXT,
    followers_count BIGINT,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH user_followers AS (
        SELECT 
            f.following_id AS user_id,
            COUNT(f.follower_id) AS count
        FROM 
            public.follows f
        -- Only count active followers who still exist in public.profiles!
        JOIN 
            public.profiles p_follower ON f.follower_id = p_follower.id
        GROUP BY 
            f.following_id
    )
    SELECT 
        p.id,
        p.username,
        p.avatar_url,
        g.name AS gym_name,
        p.custom_settings->>'banner_url' AS banner_url,
        COALESCE(uf.count, 0) AS followers_count,
        RANK() OVER (ORDER BY COALESCE(uf.count, 0) DESC) AS rank
    FROM 
        public.profiles p
    LEFT JOIN 
        public.gyms g ON p.home_gym_id::uuid = g.id
    LEFT JOIN 
        user_followers uf ON p.id = uf.user_id
    WHERE 
        p.home_gym_id::uuid = gym_id_param
    ORDER BY 
        followers_count DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. ENSURE CLEAN PUBLIC SELECT POLICY ON FOLLOWS
-- Ensures client-side fallback select queries also work.
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on follows" ON public.follows;
DROP POLICY IF EXISTS "Permitir lectura de seguidores a todos" ON public.follows;
DROP POLICY IF EXISTS "follows_read_policy" ON public.follows;
DROP POLICY IF EXISTS "Everyone can read follows" ON public.follows;

CREATE POLICY "Everyone can read follows" 
ON public.follows 
FOR SELECT 
TO authenticated 
USING (true);
