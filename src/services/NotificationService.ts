import { supabase } from '../lib/supabase';

export interface Notification {
    id: string;
    user_id: string;
    type: 'ranking_change' | 'system' | 'reward';
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
            .select('id', { count: 'exact', head: true })
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
    }
};
