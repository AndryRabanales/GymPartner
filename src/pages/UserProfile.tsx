import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { MapPin, Edit2, LogIn, Loader, Swords, Dumbbell, LineChart, History, Star, Search, ArrowLeft, ArrowRight, Crown, Map as MapIcon, Image as ImageIcon, Palette, Dices, Coins, Share2, Trash2, Heart, X } from 'lucide-react'; // Added Dices, Share2, Trash2
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
import { BoostModal } from '../components/profile/BoostModal';
import { cloudinaryService } from '../services/CloudinaryService';


import { userService } from '../services/UserService';
import type { UserPrimaryGym } from '../services/UserService';
import { socialService } from '../services/SocialService';
import { EquipmentForm } from '../components/arsenal/EquipmentForm';
import { getCurrentPosition } from '../utils/geolocationUtils';
import { normalizeText, getMuscleGroup } from '../utils/inventoryUtils';
import { StreakFlame } from '../components/gamification/StreakFlame';
import { alphaService } from '../services/AlphaService';
import { workoutService } from '../services/WorkoutService';
import { useBottomNav } from '../context/BottomNavContext';
import { TierService } from '../services/TierService';
import { seedExercisesCatalog } from '../services/ExerciseSeeder';



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
    boost_until?: string;
}

const isDefaultBio = (bio?: string | null) => {
    if (!bio) return true;
    const clean = bio.trim().toLowerCase();
    return (
        clean === '¡hola! soy un nuevo atleta en ginx.' ||
        clean === 'hola! soy un nuevo atleta en ginx.' ||
        clean === 'hola soy un nuevo atleta en ginx.' ||
        clean === '¡hola! soy un nuevo atleta en gympartner.' ||
        clean === 'hola! soy un nuevo atleta en gympartner.' ||
        clean === 'hola soy un nuevo atleta en gympartner.' ||
        clean.includes('entrenando duro para subir de rango') ||
        clean.includes('entrenando para alcanzar el siguiente nivel') ||
        clean === 'entrenando duro en ginx.' ||
        clean === 'entrenando duro en gympartner.'
    );
};

