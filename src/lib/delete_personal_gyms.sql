-- Script para borrar todos los gimnasios personales
-- Se eliminarán solo de la tabla gyms. Si hay entrenamientos vinculados, el ON DELETE CASCADE 
-- de la clave foránea podría borrarlos si no está como SET NULL. 
-- Espera, debemos asegurarnos de que `workout_sessions` no se borre. 
-- Si `gym_id` en `workout_sessions` tiene ON DELETE CASCADE, esto borraría los entrenamientos!
-- Solución: Primero poner gym_id = NULL en los entrenamientos, y luego borrar el gym.

UPDATE public.workout_sessions
SET gym_id = NULL
WHERE gym_id IN (
    SELECT id FROM public.gyms WHERE place_id LIKE 'personal_arsenal_%'
);

UPDATE public.workout_sessions
SET gym_id = NULL
WHERE gym_id IN (
    SELECT id FROM public.gyms WHERE type = 'PERSONAL'
);

DELETE FROM public.gyms
WHERE place_id LIKE 'personal_arsenal_%' OR type = 'PERSONAL';
