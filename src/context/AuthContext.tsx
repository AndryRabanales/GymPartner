import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { userService } from '../services/UserService';

// ─────────────────────────────────────────────────────────────────────────────
// Age Gate Screen — shown to new users before profile creation
// Must be defined outside AuthProvider to avoid re-creation on every render
// ─────────────────────────────────────────────────────────────────────────────
type AgeGateScreenProps = {
    onConfirm: (dob: Date) => Promise<void>;
    onDecline: () => void;
};

const AgeGateScreen = ({ onConfirm, onDecline }: AgeGateScreenProps) => {
    const [dob, setDob] = useState('');
    const [ageError, setAgeError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Acceptable date range: 10–120 years old
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate())
        .toISOString().split('T')[0];
    const minDate = '1920-01-01';

    const handleSubmit = async () => {
        if (!dob) {
            setAgeError('Por favor ingresa tu fecha de nacimiento.');
            return;
        }
        // Parse at noon local time to avoid timezone off-by-one
        const birth = new Date(dob + 'T12:00:00');
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;

        if (age < 16) {
            setAgeError(
                'GINX requiere una edad mínima de 16 años. Al ser una app que facilita contacto directo entre usuarios, mensajería y encuentros físicos en gimnasios, es un requisito legal.'
            );
            return;
        }
        setAgeError(null);
        setSubmitting(true);
        try {
            await onConfirm(birth);
        } catch {
            setAgeError('Error al verificar tu edad. Inténtalo de nuevo.');
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 flex flex-col items-center justify-center p-6"
            style={{ background: '#0a0a0a', fontFamily: 'system-ui, -apple-system, sans-serif', zIndex: 99999 }}
        >
            <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">
                {/* Brand */}
                <div className="flex flex-col items-center gap-2">
                    <div
                        style={{
                            width: 64, height: 64, borderRadius: 16,
                            background: 'rgba(250,204,21,0.08)',
                            border: '1px solid rgba(250,204,21,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 30
                        }}
                    >
                        ⚡
                    </div>
                    <span style={{ color: '#ffd700', fontSize: 11, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                        GINX
                    </span>
                </div>

                {/* Title */}
                <div>
                    <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: '0 0 8px' }}>
                        Verificación de Edad
                    </h1>
                    <p style={{ color: '#737373', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                        Para usar GINX debes tener al menos{' '}
                        <strong style={{ color: '#ffd700' }}>16 años</strong>.
                        Ingresa tu fecha de nacimiento para continuar.
                    </p>
                </div>

                {/* Input */}
                <div style={{ width: '100%' }}>
                    <input
                        type="date"
                        value={dob}
                        onChange={e => { setDob(e.target.value); setAgeError(null); }}
                        min={minDate}
                        max={maxDate}
                        style={{
                            width: '100%', background: '#171717',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12, padding: '12px 16px',
                            color: '#fff', fontSize: 14,
                            outline: 'none', colorScheme: 'dark',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* Error */}
                {ageError && (
                    <div style={{
                        width: '100%', background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: 12, padding: '12px 16px',
                        color: '#f87171', fontSize: 12, textAlign: 'left', lineHeight: 1.5
                    }}>
                        {ageError}
                    </div>
                )}

                {/* Buttons */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !dob}
                        style={{
                            width: '100%', background: !dob || submitting ? '#404040' : '#ffd700',
                            color: !dob || submitting ? '#737373' : '#000',
                            border: 'none', borderRadius: 12,
                            padding: '14px 16px', fontSize: 13,
                            fontWeight: 900, letterSpacing: '0.05em',
                            textTransform: 'uppercase', cursor: !dob || submitting ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s'
                        }}
                    >
                        {submitting ? 'Verificando...' : 'Confirmar y Continuar'}
                    </button>
                    <button
                        onClick={onDecline}
                        disabled={submitting}
                        style={{
                            background: 'none', border: 'none',
                            color: '#525252', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', padding: '6px', transition: 'color 0.15s'
                        }}
                    >
                        Cancelar y cerrar sesión
                    </button>
                </div>

                {/* Privacy link */}
                <p style={{ color: '#404040', fontSize: 11, lineHeight: 1.5, marginTop: -8 }}>
                    Al continuar aceptas nuestra{' '}
                    <a
                        href="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#737373', textDecoration: 'underline' }}
                    >
                        Política de Privacidad
                    </a>
                </p>
            </div>
        </div>
    );
};

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

    // ── Age Gate ──────────────────────────────────────────────────────────────
    // When a brand-new user signs in (no profile exists yet), we pause the app
    // render and show <AgeGateScreen> until they confirm their age.
    const [needsAgeVerification, setNeedsAgeVerification] = useState(false);
    const pendingNewUserRef = useRef<User | null>(null);

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

    // ⏰ 5-minute Daily Active Tracker (1 GX Point)
    useEffect(() => {
        if (!user || !supabase) return;

        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        const localKey = `ginx_5min_reward_${user.id}_${today}`;

        // If local storage says we already rewarded today, skip completely
        if (localStorage.getItem(localKey) === 'true') {
            return;
        }

        console.log('⏰ [Active Tracker] Active session tracker started.');
        
        let sessionSecs = parseInt(sessionStorage.getItem(`active_secs_${user.id}_${today}`) || '0', 10);

        const interval = setInterval(async () => {
            sessionSecs += 1;
            sessionStorage.setItem(`active_secs_${user.id}_${today}`, sessionSecs.toString());

            if (sessionSecs >= 300) { // 5 minutes
                clearInterval(interval);
                
                // Double check DB to ensure they haven't received it today
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('custom_settings')
                        .eq('id', user.id)
                        .single();

                    const customSettings = profile?.custom_settings || {};
                    if (customSettings.last_5min_reward_date !== today) {
                        // Award 1 GX point
                        await userService.addGxPoints(user.id, 1, '5min_daily_active');

                        // Save updated custom_settings
                        await supabase
                            .from('profiles')
                            .update({
                                custom_settings: {
                                    ...customSettings,
                                    last_5min_reward_date: today
                                }
                            })
                            .eq('id', user.id);

                        // Mark locally
                        localStorage.setItem(localKey, 'true');

                        console.log('🎉 5 minutes daily active achieved! Awarded 1 GX point.');
                        const toastModule = await import('react-hot-toast');
                        toastModule.default.success('🔥 ¡Ganaste +1 GX por estar activo 5 minutos hoy!', {
                            duration: 5000,
                            icon: '⚡',
                            style: {
                                background: '#171717',
                                color: '#fff',
                                border: '1px solid rgba(250, 204, 21, 0.2)',
                                fontWeight: 'black',
                                textTransform: 'uppercase',
                                fontSize: '11px'
                            }
                        });
                    } else {
                        localStorage.setItem(localKey, 'true');
                    }
                } catch (err) {
                    console.error('Error rewarding 5-min active time:', err);
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [user]);

    // ─── Helper: create profile row + process referral (called after age OK) ───
    const doCreateProfile = async (currentUser: User) => {
        if (!supabase) return;
        console.log('🆕 [Profile] Creating profile for:', currentUser.id);
        const meta = currentUser.user_metadata ?? {};
        const fullName: string = meta.full_name || meta.name || 'Guerrero';
        const baseUsername: string = meta.username || meta.user_name || fullName;
        const suffix = Math.floor(1000 + Math.random() * 9000);
        const username = `${baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 22)}_${suffix}`;
        const avatarUrl: string | null = meta.avatar_url || null;

        const { error: insertErr } = await supabase
            .from('profiles')
            .insert({ id: currentUser.id, username, avatar_url: avatarUrl, checkins_count: 0, g_points: 0 });

        if (insertErr) {
            console.error('❌ [Profile] Insert failed:', insertErr);
        } else {
            console.log('✅ [Profile] Created successfully:', username);
        }

        // Process any pending referral for this brand-new user
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
    };

    // ─── Helper: ensure profile row exists in public.profiles ───
    // For NEW users: pauses the app and shows AgeGateScreen first.
    // For EXISTING users: skips profile creation, processes referrals only.
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
                // Brand-new user — show age gate before creating profile.
                // Profile creation is deferred to doCreateProfile() via handleAgeConfirm.
                console.log('🔒 [AgeGate] New user detected — showing age verification.');
                pendingNewUserRef.current = currentUser;
                setNeedsAgeVerification(true);
                return;
            }

            console.log('✅ [Profile] Already exists.');

            // Existing user — process any pending referral
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

    // ─── Age Gate callbacks (passed to AgeGateScreen) ──────────────────────
    const handleAgeConfirm = async (_dob: Date) => {
        // Age already validated in AgeGateScreen before this is called (age >= 16).
        // Create profile and dismiss the gate.
        const currentUser = pendingNewUserRef.current;
        if (currentUser) {
            await doCreateProfile(currentUser);
        }
        pendingNewUserRef.current = null;
        setNeedsAgeVerification(false);
    };

    const handleAgeDecline = () => {
        // User cancelled or failed age check — sign them out cleanly.
        pendingNewUserRef.current = null;
        setNeedsAgeVerification(false);
        setUser(null);
        setSession(null);
        hasInitialized.current = false;
        if (supabase) supabase.auth.signOut().catch(() => { });
        window.location.href = '/';
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

        // Clear presence in DB before logging out
        if (user && supabase) {
            try {
                await supabase
                    .from('profiles')
                    .update({ last_active_at: null })
                    .eq('id', user.id);
            } catch (err) {
                console.error("Error resetting active status on logout:", err);
            }
        }

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
            {loading ? null : needsAgeVerification ? (
                <AgeGateScreen onConfirm={handleAgeConfirm} onDecline={handleAgeDecline} />
            ) : children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
