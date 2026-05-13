-- G-POINTS REFINEMENT & RADAR BOOST MIGRATION

-- 1. Update Profiles with Boost and Subscription fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS boost_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_subscriber BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0;

-- 2. Create Referrals Log Table for strict tracking
CREATE TABLE IF NOT EXISTS referrals_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES profiles(id) NOT NULL,
    referred_id UUID UNIQUE NOT NULL, -- The user who was invited (prevent duplicate rewards)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enhanced Referral Reward Function
CREATE OR REPLACE FUNCTION handle_referral_reward_v2()
RETURNS TRIGGER AS $$
DECLARE
    ref_count INTEGER;
BEGIN
    -- Check if this user was already referred (duplicate prevention)
    IF EXISTS (SELECT 1 FROM referrals_log WHERE referred_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    -- Only if referred_by is set and referrer is not the user themselves
    IF NEW.referred_by IS NOT NULL AND NEW.referred_by <> NEW.id THEN
        
        -- 1. Log the referral
        INSERT INTO referrals_log (referrer_id, referred_id)
        VALUES (NEW.referred_by, NEW.id);

        -- 2. Award G-Points (100)
        UPDATE profiles SET g_points = COALESCE(g_points, 0) + 100 WHERE id = NEW.referred_by;

        -- 4. Increment total referrals count
        UPDATE profiles SET total_referrals = COALESCE(total_referrals, 0) + 1 WHERE id = NEW.referred_by;

        -- 5. Check for Bonus (Every 10 referrals -> +500 G-Points)
        SELECT total_referrals INTO ref_count FROM profiles WHERE id = NEW.referred_by;
        IF ref_count % 10 = 0 THEN
            UPDATE profiles SET g_points = g_points + 500 WHERE id = NEW.referred_by;
        END IF;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-attach Trigger
DROP TRIGGER IF EXISTS on_profile_referral ON profiles;
CREATE TRIGGER on_profile_referral
    AFTER UPDATE OF referred_by ON profiles
    FOR EACH ROW
    WHEN (OLD.referred_by IS NULL AND NEW.referred_by IS NOT NULL)
    EXECUTE FUNCTION handle_referral_reward_v2();

-- 5. Optimized Radar Function with Boost Priority
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
        SELECT DISTINCT ON (upg.user_id)
            upg.user_id as u_id,
            ng.g_id,
            ng.name,
            ng.lat,
            ng.lng,
            ng.dist
        FROM public.user_gyms upg
        JOIN nearby_gyms ng ON upg.gym_id = ng.g_id
        WHERE upg.user_id != current_user_id
        ORDER BY upg.user_id, ng.dist ASC
    )
    SELECT 
        p.id as user_id,
        COALESCE(p.username, 'Agente Desconocido') as username,
        p.avatar_url,
        (p.custom_settings->>'banner_url')::text as banner_url,
        COALESCE(p.custom_settings->>'description', p.description) as description,
        p.checkins_count,
        gu.g_id as gym_id,
        gu.name as gym_name,
        gu.lat as gym_lat,
        gu.lng as gym_lng,
        gu.dist as distance_km,
        0 as followers_count,
        (p.boost_until > NOW()) as is_boosted
    FROM gym_users gu
    JOIN public.profiles p ON gu.u_id = p.id
    ORDER BY 
        (p.boost_until > NOW()) DESC, -- Boosted users first (Tinder style)
        gu.dist ASC                   -- Then by distance
    LIMIT 50;
END;
$$;
