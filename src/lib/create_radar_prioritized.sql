-- ==============================================================================
-- UPDATE RADAR RPC: get_radar_profiles_prioritized (VERSION FAIL-SAFE V4)
-- Description: Returns all profiles prioritising boosted & newest.
--              Includes a fix for the PostgreSQL `id != NULL` trap which 
--              returns 0 rows if current_user_id is NULL.
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_radar_profiles_prioritized(current_user_id UUID)
RETURNS SETOF public.profiles AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.profiles
    WHERE (current_user_id IS NULL OR id <> current_user_id)
      AND username IS NOT NULL
    ORDER BY 
        (boost_until IS NOT NULL AND boost_until > now()) DESC,
        created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;