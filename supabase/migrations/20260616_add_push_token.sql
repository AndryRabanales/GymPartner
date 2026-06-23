-- Add push_token column to profiles for mobile push notifications.
-- Run this in the Supabase SQL Editor before deploying the send-push Edge Function.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT DEFAULT NULL;
