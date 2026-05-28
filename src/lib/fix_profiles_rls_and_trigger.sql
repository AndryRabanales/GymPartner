-- ==============================================================================
-- GINX: BULLETPROOF PROFILES TRIGGER & RETROACTIVE REPAIR
-- Description: Ensures handle_new_user trigger never fails for Facebook/Meta
--              or Google signups by adding safe fallback values for usernames,
--              even if email or raw metadata fields are null.
--              Retroactively repairs all missing profiles.
-- ==============================================================================

-- 1. Redefine handle_new_user to be completely bulletproof with random fallbacks
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
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1),
        'guerrero_' || floor(1000 + random() * 9000)::text
      ),
      COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
      '¡Hola! Soy un nuevo atleta en Ginx.',
      1000, -- Initialize with 1000 G-Points
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

-- 2. Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Retroactively repair ALL existing auth.users that are missing in public.profiles
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
  COALESCE(
    raw_user_meta_data->>'username', 
    raw_user_meta_data->>'full_name', 
    raw_user_meta_data->>'name',
    split_part(email, '@', 1),
    'guerrero_' || floor(1000 + random() * 9000)::text
  ), 
  COALESCE(raw_user_meta_data->>'avatar_url', ''), 
  '¡Hola! Soy un nuevo atleta en Ginx.', 
  1000, 
  0, 
  0, 
  false
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable clean INSERT/UPDATE policies on profiles just in case
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow public read access on profiles" ON public.profiles;
CREATE POLICY "Allow public read access on profiles" 
  ON public.profiles FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
CREATE POLICY "Allow users to insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);
