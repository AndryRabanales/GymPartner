import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Fixed IDs so we can update/cancel the same notifications
const REST_END_ID = 777001;
const ONGOING_ID = 777002;

// Local (on-device) notifications for the workout flow. Everything here works
// FULLY OFFLINE — no server, no push service, just the OS scheduler.
//  • Rest-end alarm: fires at the exact moment the global rest countdown ends
//  • Ongoing session notification: persistent reminder that a workout is in
//    progress (Android keeps it pinned via ongoing:true)
class RestAlarmService {
    private initialized = false;

    private get native() {
        return Capacitor.isNativePlatform();
    }

    // Request permission + create Android channels. Safe to call repeatedly.
    async init(): Promise<boolean> {
        if (!this.native) return false;
        try {
            const perm = await LocalNotifications.checkPermissions();
            if (perm.display !== 'granted') {
                const req = await LocalNotifications.requestPermissions();
                if (req.display !== 'granted') return false;
            }

            if (!this.initialized && Capacitor.getPlatform() === 'android') {
                // High-importance channel: rest alarm (sound + vibration)
                await LocalNotifications.createChannel({
                    id: 'ginx-rest',
                    name: 'Fin de descanso',
                    description: 'Te avisa cuando termina tu descanso entre series',
                    importance: 5,
                    visibility: 1,
                    vibration: true,
                }).catch(() => {});
                // Low-importance channel: silent ongoing session reminder
                await LocalNotifications.createChannel({
                    id: 'ginx-session',
                    name: 'Entrenamiento en curso',
                    description: 'Recordatorio de que tienes un entrenamiento activo',
                    importance: 2,
                    visibility: 1,
                    vibration: false,
                }).catch(() => {});
            }
            this.initialized = true;
            return true;
        } catch (e) {
            console.warn('[RestAlarm] init failed:', e);
            return false;
        }
    }

    // Schedule the rest-end alarm at an exact timestamp
    async scheduleRestEnd(endsAtMs: number, exerciseName?: string): Promise<void> {
        if (!this.native) return;
        try {
            await this.cancelRestEnd();
            await LocalNotifications.schedule({
                notifications: [{
                    id: REST_END_ID,
                    title: '⏱️ ¡Descanso terminado!',
                    body: exerciseName
                        ? `Vuelve a tu serie de ${exerciseName} 💪`
                        : 'Vuelve a tu serie 💪',
                    schedule: { at: new Date(endsAtMs), allowWhileIdle: true },
                    channelId: 'ginx-rest',
                    sound: 'default',
                    smallIcon: 'ic_stat_icon_config_sample',
                }],
            });
        } catch (e) {
            console.warn('[RestAlarm] scheduleRestEnd failed:', e);
        }
    }

    async cancelRestEnd(): Promise<void> {
        if (!this.native) return;
        try {
            await LocalNotifications.cancel({ notifications: [{ id: REST_END_ID }] });
        } catch { /* ignore */ }
    }

    // Show or update the persistent "workout in progress" notification.
    // Re-scheduling with the same ID replaces the previous one.
    async showOngoing(body: string): Promise<void> {
        if (!this.native) return;
        try {
            await LocalNotifications.schedule({
                notifications: [{
                    id: ONGOING_ID,
                    title: '🏋️ Entrenamiento en curso',
                    body,
                    channelId: 'ginx-session',
                    ongoing: true,      // Android: pinned, not swipeable
                    autoCancel: false,
                    smallIcon: 'ic_stat_icon_config_sample',
                }],
            });
        } catch (e) {
            console.warn('[RestAlarm] showOngoing failed:', e);
        }
    }

    async clearOngoing(): Promise<void> {
        if (!this.native) return;
        try {
            await LocalNotifications.cancel({ notifications: [{ id: ONGOING_ID }] });
        } catch { /* ignore */ }
    }

    async clearAll(): Promise<void> {
        await Promise.all([this.cancelRestEnd(), this.clearOngoing()]);
    }
}

export const restAlarmService = new RestAlarmService();
