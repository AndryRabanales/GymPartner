-- Force schema cache reload by notifying pgrst
NOTIFY pgrst, 'reload config';

-- Alternatively, making a schema change usually triggers it.
-- We can add a dummy comment to the table.
COMMENT ON TABLE routine_exercises IS 'Routine Exercises (Schema Refreshed)';
