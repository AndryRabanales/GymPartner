-- DEBUG: Ver exactamente qué devuelve getRoutineDetails para esta rutina
SELECT 
    re.id,
    re.routine_id,
    re.exercise_id,
    re.name as exercise_name,
    re.track_weight,
    re.track_reps,
    re.track_time,
    re.track_distance,
    re.track_rpe,
    re.custom_metric,
    ge.name as equipment_name,
    ge.metrics as equipment_metrics_json,
    jsonb_pretty(ge.metrics) as equipment_metrics_pretty,
    r.name as routine_name
FROM routine_exercises re
LEFT JOIN gym_equipment ge ON re.exercise_id = ge.id
LEFT JOIN routines r ON re.routine_id = r.id
WHERE r.name = 'pp'  -- Tu rutina
  AND LOWER(re.name) LIKE '%cruce%poleas%'
ORDER BY re.order_index;

-- También verificar todas las metricas del ejercicio directamente
SELECT 
    id,
    gym_id,
    name,
    metrics as raw_metrics,
    jsonb_pretty(metrics) as pretty_metrics
FROM gym_equipment
WHERE id = '5bc73b06-1b7b-4faf-9722-bae74742428c';
