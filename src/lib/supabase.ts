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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
    }
});

export const isSupabaseConfigured = () => {
    return !!supabase;
};
