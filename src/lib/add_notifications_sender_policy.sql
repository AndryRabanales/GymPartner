-- SQL Migration: Habilitar políticas de seguridad RLS para leer invitaciones enviadas
-- 
-- Por defecto, RLS en la tabla 'notifications' suele restringir la lectura solo al destinatario (user_id = auth.uid()).
-- Esta política permite al creador de un desafío (sender_id) verificar el estado del reto que envió
-- para que la interfaz pueda bloquear el envío duplicado de desafíos de forma segura y robusta.

-- 1. Limpiar políticas de selección existentes en notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can select their own notifications" ON notifications;
DROP POLICY IF EXISTS "Allow select for owner or sender" ON notifications;

-- 2. Crear una política unificada para permitir la lectura al destinatario o al remitente
CREATE POLICY "Allow select for owner or sender" ON notifications
    FOR SELECT
    USING (
        auth.uid() = user_id 
        OR (data->>'sender_id')::uuid = auth.uid()
    );

-- 3. Confirmar que RLS está activo
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
