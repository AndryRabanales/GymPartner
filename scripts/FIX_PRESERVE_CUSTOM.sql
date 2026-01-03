-- ================================================
-- FIX MEJORADO: Actualizar métricas SIN perder personalizadas
-- ================================================
-- Este script actualiza las 5 métricas estándar pero PRESERVA
-- cualquier métrica personalizada que hayas agregado

UPDATE gym_equipment 
SET metrics = metrics || '{
  "weight": true,
  "reps": true,
  "time": true,
  "distance": true,
  "rpe": true
}'::jsonb
WHERE LOWER(name) = 'flexiones (pushups)';

-- El operador || hace MERGE, no sobrescribe
-- Si tenías {"cadencia": true}, queda:
-- {"weight": true, "reps": true, "time": true, "distance": true, "rpe": true, "cadencia": true}

-- Verificar
SELECT 
    id,
    name,
    metrics::text as metricas_completas
FROM gym_equipment
WHERE LOWER(name) = 'flexiones (pushups)';
