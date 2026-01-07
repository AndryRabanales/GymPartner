
-- 🎁 RECOMPENSA MANUAL POR NOMBRE 🎁
-- 1. Reemplaza 'NOMBRE_A_BUSCAR' con el nombre o parte del nombre.
--    Ejemplo: 'Juan', 'Andry', 'GymMaster'

DO $$
DECLARE
  v_search_name text := 'NOMBRE_A_BUSCAR'; -- <--- ✏️ EDITA AQUÍ
  v_xp_amount int := 250;
  v_found_count int;
  v_user_id uuid;
  v_user_email text;
  v_user_name text;
  v_old_xp int;
  v_new_xp int;
BEGIN
  -- 1. Buscamos coincidencias (case insensitive)
  -- Asumimos que la columna se llama 'username' o 'full_name'. Probaremos ambas si existen, o username como default.
  -- Ajustado a 'username' basado en el código de la app.
  
  -- Create a temporary table to store matches
  CREATE TEMP TABLE matches AS
  SELECT p.id, p.username, u.email, p.xp
  FROM profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.username ILIKE '%' || v_search_name || '%';

  SELECT COUNT(*) INTO v_found_count FROM matches;

  -- 2. Logic
  IF v_found_count = 0 THEN
    RAISE NOTICE '❌ No se encontraron usuarios con el nombre "%"', v_search_name;
  
  ELSIF v_found_count > 1 THEN
    RAISE NOTICE '⚠️ Se encontraron % usuarios. Sé más específico:', v_found_count;
    FOR v_user_name, v_user_email IN SELECT username, email FROM matches LOOP
      RAISE NOTICE '   - % (%)', v_user_name, v_user_email;
    END LOOP;
    
  ELSE
    -- EXACTAMENTE UNO ENCONTRADO
    SELECT id, username, email, COALESCE(xp, 0) 
    INTO v_user_id, v_user_name, v_user_email, v_old_xp 
    FROM matches LIMIT 1;
    
    RAISE NOTICE '🎯 USUARIO ENCONTRADO: % (%s)', v_user_name, v_user_email;
    RAISE NOTICE '📊 XP ACTUAL: %', v_old_xp;
    
    -- Award XP
    PERFORM increment_xp(v_user_id, v_xp_amount);
    
    -- Verify
    SELECT COALESCE(xp, 0) INTO v_new_xp FROM profiles WHERE id = v_user_id;
    
    RAISE NOTICE '✅ XP OTORGADO EXITOSAMENTE!';
    RAISE NOTICE '📈 NUEVO TOTAL: % (+%)', v_new_xp, (v_new_xp - v_old_xp);
  END IF;

  -- Cleanup
  DROP TABLE matches;

END $$;
