-- VERIFICACIÓN COMPLETA DEL ESQUEMA DE BD
-- Verificar que todas las tablas tienen las columnas necesarias para métricas personalizadas

-- 1. RUTINA: routine_exercises debe tener custom_metric
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'routine_exercises'
  AND column_name IN ('track_weight', 'track_reps', 'track_time', 'track_distance', 'track_rpe', 'custom_metric')
ORDER BY ordinal_position;

-- 2. ENTRENAMIENTO: workout_logs debe tener metrics_data (JSONB)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'workout_logs'
  AND column_name IN ('weight_kg', 'reps', 'time', 'distance', 'rpe', 'metrics_data')
ORDER BY ordinal_position;

-- 3. GYM_EQUIPMENT: debe tener metrics (JSONB)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'gym_equipment'
  AND column_name IN ('metrics', 'track_weight', 'track_reps', 'track_time', 'track_distance', 'track_rpe', 'custom_metric')
ORDER BY ordinal_position;
