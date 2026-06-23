import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import { 
    X, 
    UserPlus, 
    Swords, 
    ArrowRight, 
    Zap, 
    Loader2, 
    MapPin, 
    Shield,
    ChevronsLeft,
    ChevronsRight 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/NotificationService';
import { socialService } from '../services/SocialService';
import { pushService } from '../services/PushService';
import { useAuth } from '../context/AuthContext';
import { UserProfileCard } from '../components/ui/UserProfileCard';
import { BoostModal } from '../components/profile/BoostModal';
import { userService } from '../services/UserService';
import toast from 'react-hot-toast';

// Curated collection of high-quality gym/fitness images for fallbacks
const FALLBACK_BANNERS = [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571902258032-783ec5ad6dfc?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?auto=format&fit=crop&q=80'
];

const FALLBACK_GYM_INTERIORS = [
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80'
];

export const Radar = () => {
    const { user: authUser } = useAuth();
    const navigate = useNavigate();
    const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [scanComplete, setScanComplete] = useState(false);
    const [direction, setDirection] = useState<'left' | 'right' | null>(null);
    const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);
    const [isBoosting, setIsBoosting] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [isPlayingTutorial, setIsPlayingTutorial] = useState(false);
    const currentUser = nearbyUsers[currentIndex];

    useEffect(() => {
        if (scanComplete && nearbyUsers.length > 0) {
            setIsPlayingTutorial(true);
            const timer = setTimeout(() => {
                setIsPlayingTutorial(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [scanComplete, nearbyUsers.length]);

    useEffect(() => {
        if (currentUser) {
            console.log(`👁️ [RADAR] Usuario activo: ${currentUser.username} | Seguidores actuales: ${currentUser.followers_count} | Stats cargadas: ${currentUser.stats_loaded}`);
        }
    }, [currentIndex, nearbyUsers]);

    useEffect(() => {
        loadNearbyUsers();
    }, [authUser]);

    const loadNearbyUsers = async () => {
        if (!authUser?.id) {
            console.log("🛰️ [RADAR] Waiting for authUser session to be fully resolved...");
            return;
        }
        setLoading(true);
        try {
            console.log("🛰️ [RADAR] Escaneando guerreros...");
            // 1. Fetch profiles - PRIORITIZE NEWEST & BOOSTED VIA RPC (with 1.5s resilient timeout fallback!)
            console.log("⚙️ [RADAR] Triggering prioritized scanner...");
            const fetchProfilesPromise = supabase
                .rpc('get_radar_profiles_prioritized', { current_user_id: authUser?.id });

            const fallbackQueryPromise = new Promise<{ data: any[] | null; error: any; isFallback: boolean }>((resolve) => {
                setTimeout(async () => {
                    console.warn("⚠️ [RADAR] RPC get_radar_profiles_prioritized took too long (>1.5s). Falling back to direct select...");
                    try {
                        const { data, error } = await supabase
                            .from('profiles')
                            .select('*')
                            .neq('id', authUser.id)
                            .not('username', 'is', null)
                            .order('created_at', { ascending: false })
                            .limit(50);
                        resolve({ data, error, isFallback: true });
                    } catch (err) {
                        resolve({ data: null, error: err, isFallback: true });
                    }
                }, 4000); // Increased timeout to 4 seconds for slow network/cold starts
            });

            const result = await Promise.race([
                fetchProfilesPromise.then(res => ({ data: res.data, error: res.error, isFallback: false })),
                fallbackQueryPromise
            ]);

            const profiles = result.data || [];
            const pError = result.error;

            if (pError) {
                console.error("❌ [RADAR] Failed to load profiles (Error):", pError);
                throw pError;
            }

            if (result.isFallback) {
                console.log(`ℹ️ [RADAR] Successfully loaded profiles using the resilient direct select fallback! Count: ${profiles.length}. Error (if any):`, pError);
            }

            if (profiles && profiles.length > 0) {
                // 2. Fetch ALL Gym Passports for these users in one batch
                const profileIds = profiles.map(p => p.id);
                const { data: passportsData, error: passError } = await supabase
                    .from('user_gyms')
                    .select(`
    user_id,
    gym_id,
    is_home_base,
    gyms ( id, name )
`)
                    .in('user_id', profileIds);

                if (passError) console.error("🚨 [RADAR] Error fetching passports:", passError);

                // Map passports by user_id
const passportMap: Record<string, {id: string, name: string, is_favorite?: boolean, is_home_base?: boolean}[]> = {};
if (passportsData) {
    passportsData.forEach((item: any) => {
        if (!passportMap[item.user_id]) passportMap[item.user_id] = [];
        if (item.gyms) {
            passportMap[item.user_id].push({
                id: item.gyms.id,
                name: item.gyms.name,
                is_favorite: false, // placeholder, will set later
                is_home_base: item.is_home_base
            });
        }
    });
}
// Fetch favorites to set is_favorite flag
const { data: favData, error: favError } = await supabase
    .from('gym_favorites')
    .select('user_id, gym_id')
    .in('user_id', profileIds);
if (favError) console.error('🚨 [RADAR] Error fetching favorites:', favError);
const favSet = new Set<string>();
if (favData) {
    favData.forEach((f: any) => {
        favSet.add(`${f.user_id}-${f.gym_id}`);
    });
}
// Apply favorite flag
Object.entries(passportMap).forEach(([uid, gyms]) => {
    gyms.forEach(g => {
        if (favSet.has(`${uid}-${g.id}`)) {
            g.is_favorite = true;
        }
    });
});

                // 3. Fetch Home Gym Metadata
                const gymIds = [...new Set(profiles.map(p => p.home_gym_id).filter(Boolean))];
                let gymMap: any = {};
                
                if (gymIds.length > 0) {
                    const { data: gymsData } = await supabase
                        .from('gyms')
                        .select('id, name')
                        .in('id', gymIds);

                    if (gymsData) {
                        gymMap = gymsData.reduce((acc: any, g) => {
                            acc[g.id] = { name: g.name };
                            return acc;
                        }, {});
                    }
                }

                // 4. GET CURRENT USER'S HOME GYM FOR PRIORITY
                const { data: myProfile } = await supabase
                    .from('profiles')
                    .select('home_gym_id')
                    .eq('id', authUser?.id)
                    .maybeSingle();
                
                const myHomeGymId = myProfile?.home_gym_id;

                // 5. Enrich and SORT Profiles (ELITE CHRONO V7)
                const now = new Date();
                console.log("⌚ [TIME] Hora actual del sistema:", now.toISOString());

                const enriched = profiles.map((p, idx) => {
                    const settings = (p.custom_settings as any) || {};
                    let gymInfo = gymMap[p.home_gym_id || ''] || { name: "" };
                    if (gymInfo.name.includes('Arsenal Personal')) {
                        gymInfo = { name: "" };
                    }
                    
                    // BOOST DETECTION LOGIC
                    const boostDate = p.boost_until ? new Date(p.boost_until) : null;
                    const isBoosted = boostDate ? boostDate > now : false;
                    
                    // Convert created_at to timestamp for sorting (Newest = Higher Number)
                    const joinedTimestamp = p.created_at ? new Date(p.created_at).getTime() : 0;

                    if (idx < 5 || p.boost_until) {
                        console.log(`👤 [USER] ${p.username} | Boost Until: ${p.boost_until || 'N/A'} | ¿Boost Activo?: ${isBoosted}`);
                    }

                    return {
                        ...p,
                        gym_name: gymInfo.name,
                        gym_image: p.main_base_image || null,
                        gym_color: p.main_base_color || '#E5FF00',
                        gym_passport: passportMap[p.id] || [],
                        banner_url: settings.banner_url || FALLBACK_BANNERS[idx % FALLBACK_BANNERS.length],
                        training_days_count: p.checkins_count || 0,
                        followers_count: 0,
                        following_count: 0,
                        is_following: false,
                        stats_loaded: false,
                        bio: p.description || settings.description || settings.bio || "¡Entrenando duro para subir de rango! 💪 🔥",
                        is_pro: isBoosted, 
                        // ALGORITHM V7: Boost First (10^15 weight), then Newest
                        algo_score: (isBoosted ? 1000000000000000 : 0) + joinedTimestamp
                    };
                });

                // Final sort: Higher score first
                const sorted = enriched.sort((a, b) => b.algo_score - a.algo_score);
                
                console.log("🏆 [TOP 3] Usuarios ordenados (V7: Boost + Crono):");
                console.table(sorted.slice(0, 3).map(u => ({ 
                    username: u.username, 
                    score: u.algo_score, 
                    isBoosted: u.is_pro,
                    date: u.created_at 
                })));

                setNearbyUsers(sorted);
            }
        } catch (error) {
            console.error("Error loading nearby users:", error);
            toast.error("Error al buscar guerreros cercanos");
        } finally {
            setLoading(false);
            setTimeout(() => setScanComplete(true), 1500);
        }
    };

    // LAZY LOAD STATS: Fetch real stats for the CURRENT card only
    useEffect(() => {
        const loadCurrentStats = async () => {
            const currentUser = nearbyUsers[currentIndex];
            if (!currentUser || currentUser.stats_loaded || !authUser) return;

            try {
                const [stats, { data: followCheck }] = await Promise.all([
                    socialService.getProfileStats(currentUser.id),
                    supabase.from('follows').select('*').eq('follower_id', authUser.id).eq('following_id', currentUser.id).maybeSingle()
                ]);

                setNearbyUsers(prev => {
                    const updated = [...prev];
                    // IMPORTANT: Only update if the user hasn't already followed manually in the meantime
                    const currentInState = updated[currentIndex];
                    if (currentInState && currentInState.id === currentUser.id) {
                        updated[currentIndex] = {
                            ...currentInState,
                            followers_count: currentInState.is_following ? (stats.followersCount + 1) : stats.followersCount,
                            following_count: stats.followingCount,
                            is_following: currentInState.is_following || !!followCheck,
                            stats_loaded: true
                        };
                    }
                    return updated;
                });
            } catch (err) {
                console.error("Error lazy loading stats:", err);
            }
        };

        if (scanComplete && nearbyUsers.length > 0) {
            loadCurrentStats();
        }
    }, [currentIndex, scanComplete, nearbyUsers.length, authUser]);

    useEffect(() => {
        if (authUser) {
            supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle().then(({ data }) => setUserProfile(data));
        }
    }, [authUser]);

    const handleBoostConfirm = async () => {
        if (!authUser || isBoosting) return;
        setIsBoosting(true);
        try {
            const success = await userService.spendGPoints(authUser.id, 1000, 'profile_boost');
            if (success) {
                toast.success("🚀 ¡PERFIL DESTACADO EN EL RADAR!");
                setIsBoostModalOpen(false);
                // Refresh local profile state
                const { data } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
                setUserProfile(data);
            }
        } catch (err) {
            toast.error("Error al activar Boost");
        } finally {
            setIsBoosting(false);
        }
    };

    const handleSkip = async () => {
        const targetId = currentUser?.id;
        setDirection('left');
        
        // Track "Ignore" in background
        if (targetId) {
            await supabase.rpc('increment_profile_skips', { u_id: targetId });
        }

        setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
            setDirection(null);
        }, 300);
    };

    const handleFollow = async () => {
        console.log("🖱️ [CLICK] Botón de seguimiento pulsado para:", currentUser?.username);
        if (!authUser || !currentUser || isBoosting) return;
        
        const targetId = currentUser.id;
        const wasFollowing = currentUser.is_following;

        // Track "Match" in background if following
        if (!wasFollowing) {
            await supabase.rpc('increment_profile_matches', { u_id: targetId });
        }

        // ... existing optimistic update ...
        const updatedUsers = [...nearbyUsers];
        updatedUsers[currentIndex] = { 
            ...currentUser, 
            is_following: !wasFollowing, 
            followers_count: wasFollowing 
                ? Math.max(0, (currentUser.followers_count || 0) - 1) 
                : (currentUser.followers_count || 0) + 1 
        };
        console.log("🚀 [FOLLOW/UNFOLLOW] Acción optimista:", wasFollowing ? "UNFOLLOW" : "FOLLOW");
        setNearbyUsers(updatedUsers);

        try {
            if (wasFollowing) {
                // UNFOLLOW ACTION
                await supabase.from('follows').delete().eq('follower_id', authUser.id).eq('following_id', targetId);
                toast.success(`Dejaste de seguir a ${currentUser.username}`);
            } else {
                // FOLLOW ACTION
                await socialService.followUser(authUser.id, targetId);
                toast.success(`¡Siguiendo a ${currentUser.username}!`);
                
                // NOTIFY (in-app + push, background)
                const followerName = userProfile?.username || authUser.user_metadata?.username || authUser.user_metadata?.full_name || 'Un Guerrero';
                await notificationService.createNotification(targetId, {
                    type: 'follower',
                    title: 'NUEVO SEGUIDOR',
                    content: `${followerName} ha comenzado a seguirte.`,
                    data: {
                        sender_id: authUser.id,
                        sender_name: followerName,
                        follower_id: authUser.id
                    }
                });
                pushService.send(targetId, 'NUEVO SEGUIDOR', `${followerName} ha comenzado a seguirte.`, { sender_id: authUser.id });
            }
        } catch (error: any) {
            console.error("Error in follow toggle:", error);
            // ROLLBACK on error
            const reverted = [...nearbyUsers];
            reverted[currentIndex] = currentUser; // Back to previous state
            setNearbyUsers(reverted);
            toast.error("Error al procesar la acción");
        }
    };

    const handleInvite = async () => {
        if (!currentUser || isInviting) return;
        setIsInviting(true);
        try {
            const success = await notificationService.sendInvitation(currentUser.id, currentUser.username);
            if (success) {
                // Track "Match" success
                await supabase.rpc('increment_profile_matches', { u_id: currentUser.id });
                
                toast.success("Desafío enviado!");
                setDirection('right');
                setTimeout(() => {
                    setCurrentIndex(prev => prev + 1);
                    setDirection(null);
                }, 300);
            }
        } catch (error) {
            toast.error("Error al enviar invitación");
        } finally {
            setIsInviting(false);
        }
    };

    const swipeHandlers = useSwipeable({
        onSwipedLeft: handleSkip,
        onSwipedRight: handleInvite,
        trackMouse: true
    });

    return (
        <div className="flex-1 w-full flex flex-col relative overflow-hidden bg-transparent selection:bg-gym-primary selection:text-black">

            {/* Main Content Area - Optimized for Floating Cards */}
            <div className="flex-1 flex flex-col w-full h-full overflow-hidden pt-2 pb-0">

                {/* IDLE/ERROR STATE */}
                {!loading && scanComplete && (nearbyUsers.length === 0 || currentIndex >= nearbyUsers.length) && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-700">
                        <div className="w-24 h-24 bg-neutral-900 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl border border-white/5 relative group">
                            <div className="absolute inset-0 bg-gym-primary/20 rounded-[2.5rem] blur-2xl group-hover:bg-gym-primary/40 transition-all"></div>
                            <MapPin size={48} className="text-gym-primary relative z-10" />
                        </div>
                        <h2 className="text-2xl font-black text-white italic mb-3 uppercase tracking-tighter">Radar Despejado</h2>
                        <p className="text-neutral-500 max-w-xs text-sm font-medium leading-relaxed">No hay más guerreros en tu zona por ahora. ¡Vuelve más tarde para nuevos desafíos!</p>
                        <button 
                            onClick={() => { 
                                setCurrentIndex(0); 
                                setScanComplete(false); 
                                localStorage.removeItem('radar_swipe_tutorial_seen_v4');
                                loadNearbyUsers(); 
                            }}
                            className="mt-10 bg-white text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gym-primary transition-all active:scale-95 shadow-2xl"
                        >
                            Reiniciar Radar
                        </button>
                    </div>
                )}

                {/* LOADING/SCANNING STATE */}
                {(loading || !scanComplete) && (
                    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="relative w-64 h-64 flex items-center justify-center">
                            {/* Animated Radar Rings */}
                            <div className="absolute inset-0 border-2 border-gym-primary/30 rounded-full animate-[ping_3s_infinite]"></div>
                            <div className="absolute inset-8 border border-gym-primary/20 rounded-full animate-[ping_2s_infinite]"></div>
                            <div className="absolute inset-16 border border-gym-primary/10 rounded-full animate-[ping_4s_infinite]"></div>
                            
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-20 h-20 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center shadow-2xl">
                                    <Loader2 className="text-gym-primary animate-spin" size={32} />
                                </div>
                                <span className="mt-6 text-[10px] font-black text-gym-primary uppercase tracking-[0.3em] animate-pulse italic">Escaneando Perímetros...</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ACTIVE CARD CONTAINER - FLOATING STYLE */}
                {scanComplete && nearbyUsers.length > 0 && currentUser && !loading && (
                    <div
                        {...swipeHandlers}
                        className={`flex-1 flex flex-col relative w-[94%] mx-auto mb-1 transition-all duration-300 select-none overflow-hidden ${direction === 'left' ? 'animate-[slideOutLeft_0.3s_ease-out_forwards]' :
                            direction === 'right' ? 'animate-[slideOutRight_0.3s_ease-out_forwards]' :
                                'animate-in fade-in zoom-in-95 slide-in-from-bottom-12 duration-700'
                            }`}
                        style={{
                            perspective: '1000px',
                            transform: direction 
                                ? `translateX(${direction === 'left' ? '-100%' : '100%'}) rotate(${direction === 'left' ? '-15deg' : '15deg'})` 
                                : 'none',
                            animation: isPlayingTutorial ? 'tinderTutorialSwipe 3s ease-in-out infinite' : undefined
                        }}
                    >
                        <style>{`
                            @keyframes tinderTutorialSwipe {
                                0% { transform: translate3d(0, 0, 0) rotate(0deg); }
                                /* Swipe Left Demo (NOPE) */
                                10% { transform: translate3d(-100px, 10px, 0) rotate(-10deg); }
                                30% { transform: translate3d(-100px, 10px, 0) rotate(-10deg); }
                                40% { transform: translate3d(0, 0, 0) rotate(0deg); }
                                /* Center Hold */
                                55% { transform: translate3d(0, 0, 0) rotate(0deg); }
                                /* Swipe Right Demo (LIKE) */
                                65% { transform: translate3d(100px, 10px, 0) rotate(10deg); }
                                85% { transform: translate3d(100px, 10px, 0) rotate(10deg); }
                                95% { transform: translate3d(0, 0, 0) rotate(0deg); }
                                100% { transform: translate3d(0, 0, 0) rotate(0deg); }
                            }
                            @keyframes nopeStampFade {
                                0% { opacity: 0; transform: scale(1.3) rotate(-15deg); }
                                10% { opacity: 1; transform: scale(1) rotate(-15deg); }
                                30% { opacity: 1; transform: scale(1) rotate(-15deg); }
                                38% { opacity: 0; transform: scale(0.8) rotate(-15deg); }
                                100% { opacity: 0; }
                            }
                            @keyframes likeStampFade {
                                0% { opacity: 0; transform: scale(1.3) rotate(15deg); }
                                60% { opacity: 0; transform: scale(1.3) rotate(15deg); }
                                65% { opacity: 1; transform: scale(1) rotate(15deg); }
                                85% { opacity: 1; transform: scale(1) rotate(15deg); }
                                93% { opacity: 0; transform: scale(0.8) rotate(15deg); }
                                100% { opacity: 0; }
                            }
                            @keyframes nopeTooltipFade {
                                0% { opacity: 0; transform: translate3d(0, 15px, 0); }
                                10% { opacity: 1; transform: translate3d(0, 0, 0); }
                                30% { opacity: 1; transform: translate3d(0, 0, 0); }
                                38% { opacity: 0; transform: translate3d(0, -10px, 0); }
                                100% { opacity: 0; }
                            }
                            @keyframes likeTooltipFade {
                                0% { opacity: 0; transform: translate3d(0, 15px, 0); }
                                60% { opacity: 0; transform: translate3d(0, 15px, 0); }
                                65% { opacity: 1; transform: translate3d(0, 0, 0); }
                                85% { opacity: 1; transform: translate3d(0, 0, 0); }
                                100% { opacity: 0; }
                            }
                            @keyframes pulseLeft {
                                0%, 100% { transform: translateX(0); opacity: 1; }
                                50% { transform: translateX(-5px); opacity: 0.3; }
                            }
                            @keyframes pulseRight {
                                0%, 100% { transform: translateX(0); opacity: 1; }
                                50% { transform: translateX(5px); opacity: 0.3; }
                            }
                        `}</style>



                        {/* Autoplay Tutorial stamps */}
                        {isPlayingTutorial && (
                            <>
                                {/* NOPE Stamp */}
                                <div className="absolute top-[125px] left-[30%] -translate-x-1/2 z-50 pointer-events-none opacity-0 select-none animate-[nopeStampFade_3s_ease-in-out_infinite]">
                                    <div className="border-4 border-red-500 text-red-500 font-black text-4xl px-5 py-1.5 rounded-2xl uppercase tracking-widest bg-black/70 backdrop-blur-sm shadow-2xl">
                                        NOPE
                                    </div>
                                </div>

                                {/* MATCH Stamp — spec §1.5/línea 277: el Radar nunca debe mostrar
                                    un "me gusta"/"LIKE" hacia personas; el gesto de deslizar a la
                                    derecha envía una invitación de entrenamiento (match), no un like. */}
                                <div className="absolute top-[125px] right-[30%] translate-x-1/2 z-50 pointer-events-none opacity-0 select-none animate-[likeStampFade_3s_ease-in-out_infinite]">
                                    <div className="border-4 border-gym-primary text-gym-primary font-black text-4xl px-5 py-1.5 rounded-2xl uppercase tracking-widest bg-black/70 backdrop-blur-sm shadow-2xl">
                                        MATCH
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Autoplay Tutorial Floating explanations */}
                        {isPlayingTutorial && (
                            <div className="absolute bottom-[190px] left-4 right-4 z-50 pointer-events-none select-none flex flex-col items-center">
                                {/* Left Explanation Card */}
                                <div className="absolute w-full max-w-[250px] bg-black/95 backdrop-blur-md border border-red-500/40 rounded-2xl px-4 py-3 shadow-[0_15px_35px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2 animate-[nopeTooltipFade_3s_ease-in-out_infinite]">
                                    <ChevronsLeft className="text-red-500 animate-[pulseLeft_1.5s_infinite] shrink-0" size={16} />
                                    <span className="text-red-400 text-[10px] font-black uppercase tracking-[0.1em] text-center">Desliza para DESCARTAR</span>
                                </div>

                                {/* Right Explanation Card */}
                                <div className="absolute w-full max-w-[250px] bg-black/95 backdrop-blur-md border border-gym-primary/40 rounded-2xl px-4 py-3 shadow-[0_15px_35px_rgba(229,255,0,0.3)] flex items-center justify-center gap-2 animate-[likeTooltipFade_3s_ease-in-out_infinite]">
                                    <span className="text-gym-primary text-[10px] font-black uppercase tracking-[0.1em] text-center">Desliza para dar MATCH</span>
                                    <ChevronsRight className="text-gym-primary animate-[pulseRight_1.5s_infinite] shrink-0" size={16} />
                                </div>
                            </div>
                        )}

                        <UserProfileCard 
                            user={currentUser}
                            hidePermissions={true}
                            isRadar={true}
                            actions={
                                <div className="flex items-center justify-center gap-6 px-2 mt-auto pb-4">
                                    {/* 1. SEGUIR GUERRERO */}
                                    <button 
                                        onClick={handleFollow}
                                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl ${
                                            currentUser.is_following 
                                            ? 'bg-blue-500 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                                            : 'bg-neutral-900 border border-white/5 text-neutral-500 hover:text-blue-500 hover:bg-blue-500/10'
                                        }`}
                                        title={currentUser.is_following ? "Siguiendo" : "Seguir"}
                                    >
                                        <UserPlus size={24} fill={currentUser.is_following ? "currentColor" : "none"} />
                                    </button>

                                    {/* 2. ACCIÓN CENTRAL: DESAFIAR/INVITAR (EL MÁS GRANDE) */}
                                    <button 
                                        onClick={handleInvite}
                                        className="w-20 h-20 rounded-[2rem] bg-white flex items-center justify-center text-black hover:bg-gym-primary hover:scale-110 transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)] group"
                                        title="Invitar a Entrenar"
                                    >
                                        <Swords size={32} className="group-hover:scale-110 transition-transform" fill="currentColor" />
                                    </button>

                                    {/* 3. BOOST PERSONAL (ZAP) */}
                                    <button 
                                        onClick={() => setIsBoostModalOpen(true)}
                                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl ${
                                            userProfile?.boost_until && new Date(userProfile.boost_until) > new Date()
                                            ? 'bg-yellow-500 text-black border-yellow-400 animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.3)]'
                                            : 'bg-neutral-900 border border-white/5 text-neutral-500 hover:text-yellow-500 hover:bg-yellow-500/10'
                                        }`}
                                        title="Boost Perfil"
                                    >
                                        <Zap size={24} fill={userProfile?.boost_until && new Date(userProfile.boost_until) > new Date() ? "currentColor" : "none"} />
                                    </button>
                                </div>
                            }
                        />
                        
                        <BoostModal 
                            isOpen={isBoostModalOpen}
                            onClose={() => setIsBoostModalOpen(false)}
                            onConfirm={handleBoostConfirm}
                            isBoosting={isBoosting}
                            isActive={!!(userProfile?.boost_until && new Date(userProfile.boost_until) > new Date())}
                            expiresAt={userProfile?.boost_until}
                            currentPoints={userProfile?.g_points || 0}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
