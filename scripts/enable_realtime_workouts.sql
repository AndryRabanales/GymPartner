-- Enable Realtime for Workout System Tables

-- Add tables to the supabase_realtime publication
begin;
  -- We use alter publication to ensure we are adding to the existing 'supabase_realtime' publication
  -- Postgres ignores duplicates if the table is already in the publication
  
  alter publication supabase_realtime add table workout_sessions;
  alter publication supabase_realtime add table workout_logs;
  
commit;
