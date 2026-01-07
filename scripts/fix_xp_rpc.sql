
-- Drop first to ensure clean slate if signature changed
DROP FUNCTION IF EXISTS increment_xp(uuid, integer);
DROP FUNCTION IF EXISTS increment_xp(text, integer);

-- Create Function with SECURITY DEFINER to bypass RLS for XP updates
CREATE OR REPLACE FUNCTION increment_xp(u_id uuid, amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET xp = xp + amount
  WHERE id = u_id;
END;
$$;
