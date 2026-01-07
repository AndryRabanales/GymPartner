
-- TEST SCRIPT: Manually increment XP to verify the function works
-- Replace 'YOUR_USER_ID_HERE' with a real User ID from your `profiles` table.

DO $$
DECLARE
  test_user_id uuid;
  user_found boolean;
BEGIN
  -- 1. Grab ANY user ID to test (limit 1)
  SELECT id INTO test_user_id FROM profiles LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    RAISE NOTICE '🧪 Testing XP Increment for User: %', test_user_id;
    
    -- 2. Call the function
    PERFORM increment_xp(test_user_id, 250);
    
    RAISE NOTICE '✅ XP Increment command executed.';
  ELSE
    RAISE NOTICE '❌ No users found in profiles table to test.';
  END IF;
END $$;
