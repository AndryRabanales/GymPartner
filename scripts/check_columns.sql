
-- DIAGNOSTICO DE COLUMNAS
-- Ejecuta esto para ver las columnas reales
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workout_sets';
