import React, { createContext, useContext, useEffect, useState } from 'react';
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

    // Ref to prevent double-processing
    const isProcessingReferral = React.useRef(false);

    useEffect(() => {
        console.log("🔑 [AuthContext] useEffect initialized. Checking Supabase configuration...");
        if (!isSupabaseConfigured() || !supabase) {
            console.warn("⚠️ [AuthContext] Supabase not configured. Auth is disabled.");
            setLoading(false);
            return;
        }

        // Detect potential auth callback early to adjust safety timeouts
        const isAuthCallback = window.location.hash.includes('access_token') || window.location.search.includes('code=');
        console.log("✅ [AuthContext] Supabase is configured correctly. isAuthCallback:", isAuthCallback);

        // 🚨 GLOBAL FAIL-SAFE TIMEOUT: Force unblock the UI if anything hangs!
        // We set a 3-second fail-safe timeout for normal loads, and 8 seconds for callbacks.
        const failSafeDuration = isAuthCallback ? 8000 : 3000;
        const failSafeTimeout = setTimeout(() => {
            console.warn(`⏰ [AuthContext Fail-Safe] Auth initialization took too long (>${failSafeDuration/1000}s). Forcing loading = false to unblock UI.`);
            setLoading(false);
        }, failSafeDuration);

        // Check active session on mount
        const initAuth = async () => {
            console.log("⚙️ [AuthContext] initAuth execution started...");
            try {
                // Instantly retrieve the parsed session (no network request under implicit flow)
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) console.error("❌ [AuthContext Error] Session Init Error:", error);
                
                if (session) {
                    console.log("✅ [AuthContext Session] Restored session for:", session.user.email);
                    setSession(session);
                    setUser(session.user);
                } else {
                    console.log("ℹ️ [AuthContext Session] No active session found on mount.");
                }
            } catch (err) {
                console.error("❌ [AuthContext Error] Unhandled error during initAuth:", err);
            } finally {
                console.log("⚙️ [AuthContext] initAuth finished. Setting loading state to false.");
                setLoading(false);
                clearTimeout(failSafeTimeout);
            }
        };

        initAuth();

        // REFERRAL LOGIC: Capture ?ref= from URL
        const params = new URLSearchParams(window.location.search);
        const refId = params.get('ref');
        if (refId) {
            console.log("🔗 [AuthContext Referral] Referral Detected in URL:", refId);
            sessionStorage.setItem('gym_referral_id', refId);
        }

        console.log("📡 [AuthContext Listener] Registering onAuthStateChange listener...");
        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            clearTimeout(failSafeTimeout);
            console.log("📡 [AuthContext Listener] Auth State Changed! Event:", _event, "Session exists:", !!session);
            try {
                setSession(session);
                const currentUser = session?.user ?? null;
                setUser(currentUser);

                // 🔓 UNBLOCK UI INSTANTLY: Set loading to false immediately to render the actual layout.
                setLoading(false);
                console.log("🔓 [AuthContext Listener] UI unblocked (loading=false) instantly!");

                // REFERRAL & PROFILE PROCESSING (On Login/Register) - Asynchronous Background Tasks
                if (currentUser && !isProcessingReferral.current) {
                    // Ensure profile is initialized instantly on first access
                    try {
                        console.log("🔍 [PROFILE CHECK] Querying profile for user ID in background:", currentUser.id);
                        const { data: existingProfile, error: profileCheckError } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('id', currentUser.id)
                            .maybeSingle();

                        if (profileCheckError) {
                            console.error("❌ [PROFILE CHECK] Database check failed:", profileCheckError);
                        }

                        if (!existingProfile) {
                            console.log("🆕 [PROFILE INITIALIZATION] No profile row found. Initializing profile dynamically...");
                            const fullName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || 'Guerrero';
                            // Normalize username to remove any spaces or special characters
                            const baseUsername = currentUser.user_metadata?.username || currentUser.user_metadata?.user_name || fullName;
                            const formattedUsername = baseUsername
                                .toLowerCase()
                                .replace(/[^a-z0-9_]/g, '_')
                                .substring(0, 30);
                            
                            const avatarUrl = currentUser.user_metadata?.avatar_url || null;

                            console.log("🆕 [PROFILE INITIALIZATION] Creating profile row with:", {
                                id: currentUser.id,
                                username: formattedUsername,
                                avatar_url: avatarUrl
                            });

                            const { error: insertError } = await supabase
                                .from('profiles')
                                .insert({
                                    id: currentUser.id,
                                    username: formattedUsername,
                                    avatar_url: avatarUrl,
                                    checkins_count: 0,
                                    g_points: 1000
                                });

                            if (insertError) {
                                console.error("❌ [PROFILE INITIALIZATION] Database insert failed:", insertError);
                            } else {
                                console.log("✅ [PROFILE INITIALIZATION] Profile row successfully created!");
                            }
                        } else {
                            console.log("✅ [PROFILE CHECK] Profile row already exists for user ID:", currentUser.id);
                        }
                    } catch (profileErr) {
                        console.error("❌ [PROFILE ERROR] Unexpected error in check/create routine:", profileErr);
                    }

                    const storedRefId = sessionStorage.getItem('gym_referral_id');
                    const alreadyReferred = currentUser.user_metadata?.referred_by;

                    if (storedRefId && !alreadyReferred && storedRefId !== currentUser.id) {
                        isProcessingReferral.current = true;
                        console.log("🎁 Automatic Referral Processing...");

                        try {
                            // Immediately remove to prevent loop/race condition
                            sessionStorage.removeItem('gym_referral_id');

                            const success = await userService.processReferral(currentUser.id, storedRefId);
                            if (success) {
                                console.log("✅ Referral Processed. +250 XP to Referrer.");
                            } else {
                                // Only restore if it was a genuine failure that should be retried (optional, but risky)
                                // For now, failure means we consumed the attempt. User can try link again manually if needed.
                                console.warn("❌ Referral Processing Failed.");
                            }
                        } catch (err) {
                            console.error("Referral Error", err);
                        } finally {
                            isProcessingReferral.current = false;
                        }
                    }
                }
            } catch (err) {
                console.error("Unhandled error in onAuthStateChange:", err);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        if (!isSupabaseConfigured() || !supabase) {
            throw new Error("Supabase no está configurado.");
        }

        // Force localhost in dev mode to ensure we request it explicitly
        let redirectUrl = window.location.origin;
        if (import.meta.env.DEV) {
            redirectUrl = 'http://localhost:5173';
        }

        // PERSIST REFERRAL ID IN REDIRECT URL (Crucial for Google Auth)
        const storedRef = sessionStorage.getItem('gym_referral_id');
        if (storedRef) {
            redirectUrl = `${redirectUrl}?ref=${storedRef}`;
            console.log("🔗 Persisting Referral in OAuth Redirect:", redirectUrl);
        }

        console.log("🔐 Initiating Google Auth with redirect:", redirectUrl);

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: false // Ensure we redirect
            }
        });

        if (error) console.error("Auth Error:", error);
    };

    const signInWithMeta = async () => {
        if (!isSupabaseConfigured() || !supabase) {
            throw new Error("Supabase no está configurado.");
        }

        let redirectUrl = window.location.origin;
        if (import.meta.env.DEV) {
            redirectUrl = 'http://localhost:5173';
        }

        const storedRef = sessionStorage.getItem('gym_referral_id');
        if (storedRef) {
            redirectUrl = `${redirectUrl}?ref=${storedRef}`;
            console.log("🔗 Persisting Referral in Meta Redirect:", redirectUrl);
        }

        console.log("🔐 Initiating Meta Auth with redirect:", redirectUrl);

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'facebook',
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: false
            }
        });

        if (error) console.error("Meta Auth Error:", error);
    };

    const signInWithEmail = async (email: string) => {
        if (!isSupabaseConfigured() || !supabase) {
            throw new Error("Supabase no está configurado.");
        }
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: window.location.origin
            }
        });
        if (error) {
            throw error;
        }
    };



    const signInAsDev = async () => {
        // MOCK USER for Localhost Testing (Bypass Supabase Redirect)
        const mockUser: any = {
            id: 'dev-user-local',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'dev@localhost.com',
            email_confirmed_at: new Date().toISOString(),
            phone: '',
            user_metadata: {
                full_name: 'Desarrollador (Local)',
                avatar_url: 'https://cdn-icons-png.flaticon.com/512/2919/2919600.png', // Robot Icon
            },
            created_at: new Date().toISOString(),
        };

        const mockSession: any = {
            access_token: 'mock-token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'mock-refresh',
            user: mockUser
        };

        setUser(mockUser);
        setSession(mockSession);
        console.log("🔓 Dev Access Granted: Logged in as 'dev-user-local'");
    };

    const signOut = async () => {
        if (session?.user?.id.startsWith('dev-')) {
            setUser(null);
            setSession(null);
            return;
        }
        if (supabase) {
            await supabase.auth.signOut();
        }
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signInWithMeta, signInWithEmail, signInAsDev, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
