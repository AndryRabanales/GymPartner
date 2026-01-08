-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a UUID NOT NULL REFERENCES auth.users(id),
    user_b UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure unique pair regardless of order using a unique index
CREATE UNIQUE INDEX IF NOT EXISTS unique_chat_pair ON chats (GREATEST(user_a, user_b), LEAST(user_a, user_b));

-- Create messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);

-- RLS Policies
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Chats: Users can see chats they are part of
CREATE POLICY "Users can view their chats" ON chats
    FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can create chats" ON chats
    FOR INSERT WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

-- Messages: Users can see messages in their chats
CREATE POLICY "Users can view messages in their chats" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chats WHERE id = chat_messages.chat_id AND (user_a = auth.uid() OR user_b = auth.uid())
        )
    );

CREATE POLICY "Users can insert messages in their chats" ON chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chats WHERE id = chat_messages.chat_id AND (user_a = auth.uid() OR user_b = auth.uid())
        )
    );

-- Notifications: Update constraint if exists (otherwise just trust app logic)
-- Assuming check constraint is flexible or doesn't exist for 'type'.
