import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '../lib/supabase';

export const pushService = {
    async initialize(): Promise<void> {
        if (!Capacitor.isNativePlatform()) return;

        try {
            const permission = await PushNotifications.requestPermissions();
            if (permission.receive !== 'granted') return;

            await PushNotifications.register();

            PushNotifications.addListener('registration', async (token) => {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    await supabase
                        .from('profiles')
                        .update({ push_token: token.value })
                        .eq('id', user.id);
                } catch {
                    // silent — push token storage is best-effort
                }
            });

            PushNotifications.addListener('registrationError', (err) => {
                console.warn('[Push] Registration error:', err.error);
            });
        } catch {
            // silent — push is best-effort, never block the app
        }
    },

    async clearToken(): Promise<void> {
        if (!Capacitor.isNativePlatform()) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase
                .from('profiles')
                .update({ push_token: null })
                .eq('id', user.id);
        } catch { /* silent */ }
    },

    async send(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
        try {
            await supabase.functions.invoke('send-push', {
                body: { userId, title, body, data: data ?? {} },
            });
        } catch {
            // silent — push is best-effort, never throw
        }
    },
};
