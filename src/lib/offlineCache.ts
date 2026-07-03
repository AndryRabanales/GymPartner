import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Native-safe storage: uses NSUserDefaults/SharedPreferences on device, localStorage on web
export const nativeStore = {
    get: async (key: string): Promise<string | null> => {
        if (Capacitor.isNativePlatform()) {
            const { value } = await Preferences.get({ key });
            return value;
        }
        return localStorage.getItem(key);
    },
    set: async (key: string, value: string): Promise<void> => {
        if (Capacitor.isNativePlatform()) {
            await Preferences.set({ key, value });
        } else {
            localStorage.setItem(key, value);
        }
    },
    remove: async (key: string): Promise<void> => {
        if (Capacitor.isNativePlatform()) {
            await Preferences.remove({ key });
        } else {
            localStorage.removeItem(key);
        }
    },
};

// ── Profile cache ────────────────────────────────────────────────────────────
const PROFILE_CACHE_KEY = 'ginx_profile_cache';

export const profileCache = {
    save: async (profile: Record<string, any>): Promise<void> => {
        await nativeStore.set(PROFILE_CACHE_KEY, JSON.stringify(profile));
    },
    load: async (): Promise<Record<string, any> | null> => {
        try {
            const raw = await nativeStore.get(PROFILE_CACHE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },
    clear: async (): Promise<void> => {
        await nativeStore.remove(PROFILE_CACHE_KEY);
    },
};

// ── Routine cache ────────────────────────────────────────────────────────────
export const routineCache = {
    key: (userId: string, gymId?: string | null) =>
        `ginx_cached_routines_${userId}_${gymId || 'global'}`,

    save: async (userId: string, gymId: string | null | undefined, routines: any[]): Promise<void> => {
        await nativeStore.set(routineCache.key(userId, gymId), JSON.stringify(routines));
    },

    load: async (userId: string, gymId?: string | null): Promise<any[]> => {
        try {
            const raw = await nativeStore.get(routineCache.key(userId, gymId));
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    },
};

// ── Offline routine queue ────────────────────────────────────────────────────
const OFFLINE_ROUTINES_KEY = 'ginx_offline_routines';

export const offlineRoutineQueue = {
    getAll: async (): Promise<any[]> => {
        try {
            const raw = await nativeStore.get(OFFLINE_ROUTINES_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    },
    save: async (queue: any[]): Promise<void> => {
        await nativeStore.set(OFFLINE_ROUTINES_KEY, JSON.stringify(queue));
    },
    add: async (item: any): Promise<void> => {
        const queue = await offlineRoutineQueue.getAll();
        queue.unshift(item);
        await offlineRoutineQueue.save(queue);
    },
    remove: async (tempId: string): Promise<void> => {
        const queue = await offlineRoutineQueue.getAll();
        await offlineRoutineQueue.save(queue.filter((r: any) => r.tempId !== tempId));
    },
};
