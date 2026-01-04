-- TEST_RPC_MANUALLY.sql
-- Ejecuta la función de clonación manualmente para ver si falla o qué ID devuelve.
-- CORREGIDO: Usamos el ID del dueño de la rutina original para evitar error de FK.

SELECT * FROM clone_full_routine(
    (SELECT user_id FROM routines WHERE id = 'a400392c-8051-4496-b53e-1167d53fc548'), -- User ID (El mismo dueño)
    'a400392c-8051-4496-b53e-1167d53fc548', -- Source Routine ID (Orca)
    'ec735653-a7b0-4d89-b5ca-7d7bbcffdf5a'  -- Target Gym ID
);

-- Si esto devuelve SUCCESS = TRUE, copia el routine_id que te da y ejecútalo abajo:
-- SELECT * FROM routines WHERE id = 'ID_QUE_TE_DIO_ARRIBA';
