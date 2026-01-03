-- Check EXACT metrics for "Cruce de Poleas (Crossover)"
-- First check gym_equipment table
SELECT 
    'gym_equipment' as source,
    id,
    name,
    track_weight,
    track_reps,
    track_time,
    track_distance,
    track_rpe,
    custom_metric,
    metrics::text as metrics_json
FROM gym_equipment
WHERE LOWER(name) LIKE '%cruce%' 
   OR LOWER(name) LIKE '%crossover%';

-- Then check routine_exercises to see what's configured in the routine
SELECT 
    'routine_exercises' as source,
    re.id as routine_exercise_id,
    re.routine_id,
    re.exercise_id,
    re.track_weight,
    re.track_reps,
    re.track_time,
    re.track_distance,
    re.track_rpe,
    re.custom_metric,
    ge.name as exercise_name,
    ge.metrics::text as equipment_metrics_json
FROM routine_exercises re
LEFT JOIN gym_equipment ge ON re.exercise_id = ge.id
WHERE LOWER(ge.name) LIKE '%cruce%' 
   OR LOWER(ge.name) LIKE '%crossover%';
