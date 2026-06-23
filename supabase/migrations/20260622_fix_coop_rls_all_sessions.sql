-- Fix: get_coop_room_session_ids was only returning HOST session IDs (room anchors).
-- RLS policies using this function blocked reads of guest sessions by other room members,
-- causing coop_summary builds to miss guest workout_logs and history to show blank data.
-- Now returns ALL session IDs (host + every guest) in every room the user has been in.

DROP POLICY IF EXISTS coop_room_all_members_can_read_sessions ON workout_sessions;
DROP POLICY IF EXISTS coop_room_all_members_can_read_logs ON workout_logs;
DROP FUNCTION IF EXISTS get_coop_room_session_ids(uuid) CASCADE;

CREATE OR REPLACE FUNCTION get_coop_room_session_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_room_ids uuid[];
  v_session_ids uuid[];
BEGIN
  -- Find all room anchors (host session IDs) the user has participated in
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

  IF v_room_ids IS NULL OR array_length(v_room_ids, 1) IS NULL THEN
    RETURN '{}';
  END IF;

  -- Return ALL session IDs in those rooms (host + every guest)
  SELECT array_agg(DISTINCT ws.id)
  INTO v_session_ids
  FROM workout_sessions ws
  WHERE ws.is_multiplayer = true
    AND (
      ws.id = ANY(v_room_ids)
      OR ws.partner_session_id = ANY(v_room_ids)
    );

  RETURN COALESCE(v_session_ids, '{}');
END;
$$;

CREATE POLICY coop_room_all_members_can_read_sessions
  ON workout_sessions FOR SELECT
  USING (id = ANY(get_coop_room_session_ids(auth.uid())));

CREATE POLICY coop_room_all_members_can_read_logs
  ON workout_logs FOR SELECT
  USING (session_id = ANY(get_coop_room_session_ids(auth.uid())));
