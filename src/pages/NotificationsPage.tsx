import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/NotificationService';
import type { Notification } from '../services/NotificationService';
import { FadeInImage } from '../components/ui/FadeInImage';
import { Zap, UserPlus, MapPin, Check, X, Bell, History, Swords, Loader, Loader2, Bookmark, Activity } from 'lucide-react';
import { socialService } from '../services/SocialService';
import { ShareRoutinesToUserModal } from '../components/profile/ShareRoutinesToUserModal';
import { PlayerProfileModal } from '../components/profile/PlayerProfileModal';
import toast from 'react-hot-toast';

interface ExtendedNotification extends Notification {
    sender?: {
        username: string;
        avatar_url: string | null;
    };
}

interface ExtendedNotification extends Notification {
    sender?: {
        username: string;
        avatar_url: string | null;
    };
}

// Sub-component to display and manage routine shares
interface SharedRoutineCardProps {
    notification: any;
    onActionComplete: () => void;
}

const SharedRoutineCard = ({ notification, onActionComplete }: SharedRoutineCardProps) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [routineDetails, setRoutineDetails] = useState<any>(null);
    const [alreadySaved, setAlreadySaved] = useState(false);

    const routineId = notification.data?.routine_id;
    const routineName = notification.data?.routine_name;
    const senderUsername = notification.sender?.username || notification.data?.sender_username || 'guerrero';

    useEffect(() => {
        const fetchRoutine = async () => {
            setLoading(true);
            try {
                const { data: routine, error: routineError } = await supabase
                    .from('routines')
                    .select('id, name, routine_exercises(*)')
                    .eq('id', routineId)
                    .maybeSingle();

                if (routineError) throw routineError;

                if (routine) {
                    const exerciseIds = routine.routine_exercises?.map((e: any) => e.exercise_id) || [];
                    let exercisesMap = new Map();
                    if (exerciseIds.length > 0) {
                        const { data: eqData } = await supabase
                            .from('gym_equipment')
                            .select('id, name')
                            .in('id', exerciseIds);
                        if (eqData) {
                            eqData.forEach(ex => exercisesMap.set(ex.id, ex.name));
                        }
                        const missingIds = exerciseIds.filter(id => !exercisesMap.has(id));
                        if (missingIds.length > 0) {
                            const { data: exData } = await supabase
                                .from('exercises')
                                .select('id, name')
                                .in('id', missingIds);
                            if (exData) {
                                exData.forEach(ex => exercisesMap.set(ex.id, ex.name));
                            }
                        }
                    }

                    const enrichedExercises = routine.routine_exercises?.map((e: any) => ({
                        ...e,
                        exercise_name: exercisesMap.get(e.exercise_id) || e.name || 'Ejercicio'
                    })) || [];

                    setRoutineDetails({
                        ...routine,
                        exercises: enrichedExercises
                    });
                }
            } catch (err) {
                console.error("Error loading shared routine:", err);
            } finally {
                setLoading(false);
            }
        };

        if (routineId) {
            fetchRoutine();
        }
    }, [routineId]);

    const handleSaveMazo = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: newRoutine, error: routineErr } = await supabase
                .from('routines')
                .insert({
                    user_id: user.id,
                    name: `${routineDetails.name} (Copia)`,
                    is_public: false,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (routineErr) throw routineErr;

            if (routineDetails.exercises?.length > 0) {
                const exerciseRows = routineDetails.exercises.map((ex: any, idx: number) => ({
                    routine_id: newRoutine.id,
                    exercise_id: ex.exercise_id,
                    name: ex.exercise_name,
                    order_index: idx,
                    track_weight: ex.track_weight,
                    track_reps: ex.track_reps,
                    track_time: ex.track_time,
                    track_distance: ex.track_distance,
                    track_rpe: ex.track_rpe,
                    track_pr: ex.track_pr,
                    custom_metric: ex.custom_metric
                }));

                const { error: exercisesErr } = await supabase
                    .from('routine_exercises')
                    .insert(exerciseRows);

                if (exercisesErr) throw exercisesErr;
            }

            toast.success("¡Mazo guardado en tu arsenal exitosamente! ⚔️");
            setAlreadySaved(true);

            const { error: notifErr } = await supabase
                .from('notifications')
                .update({
                    is_read: true,
                    data: {
                        ...notification.data,
                        status: 'accepted'
                    }
                })
                .eq('id', notification.id);

            if (notifErr) throw notifErr;

            onActionComplete();
        } catch (err) {
            console.error("Error saving shared routine:", err);
            toast.error("Error al guardar el mazo.");
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async () => {
        setSaving(true);
        try {
            const { error: notifErr } = await supabase
                .from('notifications')
                .update({
                    is_read: true,
                    data: {
                        ...notification.data,
                        status: 'rejected'
                    }
                })
                .eq('id', notification.id);

            if (notifErr) throw notifErr;

            toast.success("Mazo ignorado.");
            onActionComplete();
        } catch (err) {
            console.error("Error rejecting routine share:", err);
            toast.error("Error al descartar la notificación.");
        } finally {
            setSaving(false);
        }
    };

    const status = notification.data?.status;

    return (
        <div className={`bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-5 shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition-all group my-2 text-left ${status ? 'opacity-60 grayscale-[0.5]' : 'hover:border-gym-primary/30'}`}>
            <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-gym-primary/10 border border-gym-primary/20 flex items-center justify-center text-gym-primary">
                        <Swords size={28} />
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className={`text-xs font-black italic uppercase tracking-tight truncate ${status ? 'text-neutral-500' : 'text-gym-primary'}`}>
                            MAZO DE ENTRENAMIENTO RECIBIDO ⚔️
                        </h3>
                        <span className="text-[9px] font-bold text-neutral-600 shrink-0">
                            {new Date(notification.created_at).toLocaleDateString()}
                        </span>
                    </div>
                    <p className={`text-xs font-medium leading-relaxed ${status ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        <span className="text-white font-black uppercase mr-1">@{senderUsername}</span>
                        te ha compartido su mazo de batalla: <span className="text-gym-primary font-black italic uppercase">"{routineName}"</span>
                    </p>

                    {loading ? (
                        <div className="mt-4 py-3 bg-neutral-900/50 rounded-2xl flex items-center justify-center gap-2 text-neutral-500">
                            <Loader2 className="animate-spin text-gym-primary" size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Cargando mazo...</span>
                        </div>
                    ) : routineDetails ? (
                        <div className="mt-4 bg-black/60 border border-white/5 rounded-2xl p-4 space-y-3">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Cartas del Mazo</span>
                                <span className="text-[9px] bg-gym-primary/10 text-gym-primary px-2 py-0.5 rounded-md font-black uppercase">
                                    {routineDetails.exercises?.length || 0} EJERCICIOS
                                </span>
                            </div>
                            <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                                {routineDetails.exercises?.map((ex: any, idx: number) => (
                                    <div key={ex.id || idx} className="flex items-center gap-2 text-left">
                                        <span className="text-[10px] font-black text-gym-primary italic shrink-0">#{idx + 1}</span>
                                        <span className="text-xs text-white font-bold truncate uppercase">{ex.exercise_name}</span>
                                    </div>
                                ))}
                                {(!routineDetails.exercises || routineDetails.exercises.length === 0) && (
                                    <p className="text-[10px] text-neutral-500 font-bold uppercase italic text-center py-2">Mazo vacío</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-[10px] text-red-500/80 font-bold uppercase italic mt-2">Error al cargar detalles del mazo.</p>
                    )}
                </div>
            </div>

            <div className="mt-6">
                {status === 'accepted' || alreadySaved ? (
                    <div className="w-full py-3 bg-gym-primary/10 border border-gym-primary/20 rounded-2xl flex items-center justify-center gap-2 text-gym-primary font-black text-[10px] uppercase tracking-widest">
                        <Check size={14} strokeWidth={3} /> ¡MAZO GUARDADO EN ARSENAL!
                    </div>
                ) : status === 'rejected' ? (
                    <div className="w-full py-3 bg-neutral-900/50 border border-neutral-800 rounded-2xl flex items-center justify-center gap-2 text-neutral-600 font-black text-[10px] uppercase tracking-widest">
                        <X size={14} strokeWidth={3} /> RETO DESCARTADO
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="flex-1 py-3 px-4 rounded-2xl bg-neutral-900 text-neutral-500 font-black text-[10px] uppercase tracking-widest border border-white/5 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <X size={14} />
                            DESCARTAR
                        </button>
                        <button
                            onClick={handleSaveMazo}
                            disabled={saving || loading}
                            className="flex-[1.5] py-3 px-4 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-gym-primary transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <Loader2 className="animate-spin" size={14} />
                            ) : (
                                <>
                                    <Bookmark size={14} />
                                    GUARDAR MAZO
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const groupNotifications = (notifs: ExtendedNotification[]) => {
    const today: ExtendedNotification[] = [];
    const thisWeek: ExtendedNotification[] = [];
    const earlier: ExtendedNotification[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    notifs.forEach(n => {
        const date = new Date(n.created_at);
        if (date >= todayStart) {
            today.push(n);
        } else if (date >= weekStart) {
            thisWeek.push(n);
        } else {
            earlier.push(n);
        }
    });

    return { today, thisWeek, earlier };
};

export const NotificationsPage = () => {
    const [notifications, setNotifications] = useState<ExtendedNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const [sharingRoutinesRequester, setSharingRoutinesRequester] = useState<{ id: string; username: string; notification: ExtendedNotification } | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setCurrentUser(user);
        });
    }, []);
    const navigate = useNavigate();

    useEffect(() => {
        loadNotifications();

        const setupSub = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const notifySub = supabase
                .channel('notifications-page')
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                    () => {
                        loadNotifications();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(notifySub);
            };
        };

        const cleanup = setupSub();
        return () => {
            cleanup.then(fn => fn && fn());
        };
    }, []);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const all = await notificationService.getNotifications(50);
            
            const senderIds = Array.from(new Set(all.map(n => 
                n.data?.sender_id || 
                n.data?.new_member_id || 
                n.data?.requester_id
            ).filter(Boolean)));
            
            if (senderIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', senderIds);
                
                const profileMap = (profiles || []).reduce((acc: Record<string, any>, p) => {
                    acc[p.id] = p;
                    return acc;
                }, {});

                const extended = all.map(n => ({
                    ...n,
                    sender: profileMap[n.data?.sender_id || n.data?.new_member_id || n.data?.requester_id]
                }));
                setNotifications(extended);
            } else {
                setNotifications(all);
            }

            // Mark all as read when opening page
            if (all.some(n => !n.is_read)) {
                await notificationService.markAllAsRead();
            }

        } catch (error) {
            console.error("Error loading notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (notification: ExtendedNotification) => {
        if (notification.data?.type === 'request_history') {
            const requesterId = notification.data?.requester_id;
            if (!requesterId) return;

            setNotifications(prev => prev.map(n =>
                n.id === notification.id
                    ? { ...n, data: { ...n.data, status: 'accepted' }, is_read: true }
                    : n
            ));

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const success = await socialService.grantHistoryAccess(user.id, requesterId);
                    if (success) {
                        await notificationService.updateInvitationStatus(notification, 'accepted');
                        alert(`¡Acceso al historial concedido a @${notification.data?.requester_username || 'tu aliado'}!`);
                    } else {
                        alert("Error al conceder acceso.");
                        loadNotifications();
                    }
                }
            } catch (error) {
                console.error("Error accepting history request:", error);
                loadNotifications();
            }
            return;
        }

        if (notification.data?.type === 'request_routines') {
            const requesterId = notification.data?.requester_id;
            if (!requesterId) return;

            setSharingRoutinesRequester({
                id: requesterId,
                username: notification.data?.requester_username || 'guerrero',
                notification
            });
            return;
        }
        const senderId = notification.data?.sender_id;
        if (!senderId) return;

        setNotifications(prev => prev.map(n =>
            n.id === notification.id
                ? { ...n, data: { ...n.data, status: 'accepted' }, is_read: true }
                : n
        ));

        try {
            await notificationService.updateInvitationStatus(notification, 'accepted');
            const chatId = await notificationService.acceptInvitation(senderId);
            if (chatId) {
                navigate(`/chat/${chatId}`);
            }
        } catch (error) {
            console.error("Error accepting invite:", error);
        }
    };

    const handleReject = async (notification: Notification) => {
        setNotifications(prev => prev.map(n =>
            n.id === notification.id
                ? { ...n, data: { ...n.data, status: 'rejected' }, is_read: true }
                : n
        ));

        try {
            await notificationService.updateInvitationStatus(notification, 'rejected');
        } catch (error) {
            console.error("Error rejecting invite:", error);
        }
    };

    const renderNotification = (n: ExtendedNotification) => {
        const status = n.data?.status;

        if (n.type === 'system' && (n.data?.status === 'started' || n.data?.status === 'finished')) {
            const isLive = n.data.status === 'started';
            const gymLabel = n.data.gym_name || 'un Gimnasio';
            const muscles = n.data.muscles || [];
            const duration = n.data.duration;
            const volume = n.data.volume;

            return (
                <div 
                    key={n.id} 
                    className={`bg-black/40 backdrop-blur-2xl border rounded-[2rem] p-5 shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition-all group my-3 text-left ${isLive ? 'border-red-500/20 hover:border-red-500/40 bg-red-950/5' : 'border-green-500/20 hover:border-green-500/40 bg-green-950/5'}`}
                >
                    <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                            <div className={`absolute -inset-1 rounded-full blur-md opacity-0 group-hover:opacity-20 transition-opacity ${isLive ? 'bg-red-500' : 'bg-green-500'}`}></div>
                            <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-neutral-800 to-neutral-600">
                                <div 
                                    className="w-full h-full rounded-full bg-neutral-900 overflow-hidden flex items-center justify-center border border-white/10 relative cursor-pointer" 
                                    onClick={() => {
                                        if (n.data?.sender_id) {
                                            setSelectedPlayer({
                                                id: n.data.sender_id,
                                                username: n.sender?.username || n.data?.sender_name || 'Guerrero',
                                                avatar_url: n.sender?.avatar_url || '',
                                                rank: 999,
                                                gym_name: n.data?.gym_name || 'un Gimnasio'
                                            });
                                        }
                                    }}
                                >
                                    {n.sender?.avatar_url ? (
                                        <FadeInImage src={n.sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center">
                                            <span className="text-lg font-black text-gym-primary italic">
                                                {n.sender?.username?.[0].toUpperCase() || 'G'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-black shadow-lg ${isLive ? 'bg-red-500 text-white animate-pulse' : 'bg-green-500 text-black'}`}>
                                <Activity size={10} strokeWidth={3} />
                            </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col text-left">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className={`text-[9px] font-black italic uppercase tracking-wider px-2 py-0.5 rounded-full ${isLive ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                                    {isLive ? '🔴 EN VIVO' : '✅ COMPLETADO'}
                                </span>
                                <span className="text-[9px] font-bold text-neutral-600 shrink-0">
                                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            
                            <p className="text-xs font-bold leading-normal text-white mt-1">
                                <span 
                                    className="text-gym-primary font-black uppercase mr-1 cursor-pointer hover:underline" 
                                    onClick={() => {
                                        if (n.data?.sender_id) {
                                            setSelectedPlayer({
                                                id: n.data.sender_id,
                                                username: n.sender?.username || n.data?.sender_name || 'Guerrero',
                                                avatar_url: n.sender?.avatar_url || '',
                                                rank: 999,
                                                gym_name: n.data?.gym_name || 'un Gimnasio'
                                            });
                                        }
                                    }}
                                >
                                    @{n.sender?.username || n.data?.sender_name || 'Tu amigo'}
                                </span>
                                {isLive ? `comenzó a entrenar en ${gymLabel}` : `finalizó su entrenamiento en ${gymLabel}`}
                            </p>

                            <div 
                                onClick={() => {
                                    if (!isLive && n.data?.session_id) {
                                        navigate(`/history/${n.data.session_id}`);
                                    } else if (isLive) {
                                        toast.success("¡Este entrenamiento está en vivo ahora mismo!");
                                    }
                                }}
                                className={`mt-3 bg-black/30 border border-white/5 rounded-xl p-3 space-y-2 select-none ${(!isLive && n.data?.session_id) ? 'cursor-pointer hover:border-gym-primary/30 hover:bg-neutral-950/40 active:scale-[0.99] transition-all' : ''}`}
                            >
                                <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-bold uppercase">
                                    <MapPin size={10} className="text-gym-primary" />
                                    <span className="truncate">{gymLabel}</span>
                                </div>

                                {!isLive && (
                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/5 pt-2">
                                        {duration && (
                                            <div className="flex items-center gap-1 text-[10px] font-black text-blue-400 uppercase">
                                                ⏱️ {duration} MIN
                                            </div>
                                        )}
                                        {volume && volume > 0 && (
                                            <div className="flex items-center gap-1 text-[10px] font-black text-yellow-500 uppercase">
                                                💪 {volume.toLocaleString()} KG VOL
                                            </div>
                                        )}
                                    </div>
                                )}

                                {muscles.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {muscles.map((muscle: string, idx: number) => {
                                            const emojiMap: Record<string, string> = {
                                                'Pecho': '💪', 'Espalda': '🦅', 'Pierna': '🦵', 'Hombro': '🛡️',
                                                'Bíceps': '🔥', 'Tríceps': '⚡', 'Core': '🛡️', 'Cardio': '🏃'
                                            };
                                            const emoji = emojiMap[muscle] || '🏋️';
                                            return (
                                                <span key={idx} className="bg-neutral-800 border border-white/5 text-neutral-300 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                                                    {emoji} {muscle.toUpperCase()}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (n.type === 'system' && n.data?.type === 'routine_shared') {
            return (
                <SharedRoutineCard
                    key={n.id}
                    notification={n}
                    onActionComplete={loadNotifications}
                />
            );
        }

        if (n.type === 'system' && (n.data?.type === 'request_history' || n.data?.type === 'request_routines')) {
            const isHistory = n.data.type === 'request_history';
            const requesterId = n.data.requester_id;
            const requesterUsername = n.sender?.username || n.data.requester_username || 'guerrero';

            return (
                <div 
                    key={n.id} 
                    className={`bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-5 shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition-all group my-2 text-left ${status ? 'opacity-60 grayscale-[0.5]' : 'hover:border-gym-primary/30'}`}
                >
                    <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                            <div className="absolute -inset-1 bg-gym-primary rounded-full blur-md opacity-0 group-hover:opacity-20 transition-opacity"></div>
                            <div className={`w-16 h-16 rounded-full p-0.5 ${status ? 'bg-neutral-800' : 'bg-gradient-to-tr from-neutral-800 to-neutral-600'}`}>
                                <div 
                                    className="w-full h-full rounded-full bg-neutral-900 overflow-hidden flex items-center justify-center border border-white/10 relative cursor-pointer" 
                                    onClick={() => {
                                        if (requesterId) {
                                            setSelectedPlayer({
                                                id: requesterId,
                                                username: requesterUsername,
                                                avatar_url: n.sender?.avatar_url || '',
                                                rank: 999,
                                                gym_name: n.data?.gym_name || 'un Gimnasio'
                                            });
                                        }
                                    }}
                                >
                                    {n.sender?.avatar_url ? (
                                        <FadeInImage src={n.sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center">
                                            <span className="text-xl font-black text-gym-primary italic">
                                                {requesterUsername[0].toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {!status && (
                                <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-black shadow-lg ${isHistory ? 'bg-yellow-500 text-black' : 'bg-gym-primary text-black'}`}>
                                    {isHistory ? <History size={10} strokeWidth={3} /> : <Swords size={10} strokeWidth={3} />}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col text-left">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <h3 className={`text-xs font-black italic uppercase tracking-tight truncate ${status ? 'text-neutral-500' : 'text-gym-primary'}`}>
                                    {isHistory ? 'SOLICITUD DE HISTORIAL 📈' : 'SOLICITUD DE RUTINAS ⚔️'}
                                </h3>
                                <span className="text-[9px] font-bold text-neutral-600 shrink-0">
                                    {new Date(n.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <p className={`text-xs font-medium leading-relaxed ${status ? 'text-neutral-600' : 'text-neutral-400'}`}>
                                <span 
                                    className={`${status ? 'text-neutral-500' : 'text-white'} font-black uppercase mr-1 cursor-pointer hover:text-gym-primary`} 
                                    onClick={() => {
                                        if (requesterId) {
                                            setSelectedPlayer({
                                                id: requesterId,
                                                username: requesterUsername,
                                                avatar_url: n.sender?.avatar_url || '',
                                                rank: 999,
                                                gym_name: n.data?.gym_name || 'un Gimnasio'
                                            });
                                        }
                                    }}
                                >
                                    @{requesterUsername}
                                </span> 
                                {isHistory 
                                    ? 'te ha solicitado acceso a tu historial completo de entrenamientos.' 
                                    : 'te ha solicitado acceso a tus rutinas de entrenamiento privadas.'
                                }
                            </p>
                        </div>
                    </div>

                    <div className="mt-6">
                        {status === 'accepted' ? (
                            <div className="w-full py-3 bg-gym-primary/10 border border-gym-primary/20 rounded-2xl flex items-center justify-center gap-2 text-gym-primary font-black text-[10px] uppercase tracking-widest">
                                <Check size={14} strokeWidth={3} /> ACCESO CONCEDIDO
                            </div>
                        ) : status === 'rejected' ? (
                            <div className="w-full py-3 bg-neutral-900/50 border border-neutral-800 rounded-2xl flex items-center justify-center gap-2 text-neutral-600 font-black text-[10px] uppercase tracking-widest">
                                <X size={14} strokeWidth={3} /> SOLICITUD RECHAZADA
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleReject(n)}
                                    className="flex-1 py-3 px-4 rounded-2xl bg-neutral-900 text-neutral-500 font-black text-[10px] uppercase tracking-widest border border-white/5 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <X size={14} />
                                    RECHAZAR
                                </button>
                                <button
                                    onClick={() => handleAccept(n)}
                                    className="flex-[1.5] py-3 px-4 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-gym-primary transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
                                >
                                    {isHistory ? (
                                        <>
                                            <History size={14} strokeWidth={2.5} />
                                            COMPARTIR HISTORIAL
                                        </>
                                    ) : (
                                        <>
                                            <Swords size={14} />
                                            COMPARTIR RUTINAS
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        // status is already declared at the top of renderNotification
        
        // Base layout for standard notifications (follower, gym_join, system)
        if (n.type !== 'invitation') {
            const targetUserId = n.data?.sender_id || n.data?.new_member_id || '';
            const targetUsername = n.sender?.username || n.data?.sender_name || 'Guerrero';

            return (
                <div key={n.id} className="flex items-center gap-4 py-3 group">
                    <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-neutral-800 to-neutral-600">
                            <div 
                                className="w-full h-full rounded-full bg-neutral-900 overflow-hidden flex items-center justify-center border border-white/10 relative cursor-pointer" 
                                onClick={() => {
                                    if (targetUserId) {
                                        setSelectedPlayer({
                                            id: targetUserId,
                                            username: targetUsername,
                                            avatar_url: n.sender?.avatar_url || '',
                                            rank: 999,
                                            gym_name: n.data?.gym_name || 'un Gimnasio'
                                        });
                                    }
                                }}
                            >
                                {n.sender?.avatar_url ? (
                                    <FadeInImage src={n.sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center">
                                        <span className="text-lg font-black text-gym-primary italic">
                                            {n.sender?.username?.[0].toUpperCase() || 'G'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {n.type === 'follower' && (
                            <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1 rounded-full border-2 border-black shadow-lg">
                                <UserPlus size={10} strokeWidth={3} />
                            </div>
                        )}
                        {n.type === 'gym_join' && (
                            <div className="absolute -bottom-1 -right-1 bg-red-500 text-white p-1 rounded-full border-2 border-black shadow-lg">
                                <MapPin size={10} strokeWidth={3} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs text-neutral-300 font-medium leading-tight">
                            <span 
                                className="font-bold text-white mr-1 cursor-pointer hover:text-gym-primary" 
                                onClick={() => {
                                    if (targetUserId) {
                                        setSelectedPlayer({
                                            id: targetUserId,
                                            username: targetUsername,
                                            avatar_url: n.sender?.avatar_url || '',
                                            rank: 999,
                                            gym_name: n.data?.gym_name || 'un Gimnasio'
                                        });
                                    }
                                }}
                            >
                                {n.sender?.username || n.data?.sender_name || 'Alguien'}
                            </span>
                            {n.type === 'follower' && 'ha comenzado a seguirte.'}
                            {n.type === 'gym_join' && `se ha unido a tu sede.`}
                            {n.type === 'system' && n.message}
                        </p>
                        <span className="text-[10px] text-neutral-600 font-bold mt-0.5 block">{new Date(n.created_at).toLocaleDateString()}</span>
                    </div>
                    {n.type === 'follower' && (
                        <button 
                            onClick={() => {
                                if (targetUserId) {
                                    setSelectedPlayer({
                                        id: targetUserId,
                                        username: targetUsername,
                                        avatar_url: n.sender?.avatar_url || '',
                                        rank: 999,
                                        gym_name: n.data?.gym_name || 'un Gimnasio'
                                    });
                                }
                            }} 
                            className="shrink-0 bg-neutral-900 border border-white/10 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl hover:bg-white/10 transition-colors"
                        >
                            Ver Perfil
                        </button>
                    )}
                    {n.type === 'gym_join' && (
                        <button onClick={() => navigate(`/territory/${n.data?.gym_id}`)} className="shrink-0 bg-gym-primary/20 text-gym-primary border border-gym-primary/30 text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl hover:bg-gym-primary hover:text-black transition-colors">
                            Ranking
                        </button>
                    )}
                </div>
            );
        }

        // Render for invitations (matches)
        return (
            <div 
                key={n.id} 
                className={`bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-5 shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition-all group my-2 ${status ? 'opacity-60 grayscale-[0.5]' : 'hover:border-gym-primary/30'}`}
            >
                <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                        <div className="absolute -inset-1 bg-gym-primary rounded-full blur-md opacity-0 group-hover:opacity-20 transition-opacity"></div>
                        <div className={`w-16 h-16 rounded-full p-0.5 ${status ? 'bg-neutral-800' : 'bg-gradient-to-tr from-neutral-800 to-neutral-600'}`}>
                            <div 
                                className="w-full h-full rounded-full bg-neutral-900 overflow-hidden flex items-center justify-center border border-white/10 relative cursor-pointer" 
                                onClick={() => {
                                    if (n.data?.sender_id) {
                                        setSelectedPlayer({
                                            id: n.data.sender_id,
                                            username: n.sender?.username || 'Guerrero',
                                            avatar_url: n.sender?.avatar_url || '',
                                            rank: 999,
                                            gym_name: n.data?.gym_name || 'un Gimnasio'
                                        });
                                    }
                                }}
                            >
                                {n.sender?.avatar_url ? (
                                    <FadeInImage src={n.sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center">
                                        <span className="text-xl font-black text-gym-primary italic">
                                            {n.sender?.username?.[0].toUpperCase() || 'G'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {!status && (
                            <div className="absolute -bottom-1 -right-1 bg-gym-primary text-black p-1 rounded-full border-2 border-black shadow-lg">
                                <Zap size={10} fill="currentColor" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <h3 className={`text-xs font-black italic uppercase tracking-tight truncate ${status ? 'text-neutral-500' : 'text-white'}`}>
                                DESAFÍO DE ENTRENAMIENTO
                            </h3>
                            <span className="text-[9px] font-bold text-neutral-600 shrink-0">
                                {new Date(n.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <p className={`text-xs font-medium leading-relaxed ${status ? 'text-neutral-600' : 'text-neutral-400'}`}>
                            <span 
                                className={`${status ? 'text-neutral-500' : 'text-gym-primary'} font-black uppercase italic mr-1 cursor-pointer`} 
                                onClick={() => {
                                    if (n.data?.sender_id) {
                                        setSelectedPlayer({
                                            id: n.data.sender_id,
                                            username: n.sender?.username || 'Guerrero',
                                            avatar_url: n.sender?.avatar_url || '',
                                            rank: 999,
                                            gym_name: n.data?.gym_name || 'un Gimnasio'
                                        });
                                    }
                                }}
                            >
                                @{n.sender?.username || 'guerrero'}
                            </span> 
                            te ha enviado un reto de gimnasio. ¿Entrenamos?
                        </p>
                    </div>
                </div>

                <div className="mt-6">
                    {status === 'accepted' ? (
                        <div className="w-full py-3 bg-gym-primary/10 border border-gym-primary/20 rounded-2xl flex items-center justify-center gap-2 text-gym-primary font-black text-[10px] uppercase tracking-widest">
                            <Check size={14} strokeWidth={3} /> RETO ACEPTADO
                        </div>
                    ) : status === 'rejected' ? (
                        <div className="w-full py-3 bg-neutral-900/50 border border-neutral-800 rounded-2xl flex items-center justify-center gap-2 text-neutral-600 font-black text-[10px] uppercase tracking-widest">
                            <X size={14} strokeWidth={3} /> RETO IGNORADO
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleReject(n)}
                                className="flex-1 py-3 px-4 rounded-2xl bg-neutral-900 text-neutral-500 font-black text-[10px] uppercase tracking-widest border border-white/5 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <X size={14} />
                                IGNORAR
                            </button>
                            <button
                                onClick={() => handleAccept(n)}
                                className="flex-[1.5] py-3 px-4 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-gym-primary transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
                            >
                                <Zap size={14} fill="currentColor" />
                                ACEPTAR RETO
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const { today, thisWeek, earlier } = groupNotifications(notifications);

    return (
        <div className="flex-1 flex flex-col bg-transparent pb-20">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-xl border-b border-white/5 px-4 py-4 flex items-center gap-3">
                <h1 className="text-xl font-black italic uppercase text-white tracking-widest flex items-center gap-2">
                    <Bell size={20} className="text-gym-primary" />
                    Notificaciones
                </h1>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-neutral-500 gap-3">
                        <div className="w-8 h-8 border-2 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Cargando...</span>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-20 h-20 bg-neutral-900 rounded-[2.5rem] flex items-center justify-center mb-6 text-neutral-700">
                            <Bell size={40} />
                        </div>
                        <h3 className="text-xl font-black text-white italic mb-2 uppercase tracking-tighter">SIN ACTIVIDAD</h3>
                        <p className="text-xs text-neutral-500 max-w-xs font-medium">Cuando interactúes con otros guerreros, tus notificaciones aparecerán aquí.</p>
                        <button onClick={() => navigate('/radar')} className="mt-8 bg-white text-black px-8 py-3 rounded-2xl font-black text-sm tracking-tighter hover:bg-gym-primary transition-all active:scale-95 shadow-xl">
                            IR AL RADAR
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 max-w-2xl mx-auto w-full">
                        {today.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-sm font-black text-white px-2 mb-4">Hoy</h2>
                                <div className="flex flex-col gap-2">
                                    {today.map(renderNotification)}
                                </div>
                            </div>
                        )}
                        {thisWeek.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-sm font-black text-white px-2 mb-4">Esta semana</h2>
                                <div className="flex flex-col gap-2">
                                    {thisWeek.map(renderNotification)}
                                </div>
                            </div>
                        )}
                        {earlier.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-sm font-black text-white px-2 mb-4">Anteriores</h2>
                                <div className="flex flex-col gap-2">
                                    {earlier.map(renderNotification)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {sharingRoutinesRequester && currentUser && (
                <ShareRoutinesToUserModal
                    userId={currentUser.id}
                    requesterId={sharingRoutinesRequester.id}
                    requesterUsername={sharingRoutinesRequester.username}
                    onClose={() => setSharingRoutinesRequester(null)}
                    onSuccess={async () => {
                        await notificationService.updateInvitationStatus(sharingRoutinesRequester.notification, 'accepted');
                        setSharingRoutinesRequester(null);
                        loadNotifications();
                    }}
                />
            )}

            {selectedPlayer && (
                <PlayerProfileModal 
                    player={selectedPlayer}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}
        </div>
    );
};
