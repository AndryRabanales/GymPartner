-- Enable Realtime for Chat System Tables

-- Add tables to the supabase_realtime publication
begin;
  -- Remove first to avoid errors if they exist, or just try adding (postgres handles duplicates in publication usually by ignoring or we can ensure idempotency)
  -- Safer to just add. If already added, it's fine.
  
  alter publication supabase_realtime add table chats;
  alter publication supabase_realtime add table chat_messages;
  alter publication supabase_realtime add table notifications;
  
commit;
