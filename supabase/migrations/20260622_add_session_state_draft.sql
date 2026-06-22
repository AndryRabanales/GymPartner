-- Add session_state JSONB column to workout_sessions
-- Persists the full in-progress exercise draft (exercises array, routineName, etc.)
-- so a tab close or device switch never loses work that hasn't been committed as logs yet.
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS session_state JSONB DEFAULT NULL;
