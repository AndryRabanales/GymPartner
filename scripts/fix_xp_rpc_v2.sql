
-- 1. Drop existing functions to ensure clean slate
DROP FUNCTION IF EXISTS increment_xp(uuid, integer);
DROP FUNCTION IF EXISTS increment_xp(text, integer);

-- 2. Create Robust Function with NULL handling
CREATE OR REPLACE FUNCTION increment_xp(u_id uuid, amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET xp = COALESCE(xp, 0) + amount
  WHERE id = u_id;
END;
$$;

-- 3. Grant Execute Permissions Explicitly
GRANT EXECUTE ON FUNCTION increment_xp(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_xp(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION increment_xp(uuid, integer) TO anon;
