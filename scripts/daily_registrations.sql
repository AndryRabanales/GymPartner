-- SQL para ver cuántas personas se registraron por día
-- Muestra el conteo de nuevos usuarios agrupados por fecha

SELECT 
    DATE(created_at) as fecha_registro,
    COUNT(*) as usuarios_registrados,
    STRING_AGG(
        COALESCE(email, id::text), 
        ', ' 
        ORDER BY created_at
    ) as usuarios
FROM 
    auth.users
GROUP BY 
    DATE(created_at)
ORDER BY 
    fecha_registro DESC;

-- Si quieres ver solo los últimos 30 días:
/*
SELECT 
    DATE(created_at) as fecha_registro,
    COUNT(*) as usuarios_registrados,
    STRING_AGG(
        COALESCE(username, email, id::text), 
        ', ' 
        ORDER BY created_at
    ) as usuarios
FROM 
    auth.users
WHERE 
    created_at >= NOW() - INTERVAL '30 days'
GROUP BY 
    DATE(created_at)
ORDER BY 
    fecha_registro DESC;
*/

-- Versión alternativa con información del perfil:
/*
SELECT 
    DATE(p.created_at) as fecha_registro,
    COUNT(*) as usuarios_registrados,
    STRING_AGG(
        COALESCE(p.username, u.email, p.id::text), 
        ', ' 
        ORDER BY p.created_at
    ) as usuarios
FROM 
    profiles p
    LEFT JOIN auth.users u ON p.id = u.id
GROUP BY 
    DATE(p.created_at)
ORDER BY 
    fecha_registro DESC;
*/
