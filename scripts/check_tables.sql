
-- DIAGNOSTICO DE BASE DE DATOS
-- Ejecuta esto para ver los nombres EXACTOS de tus tablas

SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name ILIKE '%workout%' 
   OR table_name ILIKE '%set%'
   OR table_name ILIKE '%exercise%';
