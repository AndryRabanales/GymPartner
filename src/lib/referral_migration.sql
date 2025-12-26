-- REFERRAL SYSTEM MIGRATION
-- Run this in your Supabase SQL Editor

-- 1. Add referred_by column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id);

-- 2. Create Function to Award XP to the Referrer
CREATE OR REPLACE FUNCTION public.handle_referral_reward()
RETURNS TRIGGER AS $$
BEGIN
    -- Only if referred_by is set and was previously null (first time attribution)
    -- AND the referrer is not the user themselves (prevent self-referral loop)
    IF NEW.referred_by IS NOT NULL AND (OLD.referred_by IS NULL) AND NEW.referred_by <> NEW.id THEN
        
        -- Award 250 XP to the referrer
        UPDATE profiles
        SET xp = xp + 250
        WHERE id = NEW.referred_by;
        
        -- Optional: We could insert into a 'notifications' table here if it existed
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger to watch for profile updates
DROP TRIGGER IF EXISTS on_profile_referral ON profiles;

CREATE TRIGGER on_profile_referral
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_referral_reward();

-- 4. Create Trigger for INSERT as well (in case profile is created WITH referred_by)
DROP TRIGGER IF EXISTS on_profile_insert_referral ON profiles;

CREATE TRIGGER on_profile_insert_referral
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_referral_reward();
