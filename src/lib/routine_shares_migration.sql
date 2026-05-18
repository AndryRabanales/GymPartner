-- 1. Create Routine Shares Table (Many-to-Many Relationship)
CREATE TABLE IF NOT EXISTS routine_shares (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    routine_id UUID REFERENCES routines(id) ON DELETE CASCADE,
    shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(routine_id, shared_with)
);

-- 2. RLS Policies (Security)
ALTER TABLE routine_shares ENABLE ROW LEVEL SECURITY;

-- SAFE UPDATE: Drop old policies if they exist to prevent errors
DROP POLICY IF EXISTS "Users can view routines shared with them" ON routine_shares;
DROP POLICY IF EXISTS "Users can share routines" ON routine_shares;

-- Allow users to view shares they are involved in (either shared by them or shared with them)
CREATE POLICY "Users can view routines shared with them"
ON routine_shares FOR SELECT
USING (auth.uid() = shared_with OR auth.uid() = shared_by);

-- Allow users who created the share to manage it (insert/update/delete)
CREATE POLICY "Users can share routines"
ON routine_shares FOR ALL
USING (auth.uid() = shared_by);
