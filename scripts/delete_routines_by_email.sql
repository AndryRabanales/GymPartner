DO $$
DECLARE
    target_user_id uuid;
    target_email text := 'rabanalesandry2@gmail.com';
BEGIN
    -- 1. Find User ID from Auth
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = target_email;

    -- Alternative: If using a public profiles table and you want to search by username
    -- SELECT id INTO target_user_id FROM public.users WHERE username = 'Andry_Rabanales';

    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User with email % not found.', target_email;
        RETURN;
    END IF;

    RAISE NOTICE 'Found User ID: % for email %', target_user_id, target_email;

    -- 2. Delete Routines
    -- This will delete all routines created by this user.
    -- If foreign keys (routine_exercises) are set to CASCADE, they will vanish too.
    -- If not, you might need: DELETE FROM routine_exercises WHERE routine_id IN (SELECT id FROM routines WHERE user_id = target_user_id);
    
    DELETE FROM routines
    WHERE user_id = target_user_id;

    RAISE NOTICE 'Successfully deleted all routines for user %', target_email;
END $$;
