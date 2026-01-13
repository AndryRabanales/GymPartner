-- Add routine_name to workout_sessions to enable AI comparative diagnosis
ALTER TABLE workout_sessions 
ADD COLUMN IF NOT EXISTS routine_name TEXT;

-- Index for faster lookups when searching for "last session of this routine"
CREATE INDEX IF NOT EXISTS idx_workout_sessions_routine_name 
ON workout_sessions(user_id, routine_name);
