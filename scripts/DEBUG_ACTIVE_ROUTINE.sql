-- DEBUGGING COMPLETO: Encontrar la rutina que se está usando

-- 1. Listar TODAS las rutinas del usuario (busca la que tiene emoji 🦾)
SELECT 
    id,
    name,
    user_id,
    gym_id,
    created_at
FROM routines
ORDER BY created_at DESC
LIMIT 20;

-- 2. Una vez identifiques el ID de la rutina, reemplaza 'ROUTINE_ID_AQUI' y ejecuta:
-- SELECT 
--     re.id,
--     re.name as exercise_name,
--     re.exercise_id,
--     re.track_weight,
--     re.track_reps,
--     re.track_time,
--     re.track_distance,
--     re.track_rpe,
--     re.custom_metric,
--     ge.metrics::text as equipment_metrics
-- FROM routine_exercises re
-- LEFT JOIN gym_equipment ge ON ge.id = re.exercise_id
-- WHERE re.routine_id = 'ROUTINE_ID_AQUI'
-- ORDER BY re.order_index;
