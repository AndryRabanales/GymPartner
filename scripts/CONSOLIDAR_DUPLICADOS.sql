-- ================================================
-- LIMPIAR DUPLICADOS Y CONSOLIDAR MÉTRICAS
-- ================================================
-- Este script encuentra duplicados y los consolida

-- PASO 1: Ver todos los "Flexiones" y sus IDs
SELECT 
    id,
    name,
    gym_id,
    metrics::text as metricas,
    created_at
FROM gym_equipment
WHERE LOWER(name) = 'flexiones (pushups)'
ORDER BY created_at DESC;

-- PASO 2: Identificar cuál tiene las métricas completas
-- (Ejecuta PASO 1 primero, identifica el ID correcto, y reemplázalo abajo)

-- EJEMPLO: Si el ID con métricas completas es 'abc-123-def'
-- UPDATE routine_exercises
-- SET exercise_id = 'abc-123-def'  -- ID del registro CON métricas
-- WHERE LOWER(name) = 'flexiones (pushups)';

-- PASO 3: Opcional - Eliminar duplicados antiguos
-- (SOLO después de actualizar todas las rutinas)
-- DELETE FROM gym_equipment
-- WHERE LOWER(name) = 'flexiones (pushups)'
--   AND id != 'abc-123-def';  -- Mantén solo el bueno
