-- Server-Side Analytics Function (Scalability Booster)
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_user_stats(u_id UUID)
RETURNS JSON AS $$
DECLARE
    total_workouts INT;
    total_volume NUMERIC;
    total_time NUMERIC;
    result JSON;
BEGIN
    -- 1. Count Workouts
    SELECT COUNT(*) INTO total_workouts
    FROM workout_sessions
    WHERE user_id = u_id AND end_time IS NOT NULL;

    -- 2. Calculate Total Time (minutes)
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - started_at)) / 60), 0)
    INTO total_time
    FROM workout_sessions
    WHERE user_id = u_id AND end_time IS NOT NULL;

    -- 3. Calculate Normalized Volume (The "Smart" Calculation)
    SELECT COALESCE(SUM(
        CASE 
            WHEN weight_kg > 0 THEN (weight_kg * reps * COALESCE(sets, 1))
            WHEN reps > 0 AND weight_kg = 0 THEN (reps * 60 * COALESCE(sets, 1) * 0.5) -- Calisthenics
            WHEN COALESCE((metrics_data->>'time')::numeric,0) > 0 THEN (metrics_data->>'time')::numeric * 1.5 -- Cardio Time
            WHEN COALESCE((metrics_data->>'distance')::numeric,0) > 0 THEN (metrics_data->>'distance')::numeric * 0.5 -- Cardio Dist
            ELSE 0 
        END
    ), 0)
    INTO total_volume
    FROM workout_logs wl
    JOIN workout_sessions ws ON wl.session_id = ws.id
    WHERE ws.user_id = u_id;

    -- Return JSON package
    result := json_build_object(
        'totalWorkouts', total_workouts,
        'totalVolume', ROUND(total_volume, 2),
        'totalTimeMinutes', ROUND(total_time, 2)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON FUNCTION get_user_stats IS 'Calculates aggregated stats on the server to avoid heavy client-side processing.';
