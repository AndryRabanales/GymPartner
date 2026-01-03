-- ================================================
-- DEBUGGING CRÍTICO: Ver QUÉ está guardado REALMENTE
-- ================================================

-- 1. Ver todas las rutinas del usuario
SELECT 
    '=== MIS RUTINAS ===' as seccion,
    id,
    name,
    created_at
FROM routines
WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
ORDER BY created_at DESC;

-- 2. Ver TODOS los ejercicios de la rutina más reciente
SELECT 
    '=== EJERCICIOS DE LA RUTINA ===' as seccion,
    re.name as ejercicio,
    re.exercise_id,
    re.track_weight,
    re.track_reps,
    re.track_time,
    re.track_distance,
    re.track_rpe,
    re.custom_metric
FROM routine_exercises re
WHERE re.routine_id = (
    SELECT id FROM routines 
    WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
    ORDER BY created_at DESC 
    LIMIT 1
)
ORDER BY re.order_index;

-- 3. Ver las métricas en gym_equipment para esos ejercicios
SELECT 
    '=== MÉTRICAS EN GYM_EQUIPMENT ===' as seccion,
    ge.name as ejercicio,
    ge.id,
    ge.metrics::text as metrics_jsonb
FROM gym_equipment ge
WHERE ge.id IN (
    SELECT re.exercise_id 
    FROM routine_exercises re
    WHERE re.routine_id = (
        SELECT id FROM routines 
        WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
        ORDER BY created_at DESC 
        LIMIT 1
    )
);

-- 4. ALTERNATIVA: Si no sale nada arriba, buscar por nombre
SELECT 
    '=== BÚSQUEDA POR NOMBRE ===' as seccion,
    ge.name,
    ge.metrics::text as metrics_en_bd
FROM gym_equipment ge
WHERE LOWER(ge.name) LIKE '%flexion%' 
   OR LOWER(ge.name) LIKE '%pushup%'
   OR LOWER(ge.name) LIKE '%abdomen%'
   OR LOWER(ge.name) LIKE '%press%';
