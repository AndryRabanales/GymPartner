-- Drop existing to ensure clean slate if signature changed
DROP FUNCTION IF EXISTS increment_xp(uuid, integer);

-- Recreate with robust logic
CREATE OR REPLACE FUNCTION increment_xp(user_id uuid, xp_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert if not exists, otherwise update
  INSERT INTO user_streaks (user_id, xp, streak_count, last_activity_date)
  VALUES (user_id, xp_amount, 0, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    xp = user_streaks.xp + EXCLUDED.xp,
    last_activity_date = NOW();
END;
$$;

-- Grant permissions just in case
GRANT EXECUTE ON FUNCTION increment_xp(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_xp(uuid, integer) TO service_role;
