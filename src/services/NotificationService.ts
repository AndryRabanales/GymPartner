import { supabase } from '../lib/supabase';
import { socialService } from './SocialService';

export interface Notification {
    id: string;
    user_id: string;
    type: 'ranking_change' | 'system' | 'reward' | 'invitation' | 'follower' | 'gym_join';
    title: string;
    message: string;
    data?: any;
    is_read: boolean;
    created_at: string;
}

// State for throttling requests
let cachedUnreadCount = 0;
let lastFetchTime = 0;
const THROTTLE_DURATION = 10000; // 10 seconds

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
        if (!navigator.onLine) return cachedUnreadCount;

        const now = Date.now();
        if (now - lastFetchTime < THROTTLE_DURATION) {
            return cachedUnreadCount;
        }

        const { count, error } = await supabase
            .from('notifications')
            .select('id', { count: 'exact' })
            .eq('is_read', false);

        if (error) {
            // Suppress network errors to avoid console spam
            if (error.message?.includes('fetch') || error.message?.includes('network')) {
                return cachedUnreadCount;
            }
            console.error('Error getting unread count:', error);
            return cachedUnreadCount;
        }

        cachedUnreadCount = count || 0;
        lastFetchTime = now;
        return cachedUnreadCount;
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
        } else {
            // Invalidate cache
            lastFetchTime = 0;
            cachedUnreadCount = Math.max(0, cachedUnreadCount - 1);
        }
    },

    /**
     * Actualizar estado de la invitación (Aceptada/Rechazada)
     */
    async updateInvitationStatus(notification: Notification, status: 'accepted' | 'rejected') {
        const newData = {
            ...notification.data,
            status: status
        };

        const { error } = await supabase
            .from('notifications')
            .update({
                is_read: true,
                data: newData
            })
            .eq('id', notification.id);

        if (error) {
            console.error('Error updating invitation status:', error);
            throw error;
        } else {
            // Invalidate cache
            lastFetchTime = 0;
            cachedUnreadCount = Math.max(0, cachedUnreadCount - 1);
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
        } else {
            // Invalidate cache
            lastFetchTime = 0;
            cachedUnreadCount = 0;
        }
    },

    /**
     * Enviar una invitación de entrenamiento
     */
    /**
     * Enviar una invitación de entrenamiento
     */
    async sendInvitation(targetUserId: string, passedName?: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const senderName = user.user_metadata?.full_name || user.user_metadata?.username || passedName || "Un GymRat";

        // 1. AUTO-FOLLOW Logic
        try {
            const isFollowing = await socialService.getFollowStatus(user.id, targetUserId);
            if (!isFollowing) {
                // Auto-follow
                await socialService.followUser(user.id, targetUserId);

                // Notify Target about New Follower
                await supabase
                    .from('notifications')
                    .insert({
                        user_id: targetUserId,
                        type: 'follower', // Explicit follower type
                        title: 'NUEVO SEGUIDOR',
                        message: `${senderName} ha comenzado a seguirte.`,
                        data: {
                            sender_id: user.id,
                            sender_name: senderName
                        }
                    });
            }
        } catch (followError) {
            console.error("Auto-follow error (non-blocking):", followError);
        }

        // 2. SEND INVITATION
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: targetUserId,
                type: 'invitation',
                title: '🔥 DESAFÍO DE ENTRENAMIENTO',
                message: `${senderName} te está invitando a entrenar. ¿Aceptas?`,
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

        if (chat) {
            // 2. Insert System Message (Auto-generated)
            const acceptorName = user.user_metadata?.full_name || user.user_metadata?.username || 'Alguien';

            await supabase
                .from('chat_messages')
                .insert({
                    chat_id: chat.id,
                    sender_id: user.id,
                    content: `${acceptorName} ha aceptado tu invitacion a entrenar!!!`
                });

            // Update last_message_at
            await supabase
                .from('chats')
                .update({ last_message_at: new Date().toISOString() })
                .eq('id', chat.id);

            return chat.id;
        }

        return null;
    },

    /**
     * Crear una notificación genérica
     */
    async createNotification(userId: string, data: { type: string, title: string, content: string, data?: any }) {
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                type: data.type as any,
                title: data.title,
                message: data.content,
                data: data.data
            });

        if (error) {
            console.error('Error creating notification:', error);
            return false;
        }
        return true;
    },

    /**
     * Alert local gym members that a new user joined as their home base
     */
    async notifyGymMembers(gymId: string, newMemberId: string, newMemberName: string, gymName: string) {
        try {
            // Find all users who have this gym as home base (except the new member)
            const { data: gymMembers, error: fetchError } = await supabase
                .from('user_gyms')
                .select('user_id')
                .eq('gym_id', gymId)
                .eq('is_home_base', true)
                .neq('user_id', newMemberId);

            if (fetchError) throw fetchError;
            if (!gymMembers || gymMembers.length === 0) return;

            // Prepare notifications batch
            const notifications = gymMembers.map(member => ({
                user_id: member.user_id,
                type: 'gym_join',
                title: 'NUEVO RECLUTA',
                message: `¡Un nuevo recluta (${newMemberName}) ha reclamado ${gymName} como sede! Ve a revisar el Ranking.`,
                data: {
                    new_member_id: newMemberId,
                    gym_id: gymId
                }
            }));

            // Insert in batch
            const { error: insertError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (insertError) throw insertError;
            console.log(`[NotificationService] Sent gym_join notification to ${notifications.length} members of ${gymId}`);
        } catch (error) {
            console.error('[NotificationService] Error notifying gym members:', error);
        }
    }
};
