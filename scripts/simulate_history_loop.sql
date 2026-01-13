-- SIMULATION: THE ETERNAL CYCLE OF GAINS (FIXED UUID)
-- This script proves that data saved today becomes "History" tomorrow.

-- 1. SETUP: GET A REAL USER TO TEST WITH (Avoid Foreign Key Error)
-- We pick the first user available in the system.
DO $$
DECLARE
    target_user_id UUID;
    simulated_date DATE := '2025-01-01';
BEGIN
    -- Select the first user found in auth.users
    SELECT id INTO target_user_id FROM auth.users LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE NOTICE 'No users found in auth.users. Please sign up a user first.';
        RETURN;
    END IF;

    RAISE NOTICE 'Testing with User ID: %', target_user_id;

    -- 2. CLEANUP (Delete previous test entry for this specific date)
    DELETE FROM public.ai_journals 
    WHERE user_id = target_user_id 
    AND date = simulated_date;

    -- 3. DAY 1: THE PAST (INSERT SIMULATED DATA)
    INSERT INTO public.ai_journals (user_id, date, content, mood, user_note, metrics_snapshot)
    VALUES (
        target_user_id, 
        simulated_date, 
        'Andry aumentó volumen +15%. Buen trabajo de pierna.', 
        'fire', 
        'Me sentí fuerte pero la rodilla molestó al final.', -- USER NOTE
        '{"total_volume": 10000, "workouts_count": 1, "skipped_days": 0}'::jsonb
    );

    -- 4. VERIFICATION (In the same block to see output in logs)
    -- This section simulates what "JournalService.getEntries" does.
    PERFORM * FROM public.ai_journals 
    WHERE user_id = target_user_id 
    AND date = simulated_date;

    RAISE NOTICE '✅ SUCCESS: Data inserted for 2025-01-01.';
END $$;

-- 5. DAY 2: THE QUERY (Run this separately to see result in grid if supported, or rely on DO block)
SELECT 
    date, 
    user_note as "NOTA DE AYER (Memoria)", 
    mood,
    content as "VEREDICTO IA"
FROM public.ai_journals
WHERE date = '2025-01-01' -- Looking at the past
LIMIT 1;
