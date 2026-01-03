-- ================================================
-- VERIFICAR MÉTRICAS PERSONALIZADAS
-- ================================================
-- Este script verifica que las métricas personalizadas
-- estén correctamente guardadas en la base de datos

-- PASO 1: Verificar todas las métricas en gym_equipment
SELECT 
    id,
    name,
    category,
    metrics::text as all_metrics,
    jsonb_object_keys(metrics) as metric_keys
FROM gym_equipment
WHERE metrics IS NOT NULL
  AND (
    metrics::text LIKE '%cadencia%' 
    OR metrics::text LIKE '%altura%' 
    OR metrics::text LIKE '%watts%'
    OR metrics::text LIKE '%velocidad%'
    OR metrics::text LIKE '%potencia%'
    OR jsonb_array_length(jsonb_object_keys(metrics)::jsonb) > 5
  )
ORDER BY name;

-- PASO 2: Contar métricas por ejercicio
SELECT 
    name,
    jsonb_object_keys(metrics) as metric_name
FROM gym_equipment
WHERE metrics IS NOT NULL
ORDER BY name;

-- PASO 3: Verificar configuración en routine_exercises
SELECT 
    re.id,
    re.routine_id,
    re.name as exercise_name,
    re.track_weight,
    re.track_reps,
    re.track_time,
    re.track_distance,
    re.track_rpe,
    re.custom_metric,
    ge.metrics::text as equipment_all_metrics
FROM routine_exercises re
LEFT JOIN gym_equipment ge ON re.exercise_id = ge.id
WHERE re.custom_metric IS NOT NULL
   OR ge.metrics::text LIKE '%cadencia%'
   OR ge.metrics::text LIKE '%altura%'
ORDER BY re.routine_id, re.order_index;

-- PASO 4: Verificar que workout_logs.metrics_data guarda datos custom
SELECT 
    wl.id,
    wl.session_id,
    wl.exercise_id,
    ex.name as exercise_name,
    wl.set_number,
    wl.weight_kg,
    wl.reps,
    wl.metrics_data::text as custom_metrics_data
FROM workout_logs wl
LEFT JOIN exercises ex ON wl.exercise_id = ex.id
WHERE wl.metrics_data IS NOT NULL
  AND wl.metrics_data::text != '{}'
ORDER BY wl.session_id, wl.set_number
LIMIT 20;

-- PASO 5: Ver un ejemplo completo de Flexiones (si existe)
SELECT 
    'GYM_EQUIPMENT' as source,
    id,
    name,
    metrics::text as metrics
FROM gym_equipment
WHERE LOWER(name) LIKE '%flexiones%' OR LOWER(name) LIKE '%pushup%'
UNION ALL
SELECT 
    'ROUTINE_EXERCISES' as source,
    re.id,
    re.name,
    ge.metrics::text
FROM routine_exercises re
LEFT JOIN gym_equipment ge ON re.exercise_id = ge.id
WHERE LOWER(re.name) LIKE '%flexiones%' OR LOWER(re.name) LIKE '%pushup%'
LIMIT 10;
