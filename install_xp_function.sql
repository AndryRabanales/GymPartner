-- Create or Replace the increment_xp RPC function
-- This function safely increments the XP of a user
create or replace function increment_xp(u_id uuid, amount int)
returns void
language plpgsql
security definer -- Runs with permissions of creator (admin)
as $$
begin
  update profiles
  set xp = coalesce(xp, 0) + amount
  where id = u_id;
end;
$$;

-- Grant execute permission to authenticated users (so the app can call it)
grant execute on function increment_xp(uuid, int) to authenticated;
grant execute on function increment_xp(uuid, int) to service_role;

-- Verify it works by adding 0 XP to a user (optional check)
-- select increment_xp('USER_UUID_HERE', 0);
