-- ============================================================
-- GLOBAL RADAR UPDATE
-- Ensures all registered users (Google & Email) show up in Radar.
-- ============================================================

CREATE OR REPLACE FUNCTION get_nearby_gymrats(
    current_lat float,
    current_lng float,
    radius_km float DEFAULT 99999.0, -- Default to Global
    current_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
    user_id uuid,
    username text,
    avatar_url text,
    banner_url text,
    description text,
    checkins_count integer,
    gym_id uuid,
    gym_name text,
    gym_lat float,
    gym_lng float,
    distance_km float,
    followers_count integer,
    is_boosted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as user_id,
        p.username,
        p.avatar_url,
        COALESCE(p.custom_settings->>'banner_url', '') as banner_url,
        p.description,
        p.xp / 100 as checkins_count, -- Estimate checkins from XP
        g.id as gym_id,
        COALESCE(g.name, 'En Busca de Gym') as gym_name,
        COALESCE(g.lat, current_lat) as gym_lat,
        COALESCE(g.lng, current_lng) as gym_lng,
        CASE 
            WHEN g.lat IS NOT NULL AND g.lng IS NOT NULL 
            THEN calculate_distance(current_lat, current_lng, g.lat, g.lng)
            ELSE 0.0 
        END as distance_km,
        p.total_referrals as followers_count,
        CASE 
            WHEN p.boost_until IS NOT NULL AND p.boost_until > now() THEN true 
            ELSE false 
        END as is_boosted
    FROM public.profiles p
    LEFT JOIN public.user_gyms ug ON ug.user_id = p.id AND ug.is_home_base = true
    LEFT JOIN public.gyms g ON g.id = ug.gym_id
    WHERE p.id != current_user_id -- Don't show myself
      AND p.username IS NOT NULL -- Only users with setup profile
    ORDER BY 
        (p.boost_until IS NOT NULL AND p.boost_until > now()) DESC, -- Boosted first
        p.xp DESC -- Then by experience
    LIMIT 50;
END;
$$;
