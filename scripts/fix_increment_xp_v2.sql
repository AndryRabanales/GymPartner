-- Drop match signature if possible, but drop by name to be safe
DROP FUNCTION IF EXISTS increment_xp(uuid, integer);

-- Recreate with TS-matching parameters: u_id, amount
CREATE OR REPLACE FUNCTION increment_xp(u_id uuid, amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert if not exists, otherwise update
  INSERT INTO user_streaks (user_id, xp, streak_count, last_activity_date)
  VALUES (u_id, amount, 0, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    xp = user_streaks.xp + EXCLUDED.xp,
    last_activity_date = NOW();
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_xp(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_xp(uuid, integer) TO service_role;
