-- ============================================================
-- GINX: XP TRIGGER & FUNCTION CLEANUP
-- Description: Fixes the "record 'new' has no field 'xp'" error
--              by removing or updating obsolete triggers.
-- ============================================================

-- 1. DROP OBSOLETE TRIGGERS ON PROFILES
-- These are the most likely culprits for the error when saving profile.
DROP TRIGGER IF EXISTS on_profile_referral ON profiles;
DROP TRIGGER IF EXISTS on_profile_insert_referral ON profiles;

-- 2. REDEFINE REFERRAL REWARD FUNCTION (XP-FREE VERSION)
-- Uses G-Points and total_referrals instead of XP.
CREATE OR REPLACE FUNCTION public.handle_referral_reward()
RETURNS TRIGGER AS $$
BEGIN
    -- Only if referred_by is set and was previously null (first time attribution)
    -- AND the referrer is not the user themselves (prevent self-referral loop)
    IF NEW.referred_by IS NOT NULL AND (OLD.referred_by IS NULL OR TG_OP = 'INSERT') AND NEW.referred_by <> NEW.id THEN
        
        -- Award G-Points (100) instead of XP
        UPDATE profiles
        SET g_points = COALESCE(g_points, 0) + 100,
            total_referrals = COALESCE(total_referrals, 0) + 1
        WHERE id = NEW.referred_by;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RE-ATTACH UPDATED TRIGGERS
CREATE TRIGGER on_profile_referral
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    WHEN (OLD.referred_by IS NULL AND NEW.referred_by IS NOT NULL)
    EXECUTE FUNCTION public.handle_referral_reward();

CREATE TRIGGER on_profile_insert_referral
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_referral_reward();

-- 4. CLEANUP get_nearby_gymrats (RADAR FIX)
-- Redefine get_nearby_gymrats to use total_referrals/checkins_count instead of xp
CREATE OR REPLACE FUNCTION get_nearby_gymrats(
    current_lat float,
    current_lng float,
    radius_km float DEFAULT 99999.0,
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
        p.checkins_count as checkins_count, -- Use real checkins_count instead of XP/100
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
    WHERE p.id != current_user_id
      AND p.username IS NOT NULL
    ORDER BY 
        (p.boost_until IS NOT NULL AND p.boost_until > now()) DESC, -- Boosted first
        p.checkins_count DESC -- Then by consistency (instead of experience)
    LIMIT 50;
END;
$$;

-- 5. FINAL SAFETY CHECK: Drop XP column if it still exists (to avoid confusion)
-- ALTER TABLE profiles DROP COLUMN IF EXISTS xp; 
-- (Commented out for safety - run manually if you are sure)

-- SUCCESS: The error "record 'new' has no field 'xp'" should now be gone.
