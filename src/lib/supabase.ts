import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase Setup Error: Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars. Check .env or Codemagic environment groups.');
}

// On native iOS/Android, use @capacitor/preferences (NSUserDefaults / SharedPreferences)
// so the session survives app restarts and iOS memory pressure clearing localStorage.
const nativeStorage = {
    getItem: async (key: string): Promise<string | null> => {
        const { value } = await Preferences.get({ key });
        return value;
    },
    setItem: async (key: string, value: string): Promise<void> => {
        await Preferences.set({ key, value });
    },
    removeItem: async (key: string): Promise<void> => {
        await Preferences.remove({ key });
    },
};

// Only wipe the session token if it is structurally corrupt (unparseable JSON).
// Never wipe based on expiry — Supabase autoRefreshToken handles renewal even
// for long-expired tokens using the refresh_token, so wiping an expired
// access_token prevents the client from ever renewing and forces re-login.
if (supabaseUrl && supabaseAnonKey && !Capacitor.isNativePlatform()) {
    try {
        const keys = Object.keys(localStorage);
        const sbKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (sbKey) {
            const rawData = localStorage.getItem(sbKey);
            if (rawData) {
                try {
                    JSON.parse(rawData);
                } catch {
                    console.warn("🧹 [Supabase] Wiping corrupted session (invalid JSON):", sbKey);
                    localStorage.removeItem(sbKey);
                }
            }
        }
    } catch (e) {
        console.error("🧹 [Supabase] Error checking session storage:", e);
    }
}

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: !Capacitor.isNativePlatform(),
            flowType: 'implicit',
            storage: Capacitor.isNativePlatform() ? nativeStorage : undefined,
        }
    })
    : null;

export const isSupabaseConfigured = () => !!supabase;
