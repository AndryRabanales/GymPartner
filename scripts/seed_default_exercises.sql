-- Este script vacía por completo el catálogo de ejercicios de GymPartner
-- eliminando en cascada las referencias obsoletas para comenzar desde cero.

TRUNCATE TABLE public.exercises CASCADE;