export const UserProfile = () => {
    const { user, loading: authLoading } = useAuth();
    const { hideBottomNav, showBottomNav } = useBottomNav();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [userGyms, setUserGyms] = useState<UserPrimaryGym[]>([]);
    const [routines, setRoutines] = useState<any[]>([]);


    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showSocialProfile, setShowSocialProfile] = useState(false);
    const [showGymsModal, setShowGymsModal] = useState(false);
    const [showAllTagsModal, setShowAllTagsModal] = useState(false);
    const [skipOnboarding, setSkipOnboarding] = useState(true); // Default to TRUE: Skip onboarding completely and show main dashboard directly

    const hasSeededRef = useRef(false); // Track if we've run the seeder

    const navigate = useNavigate();


    // Modal State
    const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);
    const [isBoosting, setIsBoosting] = useState(false);

    const handleBoostConfirm = async () => {
        if (!user || isBoosting) return;
        setIsBoosting(true);
        try {
            const success = await userService.spendGPoints(user.id, 1000, 'profile_boost');
            if (success) {
                setIsBoostModalOpen(false);
                loadUserData(); // Refetch profile to show new boost_until
            }
        } catch (err) {
            console.error('Error activating boost:', err);
        } finally {
            setIsBoosting(false);
        }
    };
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


    // NEW: Base Creation Modal State
    const [startConfirmationModal, setStartConfirmationModal] = useState<{
        isOpen: boolean;
        type: 'GYM_FOUND' | 'NO_GYM';
        gymData?: UserPrimaryGym;
        location?: { lat: number, lng: number };
    }>({ isOpen: false, type: 'NO_GYM' });

    // NEW: Auto-Start Overlay State
    const [autoStartGymName, setAutoStartGymName] = useState<string | null>(null);
    const [startLoading, setStartLoading] = useState(false);

    useEffect(() => {
        if (user) {
            loadUserData();
            // Fetch Social Stats
            socialService.getProfileStats(user.id).then(setSocialStats);

            // Check Routine Count REMOVED - Strict User Request: Only start if New User or Explicit Click.


            // Short delay for better UX
            // Seed DB with new defaults (Background) - Run Only Once
            if (!hasSeededRef.current) {
                hasSeededRef.current = true;
                seedExercisesCatalog().catch(console.error);
            }
        } else {
            setLoading(false);
        }
    }, [user]);

    // Auto-redirect guest if entering from Instagram/Meta
    useEffect(() => {
        if (!authLoading && !user) {
            const params = new URLSearchParams(window.location.search);
            const fromInstagram =
                params.get('utm_source') === 'instagram' ||
                params.get('ref') === 'instagram' ||
                params.get('ref') === 'ig' ||
                document.referrer.includes('instagram.com') ||
                document.referrer.includes('facebook.com');

            if (fromInstagram) {
                console.log("⚡ [UserProfile Auto-Redirect] Redirecting Instagram guest to login page for instant auth...");
                navigate(`/login${window.location.search}`);
            }
        }
    }, [user, authLoading]);
    useEffect(() => {
        if (user && userGyms.length > 0) {
            loadAlphaData();
        }
    }, [user, userGyms]);



    /**
     * GEOLOCATION SECURITY CHECK
     * Users must be within range (e.g. 200m) of the gym to start a workout.
     */


    const handleShareProfile = async () => {
        const username = profile?.username || user?.user_metadata?.full_name || 'atleta';
        const profileUrl = `${window.location.origin}/player/${user?.id}`;
        navigator.clipboard.writeText(profileUrl);
        // GX (+5) is awarded via processReferral() when the invited user
        // actually completes registration — NOT on share click.
        alert('🚀 ¡Enlace copiado! Cuando alguien se registre usando tu enlace, ganarás +5 GX.');
    };

    const loadUserData = async () => {
        const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Atleta';
        const defaultUsername = fullName
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .substring(0, 30);
        const defaultAvatar = user?.user_metadata?.avatar_url || '';

        // Keep loading=true until real DB data arrives - prevents the flash of incomplete content
        try {
            let { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user!.id)
                .maybeSingle();

            if (error) {
                console.error("❌ [loadUserData Error] Supabase profiles fetch failed:", error);
                setLoading(false);
                return;
            }

            let profileData = data;
            if (!profileData) {
                console.log("⚠️ [loadUserData] Profile not found. Auto-creating...");
                const newProfile = {
                    id: user!.id,
                    username: defaultUsername,
                    avatar_url: defaultAvatar,
                    description: '¡Hola! Soy un nuevo atleta en Ginx.',
                    g_points: 1000,
                    total_referrals: 0,
                    checkins_count: 0
                };

                const { data: insertedData, error: insertError } = await supabase
                    .from('profiles')
                    .insert(newProfile)
                    .select()
                    .single();

                if (insertError) {
                    console.error("❌ [loadUserData Error] Auto-profile insert failed:", insertError);
                } else {
                    console.log("✅ [loadUserData] Auto-profile created!");
                    profileData = insertedData;
                }
            }


            if (profileData) {
                setProfile(profileData);

                // REFERRAL CHECK
                const pendingRef = sessionStorage.getItem('gym_referral_id');
                if (pendingRef && !profileData.referred_by && pendingRef !== user!.id) {
                    const { error: refError } = await supabase
                        .from('profiles')
                        .update({ referred_by: pendingRef })
                        .eq('id', user!.id);
                    if (!refError) {
                        sessionStorage.removeItem('gym_referral_id');
                        console.log("✅ [loadUserData] Referral recorded!");
                        alert("🎖️ ¡Has sido registrado con éxito! Quien te refirió recibirá su recompensa pronto.");
                    } else {
                        console.error("❌ [loadUserData] Referral failed:", refError);
                    }
                }
            }
        } catch (err) {
            console.error("❌ [loadUserData] Unexpected error:", err);
        } finally {
            setLoading(false);
        }

        // Load gyms in background (doesn't block profile render)
        (async () => {
            try {
                if (!user) return;
                const gyms = await userService.getUserGyms(user.id);
                const sortedGyms = gyms.sort((a, b) => {
                    if (a.is_home_base === b.is_home_base) return 0;
                    return a.is_home_base ? -1 : 1;
                });
                setUserGyms(sortedGyms);
            } catch (gymsErr) {
                console.error("❌ [loadUserData] User gyms fetch failed:", gymsErr);
            }
        })();

        // Load and sort routines in background
        (async () => {
            try {
                if (!user) return;
                const [allRoutines, sessionHistory] = await Promise.all([
                    workoutService.getUserRoutines(user.id, null),
                    supabase
                        .from('workout_sessions')
                        .select('routine_name')
                        .eq('user_id', user.id)
                        .not('finished_at', 'is', null)
                ]);

                // Count frequency of each routine name
                const frequencyMap: Record<string, number> = {};
                sessionHistory.data?.forEach(s => {
                    if (s.routine_name) {
                        frequencyMap[s.routine_name] = (frequencyMap[s.routine_name] || 0) + 1;
                    }
                });

                // Sort routines by frequency descending
                const sorted = [...allRoutines].sort((a, b) => {
                    const countA = frequencyMap[a.name] || 0;
                    const countB = frequencyMap[b.name] || 0;
                    return countB - countA;
                });

                setRoutines(sorted);
            } catch (err) {
                console.error("❌ [loadUserData] Routines fetch failed:", err);
            }
        })();
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
            <div className="fixed inset-0 bg-neutral-950 flex flex-col overflow-hidden">
                {/* Background glow */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gym-primary/8 rounded-full blur-[100px] pointer-events-none" />

                {/* Hero — fills available space */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center relative z-10 min-h-0">
                    <div className="bg-gym-primary/10 px-4 py-1.5 rounded-full border border-gym-primary/20 mb-4">
                        <span className="text-gym-primary font-bold text-xs tracking-widest uppercase">La Evolución del Entrenamiento</span>
                    </div>

                    <h1 className="text-4xl font-black text-white leading-tight uppercase italic mb-3">
                        Tu Gimnasio <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-gym-primary to-yellow-200">Inteligente</span>
                    </h1>

                    <p className="text-neutral-400 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
                        Deja de adivinar. Domina tu entorno.<br />
                        Mapa, progreso y rango social en una sola app.
                    </p>

                    <Link
                        to="/login"
                        className="bg-gym-primary text-black font-black text-base px-10 py-4 rounded-[2rem] shadow-[0_0_30px_rgba(250,204,21,0.4)] flex items-center justify-center gap-2 no-underline italic tracking-tighter active:scale-95 transition-all"
                    >
                        <LogIn size={20} strokeWidth={3} />
                        INICIAR SESIÓN
                    </Link>
                </div>

                {/* Features bar — compact, always visible at bottom */}
                <div className="grid grid-cols-3 border-t border-white/5 shrink-0">
                    <div className="bg-neutral-950 p-3 text-center border-r border-white/5">
                        <div className="bg-blue-500/10 w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-1.5">
                            <MapPin size={18} className="text-blue-500" />
                        </div>
                        <h3 className="text-[10px] font-black text-white uppercase italic">La Sede</h3>
                        <p className="text-[9px] text-neutral-600 leading-tight mt-0.5">Tu gimnasio en el mapa</p>
                    </div>
                    <div className="bg-neutral-950 p-3 text-center border-r border-white/5">
                        <div className="bg-purple-500/10 w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-1.5">
                            <Dumbbell size={18} className="text-purple-500" />
                        </div>
                        <h3 className="text-[10px] font-black text-white uppercase italic">Inventario</h3>
                        <p className="text-[9px] text-neutral-600 leading-tight mt-0.5">Equipo disponible</p>
                    </div>
                    <div className="bg-neutral-950 p-3 text-center">
                        <div className="bg-green-500/10 w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-1.5">
                            <Swords size={18} className="text-green-500" />
                        </div>
                        <h3 className="text-[10px] font-black text-white uppercase italic">Entrenamiento</h3>
                        <p className="text-[9px] text-neutral-600 leading-tight mt-0.5">Progreso real</p>
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
                                RECLAMA TU <span className="text-gym-primary">PRIMER GIMNASIO</span>
                            </h1>
                            <p className="text-neutral-500 font-bold tracking-widest uppercase text-xs md:text-sm">
                                Buscando gimnasios cercanos... Encuentra tu gimnasio en el mapa.
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
                                <span>ABRIR MAPA</span>
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
                            <div className="text-[10px] font-black text-white uppercase tracking-widest">Configura tu Equipo</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }



    // Use new leveling logic
    // const { currentLevel, progressPercent } = getXPProgress(displayProfile.xp);
    // const realRank = getRankFromXP(displayProfile.xp);
    const userAvatar = profile?.avatar_url || user.user_metadata.avatar_url || 'https://i.pravatar.cc/300';

    // NEW: Calculate Dominance Tier
    const currentTier = TierService.getTier(profile?.checkins_count || 0);
    const tierProgress = TierService.getProgress(profile?.checkins_count || 0);
    // const nextTier = TierService.getNextTier(currentTier.level);

    return (
        <div className="w-full max-w-7xl mx-auto px-1 py-3 sm:p-6 space-y-3 sm:space-y-4 pb-24">
            {/* Header Profile Card - Premium Hextech Cybernetic Design (Occupies 96% Width) */}
            <div className="w-[96%] mx-auto">
                <div className="bg-gradient-to-r from-yellow-500 via-amber-500 to-neutral-700 p-[1.5px] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] w-full">
                    <div
                        className="bg-neutral-900/95 backdrop-blur-xl rounded-[14px] p-3 sm:p-4 relative overflow-hidden transition-all group w-full h-[360px] min-h-[360px] flex flex-col justify-between"
                        style={profile?.custom_settings?.banner_url ? {
                            backgroundImage: `url(${cloudinaryService.getOptimizedImageUrl(profile.custom_settings.banner_url, { width: 800, height: 360, crop: 'fill' })})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            height: '360px'
                        } : { height: '360px' }}
                    >
                        {/* Banner Overlay for Readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/60 to-neutral-950/20 z-0"></div>

                        {/* Absolute Edit Pencil Button on the Top Right Corner (Larger & Cornered tightly) */}
                        <button
                            onClick={() => {
                                setShowEditProfile(true);
                                hideBottomNav();
                            }}
                            className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 border border-white/10 hover:border-white/30 hover:bg-black/80 flex items-center justify-center text-neutral-400 hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-md shrink-0 cursor-pointer"
                            title="Editar Perfil"
                        >
                            <Edit2 size={15} />
                        </button>

                        {/* Top Section: Avatar + Info (pr-10 to avoid overlap with absolute pencil) */}
                        <div className="relative z-10 flex flex-row items-center gap-3 sm:gap-4 w-full pr-10">
                            {/* Avatar Section: Clean & Premium (Larger circle!) */}
                            <div className="relative shrink-0 flex flex-col items-center">
                                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-gym-primary/40 bg-neutral-800 shadow-[0_0_15px_rgba(250,204,21,0.2)] group-hover:shadow-[0_0_25px_rgba(250,204,21,0.4)] transition-all animate-in zoom-in duration-300">
                                    <img
                                        src={cloudinaryService.getOptimizedImageUrl(userAvatar, { width: 200, height: 200 })}
                                        alt="Profile"
                                        loading="eager"
                                        decoding="async"
                                        className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-700"
                                    />
                                </div>
                            </div>

                            {/* User Info & Stats Block: All compacted nicely here */}
                            <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
                                {/* Top Row: Full Name (Character-limited to 20, larger font size, no dots!) */}
                                <div className="flex items-center w-full min-w-0">
                                    <h1 className="text-base xs:text-lg sm:text-xl md:text-2xl font-black text-white hover:text-gym-primary transition-colors tracking-tighter uppercase italic leading-none whitespace-nowrap overflow-visible pr-2">
                                        {(() => {
                                            const rawName = profile?.username || user.user_metadata.full_name || '';
                                            return rawName.length > 20 ? rawName.slice(0, 20) : rawName;
                                        })()}
                                    </h1>
                                </div>

                                {/* Second Row: Follow Stats & Streak flame side-by-side (Enforced NO WRAP!) */}
                                <div className="flex flex-row items-center gap-1.5 sm:gap-2 w-full flex-nowrap overflow-visible">
                                    <div 
                                        className="flex items-center gap-1.5 text-[9px] xs:text-[10px] sm:text-xs font-bold text-neutral-300 bg-black/40 backdrop-blur-md px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-white/5 cursor-pointer hover:bg-white/5 transition-colors shrink-0"
                                        onClick={() => setShowSocialProfile(true)}
                                    >
                                        <span><strong className="text-gym-primary">{socialStats.followersCount}</strong> Seguidores</span>
                                        <span className="text-neutral-600">•</span>
                                        <span><strong className="text-white">{socialStats.followingCount}</strong> Siguiendo</span>
                                    </div>

                                    {/* STREAK FLAME (Placed next to Follow Stats, guaranteed same line!) */}
                                    <div className="shrink-0 scale-95 sm:scale-100 origin-left">
                                        <StreakFlame count={profile?.checkins_count || 0} size="sm" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Row / Card Footer: Bio & Gym Tags aligned neatly at the bottom */}
                        <div className="relative z-10 flex flex-col gap-2 mt-auto pt-2 border-t border-white/5 w-full">
                            {/* Description & Share Row */}
                            <div className="flex flex-row items-center justify-between gap-3 w-full">
                                {!(profile?.custom_settings?.description || profile?.description ? isDefaultBio(profile?.custom_settings?.description || profile?.description) : true) ? (
                                    <p className="text-neutral-400 text-[10px] sm:text-[11px] leading-snug italic truncate max-w-[70%]">
                                        &ldquo;{profile?.custom_settings?.description || profile?.description}&rdquo;
                                    </p>
                                ) : (
                                    <p className="text-neutral-500 text-[10px] sm:text-[11px] leading-snug italic truncate max-w-[70%]">
                                        &ldquo;Usuario sin descripción&rdquo;
                                    </p>
                                )}
                                
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleShareProfile();
                                    }}
                                    className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-1 text-[9px] sm:text-[10px] text-neutral-400 hover:text-gym-primary hover:bg-white/10 hover:border-gym-primary/30 transition-all backdrop-blur-md shrink-0 cursor-pointer"
                                    title="Compartir Perfil"
                                >
                                    <Share2 size={9} />
                                    <span>Compartir</span>
                                </button>
                            </div>

                            {/* Gym Tags: Under description, super compact, landscape shape! */}
                            <div className="flex flex-wrap items-center gap-1 w-full pt-1.5 border-t border-white/5 justify-start">
                                {(() => {
                                    // Sort gyms: Home Base first, then Favorites, then others
                                    const sortedGyms = [...userGyms].sort((a, b) => {
                                        if (a.is_home_base && !b.is_home_base) return -1;
                                        if (!a.is_home_base && b.is_home_base) return 1;
                                        if (a.is_favorite && !b.is_favorite) return -1;
                                        if (!a.is_favorite && b.is_favorite) return 1;
                                        return 0;
                                    });

                                    const limit = 6;
                                    const displayGyms = sortedGyms.slice(0, limit);
                                    const hasMore = sortedGyms.length > limit;
                                    const remainingCount = sortedGyms.length - limit;

                                    return (
                                        <>
                                            {displayGyms.map(gym => {
                                                let textColor = "text-neutral-300 hover:text-white";
                                                let iconColor = "text-neutral-500";
                                                let bgColor = "bg-neutral-800/40 hover:bg-neutral-700/60";
                                                let borderColor = "border-neutral-800/30 hover:border-neutral-500/50";

                                                if (gym.is_favorite) {
                                                    borderColor = "border-red-500/30 hover:border-red-500/50";
                                                    textColor = "text-red-400 hover:text-red-300";
                                                    iconColor = "text-red-500";
                                                    bgColor = "bg-red-500/5 hover:bg-red-500/15";
                                                } else if (gym.is_home_base) {
                                                    borderColor = "border-yellow-500/30 hover:border-yellow-500/50";
                                                    textColor = "text-yellow-400 hover:text-yellow-300";
                                                    iconColor = "text-yellow-500";
                                                    bgColor = "bg-yellow-500/5 hover:bg-yellow-500/15";
                                                }

                                                return (
                                                    <Link
                                                        key={gym.gym_id}
                                                        to={`/territory/${gym.gym_id}`}
                                                        className={`px-1.5 py-0.5 rounded-full flex items-center gap-1 text-[8px] sm:text-[9px] transition-all no-underline border inline-flex shrink-0 ${borderColor} ${textColor} ${bgColor}`}
                                                    >
                                                        <MapPin size={7} className={`${iconColor}`} />
                                                        <span className="truncate max-w-[65px] sm:max-w-[100px]">{gym.gym_name}</span>
                                                    </Link>
                                                );
                                            })}
                                            
                                            {hasMore && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowAllTagsModal(true);
                                                    }}
                                                    className="px-1.5 py-0.5 rounded-full flex items-center gap-1 text-[8px] sm:text-[9px] transition-all border border-gym-primary/20 text-gym-primary bg-gym-primary/5 hover:bg-gym-primary hover:text-black font-bold shrink-0 cursor-pointer"
                                                    title={`Ver ${remainingCount} gimnasios más`}
                                                >
                                                    <span>+{remainingCount}</span>
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        {/* Main content below profile card (Occupies 94% Width) */}
        <div className="w-[94%] mx-auto space-y-3 sm:space-y-4">
            {/* Ranking & Alpha Quick Info Row */}
            {(userRanking !== null || alphaHistory.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full animate-in fade-in duration-500">
                    {/* RANKING STATUS - TOP 10 */}
                    {userRanking !== null && (
                        <div className={`
                            bg-gradient-to-r rounded-2xl p-3 border shadow-md flex items-center gap-3
                            ${userRanking === 1 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20' :
                                userRanking === 2 ? 'from-gray-400/10 to-gray-500/10 border-gray-400/20' :
                                    userRanking === 3 ? 'from-amber-700/10 to-amber-800/10 border-amber-600/20' :
                                        'from-blue-500/10 to-blue-600/10 border-blue-500/20'}
                        `}>
                            <Crown size={20} className={`
                                fill-current shrink-0
                                ${userRanking === 1 ? 'text-yellow-500 animate-pulse' :
                                    userRanking === 2 ? 'text-gray-400' :
                                        userRanking === 3 ? 'text-amber-600' :
                                            'text-blue-500'}
                            `} />
                            <div className="text-left min-w-0">
                                <div className={`
                                    font-black text-xs sm:text-sm tracking-wider uppercase leading-none
                                    ${userRanking === 1 ? 'text-yellow-500' :
                                        userRanking === 2 ? 'text-gray-400' :
                                            userRanking === 3 ? 'text-amber-600' :
                                                'text-blue-400'}
                                `}>
                                    {userRanking === 1 ? '👑 TOP #1 DEL GYM' :
                                        userRanking === 2 ? '🥈 TOP #2 DEL GYM' :
                                            userRanking === 3 ? '🥉 TOP #3 DEL GYM' :
                                                `🏆 TOP #${userRanking} DEL GYM`}
                                </div>
                                <p className="text-[9px] text-neutral-500 font-bold uppercase mt-1">Líder activo en el ranking local</p>
                            </div>
                        </div>
                    )}

                    {/* HISTORIAL DE ALPHA */}
                    {alphaHistory.length > 0 && (
                        <div className="bg-neutral-900/50 backdrop-blur-md rounded-2xl p-3 border border-white/5 shadow-md flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0 border border-yellow-500/20">
                                    <Crown size={14} className="text-yellow-500 animate-pulse" />
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="text-[10px] font-black text-white uppercase tracking-wider leading-none">Historial de Alpha</p>
                                    <p className="text-[9px] text-neutral-400 font-bold uppercase mt-1 truncate max-w-[180px]">
                                        {alphaHistory[0].gym.name} ({alphaHistory[0].times_alpha}x)
                                    </p>
                                </div>
                            </div>
                            <div className="text-[9px] text-yellow-500 font-black italic bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20 shrink-0">
                                ACTIVE ALPHA
                            </div>
                        </div>
                    )}
                </div>
            )}

                {/* Primary Action & Quick Access */}
                <div className="flex flex-col gap-2 sm:gap-4">

                <button
                    onClick={() => {
                        // LIGHTNING START: Navigate immediately to WorkoutSession
                        // The WorkoutSession page handles GPS/Gym resolution while showing the intro animation
                        navigate('/workout');
                    }}
                    className="group relative overflow-hidden bg-gradient-to-r from-yellow-700 via-amber-800 to-black rounded-3xl p-[3px] shadow-[0_0_20px_rgba(234,179,8,0.2)] hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] hover:-translate-y-1 transition-all duration-300 active:scale-95 ring-4 ring-yellow-700/30 w-full"
                >
                    {/* Inner Glass Container */}
                    <div className="relative bg-black/25 backdrop-blur-md w-full h-full rounded-[22px] px-4 md:px-8 py-4 md:py-6 flex items-center justify-between border border-white/10 group-hover:bg-transparent transition-all">

                        {/* Left Side: Icon & Text */}
                        <div className="flex items-center gap-4 md:gap-6">
                            {/* Icon Circle */}
                            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-yellow-500 text-black flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shrink-0 animate-bounce">
                                {startLoading ? <Loader className="animate-spin w-6 h-6 md:w-8 md:h-8" /> : <Swords className="w-6 h-6 md:w-8 md:h-8" strokeWidth={2.5} />}
                            </div>

                            {/* Text Stack */}
                            <div className="flex flex-col items-start gap-0.5 md:gap-1 text-left">
                                <span className="font-black text-yellow-500 text-2xl md:text-4xl italic uppercase tracking-tighter leading-none drop-shadow-sm group-hover:text-white transition-colors">
                                    {startLoading ? 'INICIANDO...' : 'INICIAR'}
                                </span>
                                <span className="font-bold text-neutral-300 text-[10px] md:text-xs tracking-[0.2em] uppercase">
                                    Entrenamiento
                                </span>
                            </div>
                        </div>

                        {/* Right Side: Action Arrow */}
                        <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-yellow-500 flex items-center justify-center opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                            <ArrowRight className="text-black w-5 h-5 md:w-6 md:h-6" />
                        </div>

                        {/* Shine Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 translate-x-[-200%] group-hover:animate-shine pointer-events-none" />
                    </div>
                </button>

                {/* --- QUICK START ROUTINES (INICIO RÁPIDO) --- */}
                {routines.length > 0 && (
                    <div className="flex flex-col gap-2 w-full mt-2 sm:mt-3">
                        {routines.length > 8 && (
                            <div className="flex justify-end px-1">
                                <Link 
                                    to="/arsenal" 
                                    className="font-bold text-[9px] sm:text-[10px] text-gym-primary/70 hover:text-gym-primary transition-colors uppercase tracking-wider no-underline italic"
                                >
                                    Ver Todo
                                </Link>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 w-full">
                            {routines.slice(0, 8).map(routine => {
                                return (
                                    <button
                                        key={routine.id}
                                        onClick={() => navigate(`/workout?routineId=${routine.id}`)}
                                        className="group relative overflow-hidden bg-gradient-to-r from-yellow-400 via-amber-500 to-neutral-600 rounded-[20px] p-[2px] shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:shadow-[0_4px_20px_rgba(234,179,8,0.3)] hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-300 active:scale-95 w-full text-left"
                                    >
                                        {/* Inner Glass Container - Dark neutral layout with soft gold accents */}
                                        <div className="relative bg-gradient-to-r from-yellow-950/20 to-neutral-950 backdrop-blur-md w-full h-full rounded-[17px] px-2.5 py-2 flex items-center justify-between border border-white/5 transition-all z-10 gap-1.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-6 h-6 rounded-full bg-neutral-800 text-yellow-400 flex items-center justify-center shadow-lg animate-bounce shrink-0 border border-neutral-700/50">
                                                    <Swords className="w-3.5 h-3.5" strokeWidth={2.5} />
                                                </div>
                                                <span className="font-extrabold text-white text-[11px] sm:text-[13px] uppercase tracking-wider truncate max-w-[85px] sm:max-w-[125px] leading-tight group-hover:text-yellow-400 transition-colors">
                                                    {routine.name}
                                                </span>
                                            </div>
                                            <div className="w-5 h-5 rounded-full bg-black/30 text-yellow-400 flex items-center justify-center shrink-0 border border-white/5 group-hover:bg-yellow-400 group-hover:text-black transition-all duration-300">
                                                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                            </div>
                                        </div>
                                        
                                        {/* Hover Shine Effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 translate-x-[-200%] group-hover:animate-shine pointer-events-none z-20" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions Grid - 2x2 Layout */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
                {/* 1. RUTINAS */}
                <Link to="/arsenal" className="group bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-500/50 p-4 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 text-center no-underline shadow-sm hover:shadow-md">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform border border-blue-500/20">
                        <Dumbbell className="text-blue-500 w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-200 group-hover:text-white text-xs uppercase tracking-widest">Rutinas</span>
                </Link>

                {/* 2. MIS GIMNASIOS */}
                <button onClick={() => setShowGymsModal(true)} className="group bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-gym-primary/50 p-4 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 text-center shadow-sm hover:shadow-md w-full">
                    <div className="w-10 h-10 rounded-full bg-gym-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform border border-gym-primary/20">
                        <MapPin className="text-gym-primary w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-200 group-hover:text-white text-xs uppercase tracking-widest">Mis Gimnasios</span>
                </button>

                {/* 3. STATS */}
                <Link to="/stats" className="group bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-green-500/50 p-4 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 text-center no-underline shadow-sm hover:shadow-md">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform border border-green-500/20">
                        <LineChart className="text-green-500 w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-200 group-hover:text-white text-xs uppercase tracking-widest">Stats</span>
                </Link>

                {/* 4. HISTORIAL */}
                <Link to="/history" className="group bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-orange-500/50 p-4 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 text-center no-underline shadow-sm hover:shadow-md">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform border border-orange-500/20">
                        <History className="text-orange-500 w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-200 group-hover:text-white text-xs uppercase tracking-widest">Historial</span>
                </Link>
            </div>
        </div>

            {/* TERRITORIES SECTION (PASSPORT) - MODAL */}
            {showGymsModal && (
                <div className="fixed inset-0 z-[100] bg-neutral-950/95 backdrop-blur-xl flex flex-col p-4 md:p-8 overflow-y-auto">
                    <div className="max-w-4xl w-full mx-auto mt-4 md:mt-8 space-y-6 pb-24">
                        {/* Modal Header */}
                        <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                            <button onClick={() => setShowGymsModal(false)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                                <ArrowLeft size={20} />
                            </button>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
                                <MapPin className="text-gym-primary" />
                                Mis Gimnasios
                            </h2>
                            <button
                                onClick={() => { setShowGymsModal(false); navigate('/map'); }}
                                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-full bg-gym-primary/10 border border-gym-primary/30 text-gym-primary text-xs font-black uppercase tracking-widest hover:bg-gym-primary hover:text-black transition-all hover:scale-105 hover:shadow-[0_0_15px_rgba(229,255,0,0.3)]"
                            >
                                <Search size={14} strokeWidth={3} />
                                <span className="hidden sm:inline">Encontrar Gimnasios</span>
                            </button>
                        </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userGyms.map((gym) => {


                        return (
                            <div
                                key={gym.gym_id}
                                className={`bg-neutral-900 border ${gym.is_home_base ? 'border-yellow-500/50' : 'border-neutral-800'} p-3 md:p-6 rounded-xl md:rounded-2xl flex items-center justify-between group hover:border-gym-primary/30 transition-all shadow-sm relative overflow-hidden h-24 md:h-32`}
                                style={{
                                    backgroundImage: gym.custom_bg_url ? `url(${gym.custom_bg_url})` : undefined,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    backgroundColor: gym.custom_color || '#171717' // Default neutral-900
                                }}
                            >
                                {/* Overlay for readability if BG exists */}
                                <div className={`absolute inset-0 bg-black/60 transition-opacity ${gym.custom_bg_url ? 'opacity-70 group-hover:opacity-80' : 'opacity-0'}`} />

                                <div className="flex-1 min-w-0 mr-3 relative z-10">
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
                                    </div>
                                </div>

                                {/* Customization Controls (Visible on Hover/Focus) */}
                                <div className="relative z-10 flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    <button
                                        className={`p-2 bg-black/50 hover:bg-black/80 backdrop-blur-sm rounded-full text-white border transition-all relative overflow-hidden ${gym.is_home_base ? 'border-yellow-500 text-yellow-500' : 'border-white/10 hover:border-yellow-500/50'}`}
                                        title={gym.is_home_base ? "Quitar de Sede Principal" : "Hacer Sede Principal"}
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            const wantsToBeDefault = !gym.is_home_base;
                                            // Regla de unicidad: el predeterminado es permanente — para
                                            // cambiarlo, el usuario debe primero quitar el actual.
                                            if (wantsToBeDefault) {
                                                const currentDefault = userGyms.find(g => g.is_home_base && g.gym_id !== gym.gym_id);
                                                if (currentDefault) {
                                                    alert(`Ya tienes "${currentDefault.gym_name}" como Sede Principal. Quítala primero para poder elegir otra.`);
                                                    return;
                                                }
                                            }
                                            await userService.toggleHomeBase(user!.id, gym.gym_id, wantsToBeDefault);
                                            loadUserData();
                                        }}
                                    >
                                        <Star size={16} fill={gym.is_home_base ? "currentColor" : "none"} />
                                    </button>
                                    <button
                                        className={`p-2 bg-black/50 hover:bg-black/80 backdrop-blur-sm rounded-full text-white border transition-all relative overflow-hidden ${gym.is_favorite ? 'border-red-500 text-red-500' : 'border-white/10 hover:border-red-500/50'}`}
                                        title={gym.is_favorite ? "Quitar de Favoritos" : "Añadir a Favoritos"}
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await userService.toggleFavoriteGym(user!.id, gym.gym_id, !gym.is_favorite);
                                            loadUserData();
                                        }}
                                    >
                                        <Heart size={16} fill={gym.is_favorite ? "currentColor" : "none"} />
                                    </button>
                                    <button
                                        className="p-2 bg-black/50 hover:bg-red-500/80 backdrop-blur-sm rounded-full text-white border border-white/10 hover:border-red-500/50 transition-all relative overflow-hidden group/delete"
                                        title="Abandonar Gimnasio"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (confirm(`¿Estás seguro de que quieres abandonar ${gym.gym_name}? Se borrará de tu pasaporte.`)) {
                                                await userService.removeGymFromPassport(user!.id, gym.gym_id);
                                                loadUserData();
                                            }
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <button
                                        className="p-2 bg-black/50 hover:bg-black/80 backdrop-blur-sm rounded-full text-white border border-white/10 hover:border-gym-primary/50 transition-all relative overflow-hidden"
                                        title="Cambiar Fondo"
                                    >
                                        <ImageIcon size={16} />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    // 1. Upload
                                                    const { url, error } = await userService.uploadGymBackground(user!.id, gym.gym_id, file);

                                                    if (url) {
                                                        // 2. Save URL to DB & Reload
                                                        await userService.updateUserGymCustomization(user!.id, gym.gym_id, { custom_bg_url: url });
                                                        loadUserData();
                                                    } else {
                                                        alert("Error al subir la imagen. Verifica tu conexión.");
                                                        console.error(error);
                                                    }
                                                }
                                            }}
                                        />
                                    </button>
                                    <button
                                        className="p-2 bg-black/50 hover:bg-black/80 backdrop-blur-sm rounded-full text-white border border-white/10 hover:border-gym-primary/50 transition-all relative overflow-hidden"
                                        title="Cambiar Color"
                                    >
                                        <Palette size={16} />
                                        <input
                                            type="color"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            value={gym.custom_color || '#171717'} // Ensure controlled input for sync
                                            onInput={(e) => {
                                                // Optimistic update for Live Preview
                                                const newColor = (e.target as HTMLInputElement).value;
                                                setUserGyms(prev => prev.map(g => g.gym_id === gym.gym_id ? { ...g, custom_color: newColor } : g));
                                            }}
                                            onChange={(e) => {
                                                // Final commit to DB on release/close
                                                const newColor = e.target.value;
                                                userService.updateUserGymCustomization(user!.id, gym.gym_id, { custom_color: newColor }).then(() => {
                                                    // Optional: Reload purely to sync precise state if needed, but optimistic was likely accurate
                                                    // loadUserData();
                                                });
                                            }}
                                        />
                                    </button>
                                    <button
                                        className="p-2 bg-black/50 hover:bg-black/80 backdrop-blur-sm rounded-full text-white border border-white/10 hover:border-gym-primary/50 transition-all transform active:scale-95 active:rotate-180 duration-500"
                                        title="Color Aleatorio"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // 1. Generate Random Color
                                            const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

                                            // 2. Optimistic Update (Immediate Feedback)
                                            setUserGyms(prev => prev.map(g => g.gym_id === gym.gym_id ? { ...g, custom_color: randomColor } : g));

                                            // 3. Save to DB
                                            userService.updateUserGymCustomization(user!.id, gym.gym_id, { custom_color: randomColor });
                                        }}
                                    >
                                        <Dices size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Add New Territory Button */}

                </div>
            </div>
        </div>
        )}

            {/* Add Gym Modal */}


            {/* EDIT PROFILE MODAL */}
            {
                showEditProfile && profile && (
                    <EditProfileModal
                        user={user}
                        currentUsername={profile.username || user.user_metadata.full_name}
                        currentAvatarUrl={profile.avatar_url || user.user_metadata.avatar_url}
                        currentBannerUrl={profile.custom_settings?.banner_url}
                        currentFeaturedRoutineId={profile.featured_routine_id}
                        currentDescription={(profile.custom_settings as any)?.description || ''}
                        currentSettings={profile.custom_settings}
                        onClose={() => {
                            setShowEditProfile(false);
                            showBottomNav();
                        }}
                        onUpdate={loadUserData}
                    />
                )
            }

            {/* SOCIAL PROFILE MODAL */}
            {
                showSocialProfile && user && (
                    <PlayerProfileModal
                        player={{
                            id: user.id,
                            username: profile?.username || user.user_metadata.full_name,
                            avatar_url: profile?.avatar_url || user.user_metadata.avatar_url,
                            rank: (profile?.rank || 0) as number, // Cast if enum mismatch
                            banner_url: profile?.custom_settings?.banner_url
                        }}
                        onClose={() => setShowSocialProfile(false)}
                    />
                )
            }











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



            {/* NEW: STRATEGIC BASE CREATION MODAL */}
            {/* NEW: SMART START CONFIRMATION MODAL */}
            {
                startConfirmationModal.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                        <div className="bg-neutral-900 border border-gym-primary/30 rounded-3xl p-6 md:p-8 max-w-sm text-center shadow-[0_0_50px_rgba(250,204,21,0.2)] relative overflow-hidden">
                            {/* Background Effect */}
                            <div className="absolute inset-0 bg-gym-primary/5 pointer-events-none"></div>

                            <div className="mx-auto w-16 h-16 bg-gym-primary/10 rounded-full flex items-center justify-center mb-4 relative z-10 animate-pulse">
                                <MapPin className="text-gym-primary w-8 h-8" />
                            </div>

                            <h3 className="relative z-10 text-xl font-black text-white mb-2 uppercase italic tracking-tight">
                                {startConfirmationModal.type === 'GYM_FOUND' ? 'UBICACIÓN CONFIRMADA' : 'TERRITORIO DESCONOCIDO'}
                            </h3>

                            <p className="relative z-10 text-neutral-400 text-sm mb-6 uppercase font-bold">
                                {startConfirmationModal.type === 'GYM_FOUND' ? (
                                    <>
                                        TE ENCUENTRAS EN <span className="text-gym-primary">{startConfirmationModal.gymData?.gym_name}</span>
                                        <br />¿DESEAS CONTINUAR?
                                    </>
                                ) : (
                                    <>
                                        NO TE ENCUENTRAS EN NINGUN GYM
                                        <br /><span className="text-gym-primary">¿DESEAS CONTINUAR?</span>
                                    </>
                                )}
                            </p>

                            <div className="relative z-10 flex gap-3">
                                <button
                                    onClick={() => setStartConfirmationModal({ isOpen: false, type: 'NO_GYM' })}
                                    className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold py-3 rounded-xl transition-colors uppercase tracking-widest text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        const { type, gymData, location } = startConfirmationModal;
                                        setStartConfirmationModal({ isOpen: false, type: 'NO_GYM' }); // Close first

                                        if (type === 'GYM_FOUND' && gymData) {
                                            navigate(`/territory/${gymData.gym_id}/workout`);
                                        } else if (type === 'NO_GYM') {
                                            navigate('/workout');
                                        }
                                    }}
                                    className="flex-1 bg-gym-primary hover:bg-yellow-400 text-black font-black py-3 rounded-xl transition-colors uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(250,204,21,0.3)]"
                                >
                                    CONFIRMAR
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* NEW: AUTO-START OVERLAY */}
            {autoStartGymName && (


                <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center animate-in fade-in duration-500">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl animate-pulse"></div>
                        <MapIcon className="relative z-10 text-yellow-500 animate-bounce" size={64} />
                    </div>
                    <h2 className="text-2xl font-black italic uppercase text-white tracking-widest mb-2 text-center">
                        INICIANDO ENTRENAMIENTO<br />
                        <span className="text-yellow-400">{autoStartGymName || 'EN LUGAR DESCONOCIDO'}</span>
                    </h2>
                    <div className="flex gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce"></div>
                    </div>
                </div>
            )}
            {/* ALL TAGS MINI MODAL */}
            {showAllTagsModal && (
                <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowAllTagsModal(false)}>
                    <div 
                        className="bg-neutral-950/95 border border-white/10 rounded-[2rem] p-5 w-full max-w-sm flex flex-col relative animate-in zoom-in duration-200 shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setShowAllTagsModal(false)}
                            className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors cursor-pointer w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10"
                        >
                            <X size={16} />
                        </button>
                        <h3 className="font-black text-xs text-neutral-400 uppercase tracking-widest mb-4 pr-10 flex items-center gap-1.5 italic">
                            <MapPin size={14} className="text-gym-primary" />
                            Gimnasios Registrados ({userGyms.length})
                        </h3>
                        <div className="flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin justify-center sm:justify-start w-full">
                            {(() => {
                                const sortedGyms = [...userGyms].sort((a, b) => {
                                    if (a.is_home_base && !b.is_home_base) return -1;
                                    if (!a.is_home_base && b.is_home_base) return 1;
                                    if (a.is_favorite && !b.is_favorite) return -1;
                                    if (!a.is_favorite && b.is_favorite) return 1;
                                    return 0;
                                });

                                return sortedGyms.map(gym => {
                                    let textColor = "text-neutral-300 hover:text-white";
                                    let iconColor = "text-neutral-500";
                                    let bgColor = "bg-neutral-800/80 hover:bg-neutral-700/90";
                                    let borderColor = "border-neutral-800/50 hover:border-neutral-500";
                                    let shadow = "hover:shadow-sm";

                                    if (gym.is_favorite) {
                                        borderColor = "border-red-500/50 hover:border-red-500";
                                        textColor = "text-red-400 hover:text-red-300";
                                        iconColor = "text-red-500";
                                        bgColor = "bg-red-500/10 hover:bg-red-500/20";
                                        shadow = "hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]";
                                    } else if (gym.is_home_base) {
                                        borderColor = "border-yellow-500/50 hover:border-yellow-500";
                                        textColor = "text-yellow-400 hover:text-yellow-300";
                                        iconColor = "text-yellow-500";
                                        bgColor = "bg-yellow-500/10 hover:bg-yellow-500/20";
                                        shadow = "hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]";
                                    }

                                    return (
                                        <Link
                                            key={gym.gym_id}
                                            to={`/territory/${gym.gym_id}`}
                                            onClick={() => setShowAllTagsModal(false)}
                                            className={`px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1 text-[9px] sm:text-[10px] transition-all no-underline border inline-flex shrink-0 ${borderColor} ${textColor} ${bgColor} ${shadow}`}
                                        >
                                            <MapPin size={8} className={`sm:w-3 sm:h-3 ${iconColor}`} />
                                            <span className="truncate max-w-[95px] sm:max-w-[120px]">{gym.gym_name}</span>
                                        </Link>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            )}
            {/* BOOST MODAL */}
            <BoostModal 
                isOpen={isBoostModalOpen}
                onClose={() => setIsBoostModalOpen(false)}
                onConfirm={handleBoostConfirm}
                isBoosting={isBoosting}
                isActive={!!(profile?.boost_until && new Date(profile.boost_until) > new Date())}
                expiresAt={profile?.boost_until}
                currentPoints={profile?.g_points || 0}
            />
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
