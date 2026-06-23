-- Any co-op room member can call this to write the summary to the host session.
-- Direct UPDATE is blocked by RLS for guests (only the row owner can UPDATE),
-- so we use SECURITY DEFINER to bypass RLS after verifying membership.
CREATE OR REPLACE FUNCTION upsert_coop_summary(p_room_id uuid, p_summary jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (p_room_id = ANY(get_coop_room_session_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'unauthorized: caller is not a member of room %', p_room_id;
  END IF;

  UPDATE workout_sessions
  SET coop_summary = p_summary
  WHERE id = p_room_id;
END;
$$;
