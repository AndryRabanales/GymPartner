-- ================================================
-- FIX RÁPIDO: Forzar métricas para FLEXIONES
-- ================================================

-- PASO 1: Buscar el ejercicio
DO $$
DECLARE
    flexiones_id UUID;
BEGIN
    -- Buscar FLEXIONES en gym_equipment
    SELECT id INTO flexiones_id
    FROM gym_equipment
    WHERE LOWER(name) LIKE '%flexion%' OR LOWER(name) LIKE '%pushup%'
    LIMIT 1;
    
    IF flexiones_id IS NOT NULL THEN
        -- Actualizar con métricas completas
        UPDATE gym_equipment 
        SET metrics = '{
            "weight": true,
            "reps": true,
            "time": true,
            "distance": false,
            "rpe": true
        }'::jsonb
        WHERE id = flexiones_id;
        
        RAISE NOTICE 'Actualizado ejercicio ID: %', flexiones_id;
    ELSE
        RAISE NOTICE 'No se encontró el ejercicio FLEXIONES';
    END IF;
END $$;

-- PASO 2: Actualizar TODAS las rutinas que usan FLEXIONES
UPDATE routine_exercises
SET 
    track_weight = true,
    track_reps = true,
    track_time = true,
    track_distance = false,
    track_rpe = true
WHERE LOWER(name) LIKE '%flexion%' OR LOWER(name) LIKE '%pushup%';

-- PASO 3: Verificar cambios
SELECT 
    'gym_equipment' as tabla,
    id,
    name,
    metrics::text as metricas
FROM gym_equipment
WHERE LOWER(name) LIKE '%flexion%' OR LOWER(name) LIKE '%pushup%'

UNION ALL

SELECT 
    'routine_exercises' as tabla,
    re.id,
    re.name,
    jsonb_build_object(
        'track_weight', re.track_weight,
        'track_reps', re.track_reps,
        'track_time', re.track_time,
        'track_distance', re.track_distance,
        'track_rpe', re.track_rpe
    )::text as metricas
FROM routine_exercises re
WHERE LOWER(re.name) LIKE '%flexion%' OR LOWER(re.name) LIKE '%pushup%';
