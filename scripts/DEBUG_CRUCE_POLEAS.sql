-- ================================================
-- DEBUG: Verificar métricas de "Cruce de Poleas"
-- ================================================

-- PASO 1: Ver las métricas REALES en gym_equipment
SELECT 
    id,
    gym_id,
    name,
    category,
    metrics::text as all_metrics_raw,
    jsonb_pretty(metrics) as metrics_formatted
FROM gym_equipment
WHERE LOWER(name) LIKE '%cruce%poleas%' 
   OR LOWER(name) LIKE '%crossover%'
   OR id = '5bc73b06-1b7b-4faf-9722-bae74742428c';

-- PASO 2: Ver la configuración en routine_exercises
SELECT 
    re.id,
    re.routine_id,
    re.exercise_id,
    re.name,
    re.track_weight,
    re.track_reps,
    re.track_time,
    re.track_distance,
    re.track_rpe,
    re.custom_metric,
    r.name as routine_name,
    ge.metrics::text as equipment_metrics
FROM routine_exercises re
LEFT JOIN routines r ON re.routine_id = r.id
LEFT JOIN gym_equipment ge ON re.exercise_id = ge.id
WHERE re.exercise_id = '5bc73b06-1b7b-4faf-9722-bae74742428c'
   OR LOWER(re.name) LIKE '%cruce%poleas%'
ORDER BY r.name, re.order_index;

-- PASO 3: Verificar si el ejercicio existe en MÚLTIPLES gyms
SELECT 
    gym_id,
    name,
    metrics::text,
    COUNT(*) OVER (PARTITION BY LOWER(name)) as duplicate_count
FROM gym_equipment
WHERE LOWER(name) LIKE '%cruce%poleas%' 
   OR LOWER(name) LIKE '%crossover%'
ORDER BY gym_id;

-- PASO 4: Ver si hay diferencias entre gym_equipment entries
SELECT 
    ge1.id as id1,
    ge1.gym_id as gym1,
    ge1.metrics::text as metrics1,
    ge2.id as id2,
    ge2.gym_id as gym2,
    ge2.metrics::text as metrics2
FROM gym_equipment ge1
CROSS JOIN gym_equipment ge2
WHERE LOWER(ge1.name) LIKE '%cruce%poleas%'
  AND LOWER(ge2.name) LIKE '%cruce%poleas%'
  AND ge1.id != ge2.id;
