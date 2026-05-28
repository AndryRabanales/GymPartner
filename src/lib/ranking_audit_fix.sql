-- ============================================================
-- GINX: RANKING & ACCOUNT AUDIT SCRIPT
-- Description: Ensures all users are assigned to a gym and 
--              recalculates stats for accurate leaderboard ranking.
-- ============================================================

-- 1. IDENTIFY & FIX USERS WITHOUT A HOME GYM
-- If a user has visited a gym (user_gyms) but hasn't set a "Home Base",
-- we'll automatically assign their most recently visited or marked gym.
UPDATE profiles p
SET home_gym_id = (
    SELECT gym_id 
    FROM user_gyms 
    WHERE user_id = p.id 
    ORDER BY is_home_base DESC, since DESC 
    LIMIT 1
)
WHERE home_gym_id IS NULL;

-- 2. RECALCULATE CHECK-IN COUNTS
-- Ensures the "Training Days" stat is accurate based on actual sessions.
UPDATE profiles p
SET checkins_count = (
    SELECT COUNT(*) 
    FROM workout_sessions 
    WHERE user_id = p.id AND (finished_at IS NOT NULL OR end_time IS NOT NULL)
);

-- 3. VERIFICATION QUERY (Run this after executing the above)
-- This will show you who is still "Homeless" (No gym assigned)
-- SELECT username, checkins_count FROM profiles WHERE home_gym_id IS NULL;
