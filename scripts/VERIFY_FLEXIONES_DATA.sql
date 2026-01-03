-- VERIFICACIÓN: ¿Qué tiene REALMENTE el ejercicio FLEXIONES?

-- 1. Verificar el ejercicio en gym_equipment
SELECT 
    'GYM_EQUIPMENT' as fuente,
    id,
    name,
    gym_id,
    category,
    metrics::text as metrics_json
FROM gym_equipment
WHERE LOWER(name) LIKE '%flexion%' 
   OR LOWER(name) LIKE '%pushup%'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Verificar si está en alguna rutina
SELECT 
    'ROUTINE_EXERCISES' as fuente,
    re.id as re_id,
    r.id as routine_id,
    r.name as routine_name,
    re.exercise_id,
    re.name as exercise_name,
    re.track_weight,
    re.track_reps,
    re.track_time,
    re.track_distance,
    re.track_rpe,
    re.custom_metric
FROM routine_exercises re
JOIN routines r ON r.id = re.routine_id
WHERE LOWER(re.name) LIKE '%flexion%' 
   OR LOWER(re.name) LIKE '%pushup%'
ORDER BY re.created_at DESC
LIMIT 5;

-- 3. Si no aparece nada, buscar por ID del ejercicio que está en uso
-- (necesitarás obtener el exercise_id de la consola del navegador)
