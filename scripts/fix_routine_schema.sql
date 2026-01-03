-- Fix Routine Exercises Schema
-- Add missing columns for rich metrics persistence

ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS track_time BOOLEAN DEFAULT false;

ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS track_distance BOOLEAN DEFAULT false;

ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS track_rpe BOOLEAN DEFAULT false;

ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS track_pr BOOLEAN DEFAULT false;

ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS custom_metric TEXT DEFAULT null;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'routine_exercises';
