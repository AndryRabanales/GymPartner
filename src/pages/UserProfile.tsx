import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Trophy, MapPin, Edit2, LogIn, Loader, Swords, Dumbbell, LineChart, History, Star, Search, ArrowLeft, Crown } from 'lucide-react';
// import { UserPlus, Grid } from 'lucide-react'; // UNUSED: Hidden Community Features
// import { Grid } from 'lucide-react'; // UNUSED: Hidden Community Features
import { Link, useNavigate } from 'react-router-dom';
// import { getXPProgress, getRankFromXP } from '../types/user';
import type { UserRank } from '../types/user';
// 1. Add import
import { EditProfileModal } from '../components/profile/EditProfileModal';
import { LocationAccessModal } from '../components/common/LocationAccessModal';
import { ReferralModal } from '../components/common/ReferralModal';
import { PlayerProfileModal } from '../components/profile/PlayerProfileModal';


import { userService } from '../services/UserService';
import type { UserPrimaryGym } from '../services/UserService';
import { socialService } from '../services/SocialService';
import { StreakFlame } from '../components/gamification/StreakFlame';
import { alphaService } from '../services/AlphaService';
import { useBottomNav } from '../context/BottomNavContext';
import { TierService } from '../services/TierService';
import { InteractiveOverlay } from '../components/onboarding/InteractiveOverlay';


interface ProfileData {
    username: string;
    description: string;
    avatar_url: string;
    xp: number;
    rank: UserRank;
    checkins_count: number;
    photos_count: number;
    custom_settings?: {
        banner_url?: string;
    };
    referred_by?: string;
    featured_routine_id?: string;
}

