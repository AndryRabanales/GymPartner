
-- SIMULATION: REFERRAL EVENT
-- This script picks a user, checks their XP, gives them 250 XP, and checks again.

DO $$
DECLARE
  v_referrer_id uuid;
  v_initial_xp int;
  v_final_xp int;
  v_amount int := 250;
BEGIN
  -- 1. Pick a random user to be the "Referrer"
  SELECT id, COALESCE(xp, 0) INTO v_referrer_id, v_initial_xp
  FROM profiles
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RAISE NOTICE '❌ simulation failed: No users found in profiles table.';
    RETURN;
  END IF;

  RAISE NOTICE '---------------------------------------------------';
  RAISE NOTICE '🧪 STARTING SIMULATION FOR USER: %', v_referrer_id;
  RAISE NOTICE '📊 INITIAL XP: %', v_initial_xp;
  RAISE NOTICE '---------------------------------------------------';

  -- 2. Execute the XP Increment (The Action)
  PERFORM increment_xp(v_referrer_id, v_amount);

  -- 3. Check Result
  SELECT COALESCE(xp, 0) INTO v_final_xp
  FROM profiles
  WHERE id = v_referrer_id;

  RAISE NOTICE '---------------------------------------------------';
  RAISE NOTICE '📊 FINAL XP: %', v_final_xp;
  RAISE NOTICE '📈 CHANGE: +%', (v_final_xp - v_initial_xp);
  RAISE NOTICE '---------------------------------------------------';

  IF (v_final_xp - v_initial_xp) = v_amount THEN
    RAISE NOTICE '✅ SUCCESS: XP awarded correctly!';
  ELSE
    RAISE NOTICE '❌ FAILURE: XP did not increase as expected.';
  END IF;

END $$;
