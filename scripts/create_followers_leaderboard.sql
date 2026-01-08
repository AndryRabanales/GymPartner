
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
            follows f
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
        profiles p
    LEFT JOIN 
        gyms g ON p.home_gym_id::uuid = g.id
    LEFT JOIN 
        user_followers uf ON p.id = uf.user_id
    WHERE 
        p.home_gym_id::uuid = gym_id_param
    ORDER BY 
        followers_count DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
