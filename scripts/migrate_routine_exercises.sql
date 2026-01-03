-- ================================
-- MIGRATION: Add metric tracking columns to routine_exercises
-- ================================
-- Este script agrega las columnas necesarias para que las rutinas
-- puedan guardar configuraciones personalizadas de métricas por ejercicio

-- 1. Agregar columnas de métricas estándar
ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS track_weight BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS track_reps BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS track_time BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS track_distance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS track_rpe BOOLEAN DEFAULT false;

-- 2. Agregar columna para métricas personalizadas
ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS custom_metric TEXT;

-- 3. Agregar otras columnas útiles que el código usa
ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS track_pr BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS target_sets INTEGER,
ADD COLUMN IF NOT EXISTS target_reps_text TEXT;

-- 4. Verificar que se crearon correctamente
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'routine_exercises'
  AND column_name IN ('track_weight', 'track_reps', 'track_time', 'track_distance', 'track_rpe', 'custom_metric', 'track_pr', 'target_sets', 'target_reps_text')
ORDER BY ordinal_position;
