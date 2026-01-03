-- ================================================
-- MASTER MIGRATION: Fix Custom Metrics Support
-- ================================================
-- Ejecuta este script COMPLETO en Supabase SQL Editor
-- Esto agregará todas las columnas necesarias para que
-- las métricas personalizadas funcionen correctamente

-- ================================================
-- STEP 1: Fix gym_equipment table
-- ================================================
ALTER TABLE gym_equipment 
ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}'::jsonb;

-- ================================================
-- STEP 2: Fix routine_exercises table
-- ================================================
ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS track_weight BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS track_reps BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS track_time BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS track_distance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS track_rpe BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_metric TEXT,
ADD COLUMN IF NOT EXISTS track_pr BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS target_sets INTEGER,
ADD COLUMN IF NOT EXISTS target_reps_text TEXT;

-- ================================================
-- STEP 3: Verificación
-- ================================================
-- Verificar gym_equipment
SELECT 'gym_equipment' as table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'gym_equipment'
  AND column_name = 'metrics'

UNION ALL

-- Verificar routine_exercises
SELECT 'routine_exercises' as table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'routine_exercises'
  AND column_name IN ('track_weight', 'track_reps', 'track_time', 'track_distance', 'track_rpe', 'custom_metric')
ORDER BY table_name, column_name;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
-- Si ves resultados arriba, las columnas se crearon correctamente!
-- Ahora recarga la app y las métricas deberían funcionar
