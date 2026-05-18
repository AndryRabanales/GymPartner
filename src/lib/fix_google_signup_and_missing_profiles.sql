-- ============================================================
-- GYMPARTNER: GOOGLE SIGNUP & MISSING PROFILES REPAIR SCRIPT
-- Description: Fixes the Google OAuth "bounce" and registration failure
--              by creating a 100% fail-safe auth trigger and repairing
--              missing user profiles in public.profiles.
-- ============================================================

-- 1. Redefine handle_new_user to be completely fail-safe and XP-free
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Safe block to prevent signup blocking
  BEGIN
    INSERT INTO public.profiles (
      id, 
      username, 
      avatar_url, 
      description,
      g_points,
      total_referrals,
      checkins_count,
      is_subscriber
    )
    VALUES (
      new.id,
      COALESCE(
        new.raw_user_meta_data->>'username', 
        new.raw_user_meta_data->>'full_name', 
        split_part(new.email, '@', 1)
      ),
      COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
      '¡Hola! Soy un nuevo atleta en GymPartner.',
      0,
      0,
      0,
      false
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log warning but do not throw exception, so auth.users registration is never blocked
    RAISE WARNING 'Error creating user profile in handle_new_user: %', SQLERRM;
  END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop and Re-create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Retroactively repair any existing auth.users that are missing in public.profiles
INSERT INTO public.profiles (
  id, 
  username, 
  avatar_url, 
  description,
  g_points,
  total_referrals,
  checkins_count,
  is_subscriber
)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'username', raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 
  COALESCE(raw_user_meta_data->>'avatar_url', ''), 
  '¡Hola! Soy un nuevo atleta en GymPartner.', 
  0, 
  0, 
  0, 
  false
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 4. Create a fail-safe dummy function for legacy increment_xp RPC calls to prevent frontend failures
CREATE OR REPLACE FUNCTION public.increment_xp(u_id uuid, amount integer)
RETURNS void AS $$
BEGIN
  -- Since XP column is deprecated, redirect the reward to G-points as a bonus!
  UPDATE public.profiles
  SET g_points = COALESCE(g_points, 0) + (amount / 2) -- e.g. 250 XP becomes 125 G-Points
  WHERE id = u_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
