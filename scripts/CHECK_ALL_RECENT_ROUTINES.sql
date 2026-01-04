-- CHECK_ALL_RECENT_ROUTINES.sql
-- Listar las ultimas 10 rutinas creadas para ver si aparece la importada
-- y verificar en qué GYM ID se creó.

SELECT 
    id, 
    name, 
    gym_id, 
    created_at, 
    user_id 
FROM routines 
ORDER BY created_at DESC 
LIMIT 10;

-- Verificar la rutina fuente específica (para confirmar ID)
SELECT 
    id, name, 'FUENTE (SOURCE)' as tipo
FROM routines 
WHERE id = 'a400392c-8051-4496-b53e-1167d53fc548';
