-- =====================================================================
-- FIX: Add coop_invite and coop_join_request to notifications type ENUM
-- Run this in your Supabase SQL Editor
-- =====================================================================

-- Step 1: Add the new values to the ENUM (only if they don't exist)
DO $$
BEGIN
    -- Add 'coop_invite' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'notification_type'
        )
        AND enumlabel = 'coop_invite'
    ) THEN
        ALTER TYPE notification_type ADD VALUE 'coop_invite';
    END IF;

    -- Add 'coop_join_request' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'notification_type'
        )
        AND enumlabel = 'coop_join_request'
    ) THEN
        ALTER TYPE notification_type ADD VALUE 'coop_join_request';
    END IF;

    -- Add 'coop_accepted' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'notification_type'
        )
        AND enumlabel = 'coop_accepted'
    ) THEN
        ALTER TYPE notification_type ADD VALUE 'coop_accepted';
    END IF;

    -- Add 'coop_join_accepted' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'notification_type'
        )
        AND enumlabel = 'coop_join_accepted'
    ) THEN
        ALTER TYPE notification_type ADD VALUE 'coop_join_accepted';
    END IF;

    -- Add 'room_closed' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'notification_type'
        )
        AND enumlabel = 'room_closed'
    ) THEN
        ALTER TYPE notification_type ADD VALUE 'room_closed';
    END IF;
END
$$;

-- Step 2: If the type column is TEXT (not ENUM), just verify it works:
-- The insert should work as-is with TEXT columns. 
-- Only run Step 1 if you have an ENUM type called 'notification_type'.

-- To verify which type the column is, run:
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'notifications'
  AND column_name = 'type';
