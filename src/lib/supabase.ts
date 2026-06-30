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

// Only wipe the session token if it is structurally corrupt (unparseable JSON).
// Never wipe based on expiry — Supabase autoRefreshToken handles renewal even
// for long-expired tokens using the refresh_token, so wiping an expired
// access_token prevents the client from ever renewing and forces re-login.
try {
    const keys = Object.keys(localStorage);
    const sbKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (sbKey) {
        const rawData = localStorage.getItem(sbKey);
        if (rawData) {
            try {
                JSON.parse(rawData); // just validate it's valid JSON
            } catch {
                console.warn("🧹 [Supabase] Wiping corrupted session (invalid JSON):", sbKey);
                localStorage.removeItem(sbKey);
            }
        }
    }
} catch (e) {
    console.error("🧹 [Supabase] Error checking session storage:", e);
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
