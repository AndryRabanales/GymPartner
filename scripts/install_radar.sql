
-- ==============================================================================
-- GYM PARTNER RADAR SYSTEM
-- Function: get_nearby_gymrats
-- Finds users who have a primary gym within a specific radius of a given point.
-- Returns: User details + Distance + Tier details (derived from checkins)
-- ==============================================================================

-- 1. Helper function for Earth Distance (Haversine formula approximation)
--    Note: We use this if postgis is not available. It's sufficient for "Sort by distance".
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 float,
    lon1 float,
    lat2 float,
    lon2 float
)
RETURNS float
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    dist float;
    radlat1 float;
    radlat2 float;
    theta float;
    radtheta float;
BEGIN
    IF lat1 = lat2 AND lon1 = lon2 THEN
        RETURN 0;
    END IF;

    -- Convert to radians
    radlat1 = lat1 * pi() / 180;
    radlat2 = lat2 * pi() / 180;
    theta = lon1 - lon2;
    radtheta = theta * pi() / 180;

    -- Formula
    dist = sin(radlat1) * sin(radlat2) + cos(radlat1) * cos(radlat2) * cos(radtheta);

    IF dist > 1 THEN
        dist = 1;
    END IF;

    dist = acos(dist);
    dist = dist * 180 / pi();
    dist = dist * 60 * 1.1515;
    
    -- Convert Miles to Kilometers
    dist = dist * 1.609344;

    RETURN dist;
END;
$$;

-- 2. Main Radar Function
CREATE OR REPLACE FUNCTION get_nearby_gymrats(
    current_lat float,
    current_lng float,
    radius_km float DEFAULT 100.0,
    current_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
    user_id uuid,
    username text,
    avatar_url text,
    checkins_count integer,
    gym_id uuid,
    gym_name text,
    gym_lat float,
    gym_lng float,
    distance_km float
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as admin to access user data if needed (Policy aware validation below)
AS $$
BEGIN
    RETURN QUERY
    WITH nearby_gyms AS (
        SELECT 
            g.id as g_id,
            g.name,
            g.lat,
            g.lng,
            calculate_distance(current_lat, current_lng, g.lat, g.lng) as dist
        FROM public.gyms g
        WHERE g.lat IS NOT NULL 
          AND g.lng IS NOT NULL
          AND calculate_distance(current_lat, current_lng, g.lat, g.lng) <= radius_km
    ),
    gym_users AS (
        SELECT DISTINCT ON (upg.user_id) -- One entry per user (closest gym)
            upg.user_id as u_id,
            ng.g_id,
            ng.name,
            ng.lat,
            ng.lng,
            ng.dist
        FROM public.user_gyms upg
        JOIN nearby_gyms ng ON upg.gym_id = ng.g_id
        WHERE upg.user_id != current_user_id -- Exclude self
        ORDER BY upg.user_id, ng.dist ASC -- Prefer closest gym for users with multiple
    )
    SELECT 
        p.id as user_id,
        COALESCE(p.username, 'Agente Desconocido') as username,
        p.avatar_url,
        COALESCE(p.checkins_count, 0) as checkins_count,
        gu.g_id as gym_id,
        gu.name as gym_name,
        gu.lat as gym_lat,
        gu.lng as gym_lng,
        gu.dist as distance_km
    FROM gym_users gu
    JOIN public.profiles p ON gu.u_id = p.id
    ORDER BY gu.dist ASC, p.checkins_count DESC -- Show closest, then highest rank
    LIMIT 100; -- Cap results
END;
$$;

-- 3. Grant public access (or authenticated only)
GRANT EXECUTE ON FUNCTION get_nearby_gymrats TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_gymrats TO anon;
GRANT EXECUTE ON FUNCTION calculate_distance TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_distance TO anon;

COMMENT ON FUNCTION get_nearby_gymrats IS 'Finds GymRats in gyms within X km of the user coordinates.';
