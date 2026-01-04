-- CHECK_ROUTINE_EXISTS.sql
-- Check most recent routines for the user
SELECT * FROM routines 
ORDER BY created_at DESC 
LIMIT 5;

-- Check routine_exercises for the most recent routine
SELECT * FROM routine_exercises 
WHERE routine_id = (SELECT id FROM routines ORDER BY created_at DESC LIMIT 1);
