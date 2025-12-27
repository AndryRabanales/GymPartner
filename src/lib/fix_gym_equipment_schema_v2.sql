-- RUN THIS IN SUPABASE SQL EDITOR TO FIX THE 400 ERROR
-- Solves: "column gym_equipment.icon does not exist" AND "column gym_equipment.image_url does not exist"

-- 1. Add Image URL
ALTER TABLE gym_equipment 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Add Icon (Emoji)
ALTER TABLE gym_equipment 
ADD COLUMN IF NOT EXISTS icon TEXT;

-- 3. Add Verified By (User link)
ALTER TABLE gym_equipment 
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

-- Optional: Populate default icons for common categories if they are null
UPDATE gym_equipment SET icon = '⚡' WHERE icon IS NULL;
