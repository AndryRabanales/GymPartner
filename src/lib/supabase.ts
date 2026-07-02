import { createClient } from '@supabase/supabase-js';

// These environment variables will need to be set in .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase Setup Error: Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars. Check .env or Codemagic environment groups.');
}

// Only wipe the session token if it is structurally corrupt (unparseable JSON).
// Never wipe based on expiry — Supabase autoRefreshToken handles renewal even
// for long-expired tokens using the refresh_token, so wiping an expired
// access_token prevents the client from ever renewing and forces re-login.
if (supabaseUrl && supabaseAnonKey) {
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
            detectSessionInUrl: true,
            flowType: 'implicit',
        }
    })
    : null;

export const isSupabaseConfigured = () => !!supabase;
