-- Enable RLS updates for notifications table
-- This allows users to update their own notifications (e.g., to setting 'data' status or 'is_read')

-- 1. Drop existing update policy if it exists (to avoid conflicts or being too restrictive)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

-- 2. Terminate generic policy if it exists
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.notifications;

-- 3. Create a comprehensive UPDATE policy
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Verify/Grant permissions just in case
GRANT UPDATE ON public.notifications TO authenticated;
