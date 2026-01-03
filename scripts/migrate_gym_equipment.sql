-- ================================
-- MIGRATION: Add metrics column to gym_equipment
-- ================================
-- Este script agrega la columna JSONB para métricas en gym_equipment

-- 1. Agregar columna metrics (JSONB)
ALTER TABLE gym_equipment 
ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}'::jsonb;

-- 2. Agregar columnas individuales (por si acaso el código las usa)
ALTER TABLE gym_equipment 
ADD COLUMN IF NOT EXISTS track_weight BOOLEAN,
ADD COLUMN IF NOT EXISTS track_reps BOOLEAN,
ADD COLUMN IF NOT EXISTS track_time BOOLEAN,
ADD COLUMN IF NOT EXISTS track_distance BOOLEAN,
ADD COLUMN IF NOT EXISTS track_rpe BOOLEAN,
ADD COLUMN IF NOT EXISTS custom_metric TEXT;

-- 3. Verificar
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'gym_equipment'
  AND column_name IN ('metrics', 'track_weight', 'track_reps', 'track_time', 'track_distance', 'track_rpe', 'custom_metric')
ORDER BY ordinal_position;
