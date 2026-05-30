-- SQL Migration: Permitir a cualquier usuario autenticado insertar notificaciones
-- Esto es crítico para el flujo multijugador, donde un amigo (User B) debe poder
-- insertar una invitación o solicitud de unión directamente dirigida al anfitrión (User A).

-- 1. Limpiar políticas de inserción existentes si las hay
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;

-- 2. Crear una política limpia y robusta para permitir inserciones a usuarios autenticados
CREATE POLICY "Allow insert for authenticated users" ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 3. Asegurar que RLS está activo en la tabla
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
