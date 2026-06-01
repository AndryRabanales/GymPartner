import { MapPin, LogIn, LogOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { UploadModal } from '../components/social/UploadModal';
import { BottomNav } from '../components/navigation/BottomNav';
import { useBottomNav } from '../context/BottomNavContext';
import { NotificationBell } from '../components/ui/NotificationBell';
import { RescueModal } from '../components/gamification/RescueModal';
import { GPointsDisplay } from '../components/gamification/GPointsDisplay';

import { ActiveWorkoutBubble } from '../components/workout/ActiveWorkoutBubble';
import { useAutoCheckin } from '../hooks/useAutoCheckin';
import { GlobalGPSGuard } from '../components/GlobalGPSGuard';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { COMMON_EQUIPMENT_SEEDS } from '../services/GymEquipmentService';
import { notificationService } from '../services/NotificationService';
import { workoutService } from '../services/WorkoutService';

const CoopInviteToast = ({
    newNotification,
    t,
    modeLabel,
    user,
    navigate,
    notificationService
}: {
    newNotification: any;
    t: any;
    modeLabel: string;
    user: any;
    navigate: any;
    notificationService: any;
}) => {
    const [sender, setSender] = useState<{ username: string; avatar_url: string | null } | null>(null);

    useEffect(() => {
        let active = true;
        const fetchSender = async () => {
            const senderId = newNotification.data?.sender_id;
            if (!senderId) return;
            const { data } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', senderId)
                .single();
            if (active && data) {
                setSender(data);
            }
        };
        fetchSender();
        return () => {
            active = false;
        };
    }, [newNotification.data?.sender_id]);

    const senderName = sender?.username || newNotification.data?.sender_name || 'Tu compañero';
    const senderAvatar = sender?.avatar_url;

    return (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-neutral-950/95 backdrop-blur-2xl border border-yellow-500/40 shadow-[0_20px_50px_rgba(250,204,21,0.2)] rounded-3xl pointer-events-auto flex flex-col p-4`}>
            <div className="flex items-center">
                <div className="shrink-0">
                    {senderAvatar ? (
                        <img
                            src={senderAvatar}
                            alt={senderName}
                            className="w-10 h-10 rounded-full border border-yellow-500/30 object-cover shadow-lg shadow-yellow-500/10"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-500 font-black text-sm uppercase">
                            {senderName.charAt(0)}
                        </div>
                    )}
                </div>
                <div className="ml-3 flex-1">
                    <p className="text-sm font-black text-white uppercase tracking-wider italic">
                        🔥 INVITACIÓN DE {senderName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-300 font-bold uppercase leading-normal">
                        Te invita a un entrenamiento <span className="text-yellow-500">{modeLabel}</span>.
                    </p>
                </div>
            </div>
            <div className="mt-4 flex gap-2 w-full">
                <button
                    onClick={async () => {
                        toast.dismiss(t.id);
                        await notificationService.updateInvitationStatus(newNotification, 'rejected');
                    }}
                    className="flex-1 py-2 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400 font-bold text-[10px] uppercase tracking-wider hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-95"
                >
                    IGNORAR
                </button>
                <button
                    onClick={async () => {
                        toast.dismiss(t.id);
                        const senderId = newNotification.data?.sender_id;
                        if (!senderId) return;

                        await notificationService.updateInvitationStatus(newNotification, 'accepted');
                        
                        const mode = newNotification.data?.mode || 'separado';
                        
                        // Notify the inviter so their app automatically pulls them into the session
                        await supabase.from('notifications').insert({
                            user_id: senderId,
                            type: 'coop_accepted',
                            title: 'RETO ACEPTADO',
                            message: `¡${user.user_metadata.full_name || 'Alguien'} ha aceptado tu desafío! Entrando al gimnasio...`,
                            data: {
                                partner_id: user.id,
                                mode: mode,
                                chat_id: newNotification.data?.chat_id
                            }
                        });

                        navigate('/workout', { 
                            state: { 
                                isMultiplayer: true, 
                                multiplayerMode: mode, 
                                partnerId: senderId,
                                chatId: newNotification.data?.chat_id,
                                isInviter: false
                            } 
                        });
                    }}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-br from-gym-primary to-yellow-500 text-neutral-950 font-black text-[10px] uppercase tracking-wider hover:shadow-[0_0_15px_rgba(255,215,0,0.35)] transition-all active:scale-95"
                >
                    ACEPTAR
                </button>
            </div>
        </div>
    );
};

const CoopJoinRequestToast = ({
    newNotification,
    t,
    user,
    navigate,
    notificationService
}: {
    newNotification: any;
    t: any;
    user: any;
    navigate: any;
    notificationService: any;
}) => {
    const [sender, setSender] = useState<{ username: string; avatar_url: string | null } | null>(null);

    useEffect(() => {
        let active = true;
        const fetchSender = async () => {
            const senderId = newNotification.data?.sender_id;
            if (!senderId) return;
            const { data } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', senderId)
                .single();
            if (active && data) {
                setSender(data);
            }
        };
        fetchSender();
        return () => {
            active = false;
        };
    }, [newNotification.data?.sender_id]);

    const senderName = sender?.username || newNotification.data?.sender_name || 'Tu compañero';
    const senderAvatar = sender?.avatar_url;

    return (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-neutral-950/95 backdrop-blur-2xl border border-yellow-500/40 shadow-[0_20px_50px_rgba(250,204,21,0.2)] rounded-3xl pointer-events-auto flex flex-col p-4`}>
            <div className="flex items-center">
                <div className="shrink-0">
                    {senderAvatar ? (
                        <img
                            src={senderAvatar}
                            alt={senderName}
                            className="w-10 h-10 rounded-full border border-yellow-500/30 object-cover shadow-lg shadow-yellow-500/10"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-500 font-black text-sm uppercase">
                            {senderName.charAt(0)}
                        </div>
                    )}
                </div>
                <div className="ml-3 flex-1">
                    <p className="text-sm font-black text-white uppercase tracking-wider italic">
                        🔥 SOLICITUD DE UNIÓN
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-300 font-bold uppercase leading-normal">
                        <span className="text-yellow-500">@{senderName}</span> quiere unirse a tu entrenamiento actual.
                    </p>
                </div>
            </div>
            <div className="mt-4 flex gap-2 w-full">
                <button
                    onClick={async () => {
                        toast.dismiss(t.id);
                        await notificationService.updateInvitationStatus(newNotification, 'rejected');
                    }}
                    className="flex-1 py-2 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400 font-bold text-[10px] uppercase tracking-wider hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-95"
                >
                    IGNORAR
                </button>
                <button
                    onClick={async () => {
                        toast.dismiss(t.id);
                        const senderId = newNotification.data?.sender_id;
                        if (!senderId) return;

                        // Retrieve active session to validate host status using robust service
                        const { data: activeSession, error: activeErr } = await workoutService.getActiveSession(user.id);

                        if (activeErr) {
                            console.error("❌ Error query active session in join toast:", activeErr);
                        }

                        let resolvedSession = activeSession;
                        if (!resolvedSession) {
                            console.log("⚠️ No active session found for user, creating one on the fly to accept join request");
                            const newSess = await workoutService.startSession(
                                user.id,
                                undefined,
                                true,
                                'conjunto',
                                senderId
                            );
                            if (newSess && newSess.data) {
                                resolvedSession = newSess.data;
                            } else {
                                toast.error("❌ No tienes un entrenamiento activo para aceptar nuevos aliados.");
                                return;
                            }
                        }

                        const targetSessionId = newNotification.data?.session_id;

                        // Align session mismatch gracefully instead of blocking the user
                        if (targetSessionId && resolvedSession.id !== targetSessionId) {
                            console.warn(`⚠️ Session ID mismatch (requested: ${targetSessionId}, active: ${resolvedSession.id}). Aligning to active session.`);
                        }
                        await notificationService.updateInvitationStatus(newNotification, 'accepted');

                        // Update our own active session to multiplayer in the DB!
                        await supabase
                            .from('workout_sessions')
                            .update({
                                is_multiplayer: true,
                                multiplayer_mode: 'conjunto',
                                partner_id: resolvedSession.partner_id || senderId
                            })
                            .eq('id', resolvedSession.id);

                        const roomSessionId = resolvedSession.id;
                        // Send acceptance notification to B
                        await supabase.from('notifications').insert({
                            user_id: senderId,
                            type: 'coop_join_accepted',
                            title: 'SOLICITUD ACEPTADA',
                            message: `¡${user.user_metadata.username || 'Tu compañero'} ha aceptado tu solicitud de unión! Entrando al gimnasio...`,
                            data: {
                                partner_id: user.id,
                                mode: 'conjunto',
                                chat_id: roomSessionId,
                                session_id: roomSessionId
                            }
                        });

                        // Redirect to the workout session
                        navigate('/workout', { 
                            state: { 
                                isMultiplayer: true, 
                                multiplayerMode: 'conjunto', 
                                partnerId: senderId,
                                chatId: roomSessionId,
                                partnerSessionId: roomSessionId,
                                isInviter: true
                            } 
                        });
                    }}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-br from-gym-primary to-yellow-500 text-neutral-950 font-black text-[10px] uppercase tracking-wider hover:shadow-[0_0_15px_rgba(255,215,0,0.35)] transition-all active:scale-95"
                >
                    ACEPTAR
                </button>
            </div>
        </div>
    );
};

