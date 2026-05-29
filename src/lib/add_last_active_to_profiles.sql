-- ==============================================================================
-- GINX: ADD LAST ACTIVE TO PROFILES & ACTIVATE REALTIME
-- Description: Adds last_active_at column to public.profiles, sets it to NULL 
--              initially, and registers profiles in the realtime publication.
-- ==============================================================================

-- 1. Añadir columna si no existe
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Habilitar replicación en tiempo real para profiles de forma segura
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

-- 3. Reiniciar la última actividad a NULL para todos los usuarios existentes
-- para evitar que aparezcan activos "falsos" del default now()
UPDATE public.profiles SET last_active_at = NULL;
