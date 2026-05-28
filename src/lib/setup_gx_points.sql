-- ==============================================================================
-- GINX: GX POINTS SEPARATION & LEADERBOARD MIGRATION
-- Description: Establishes a completely separate column for gamification points (GX)
--              so that they are NOT mixed with G-Points/Coins/Monedas.
--              Redefines get_gym_followers_leaderboard to sort strictly by GX points.
-- ==============================================================================

-- 1. Add separate gx_points column to public.profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gx_points INT DEFAULT 0;

-- 2. Create high-security RPC to safely increment/decrement GX points (supporting negative values for unfollows)
CREATE OR REPLACE FUNCTION public.increment_gx_points(u_id UUID, amount INT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET gx_points = COALESCE(gx_points, 0) + amount
    WHERE id = u_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Redefine get_gym_followers_leaderboard to calculate rankings dynamically
--    based on the separate gx_points column, applying the racha multiplier (x2 for 10+ streak)
DROP FUNCTION IF EXISTS public.get_gym_followers_leaderboard(UUID);

CREATE OR REPLACE FUNCTION public.get_gym_followers_leaderboard(gym_id_param UUID)
RETURNS TABLE (
    id UUID,
    username TEXT,
    avatar_url TEXT,
    gym_name TEXT,
    banner_url TEXT,
    followers_count BIGINT,
    gx_points INT,
    current_streak INT,
    is_boosted BOOLEAN,
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
        GROUP BY 
            f.following_id
    ),
    user_streak_info AS (
        SELECT 
            us.user_id,
            COALESCE(us.current_streak, 0) AS streak
        FROM 
            public.user_streaks us
    )
    SELECT 
        p.id,
        p.username::text,
        p.avatar_url::text,
        g.name::text AS gym_name,
        p.custom_settings->>'banner_url' AS banner_url,
        COALESCE(uf.count, 0)::bigint AS followers_count,
        (COALESCE(p.gx_points, 0) * (CASE WHEN COALESCE(usi.streak, 0) >= 10 THEN 2 ELSE 1 END))::int AS gx_points,
        COALESCE(usi.streak, 0)::int AS current_streak,
        (p.boost_until IS NOT NULL AND p.boost_until > NOW()) AS is_boosted,
        RANK() OVER (
            ORDER BY 
                (p.boost_until IS NOT NULL AND p.boost_until > NOW()) DESC, 
                (COALESCE(p.gx_points, 0) * (CASE WHEN COALESCE(usi.streak, 0) >= 10 THEN 2 ELSE 1 END)) DESC
        ) AS rank
    FROM 
        public.profiles p
    LEFT JOIN 
        public.gyms g ON p.home_gym_id::uuid = g.id
    LEFT JOIN 
        user_followers uf ON p.id = uf.user_id
    LEFT JOIN 
        user_streak_info usi ON p.id = usi.user_id
    WHERE 
        p.home_gym_id::uuid = gym_id_param
    ORDER BY 
        (p.boost_until IS NOT NULL AND p.boost_until > NOW()) DESC,
        gx_points DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
