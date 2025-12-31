-- VERIFY SCENARIO: FAMOUS UNSEEN VS FAMOUS SEEN
-- Picks the most "Viral" video and calculates its score in both states.

WITH viral_video AS (
    SELECT 
        p.*,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) as likes_count
    FROM posts p
    WHERE p.type = 'video' 
    ORDER BY (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) DESC, p.virality_score DESC 
    LIMIT 1
)
SELECT 
    id as video_id,
    substring(caption for 30) as caption,
    likes_count,
    virality_score,
    
    -- SCENARIO 1: UNSEEN
    -- (Approximate calculations based on V4 formula)
    (
        (retention_score * 50.0) + 
        (COALESCE(saves_count, 0) * 60.0) + 
        (COALESCE(shares_count, 0) * 50.0) +
        (COALESCE(boost_factor, 1.0) * 30.0) +
        -- Viral Boosts
        (CASE WHEN virality_score > 50 THEN 1.5 ELSE 1.0 END * 20.0) +
        -- Randomness
        20.0 
    )::NUMERIC(10, 2) as score_if_unseen,
    
    -- SCENARIO 2: SEEN
    -- The exact same score minus 1,000,000
    (
        (
            (retention_score * 50.0) + 
            (COALESCE(saves_count, 0) * 60.0) + 
            (COALESCE(shares_count, 0) * 50.0) +
            (COALESCE(boost_factor, 1.0) * 30.0) +
             -- Viral Boosts
            (CASE WHEN virality_score > 50 THEN 1.5 ELSE 1.0 END * 20.0) +
            20.0
        ) 
        - 1000000.0
    )::NUMERIC(10, 2) as score_if_seen,

    'VERDICT' as check,
    CASE 
        WHEN ((retention_score * 50) + 20 - 1000000) < 0 THEN '✅ SYSTEM WORKING: Viral Video Buried' 
        ELSE '❌ FAIL' 
    END as status

FROM viral_video;
