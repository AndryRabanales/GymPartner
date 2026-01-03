-- ================================================
-- MIGRACIÓN COMPLETA - EJECUTA ESTO EN SUPABASE
-- ================================================

-- PASO 1: Agregar columna metrics a gym_equipment
ALTER TABLE gym_equipment 
ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}'::jsonb;

-- PASO 2: Agregar ALL columnas a routine_exercises
ALTER TABLE routine_exercises 
ADD COLUMN IF NOT EXISTS track_weight BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS track_reps BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS track_time BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS track_distance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS track_rpe BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_metric TEXT,
ADD COLUMN IF NOT EXISTS track_pr BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS target_sets INTEGER,
ADD COLUMN IF NOT EXISTS target_reps_text TEXT,
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS name TEXT;

-- PASO 3: Actualizar gym_equipment existentes para tener metrics
UPDATE gym_equipment 
SET metrics = '{"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}'::jsonb
WHERE metrics IS NULL;

-- PASO 4: Verificar que TODO se creó
SELECT 
    'VERIFICACIÓN COMPLETA' as status,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'gym_equipment' AND column_name = 'metrics') as gym_equipment_metrics,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'routine_exercises' AND column_name = 'track_weight') as routine_track_weight,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'routine_exercises' AND column_name = 'track_reps') as routine_track_reps,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'routine_exercises' AND column_name = 'track_time') as routine_track_time,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'routine_exercises' AND column_name = 'custom_metric') as routine_custom_metric;

-- SI TODOS LOS NÚMEROS SON 1, ¡ÉXITO! 
-- Ahora recarga la app
