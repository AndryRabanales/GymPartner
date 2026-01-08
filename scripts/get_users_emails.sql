-- LISTA DE TODOS LOS USUARIOS REGISTRADOS
-- Ejecuta este script para ver correos, nombres y usuarios.

select 
    email,
    raw_user_meta_data->>'full_name' as nombre_completo,
    raw_user_meta_data->>'username' as username,
    created_at as fecha_registro,
    last_sign_in_at as ultimo_acceso
from auth.users
order by created_at desc;
