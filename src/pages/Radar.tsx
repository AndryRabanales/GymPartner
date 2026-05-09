import { useState, useEffect, useRef } from 'react';
import { radarService, type RadarUser } from '../services/RadarService';
import { notificationService } from '../services/NotificationService';
import { cloudinaryService } from '../services/CloudinaryService';
import { Radar as RadarIcon, Dumbbell, X, UserPlus, Zap } from 'lucide-react';
import { useSwipe } from '../hooks/useSwipe';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/UserService';
import { supabase } from '../lib/supabase';
import { BoostModal } from '../components/profile/BoostModal';
import { socialService } from '../services/SocialService';
import { Star, ExternalLink, UserCheck, UserPlus, Swords } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Helper component for fade-in images with skeleton
const FadeInImage = ({ src, alt, className, imgClassName = "" }: { src: string; alt: string; className?: string; imgClassName?: string }) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    
    useEffect(() => {
        setLoaded(false);
        setError(false);
    }, [src]);

    return (
        <div className={`relative overflow-hidden ${className} bg-neutral-900`}>
            {/* Minimalist spinner while loading */}
            {!loaded && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-800">
                    <div className="w-5 h-5 border-2 border-gym-primary/10 border-t-gym-primary rounded-full animate-spin"></div>
                </div>
            )}
            
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 z-10">
                    <RadarIcon size={20} className="text-neutral-700 opacity-50" />
                </div>
            )}

            <img
                src={src}
                alt={alt}
                // We use opacity-0 until fully loaded to avoid the "pixel-by-pixel" look.
                // Since images are now tiny, the wait will be negligible.
                className={`w-full h-full object-cover transition-opacity duration-300 ${imgClassName} ${
                    loaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setLoaded(true)}
                onError={() => setError(true)}
                loading="eager"
            />
        </div>
    );
};


export const Radar = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [nearbyUsers, setNearbyUsers] = useState<RadarUser[]>([]);
    const [loading, setLoading] = useState(true); // Start loading immediately
    const [locationError, setLocationError] = useState<string | null>(null);
    const [radius] = useState(100);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [scanComplete, setScanComplete] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const initialized = useRef(false);
    const [direction, setDirection] = useState<'left' | 'right' | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isUserBoosted, setIsUserBoosted] = useState(false);
    const [isBoosting, setIsBoosting] = useState(false);
    const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);
    const [userPoints, setUserPoints] = useState(0);
    const [boostExpiresAt, setBoostExpiresAt] = useState<string | undefined>(undefined);

    // Swipe Hook
    const { swipeState, handlers: swipeHandlers } = useSwipe({
        onSwipeLeft: () => !isAnimating && handleAction('skip'),
        onSwipeRight: () => !isAnimating && handleAction('train'),
        threshold: 100
    });

    // Initial Scan logic with Caching
    const handleScan = async () => {
        setLoading(true);
        setLocationError(null);
        setScanComplete(false);

        // 1. Try to load from Cache first for instant feedback
        const cachedData = localStorage.getItem('gympartner_last_location');
        let hasInitialData = false;

        if (cachedData) {
            try {
                const { lat, lng, timestamp } = JSON.parse(cachedData);
                const ageMinutes = (Date.now() - (timestamp || 0)) / 60000;
                
                console.log(`⚡ Found cache (${Math.round(ageMinutes)}m old):`, lat, lng);
                
                const users = await radarService.getNearbyGymRats(lat, lng, radius);
                if (users.length > 0) {
                    setNearbyUsers(users);
                    setScanComplete(true);
                    setLoading(false);
                    hasInitialData = true;
                }
            } catch (e) {
                console.warn("Invalid cache location", e);
            }
        }

        if (!navigator.geolocation) {
            if (!hasInitialData) {
                setLocationError("Tu dispositivo no soporta geolocalización.");
                setLoading(false);
            }
            return;
        }

        // 2. Refresh with real GPS in background
        // We use a longer timeout (15s) to avoid unnecessary errors on slow fixes
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    
                    // Save to cache with timestamp
                    localStorage.setItem('gympartner_last_location', JSON.stringify({ 
                        lat: latitude, 
                        lng: longitude,
                        timestamp: Date.now()
                    }));

                    // Fetch fresh data
                    const users = await radarService.getNearbyGymRats(latitude, longitude, radius);
                    
                    if (users.length > 0) {
                        setNearbyUsers(users);
                        if (!hasInitialData) setCurrentIndex(0);
                        setScanComplete(true);
                    }
                } catch (err) {
                    console.error("GPS Fetch Error:", err);
                    if (!hasInitialData) setLocationError("Error al calibrar el radar. Reintenta.");
                } finally {
                    setLoading(false);
                }
            },
            (err) => {
                console.error("GPS Error:", err);
                // Only show error if we have NO data at all
                if (!hasInitialData) {
                    if (err.code === 1) setLocationError("Permiso de ubicación denegado.");
                    else if (err.code === 3) setLocationError("Tiempo de espera agotado. Reintenta en área abierta.");
                    else setLocationError("Se perdió la señal GPS.");
                    setLoading(false);
                }
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 } // 10 min cache
        );
    };

    // Check boost status
    useEffect(() => {
        if (!user) return;
        
        const checkBoost = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('g_points, boost_until')
                .eq('id', user.id)
                .single();
            
            if (data) {
                setUserPoints(data.g_points || 0);
                if (data.boost_until) {
                    setIsUserBoosted(new Date(data.boost_until) > new Date());
                    setBoostExpiresAt(data.boost_until);
                }
            }
        };

        checkBoost();

        // Subscribe to profile changes for real-time boost status
        const channel = supabase
            .channel(`radar-profile-${user.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${user.id}`
            }, (payload) => {
                if (payload.new && payload.new.boost_until) {
                    setIsUserBoosted(new Date(payload.new.boost_until) > new Date());
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // Auto-scan on mount
    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true;
            handleScan();
        }
    }, []);

    // Check follow status for current user
    useEffect(() => {
        const checkFollow = async () => {
            if (user && currentUser) {
                const following = await socialService.getFollowStatus(user.id, currentUser.user_id);
                setIsFollowing(following);
            }
        };
        checkFollow();
    }, [user, currentIndex, nearbyUsers, currentUser]);

    // Follow Toggle Logic
    const handleFollowToggle = async () => {
        if (!user || !currentUser) return;
        try {
            if (isFollowing) {
                await socialService.unfollowUser(user.id, currentUser.user_id);
            } else {
                await socialService.followUser(user.id, currentUser.user_id);
            }
            setIsFollowing(!isFollowing);
        } catch (err) {
            console.error("Follow error", err);
        }
    };

    // Card Actions
    const handleNext = () => {
        // Infinite Loop Logic
        if (nearbyUsers.length === 0 || isAnimating) return;
        setCurrentIndex((prev) => (prev + 1) % nearbyUsers.length);
        setIsFollowing(false);
    };

    const handleAction = async (action: 'skip' | 'train' | 'like') => {
        if (isAnimating) return;

        // Set animation direction
        setDirection(action === 'skip' ? 'left' : 'right');
        setIsAnimating(true);

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 300));

        // Here we could add logic to save the "Like/Pass"
        if (action === 'train' || action === 'like') {
            if (nearbyUsers[currentIndex].user_id) {
                await notificationService.sendInvitation(nearbyUsers[currentIndex].user_id, "Un Aliado");
            }
        }

        handleNext();
        setDirection(null);
        setIsAnimating(false);
    };

    const handleBoostConfirm = async () => {
        if (!user || isBoosting) return;
        setIsBoosting(true);
        try {
            const success = await userService.spendGPoints(user.id, 1000, 'profile_boost');
            if (success) {
                setIsBoostModalOpen(false);
                // Status will update via subscription
            } else {
                alert('No tienes suficientes G-Points.');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsBoosting(false);
        }
    };

    const currentUser = nearbyUsers.length > 0 ? nearbyUsers[currentIndex] : null;


    return (
        <div className="h-full flex flex-col relative overflow-hidden bg-black">



            {/* Main Content Area */}
            <div className="flex-1 flex flex-col w-full h-full overflow-hidden">

                {/* IDLE/ERROR STATE */}
                {!loading && scanComplete && nearbyUsers.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-500 p-8">
                        <div className="relative bg-neutral-900 border-2 border-dashed border-neutral-700 text-neutral-500 w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2">
                            <RadarIcon size={40} className="opacity-50" />
                            <span className="font-bold text-xs tracking-widest uppercase mt-2">Zona Muerta</span>
                        </div>
                        <p className="text-neutral-400 max-w-[200px] text-xs font-medium">
                            {locationError || `No se encontraron GymRats en ${radius}km.`}
                        </p>
                        <button
                            onClick={handleScan}
                            className="text-gym-primary font-bold uppercase tracking-widest text-[10px] border border-gym-primary px-5 py-2.5 rounded-lg hover:bg-gym-primary hover:text-black transition-colors"
                        >
                            Reintentar Escaneo
                        </button>
                    </div>
                )}

                {/* LOADING */}
                {loading && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 p-8">
                        {/* Skeleton Card */}
                        <div className="w-full max-w-sm bg-neutral-900 rounded-2xl overflow-hidden animate-pulse">
                            <div className="h-48 bg-neutral-800"></div>
                            <div className="p-6 space-y-4">
                                <div className="w-24 h-24 bg-neutral-800 rounded-full mx-auto -mt-16"></div>
                                <div className="h-6 bg-neutral-800 rounded w-3/4 mx-auto"></div>
                                <div className="h-4 bg-neutral-800 rounded w-1/2 mx-auto"></div>
                                <div className="h-12 bg-neutral-800 rounded"></div>
                            </div>
                        </div>
                        <p className="text-gym-primary font-bold animate-pulse tracking-widest text-xs uppercase">Escaneando sector...</p>
                    </div>
                )}

                {/* ACTIVE CARD CONTAINER - FLEX STRETCH */}
                {scanComplete && nearbyUsers.length > 0 && currentUser && !loading && (
                    <div
                        {...swipeHandlers}
                        className={`flex-1 flex flex-col relative bg-neutral-900 w-full mb-0 rounded-b-none transition-all duration-300 select-none ${direction === 'left' ? 'animate-[slideOutLeft_0.3s_ease-out_forwards]' :
                            direction === 'right' ? 'animate-[slideOutRight_0.3s_ease-out_forwards]' :
                                'animate-in fade-in slide-in-from-bottom-8 duration-500'
                            }`}
                        style={{
                            transform: swipeState.isDragging
                                ? `translateX(${swipeState.deltaX}px) rotate(${swipeState.deltaX * 0.05}deg)`
                                : direction === 'left' ? 'translateX(-100%) rotate(-10deg)' :
                                    direction === 'right' ? 'translateX(100%) rotate(10deg)' :
                                        'translateX(0) rotate(0)',
                            opacity: swipeState.isDragging
                                ? Math.max(0.5, 1 - Math.abs(swipeState.deltaX) / 300)
                                : direction ? 0 : 1,
                            cursor: swipeState.isDragging ? 'grabbing' : 'grab'
                        }}
                    >

                        {/* --- BANNER SECTION (Fixed Height) --- */}
                        <div className="h-44 sm:h-52 shrink-0 relative w-full bg-neutral-800 overflow-hidden">
                            {currentUser.banner_url ? (
                                <FadeInImage
                                    src={cloudinaryService.getOptimizedImageUrl(currentUser.banner_url, { width: 300, height: 150 })}
                                    alt="Banner"
                                    className="absolute inset-0 w-full h-full"
                                    imgClassName="opacity-80"
                                />
                            ) : (
                                <div className={`w-full h-full bg-gradient-to-br ${currentUser.tier.gradient} opacity-20 relative`}>
                                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black"></div>
                        </div>


                        {/* --- CONTENT SECTION (Scrollable area) --- */}
                        <div className="flex-1 flex flex-col items-center justify-start relative z-20 -mt-12 px-4 w-full min-h-0 overflow-y-auto custom-scrollbar pb-32">

                            {/* Top Info Group */}
                            <div className="flex flex-col items-center w-full">
                                {/* AVATAR */}
                                <div className="relative w-28 h-28 shrink-0 mb-3">
                                    <div className={`absolute inset-0 rounded-full blur-2xl transform scale-100 pointer-events-none ${currentUser.tier.color.replace('text-', 'bg-')}/40`}></div>
                                    <div className={`w-full h-full rounded-full overflow-hidden border-4 bg-neutral-900 shadow-2xl relative z-10 ${currentUser.tier.borderColor}`}>
                                        <FadeInImage
                                            src={cloudinaryService.getOptimizedImageUrl(currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}&background=random`, { width: 80, height: 80 })}
                                            alt={currentUser.username}
                                            className="w-full h-full"
                                        />
                                    </div>

                                    {/* BOOST BADGE */}
                                    {currentUser.is_boosted && (
                                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 bg-yellow-500 text-black text-[8px] font-black uppercase px-2 py-0.5 rounded-full border-2 border-black animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]">
                                            BOOST
                                        </div>
                                    )}
                                </div>

                                {/* TEXT INFO */}
                                <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase drop-shadow-lg mb-1 truncate max-w-full">
                                    {currentUser.username}
                                </h1>
                                {currentUser.is_boosted && (
                                    <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-pulse">
                                        <img 
                                            src="/Gemini_Generated_Image_bjc7ltbjc7ltbjc7 (2).png" 
                                            alt="Boost"
                                            className="w-6 h-6 object-contain"
                                        />
                                        <span className="text-yellow-400 font-black text-xs italic tracking-widest uppercase">Boost</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-center gap-1.5 text-neutral-400 mb-2">
                                    <Dumbbell size={10} className={currentUser.tier.color} />
                                    <span className="text-[10px] font-bold uppercase tracking-wide truncate max-w-[200px]">
                                        {currentUser.gym_name}
                                    </span>
                                </div>
                                <p className="text-neutral-300 text-xs font-medium leading-relaxed px-6 max-w-md text-center mt-2">
                                    {currentUser.description || "✨ Sin descripción aún"}
                                </p>

                            </div>

                            {/* Middle Stats Group */}
                            <div className="w-full py-3 flex justify-center shrink-0">
                                <div className="grid grid-cols-2 gap-3 w-full max-w-[200px]">
                                    <div className="flex flex-col items-center p-2 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
                                        <span className={`text-lg font-black ${currentUser.tier.color}`}>{currentUser.checkins_count}</span>
                                        <span className="text-[8px] text-neutral-500 uppercase font-bold tracking-widest">Entrenos</span>
                                    </div>
                                    <div className="flex flex-col items-center p-2 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
                                        <span className="text-lg font-black text-white">{currentUser.followers_count || 0}</span>
                                        <span className="text-[8px] text-neutral-500 uppercase font-bold tracking-widest">Seguidores</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- FIXED FOOTER (Absolutely Anchored) --- */}
                        <div className="absolute bottom-0 left-0 w-full flex justify-center items-center gap-6 pb-6 pt-10 z-30 bg-gradient-to-t from-black via-black to-transparent pointer-events-none">
                            <div className="flex items-center gap-6 pointer-events-auto">

                            {/* REJECT BUTTON - Minimalist Outline */}
                            <button
                                onClick={() => handleAction('skip')}
                                disabled={isAnimating}
                                className="w-14 h-14 rounded-full border-2 border-neutral-700 bg-neutral-900/80 backdrop-blur-sm text-neutral-400 flex items-center justify-center hover:bg-neutral-800 hover:border-white transition-all active:scale-95 shadow-lg group"
                            >
                                <X size={24} className="group-hover:rotate-90 transition-transform" />
                            </button>

                            {/* FOLLOW BUTTON */}
                            <button
                                onClick={handleFollowToggle}
                                disabled={isAnimating}
                                className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 shadow-lg ${isFollowing 
                                    ? 'bg-neutral-800 border-neutral-600 text-neutral-400' 
                                    : 'bg-white border-white text-black hover:bg-neutral-200'}`}
                            >
                                {isFollowing ? <UserCheck size={24} /> : <UserPlus size={24} />}
                            </button>

                            {/* LIKE/INVITE BUTTON - Gym Primary Impact */}
                            <button
                                onClick={() => handleAction('like')}
                                disabled={isAnimating}
                                className="w-20 h-20 rounded-full bg-gym-primary text-black flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-[0_0_30px_rgba(229,255,0,0.4)] relative group"
                            >
                                <div className="absolute inset-0 rounded-full bg-gym-primary animate-ping opacity-20 group-hover:opacity-40"></div>
                                <Swords size={32} className="relative z-10" />
                            </button>

                            {/* VIEW PROFILE BUTTON */}
                            <button
                                onClick={() => navigate(`/player/${currentUser.username}`)}
                                disabled={isAnimating}
                                className="w-14 h-14 rounded-full border-2 border-yellow-500/30 bg-yellow-500/10 text-yellow-500 flex items-center justify-center hover:bg-yellow-500 hover:text-black transition-all active:scale-95 shadow-lg"
                            >
                                <ExternalLink size={24} />
                            </button>

                            {/* BOOST BUTTON */}
                            <button
                                onClick={() => setIsBoostModalOpen(true)}
                                disabled={isBoosting}
                                className={`
                                    w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 shadow-lg relative overflow-hidden
                                    ${isUserBoosted 
                                        ? 'bg-yellow-500/10 border-yellow-500 shadow-yellow-500/30 animate-pulse' 
                                        : 'bg-neutral-900/80 border-neutral-700 text-yellow-500 hover:bg-neutral-800 hover:border-yellow-500/50 hover:scale-110'}
                                `}
                            >
                                <img 
                                    src="/Gemini_Generated_Image_bjc7ltbjc7ltbjc7 (2).png" 
                                    alt="Boost"
                                    className={`h-12 w-auto object-contain ${isUserBoosted ? 'drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]' : 'opacity-70 group-hover:opacity-100'}`}
                                />
                                {isUserBoosted && (
                                    <div className="absolute top-0 right-0 w-3 h-3 bg-yellow-500 rounded-full border-2 border-black"></div>
                                )}
                            </button>
                        </div>
                    </div>

                    </div>
                )}
            </div>
            {/* BOOST MODAL */}
            <BoostModal 
                isOpen={isBoostModalOpen}
                onClose={() => setIsBoostModalOpen(false)}
                onConfirm={handleBoostConfirm}
                isBoosting={isBoosting}
                isActive={isUserBoosted}
                expiresAt={boostExpiresAt}
                currentPoints={userPoints}
            />
        </div >
    );
};