export const UserProfile = () => {
    const { user, loading: authLoading } = useAuth();
    const { hideBottomNav, showBottomNav } = useBottomNav();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [userGyms, setUserGyms] = useState<UserPrimaryGym[]>([]);


    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showSocialProfile, setShowSocialProfile] = useState(false);
    const [skipOnboarding, setSkipOnboarding] = useState(true); // Default to TRUE: Profile is the main page
    const hasSeededRef = useRef(false); // Track if we've run the seeder

    const navigate = useNavigate();
    const [verifyingLocation, setVerifyingLocation] = useState<string | null>(null); // Gym ID being verified

    // Modal State
    const [showReferralModal, setShowReferralModal] = useState(false);
    const [locationError, setLocationError] = useState<{
        isOpen: boolean;
        gymName: string;
        distanceMeters: number | null;
        errorType: 'DISTANCE' | 'NO_COORDS' | 'GPS_ERROR';
    }>({ isOpen: false, gymName: '', distanceMeters: null, errorType: 'GPS_ERROR' });

    // Social Stats State
    const [socialStats, setSocialStats] = useState({ followersCount: 0, followingCount: 0, totalLikes: 0 });

    // Alpha/Ranking Status State
    const [userRanking, setUserRanking] = useState<number | null>(null); // 1-10 or null
    const [alphaHistory, setAlphaHistory] = useState<any[]>([]);

    // TUTORIAL STATE
    const [tutorialStep, setTutorialStep] = useState(0);

    useEffect(() => {
        console.log('[TUTORIAL] Current Step State:', tutorialStep);
        if (tutorialStep === 5) {
            setTimeout(() => {
                const el = document.getElementById('tut-find-gyms-btn');
                console.log('[TUTORIAL] Step 5 Target found?', !!el);
            }, 500);
        }
    }, [tutorialStep]);

    useEffect(() => {
        // Check URL for tutorial override (from redirect)
        const params = new URLSearchParams(window.location.search);
        const urlTutorialStep = params.get('tutorial');

        if (urlTutorialStep) {
            const step = parseInt(urlTutorialStep);
            console.log('[TUTORIAL] Loading from URL param:', step);
            setTutorialStep(step);
            localStorage.setItem('tutorial_step', step.toString());
            // Clean URL
            window.history.replaceState({}, '', '/');
            return;
        }

        // Resume tutorial if active
        const savedStep = localStorage.getItem('tutorial_step');
        if (savedStep) {
            const step = parseInt(savedStep);
            console.log('[TUTORIAL] Resuming from localStorage:', step);
            setTutorialStep(step);
        } else {
            // START TUTORIAL AUTOMATICALLY IF NEW USER (First time)
            const hasSeen = localStorage.getItem('hasSeenGlobalTutorial');
            if (!hasSeen) {
                console.log('[TUTORIAL] New user detected, starting tutorial');
                setTimeout(() => {
                    setTutorialStep(1);
                    localStorage.setItem('tutorial_step', '1');
                    localStorage.setItem('hasSeenGlobalTutorial', 'true');
                }, 1000);
            }
        }
    }, [navigate]);

    useEffect(() => {
        if (user) {
            loadUserData();
            // Fetch Social Stats
            socialService.getProfileStats(user.id).then(setSocialStats);

            // Check Routine Count REMOVED - Strict User Request: Only start if New User or Explicit Click.


            // Short delay for better UX
            // Seed DB with new defaults (Background) - Run Only Once
            if (!hasSeededRef.current) {
                // console.log('Triggering background seed...');
                hasSeededRef.current = true;
                // seedExercisesCatalog().catch(console.error);
                // console.log("UserProfile Loaded - Ready for Reset");
            }
        } else {
            setLoading(false);
        }
    }, [user]);

    // Load Alpha data when userGyms is ready
    useEffect(() => {
        if (user && userGyms.length > 0) {
            loadAlphaData();
        }
    }, [user, userGyms]);



    /**
     * GEOLOCATION SECURITY CHECK
     * Users must be within range (e.g. 200m) of the gym to start a workout.
     */
    const handleStartWorkout = async (gym: UserPrimaryGym) => {
        console.log("📍 Verificando Ubicación para:", gym.gym_name, { lat: gym.lat, lng: gym.lng });

        // 1. SPECIAL CASE: PERSONAL GYM (Intentionally 0,0) -> ALLOW
        if (gym.lat === 0 && gym.lng === 0) {
            console.log("🏠 Personal Gym Detected - Bypassing Location Check");
            navigate(`/territory/${gym.gym_id}/workout`);
            return;
        }

        // 2. ERROR CASE: MISSING COORDINATES -> BLOCK
        if (!gym.lat || !gym.lng) {
            setLocationError({
                isOpen: true,
                gymName: gym.gym_name,
                distanceMeters: null,
                errorType: 'NO_COORDS'
            });
            return;
        }

        setVerifyingLocation(gym.gym_id);

        if (!navigator.geolocation) {
            setLocationError({
                isOpen: true,
                gymName: gym.gym_name,
                distanceMeters: null,
                errorType: 'GPS_ERROR'
            });
            setVerifyingLocation(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;

                // Calculate Distance
                const distanceKm = getDistanceFromLatLonInKm(userLat, userLng, gym.lat!, gym.lng!);
                const distanceMeters = distanceKm * 1000;

                console.log(`[Location Check] Gym: ${gym.gym_name}, Dist: ${distanceMeters.toFixed(2)}m`);

                // Threshold: 100m (Strict Gym Perimiter)
                const ALLOWED_RADIUS_METERS = 100; // 0.1km

                if (distanceMeters <= ALLOWED_RADIUS_METERS) {
                    // SUCCESS - VERIFIED LOCATION

                    // CHECK: First Verification Reward?
                    const checkFirstVisit = async () => {
                        try {
                            // Check if any sessions exist for this user at this gym
                            const { count } = await supabase
                                .from('workout_sessions')
                                .select('*', { count: 'exact', head: true })
                                .eq('user_id', user!.id)
                                .eq('gym_id', gym.gym_id);

                            if (count === 0) {
                                // FIRST DEPLOYMENT!
                                console.log("🎉 FIRST DEPLOYMENT DETECTED! Awarding XP...");
                                const xpResult = await userService.addXP(user!.id, 500);
                                if (xpResult.success) {
                                    alert(`🎖️ DESPLIEGUE CONFIRMADO: +500 XP\n\nBienvenido a ${gym.gym_name}. Tu primera incursión ha sido recompensada.`);
                                }
                            }
                        } catch (err) {
                            console.error("Error checking first visit:", err);
                        }

                        // COMPLETE TUTORIAL if active (Step 7 -> Done)
                        if (localStorage.getItem('tutorial_step') === '7') {
                            localStorage.setItem('tutorial_step', '0');
                            localStorage.setItem('hasSeenImportTutorial', 'true');
                            setTutorialStep(0);
                        }

                        // Proceed to workout
                        navigate(`/territory/${gym.gym_id}/workout`);
                    };

                    checkFirstVisit();
                } else {
                    // FAIL
                    setLocationError({
                        isOpen: true,
                        gymName: gym.gym_name,
                        distanceMeters: distanceMeters,
                        errorType: 'DISTANCE'
                    });
                }
                setVerifyingLocation(null);
            },
            (error) => {
                console.error("Geolocation Error:", error);
                setLocationError({
                    isOpen: true,
                    gymName: gym.gym_name,
                    distanceMeters: null,
                    errorType: 'GPS_ERROR'
                });
                setVerifyingLocation(null);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const loadUserData = async () => {
        try {
            setLoading(true);
            if (!supabase) return;
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user!.id)
                .maybeSingle();

            if (error) throw error;
            if (data) setProfile(data);

            // REFERRAL CHECK: If user has a pending referral code and hasn't been referred yet
            const pendingRef = sessionStorage.getItem('gym_referral_id');
            if (pendingRef && data && !data.referred_by && pendingRef !== user!.id) {
                console.log("🔗 Processing Referral:", pendingRef);
                const { error: refError } = await supabase
                    .from('profiles')
                    .update({ referred_by: pendingRef })
                    .eq('id', user!.id);

                if (!refError) {
                    sessionStorage.removeItem('gym_referral_id');
                    alert("🎖️ ¡Has sido reclutado con éxito! Tu comandante recibirá su recompensa pronto.");
                } else {
                    console.error("Referral Error:", refError);
                }
            }

            const loadGyms = async () => {
                if (!user) return;
                const gyms = await userService.getUserGyms(user.id);

                // Sort: Home Base First
                const sortedGyms = gyms.sort((a, b) => {
                    if (a.is_home_base === b.is_home_base) return 0;
                    return a.is_home_base ? -1 : 1;
                });

                setUserGyms(sortedGyms);
            };
            await loadGyms();

        } catch (error) {
            console.error('Error loading user data:', error);
            // DO NOT reset profile to null here. Keep potentially stale data or just show toast.
        } finally {
            setLoading(false);
        }
    };

    const loadAlphaData = async () => {
        if (!user?.id || userGyms.length === 0) return;

        try {
            // Cargar historial de Alpha
            const history = await alphaService.getUserAlphaHistory(user.id);
            setAlphaHistory(history);

            // Obtener ranking en CADA uno de sus gyms (en paralelo)
            const rankings = await Promise.all(
                userGyms.map(gym => alphaService.getUserRanking(user.id, gym.gym_id))
            );

            // Obtener el mejor ranking (el número más bajo que no sea null)
            const validRankings = rankings.filter(r => r !== null) as number[];
            const bestRanking = validRankings.length > 0 ? Math.min(...validRankings) : null;

            setUserRanking(bestRanking);
        } catch (error) {
            console.error('Error loading Alpha data:', error);
        }
    };


    if (authLoading) { // Only check authLoading here, actual loading handled below
        return <div className="min-h-screen flex items-center justify-center text-gym-primary"><Loader className="animate-spin" size={32} /></div>;
    }

    if (!user) {
        return (
            <div className="flex flex-col bg-neutral-950 flex-1 h-full">
                {/* Hero Section */}
                <div className="flex-1 flex flex-col items-center justify-center p-4 py-12 md:py-20 text-center relative overflow-hidden">
                    {/* Background Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gym-primary/10 rounded-full blur-[100px] pointer-events-none"></div>

                    <div className="relative z-10 max-w-3xl">
                        <div className="bg-gym-primary/10 w-fit mx-auto px-4 py-1.5 rounded-full border border-gym-primary/20 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <span className="text-gym-primary font-bold text-sm tracking-wide">LA EVOLUCIÓN DEL ENTRENAMIENTO</span>
                        </div>

                        <h1 className="text-4xl md:text-7xl font-black text-white mb-4 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100 uppercase italic">
                            Tu Gimnasio <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gym-primary to-yellow-200">Inteligente</span>
                        </h1>

                        <p className="text-lg md:text-xl text-neutral-400 mb-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                            Deja de adivinar. Domina tu entorno. <br />
                            Mapa de máquinas, rastreo de batallas y rango social en una sola app.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
                            <Link
                                to="/login"
                                className="bg-gym-primary text-black font-black text-xl px-12 py-5 rounded-[2rem] hover:bg-yellow-400 transition-all transform hover:scale-105 shadow-2xl shadow-gym-primary/40 flex items-center justify-center gap-3 no-underline italic tracking-tighter"
                            >
                                <LogIn size={28} strokeWidth={3} />
                                <span>INICIAR MISIÓN</span>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-3 gap-1 px-1 bg-neutral-900 border-t border-white/5">
                    <div className="bg-neutral-950 p-4 md:p-10 text-center hover:bg-neutral-900 transition-colors group cursor-default">
                        <div className="bg-blue-500/10 w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:bg-blue-500/20 transition-colors">
                            <MapPin size={24} className="text-blue-500 md:hidden" />
                            <MapPin size={32} className="text-blue-500 hidden md:block" />
                        </div>
                        <h3 className="text-sm md:text-xl font-bold text-white mb-2 uppercase italic tracking-tighter">La Sede</h3>
                        <p className="text-[10px] md:text-sm text-neutral-500 leading-tight">Localiza tu gimnasio en el mapa y establece tu base de entrenamiento.</p>
                    </div>
                    <div className="bg-neutral-950 p-4 md:p-10 text-center hover:bg-neutral-900 transition-colors group cursor-default">
                        <div className="bg-purple-500/10 w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:bg-purple-500/20 transition-colors">
                            <Dumbbell size={24} className="text-purple-500 md:hidden" />
                            <Dumbbell size={32} className="text-purple-500 hidden md:block" />
                        </div>
                        <h3 className="text-sm md:text-xl font-bold text-white mb-2 uppercase italic tracking-tighter">El Arsenal</h3>
                        <p className="text-[10px] md:text-sm text-neutral-500 leading-tight">Inventario digital de máquinas. Sabe qué equipamiento tienes antes de llegar.</p>
                    </div>
                    <div className="bg-neutral-950 p-4 md:p-10 text-center hover:bg-neutral-900 transition-colors group cursor-default">
                        <div className="bg-green-500/10 w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:bg-green-500/20 transition-colors">
                            <Swords size={24} className="text-green-500 md:hidden" />
                            <Swords size={32} className="text-green-500 hidden md:block" />
                        </div>
                        <h3 className="text-sm md:text-xl font-bold text-white mb-2 uppercase italic tracking-tighter">Entrenamiento</h3>
                        <p className="text-[10px] md:text-sm text-neutral-500 leading-tight">Tracker de entrenamiento de guerra. Series, reps y progreso real.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-gym-primary"><Loader className="animate-spin" size={32} /></div>;
    }

    // IF USER HAS NO GYMS YET -> SHOW TACTICAL ONBOARDING
    if (userGyms.length === 0 && !skipOnboarding) {
        return (
            <div className="max-w-4xl mx-auto p-4 md:p-12 min-h-[80vh] flex flex-col items-center justify-center relative overflow-hidden">
                {/* BACK BUTTON */}
                <button
                    onClick={() => setSkipOnboarding(true)}
                    className="absolute top-4 left-4 z-50 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs md:text-sm bg-black/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/5 hover:border-white/20"
                >
                    <ArrowLeft size={18} />
                    <span>Regresar</span>
                </button>

                {/* Background Radar Effect */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-gym-primary/10 rounded-full animate-[pulse-ring_4s_linear_infinite] pointer-events-none"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-gym-primary/5 rounded-full animate-[pulse-ring_6s_linear_infinite] pointer-events-none"></div>

                <style>{`
                    @keyframes pulse-ring {
                        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                        50% { opacity: 0.3; }
                        100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
                    }
                `}</style>

                <div className="relative z-10 w-full text-center space-y-8">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gym-primary/10 rounded-3xl flex items-center justify-center border border-gym-primary/20 shadow-[0_0_30px_rgba(250,204,21,0.1)]">
                            <MapPin className="text-gym-primary w-10 h-10 animate-bounce" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-4xl md:text-6xl font-black text-white italic uppercase tracking-tighter leading-none">
                                RECLAMA TU <span className="text-gym-primary">PRIMERA BASE</span>
                            </h1>
                            <p className="text-neutral-500 font-bold tracking-widest uppercase text-xs md:text-sm">
                                Detectando territorio no explorado... Busca tu gimnasio en el mapa.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-[2.5rem] shadow-2xl flex justify-center">
                            <Link
                                to="/map"
                                className="bg-gym-primary text-black font-black text-xl px-12 py-5 rounded-[2rem] hover:bg-yellow-400 transition-all transform hover:scale-105 shadow-2xl shadow-gym-primary/40 flex items-center justify-center gap-3 no-underline italic tracking-tighter animate-bounce"
                            >
                                <MapPin size={28} strokeWidth={3} />
                                <span>ABRIR MAPA TÁCTICO</span>
                            </Link>
                        </div>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto opacity-60">
                        <div className="bg-neutral-900/50 p-4 rounded-2xl border border-white/5 space-y-1">
                            <div className="text-xl">🛡️</div>
                            <div className="text-[10px] font-black text-white uppercase tracking-widest">Protege tu zona</div>
                        </div>
                        <div className="bg-neutral-900/50 p-4 rounded-2xl border border-white/5 space-y-1">
                            <div className="text-xl">📈</div>
                            <div className="text-[10px] font-black text-white uppercase tracking-widest">Gana XP Real</div>
                        </div>
                        <div className="bg-neutral-900/50 p-4 rounded-2xl border border-white/5 space-y-1">
                            <div className="text-xl">⚒️</div>
                            <div className="text-[10px] font-black text-white uppercase tracking-widest">Arma tu Arsenal</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // DASHBOARD VIEW
    const displayProfile = profile || {
        username: user.user_metadata.full_name,
        avatar_url: user.user_metadata.avatar_url,
        description: 'New Recruit',
        xp: 0,
        rank: 'Novato' as UserRank,
        checkins_count: 0,
        photos_count: 0
    };

    // Use new leveling logic
    // const { currentLevel, progressPercent } = getXPProgress(displayProfile.xp);
    // const realRank = getRankFromXP(displayProfile.xp);
    const userAvatar = profile?.avatar_url || user.user_metadata.avatar_url || 'https://i.pravatar.cc/300';

    // NEW: Calculate Dominance Tier
    const currentTier = TierService.getTier(profile?.checkins_count || 0);
    const tierProgress = TierService.getProgress(profile?.checkins_count || 0);
    // const nextTier = TierService.getNextTier(currentTier.level);

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8 pb-24">
            {/* ... content ... */}
            {/* Header Profile Card - LoL/Gymrat Design - FIXED LAYOUT */}
            <div
                className="bg-neutral-900 border border-neutral-800 rounded-3xl p-2 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-6 relative overflow-hidden transition-all shadow-2xl group"
                style={profile?.custom_settings?.banner_url ? {
                    backgroundImage: `url(${profile.custom_settings.banner_url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                } : {}}
            >
                {/* Banner Overlay for Readability */}
                {profile?.custom_settings?.banner_url && (
                    <div className="absolute inset-0 bg-black/60 z-0 transition-opacity group-hover:bg-black/50"></div>
                )}

                {/* Background Texture REMOVED - Clean Dark Gradient instead */}
                <div className="absolute top-0 right-0 w-full h-full pointer-events-none bg-gradient-to-bl from-neutral-800/10 to-transparent z-0"></div>

                {/* Avatar Section: LoL Style Ring (CONTAINED AND CENTERED) */}
                <div className="relative shrink-0 z-10 transition-all">
                    <div className="relative w-36 h-36 sm:w-48 sm:h-48 flex items-center justify-center">

                        {/* 0. Tier Glow (Dynamic Color) */}
                        <div className={`absolute inset-0 rounded-full blur-2xl transform scale-100 pointer-events-none transition-colors duration-500 ${currentTier.color.replace('text-', 'bg-')}/20`}></div>

                        {/* 1. Base Ring (Dark Metal) */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-lg overflow-visible" viewBox="0 0 160 160">
                            <circle
                                cx="80" cy="80" r="74"
                                fill="transparent"
                                stroke="#1F1F1F"
                                strokeWidth="6"
                            />
                        </svg>

                        {/* 2. Progress Ring (Dynamic Tier Color) */}
                        <svg className={`absolute inset-0 w-full h-full -rotate-90 drop-shadow-[0_0_15px_currentColor] overflow-visible ${currentTier.color}`} viewBox="0 0 160 160">
                            <circle
                                cx="80" cy="80" r="74"
                                fill="transparent"
                                stroke="currentColor"
                                strokeWidth="6"
                                strokeDasharray="465" /* 2 * PI * 74 ≈ 465 */
                                strokeDashoffset={465 - (Math.min(tierProgress, 100) / 100) * 465}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>

                        {/* Avatar Image - INCREASED SIZE FOR VISIBILITY */}
                        <div className={`w-[115px] h-[115px] sm:w-[150px] sm:h-[150px] rounded-full overflow-hidden border-4 z-10 bg-neutral-800 shadow-inner relative transition-colors duration-500 ${currentTier.borderColor}`}>
                            <img
                                src={userAvatar}
                                alt="Profile"
                                className="w-full h-full object-cover scale-110" // Slight zoom to appreciate face better
                            />
                        </div>

                        {/* Tier Badge (Bottom Center) - Replaces Level Hexagon */}
                        <div className="absolute bottom-0 left-0 right-0 mx-auto w-12 z-20 filter drop-shadow-lg">
                            <div className="relative w-12 h-12 flex items-center justify-center">
                                {/* Hexagon Shape CSS */}
                                <div className={`absolute inset-0 bg-gradient-to-b ${currentTier.gradient} clip-path-hexagon`}></div>
                                <div className="absolute inset-[2px] bg-neutral-900 clip-path-hexagon flex items-center justify-center">
                                    <span className={`font-black text-xl leading-none ${currentTier.color}`}>
                                        {currentTier.icon}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Info Section */}
                <div className="flex-1 text-center sm:text-left space-y-1 z-10 pt-2 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-0 text-center sm:text-left">
                            {/* Name: Golden Shock (High Visibility & Energy) */}
                            <h1 className={`text-3xl sm:text-4xl font-black ${currentTier.color} tracking-tighter uppercase italic drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] animate-pulse leading-none mb-1`}>
                                {profile?.username || user.user_metadata.full_name}
                            </h1>

                            {/* Rank: Dark Glass Pill */}
                            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 mb-4">
                                <div className={`inline-flex items-center gap-2 px-4 py-1.5 bg-black/40 border ${currentTier.borderColor}/30 rounded-full backdrop-blur-md shadow-lg group hover:${currentTier.borderColor}/60 transition-colors`}>
                                    <span className={`${currentTier.color} font-bold text-xs tracking-widest uppercase`}>
                                        {currentTier.name} TIER
                                    </span>
                                </div>

                                {/* STREAK FLAME */}
                                <StreakFlame userId={user.id} />

                                <span className="text-neutral-500 text-xs font-bold tracking-[0.2em] uppercase hidden sm:block">
                                    {userGyms.find(g => g.is_home_base) ? (
                                        <div className="flex items-center gap-2 text-yellow-500 animate-pulse">
                                            <Star size={14} fill="currentColor" />
                                            <span className="truncate max-w-[200px]">{userGyms.find(g => g.is_home_base)?.gym_name}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-neutral-500 group-hover:text-blue-400 transition-colors">
                                            <Swords size={14} />
                                            <span>AGENTE LIBRE</span>
                                        </div>
                                    )}
                                </span>
                            </div>

                            {/* SOCIAL STATS ROW (Unified Design) */}
                            {/* SOCIAL STATS ROW (Grid for Perfect Symmetry) */}
                            <div className="grid grid-cols-3 divide-x divide-white/10 bg-black/60 backdrop-blur-md rounded-2xl py-3 border border-white/10 shadow-xl mt-4 w-full max-w-xs mx-auto">
                                <div className="flex flex-col items-center justify-center group cursor-pointer hover:bg-white/5 transition-colors py-1" onClick={() => setShowSocialProfile(true)}>
                                    <span className="font-black text-xl text-white leading-none mb-1 drop-shadow-md">{socialStats.followersCount}</span>
                                    <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest text-shadow-sm">Seguidores</span>
                                </div>
                                <div className="flex flex-col items-center justify-center group cursor-pointer hover:bg-white/5 transition-colors py-1" onClick={() => setShowSocialProfile(true)}>
                                    <span className="font-black text-xl text-white leading-none mb-1 drop-shadow-md">{socialStats.followingCount}</span>
                                    <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest text-shadow-sm">Seguidos</span>
                                </div>
                                <div className="flex flex-col items-center justify-center group cursor-pointer hover:bg-white/5 transition-colors py-1">
                                    <span className="font-black text-xl text-white leading-none mb-1 text-red-500 drop-shadow-md">{socialStats.totalLikes}</span>
                                    <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest text-shadow-sm">Likes</span>
                                </div>
                            </div>

                            {/* RANKING STATUS - TOP 10 */}
                            {loading ? (
                                // Skeleton loader mientras carga
                                <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-3 mt-4 w-full max-w-xs mx-auto animate-pulse">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-neutral-700 rounded"></div>
                                        <div className="flex-1">
                                            <div className="h-4 bg-neutral-700 rounded w-32 mb-1"></div>
                                            <div className="h-3 bg-neutral-700 rounded w-24"></div>
                                        </div>
                                    </div>
                                </div>
                            ) : userRanking !== null ? (
                                // Badge de Ranking cuando está cargado
                                <div className={`
                                    bg-gradient-to-r rounded-lg p-3 mt-4 w-full max-w-xs mx-auto animate-in fade-in duration-500 border-2
                                    ${userRanking === 1 ? 'from-yellow-500/20 to-orange-500/20 border-yellow-500' :
                                        userRanking === 2 ? 'from-gray-400/20 to-gray-500/20 border-gray-400' :
                                            userRanking === 3 ? 'from-amber-700/20 to-amber-800/20 border-amber-600' :
                                                'from-blue-500/20 to-blue-600/20 border-blue-500'}
                                `}>
                                    <div className="flex items-center gap-2">
                                        <Crown size={24} className={`
                                            fill-current
                                            ${userRanking === 1 ? 'text-yellow-500 animate-pulse' :
                                                userRanking === 2 ? 'text-gray-400' :
                                                    userRanking === 3 ? 'text-amber-600' :
                                                        'text-blue-500'}
                                        `} />
                                        <div>
                                            <div className={`
                                                font-bold text-sm
                                                ${userRanking === 1 ? 'text-yellow-500' :
                                                    userRanking === 2 ? 'text-gray-400' :
                                                        userRanking === 3 ? 'text-amber-600' :
                                                            'text-blue-400'}
                                            `}>
                                                {userRanking === 1 ? '👑 TOP #1' :
                                                    userRanking === 2 ? '🥈 TOP #2' :
                                                        userRanking === 3 ? '🥉 TOP #3' :
                                                            `🏆 TOP #${userRanking}`}
                                            </div>
                                            <div className="text-white text-xs">
                                                {userGyms.find(g => g.is_home_base)?.gym_name || 'Tu Gym'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {/* HISTORIAL DE ALPHA */}
                            {alphaHistory.length > 0 && (
                                <div className="mt-4 w-full max-w-xs mx-auto animate-in fade-in duration-700 delay-150">
                                    <h3 className="text-white font-bold mb-2 flex items-center gap-2 justify-center">
                                        <Crown size={16} className="text-yellow-500" />
                                        Historial de Alpha
                                    </h3>
                                    <div className="space-y-2">
                                        {alphaHistory.map((record: any) => (
                                            <div
                                                key={record.id}
                                                className="bg-neutral-800 rounded-lg p-3 border border-neutral-700 text-center"
                                            >
                                                <div className="text-white font-medium text-sm">
                                                    {record.gym.name}
                                                </div>
                                                <div className="text-neutral-400 text-xs mt-1">
                                                    Alpha {record.times_alpha}x • {record.total_weeks} semanas
                                                </div>
                                                <div className="text-neutral-500 text-xs mt-1">
                                                    Última vez: {new Date(record.last_alpha_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Edit Button - PREMIUM GLASS PENCIL */}
                        <div className="absolute top-4 right-4 sm:static sm:order-last">
                            <button
                                onClick={() => {
                                    setShowEditProfile(true);
                                    hideBottomNav();
                                }}
                                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-md shadow-sm group"
                            >
                                <Edit2 size={18} className="group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                    </div>

                    {/* Stats & Territories */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-2">
                        {/* XP Badge - FIXED VISIBILITY */}
                        <div className="bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-full flex items-center gap-1.5 text-yellow-400 font-bold text-[10px] sm:text-xs shadow-sm backdrop-blur-sm">
                            <Trophy size={12} className="sm:w-4 sm:h-4" />
                            <span>{Math.floor(displayProfile.xp)} XP</span>
                        </div>

                        {/* Gym Tags - FIXED BORDERS & BACKGROUND */}
                        {userGyms.map(gym => (
                            <Link key={gym.gym_id} to={`/territory/${gym.gym_id}`} className="bg-neutral-800 border border-neutral-700 px-2 py-1 rounded-full flex items-center gap-1.5 text-neutral-300 text-[10px] sm:text-xs hover:border-gym-primary/50 hover:text-white hover:bg-neutral-700 transition-all no-underline shadow-sm hover:shadow-[0_0_15px_rgba(250,204,21,0.1)]">
                                <MapPin size={12} className={`sm:w-4 sm:h-4 ${gym.is_home_base ? "text-gym-primary" : "text-neutral-500"}`} />
                                <span className="truncate max-w-[90px] sm:max-w-[120px]">{gym.gym_name}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Actions / Passport Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4">
                <Link id="tut-global-arsenal-btn" to="/arsenal" onClick={() => { if (tutorialStep === 1) localStorage.setItem('tutorial_step', '2'); }} className="group bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-500/50 p-3 md:p-6 rounded-xl md:rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 md:gap-4 text-center no-underline shadow-sm hover:shadow-md">
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-blue-500/5 flex items-center justify-center group-hover:scale-110 transition-transform border border-blue-500/10">
                        <Dumbbell className="text-blue-500 w-4 h-4 md:w-6 md:h-6" />
                    </div>
                    <span className="font-bold text-neutral-200 group-hover:text-white text-xs md:text-base">Crear mis Rutinas</span>
                </Link>

                <Link to="/stats" className="group bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-green-500/50 p-3 md:p-6 rounded-xl md:rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 md:gap-4 text-center no-underline shadow-sm hover:shadow-md">
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-green-500/5 flex items-center justify-center group-hover:scale-110 transition-transform border border-green-500/10">
                        <LineChart className="text-green-500 w-4 h-4 md:w-6 md:h-6" />
                    </div>
                    <span className="font-bold text-neutral-200 group-hover:text-white text-xs md:text-base">Stats</span>
                </Link>

                <Link to="/history" className="group bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-orange-500/50 p-3 md:p-6 rounded-xl md:rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 md:gap-4 text-center no-underline shadow-sm hover:shadow-md">
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-orange-500/5 flex items-center justify-center group-hover:scale-110 transition-transform border border-orange-500/10">
                        <History className="text-orange-500 w-4 h-4 md:w-6 md:h-6" />
                    </div>
                    <span className="font-bold text-neutral-200 group-hover:text-white text-xs md:text-base">Historial</span>
                </Link>

                {/* BUTTON HIDDEN: Mis Posts
                <button
                    onClick={() => setShowSocialProfile(true)}
                    className="group bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-yellow-500/50 p-3 md:p-6 rounded-xl md:rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 md:gap-4 text-center no-underline shadow-sm hover:shadow-md cursor-pointer"
                >
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-yellow-500/5 flex items-center justify-center group-hover:scale-110 transition-transform border border-yellow-500/10">
                        <Grid className="text-yellow-500 w-4 h-4 md:w-6 md:h-6" />
                    </div>
                    <span className="font-bold text-neutral-200 group-hover:text-white text-xs md:text-base">Mis Posts</span>
                </button>
                */}

                {/* INVITE FRIENDS - MOVED HERE */}
                {/* INVITE FRIENDS - MOVED HERE */}
                {/* BUTTON HIDDEN: INVITE FRIENDS (Requested by User)
                <button
                    onClick={() => setShowReferralModal(true)}
                    className="col-span-2 sm:col-span-1 group bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 hover:border-yellow-500/50 p-3 md:p-6 rounded-xl md:rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 md:gap-4 text-center no-underline shadow-sm hover:shadow-md"
                >
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-yellow-500 text-black flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-yellow-500/20">
                        <UserPlus size={18} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-yellow-500 text-xs md:text-base">INVITAR</span>
                        <span className="text-[10px] font-bold text-yellow-500/70">+250 XP</span>
                    </div>
                </button>
                */}
            </div>

            {/* TERRITORIES SECTION (PASSPORT) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
                        <MapPin className="text-gym-primary" />
                        Mis Territorios
                    </h2>
                    <button
                        id="tut-find-gyms-btn"
                        onClick={() => navigate('/map')}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-gym-primary/10 border border-gym-primary/30 text-gym-primary text-xs font-black uppercase tracking-widest hover:bg-gym-primary hover:text-black transition-all hover:scale-105 hover:shadow-[0_0_15px_rgba(229,255,0,0.3)]"
                    >
                        <Search size={14} strokeWidth={3} />
                        Encontrar Gimnasios
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userGyms.map((gym, index) => {


                        return (
                            <div id={`tut-gym-card-${index}`} key={gym.gym_id} onClick={() => {
                                if (localStorage.getItem('tutorial_step') === '3') localStorage.setItem('tutorial_step', '4');
                                if (localStorage.getItem('tutorial_step') === '5') localStorage.setItem('tutorial_step', '6');
                            }} className={`bg-neutral-900 border ${gym.is_home_base ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : 'border-neutral-800'} p-3 md:p-6 rounded-xl md:rounded-2xl flex items-center justify-between group hover:border-gym-primary/30 transition-colors shadow-sm relative overflow-hidden`}>
                                <div className="flex-1 min-w-0 mr-3">
                                    <h3 className={`font-bold text-sm md:text-lg mb-0.5 md:mb-1 transition-colors truncate max-w-[200px] md:max-w-none flex items-center gap-2 ${gym.is_home_base ? 'text-yellow-400' : 'text-white'}`}>
                                        {gym.gym_name}
                                        {gym.is_home_base && <Star size={14} fill="currentColor" className="text-yellow-500" />}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs md:text-sm text-neutral-400">
                                        {gym.is_home_base && (
                                            <span className="bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded text-[10px] md:text-xs font-bold border border-yellow-500/20 flex items-center gap-1">
                                                <Star size={10} fill="currentColor" />
                                                SEDE PRINCIPAL
                                            </span>
                                        )}
                                        <span>Items: {gym.equipment_count || 0}</span>
                                    </div>
                                </div>

                                {/* ACTION BUTTONS */}
                                <div className="flex items-center gap-3 shrink-0">
                                    {/* ALWAYS SHOW ACTIONS (Requested by User) */}
                                    <div className="flex flex-col items-center gap-1">
                                        <button
                                            id={`tut-start-workout-btn-${index}`}
                                            onClick={() => handleStartWorkout(gym)}
                                            disabled={verifyingLocation === gym.gym_id}
                                            className={`bg-gym-primary text-black w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2 rounded-lg md:rounded-xl transition-all hover:scale-105 font-bold flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(250,204,21,0.2)] ${verifyingLocation === gym.gym_id ? 'opacity-80 cursor-wait' : ''}`}
                                        >
                                            {verifyingLocation === gym.gym_id ? (
                                                <Loader size={18} className="animate-spin" />
                                            ) : (
                                                <Swords size={18} strokeWidth={2.5} />
                                            )}
                                            <span className="hidden md:inline text-xs">
                                                {verifyingLocation === gym.gym_id ? 'VERIFICANDO...' : 'INICIAR'}
                                            </span>
                                        </button>
                                        <span className="text-[9px] font-bold text-gym-primary uppercase tracking-tight text-center max-w-[60px] leading-tight md:hidden">Iniciar entrenamiento</span>
                                    </div>

                                    <div className="flex flex-col items-center gap-1">
                                        <Link
                                            id={`tut-config-gym-btn-${index}`}
                                            to={`/territory/${gym.gym_id}/arsenal`}
                                            onClick={() => {
                                                // Ensure tutorial advances if blindly following flow
                                                if (localStorage.getItem('tutorial_step') === '5') {
                                                    localStorage.setItem('tutorial_step', '6');
                                                }
                                            }}
                                            className="bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2 rounded-lg md:rounded-xl transition-all font-bold flex items-center justify-center gap-2 border border-neutral-700 hover:border-white/20"
                                        >
                                            <Dumbbell size={18} />
                                            <span className="hidden md:inline text-xs">CONFIG</span>
                                        </Link>
                                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-tight text-center max-w-[60px] leading-tight md:hidden">Configurar gym</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Add New Territory Button */}

                </div>
            </div>

            {/* Add Gym Modal */}


            {/* EDIT PROFILE MODAL */}
            {showEditProfile && profile && (
                <EditProfileModal
                    user={user}
                    currentUsername={profile.username || user.user_metadata.full_name}
                    currentAvatarUrl={profile.avatar_url || user.user_metadata.avatar_url}
                    currentBannerUrl={profile.custom_settings?.banner_url}
                    currentFeaturedRoutineId={profile.featured_routine_id}
                    onClose={() => {
                        setShowEditProfile(false);
                        showBottomNav();
                    }}
                    onUpdate={loadUserData}
                />
            )}

            {/* SOCIAL PROFILE MODAL */}
            {showSocialProfile && user && (
                <PlayerProfileModal
                    player={{
                        id: user.id,
                        username: profile?.username || user.user_metadata.full_name,
                        avatar_url: profile?.avatar_url || user.user_metadata.avatar_url,
                        xp: profile?.xp || 0,
                        rank: (profile?.rank || 0) as number, // Cast if enum mismatch
                        banner_url: profile?.custom_settings?.banner_url
                    }}
                    onClose={() => setShowSocialProfile(false)}
                />
            )}










            {/* TUTORIAL STEP 1: Global Arsenal (Create Routine) */}
            {tutorialStep === 1 && (
                <InteractiveOverlay
                    targetId="tut-global-arsenal-btn"
                    title="PASO 1: CREAR MIS RUTINAS"
                    message="Haz clic en 'Crear mis Rutinas' para forjar tu primera estrategia de combate."
                    step={1}
                    totalSteps={7}
                    onNext={() => { }}
                    onClose={() => {
                        setTutorialStep(0);
                        localStorage.setItem('tutorial_step', '0');
                        localStorage.setItem('hasSeenGlobalTutorial', 'true'); // Pivot point: Mark GLOBAL as seen
                        localStorage.setItem('hasSeenImportTutorial', 'true');
                    }}
                    placement="top"
                    disableNext={true}
                />
            )}

            {/* TUTORIAL STEP 5: Find Gym on Map */}
            {tutorialStep === 5 && (
                <InteractiveOverlay
                    targetId="tut-find-gyms-btn"
                    title="PASO 5: BUSCA TU GIMNASIO"
                    message="Haz clic en 'Encontrar Gimnasios' para ir al mapa. Luego, usa el buscador para encontrar tu gimnasio (ej: 'Spartanos') y selecciónalo para agregarlo a tu mapa."
                    step={5}
                    totalSteps={7}
                    onNext={() => { }}
                    onClose={() => {
                        setTutorialStep(0);
                        localStorage.setItem('tutorial_step', '0');
                    }}
                    placement="bottom"
                    disableNext={true}
                />
            )}

            {/* TUTORIAL STEP 7: Start Workout (Final) */}
            {tutorialStep === 7 && !locationError.isOpen && (
                <InteractiveOverlay
                    targetId="tut-start-workout-btn-0"
                    title="PASO FINAL: INICIAR ENTRENAMIENTO"
                    message="¡Todo listo! Inicia tu entrenamiento (Verificación GPS requerida)."
                    step={7}
                    totalSteps={7}
                    onNext={() => {
                        setTutorialStep(0);
                        localStorage.setItem('tutorial_step', '0'); // Fixes persistence loop
                        localStorage.setItem('hasSeenImportTutorial', 'true');
                    }}
                    onClose={() => {
                        setTutorialStep(0);
                        localStorage.setItem('tutorial_step', '0'); // Fixes persistence loop
                        localStorage.setItem('hasSeenImportTutorial', 'true');
                    }}
                    placement="top"
                    disableNext={false}
                    nextLabel="ENTENDIDO"
                />
            )}

            <div className="flex flex-col items-center gap-4 mt-12 pb-12 opacity-50 hover:opacity-100 transition-opacity">
                <button
                    onClick={() => {
                        // 1. Force Scroll Top Instantly
                        window.scrollTo(0, 0);

                        // 2. Restart Unified Flow (Step 1)
                        localStorage.removeItem('hasSeenImportTutorial');
                        localStorage.setItem('tutorial_step', '1');
                        setTutorialStep(0); // Force re-render
                        setTimeout(() => {
                            setTutorialStep(1);
                        }, 50);
                    }}
                    className="flex items-center gap-2 px-8 py-3 rounded-full border border-neutral-800 bg-neutral-900/50 text-neutral-400 text-xs font-bold hover:bg-gym-primary/10 hover:text-white hover:border-gym-primary/50 transition-all uppercase tracking-widest"
                >
                    <span>INICIAR TUTORIAL</span>
                </button>
            </div>



            {/* MODALS */}
            <ReferralModal
                isOpen={showReferralModal}
                onClose={() => setShowReferralModal(false)}
                user={user}
            />    {/* LOCATION ACCESS MODAL */}
            <LocationAccessModal
                isOpen={locationError.isOpen}
                onClose={() => setLocationError(prev => ({ ...prev, isOpen: false }))}
                gymName={locationError.gymName}
                distanceMeters={locationError.distanceMeters}
                maxDistance={200}
                errorType={locationError.errorType}

            />

            {/* TUTORIAL STEP 6 Overlay */}
            {tutorialStep === 6 && userGyms.length > 0 && (
                <InteractiveOverlay
                    targetId={`tut-config-gym-btn-${userGyms.length - 1}`}
                    title="PASO 6: PREPARATIVOS"
                    message="¡Base establecida! Ahora entra a configurar el equipo de tu gimnasio."
                    step={6}
                    totalSteps={7}
                    onClose={() => { }}
                    placement="top"
                    nonBlocking={true}
                    disableNext={true}
                />
            )}
        </div>
    );
};

// --- HELPER FUNCTIONS ---

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);  // deg2rad below
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}
