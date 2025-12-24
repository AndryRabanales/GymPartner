-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- This allows you to create "Personal Equipment" that doesn't belong to any specific local Gym.

ALTER TABLE gym_equipment ALTER COLUMN gym_id DROP NOT NULL;

-- Optional: Add a comment to remember why this was done
COMMENT ON COLUMN gym_equipment.gym_id IS 'Can be NULL for Personal/Global items created by users without a gym.';
