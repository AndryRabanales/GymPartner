-- RUN THIS IN SUPABASE SQL EDITOR TO FIX THE 400 ERROR
-- Solves: "column gym_equipment.image_url does not exist"

ALTER TABLE gym_equipment 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Optional: Add verify column if it's missing too, just in case
ALTER TABLE gym_equipment 
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

-- Optional: Add metrics column if it's missing (JSONB for flexibility)
ALTER TABLE gym_equipment 
ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{"weight": true, "reps": true}';
