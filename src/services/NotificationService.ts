import { supabase } from '../lib/supabase';

export interface Notification {
    id: string;
    user_id: string;
    type: 'ranking_change' | 'system' | 'reward' | 'invitation';
    title: string;
    message: string;
    data?: any;
    is_read: boolean;
    created_at: string;
}

export const notificationService = {
    /**
     * Obtener notificaciones del usuario
     */
    async getNotifications(limit = 20) {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }

        return data as Notification[];
    },

    /**
     * Obtener conteo de no leídas
     */
    async getUnreadCount(): Promise<number> {
        const { count, error } = await supabase
            .from('notifications')
            .select('id', { count: 'exact' })
            .eq('is_read', false);

        if (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }

        return count || 0;
    },

    /**
     * Marcar notificación como leída
     */
    async markAsRead(notificationId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    },

    /**
     * Marcar todas como leídas
     */
    async markAllAsRead() {
        // Obtenemos el usuario actual primero para asegurar la policy
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (error) {
            console.error('Error marking all as read:', error);
        }
    },

    /**
     * Enviar una invitación de entrenamiento
     */
    async sendInvitation(targetUserId: string, senderName: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: targetUserId,
                type: 'invitation',
                title: '🔥 DESAFÍO DE ENTRENAMIENTO',
                message: `${senderName} te está invitando a entrenar. ¿Aceptas el reto?`,
                data: {
                    sender_id: user.id,
                    sender_name: senderName
                }
            });

        if (error) {
            console.error('Error sending invitation:', error);
            return false;
        }
        return true;
    },

    /**
     * Aceptar invitación (Crear Chat)
     */
    async acceptInvitation(senderId: string): Promise<string | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        // 1. Create Chat (or get existing due to UNIQUE index)
        const { data: chat, error } = await supabase
            .from('chats')
            .insert({
                user_a: user.id,
                user_b: senderId
            })
            .select('id')
            .single();

        if (error) {
            // If error is duplicate key, fetch existing
            if (error.code === '23505') {
                const { data: existing } = await supabase
                    .from('chats')
                    .select('id')
                    .or(`and(user_a.eq.${user.id},user_b.eq.${senderId}),and(user_a.eq.${senderId},user_b.eq.${user.id})`)
                    .single();
                return existing?.id || null;
            }
            console.error('Error creating chat:', error);
            return null;
        }

        return chat.id;
    }
};
