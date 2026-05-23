-- Este script vacía por completo el catálogo de ejercicios de GymPartner
-- y el inventario de equipamiento de los gimnasios para comenzar totalmente desde cero.

TRUNCATE TABLE public.exercises CASCADE;
TRUNCATE TABLE public.gym_equipment CASCADE;
