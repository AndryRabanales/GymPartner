-- ================================================
-- FIX INMEDIATO: Actualizar TODOS los Flexiones
-- ================================================
-- Este script actualiza TODOS los registros de "Flexiones (Pushups)"
-- para que tengan las métricas completas

UPDATE gym_equipment 
SET metrics = '{
  "weight": true,
  "reps": true,
  "time": true,
  "distance": true,
  "rpe": true
}'::jsonb
WHERE LOWER(name) = 'flexiones (pushups)';

-- Verificar que se actualizaron
SELECT 
    id,
    name,
    metrics::text as metricas_actualizadas
FROM gym_equipment
WHERE LOWER(name) = 'flexiones (pushups)';
