-- ================================================================
-- DIAGNÓSTICO COMPLETO: Métricas aparecen como FALSE
-- ================================================================
-- Este script verifica TODA la cadena de datos para "Cruce de Poleas"

-- PASO 1: Ver el ejercicio en gym_equipment (la fuente de verdad)
SELECT 
    '=== PASO 1: EJERCICIO EN GYM_EQUIPMENT ===' as paso,
    id,
    gym_id,
    name,
    metrics::text as metrics_raw,
    jsonb_pretty(metrics) as metrics_formatted,
    jsonb_object_keys(metrics) as all_metric_keys
FROM gym_equipment
WHERE id = '5bc73b06-1b7b-4faf-9722-bae74742428c'
   OR LOWER(name) LIKE '%cruce%poleas%';

-- PASO 2: Ver la configuración en routine_exercises
SELECT 
    '=== PASO 2: CONFIGURACIÓN EN ROUTINE ===' as paso,
    re.id as routine_exercise_id,
    re.routine_id,
    re.exercise_id,
    re.name as exercise_name,
    re.track_weight,
    re.track_reps,
    re.track_time,
    re.track_distance,
    re.track_rpe,
    re.custom_metric,
    r.name as routine_name,
    r.gym_id as routine_gym_id
FROM routine_exercises re
LEFT JOIN routines r ON re.routine_id = r.id
WHERE r.name = 'pp'
  AND (re.exercise_id = '5bc73b06-1b7b-4faf-9722-bae74742428c'
       OR LOWER(re.name) LIKE '%cruce%poleas%');

-- PASO 3: Simular lo que hace getRoutineDetails (con el JOIN)
SELECT 
    '=== PASO 3: LO QUE DEVUELVE getRoutineDetails ===' as paso,
    re.id,
    re.routine_id,
    re.exercise_id,
    re.name,
    re.order_index,
    re.track_weight,
    re.track_reps,
    re.track_time,
    re.track_distance,
    re.track_rpe,
    re.custom_metric,
    -- Esto es lo que se pasa como detail.equipment
    jsonb_build_object(
        'id', ge.id,
        'name', ge.name,
        'category', ge.category,
        'metrics', ge.metrics
    ) as equipment_object,
    ge.metrics as equipment_metrics_direct
FROM routine_exercises re
LEFT JOIN gym_equipment ge ON re.exercise_id = ge.id
LEFT JOIN routines r ON re.routine_id = r.id
WHERE r.name = 'pp'
  AND (re.exercise_id = '5bc73b06-1b7b-4faf-9722-bae74742428c'
       OR LOWER(re.name) LIKE '%cruce%poleas%');

-- PASO 4: Verificar si el ejercicio está en múltiples gyms
SELECT 
    '=== PASO 4: DUPLICADOS EN DIFERENTES GYMS ===' as paso,
    gym_id,
    id,
    name,
    metrics::text
FROM gym_equipment
WHERE LOWER(name) LIKE '%cruce%poleas%'
ORDER BY gym_id;

-- PASO 5: Ver qué gym está usando el entrenamiento
SELECT 
    '=== PASO 5: GYM DE LA RUTINA "pp" ===' as paso,
    r.id as routine_id,
    r.name as routine_name,
    r.gym_id,
    g.name as gym_name
FROM routines r
LEFT JOIN gyms g ON r.gym_id = g.id
WHERE r.name = 'pp';

-- PASO 6: Verificar si el ejercicio EXISTE en el gym de la rutina
SELECT 
    '=== PASO 6: ¿EXISTE EL EJERCICIO EN EL GYM DE LA RUTINA? ===' as paso,
    r.gym_id as gym_de_rutina,
    ge.id as exercise_id,
    ge.name as exercise_name,
    CASE 
        WHEN ge.id IS NULL THEN '❌ NO EXISTE (por eso es Ghost)'
        WHEN ge.id IS NOT NULL THEN '✅ EXISTE'
    END as estado
FROM routines r
LEFT JOIN gym_equipment ge ON ge.gym_id = r.gym_id 
    AND (ge.id = '5bc73b06-1b7b-4faf-9722-bae74742428c'
         OR LOWER(ge.name) LIKE '%cruce%poleas%')
WHERE r.name = 'pp';

-- RESULTADO ESPERADO:
-- Si PASO 6 dice "NO EXISTE" → El ejercicio NO está en el gym donde se carga la rutina
-- Por eso cae en Ghost Exercise y usa detail.equipment.metrics
-- PERO si detail.equipment.metrics es NULL/undefined, usa defaults (time=false, distance=false, rpe=false)
