-- ============================================================
-- fix_coop_history_rls.sql
-- Permite a los participantes de sesiones co-op leer los logs
-- y sesiones de sus compañeros cuando están vinculados por
-- partner_session_id o partner_id.
-- Ejecutar UNA VEZ en Supabase SQL Editor.
-- ============================================================

-- ── workout_sessions ─────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'workout_sessions'
      AND policyname = 'Users can read linked coop partner sessions'
  ) THEN
    CREATE POLICY "Users can read linked coop partner sessions"
    ON public.workout_sessions
    FOR SELECT
    USING (
      -- 1. Sesión propia
      user_id = auth.uid()
      OR
      -- 2. El compañero me tiene como partner_id en su sesión
      partner_id = auth.uid()
      OR
      -- 3. Yo tengo su sesión como mi partner_session_id
      id IN (
        SELECT partner_session_id
        FROM public.workout_sessions
        WHERE user_id = auth.uid()
          AND partner_session_id IS NOT NULL
      )
      OR
      -- 4. Ellos tienen mi sesión como su partner_session_id
      partner_session_id IN (
        SELECT id FROM public.workout_sessions WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ── workout_logs ─────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'workout_logs'
      AND policyname = 'Users can read linked coop partner logs'
  ) THEN
    CREATE POLICY "Users can read linked coop partner logs"
    ON public.workout_logs
    FOR SELECT
    USING (
      -- 1. Logs propios (owner_id es la columna correcta en workout_logs)
      owner_id = auth.uid()
      OR
      -- 2. Logs de una sesión donde soy el partner_id
      session_id IN (
        SELECT id FROM public.workout_sessions WHERE partner_id = auth.uid()
      )
      OR
      -- 3. Logs cuya session_id es el partner_session_id de una de mis sesiones
      session_id IN (
        SELECT partner_session_id
        FROM public.workout_sessions
        WHERE user_id = auth.uid()
          AND partner_session_id IS NOT NULL
      )
      OR
      -- 4. Logs cuya session_id está vinculada recíprocamente a mi sesión
      session_id IN (
        SELECT id
        FROM public.workout_sessions
        WHERE partner_session_id IN (
          SELECT id FROM public.workout_sessions WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
END $$;

-- Verifica las políticas creadas
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workout_sessions', 'workout_logs')
ORDER BY tablename, policyname;
