-- ==========================================
-- GYMPARTNER DATABASE HARDENING (RLS) - v2 (Idempotent)
-- Execution: Run in Supabase SQL Editor
-- ==========================================

-- 1. PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- 2. GYMS
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gyms are viewable by everyone" ON gyms;
CREATE POLICY "Gyms are viewable by everyone" 
ON gyms FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Only admins can modify gyms" ON gyms;
CREATE POLICY "Only admins can modify gyms" 
ON gyms FOR ALL 
USING (false) -- Restricted for MVP
WITH CHECK (false);

-- 3. USER_GYMS
ALTER TABLE user_gyms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own gym memberships" ON user_gyms;
CREATE POLICY "Users can view their own gym memberships" 
ON user_gyms FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own gym memberships" ON user_gyms;
CREATE POLICY "Users can manage their own gym memberships" 
ON user_gyms FOR ALL 
USING (auth.uid() = user_id);

-- 4. GYM_EQUIPMENT
ALTER TABLE gym_equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipment is viewable by everyone" ON gym_equipment;
CREATE POLICY "Equipment is viewable by everyone" 
ON gym_equipment FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can add/update equipment" ON gym_equipment;
CREATE POLICY "Authenticated users can add/update equipment" 
ON gym_equipment FOR ALL 
TO authenticated
USING (true) -- Allow any auth user to report intel/add for now
WITH CHECK (true);

-- 5. WORKOUT_SESSIONS
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sessions" ON workout_sessions;
CREATE POLICY "Users can view their own sessions" 
ON workout_sessions FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own sessions" ON workout_sessions;
CREATE POLICY "Users can manage their own sessions" 
ON workout_sessions FOR ALL 
USING (auth.uid() = user_id);

-- 6. WORKOUT_LOGS
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- MIGRATION: Add category_snapshot for historical preservation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_logs' AND column_name = 'category_snapshot') THEN
        ALTER TABLE workout_logs ADD COLUMN category_snapshot TEXT;
    END IF;
END $$;

DROP POLICY IF EXISTS "Users can view their own logs" ON workout_logs;
CREATE POLICY "Users can view their own logs" 
ON workout_logs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM workout_sessions 
    WHERE id = workout_logs.session_id 
    AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage their own logs" ON workout_logs;
CREATE POLICY "Users can manage their own logs" 
ON workout_logs FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM workout_sessions 
    WHERE id = workout_logs.session_id 
    AND user_id = auth.uid()
  )
);

-- 7. EXERCISES (Global Catalog)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Exercises are viewable by everyone" ON exercises;
CREATE POLICY "Exercises are viewable by everyone" 
ON exercises FOR SELECT 
USING (true);

-- 8. ROUTINES
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own routines" ON routines;
CREATE POLICY "Users can view their own routines" 
ON routines FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own routines" ON routines;
CREATE POLICY "Users can manage their own routines" 
ON routines FOR ALL 
USING (auth.uid() = user_id);

-- 9. ROUTINE_EXERCISES
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own routine exercises" ON routine_exercises;
CREATE POLICY "Users can view their own routine exercises" 
ON routine_exercises FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM routines 
    WHERE id = routine_exercises.routine_id 
    AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage their own routine exercises" ON routine_exercises;
CREATE POLICY "Users can manage their own routine exercises" 
ON routine_exercises FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM routines 
    WHERE id = routine_exercises.routine_id 
    AND user_id = auth.uid()
  )
);
