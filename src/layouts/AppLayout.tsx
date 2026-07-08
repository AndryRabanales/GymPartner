import { MapPin, LogIn, LogOut, Trash2, AlertTriangle } from 'lucide-react';
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
import { withTimeout } from '../lib/networkGuard';

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

                        // TD-02: expiration + liveness guard. The toast can sit on screen
                        // while the inviter finishes/cancels their workout — never navigate
                        // the guest into a dead room.
                        const inviteAge = Date.now() - new Date(newNotification.created_at || Date.now()).getTime();
                        if (inviteAge > 2 * 60 * 1000) {
                            toast.error("⚠️ Esta invitación ya caducó (máximo 2 minutos).");
                            await notificationService.updateInvitationStatus(newNotification, 'rejected');
                            return;
                        }
                        const { data: inviterSession } = await workoutService.getActiveSession(senderId);
                        if (!inviterSession) {
                            toast.error("⚠️ Quien te invitó ya no está entrenando. La invitación quedó sin efecto.");
                            await notificationService.updateInvitationStatus(newNotification, 'rejected');
                            return;
                        }

                        await notificationService.updateInvitationStatus(newNotification, 'accepted');

                        const mode = newNotification.data?.mode || 'conjunto';

                        // Notify the inviter so their app automatically pulls them into the session
                        const accepterName = user.user_metadata?.full_name || user.user_metadata?.username || 'Tu compañero';
                        await supabase.from('notifications').insert({
                            user_id: senderId,
                            type: 'coop_accepted',
                            title: 'RETO ACEPTADO',
                            message: `¡${accepterName} ha aceptado tu desafío! Entrando al gimnasio...`,
                            data: {
                                partner_id: user.id,
                                sender_id: user.id,
                                sender_name: accepterName,
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

                        // ── Check defensivo de capacidad (spec §1.3-G) ────────────────────
                        // Protege contra race conditions: si dos personas envían solicitud
                        // simultáneamente cuando la sala está a 7, ambas podrían pasar el
                        // check del lado del solicitante. El host verifica antes de aceptar.
                        try {
                            const { count: guestNow } = await supabase
                                .from('workout_sessions')
                                .select('id', { count: 'exact', head: true })
                                .eq('partner_session_id', resolvedSession.id)
                                .is('end_time', null);

                            if ((guestNow || 0) >= 7) { // 7 invitados + 1 host = 8 total
                                toast.dismiss(t.id);
                                // Marcar como rechazado y notificar al solicitante
                                await notificationService.updateInvitationStatus(newNotification, 'rejected');
                                await supabase.from('notifications').insert({
                                    user_id: senderId,
                                    type: 'system',
                                    title: '⚡ SALA LLENA',
                                    message: 'La sala alcanzó su límite de 8 participantes justo cuando intentabas unirte. Inténtalo más tarde.',
                                    data: {}
                                });
                                toast.error("⚡ Sala llena — No se puede aceptar más participantes (máximo 8).");
                                return;
                            }
                        } catch (capErr) {
                            console.warn("No se pudo verificar capacidad antes de aceptar, continuando:", capErr);
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
                        const joinAccepterName = user.user_metadata?.full_name || user.user_metadata?.username || 'Tu compañero';
                        await supabase.from('notifications').insert({
                            user_id: senderId,
                            type: 'coop_join_accepted',
                            title: 'SOLICITUD ACEPTADA',
                            message: `¡${joinAccepterName} ha aceptado tu solicitud de unión! Entrando al gimnasio...`,
                            data: {
                                partner_id: user.id,
                                sender_id: user.id,
                                sender_name: joinAccepterName,
                                mode: 'conjunto',
                                chat_id: roomSessionId,
                                session_id: roomSessionId
                            }
                        });

                        const hasActiveOnAccept = !!activeSession;

                        // ⚠️ CRITICAL: ALWAYS push fresh location.state — even when the host is
                        // already on /workout actively training (the exact "usuario 1 inicia
                        // entrenamiento, usuario 2 entra" scenario the user keeps hitting).
                        //
                        // WorkoutSession.tsx's local isMultiplayer/partnerId/syncRoomId/
                        // multiplayerMode state is ONLY ever updated by the useEffect that
                        // watches [location.state, user?.id] (around line 309). There is NO
                        // postgres_changes listener on workout_sessions and no other event that
                        // lets an already-mounted host "automatically" pick up a new guest —
                        // the old comment here ("the new participant will join via the Realtime
                        // presence channel automatically") was simply WRONG: without a fresh
                        // navigate() call, isMultiplayer stays false, partnerId stays null, the
                        // gated channel-setup effect (`if (!isMultiplayer || !partnerId || ...)
                        // return;`) never runs, the coop-workout-${syncRoomId} channel is NEVER
                        // created on the host's side, and the guest broadcasts into an empty/
                        // nonexistent room — exactly "llega la notificación a usuario 1 pero no
                        // carga nada".
                        //
                        // Navigating to the SAME route ('/workout') is SAFE and does NOT remount
                        // WorkoutSession (no `key` prop differentiates the <Route> element in
                        // App.tsx — see `<Route path="workout" element={<WorkoutSession />} />`),
                        // it only updates location.state/location.key, re-triggering the sync
                        // effect while preserving all in-memory exercise/timer state. This exactly
                        // mirrors the proven-working `coop_accepted` handler above (line ~633),
                        // which ALSO calls navigate('/workout', {...}) unconditionally.
                        //
                        // forceNewSession is `false` whenever the host has an active session
                        // (hasActiveOnAccept), so the "Preserve Session" branch in WorkoutSession's
                        // location.state effect runs — the host's current exercises/routine are
                        // explicitly PRESERVED, never wiped.
                        // ⚠️ IMPORTANT: keep `partnerId` STABLE across multiple guest
                        // acceptances. WorkoutSession.tsx's channel-setup useEffect has
                        // `partnerId` in its dependency array — if it CHANGES (e.g. gets
                        // reassigned to the newest joiner's id every time the host accepts
                        // guest #2, #3, ...), the realtime `coop-workout-${roomId}` channel
                        // gets torn down and RECREATED on the host's side mid-session,
                        // disrupting the already-connected guests' presence/state sync
                        // (this was the root cause of "los guest no pueden editar los datos
                        // de usuario 1" once a 3rd participant joined).
                        //
                        // `resolvedSession.partner_id || senderId` mirrors the DB update
                        // above (line ~293): for the FIRST guest it resolves to senderId
                        // (guest1), and for every SUBSEQUENT guest it resolves to the
                        // ALREADY-PERSISTED guest1 id — so `setPartnerId(...)` becomes a
                        // no-op (same value) and the channel is never torn down.
                        navigate('/workout', {
                            state: {
                                isMultiplayer: true,
                                multiplayerMode: 'conjunto',
                                partnerId: resolvedSession.partner_id || senderId,
                                chatId: roomSessionId,
                                partnerSessionId: roomSessionId,
                                isInviter: true,
                                forceNewSession: !hasActiveOnAccept
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
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const [rescueSessionId, setRescueSessionId] = useState<string | null>(null);
    const [rescueGymId, setRescueGymId] = useState<string | null>(null);
    const [rescueStartedAt, setRescueStartedAt] = useState<string | null>(null);
    const [showRescueModal, setShowRescueModal] = useState<boolean>(false);
    const [rescueOfflineMode, setRescueOfflineMode] = useState<boolean>(false);

    // ── Local workout notifications (rest alarm / ongoing session) ──────────
    // Tapping any of them deep-links straight back into the active workout.
    useEffect(() => {
        let listener: any;
        (async () => {
            try {
                const { Capacitor } = await import('@capacitor/core');
                if (!Capacitor.isNativePlatform()) return;
                const { LocalNotifications } = await import('@capacitor/local-notifications');
                listener = await LocalNotifications.addListener('localNotificationActionPerformed', () => {
                    navigate('/workout');
                });
            } catch (e) {
                console.warn('[LocalNotif] listener setup failed:', e);
            }
        })();
        return () => { listener?.remove?.(); };
    }, []);

    // ─── Delete Account ────────────────────────────────────────────────────────
    const handleDeleteAccount = async () => {
        if (!user || !supabase) return;
        setIsDeleting(true);
        try {
            const uid = user.id;

            // 1. Collect all session IDs owned by this user
            const { data: sessions } = await supabase
                .from('workout_sessions')
                .select('id')
                .eq('user_id', uid);
            const sessionIds = (sessions ?? []).map((s: any) => s.id);

            // 2. Delete workout logs linked to those sessions
            if (sessionIds.length > 0) {
                await supabase.from('workout_logs').delete().in('session_id', sessionIds);
            }

            // 3. Delete workout sessions
            await supabase.from('workout_sessions').delete().eq('user_id', uid);

            // 4. Delete notifications (sent to or by the user)
            await supabase.from('notifications').delete().eq('user_id', uid);

            // 5. Delete chat messages sent by the user
            await supabase.from('chat_messages').delete().eq('sender_id', uid);

            // 6. Delete profile row — this is the primary PII container
            await supabase.from('profiles').delete().eq('id', uid);

            // Note: the Supabase auth user row (auth.users) requires a server-side
            // admin call to fully remove. The profile deletion above removes all PII.
            // Contact ginxapp@gmail.com for full auth record removal if needed.

            // 7. Sign out (clears localStorage + session)
            await signOut();
        } catch (err) {
            console.error('❌ [DeleteAccount] Error:', err);
            setIsDeleting(false);
            toast.error('Error al eliminar la cuenta. Por favor, contacta a ginxapp@gmail.com.');
        }
    };

    // ── On startup + on app foreground: clean zombie/orphan sessions ───────────
    // Runs on mount AND every time the app comes back from background (visibilitychange).
    // This is the safety net: even if the app crashes mid-session, the next time
    // the user opens it the orphaned sessions get closed automatically.
    useEffect(() => {
        if (!user) return;

        const runCleanup = () => {
            workoutService.cleanOrphanSessions(user.id)
                .then(closedIds => {
                    closedIds.forEach(id => localStorage.removeItem(`workout_draft_${id}`));
                })
                .catch(() => {}); // non-blocking — never interrupt the user
        };

        // Run immediately on mount (covers cold opens and refreshes)
        runCleanup();

        // Re-run when app comes back from background — covers the case where the
        // user locked their phone mid-session and re-opens the app later.
        const handleVisibilityForCleanup = () => {
            if (document.visibilityState === 'visible') {
                runCleanup();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityForCleanup);
        return () => document.removeEventListener('visibilitychange', handleVisibilityForCleanup);
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
                        { duration: 3000 }
                    );
                }
            } catch {
                // silent — will retry on the next 'online' event or app load
            }
        };

        flush(); // try immediately (covers reconnection that happened while app was closed)
        window.addEventListener('online', flush);

        // Also flush when app comes back to foreground — handles the case where
        // internet reconnected while the app was backgrounded (online event was missed).
        const handleVisibility = () => { if (document.visibilityState === 'visible') flush(); };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            cancelled = true;
            window.removeEventListener('online', flush);
            document.removeEventListener('visibilitychange', handleVisibility);
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
                // Recovery: soft-finalized sessions (finished_at set, end_time null)
                // may never receive the room_all_finished broadcast if the user
                // navigated away from WorkoutSession. On every startup/navigation,
                // check each one: if ALL other room participants have also finished
                // (finished_at != null), stamp end_time immediately so the session
                // appears in Historial. The 5-hour fallback below catches anything
                // that resolveOrphanedCoopSession can't resolve (e.g. RLS blocks).
                // These are best-effort cleanup only — never let them hang the check
                // (native NSURLSession can wait 60s+ for a timeout that never comes).
                const softFinalized = await withTimeout(
                    supabase.from('workout_sessions').select('id')
                        .eq('user_id', user.id).not('finished_at', 'is', null).is('end_time', null)
                        .then(r => r.data),
                    3500, null
                );

                if (softFinalized && softFinalized.length > 0) {
                    await Promise.all(softFinalized.map((s: any) => workoutService.resolveOrphanedCoopSession(s.id)));
                }

                // Hard fallback: if a session is still stuck after 5 hours (matches
                // the room max duration), force-close it regardless of other participants.
                const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
                const timedOut = await withTimeout(
                    supabase.from('workout_sessions').select('id')
                        .eq('user_id', user.id).not('finished_at', 'is', null).is('end_time', null)
                        .lt('finished_at', fiveHoursAgo)
                        .then(r => r.data),
                    3500, null
                );

                if (timedOut && timedOut.length > 0) {
                    await Promise.all(timedOut.map((s: any) => workoutService.markSessionFinished(s.id)));
                }

                // ─── DB-NEVER-BLOCKS: race the real "is there an active session?"
                // check against a short timeout. If the DB never answers (offline,
                // dead wifi that still reports navigator.onLine === true, etc.),
                // fall back to local storage instead of silently assuming "no
                // session" — that assumption is what made the rescue prompt (and
                // therefore the whole recovery path back into /workout) unreachable
                // while offline.
                const DB_TIMED_OUT = Symbol('db_timed_out');
                const raced = await Promise.race([
                    workoutService.getActiveSession(user.id).catch(() => ({ data: null, dbFailed: true })),
                    new Promise<typeof DB_TIMED_OUT>(resolve => setTimeout(() => resolve(DB_TIMED_OUT), 4000)),
                ]);

                const dbUnreachable = raced === DB_TIMED_OUT || (raced as any)?.dbFailed === true;
                const session = dbUnreachable ? null : (raced as any)?.data;

                if (!session) {
                    if (dbUnreachable) {
                        checkOfflineRescue();
                    } else {
                        setRescueOfflineMode(false);
                        setShowRescueModal(false);
                    }
                    return;
                }

                setRescueOfflineMode(false);

                // ─── POSTPONE / SNOOZE ─────────────────────────────────────────
                // The rescue prompt is mandatory — users can't permanently dismiss an
                // unfinished session/room without explicitly continuing it or
                // closing/finishing it. "Recordar más tarde" only grants a TEMPORARY
                // reprieve: it re-arms automatically once the snooze window elapses
                // (checked both here, on every navigation, AND via the periodic
                // interval set up below for users who don't navigate), so the system
                // always "obliga al usuario a regresar" to make a final call —
                // continuar, cerrar/finalizar, o volver a posponer.
                const snoozeKey = `ginx_rescue_snooze_${session.id}`;
                const snoozeUntilRaw = localStorage.getItem(snoozeKey);
                if (snoozeUntilRaw) {
                    const snoozeUntil = parseInt(snoozeUntilRaw, 10);
                    if (!isNaN(snoozeUntil) && Date.now() < snoozeUntil) {
                        setShowRescueModal(false);
                        return;
                    }
                    // Snooze window elapsed — clear it so the prompt resurfaces for good
                    // (it won't be silently re-snoozed by stale leftover data).
                    localStorage.removeItem(snoozeKey);
                }

                // ─── COOP ROOM SESSIONS ────────────────────────────────────────
                // Respect temp-exit flag for coop too: if the user deliberately left
                // via "Salir Temporalmente", don't interrupt them while browsing.
                // We still show the modal on a cold load (phone killed, cache cleared)
                // because sessionStorage is cleared between sessions.
                if (session.is_multiplayer) {
                    // Soft-finalized sessions now have finished_at set immediately, so
                    // getActiveSession() will never return them — this block only fires
                    // for genuinely active (un-finalized) coop sessions.
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
                console.warn('⚠️ [Rescue Check] Failed to check active session, falling back to local storage:', err);
                checkOfflineRescue();
            }
        };

        // ─── OFFLINE FALLBACK ──────────────────────────────────────────────────
        // The DB couldn't tell us whether there's an active session (offline, or
        // navigator.onLine lying about a dead connection). The local draft that
        // WorkoutSession debounce-saves on every change (STORAGE_KEY, cleared on
        // finalize/cancel/restart) is the only remaining source of truth: if it
        // still holds real exercise data, there is an unfinished workout the user
        // must be able to get back to WITHOUT internet.
        const checkOfflineRescue = () => {
            const isTempExit = sessionStorage.getItem('ginx_temp_exit_active') === 'true';
            if (isTempExit) {
                setShowRescueModal(false);
                return;
            }
            try {
                const raw = localStorage.getItem('ginx_active_session');
                if (!raw) {
                    setShowRescueModal(false);
                    return;
                }
                const parsed = JSON.parse(raw);
                const data = parsed?.data;
                if (!data || !Array.isArray(data.exercises) || data.exercises.length === 0) {
                    setShowRescueModal(false);
                    return;
                }

                const snoozeKey = 'ginx_rescue_snooze_offline-local';
                const snoozeUntilRaw = localStorage.getItem(snoozeKey);
                if (snoozeUntilRaw) {
                    const snoozeUntil = parseInt(snoozeUntilRaw, 10);
                    if (!isNaN(snoozeUntil) && Date.now() < snoozeUntil) {
                        setShowRescueModal(false);
                        return;
                    }
                    localStorage.removeItem(snoozeKey);
                }

                setRescueOfflineMode(true);
                setRescueSessionId('offline-local');
                setRescueGymId(data.gymId || null);
                setRescueStartedAt(data.startTime || new Date(parsed.savedAt || Date.now()).toISOString());
                setShowRescueModal(true);
            } catch {
                setShowRescueModal(false);
            }
        };

        checkRescuableSession();

        // Re-check periodically — independent of navigation — so a postponed prompt
        // resurfaces the instant its snooze window elapses, even if the user just
        // sits on the same screen the whole time. This is what turns "posponer"
        // into a real, bounded snooze instead of a silent permanent dismissal.
        const recheckInterval = setInterval(checkRescuableSession, 60000);
        return () => clearInterval(recheckInterval);
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

        // TD-04: on native (Capacitor), visibilitychange/beforeunload are NOT
        // reliable — iOS may not fire them when the app is backgrounded, and
        // beforeunload never fires at all. Capacitor's appStateChange is the
        // authoritative resume/background signal on mobile, so presence
        // recording is guaranteed there too.
        let removeAppStateListener: (() => void) | null = null;
        (async () => {
            try {
                const { Capacitor } = await import('@capacitor/core');
                if (!Capacitor.isNativePlatform()) return;
                const { App: CapApp } = await import('@capacitor/app');
                const handle = await CapApp.addListener('appStateChange', ({ isActive }) => {
                    const isWorkoutPage = location.pathname.includes('/workout');
                    if (isActive) {
                        updateActiveStatus(new Date().toISOString());
                    } else if (!isWorkoutPage) {
                        handleUnload();
                    }
                });
                removeAppStateListener = () => { handle.remove(); };
            } catch (e) {
                console.warn('appStateChange listener unavailable:', e);
            }
        })();

        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', handleUnload);
            document.removeEventListener('visibilitychange', handleVisibility);
            removeAppStateListener?.();
            // On unmount (e.g. navigation out of layout/logout), set offline too
            handleUnload();
        };
    }, [user]);

    // Preload all exercise catalog images for instant rendering without delays
    useEffect(() => {
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

        const channel = supabase
            .channel(`user-notifications:${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                const newNotification = payload.new;

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
), {duration: 3000});
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
                    ), { duration: 3000 });
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
                    ), { duration: 3000 });
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
    const isLoginPage = location.pathname === '/login';
    const isWorkoutPage = location.pathname.startsWith('/workout') || location.pathname.includes('/territory/');
    
    const shouldHideHeader = isRadarPage || isRankingPage || isChatPage || isReelsPage || isArsenalPage || isWorkoutPage || isLoginPage;

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
 
                                                                 {/* Eliminar Cuenta Button */}
                                                                 <button
                                                                     onClick={() => {
                                                                         setShowDeleteModal(true);
                                                                         setIsUserMenuOpen(false);
                                                                     }}
                                                                     className="w-full text-left px-4 py-3 text-sm text-neutral-500 hover:text-red-400 hover:bg-red-500/5 transition-colors font-bold flex items-center gap-3 rounded-xl"
                                                                 >
                                                                     <Trash2 size={16} /> Eliminar cuenta
                                                                 </button>

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
                offlineMode={rescueOfflineMode}
                onResolve={() => setShowRescueModal(false)}
            />
            {shouldShowBottomNav && <BottomNav onUploadClick={() => setIsUploadModalOpen(true)} />}
            <Toaster position="top-center" reverseOrder={false} toastOptions={{ duration: 3000 }} />

            {/* ── Delete Account Confirmation Modal ─────────────────────────────── */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-6">
                    <div className="bg-neutral-900 border border-red-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle size={20} className="text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-black text-sm uppercase tracking-wide">Eliminar Cuenta</h3>
                                <p className="text-red-400 text-[11px] font-bold uppercase tracking-wide mt-0.5">Acción irreversible</p>
                            </div>
                        </div>

                        {/* Warning text */}
                        <p className="text-neutral-400 text-xs leading-relaxed mb-3">
                            Esta acción <strong className="text-white">borrará permanentemente</strong> todos tus datos:
                        </p>
                        <ul className="text-neutral-500 text-xs space-y-1.5 mb-5">
                            <li className="flex items-center gap-2"><span className="text-red-500/60">•</span> Perfil y datos personales</li>
                            <li className="flex items-center gap-2"><span className="text-red-500/60">•</span> Historial de entrenamientos y estadísticas</li>
                            <li className="flex items-center gap-2"><span className="text-red-500/60">•</span> Mensajes y conversaciones</li>
                            <li className="flex items-center gap-2"><span className="text-red-500/60">•</span> Puntos GX, logros y rachas</li>
                            <li className="flex items-center gap-2"><span className="text-red-500/60">•</span> Notificaciones</li>
                        </ul>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 font-black text-xs py-3 rounded-xl transition-colors disabled:opacity-50 uppercase tracking-widest"
                            >
                                {isDeleting ? 'Eliminando datos...' : 'Sí, eliminar mi cuenta'}
                            </button>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                                className="w-full text-neutral-500 hover:text-neutral-400 text-xs font-bold py-2.5 transition-colors rounded-xl hover:bg-white/3"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
