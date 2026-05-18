-- ============================================================
-- GYMPARTNER: PUBLIC SELECT READ FOR FOLLOWS TABLE
-- Description: Ensures all authenticated users can read all follows 
--              records to guarantee 100% consistent stats between
--              ranking list, radar, and user profiles.
-- ============================================================

-- 1. ENABLE Row Level Security (should already be enabled)
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- 2. DROP any restrictive select policies on follows if they exist
DROP POLICY IF EXISTS "Allow public read access on follows" ON public.follows;
DROP POLICY IF EXISTS "Permitir lectura de seguidores a todos" ON public.follows;
DROP POLICY IF EXISTS "follows_read_policy" ON public.follows;
DROP POLICY IF EXISTS "Everyone can read follows" ON public.follows;

-- 3. CREATE a clean policy that allows ALL authenticated users to read follows
CREATE POLICY "Everyone can read follows" 
ON public.follows 
FOR SELECT 
TO authenticated 
USING (true);

-- 4. Ensure INSERT/DELETE policies are still secure
DROP POLICY IF EXISTS "Users can insert their own follows" ON public.follows;
CREATE POLICY "Users can insert their own follows" 
ON public.follows 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can delete their own follows" ON public.follows;
CREATE POLICY "Users can delete their own follows" 
ON public.follows 
FOR DELETE 
TO authenticated 
USING (auth.uid() = follower_id);
