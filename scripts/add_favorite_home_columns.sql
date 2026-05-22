-- Add favorite and home base columns to user_gyms table
ALTER TABLE public.user_gyms
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_home_base BOOLEAN DEFAULT FALSE;

-- Verify columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_gyms' AND column_name IN ('is_favorite', 'is_home_base');
