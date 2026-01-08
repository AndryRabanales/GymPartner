import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { userService } from '../services/UserService';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string) => Promise<void>;
    signInAsDev: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    signInWithGoogle: async () => { },
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
        if (!isSupabaseConfigured() || !supabase) {
            console.warn("Supabase not configured. Auth is disabled.");
            setLoading(false);
            return;
        }

        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // REFERRAL LOGIC: Capture ?ref= from URL
        const params = new URLSearchParams(window.location.search);
        const refId = params.get('ref');
        if (refId) {
            console.log("🔗 Referral Detected:", refId);
            sessionStorage.setItem('gym_referral_id', refId);
        }

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            // REFERRAL PROCESSING (On Login/Register)
            if (currentUser && !isProcessingReferral.current) {
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
        <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signInWithEmail, signInAsDev, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
