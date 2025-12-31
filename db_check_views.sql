-- VERIFY VIEWS RECORDING
-- Check if post_views is actually being populated

-- 1. Count total views recorded
SELECT COUNT(*) as total_views_recorded FROM post_views;

-- 2. Show recent views for any user
SELECT * FROM post_views ORDER BY viewed_at DESC LIMIT 10;

-- 3. Check for specific user (Replace UUID if known, or just check general activity)
-- SELECT * FROM post_views WHERE user_id = 'YOUR_USER_ID';
