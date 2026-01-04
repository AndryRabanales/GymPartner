-- VERIFY_RPC_RESULT.sql
-- Verifica si la rutina creada manualmente tiene las métricas correctas.
-- ID de la rutina creada: ae527cc1-f5aa-47d9-ae7a-74db3d7264ca

SELECT 
    re.name,
    re.track_weight,
    re.track_reps,
    re.track_time,
    -- ESTAS SON LAS IMPORTANTES QUE ANTES FALLABAN:
    re.track_distance,
    re.track_rpe,
    re.track_pr,
    re.custom_metric
FROM routine_exercises re
WHERE re.routine_id = 'ae527cc1-f5aa-47d9-ae7a-74db3d7264ca';
