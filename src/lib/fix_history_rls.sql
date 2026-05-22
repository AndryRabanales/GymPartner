-- Fix RLS for workout_sessions to allow users to see history of others if they have access

-- 1. Workout Sessions Policy
CREATE POLICY "Users can view shared workout sessions"
ON workout_sessions FOR SELECT
USING (
    -- The session owner's history is public
    (SELECT (custom_settings->>'is_history_public')::boolean FROM profiles WHERE id = workout_sessions.user_id) = true
    OR
    -- The session owner has explicitly shared history with the requester
    EXISTS (
        SELECT 1 FROM history_shares 
        WHERE shared_by = workout_sessions.user_id 
        AND shared_with = auth.uid()
    )
);

-- 2. Workout Logs Policy
CREATE POLICY "Users can view workout logs for visible sessions"
ON workout_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM workout_sessions
        WHERE id = workout_logs.session_id
        AND (
            workout_sessions.user_id = auth.uid()
            OR (SELECT (custom_settings->>'is_history_public')::boolean FROM profiles WHERE id = workout_sessions.user_id) = true
            OR EXISTS (
                SELECT 1 FROM history_shares 
                WHERE shared_by = workout_sessions.user_id 
                AND shared_with = auth.uid()
            )
        )
    )
);
