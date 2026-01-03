-- ================================================================
-- FIX POTENCIAL: Si el problema es que equipment.metrics viene NULL
-- ================================================================
-- Este script asegura que TODOS los ejercicios tengan métricas definidas

-- OPCIÓN 1: Si el problema es que metrics es NULL o {} vacío
-- Agregar métricas por defecto a ejercicios que no las tengan
UPDATE gym_equipment
SET metrics = COALESCE(
    NULLIF(metrics, '{}'::jsonb),  -- Si está vacío, usa NULL
    '{"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}'::jsonb
)
WHERE metrics IS NULL 
   OR metrics = '{}'::jsonb
   OR jsonb_typeof(metrics) = 'null';

-- Verificar
SELECT 
    id,
    name,
    gym_id,
    CASE 
        WHEN metrics IS NULL THEN '❌ NULL'
        WHEN metrics = '{}'::jsonb THEN '⚠️ VACÍO'
        ELSE '✅ TIENE MÉTRICAS'
    END as estado,
    metrics::text
FROM gym_equipment
WHERE LOWER(name) LIKE '%cruce%poleas%';

-- OPCIÓN 2: Asegurar que "Cruce de Poleas" específicamente tenga métricas
UPDATE gym_equipment
SET metrics = '{"weight": true, "reps": true, "time": true, "distance": false, "rpe": true}'::jsonb
WHERE (LOWER(name) LIKE '%cruce%poleas%' OR id = '5bc73b06-1b7b-4faf-9722-bae74742428c')
  AND (metrics IS NULL OR metrics = '{}'::jsonb);

-- Verificar el cambio
SELECT id, name, gym_id, jsonb_pretty(metrics) as metrics 
FROM gym_equipment
WHERE LOWER(name) LIKE '%cruce%poleas%';
