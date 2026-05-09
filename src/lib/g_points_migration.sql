-- Add g_points and invite tracking to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS g_points INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_invite_limit INTEGER DEFAULT 50;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extra_invites_today INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_invite_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- RPC function to increment G-Points safely
CREATE OR REPLACE FUNCTION increment_g_points(u_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET g_points = COALESCE(g_points, 0) + amount
    WHERE id = u_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to spend G-Points safely (checks balance)
CREATE OR REPLACE FUNCTION spend_g_points(u_id UUID, amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    current_points INTEGER;
BEGIN
    SELECT g_points INTO current_points FROM profiles WHERE id = u_id;
    
    IF current_points >= amount THEN
        UPDATE profiles
        SET g_points = g_points - amount
        WHERE id = u_id;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to increment extra invites
CREATE OR REPLACE FUNCTION increment_extra_invites(u_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET extra_invites_today = COALESCE(extra_invites_today, 0) + amount
    WHERE id = u_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
