-- ============================================================
-- GINX: MIGRACIÓN DE BLOQUEO DE USUARIOS (user_blocks)
-- Descripción: Crea la tabla de bloqueos y políticas RLS para
--              que los usuarios bloqueados no puedan enviar mensajes
--              o ver perfiles.
-- Instrucciones: Ejecuta esto en el editor SQL de Supabase.
-- ============================================================

-- 1. Crear tabla de bloqueos
CREATE TABLE IF NOT EXISTS public.user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(blocked_by, blocked_user)
);

-- 2. Habilitar seguridad de nivel de fila (RLS)
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas RLS
CREATE POLICY "Los usuarios pueden ver a quién bloquearon" ON public.user_blocks
    FOR SELECT USING (auth.uid() = blocked_by);

CREATE POLICY "Los usuarios pueden bloquear a otros" ON public.user_blocks
    FOR INSERT WITH CHECK (auth.uid() = blocked_by);

CREATE POLICY "Los usuarios pueden desbloquear a otros" ON public.user_blocks
    FOR DELETE USING (auth.uid() = blocked_by);

-- 4. Actualizar la función de eliminación de usuario (handle_deleted_user)
-- para limpiar también la tabla de bloqueos al borrar la cuenta
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS trigger AS $$
BEGIN
  BEGIN
    -- Eliminar bloqueos
    DELETE FROM public.user_blocks 
    WHERE blocked_by = old.id OR blocked_user = old.id;

    -- Eliminar follows
    DELETE FROM public.follows 
    WHERE follower_id = old.id OR following_id = old.id;

    -- Eliminar shares
    DELETE FROM public.history_shares 
    WHERE shared_by = old.id OR shared_with = old.id;
    
    DELETE FROM public.routine_shares 
    WHERE shared_by = old.id OR shared_with = old.id;

    DELETE FROM public.user_gyms 
    WHERE user_id = old.id;

    DELETE FROM public.notifications 
    WHERE user_id = old.id;

    DELETE FROM public.chat_messages 
    WHERE sender_id = old.id;
    
    DELETE FROM public.chats 
    WHERE user_a = old.id OR user_b = old.id;

    DELETE FROM public.comments 
    WHERE user_id = old.id;
    
    DELETE FROM public.post_likes 
    WHERE user_id = old.id;

    DELETE FROM public.post_media 
    WHERE post_id IN (SELECT id FROM public.posts WHERE user_id = old.id);
    
    DELETE FROM public.posts 
    WHERE user_id = old.id;

    DELETE FROM public.workout_logs 
    WHERE session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = old.id);
    
    DELETE FROM public.workout_sessions 
    WHERE user_id = old.id;

    DELETE FROM public.routine_exercises 
    WHERE routine_id IN (SELECT id FROM public.routines WHERE user_id = old.id);
    
    DELETE FROM public.routines 
    WHERE user_id = old.id;

    DELETE FROM public.referrals_log 
    WHERE referrer_id = old.id OR referred_id = old.id;

    DELETE FROM public.gym_alphas 
    WHERE user_id = old.id;

    DELETE FROM public.profiles 
    WHERE id = old.id;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_deleted_user: %', SQLERRM;
  END;
  
  RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
