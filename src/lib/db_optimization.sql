-- ============================================================
-- GYMPARTNER DATABASE CLEANUP & OPTIMIZATION SCRIPT
-- Version: 1.1
-- Description: Removes redundant tables, unifies naming, 
--              and adds necessary indices/constraints.
-- ============================================================

-- 1. CLEANUP: REMOVE OBSOLETE TABLES
-- ai_journals: Replaced by manual notes or removed AI features
-- equipment: Redundant with gym_equipment
-- workout_sets: Redundant with workout_logs
-- gym_activity_weekly: Legacy ranking table
DROP TABLE IF EXISTS ai_journals CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
DROP TABLE IF EXISTS workout_sets CASCADE;
DROP TABLE IF EXISTS gym_activity_weekly CASCADE;

-- 2. PROFILE ENHANCEMENTS
-- Ensure core gamification and monetization fields exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS g_points INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS boost_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_subscriber BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id);

-- 3. INDEXING FOR PERFORMANCE (Radar & Social)
-- Speed up username searches and Radar ranking
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_boost_until ON profiles (boost_until);
CREATE INDEX IF NOT EXISTS idx_gyms_location ON gyms (lat, lng);
CREATE INDEX IF NOT EXISTS idx_gyms_place_id ON gyms (place_id);

-- 4. UNIFY WORKOUT SESSIONS
-- Ensure finished_at is the master column
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workout_sessions' AND column_name='end_time') THEN
        UPDATE workout_sessions SET finished_at = end_time WHERE finished_at IS NULL;
    END IF;
END $$;

-- 5. SOCIAL INTEGRITY (Cascading Deletes)
-- Delete media and likes when a post is removed
ALTER TABLE post_media DROP CONSTRAINT IF EXISTS post_media_post_id_fkey;
ALTER TABLE post_media ADD CONSTRAINT post_media_post_id_fkey 
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS post_likes_post_id_fkey;
ALTER TABLE post_likes ADD CONSTRAINT post_likes_post_id_fkey 
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_post_id_fkey;
ALTER TABLE comments ADD CONSTRAINT comments_post_id_fkey 
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

-- 6. ROUTINE CLEANUP
-- Standardize user reference and clean orphaned columns
ALTER TABLE routines DROP COLUMN IF EXISTS created_by;
-- Link routine_exercises to routines with cascade
ALTER TABLE routine_exercises DROP CONSTRAINT IF EXISTS routine_exercises_routine_id_fkey;
ALTER TABLE routine_exercises ADD CONSTRAINT routine_exercises_routine_id_fkey 
    FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE;

-- 7. NOTIFICATION CLEANUP
-- Auto-delete notifications for deleted users
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================
-- SUCCESS: Database structure is now clean and optimized.
-- ============================================================
