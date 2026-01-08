
import { supabase } from '../lib/supabase';

export interface ChatPreview {
    id: string;
    last_message: string | null;
    last_message_at: string | null;
    other_user: {
        id: string;
        username: string;
        avatar_url: string;
    } | null;
}

export const chatService = {
    /**
     * Get all active chats for the current user
     */
    async getMyChats(): Promise<ChatPreview[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data: chats, error } = await supabase
            .from('chats')
            .select(`
                id,
                last_message_at,
                user_a,
                user_b
            `)
            .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
            .order('last_message_at', { ascending: false });

        if (error) {
            console.error('Error fetching chats:', error);
            return [];
        }

        // Fetch details for the other user in each chat
        const enrichedChats = await Promise.all(chats.map(async (chat) => {
            const otherUserId = chat.user_a === user.id ? chat.user_b : chat.user_a;

            // Get profile of the other user
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .eq('id', otherUserId)
                .single();

            // Get last message content
            const { data: lastMsg } = await supabase
                .from('chat_messages')
                .select('content')
                .eq('chat_id', chat.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            return {
                id: chat.id,
                last_message_at: chat.last_message_at,
                last_message: lastMsg?.content || 'Nueva conversación',
                other_user: profile
            };
        }));

        return enrichedChats;
    }
};
