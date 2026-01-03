-- Verificar qué columnas REALMENTE tiene la tabla routine_exercises
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'routine_exercises'
ORDER BY ordinal_position;
