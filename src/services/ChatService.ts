
import { supabase } from '../lib/supabase';

export interface ChatPreview {
    id: string;
    last_message: string | null;
    last_message_at: string | null;
    other_user: {
        id: string;
        username: string;
        avatar_url: string;
        last_active_at?: string;
    } | null;
    unread_count?: number;
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
                .select('id, username, avatar_url, last_active_at')
                .eq('id', otherUserId)
                .single();

            // Get last message content
            const { data: lastMsg } = await supabase
                .from('chat_messages')
                .select('content')
                .eq('chat_id', chat.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            // Get unread messages count for this chat (sent by other user and is_read is false)
            const { count: unreadCount } = await supabase
                .from('chat_messages')
                .select('id', { count: 'exact', head: true })
                .eq('chat_id', chat.id)
                .neq('sender_id', user.id)
                .eq('is_read', false);

            return {
                id: chat.id,
                last_message_at: chat.last_message_at,
                last_message: lastMsg?.content || 'Nueva conversación',
                other_user: profile,
                unread_count: unreadCount || 0
            };
        }));

        return enrichedChats;
    },

    /**
     * Delete a chat completely (deletes chat and all messages due to cascade delete)
     */
    async deleteChat(chatId: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        try {
            // Get the chat details to find the other user's ID
            const { data: chatData } = await supabase
                .from('chats')
                .select('user_a, user_b')
                .eq('id', chatId)
                .maybeSingle();

            if (chatData) {
                const otherUserId = chatData.user_a === user.id ? chatData.user_b : chatData.user_a;

                // A. Unfollow both ways (sever match connection) + adjust GX for lost followers
                const { data: followA } = await supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', otherUserId).maybeSingle();
                const { data: followB } = await supabase.from('follows').select('id').eq('follower_id', otherUserId).eq('following_id', user.id).maybeSingle();

                // Deleting the follow rows fires the on_follow_gx trigger, which
                // applies the -1 GX to the (un)followed user server-side. No
                // client-side point call needed (and the raw RPC is revoked).
                if (followA) {
                    await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', otherUserId);
                }
                if (followB) {
                    await supabase.from('follows').delete().eq('follower_id', otherUserId).eq('following_id', user.id);
                }

                // B. Delete match invitations from both sides' notifications to reset match state
                await supabase.from('notifications')
                    .delete()
                    .eq('type', 'invitation')
                    .eq('user_id', user.id)
                    .filter('data->>sender_id', 'eq', otherUserId);

                // Try to delete invitation notifications on the other user's side if allowed, otherwise it fails silently
                try {
                    await supabase.from('notifications')
                        .delete()
                        .eq('type', 'invitation')
                        .eq('user_id', otherUserId)
                        .filter('data->>sender_id', 'eq', user.id);
                } catch (e) {
                    console.warn("Could not delete other user's notifications due to RLS policies. Handled gracefully.", e);
                }
            }

            // C. Delete the chat itself
            const { error } = await supabase
                .from('chats')
                .delete()
                .eq('id', chatId);

            if (error) {
                console.error('Error deleting chat:', error);
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error in deleteChat:', error);
            return false;
        }
    },

    /**
     * Clear all messages in a chat without deleting the chat connection
     */
    async clearChatMessages(chatId: string): Promise<boolean> {
        const { error } = await supabase
            .from('chat_messages')
            .delete()
            .eq('chat_id', chatId);

        if (error) {
            console.error('Error clearing chat messages:', error);
            return false;
        }
        return true;
    },

    /**
     * Block a user. To block:
     * 1. Delete the chat between these users (this cancels their match/connection and clears messages).
     * 2. Delete any follow relationship between them.
     * 3. Insert a block record (tries user_blocks table).
     */
    async blockUser(blockedUserId: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        try {
            // A. Find and delete any chat between them
            const { data: chats } = await supabase
                .from('chats')
                .select('id')
                .or(`and(user_a.eq.${user.id},user_b.eq.${blockedUserId}),and(user_a.eq.${blockedUserId},user_b.eq.${user.id})`);

            if (chats && chats.length > 0) {
                for (const chat of chats) {
                    await this.deleteChat(chat.id);
                }
            }

            // B. Delete any pending/received match invitations between them in notifications
            await supabase.from('notifications')
                .delete()
                .eq('type', 'invitation')
                .eq('user_id', user.id)
                .filter('data->>sender_id', 'eq', blockedUserId);

            // D. Try to insert into user_blocks table (will fail gracefully if table not created yet)
            await supabase
                .from('user_blocks')
                .insert({
                    blocked_by: user.id,
                    blocked_user: blockedUserId
                });

            return true;
        } catch (error) {
            console.error('Error in blockUser:', error);
            return false;
        }
    }
};
