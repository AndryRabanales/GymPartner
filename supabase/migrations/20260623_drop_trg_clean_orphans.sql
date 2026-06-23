-- The trg_clean_orphans trigger fires BEFORE every INSERT on workout_sessions.
-- It runs DELETE + UPDATE + a full scan of workout_logs to find orphan sessions.
-- Under concurrent coop session creation this causes lock contention and
-- statement timeouts, surfacing as "Error al iniciar sesión" for both users.
--
-- Client-side cleanOrphanSessions() in WorkoutService.ts already handles this
-- cleanup safely (it preserves is_multiplayer sessions). The DB trigger is
-- redundant and dangerous for coop flows.
DROP TRIGGER IF EXISTS trg_clean_orphans ON workout_sessions;
DROP FUNCTION IF EXISTS clean_orphaned_sessions_before_insert();
