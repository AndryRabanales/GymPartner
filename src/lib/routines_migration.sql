-- ROUTINES & BATTLE DECKS MIGRATION
-- Run this in Supabase SQL Editor

-- 1. Create Routines Table
CREATE TABLE IF NOT EXISTS routines (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create Routine Exercises Table
CREATE TABLE IF NOT EXISTS routine_exercises (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    routine_id UUID REFERENCES routines(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL, -- Storing ID from equipment/catalog
    name TEXT NOT NULL,        -- Cached name
    order_index INTEGER DEFAULT 0,
    
    -- Configuration
    target_sets INTEGER DEFAULT 4,
    target_reps_text TEXT DEFAULT '10-12',
    
    -- Tracking Flags
    track_weight BOOLEAN DEFAULT true,
    track_reps BOOLEAN DEFAULT true,
    track_time BOOLEAN DEFAULT false,
    track_pr BOOLEAN DEFAULT true
);

-- 3. Add Featured Routine to Profile
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS featured_routine_id UUID REFERENCES routines(id) ON DELETE SET NULL;

-- 4. RLS Policies (Security)
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;

-- SAFE UPDATE: Drop old policies if they exist to prevent errors
DROP POLICY IF EXISTS "Public routines are viewable by everyone" ON routines;
DROP POLICY IF EXISTS "Public routine exercises are viewable by everyone" ON routine_exercises;
DROP POLICY IF EXISTS "Users can manage own routines" ON routines;
DROP POLICY IF EXISTS "Users can manage own routine exercises" ON routine_exercises;

-- Allow read access to everyone (for ranking visibility)
CREATE POLICY "Public routines are viewable by everyone" 
ON routines FOR SELECT 
USING (true);

CREATE POLICY "Public routine exercises are viewable by everyone" 
ON routine_exercises FOR SELECT 
USING (true);

-- Allow insert/update/delete to owners
CREATE POLICY "Users can manage own routines" 
ON routines FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own routine exercises" 
ON routine_exercises FOR ALL 
USING (
    routine_id IN (
        SELECT id FROM routines WHERE user_id = auth.uid()
    )
);
