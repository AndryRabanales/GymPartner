-- ==============================================================================
-- GYMPARTNER SECURITY PROTOCOL (HACK-PROOFING)
-- execution: Run this entire script in your Supabase SQL Editor
-- ==============================================================================

-- 1. PROTECT CORE STATS (XP & RANK)
-- Prevent users from modifying their own XP or Rank directly via API
CREATE OR REPLACE FUNCTION protect_xp_rank()
RETURNS TRIGGER AS $$
BEGIN
    -- If the user is a normal authenticated user (not a service/admin script)
    IF (auth.role() = 'authenticated') THEN
        -- Check if they are trying to change critical fields
        IF (NEW.xp IS DISTINCT FROM OLD.xp) THEN
            RAISE EXCEPTION 'Security Violation: Cannot modify XP directly.';
        END IF;
        IF (NEW.rank IS DISTINCT FROM OLD.rank) THEN
            RAISE EXCEPTION 'Security Violation: Cannot modify Rank directly.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_xp_hack ON profiles;
CREATE TRIGGER prevent_xp_hack
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION protect_xp_rank();


-- 2. SECURE GYM EQUIPMENT (Prevent Vandalism)
-- Only allow INSERT (adding new machines). Prevent DELETE/UPDATE by normal users.
ALTER TABLE gym_equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can add/update equipment" ON gym_equipment;
-- Split into distinct policies for better control

-- Allow Adding Machines (Community Contribution)
CREATE POLICY "Users can add equipment" 
ON gym_equipment FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Allow Viewing (Everyone)
CREATE POLICY "Users can view equipment" 
ON gym_equipment FOR SELECT 
USING (true);

-- BLOCK DELETE/UPDATE for normal users (Only admins could, if check was added)
-- By not creating a policy for DELETE/UPDATE for 'authenticated', it is denied by default.


-- 3. FIX COMMENTS SECURITY (Allow deletion of spam)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete their own comments" ON comments; -- if exists
CREATE POLICY "Users can delete their own comments" 
ON comments FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Post owners can delete comments on their posts" 
ON comments FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM posts 
        WHERE id = comments.post_id 
        AND user_id = auth.uid()
    )
);


-- 4. SECURE LOCATION CHECKING (Backend Validation)
-- Helper function to calculate distance in KM (Haversine)
CREATE OR REPLACE FUNCTION calculate_distance_km(lat1 float, lon1 float, lat2 float, lon2 float)
RETURNS float AS $$
DECLARE
    R constant integer := 6371;
    dLat float;
    dLon float;
    a float;
    c float;
BEGIN
    dLat := radians(lat2 - lat1);
    dLon := radians(lon2 - lon1);
    a := sin(dLat/2) * sin(dLat/2) +
         cos(radians(lat1)) * cos(radians(lat2)) *
         sin(dLon/2) * sin(dLon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- RPC to Validate Gym Proximity Securely (Call this before critical actions if needed)
CREATE OR REPLACE FUNCTION verify_gym_proximity(check_gym_id UUID, user_lat FLOAT, user_lng FLOAT)
RETURNS BOOLEAN AS $$
DECLARE
    gym_lat FLOAT;
    gym_lng FLOAT;
    dist FLOAT;
BEGIN
    SELECT lat, lng INTO gym_lat, gym_lng FROM gyms WHERE id = check_gym_id;
    
    IF gym_lat IS NULL OR gym_lng IS NULL THEN
        RETURN FALSE;
    END IF;

    dist := calculate_distance_km(user_lat, user_lng, gym_lat, gym_lng);
    
    -- Limit: 0.01 km = 10 meters
    IF dist <= 0.01 THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. AUDIT LOGGING (Optional but recommended)
-- Create a table to track suspicious activity check failures if needed in future
