-- ==============================================================================
-- GINX: MULTIPLAYER WORKOUTS MIGRATION
-- ==============================================================================

-- 1. Añadir soporte para modos multijugador en las sesiones
ALTER TABLE public.workout_sessions 
ADD COLUMN IF NOT EXISTS is_multiplayer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS multiplayer_mode TEXT, -- 'conjunto' o 'separado'
ADD COLUMN IF NOT EXISTS partner_id UUID,
ADD COLUMN IF NOT EXISTS partner_session_id UUID;

-- 2. Identificar al dueño real de la serie (crucial para Entrenamiento Conjunto)
-- En "Conjunto", la sesión es de user A, pero user B puede insertar series.
-- Por defecto, el owner_id es el que la creó, pero puede ser el partner.
ALTER TABLE public.workout_logs
ADD COLUMN IF NOT EXISTS owner_id UUID;

-- Nota: Si tu tabla de series se llama diferente (ej. workout_sets), ajústalo aquí.
-- Asumo workout_logs dado el código en WorkoutService.ts
