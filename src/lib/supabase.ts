import { createClient } from '@supabase/supabase-js';

// These environment variables will need to be set in .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Throw error if keys are missing to prevent runtime crashes deeper in the app
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase Setup Error: Missing Environment Variables', {
        url: supabaseUrl ? 'Set' : 'Missing',
        key: supabaseAnonKey ? 'Set' : 'Missing'
    });
    // We throw to ensure the dev sees the error in the overlay, but with more context.
    throw new Error(`Missing Supabase Keys. URL: ${supabaseUrl ? 'OK' : 'MISSING'}, Key: ${supabaseAnonKey ? 'OK' : 'MISSING'}. Check .env`);
}

// MANUALLY AUDIT AND CLEAN LOCALSTORAGE SESSION BEFORE INITIALIZATION
try {
    const keys = Object.keys(localStorage);
    const sbKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (sbKey) {
        const rawData = localStorage.getItem(sbKey);
        if (rawData) {
            try {
                const parsed = JSON.parse(rawData);
                // In some versions, the session is nested under 'currentSession'
                const sessionObj = parsed?.currentSession || parsed;
                const expiresAt = sessionObj?.expires_at; // seconds since epoch
                if (expiresAt) {
                    const now = Math.floor(Date.now() / 1000);
                    // If session is expired or within 10 seconds of expiring, wipe it!
                    if (expiresAt - now < 10) {
                        console.warn("🧹 [Supabase Config] Manually wiping expired persistent session to prevent getSession locks:", sbKey);
                        localStorage.removeItem(sbKey);
                    }
                }
            } catch (jsonErr) {
                console.warn("🧹 [Supabase Config] Wiping corrupted persistent session:", sbKey, jsonErr);
                localStorage.removeItem(sbKey);
            }
        }
    }
} catch (e) {
    console.error("🧹 [Supabase Config] Error checking persistent session:", e);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
    }
});

export const isSupabaseConfigured = () => {
    return !!supabase;
};
