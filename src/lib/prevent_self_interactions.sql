-- ==============================================================================
-- GINX: PREVENT SELF-FOLLOW AND SELF-CHAT MIGRATION
-- Description: Adds strict database constraints to absolutely prevent a user
--              from following themselves or matching/chatting with themselves.
-- ==============================================================================

-- 1. Prevent self-follows at the database level
ALTER TABLE public.follows
DROP CONSTRAINT IF EXISTS prevent_self_follow;

ALTER TABLE public.follows
ADD CONSTRAINT prevent_self_follow CHECK (follower_id != following_id);

-- 2. Prevent self-chats at the database level
ALTER TABLE public.chats
DROP CONSTRAINT IF EXISTS prevent_self_chat;

ALTER TABLE public.chats
ADD CONSTRAINT prevent_self_chat CHECK (user_a != user_b);

-- 3. Clean up any existing corrupted data (if someone already followed themselves)
DELETE FROM public.follows WHERE follower_id = following_id;
DELETE FROM public.chats WHERE user_a = user_b;
