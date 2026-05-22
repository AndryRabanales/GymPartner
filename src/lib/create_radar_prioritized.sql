CREATE OR REPLACE FUNCTION get_radar_profiles_prioritized(current_user_id UUID)
RETURNS SETOF public.profiles AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.profiles
    WHERE id != current_user_id
      AND username IS NOT NULL
    ORDER BY 
        (boost_until IS NOT NULL AND boost_until > now()) DESC,
        created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;