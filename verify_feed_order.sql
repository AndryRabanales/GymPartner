-- VERIFY FEED ORDER & SCORES
-- Checks if the feed returns different orders on subsequent calls and examines score magnitudes.

SELECT 
    id, 
    substring(caption for 20) as caption, 
    rank_score, 
    views_count,
    is_viral,
    is_cold_start
FROM get_smart_feed_v3(
    p_user_id := (SELECT id FROM auth.users LIMIT 1), -- Use a random user ID or NULL
    p_limit := 10
);

-- Run it again to compare (Manual check required in results)
SELECT 
    id, 
    substring(caption for 20) as caption, 
    rank_score 
FROM get_smart_feed_v3(
    p_user_id := (SELECT id FROM auth.users LIMIT 1), 
    p_limit := 10
);
