import { MapPin, LogIn, LogOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { UploadModal } from '../components/social/UploadModal';
import { BottomNav } from '../components/navigation/BottomNav';
import { useBottomNav } from '../context/BottomNavContext';
import { NotificationBell } from '../components/ui/NotificationBell';
import { GPointsDisplay } from '../components/gamification/GPointsDisplay';

import { ActiveWorkoutBubble } from '../components/workout/ActiveWorkoutBubble';
import { ActiveSessionRescueModal } from '../components/workout/ActiveSessionRescueModal';
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
                                mode: mode
                                // No chat_id — room ID will be the host's session ID, discovered via polling
                            }
                        });

                        navigate('/workout', {
                            state: {
                                isMultiplayer: true,
                                multiplayerMode: mode,
                                partnerId: senderId,
                                isInviter: false,
                                forceNewSession: true
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

                        // Match (spec §2-B): aceptar una solicitud de unión a Co-op también
                        // forma el match entre ambos usuarios — desbloquea el chat directo.
                        // acceptInvitation ya aplica la regla de unicidad por pareja: si ya
                        // existe un match (de Radar, otro Co-op, etc.) no crea otro ni repite el +1 GX.
                        notificationService.acceptInvitation(senderId).catch((e: any) =>
                            console.error('❌ Error forming match on coop join accept:', e)
                        );

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

                        const hasActiveOnAccept = !!activeSession;

                        // If the host is ALREADY in the workout page (training), do NOT navigate —
                        // that would change location.key, potentially breaking their active session.
                        // The new participant will join via the Realtime presence channel automatically.
                        // Only navigate if the host is NOT currently in the workout.
                        if (!window.location.pathname.includes('/workout')) {
                            navigate('/workout', {
                                state: {
                                    isMultiplayer: true,
                                    multiplayerMode: 'conjunto',
                                    partnerId: senderId,
                                    chatId: roomSessionId,
                                    partnerSessionId: roomSessionId,
                                    isInviter: true,
                                    forceNewSession: !hasActiveOnAccept
                                }
                            });
                        }
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
    const [rescueSessionId, setRescueSessionId] = useState<string | null>(null);
    const [rescueGymId, setRescueGymId] = useState<string | null>(null);
    const [rescueStartedAt, setRescueStartedAt] = useState<string | null>(null);
    const [showRescueModal, setShowRescueModal] = useState<boolean>(false);

    // ── On startup: clean zombie/orphan sessions so they never accumulate ──────
    // This runs once per login session. cleanOrphanSessions normally only runs
    // inside initializeBattle (workout page entry), leaving zombies alive on all
    // other pages. Running it here on mount ensures old sessions are closed as
    // soon as the user opens the app, regardless of which page they land on.
    useEffect(() => {
        if (!user) return;
        workoutService.cleanOrphanSessions(user.id)
            .then(closedIds => {
                closedIds.forEach(id => localStorage.removeItem(`workout_draft_${id}`));
            })
            .catch(() => {}); // non-blocking — never interrupt the user
    }, [user?.id]);

    // ── OFFLINE SYNC: recover sets queued during a connectionless finish ──────
    // spec §1.2: "al recuperar la conexión, todos los datos registrados offline
    // se sincronizan automáticamente con el servidor sin necesidad de acción del
    // usuario — la sincronización ocurre en segundo plano, el usuario nunca
    // necesita iniciar manualmente una 'sincronización pendiente'."
    //
    // WorkoutSession queues any set that fails to save at finish-time (e.g. no
    // signal) via workoutService.queuePendingSet — instead of losing it. This
    // effect lives here (the always-mounted app shell, not the workout page)
    // so recovery keeps working even after the user navigates away: it tries
    // once on load, and again every time the browser regains connectivity.
    useEffect(() => {
        if (!user) return;

        let cancelled = false;
        const flush = async () => {
            try {
                const { recovered } = await workoutService.flushPendingSets();
                if (!cancelled && recovered > 0) {
                    toast.success(
                        `✅ ${recovered} serie${recovered > 1 ? 's' : ''} pendiente${recovered > 1 ? 's' : ''} de tu último entrenamiento se sincronizaron correctamente.`,
                        { duration: 6000 }
                    );
                }
            } catch {
                // silent — will retry on the next 'online' event or app load
            }
        };

        flush(); // try immediately (covers reconnection that happened while app was closed)
        window.addEventListener('online', flush);
        return () => {
            cancelled = true;
            window.removeEventListener('online', flush);
        };
    }, [user?.id]);

    useEffect(() => {
        if (!user) return;

        // Never interrupt if they are already on the workout page
        if (location.pathname.includes('/workout')) {
            setShowRescueModal(false);
            return;
        }

        const checkRescuableSession = async () => {
            try {
                const { data: session } = await workoutService.getActiveSession(user.id);

                if (!session) {
                    setShowRescueModal(false);
                    return;
                }

                // ─── COOP ROOM SESSIONS ────────────────────────────────────────
                // Respect temp-exit flag for coop too: if the user deliberately left
                // via "Salir Temporalmente", don't interrupt them while browsing.
                // We still show the modal on a cold load (phone killed, cache cleared)
                // because sessionStorage is cleared between sessions.
                if (session.is_multiplayer) {
                    const isTempExitCoop = sessionStorage.getItem('ginx_temp_exit_active') === 'true';
                    if (isTempExitCoop) {
                        setShowRescueModal(false);
                        return;
                    }
                    setRescueSessionId(session.id);
                    setRescueGymId(session.gym_id || null);
                    setRescueStartedAt(session.started_at);
                    setShowRescueModal(true);
                    return;
                }

                // ─── INDIVIDUAL SESSIONS ───────────────────────────────────────
                // For solo sessions, respect the temp-exit flag (user navigated away
                // intentionally and has not lost their session).
                const isTempExit = sessionStorage.getItem('ginx_temp_exit_active') === 'true';
                if (isTempExit) {
                    setShowRescueModal(false);
                    return;
                }

                setRescueSessionId(session.id);
                setRescueGymId(session.gym_id || null);
                setRescueStartedAt(session.started_at);
                setShowRescueModal(true);
            } catch (err) {
                console.warn('⚠️ [Rescue Check] Failed to check active session:', err);
            }
        };

        checkRescuableSession();
    }, [user, location.pathname]);

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

                // Guard: Supabase Realtime may fire INSERT events to the sender too when the
                // RLS SELECT policy includes `data->>'sender_id' = auth.uid()`. We only want
                // to react to notifications that are actually ADDRESSED to the current user.
                if (newNotification.user_id !== user.id) {
                    console.warn('🔔 Notification not addressed to current user — ignoring (sender leak):', newNotification.id);
                    return;
                }

                // Deduplicate notifications by ID
                if (newNotification.id) {
                    if (notificationSeen.current.has(newNotification.id)) {
                        console.warn('🔔 Duplicate notification ignored:', newNotification.id);
                        return;
                    }
                    notificationSeen.current.add(newNotification.id);
                }
                if (newNotification.type === 'system' && newNotification.title?.includes('EN VIVO')) {
                    // Don't show "EN VIVO" noise while the user is already inside their own workout
                    if (location.pathname.includes('/workout')) return;
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
                    // Don't show "FINALIZADO" toast while user is inside an active workout session.
                    // This prevents a false "partner finished" notification caused by screen locks
                    // triggering cleanOrphanSessions or other cleanup logic on reconnect.
                    if (location.pathname.includes('/workout')) return;
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
                    // Rich toast using the existing CoopInviteToast component
                    const modeLabel = newNotification.data?.mode === 'conjunto' ? 'CONJUNTO' : 'SEPARADO';
                    toast.custom((t) => (
                        <CoopInviteToast
                            newNotification={newNotification}
                            t={t}
                            modeLabel={modeLabel}
                            user={user}
                            navigate={navigate}
                            notificationService={notificationService}
                        />
                    ), { duration: 20000 });
                } else if (newNotification.type === 'coop_accepted') {
                    // Host: guest accepted the invite → navigate into the workout.
                    // The room ID = host's session ID, established when host creates their session.
                    // The guest discovers this via DB polling — no pre-coordination needed.
                    toast.success(newNotification.message || "¡Aliado aceptó. Entrando a la sala...");
                    (async () => {
                        try {
                            const { data: activeSession } = await workoutService.getActiveSession(user.id);
                            navigate('/workout', {
                                state: {
                                    isMultiplayer: true,
                                    multiplayerMode: newNotification.data?.mode || 'conjunto',
                                    partnerId: newNotification.data?.partner_id,
                                    isInviter: true,
                                    // Only force a new session if the host has no active session
                                    forceNewSession: !activeSession
                                }
                            });
                        } catch (err) {
                            console.error("Error on coop_accepted navigate:", err);
                        }
                    })();
                } else if (newNotification.type === 'coop_join_request') {
                    // HOST receives a join request from any user who sees the room is open.
                    // Uses the rich CoopJoinRequestToast component.
                    toast.custom((t) => (
                        <CoopJoinRequestToast
                            newNotification={newNotification}
                            t={t}
                            user={user}
                            navigate={navigate}
                            notificationService={notificationService}
                        />
                    ), { duration: 20000 });
                } else if (newNotification.type === 'coop_join_accepted') {
                    // Guest: host accepted their join request → navigate into the room
                    toast.success(newNotification.message || "¡Acceso concedido! Entrando a la sala...");
                    const roomId = newNotification.data?.session_id || newNotification.data?.chat_id;
                    const hostId = newNotification.data?.partner_id;
                    // Persist room state so rescue modal can restore it on reconnect
                    localStorage.setItem('ginx_coop_state', JSON.stringify({
                        isMultiplayer: true,
                        multiplayerMode: 'conjunto',
                        partnerId: hostId,
                        chatId: roomId,
                        partnerSessionId: roomId,
                        isInviter: false
                    }));
                    navigate('/workout', {
                        state: {
                            isMultiplayer: true,
                            multiplayerMode: 'conjunto',
                            partnerId: hostId,
                            chatId: roomId,
                            partnerSessionId: roomId,
                            isInviter: false,
                            forceNewSession: true
                        }
                    });
                } else if (newNotification.type === 'room_closed') {
                    // Room was closed by the host while this user was offline/disconnected.
                    // Their session was already finalized in DB by closeRoom(). Show a toast.
                    toast.custom((t) => (
                        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-neutral-950/95 backdrop-blur-2xl border border-neutral-700/40 rounded-3xl pointer-events-auto flex flex-col p-4`}>
                            <p className="text-sm font-black text-white uppercase tracking-wider italic">🏁 SALA CERRADA</p>
                            <p className="mt-1 text-[11px] text-neutral-300 font-bold uppercase leading-normal">
                                {newNotification.message || 'El anfitrión cerró la sala de entrenamiento. Tu progreso fue guardado.'}
                            </p>
                            <button onClick={() => toast.dismiss(t.id)} className="mt-3 text-[10px] text-neutral-400 hover:text-white font-bold uppercase tracking-wider">Cerrar</button>
                        </div>
                    ), { duration: 8000 });
                    // Clear any stale coop state
                    localStorage.removeItem('ginx_coop_state');
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

            {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onSuccess={() => setIsUploadModalOpen(false)} />}
            <ActiveWorkoutBubble />
            <ActiveSessionRescueModal
                isOpen={showRescueModal && !!rescueSessionId && !!rescueStartedAt}
                sessionId={rescueSessionId || ''}
                gymId={rescueGymId}
                startedAt={rescueStartedAt || ''}
                onResolve={() => setShowRescueModal(false)}
            />
            {shouldShowBottomNav && <BottomNav onUploadClick={() => setIsUploadModalOpen(true)} />}
            <Toaster position="top-center" reverseOrder={false} />

        </div>
    );
};
