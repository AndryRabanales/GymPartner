-- ================================================
-- EJEMPLO: Agregar Métricas Personalizadas
-- ================================================

-- CASO 1: Agregar "cadencia" a Bicicleta Estática
UPDATE gym_equipment 
SET metrics = metrics || '{"cadencia": true, "watts": true}'::jsonb
WHERE LOWER(name) LIKE '%bicicleta%';

-- CASO 2: Agregar "altura" a ejercicios de salto
UPDATE gym_equipment 
SET metrics = metrics || '{"altura": true}'::jsonb
WHERE LOWER(name) LIKE '%salto%' OR LOWER(name) LIKE '%jump%';

-- CASO 3: Agregar métricas múltiples a ejercicios específicos
UPDATE gym_equipment 
SET metrics = metrics || '{
  "repeticiones_maximas": true,
  "velocidad": true,
  "potencia": true
}'::jsonb
WHERE id = 'ID_DEL_EJERCICIO_AQUI';

-- VERIFICAR RESULTADOS
SELECT 
    name,
    metrics::text as todas_las_metricas
FROM gym_equipment
WHERE metrics::text LIKE '%cadencia%' 
   OR metrics::text LIKE '%altura%'
   OR metrics::text LIKE '%watts%';

-- ================================================
-- CÓMO FUNCIONA:
-- ================================================
-- 1. El operador || hace MERGE de JSONB
-- 2. Las métricas nuevas se AGREGAN sin borrar las existentes  
-- 3. Si una métrica ya existe, se actualiza su valor
-- 
-- ANTES: {"weight": true, "reps": true}
-- DESPUÉS: {"weight": true, "reps": true, "cadencia": true, "watts": true}
