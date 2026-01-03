-- Script para verificar los valores de las métricas en routine_exercises
-- Este script te ayudará a ver si los valores están guardados como true/false correctamente

-- Ver todas las métricas de una rutina específica
SELECT 
    re.routine_id,
    r.name as routine_name,
    re.exercise_id,
    re.name as exercise_name,
    re.track_weight,
    re.track_reps,
    re.track_time,
    re.track_pr,
    re.track_distance,
    re.track_rpe,
    re.custom_metric,
    re.order_index
FROM routine_exercises re
JOIN routines r ON r.id = re.routine_id
WHERE r.user_id = auth.uid()  -- Solo tus rutinas
ORDER BY re.routine_id, re.order_index;

-- Ver un resumen de cuántas métricas están habilitadas
SELECT 
    'Total Exercises' as metric,
    COUNT(*) as count
FROM routine_exercises re
JOIN routines r ON r.id = re.routine_id
WHERE r.user_id = auth.uid()

UNION ALL

SELECT 
    'track_weight = TRUE' as metric,
    COUNT(*) as count
FROM routine_exercises re
JOIN routines r ON r.id = re.routine_id
WHERE r.user_id = auth.uid() AND re.track_weight = true

UNION ALL

SELECT 
    'track_reps = TRUE' as metric,
    COUNT(*) as count
FROM routine_exercises re
JOIN routines r ON r.id = re.routine_id
WHERE r.user_id = auth.uid() AND re.track_reps = true

UNION ALL

SELECT 
    'track_time = TRUE' as metric,
    COUNT(*) as count
FROM routine_exercises re
JOIN routines r ON r.id = re.routine_id
WHERE r.user_id = auth.uid() AND re.track_time = true

UNION ALL

SELECT 
    'track_pr = TRUE' as metric,
    COUNT(*) as count
FROM routine_exercises re
JOIN routines r ON r.id = re.routine_id
WHERE r.user_id = auth.uid() AND re.track_pr = true

UNION ALL

SELECT 
    'track_distance = TRUE' as metric,
    COUNT(*) as count
FROM routine_exercises re
JOIN routines r ON r.id = re.routine_id
WHERE r.user_id = auth.uid() AND re.track_distance = true

UNION ALL

SELECT 
    'track_rpe = TRUE' as metric,
    COUNT(*) as count
FROM routine_exercises re
JOIN routines r ON r.id = re.routine_id
WHERE r.user_id = auth.uid() AND re.track_rpe = true

UNION ALL

SELECT 
    'custom_metric NOT NULL' as metric,
    COUNT(*) as count
FROM routine_exercises re
JOIN routines r ON r.id = re.routine_id
WHERE r.user_id = auth.uid() AND re.custom_metric IS NOT NULL;
