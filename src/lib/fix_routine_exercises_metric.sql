-- Add custom_metric and track_pr columns to routine_exercises if they do not exist
DO $$
BEGIN
    -- Enable custom_metric
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'routine_exercises'
        AND column_name = 'custom_metric'
    ) THEN
        ALTER TABLE routine_exercises ADD COLUMN custom_metric TEXT;
    END IF;

    -- Enable track_pr
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'routine_exercises'
        AND column_name = 'track_pr'
    ) THEN
        ALTER TABLE routine_exercises ADD COLUMN track_pr BOOLEAN DEFAULT FALSE;
    END IF;

     -- Enable track_time (just in case)
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'routine_exercises'
        AND column_name = 'track_time'
    ) THEN
        ALTER TABLE routine_exercises ADD COLUMN track_time BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
