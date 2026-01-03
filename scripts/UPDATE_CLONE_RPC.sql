-- ================================================================
-- UPDATE RPC: clone_full_routine (VERSION CORREGIDA V2)
-- ================================================================
-- Eliminadas columnas que no existen en PRODUCCIÓN (difficulty_level, etc.)

DROP FUNCTION IF EXISTS clone_full_routine(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION clone_full_routine(
    p_user_id UUID,
    p_source_routine_id UUID,
    p_target_gym_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    routine_id UUID,
    error TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_routine_id UUID;
    v_source_routine RECORD;
BEGIN
    -- 1. Obtener Rutina Fuente
    SELECT * INTO v_source_routine FROM routines WHERE id = p_source_routine_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::uuid, 'Rutina origen no encontrada'::text;
        RETURN;
    END IF;

    -- 2. Crear Nueva Rutina en el Gym Destino
    -- NOTA: Se eliminaron difficulty_level y estimated_duration que no existen en el esquema actual
    INSERT INTO routines (
        user_id,
        gym_id,
        name,
        created_at,
        is_public,
        description 
        -- Si 'description' también falla, habrá que borrarla, pero suele existir.
    ) VALUES (
        p_user_id,
        p_target_gym_id,
        v_source_routine.name,
        NOW(),
        false, 
        v_source_routine.description
    ) RETURNING id INTO v_new_routine_id;

    -- 3. Copiar Ejercicios (CON TODAS LAS MÉTRICAS)
    INSERT INTO routine_exercises (
        routine_id,
        exercise_id,
        name,           
        order_index,
        track_weight,
        track_reps,
        track_time,
        track_distance, 
        track_rpe,      
        track_pr,       
        custom_metric,  
        target_sets,
        target_reps_text
    )
    SELECT 
        v_new_routine_id,
        exercise_id,
        name,
        order_index,
        track_weight,
        track_reps,
        track_time,
        track_distance,
        track_rpe,
        track_pr,
        custom_metric,
        target_sets,
        target_reps_text
    FROM routine_exercises
    WHERE routine_id = p_source_routine_id;

    -- Retornar Éxito
    RETURN QUERY SELECT true, v_new_routine_id, NULL::text;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, NULL::uuid, ('Error interno: ' || SQLERRM)::text;
END;
$$;
