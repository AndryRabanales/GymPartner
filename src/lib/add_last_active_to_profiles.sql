-- ==============================================================================
-- GINX: ADD LAST ACTIVE TO PROFILES
-- Description: Adds a last_active_at column to public.profiles to track online status.
-- ==============================================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
