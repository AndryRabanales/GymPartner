-- =========================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR TO FIX THE CRASH
-- =========================================================

-- 1. Add the missing column 'category_snapshot' to 'workout_logs'
ALTER TABLE workout_logs 
ADD COLUMN IF NOT EXISTS category_snapshot TEXT;

-- 2. (Optional) Backfill existing logs with data from joined tables to prevent empty tags
-- This tries to fetch the current category from the equipment and save it as a snapshot for old logs
UPDATE workout_logs
SET category_snapshot = (
  SELECT target_muscle_group 
  FROM exercises 
  WHERE exercises.id = workout_logs.exercise_id
)
WHERE category_snapshot IS NULL;

-- 3. Also check gym_equipment for Custom items
UPDATE workout_logs
SET category_snapshot = (
  SELECT category 
  FROM gym_equipment 
  WHERE gym_equipment.id = workout_logs.exercise_id
)
WHERE category_snapshot IS NULL;

-- 4. Default to 'Custom' if still null (Optional, or leave null)
-- UPDATE workout_logs SET category_snapshot = 'Custom' WHERE category_snapshot IS NULL;