export const AppLayout = () => {
    useAutoCheckin();
    const { user, signOut } = useAuth();
    const { isBottomNavVisible } = useBottomNav();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const tokenRef = useRef<string | null>(null);

    // Keep tokenRef synchronously updated with current user session token
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            tokenRef.current = data.session?.access_token || null;
        });
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            tokenRef.current = session?.access_token || null;
        });
        
        return () => subscription.unsubscribe();
    }, []);

    // Real-time user activity tracker (online status presence)
    useEffect(() => {
        if (!user) return;

        const updateActiveStatus = async (status: string | null) => {
            try {
                await supabase
                    .from('profiles')
                    .update({ last_active_at: status })
                    .eq('id', user.id);
            } catch (err) {
                console.error("Error updating active status:", err);
            }
        };

        // 1. Mark as Active initially
        updateActiveStatus(new Date().toISOString());
        
        // 2. Loop update every 2 minutes
        const interval = setInterval(() => {
            updateActiveStatus(new Date().toISOString());
        }, 2 * 60 * 1000);

        // 3. Mark as Offline when tab/app/browser is closed or hidden
        const handleUnload = () => {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            if (!supabaseUrl || !supabaseAnonKey) return;
            
            const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`;
            const headers: HeadersInit = {
                'apikey': supabaseAnonKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            };
            if (tokenRef.current) {
                headers['Authorization'] = `Bearer ${tokenRef.current}`;
            }
            
            // Standard keepalive beacon to reset presence instantly on close
            fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ last_active_at: null }),
                keepalive: true
            });
        };

        window.addEventListener('beforeunload', handleUnload);
        
        const handleVisibility = () => {
            // If the app is hidden (e.g., device locked) and we are NOT on the workout page,
            // mark the user as offline. During an active workout we keep the status alive to
            // avoid the other participant thinking the session has finished.
            const isWorkoutPage = location.pathname.includes('/workout');
            if (document.visibilityState === 'hidden' && !isWorkoutPage) {
                handleUnload();
            } else {
                updateActiveStatus(new Date().toISOString());
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', handleUnload);
            document.removeEventListener('visibilitychange', handleVisibility);
            // On unmount (e.g. navigation out of layout/logout), set offline too
            handleUnload();
        };
    }, [user]);

    // Preload all exercise catalog images for instant rendering without delays
    useEffect(() => {
        console.log("🖼️ Preloading exercise catalog images for ultra-fast instant rendering...");
        COMMON_EQUIPMENT_SEEDS.forEach(seed => {
            if (seed.image_url) {
                const img = new Image();
                img.src = seed.image_url;
            }
        });
    }, []);
const notificationSeen = useRef<Set<string>>(new Set());
    // Subscribe to real-time live workout notifications
    useEffect(() => {
        if (!user) return;

        console.log("🔔 Subscribing to real-time notifications for live workouts...");
        const channel = supabase
            .channel(`user-notifications:${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                const newNotification = payload.new;
                console.log("🔔 Real-time notification received:", newNotification);
                // Deduplicate notifications by ID
                if (newNotification.id) {
                    if (notificationSeen.current.has(newNotification.id)) {
                        console.warn('🔔 Duplicate notification ignored:', newNotification.id);
                        return;
                    }
                    notificationSeen.current.add(newNotification.id);
                }
                if (newNotification.type === 'system' && newNotification.title?.includes('EN VIVO')) {
                    toast.custom((t) => (
    <div className="max-w-xs w-full bg-neutral-950/80 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex items-start space-x-3 animate-enter">
        <div className="flex-shrink-0 pt-0.5">
            <div className="w-6 h-6 rounded-full bg-red-500/30 flex items-center justify-center text-red-500 font-bold text-xs">LIVE</div>
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white uppercase tracking-wider">{newNotification.title}</p>
            <p className="text-xs text-neutral-300 mt-0.5">{newNotification.message}</p>
        </div>
        <button onClick={() => toast.dismiss(t.id)} className="text-xs text-neutral-400 hover:text-white">✕</button>
    </div>
), {duration: 6000});
                } else if (newNotification.type === 'system' && newNotification.title?.includes('FINALIZADO')) {
                    toast.custom((t) => (
                        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-neutral-950/95 backdrop-blur-2xl border border-green-500/40 shadow-[0_20px_50px_rgba(34,197,94,0.2)] rounded-3xl pointer-events-auto flex p-4`}>
                            <div className="flex-1 w-0">
                                <div className="flex items-center">
                                    <div className="shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-500 font-black text-[9px] tracking-widest">
                                            FIN
                                        </div>
                                    </div>
                                    <div className="ml-3 flex-1">
                                        <p className="text-sm font-black text-white uppercase tracking-wider italic">
                                            {newNotification.title}
                                        </p>
                                        <p className="mt-0.5 text-xs text-neutral-300 font-bold uppercase leading-normal">
                                            {newNotification.message}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="ml-4 shrink-0 flex items-center">
                                <button
                                    onClick={() => toast.dismiss(t.id)}
                                    className="border border-white/10 hover:bg-white/5 rounded-xl px-3 py-1.5 text-[9px] font-black text-neutral-400 hover:text-white transition-colors uppercase tracking-widest"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    ), { duration: 6000 });
                } else if (newNotification.type === 'coop_invite') {
                    const modeLabel = newNotification.data?.mode === 'conjunto' ? 'CONJUNTO' : 'SEPARADO';
                    toast.custom((t) => (
                        <div className="max-w-xs w-full bg-neutral-950/80 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex items-start space-x-3 animate-enter">
                            <div className="flex-shrink-0 pt-0.5">
                                <div className="w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-yellow-500 font-bold text-xs">⚔️</div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-white uppercase tracking-wider">INVITACIÓN DE {modeLabel}</p>
                                <p className="text-xs text-neutral-300 mt-0.5">{newNotification.data?.sender_name || 'Alguien'} te invita a un entrenamiento {modeLabel}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <button onClick={async () => {
                                    toast.dismiss(t.id);
                                    await notificationService.updateInvitationStatus(newNotification, 'rejected');
                                }} className="text-xs text-red-500 hover:text-red-300">Ignorar</button>
                                <button onClick={async () => {
                                    toast.dismiss(t.id);
                                    await notificationService.updateInvitationStatus(newNotification, 'accepted');
                                    const mode = newNotification.data?.mode || 'separado';
                                    await supabase.from('notifications').insert({
                                        user_id: newNotification.data?.sender_id,
                                        type: 'coop_accepted',
                                        title: 'RETO ACEPTADO',
                                        message: `¡${user.user_metadata.full_name || 'Alguien'} ha aceptado tu desafío!`,
                                        data: { partner_id: user.id, mode, chat_id: newNotification.data?.chat_id }
                                    });
                                    navigate('/workout', { state: { isMultiplayer: true, multiplayerMode: mode, partnerId: newNotification.data?.sender_id, chatId: newNotification.data?.chat_id, isInviter: false } });
                                }} className="text-xs text-green-500 hover:text-green-300">Aceptar</button>
                            </div>
                        </div>
                    ), {duration: 15000});
                } else if (newNotification.type === 'coop_accepted') {
                    // Instantly pull the inviter into the workout session
                    toast.success(newNotification.message || "Reto aceptado. Entrando a la sesión...");
                    navigate('/workout', { 
                        state: { 
                            isMultiplayer: true, 
                            multiplayerMode: newNotification.data?.mode || 'separado', 
                            partnerId: newNotification.data?.partner_id,
                            chatId: newNotification.data?.chat_id,
                            isInviter: true
                        } 
                    });
                } else if (newNotification.type === 'coop_join_request') {
                    toast.custom((t) => (
                        <div className="max-w-xs w-full bg-neutral-950/80 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex items-start space-x-3 animate-enter">
                            <div className="flex-shrink-0 pt-0.5">
                                <div className="w-6 h-6 rounded-full bg-yellow-500/30 flex items-center justify-center text-yellow-500 font-bold text-xs">🤝</div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-white uppercase tracking-wider">SOLICITUD DE UNIÓN</p>
                                <p className="text-xs text-neutral-300 mt-0.5">@{newNotification.data?.sender_name || 'Alguien'} quiere unirse</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <button onClick={async () => {
                                    toast.dismiss(t.id);
                                    await notificationService.updateInvitationStatus(newNotification, 'rejected');
                                }} className="text-xs text-red-500 hover:text-red-300">Ignorar</button>
                                <button onClick={async () => {
                                    toast.dismiss(t.id);
                                    const senderId = newNotification.data?.sender_id;
                                    if (!senderId) return;
                                    const { data: activeSession, error: activeErr } = await workoutService.getActiveSession(user.id);
                                    let resolvedSession = activeSession;
                                    if (!resolvedSession) {
                                        const newSess = await workoutService.startSession(user.id, undefined, true, 'conjunto', senderId);
                                        if (newSess?.data) resolvedSession = newSess.data;
                                    }
                                    await notificationService.updateInvitationStatus(newNotification, 'accepted');
                                    await supabase.from('workout_sessions').update({ is_multiplayer: true, multiplayer_mode: 'conjunto', partner_id: senderId }).eq('id', resolvedSession.id);
                                    await supabase.from('notifications').insert({
                                        user_id: senderId,
                                        type: 'coop_join_accepted',
                                        title: 'SOLICITUD ACEPTADA',
                                        message: `¡${user.user_metadata.username || 'Tu compañero'} aceptó tu solicitud`,
                                        data: { partner_id: user.id, mode: 'conjunto', chat_id: resolvedSession.id, session_id: resolvedSession.id }
                                    });
                                    navigate('/workout', { state: { isMultiplayer: true, multiplayerMode: 'conjunto', partnerId: senderId, chatId: resolvedSession.id, partnerSessionId: resolvedSession.id, isInviter: true } });
                                }} className="text-xs text-green-500 hover:text-green-300">Aceptar</button>
                            </div>
                        </div>
                    ), {duration: 15000});
                } else if (newNotification.type === 'coop_join_accepted') {
                    toast.success(newNotification.message || "Solicitud aceptada. Entrando al gimnasio...");
                    navigate('/workout', { 
                        state: { 
                            isMultiplayer: true, 
                            multiplayerMode: 'conjunto', 
                            partnerId: newNotification.data?.partner_id,
                            chatId: newNotification.data?.chat_id,
                            partnerSessionId: newNotification.data?.session_id,
                            isInviter: false
                        } 
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);
    
    // Pages where the global header should be hidden
    const isRadarPage = location.pathname === '/radar';
    const isRankingPage = location.pathname === '/ranking';
    const isChatPage = location.pathname === '/inbox' || location.pathname.startsWith('/chat/');
    const isReelsPage = location.pathname === '/reels';
    const isArsenalPage = location.pathname === '/arsenal';
    const isWorkoutPage = location.pathname === '/workout' || location.pathname.includes('/territory/');
    
    const shouldHideHeader = isRadarPage || isRankingPage || isChatPage || isReelsPage || isArsenalPage || isWorkoutPage;

    // Hide BottomNav during workout sessions, gym territory pages, arsenal, stats, history, and single chat pages
    const isContentPage = location.pathname === '/arsenal' || location.pathname === '/stats' || location.pathname === '/history' || location.pathname.startsWith('/history/');
    const isSingleChatPage = location.pathname.startsWith('/chat/');
    const shouldShowBottomNav = user && !isWorkoutPage && !isContentPage && !isSingleChatPage && isBottomNavVisible;

    return (
        <div className="h-[100dvh] text-white flex flex-col overflow-hidden relative">
            {/* Texture overlay for more depth */}
            <div className="fixed inset-0 bg-black/20 pointer-events-none z-0"></div>
            
            {/* Top Navigation - Floating Dock Style (Hidden on specific pages) */}
            {!shouldHideHeader && (
                <header className="fixed top-3 left-1/2 -translate-x-1/2 w-[94%] max-w-7xl z-50 animate-in slide-in-from-top-8 duration-700">
                    <nav className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] py-1.5 px-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        <div className="px-2 sm:px-4">
                            <div className="flex items-center justify-between h-10 sm:h-12">
                                <Link to="/" className="flex items-center no-underline group relative">
                                    <div className="relative flex items-center">
                                        <div className="absolute inset-0 bg-white/5 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                        <img
                                            src="/ginxnew.png"
                                            alt="GINX"
                                            className="h-[36px] w-auto sm:h-[44px] relative z-10 transition-all duration-500 group-hover:scale-105 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] animate-in zoom-in-50 duration-700"
                                        />
                                    </div>
                                </Link>

                                <nav className="hidden md:flex items-center bg-white/5 rounded-full p-0.5 border border-white/5 backdrop-blur-md">
                                    {[
                                        { to: "/", label: "Inicio" },
                                        { to: "/map", label: "Mapa" },
                                        { to: "/ranking", label: "Rankings" },
                                    ].map((link) => (
                                        <Link
                                            key={link.to}
                                            to={link.to}
                                            className="px-4 py-1 text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200 no-underline"
                                        >
                                            {link.label}
                                        </Link>
                                    ))}
                                </nav>

                                <div className="flex items-center gap-3 sm:gap-5">
                                    {user && (
										<Link
											to="/map"
											className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-yellow-500/10 border border-yellow-500 flex items-center justify-center text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all backdrop-blur-md shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-pulse shrink-0 mr-1"
											title="Ver Mapa"
										>
											<MapPin size={16} />
										</Link>
                                    )}

                                    <div className="flex items-center gap-2">
                                         {user && <NotificationBell />}
                                         {user ? (
                                             <div className="relative z-50">
                                                 <button
                                                     onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                                     className="flex items-center gap-1 bg-neutral-900/50 hover:bg-neutral-800 pl-0.5 pr-2 py-0.5 rounded-xl border border-white/5 hover:border-gym-primary/30 transition-all shadow-lg group/avatar"
                                                 >
                                                     <div className="relative w-6 h-6 sm:w-7 sm:h-7">
                                                         <div className="absolute inset-0 bg-gym-primary blur-md rounded-full opacity-0 group-hover/avatar:opacity-40 transition-opacity"></div>
                                                         <img
                                                             src={user.user_metadata.avatar_url}
                                                             alt="Avatar"
                                                             className="relative w-full h-full rounded-full object-cover border border-white/10"
                                                         />
                                                     </div>
                                                     <span className="hidden sm:block text-[9px] font-black text-neutral-400 group-hover/avatar:text-white transition-colors uppercase tracking-widest">
                                                         {user.user_metadata.full_name?.split(' ')[0]}
                                                     </span>
                                                 </button>
 
                                                 {isUserMenuOpen && (
                                                     <>
                                                         <div className="fixed inset-0 z-[90]" onClick={() => setIsUserMenuOpen(false)}></div>
                                                         <div className="absolute right-0 mt-4 w-60 bg-neutral-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-[100]">
                                                             <div className="px-4 py-3 border-b border-white/5 mb-2 bg-white/2">
                                                                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Cuenta</p>
                                                                  <p className="text-sm font-bold text-white truncate">{user.user_metadata.full_name}</p>
                                                             </div>
                                                             <div className="border-t border-white/5 mt-2 pt-3 mx-2 flex flex-col gap-2.5">
                                                                 {/* Coin Icon & Amount Row */}
                                                                 <div className="px-4 py-2 flex items-center justify-between rounded-xl bg-white/5 border border-white/5">
                                                                     <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Mis Monedas</span>
                                                                     <GPointsDisplay />
                                                                 </div>
 
                                                                 {/* Cerrar Sesión Button */}
                                                                 <button
                                                                     onClick={() => {
                                                                         signOut();
                                                                         setIsUserMenuOpen(false);
                                                                     }}
                                                                     className="w-full text-left px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-bold flex items-center gap-3 rounded-xl"
                                                                 >
                                                                     <LogOut size={16} /> Cerrar Sesión
                                                                 </button>
                                                             </div>
                                                         </div>
                                                     </>
                                                 )}
                                            </div>
                                        ) : (
                                            <Link
                                                to="/login"
                                                className="hidden md:flex items-center gap-1.5 bg-gym-primary text-black hover:bg-yellow-400 px-4 py-1.5 rounded-full text-xs font-black tracking-wide transition-all shadow-[0_0_20px_rgba(250,204,21,0.15)] hover:shadow-[0_0_30px_rgba(250,204,21,0.3)] hover:-translate-y-0.5 no-underline"
                                            >
                                                <LogIn size={14} strokeWidth={2.5} />
                                                <span>ENTRAR</span>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </nav>
                </header>
            )}

            <GlobalGPSGuard />

            <main 
                key={location.pathname} 
                className={`flex-1 ${isChatPage ? 'overflow-hidden' : 'overflow-y-auto'} custom-scrollbar relative flex flex-col animate-in fade-in duration-500 ${
                    isChatPage ? 'pt-0 pb-0' : (shouldHideHeader ? 'pt-0 pb-16' : 'pt-20 pb-24')
                }`}
            >
                <Outlet />
            </main>

            <RescueModal />
            {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onSuccess={() => setIsUploadModalOpen(false)} />}
            <ActiveWorkoutBubble />
            {shouldShowBottomNav && <BottomNav onUploadClick={() => setIsUploadModalOpen(true)} />}
            <Toaster position="top-center" reverseOrder={false} />

        </div>
    );
};
