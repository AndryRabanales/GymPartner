-- Inspect user_streaks table
SELECT * FROM information_schema.tables WHERE table_name = 'user_streaks';

-- Inspect increment_xp function
SELECT routine_name, routine_definition, external_language
FROM information_schema.routines 
WHERE routine_name = 'increment_xp';

-- Check RLS on user_streaks
SELECT * FROM pg_policies WHERE tablename = 'user_streaks';
