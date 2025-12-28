-- Migration: Add Multi-Media Support to Posts
-- This allows posts to have multiple images/videos with carousel functionality

-- Create post_media table for storing multiple media per post
CREATE TABLE IF NOT EXISTS post_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique ordering within a post
    UNIQUE(post_id, order_index)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_post_media_order ON post_media(post_id, order_index);

-- Add comment for documentation
COMMENT ON TABLE post_media IS 'Stores multiple media files (images/videos) for posts with carousel functionality';
COMMENT ON COLUMN post_media.order_index IS 'Determines the display order in the carousel (0-based)';

-- Note: Existing posts.media_url and posts.type columns are kept for backward compatibility
-- Single-media posts will continue using the legacy fields
-- Multi-media posts will use the post_media table
