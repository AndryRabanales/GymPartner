-- Run this in your Supabase SQL Editor to fix the "Training not found" error
-- and enable Time, Distance, and RPE tracking.

ALTER TABLE workout_logs 
ADD COLUMN IF NOT EXISTS time NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS distance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rpe NUMERIC DEFAULT 0;

-- Optional: Comment on columns
COMMENT ON COLUMN workout_logs.time IS 'Duration in seconds';
COMMENT ON COLUMN workout_logs.distance IS 'Distance in meters';
COMMENT ON COLUMN workout_logs.rpe IS 'Rate of Perceived Exertion (1-10)';
