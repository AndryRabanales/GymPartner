-- Run this in Supabase SQL Editor to enable "Infinite Metrics"

ALTER TABLE workout_logs 
ADD COLUMN IF NOT EXISTS metrics_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN workout_logs.metrics_data IS 'Flexible storage for custom metrics (e.g. {"jumps": 10, "calories": 50})';
