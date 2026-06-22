-- Fix: get_coop_room_session_ids was only returning IDs for ACTIVE (unfinished) sessions.
-- This caused the RLS policies to block reads of other participants' sessions in History.
-- Now includes ALL multiplayer sessions regardless of finished_at status.

CREATE OR REPLACE FUNCTION get_coop_room_session_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_room_ids uuid[];
BEGIN
  -- Return the "room anchor" (host session ID) for every co-op room
  -- the user has participated in, past or present.
  -- HOST session: partner_session_id IS NULL → room anchor = its own id
  -- GUEST session: partner_session_id = host_id → room anchor = partner_session_id
  SELECT array_agg(DISTINCT
    CASE
      WHEN ws.partner_session_id IS NULL THEN ws.id
      ELSE ws.partner_session_id
    END
  )
  INTO v_room_ids
  FROM workout_sessions ws
  WHERE ws.user_id = p_user_id
    AND ws.is_multiplayer = true;
    -- NO filter on finished_at — must include historical rooms for History page

  RETURN COALESCE(v_room_ids, '{}');
END;
$$;
