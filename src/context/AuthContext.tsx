import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { userService } from '../services/UserService';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithMeta: () => Promise<void>;
    signInWithEmail: (email: string) => Promise<void>;
    signInAsDev: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    signInWithGoogle: async () => { },
    signInWithMeta: async () => { },
    signInWithEmail: async () => { },
    signInAsDev: async () => { },
    signOut: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const isProcessingReferral = useRef(false);
    const hasInitialized = useRef(false);

    useEffect(() => {
        console.log('🔑 [AuthContext] Initializing...');

        if (!isSupabaseConfigured() || !supabase) {
            console.warn('⚠️ [AuthContext] Supabase not configured.');
            setLoading(false);
            return;
        }

        // ─────────────────────────────────────────────────────────────
        // ARCHITECTURE: onAuthStateChange is the SINGLE source of truth.
        // It fires immediately on mount with the current session (if any),
        // INCLUDING when returning from an OAuth redirect with a hash token.
        // We do NOT call getSession() separately to avoid race conditions.
        // ─────────────────────────────────────────────────────────────
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            console.log(`📡 [Auth] Event: ${event} | Session: ${!!newSession}`);

            setSession(newSession);
            setUser(newSession?.user ?? null);

            // Unblock the UI on the very first event (INITIAL_SESSION, SIGNED_IN, etc.)
            if (!hasInitialized.current) {
                hasInitialized.current = true;
                setLoading(false);
                console.log('🔓 [Auth] Loading unblocked on first auth event.');
            }

            // Clean the OAuth hash from the URL AFTER Supabase has consumed it
            if (newSession && window.location.hash.includes('access_token')) {
                try {
                    window.history.replaceState(null, '', window.location.origin + window.location.pathname);
                    console.log('🧹 [Auth] OAuth hash cleaned from URL.');
                } catch (_) { /* ignore */ }
            }

            // Background tasks on sign-in
            const currentUser = newSession?.user;
            if (currentUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
                ensureProfileExists(currentUser).catch(e =>
                    console.error('❌ [Auth] ensureProfileExists failed:', e)
                );
            }
        });

        // Safety net: if onAuthStateChange never fires (e.g. Supabase SDK issue),
        // unblock the UI after 5 seconds so user isn't stuck on a blank screen.
        const safetyNet = setTimeout(() => {
            if (!hasInitialized.current) {
                console.warn('⏰ [Auth] Safety net triggered after 5s. Unblocking UI.');
                hasInitialized.current = true;
                setLoading(false);
            }
        }, 5000);

        // Capture ?ref= referral code from URL before anything else modifies it
        const params = new URLSearchParams(window.location.search);
        const refId = params.get('ref');
        if (refId) {
            sessionStorage.setItem('gym_referral_id', refId);
            console.log('🔗 [Auth] Referral captured:', refId);
        }

        return () => {
            subscription.unsubscribe();
            clearTimeout(safetyNet);
        };
    }, []);

    // ─── Helper: ensure profile row exists in public.profiles ───
    const ensureProfileExists = async (currentUser: User) => {
        if (!supabase) return;

        try {
            console.log('🔍 [Profile] Checking profile for:', currentUser.id);
            const { data: existing, error: checkErr } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', currentUser.id)
                .maybeSingle();

            if (checkErr) {
                console.error('❌ [Profile] Check failed:', checkErr);
                return;
            }

            if (!existing) {
                console.log('🆕 [Profile] No profile found. Creating...');
                const meta = currentUser.user_metadata ?? {};
                const fullName: string = meta.full_name || meta.name || 'Guerrero';
                const baseUsername: string = meta.username || meta.user_name || fullName;
                const suffix = Math.floor(1000 + Math.random() * 9000);
                const username = `${baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 22)}_${suffix}`;
                const avatarUrl: string | null = meta.avatar_url || null;

                const { error: insertErr } = await supabase
                    .from('profiles')
                    .insert({ id: currentUser.id, username, avatar_url: avatarUrl, checkins_count: 0, g_points: 1000 });

                if (insertErr) {
                    console.error('❌ [Profile] Insert failed:', insertErr);
                } else {
                    console.log('✅ [Profile] Created successfully:', username);
                }
            } else {
                console.log('✅ [Profile] Already exists.');
            }

            // Referral processing
            if (!isProcessingReferral.current) {
                const storedRef = sessionStorage.getItem('gym_referral_id');
                if (storedRef && storedRef !== currentUser.id && !currentUser.user_metadata?.referred_by) {
                    isProcessingReferral.current = true;
                    sessionStorage.removeItem('gym_referral_id');
                    try {
                        const ok = await userService.processReferral(currentUser.id, storedRef);
                        console.log(ok ? '✅ Referral processed.' : '⚠️ Referral failed.');
                    } catch (e) {
                        console.error('❌ Referral error:', e);
                    } finally {
                        isProcessingReferral.current = false;
                    }
                }
            }
        } catch (e) {
            console.error('❌ [Profile] Unexpected error:', e);
        }
    };

    // ─── Sign-in helpers ───
    const getRedirectUrl = () => {
        // In dev, always use localhost. In prod use the real origin.
        if (import.meta.env.DEV) return 'http://localhost:5173';
        return window.location.origin;
    };

    const signInWithGoogle = async () => {
        if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase no configurado.');
        const redirectTo = getRedirectUrl();
        console.log('🔐 [Auth] Google OAuth redirect to:', redirectTo);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo }
        });
        if (error) { console.error('Google Auth Error:', error); throw error; }
    };

    const signInWithMeta = async () => {
        if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase no configurado.');
        const redirectTo = getRedirectUrl();
        console.log('🔐 [Auth] Meta OAuth redirect to:', redirectTo);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'facebook',
            options: { redirectTo }
        });
        if (error) { console.error('Meta Auth Error:', error); throw error; }
    };

    const signInWithEmail = async (email: string) => {
        if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase no configurado.');
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: getRedirectUrl() }
        });
        if (error) throw error;
    };

    const signInAsDev = async () => {
        const mockUser: any = {
            id: 'dev-user-local',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'dev@localhost.com',
            email_confirmed_at: new Date().toISOString(),
            user_metadata: {
                full_name: 'Desarrollador (Local)',
                avatar_url: 'https://cdn-icons-png.flaticon.com/512/2919/2919600.png',
            },
            created_at: new Date().toISOString(),
        };
        setUser(mockUser);
        setSession({ access_token: 'mock-token', token_type: 'bearer', expires_in: 3600, refresh_token: 'mock-refresh', user: mockUser } as any);
        console.log("🔓 Dev Access Granted: Logged in as 'dev-user-local'");
    };

    const signOut = async () => {
        console.log('🚪 [Auth] Signing out...');

        // 1. Clear state immediately so UI reflects logout right away
        setUser(null);
        setSession(null);
        hasInitialized.current = false;

        // 2. Wipe all Supabase keys from localStorage
        try {
            const toRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('sb-') || k.includes('supabase'))) toRemove.push(k);
            }
            toRemove.forEach(k => localStorage.removeItem(k));
            sessionStorage.clear();
        } catch (_) { /* ignore */ }

        // 3. Fire Supabase network sign-out in background (don't await — it can hang)
        if (supabase) {
            supabase.auth.signOut().catch(e =>
                console.error('⚠️ [Auth] Background signOut failed:', e)
            );
        }

        // 4. Hard redirect to landing
        window.location.href = '/';
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signInWithMeta, signInWithEmail, signInAsDev, signOut }}>
            {loading ? null : children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
