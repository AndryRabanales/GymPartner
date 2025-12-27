-- RUN THIS IN SUPABASE SQL EDITOR TO FIX THE ERROR
-- Solves: "column routines.is_public does not exist"

ALTER TABLE routines 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Update existing records to be public (optional, but good for visibility)
UPDATE routines SET is_public = true WHERE is_public IS NULL;
