-- 1. Create History Shares Table (Many-to-Many Relationship)
CREATE TABLE IF NOT EXISTS history_shares (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(shared_by, shared_with)
);

-- 2. RLS Policies (Security)
ALTER TABLE history_shares ENABLE ROW LEVEL SECURITY;

-- SAFE UPDATE: Drop old policies if they exist to prevent errors
DROP POLICY IF EXISTS "Users can view history shared with them" ON history_shares;
DROP POLICY IF EXISTS "Users can share history" ON history_shares;

-- Allow users to view history shares they are involved in
CREATE POLICY "Users can view history shared with them"
ON history_shares FOR SELECT
USING (auth.uid() = shared_with OR auth.uid() = shared_by);

-- Allow users who created the share to manage it (insert/update/delete)
CREATE POLICY "Users can share history"
ON history_shares FOR ALL
USING (auth.uid() = shared_by);
