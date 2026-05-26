-- =========================================================================
-- MIGRACIÓN DE GYMPARTNER: MÓDULO DE BLOQUEOS, CANCELACIONES Y POLÍTICAS DE CHAT
-- Descripción: Habilita el correcto funcionamiento de borrar mensajes,
--              cancelar chat/match, y bloquear persona agregando las políticas
--              de DELETE y UPDATE necesarias que faltaban en Supabase.
-- Instrucciones: Ejecuta este script en el editor SQL de tu panel de Supabase.
-- =========================================================================

-- 1. Crear tabla de bloqueos si no existe
CREATE TABLE IF NOT EXISTS public.user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(blocked_by, blocked_user)
);

-- Habilitar RLS en user_blocks
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Políticas para user_blocks (evitar duplicados usando DROP POLICY)
DROP POLICY IF EXISTS "Los usuarios pueden ver a quién bloquearon" ON public.user_blocks;
CREATE POLICY "Los usuarios pueden ver a quién bloquearon" ON public.user_blocks
    FOR SELECT USING (auth.uid() = blocked_by);

DROP POLICY IF EXISTS "Los usuarios pueden bloquear a otros" ON public.user_blocks;
CREATE POLICY "Los usuarios pueden bloquear a otros" ON public.user_blocks
    FOR INSERT WITH CHECK (auth.uid() = blocked_by);

DROP POLICY IF EXISTS "Los usuarios pueden desbloquear a otros" ON public.user_blocks;
CREATE POLICY "Los usuarios pueden desbloquear a otros" ON public.user_blocks
    FOR DELETE USING (auth.uid() = blocked_by);


-- 2. Habilitar políticas de UPDATE y DELETE en chats y chat_messages
-- Por defecto, Supabase RLS bloquea DELETE y UPDATE si no hay políticas específicas creadas.

-- Políticas para 'chats'
DROP POLICY IF EXISTS "Users can delete their own chats" ON chats;
CREATE POLICY "Users can delete their own chats" ON chats
    FOR DELETE USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
CREATE POLICY "Users can update their own chats" ON chats
    FOR UPDATE USING (auth.uid() = user_a OR auth.uid() = user_b);


-- Políticas para 'chat_messages'
DROP POLICY IF EXISTS "Users can delete messages in their chats" ON chat_messages;
CREATE POLICY "Users can delete messages in their chats" ON chat_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM chats WHERE id = chat_messages.chat_id AND (user_a = auth.uid() OR user_b = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can update messages in their chats" ON chat_messages;
CREATE POLICY "Users can update messages in their chats" ON chat_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM chats WHERE id = chat_messages.chat_id AND (user_a = auth.uid() OR user_b = auth.uid())
        )
    );
