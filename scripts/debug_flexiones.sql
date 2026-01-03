-- DEBUGGING: Verificar qué tiene EXACTAMENTE el ejercicio FLEXIONES en la BD
SELECT 
    id,
    name,
    gym_id,
    category,
    metrics::text as metrics_json,
    track_weight,
    track_reps,
    track_time,
    track_distance,
    track_rpe,
    custom_metric
FROM gym_equipment
WHERE LOWER(name) LIKE '%flexion%' 
   OR LOWER(name) LIKE '%pushup%'
ORDER BY created_at DESC;

-- También verificar si está en alguna rutina
SELECT 
    'routine_exercises' as source,
    re.id,
    re.routine_id,
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
ORDER BY re.created_at DESC;
