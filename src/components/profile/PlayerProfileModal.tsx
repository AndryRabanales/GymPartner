import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Swords, MapPin, UserPlus, UserCheck, Star, ExternalLink, Lock, Calendar, Clock, Dumbbell, History, Loader, Activity } from 'lucide-react';
import { FeedViewerOverlay } from '../social/FeedViewerOverlay';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/UserService';
import { socialService, type Post } from '../../services/SocialService';
import { RoutineViewModal } from './RoutineViewModal';
import { useBottomNav } from '../../context/BottomNavContext';
import { cloudinaryService } from '../../services/CloudinaryService';
import { notificationService } from '../../services/NotificationService';
import { supabase } from '../../lib/supabase';
import { workoutService } from '../../services/WorkoutService';

interface PlayerProfileModalProps {
    player: {
        id: string;
        username: string;
        avatar_url: string;
        xp?: number;
        rank: number;
        gym_name?: string;
        banner_url?: string;
        featured_routine_id?: string | null;
    };
    onClose: () => void;
    onFollowToggle?: (newIsFollowing: boolean) => void;
}

const isDefaultBio = (bio?: string | null) => {
    if (!bio) return true;
    const clean = bio.trim().toLowerCase();
    return (
        clean === '¡hola! soy un nuevo atleta en ginx.' ||
        clean === 'hola! soy un nuevo atleta en ginx.' ||
        clean === 'hola soy un nuevo atleta en ginx.' ||
        clean.includes('entrenando duro para subir de rango') ||
        clean.includes('entrenando para alcanzar el siguiente nivel') ||
        clean === 'entrenando duro en ginx.'
    );
};

