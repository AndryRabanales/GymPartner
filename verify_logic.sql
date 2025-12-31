-- VERIFY UNSEEN FIRST LOGIC
-- Goal: Prove that Seen posts have massive negative scores (-1,000,000 range)
-- and Unseen posts have normal positive scores.

WITH test_user AS (
    -- Get a user who has actually viewed something
    SELECT user_id FROM post_views LIMIT 1
)
SELECT 
    f.id, 
    substring(f.caption for 20) as caption, 
    f.rank_score, 
    CASE WHEN pv.post_id IS NOT NULL THEN 'SEEN' ELSE 'UNSEEN' END as status
FROM 
    test_user tu
    CROSS JOIN LATERAL get_smart_feed_v3(tu.user_id, 20) f
    LEFT JOIN post_views pv ON f.id = pv.post_id AND pv.user_id = tu.user_id
ORDER BY f.rank_score DESC;
