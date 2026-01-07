
-- 🎁 MANUAL XP REWARD SCRIPT 🎁
-- 1. Replace 'CORREO_DEL_USUARIO@GMAIL.COM' with the real email.
-- 2. Run this script.

DO $$
DECLARE
  v_target_email text := 'CORREO_DEL_USUARIO@GMAIL.COM'; -- <--- ✏️ EDIT HERE / EDITA AQUÍ
  v_xp_amount int := 250;
  v_user_id uuid;
  v_old_xp int;
  v_new_xp int;
BEGIN
  -- 1. Find User ID by Email (requires access to auth.users)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_target_email;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ ERROR: No matching user found for email: %', v_target_email;
    RETURN;
  END IF;

  -- 2. Get Current XP
  SELECT COALESCE(xp, 0) INTO v_old_xp FROM profiles WHERE id = v_user_id;

  RAISE NOTICE '🎯 FOUND USER: %', v_target_email;
  RAISE NOTICE '📊 CURRENT XP: %', v_old_xp;

  -- 3. Award XP
  PERFORM increment_xp(v_user_id, v_xp_amount);

  -- 4. Verify
  SELECT COALESCE(xp, 0) INTO v_new_xp FROM profiles WHERE id = v_user_id;

  RAISE NOTICE '✅ XP AWARDED!';
  RAISE NOTICE '📈 NEW XP TOTAL: % (+%)', v_new_xp, (v_new_xp - v_old_xp);

END $$;
