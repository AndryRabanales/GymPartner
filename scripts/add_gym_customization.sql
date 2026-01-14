-- Add customization columns to user_gyms table
ALTER TABLE user_gyms 
ADD COLUMN IF NOT EXISTS custom_bg_url TEXT,
ADD COLUMN IF NOT EXISTS custom_color TEXT;

-- Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_gyms';
