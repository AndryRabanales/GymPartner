-- Fix RLS for workout_sessions to allow friends to see active sessions even if history is private

-- Allow users to see active sessions of their friends (matches)
CREATE POLICY "Users can view active workout sessions of their matches"
ON workout_sessions FOR SELECT
USING (
    finished_at IS NULL
    AND (
        -- Requester is friends with the creator of the session
        EXISTS (
            SELECT 1 FROM chats
            WHERE (user_a = auth.uid() AND user_b = workout_sessions.user_id)
               OR (user_b = auth.uid() AND user_a = workout_sessions.user_id)
        )
        OR
        -- Requester is friends with the partner (guest) in the session
        EXISTS (
            SELECT 1 FROM chats
            WHERE (user_a = auth.uid() AND user_b = workout_sessions.partner_id)
               OR (user_b = auth.uid() AND user_a = workout_sessions.partner_id)
        )
    )
);
