-- Forcefully add the 'name' column if it's missing
-- This is necessary because 'CREATE TABLE IF NOT EXISTS' skips the table if it already exists, 
-- causing new columns in the definition to be ignored.

ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Ejercicio Personalizado';

-- Refresh the schema cache again just to be safe
NOTIFY pgrst, 'reload config';
