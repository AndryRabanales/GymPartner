
-- VISUAL SIMULATION
-- This script creates a temporary helper to show you the results in a table.

CREATE OR REPLACE FUNCTION test_simulation_visual()
RETURNS TABLE(status text, user_id uuid, current_xp int) AS $$
DECLARE
  v_user_id uuid;
  v_xp_start int;
  v_xp_end int;
BEGIN
  -- 1. Get a random user
  SELECT id, COALESCE(xp, 0) INTO v_user_id, v_xp_start FROM profiles LIMIT 1;

  -- 2. Show Starting State
  status := '1. INICIO (Antes)';
  user_id := v_user_id;
  current_xp := v_xp_start;
  RETURN NEXT;

  -- 3. Give 250 XP
  PERFORM increment_xp(v_user_id, 250);

  -- 4. Get New State
  SELECT COALESCE(xp, 0) INTO v_xp_end FROM profiles WHERE id = v_user_id;

  -- 5. Show Final State
  status := '2. FINAL (Despues)';
  user_id := v_user_id;
  current_xp := v_xp_end;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Execute to see the table
SELECT * FROM test_simulation_visual();

-- Cleanup
DROP FUNCTION test_simulation_visual();