export const PlayerProfileModal = ({ player, onClose, onFollowToggle }: PlayerProfileModalProps) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { hideBottomNav, showBottomNav } = useBottomNav();

    // Social State
    const [stats, setStats] = useState<any>({ followersCount: 0, followingCount: 0, totalLikes: 0, workoutsCount: 0 });
    const [viewedPostId, setViewedPostId] = useState<string | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    // HIDDEN: Community Features - defaulting to routines
    const [activeTab, setActiveTab] = useState<'grid' | 'reels' | 'routines' | 'history'>('routines');

    // Content State
    const [posts, setPosts] = useState<Post[]>([]);
    const [publicRoutines, setPublicRoutines] = useState<any[]>([]);
    const [publicGyms, setPublicGyms] = useState<any[]>([]);
    const [viewRoutine, setViewRoutine] = useState<any | null>(null);
    const [copying, setCopying] = useState(false);

    // History Sharing State
    const [hasHistoryAccess, setHasHistoryAccess] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [historyRequestSent, setHistoryRequestSent] = useState(false);
    const [requestingHistory, setRequestingHistory] = useState(false);
    const [routinesRequestSent, setRoutinesRequestSent] = useState(false);
    const [requestingRoutines, setRequestingRoutines] = useState(false);

    // Live Workout Tracking States
    const [liveSession, setLiveSession] = useState<any | null>(null);
    const [liveGymName, setLiveGymName] = useState<string>('');
    const [liveDuration, setLiveDuration] = useState<string>('00:00');

    // Fetch Live Training Status (always checked for live social features)
    useEffect(() => {
        const checkLiveSession = async () => {
            try {
                const { data: activeSession } = await workoutService.getActiveSession(player.id);
                if (activeSession) {
                    setLiveSession(activeSession);
                    if (activeSession.gym_id) {
                        const { data: gym } = await supabase
                            .from('gyms')
                            .select('name')
                            .eq('id', activeSession.gym_id)
                            .maybeSingle();
                        if (gym?.name) {
                            setLiveGymName(gym.name);
                        }
                    }
                } else {
                    setLiveSession(null);
                    setLiveGymName('');
                }
            } catch (err) {
                console.error("Error checking live session in PlayerProfileModal:", err);
            }
        };

        checkLiveSession();
    }, [player.id]);

    // Live Session Timer tick
    useEffect(() => {
        if (!liveSession?.started_at) return;

        const tick = () => {
            const start = new Date(liveSession.started_at).getTime();
            const now = Date.now();
            const diff = Math.max(0, now - start);
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            if (hours > 0) {
                setLiveDuration(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            } else {
                setLiveDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }
        };

        const interval = setInterval(tick, 1000);
        tick();
        return () => clearInterval(interval);
    }, [liveSession]);

    // Supabase Realtime channel for player session updates
    useEffect(() => {
        console.log("⚡ Subscribing to player workout session updates...", player.id);
        const channel = supabase
            .channel(`player-session-realtime:${player.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'workout_sessions',
                filter: `user_id=eq.${player.id}`
            }, async (payload) => {
                console.log("⚡ Player session real-time update in PlayerProfileModal:", payload);
                try {
                    const { data: activeSession } = await workoutService.getActiveSession(player.id);
                    if (activeSession) {
                        setLiveSession(activeSession);
                        if (activeSession.gym_id) {
                            const { data: gym } = await supabase
                                .from('gyms')
                                .select('name')
                                .eq('id', activeSession.gym_id)
                                .maybeSingle();
                            if (gym?.name) {
                                setLiveGymName(gym.name);
                            }
                        }
                    } else {
                        setLiveSession(null);
                        setLiveGymName('');
                    }
                } catch (err) {
                    console.error("Error updating live session in real-time:", err);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [player.id]);

    // Hide BottomNav when modal opens, show when it closes
    useEffect(() => {
        hideBottomNav();
        return () => {
            showBottomNav();
        };
    }, [hideBottomNav, showBottomNav]);

    const [customSettings, setCustomSettings] = useState<any>(null);
    const [loadingAccess, setLoadingAccess] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedDaySessions, setSelectedDaySessions] = useState<any[]>([]);
    const gridScrollRef = useRef<HTMLDivElement>(null);

    // Scroll contribution grid to rightmost end on load/tab switch
    useEffect(() => {
        if (activeTab === 'history' && gridScrollRef.current) {
            // Delay slightly to ensure layout is fully rendered
            const timer = setTimeout(() => {
                if (gridScrollRef.current) {
                    gridScrollRef.current.scrollLeft = gridScrollRef.current.scrollWidth;
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [activeTab, historyLoading]);


    // Initial Load
    useEffect(() => {
        const init = async () => {
            setLoadingAccess(true);
            // 1. Fetch Social Stats
            const s = await socialService.getProfileStats(player.id);
            setStats(s);

            // 2. Fetch Player Profile custom settings
            try {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('custom_settings')
                    .eq('id', player.id)
                    .single();
                if (profileData) {
                    setCustomSettings(profileData.custom_settings);
                }
            } catch (err) {
                console.error("Error fetching player custom settings:", err);
            }

            // 3. Check Follow Status
            if (user && user.id !== player.id) {
                const following = await socialService.getFollowStatus(user.id, player.id);
                setIsFollowing(following);
            }
        };
        init();
    }, [player, user]);

    // Check History Access dynamically
    useEffect(() => {
        const checkAccess = async () => {
            if (!user) return;
            if (user.id === player.id) {
                setHasHistoryAccess(true);
                setLoadingAccess(false);
                return;
            }

            try {
                // If history is public, grant immediate access
                if (customSettings?.is_history_public === true) {
                    setHasHistoryAccess(true);
                } else {
                    const access = await socialService.checkHistoryAccess(player.id, user.id);
                    setHasHistoryAccess(access);
                }

                // Check Pending History Request
                const { data: histReq } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', player.id)
                    .eq('type', 'system')
                    .eq('data->>type', 'request_history')
                    .eq('data->>requester_id', user.id)
                    .maybeSingle();

                setHistoryRequestSent(!!histReq);

                // Check Pending Routines Request
                const { data: routReq } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', player.id)
                    .eq('type', 'system')
                    .eq('data->>type', 'request_routines')
                    .eq('data->>requester_id', user.id)
                    .maybeSingle();

                setRoutinesRequestSent(!!routReq);

            } catch (err) {
                console.error("Error evaluating history access in PlayerProfileModal:", err);
            } finally {
                setLoadingAccess(false);
            }
        };

        checkAccess();
    }, [player.id, user, customSettings]);

    // Fetch Posts/Routines when tab changes
    useEffect(() => {
        if (activeTab === 'grid') {
            socialService.getUserPosts(player.id, undefined, user?.id).then(setPosts);
        } else if (activeTab === 'reels') {
            socialService.getUserPosts(player.id, 'video', user?.id).then(setPosts);
        } else if (activeTab === 'routines') {
            userService.getUserPublicRoutines(player.id, user?.id).then(setPublicRoutines);
            userService.getUserGyms(player.id).then(gyms => setPublicGyms(gyms.sort((a, b) => (a.is_home_base ? -1 : 1))));
        } else if (activeTab === 'history') {
            if (hasHistoryAccess) {
                setHistoryLoading(true);
                supabase
                    .from('workout_sessions')
                    .select(`
                        id,
                        started_at,
                        end_time,
                        gyms ( name, id ),
                        workout_logs (
                            weight_kg,
                            reps,
                            sets,
                            time,
                            distance,
                            metrics_data,
                            category_snapshot,
                            equipment:exercise_id ( target_muscle_group, name )
                        )
                    `)
                    .eq('user_id', player.id)
                    .not('end_time', 'is', null)
                    .order('started_at', { ascending: false })
                    .then(({ data, error }) => {
                        if (error) {
                            console.error("Error loading player history:", error);
                        } else {
                            const mapped = (data || []).map((s: any) => {
                                const muscleSet = new Set<string>();
                                let vol = 0;
                                
                                const mapping: Record<string, string> = {
                                    'chest': 'Pecho', 'pectoral': 'Pecho', 'pectorales': 'Pecho', 'pecho': 'Pecho',
                                    'back': 'Espalda', 'dorsales': 'Espalda', 'espalda': 'Espalda',
                                    'legs': 'Pierna', 'cuádriceps': 'Pierna', 'isquios': 'Pierna', 'glúteos': 'Pierna', 'pierna': 'Pierna', 'calves': 'Pierna', 'pantorrillas': 'Pierna', 'glutes': 'Pierna',
                                    'shoulders': 'Hombro', 'deltoides': 'Hombro', 'hombro': 'Hombro',
                                    'biceps': 'Bíceps', 'bíceps': 'Bíceps',
                                    'triceps': 'Tríceps', 'tríceps': 'Tríceps',
                                    'abs': 'Core', 'abdominales': 'Core', 'core': 'Core',
                                    'cardio': 'Cardio'
                                };
                                const VALID_MUSCLES = ['Pecho', 'Espalda', 'Pierna', 'Hombro', 'Bíceps', 'Tríceps', 'Core', 'Cardio'];
                                const IGNORED_TAGS = ['free_weight', 'strength_machine', 'cable', 'accessory', 'custom', 'other', 'unknown'];

                                s.workout_logs?.forEach((l: any) => {
                                    let category = l.category_snapshot;
                                    const catLower = category ? category.toLowerCase() : '';
                                    if (!category || IGNORED_TAGS.includes(catLower)) {
                                        category = l.equipment?.target_muscle_group;
                                    }
                                    const currentCatLower = category ? category.toLowerCase() : '';
                                    if ((!category || IGNORED_TAGS.includes(currentCatLower)) && l.equipment?.name) {
                                        const name = l.equipment.name.toLowerCase();
                                        if (name.includes('jalon') || name.includes('remo') || name.includes('dominadas') || name.includes('polea') || name.includes('pull')) category = 'Espalda';
                                        else if (name.includes('press') || name.includes('banco') || name.includes('pec') || name.includes('cruce') || name.includes('chest')) category = 'Pecho';
                                        else if (name.includes('sentadilla') || name.includes('prensa') || name.includes('extension') || name.includes('curl femoral') || name.includes('zancada') || name.includes('hack') || name.includes('leg') || name.includes('squat')) category = 'Pierna';
                                        else if (name.includes('militar') || name.includes('lateral') || name.includes('hombro') || name.includes('shoulder')) category = 'Hombro';
                                        else if (name.includes('biceps') || name.includes('bíceps') || name.includes('curl')) category = 'Bíceps';
                                        else if (name.includes('triceps') || name.includes('tríceps') || name.includes('copa') || name.includes('fondos')) category = 'Tríceps';
                                        else if (name.includes('abs') || name.includes('crunch') || name.includes('plancha') || name.includes('core')) category = 'Core';
                                        else if (name.includes('correr') || name.includes('elíptica') || name.includes('bici') || name.includes('cardio')) category = 'Cardio';
                                    }
                                    if (category) {
                                        const normalized = mapping[category.toLowerCase()] || category;
                                        const standard = VALID_MUSCLES.find(m => m.toLowerCase() === normalized.toLowerCase());
                                        if (standard) muscleSet.add(standard);
                                    }

                                    const sets = l.sets || 1;
                                    if (l.weight_kg > 0) vol += (l.weight_kg * l.reps * sets);
                                    else if (l.reps > 0) vol += (l.reps * 60 * sets * 0.5);
                                    else if ((l.time || l.metrics_data?.time) > 0) vol += ((l.time || l.metrics_data?.time) * 1.5);
                                    else if ((l.distance || l.metrics_data?.distance) > 0) vol += ((l.distance || l.metrics_data?.distance) * 0.5);
                                });

                                const start = new Date(s.started_at).getTime();
                                const end = new Date(s.end_time).getTime();
                                const duration = Math.round((end - start) / (1000 * 60));

                                return {
                                    id: s.id,
                                    gym_name: s.gyms?.name || 'Gimnasio Desconocido',
                                    started_at: s.started_at,
                                    duration_minutes: duration,
                                    total_volume: vol,
                                    muscles_trained: Array.from(muscleSet)
                                };
                            });
                            setHistory(mapped);
                        }
                        setHistoryLoading(false);
                    });
            }
        }
    }, [activeTab, player.id, user?.id, hasHistoryAccess]);

    const handleFollowToggle = async () => {
        if (!user) return;

        // Optimistic UI
        const newStatus = !isFollowing;
        setIsFollowing(newStatus);
        setStats(prev => ({ ...prev, followersCount: prev.followersCount + (newStatus ? 1 : -1) }));

        try {
            if (newStatus) {
                const response = await socialService.followUser(user.id, player.id);
                if (response?.error) throw response.error;
            } else {
                const response = await socialService.unfollowUser(user.id, player.id);
                if (response?.error) throw response.error;
                alert(`Has dejado de seguir a @${player.username} con éxito.`);
            }
            
            // Notify parent page about the follow status change
            if (onFollowToggle) {
                onFollowToggle(newStatus);
            }
        } catch (error: any) {
            console.error("Error updating follow status:", error);
            // Revert UI on failure
            setIsFollowing(!newStatus);
            setStats(prev => ({ ...prev, followersCount: prev.followersCount + (newStatus ? -1 : 1) }));
            alert("No se pudo actualizar el estado de seguimiento en el servidor. Revisa tu conexión.");
        }
    };


    const handleCopyRoutine = async () => {
        if (!user || !viewRoutine) return;
        setCopying(true);
        try {
            await userService.copyRoutine(viewRoutine.id, user.id);
            alert('¡Estrategia robada con éxito! Ahora está en tu arsenal.');
            setViewRoutine(null);
        } catch (error) {
            console.error('Error copying routine:', error);
            alert('Error al copiar la rutina.');
        } finally {
            setCopying(false);
        }
    };

    const handleRequestHistory = async () => {
        if (!user || requestingHistory) return;
        setRequestingHistory(true);
        try {
            const success = await notificationService.createNotification(player.id, {
                type: 'system',
                title: '📥 SOLICITUD DE HISTORIAL',
                content: `@${user.user_metadata?.username || user.username || 'Un guerrero'} te ha solicitado acceso a tu historial de entrenamientos.`,
                data: {
                    type: 'request_history',
                    requester_id: user.id,
                    requester_username: user.user_metadata?.username || user.username || 'Un guerrero'
                }
            });
            if (success) {
                setHistoryRequestSent(true);
                alert("¡Solicitud de acceso al historial enviada exitosamente! Se le ha notificado a tu aliado.");
            } else {
                alert("Error al enviar la solicitud.");
            }
        } catch (err) {
            console.error("Error requesting history access:", err);
            alert("Error al procesar la solicitud.");
        } finally {
            setRequestingHistory(false);
        }
    };

    const handleRequestRoutines = async () => {
        if (!user || requestingRoutines) return;
        setRequestingRoutines(true);
        try {
            const success = await notificationService.createNotification(player.id, {
                type: 'system',
                title: '📥 SOLICITUD DE RUTINAS',
                content: `@${user.user_metadata?.username || user.username || 'Un guerrero'} te ha solicitado acceso a tus rutinas privadas.`,
                data: {
                    type: 'request_routines',
                    requester_id: user.id,
                    requester_username: user.user_metadata?.username || user.username || 'Un guerrero'
                }
            });
            if (success) {
                setRoutinesRequestSent(true);
                alert("¡Solicitud de acceso a rutinas enviada exitosamente! Se le ha notificado a tu aliado.");
            } else {
                alert("Error al enviar la solicitud.");
            }
        } catch (err) {
            console.error("Error requesting routines access:", err);
            alert("Error al procesar la solicitud.");
        } finally {
            setRequestingRoutines(false);
        }
    };

    // Generate GitHub-style contribution data (last 24 weeks)
    const getContributionData = () => {
        const today = new Date();
        const endOfWeek = new Date(today);
        // Align to the end of the current week (Saturday)
        endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
        
        const days: Date[] = [];
        const totalDays = 24 * 7; // 24 weeks
        
        const startDate = new Date(endOfWeek);
        startDate.setDate(endOfWeek.getDate() - totalDays + 1);
        
        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            days.push(d);
        }
        
        const weeks: Date[][] = [];
        for (let i = 0; i < days.length; i += 7) {
            weeks.push(days.slice(i, i + 7));
        }
        
        return { weeks };
    };

    const { weeks } = getContributionData();

    // Map sessions by date (YYYY-MM-DD)
    const sessionsByDate: Record<string, any[]> = {};
    history.forEach(session => {
        if (!session.started_at) return;
        const dateStr = new Date(session.started_at).toISOString().split('T')[0];
        if (!sessionsByDate[dateStr]) {
            sessionsByDate[dateStr] = [];
        }
        sessionsByDate[dateStr].push(session);
    });

    // Parse real-time exercises from the notes column during live workout
    let liveExercises: any[] = [];
    if (liveSession?.notes) {
        try {
            const parsed = JSON.parse(liveSession.notes);
            if (parsed && Array.isArray(parsed.active_exercises)) {
                liveExercises = parsed.active_exercises;
            }
        } catch (e) {
            // Not JSON or other notes, ignore
        }
    }

    return (

        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-end md:justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-neutral-900 border-l md:border border-neutral-800 w-full md:max-w-sm h-full md:h-auto md:rounded-3xl overflow-hidden relative shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col md:max-h-[90vh]">

                {/* Close Button (Fixed) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 bg-black/50 text-white p-1 rounded-full hover:bg-black/80 transition-colors z-50"
                >
                    <X size={20} />
                </button>

                {/* Scrollable Content (Banner matches scroll) */}
                <div className="overflow-y-auto flex-1 custom-scrollbar w-full">

                    {/* Header / Banner */}
                    <div className="h-32 bg-neutral-800 relative">
                        {(customSettings?.banner_url || player.banner_url) ? (
                            <img 
                                src={cloudinaryService.getOptimizedImageUrl(customSettings?.banner_url || player.banner_url, { width: 400, height: 150 })} 
                                alt="Banner" 
                                className="w-full h-full object-cover opacity-60" 
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-b from-neutral-800 to-neutral-900" />
                        )}


                        {/* Rank Badge */}
                        <div className="absolute top-4 left-4 z-20">
                            {player.rank <= 3 ? (
                                <div className={`w-10 h-10 flex items-center justify-center font-black rounded-lg shadow-lg skew-x-[-10deg] border border-white/20 ${player.rank === 1 ? 'bg-yellow-500 text-black' :
                                    player.rank === 2 ? 'bg-slate-300 text-black' :
                                        'bg-orange-600 text-white'
                                    }`}>
                                    {player.rank}
                                </div>
                            ) : (
                                <div className="bg-black/60 backdrop-blur px-3 py-1 rounded-lg border border-white/10 text-xs font-bold text-white">
                                    #{player.rank}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="relative px-6 pb-6 flex flex-col items-center text-center">

                        {/* Avatar (Centered & Overlapping Banner) */}
                        <div className="-mt-16 mb-4 relative z-10 group">
                            <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl animate-pulse group-hover:bg-yellow-500/40 transition-all"></div>
                            <div className="w-32 h-32 rounded-full border-4 border-neutral-900 bg-neutral-800 overflow-hidden shadow-2xl relative">
                                <img 
                                    src={cloudinaryService.getOptimizedImageUrl(player.avatar_url || `https://ui-avatars.com/api/?name=${player.username}&background=random`, { width: 120, height: 120 })} 
                                    alt={player.username} 
                                    className="w-full h-full object-cover" 
                                />
                            </div>
                            {/* Rank Badge Integration (Optional small badge) */}
                            <div className="absolute bottom-0 right-0 bg-black/80 backdrop-blur border border-yellow-500/50 text-yellow-500 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg">
                                Guerrer@
                            </div>
                        </div>

                        {/* Name & Title */}
                        <div className="mb-6 space-y-1">
                            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-lg">
                                {player.username}
                            </h2>
                            <p className="text-xs text-neutral-400 font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-yellow-500"></span>
                                Atleta de Alto Rendimiento
                                <span className="w-1 h-1 rounded-full bg-yellow-500"></span>
                            </p>
                            {player.gym_name && (
                                <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 mt-2 bg-neutral-800/50 py-1 px-3 rounded-full mx-auto w-fit border border-white/5">
                                    <MapPin size={10} />
                                    <span>{player.gym_name}</span>
                                </div>
                            )}
                        </div>

                        {/* Live Workout Banner */}
                        {liveSession && (
                            <div className="w-[90%] max-w-sm bg-red-950/40 border border-red-500/30 rounded-2xl p-4 mb-6 shadow-[0_0_25px_rgba(239,68,68,0.2)] animate-pulse flex flex-col items-center select-none relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>
                                <div className="flex items-center gap-2 mb-2 relative z-10">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                    </span>
                                    <span className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] italic">🔴 EN VIVO - ENTRENANDO AHORA</span>
                                </div>
                                <div className="space-y-1.5 text-center relative z-10 w-full">
                                    {liveGymName && (
                                        <p className="text-xs font-black text-white uppercase tracking-wider flex items-center justify-center gap-1">
                                            <MapPin size={13} className="text-red-400 shrink-0" />
                                            {liveGymName}
                                        </p>
                                    )}
                                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                        ⏱️ DURACIÓN: <span className="text-red-400 font-mono text-sm font-black tracking-normal">{liveDuration}</span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Live Exercises Display */}
                        {liveSession && liveExercises.length > 0 && (
                            <div className="w-[90%] max-w-sm bg-neutral-900/60 border border-red-500/30 rounded-2xl p-4 mb-6 shadow-xl flex flex-col text-left">
                                <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                                    <div className="flex items-center gap-1.5">
                                        <Activity size={12} className="text-red-400 animate-pulse" />
                                        <span className="text-[10px] font-black text-white uppercase tracking-wider">EJERCICIOS SELECCIONADOS</span>
                                    </div>
                                    <span className="text-[9px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-black">
                                        {liveExercises.length}
                                    </span>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                    {liveExercises.map((ex: any, idx: number) => {
                                        const completedPct = ex.setsCount > 0 ? Math.round((ex.completedSetsCount / ex.setsCount) * 100) : 0;
                                        return (
                                            <div key={ex.id || idx} className="flex items-center justify-between gap-2 bg-white/[0.02] border border-white/5 p-2.5 rounded-xl hover:border-white/10 transition-colors">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-black text-white truncate uppercase tracking-tight">
                                                        {ex.equipmentName}
                                                    </p>
                                                    <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                                                        <span className="text-red-400/80">{ex.category.toUpperCase()}</span>
                                                        <span>•</span>
                                                        <span>{ex.setsCount} {ex.setsCount === 1 ? 'SERIE' : 'SERIES'}</span>
                                                    </p>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-2">
                                                    {ex.setsCount > 0 && (
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] font-mono font-black text-red-400">
                                                                {ex.completedSetsCount}/{ex.setsCount}
                                                            </span>
                                                            <div className="w-12 h-1 bg-neutral-800 rounded-full overflow-hidden mt-1">
                                                                <div 
                                                                    className="h-full bg-red-500 rounded-full transition-all duration-300"
                                                                    style={{ width: `${completedPct}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Social Stats Row */}
                        <div className="flex items-center justify-center gap-6 mb-8 w-full border-y border-white/5 py-4 bg-white/[0.02]">
                            <div className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform">
                                <span className="font-black text-xl text-white leading-none mb-1 group-hover:text-yellow-500 transition-colors">{stats.followersCount}</span>
                                <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">Seguidores</span>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform">
                                <span className="font-black text-xl text-white leading-none mb-1 group-hover:text-yellow-500 transition-colors">{stats.followingCount}</span>
                                <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">Siguiendo</span>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform">
                                <span className="font-black text-xl text-white leading-none mb-1 group-hover:text-yellow-500 transition-colors">{stats.workoutsCount || 0}</span>
                                <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">Entrenos</span>
                            </div>
                        </div>

                        {/* Bio Text */}
                        {customSettings?.description && !isDefaultBio(customSettings.description) && (
                            <div className="px-2 mb-6 -mt-2">
                                <p className="text-sm font-medium text-neutral-400 italic leading-relaxed text-center">
                                    "{customSettings.description}"
                                </p>
                            </div>
                        )}

                        {/* ACCESOS & PERMISOS PANEL */}
                        {user && user.id !== player.id && (
                            <div className="w-full bg-white/[0.03] backdrop-blur-md rounded-2xl border border-white/10 p-4 mb-6 space-y-3 shadow-xl">
                                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                                    <Lock className="text-gym-primary" size={14} />
                                    <h3 className="text-[10px] font-black text-white italic uppercase tracking-wider">
                                        Conexión & Permisos
                                    </h3>
                                </div>

                                {loadingAccess ? (
                                    <div className="py-2 flex items-center justify-center gap-2 text-neutral-500">
                                        <Loader className="animate-spin text-gym-primary" size={12} />
                                        <span className="text-[9px] font-bold uppercase tracking-wider animate-pulse">Sincronizando...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Historial Row */}
                                        <div className="flex items-center justify-between gap-3 bg-black/20 p-2.5 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-7 h-7 rounded bg-neutral-950 flex items-center justify-center shrink-0">
                                                    <History size={14} className="text-blue-400" />
                                                </div>
                                                <div className="text-left min-w-0">
                                                    <p className="text-[9px] font-black text-white uppercase tracking-wide truncate">Historial</p>
                                                    <p className="text-[7px] font-bold text-neutral-500 uppercase tracking-widest truncate">
                                                        {customSettings?.is_history_public ? '🔓 Público' : '🔒 Solo aliados'}
                                                    </p>
                                                </div>
                                            </div>

                                            {hasHistoryAccess ? (
                                                <div className="bg-green-500/10 border border-green-500/30 text-green-500 px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5 shrink-0">
                                                    Concedido ✅
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleRequestHistory}
                                                    disabled={historyRequestSent || requestingHistory}
                                                    className={`px-2 py-1.5 rounded text-[8px] font-black uppercase tracking-widest transition-all shrink-0 border flex items-center gap-0.5 ${
                                                        historyRequestSent
                                                            ? 'bg-neutral-850 border-neutral-800 text-neutral-500 cursor-not-allowed'
                                                            : 'bg-gym-primary hover:bg-yellow-400 text-black border-transparent shadow-[0_0_10px_rgba(229,255,0,0.1)] active:scale-95'
                                                    }`}
                                                >
                                                    {requestingHistory ? (
                                                        <Loader className="animate-spin" size={8} />
                                                    ) : historyRequestSent ? (
                                                        'Solicitado ⏳'
                                                    ) : (
                                                        'Solicitar 📈'
                                                    )}
                                                </button>
                                            )}
                                        </div>

                                        {/* Rutinas Row */}
                                        <div className="flex items-center justify-between gap-3 bg-black/20 p-2.5 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-7 h-7 rounded bg-neutral-950 flex items-center justify-center shrink-0">
                                                    <Swords size={14} className="text-yellow-500" />
                                                </div>
                                                <div className="text-left min-w-0">
                                                    <p className="text-[9px] font-black text-white uppercase tracking-wide truncate">Rutinas Arsenal</p>
                                                    <p className="text-[7px] font-bold text-neutral-500 uppercase tracking-widest truncate">
                                                        👁️ {publicRoutines.length} Públicas
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleRequestRoutines}
                                                disabled={routinesRequestSent || requestingRoutines}
                                                className={`px-2 py-1.5 rounded text-[8px] font-black uppercase tracking-widest transition-all shrink-0 border flex items-center gap-0.5 ${
                                                    routinesRequestSent
                                                        ? 'bg-neutral-850 border-neutral-800 text-neutral-500 cursor-not-allowed'
                                                        : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20 active:scale-95'
                                                }`}
                                            >
                                                {requestingRoutines ? (
                                                    <Loader className="animate-spin" size={8} />
                                                ) : routinesRequestSent ? (
                                                    'Solicitado ⏳'
                                                ) : (
                                                    'Solicitar 📥'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Follow Button - MOVED TO BOTTOM */}

                        {/* TABS SWITCHER */}
                        <div className="flex w-full border-b border-neutral-800 mb-4 sticky top-0 bg-neutral-900/95 backdrop-blur z-20 pt-2">
                            <button
                                onClick={() => setActiveTab('routines')}
                                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative ${activeTab === 'routines' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                <Swords size={18} className="mx-auto mb-1" />
                                Mazos
                                {activeTab === 'routines' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 shadow-[0_0_10px_#eab308]" />}
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative ${activeTab === 'history' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                <History size={18} className="mx-auto mb-1" />
                                Historial
                                {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 shadow-[0_0_10px_#eab308]" />}
                            </button>
                        </div>

                        {/* TAB CONTENT (Full Width) */}

                        {/* 3. ROUTINES TAB (Mazos) */}
                        {activeTab === 'routines' && (
                            <div className="grid grid-cols-1 gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300 w-full">
                                {publicRoutines.map(routine => (
                                    <div
                                        key={routine.id}
                                        onClick={() => setViewRoutine(routine)}
                                        className="bg-neutral-800 p-4 rounded-xl border border-white/5 flex items-center gap-4 cursor-pointer hover:bg-neutral-700 transition-colors"
                                    >
                                        <div className="w-12 h-12 bg-neutral-900 rounded-lg flex items-center justify-center text-2xl border border-white/5">
                                            <Swords size={20} className="text-gym-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <h3 className="font-bold text-white uppercase italic tracking-wider truncate">{routine.name}</h3>
                                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">{routine.exercises?.length || 0} Cartas</p>
                                        </div>
                                    </div>
                                ))}

                                {/* Request routines button */}
                                {customSettings?.is_history_public !== true && (
                                    <button
                                        onClick={handleRequestRoutines}
                                        disabled={routinesRequestSent || requestingRoutines}
                                        className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all mt-4 border flex items-center justify-center gap-2 ${
                                            routinesRequestSent
                                                ? 'bg-neutral-800 border-neutral-700 text-neutral-500 cursor-not-allowed'
                                                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20 active:scale-[0.98]'
                                        }`}
                                    >
                                        {requestingRoutines ? (
                                            <>
                                                <Loader className="animate-spin" size={14} />
                                                Enviando solicitud...
                                            </>
                                        ) : routinesRequestSent ? (
                                            "Solicitud de Rutinas Enviada ⏳"
                                        ) : (
                                            <>
                                                <Swords size={14} />
                                                📥 Solicitar Rutinas Privadas
                                            </>
                                        )}
                                    </button>
                                )}

                                {/* NEW: GYM PASSPORT SHOWCASE */}
                                {publicGyms.length > 0 && (
                                    <div className="mt-8 space-y-4">
                                        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                                            <Star className="text-yellow-500" size={16} />
                                            <h3 className="text-sm font-black text-white italic uppercase tracking-tighter">Bases & Mejores Fotos</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {publicGyms.map(gym => (
                                                <div
                                                    key={gym.gym_id}
                                                    className="relative h-24 rounded-xl overflow-hidden border border-white/5 shadow-lg group/gym"
                                                    style={{
                                                        backgroundImage: gym.custom_bg_url ? `url(${gym.custom_bg_url})` : undefined,
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center',
                                                        backgroundColor: gym.custom_color || '#171717'
                                                    }}
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                                    <div className="absolute bottom-2 left-3 right-3 flex justify-between items-end">
                                                        <div>
                                                            <h4 className={`font-black text-sm italic uppercase tracking-tight ${gym.is_home_base ? 'text-yellow-400' : 'text-white'}`}>
                                                                {gym.gym_name}
                                                            </h4>
                                                        </div>
                                                        {gym.is_home_base && (
                                                            <div className="bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                                                <Star size={8} fill="black" /> Base
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {publicRoutines.length === 0 && publicGyms.length === 0 && (
                                    <div className="py-12 flex flex-col items-center justify-center text-neutral-600 space-y-3 opacity-60">
                                        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center">
                                            <Swords size={24} />
                                        </div>
                                        <p className="text-sm font-bold uppercase tracking-wider">Sin mazos públicos</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 4. HISTORY TAB */}
                        {activeTab === 'history' && (
                            <div className="animate-in slide-in-from-bottom-2 fade-in duration-300 w-full space-y-4">
                                {hasHistoryAccess ? (
                                    historyLoading ? (
                                        <div className="py-12 flex flex-col items-center justify-center text-gym-primary gap-3 w-full">
                                            <Loader className="animate-spin" size={28} />
                                            <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Cargando bitácora...</span>
                                        </div>
                                    ) : history.length === 0 ? (
                                        <div className="py-12 flex flex-col items-center justify-center text-neutral-600 space-y-3 opacity-60 w-full">
                                            <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center">
                                                <Calendar size={24} />
                                            </div>
                                            <p className="text-sm font-bold uppercase tracking-wider">Historial Vacío</p>
                                            <p className="text-xs text-neutral-500 max-w-xs text-center">Este guerrero no ha completado entrenamientos aún.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 w-full text-left">
                                            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                                                <History className="text-gym-primary" size={16} />
                                                <h3 className="text-sm font-black text-white italic uppercase tracking-tighter">Bitácora de Actividad</h3>
                                            </div>

                                            {/* GitHub-style Heatmap Grid */}
                                            <div className="bg-neutral-800/40 border border-white/5 p-3 rounded-2xl w-full">
                                                <div className="flex items-center justify-between mb-2 px-1">
                                                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Entrenamientos Recientes</span>
                                                    <span className="text-[8px] font-bold text-gym-primary bg-gym-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        {history.length} completados
                                                    </span>
                                                </div>
                                                
                                                {/* Grid Container */}
                                                <div className="flex gap-1 overflow-x-auto pb-2 pt-1 custom-scrollbar justify-start" ref={gridScrollRef}>
                                                    {weeks.map((week, wIdx) => (
                                                        <div key={wIdx} className="flex flex-col gap-1 shrink-0">
                                                            {week.map((day, dIdx) => {
                                                                const dateStr = day.toISOString().split('T')[0];
                                                                const daySessions = sessionsByDate[dateStr] || [];
                                                                const count = daySessions.length;
                                                                
                                                                // Color codes matching gym-primary (neon yellow-green)
                                                                let bgClass = "bg-neutral-800/60 hover:bg-neutral-700/60";
                                                                if (count === 1) bgClass = "bg-yellow-500/20 hover:bg-yellow-500/35 border border-yellow-500/10";
                                                                if (count === 2) bgClass = "bg-yellow-500/50 hover:bg-yellow-500/65 border border-yellow-500/20";
                                                                if (count >= 3) bgClass = "bg-yellow-500 text-black shadow-[0_0_8px_rgba(234,179,8,0.4)] hover:scale-105 border border-white/20";
                                                                
                                                                const isSelected = selectedDate === dateStr;
                                                                const selectedBorder = isSelected ? "ring-2 ring-white scale-110 z-10" : "";
                                                                
                                                                return (
                                                                    <button
                                                                        key={dIdx}
                                                                        onClick={() => {
                                                                            if (count > 0) {
                                                                                setSelectedDate(dateStr);
                                                                                setSelectedDaySessions(daySessions);
                                                                            } else {
                                                                                setSelectedDate(null);
                                                                                setSelectedDaySessions([]);
                                                                            }
                                                                        }}
                                                                        className={`w-3 h-3 rounded-sm transition-all duration-150 relative shrink-0 ${bgClass} ${selectedBorder}`}
                                                                        title={`${day.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}: ${count} entreno(s)`}
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                {/* Legend / Months labels */}
                                                <div className="flex items-center justify-between mt-1 px-1 text-[8px] font-bold text-neutral-500 uppercase tracking-widest">
                                                    <span>Hace 6 meses</span>
                                                    <div className="flex items-center gap-1">
                                                        <span>Menos</span>
                                                        <div className="w-2 h-2 rounded-sm bg-neutral-800/60" />
                                                        <div className="w-2 h-2 rounded-sm bg-yellow-500/20" />
                                                        <div className="w-2 h-2 rounded-sm bg-yellow-500/50" />
                                                        <div className="w-2 h-2 rounded-sm bg-yellow-500" />
                                                        <span>Más</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Subtitle / Day filter header */}
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                                                    {selectedDate ? (
                                                        <>Filtrado: <span className="text-gym-primary">{new Date(selectedDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span></>
                                                    ) : (
                                                        'Todos los entrenamientos'
                                                    )}
                                                </span>
                                                {selectedDate && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedDate(null);
                                                            setSelectedDaySessions([]);
                                                        }}
                                                        className="text-[9px] font-bold text-red-400 hover:text-red-300 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded-full"
                                                    >
                                                        Limpiar
                                                    </button>
                                                )}
                                            </div>

                                            {/* Workout Sessions List */}
                                            <div className="flex flex-col gap-2.5 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                                                {(selectedDate ? selectedDaySessions : history).map((session) => {
                                                    const date = new Date(session.started_at);
                                                    const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' });
                                                    const dayNum = date.getDate();
                                                    const monthShort = date.toLocaleDateString('es-ES', { month: 'short' });

                                                    return (
                                                        <div 
                                                            key={session.id} 
                                                            onClick={() => {
                                                                onClose();
                                                                navigate(`/history/${session.id}`);
                                                            }}
                                                            className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-2xl p-4 hover:border-gym-primary/50 transition-all group relative overflow-hidden cursor-pointer min-h-[85px]"
                                                        >
                                                            <div className="absolute inset-0 bg-gradient-to-r from-gym-primary/0 via-gym-primary/5 to-gym-primary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                                                            <div className="flex items-center gap-4 relative z-10 text-left w-full">
                                                                {/* Date Badge */}
                                                                <div className="shrink-0">
                                                                    <div className="bg-neutral-800 border border-neutral-700 rounded-xl w-14 h-14 flex flex-col items-center justify-center group-hover:border-gym-primary/50 transition-colors shrink-0">
                                                                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-0.5">{dayName}</span>
                                                                        <span className="text-base font-black text-white leading-none my-0.5">{dayNum}</span>
                                                                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest leading-none mt-0.5">{monthShort}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Details */}
                                                                <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
                                                                    {/* Gym Name */}
                                                                    <div className="flex items-center gap-1.5 text-white font-bold text-xs group-hover:text-gym-primary transition-colors truncate">
                                                                        <MapPin size={12} className="text-neutral-400 shrink-0" />
                                                                        <span className="truncate">
                                                                            {session.gym_name && session.gym_name !== 'Gimnasio Desconocido' 
                                                                                ? session.gym_name 
                                                                                : 'Sesión de Entrenamiento'}
                                                                        </span>
                                                                    </div>

                                                                    {/* Muscles Trained */}
                                                                    {session.muscles_trained && session.muscles_trained.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                                            {session.muscles_trained.map((muscle: string) => (
                                                                                <span
                                                                                    key={muscle}
                                                                                    className="bg-gym-primary/10 border border-gym-primary/20 text-gym-primary px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide flex items-center gap-0.5"
                                                                                >
                                                                                    💪 {muscle}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {/* Metrics Row */}
                                                                    <div className="flex items-center gap-3 text-[10px] mt-1.5">
                                                                        <div className="flex items-center gap-1 text-neutral-400">
                                                                            <Clock size={11} className="text-blue-500" />
                                                                            <span className="font-bold">{session.duration_minutes} min</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 text-neutral-400">
                                                                            <Dumbbell size={11} className="text-gym-primary" />
                                                                            <span className="font-bold">
                                                                                {session.total_volume > 0 ? `${(session.total_volume / 1000).toFixed(1)}k kg` : '0 kg'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* External Link Arrow */}
                                                                <div className="shrink-0 ml-auto pr-1">
                                                                    <ExternalLink size={12} className="text-neutral-500 group-hover:text-gym-primary transition-colors" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )
                                ) : (

                                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 bg-neutral-800/20 border border-white/5 p-6 rounded-2xl w-full">
                                        <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 animate-pulse">
                                            <Lock size={28} />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-black text-white italic uppercase tracking-wider">Historial Privado</h3>
                                            <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                                                Este guerrero mantiene su bitácora de entrenamiento en privado. Solicita acceso para ver sus hazañas y progreso real.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleRequestHistory}
                                            disabled={historyRequestSent || requestingHistory}
                                            className={`w-full max-w-xs py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-2 ${
                                                historyRequestSent
                                                    ? 'bg-neutral-800 border-neutral-700 text-neutral-500 cursor-not-allowed'
                                                    : 'bg-gym-primary hover:bg-yellow-400 text-black active:scale-[0.98] shadow-[0_0_15px_rgba(229,255,0,0.15)] font-bold'
                                            }`}
                                        >
                                            {requestingHistory ? (
                                                <>
                                                    <Loader className="animate-spin" size={14} />
                                                    Enviando solicitud...
                                                </>
                                            ) : historyRequestSent ? (
                                                "Solicitud Enviada ⏳"
                                            ) : (
                                                <>
                                                    <History size={14} strokeWidth={2.5} />
                                                    Solicitar Historial
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Routine Inspector */}
                    {viewRoutine && (
                        <RoutineViewModal
                            routine={viewRoutine}
                            onClose={() => setViewRoutine(null)}
                            onCopy={handleCopyRoutine}
                            isCopying={copying}
                        />
                    )}
                </div>

                {/* Fixed Bottom Actions - PREMIUM CALL TO ACTION */}
                {user && user.id !== player.id && (
                    <div className="p-4 bg-neutral-900 border-t border-white/5 flex items-center gap-2 animate-in slide-in-from-bottom duration-500">
                        {/* CLOSE */}
                        <button
                            onClick={onClose}
                            className="w-12 h-12 rounded-full border-2 border-neutral-700 bg-neutral-900 text-neutral-400 flex items-center justify-center hover:bg-neutral-800 transition-all active:scale-95"
                        >
                            <X size={20} />
                        </button>

                        {/* FOLLOW */}
                        <button
                            onClick={handleFollowToggle}
                            className={`flex-1 h-12 rounded-full font-black text-[9px] uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-0.5 shadow-lg ${isFollowing
                                ? 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                                : 'bg-white text-black hover:bg-neutral-200'
                                }`}
                        >
                            {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
                            <span>{isFollowing ? 'Siguiendo' : 'Seguir'}</span>
                        </button>
                        
                        {/* INVITE */}
                        <button
                            onClick={() => alert('¡Invitación enviada!')}
                            className="flex-[1.5] h-12 rounded-full bg-gym-primary text-black font-black text-[9px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-0.5 shadow-[0_0_20px_rgba(229,255,0,0.2)]"
                        >
                            <Swords size={14} />
                            <span>Invitar</span>
                        </button>

                        {/* VIEW FULL PROFILE */}
                        <button
                            onClick={() => {
                                onClose();
                                navigate(`/player/${player.username}`);
                            }}
                            className="w-12 h-12 rounded-full border-2 border-yellow-500/30 bg-yellow-500/10 text-yellow-500 flex items-center justify-center hover:bg-yellow-500 hover:text-black transition-all active:scale-95"
                            title="Ver Perfil Completo"
                        >
                            <ExternalLink size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Feed Viewer Overlay */}
            {viewedPostId && (
                <FeedViewerOverlay
                    initialPostId={viewedPostId}
                    posts={posts}
                    onClose={() => setViewedPostId(null)}
                    variant={activeTab === 'reels' ? 'reel' : 'feed'}
                />
            )}
        </div>
    );
};
