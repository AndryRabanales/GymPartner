-- Script para borrar todos los gimnasios personales y bases personalizadas
-- Maneja las dependencias de claves foráneas antes de eliminar los registros

-- 1. Desvincular de perfiles (home_gym_id)
UPDATE public.profiles
SET home_gym_id = NULL
WHERE home_gym_id IN (
    SELECT id::text FROM public.gyms 
    WHERE place_id LIKE 'personal_arsenal_%' 
       OR place_id LIKE 'custom_base_%'
       OR place_id LIKE 'custom_loc_%'
       OR place_id = 'virtual'
);

-- 2. Eliminar del pasaporte de usuario (user_gyms)
DELETE FROM public.user_gyms
WHERE gym_id IN (
    SELECT id FROM public.gyms 
    WHERE place_id LIKE 'personal_arsenal_%' 
       OR place_id LIKE 'custom_base_%'
       OR place_id LIKE 'custom_loc_%'
       OR place_id = 'virtual'
);

-- 3. Desvincular entrenamientos
UPDATE public.workout_sessions
SET gym_id = NULL
WHERE gym_id IN (
    SELECT id FROM public.gyms 
    WHERE place_id LIKE 'personal_arsenal_%' 
       OR place_id LIKE 'custom_base_%'
       OR place_id LIKE 'custom_loc_%'
       OR place_id = 'virtual'
);

-- 4. Desvincular items del inventario (para que pasen a ser globales nulos)
UPDATE public.gym_equipment
SET gym_id = NULL
WHERE gym_id IN (
    SELECT id FROM public.gyms 
    WHERE place_id LIKE 'personal_arsenal_%' 
       OR place_id LIKE 'custom_base_%'
       OR place_id LIKE 'custom_loc_%'
       OR place_id = 'virtual'
);

-- 5. Finalmente, borrar los gimnasios falsos/personalizados
DELETE FROM public.gyms
WHERE place_id LIKE 'personal_arsenal_%' 
   OR place_id LIKE 'custom_base_%'
   OR place_id LIKE 'custom_loc_%'
   OR place_id = 'virtual';
