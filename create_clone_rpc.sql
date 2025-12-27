-- 1. Ensure 'name' column exists (Safety Check)
ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Ejercicio Personalizado';

-- 2. Create RPC for Deep Cloning (Bypassing RLS)
CREATE OR REPLACE FUNCTION clone_full_routine(
    p_user_id UUID, 
    p_source_routine_id UUID, 
    p_target_gym_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- IMPORTANT: Bypasses RLS to read source private data
AS $$
DECLARE
    v_source_routine RECORD;
    v_new_routine_id UUID;
    v_ex RECORD;
    v_source_eq RECORD;
    v_target_eq_id UUID;
    v_snapshot_name TEXT;
BEGIN
    -- A. Fetch Source Routine
    SELECT * INTO v_source_routine FROM routines WHERE id = p_source_routine_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Routine not found');
    END IF;

    -- B. Create New Routine (Clone)
    INSERT INTO routines (user_id, gym_id, name, description, is_public)
    VALUES (p_user_id, p_target_gym_id, v_source_routine.name, v_source_routine.description, false)
    RETURNING id INTO v_new_routine_id;

    -- C. Loop through Exercises
    FOR v_ex IN 
        SELECT * FROM routine_exercises WHERE routine_id = p_source_routine_id ORDER BY order_index
    LOOP
        -- 1. Try to fetch Source Equipment Details (Privileged Read)
        -- We want name, category, icon, image_url to CLONE it.
        SELECT * INTO v_source_eq FROM gym_equipment WHERE id = cast(v_ex.exercise_id as UUID);
        
        v_target_eq_id := NULL;
        v_snapshot_name := COALESCE(v_ex.name, v_source_eq.name, 'Ejercicio Importado');

        IF v_source_eq IS NOT NULL THEN
            -- 2. Check if we already have this equivalent in Target Gym
            SELECT id INTO v_target_eq_id 
            FROM gym_equipment 
            WHERE gym_id = p_target_gym_id 
              AND lower(name) = lower(v_source_eq.name); -- Simple Name Match
            
            -- 3. If NOT found, Clone it!
            IF v_target_eq_id IS NULL THEN
                INSERT INTO gym_equipment (
                    gym_id, name, category, quantity, metrics, icon, image_url, verified_by
                ) VALUES (
                    p_target_gym_id, 
                    v_source_eq.name, 
                    v_source_eq.category, 
                    1, 
                    v_source_eq.metrics, 
                    v_source_eq.icon, 
                    v_source_eq.image_url, 
                    p_user_id
                ) RETURNING id INTO v_target_eq_id;
            END IF;
        ELSE
             -- Source Equipment Deleted/Missing?
             -- Fallback: Use existing ID (if seed) or keep original ID?
             -- If it was a Seed (Global), it might not be in gym_equipment or user has read access?
             -- Let's check if it exists in 'exercises' (Global Seeds used in V1)
             -- Ideally, we just keep the exercise_id if we can't resolve it to a custom item.
             v_target_eq_id := cast(v_ex.exercise_id as UUID);
        END IF;

        -- D. Link to New Routine
        INSERT INTO routine_exercises (
            routine_id, exercise_id, name, order_index, 
            track_weight, track_reps, track_time, track_pr, 
            target_sets, target_reps_text, custom_metric
        ) VALUES (
            v_new_routine_id, 
            v_target_eq_id, 
            v_snapshot_name, -- Persist Snapshot
            v_ex.order_index,
            v_ex.track_weight,
            v_ex.track_reps, 
            v_ex.track_time, 
            v_ex.track_pr, 
            v_ex.target_sets, 
            v_ex.target_reps_text, 
            v_ex.custom_metric
        );

    END LOOP;

    RETURN jsonb_build_object('success', true, 'routine_id', v_new_routine_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload config';
