-- ==============================================================================
-- GINX: ENABLE REALTIME REPLICATION FOR WORKOUT SESSIONS
-- Description: Adds workout_sessions table to the supabase_realtime publication
--              so changes are broadcast to the frontend in real-time.
-- ==============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'workout_sessions'
  ) then
    alter publication supabase_realtime add table public.workout_sessions;
  end if;
end $$;
