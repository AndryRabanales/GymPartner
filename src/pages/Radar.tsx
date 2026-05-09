import { useState, useEffect, useRef } from 'react';
import { radarService, type RadarUser } from '../services/RadarService';
import { notificationService } from '../services/NotificationService';
import { cloudinaryService } from '../services/CloudinaryService';
import { Radar as RadarIcon, Dumbbell, X, UserPlus, Zap, Star, ExternalLink, UserCheck, Swords, MapPin, ChevronUp, ChevronDown } from 'lucide-react';
import { useSwipe } from '../hooks/useSwipe';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/UserService';
import { supabase } from '../lib/supabase';
import { BoostModal } from '../components/profile/BoostModal';
import { socialService } from '../services/SocialService';
import { useNavigate } from 'react-router-dom';

// Helper component for progressive blur-up loading
const FadeInImage = ({ src, alt, className, imgClassName = "" }: { src: string; alt: string; className?: string; imgClassName?: string }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [blurLoaded, setBlurLoaded] = useState(false);
    const [error, setError] = useState(false);
    
    // Generate an ultra-tiny version of the image for the blur placeholder
    const blurUrl = src.includes('res.cloudinary.com') 
        ? src.replace('/upload/', '/upload/c_fill,w_30,h_30,q_10,e_blur:1000,f_auto/')
        : src;

    useEffect(() => {
        setIsLoaded(false);
        setBlurLoaded(false);
        setError(false);
        
        // Pre-check high-res cache
        const img = new Image();
        img.src = src;
        if (img.complete) {
            setIsLoaded(true);
            setBlurLoaded(true);
        }
    }, [src]);

    return (
        <div className={`relative overflow-hidden ${className} bg-neutral-900 isolation-auto`}>
            {/* 1. ULTRA-LOW RES BLURRED PLACEHOLDER */}
            {!error && (
                <img
                    src={blurUrl}
                    alt=""
                    onLoad={() => setBlurLoaded(true)}
                    className={`
                        absolute inset-0 w-full h-full object-cover filter blur-xl scale-110 transition-opacity duration-700
                        ${blurLoaded ? 'opacity-40' : 'opacity-0'}
                        ${isLoaded ? 'opacity-0' : 'opacity-40'}
                    `}
                    style={{ backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}
                />
            )}

            {/* 2. LOADING SPINNER (Minimalist fallback) */}
            {!isLoaded && !blurLoaded && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-gym-primary/20 border-t-gym-primary rounded-full animate-spin"></div>
                </div>
            )}
            
            {/* 3. HIGH-RES IMAGE */}
            {!error && (
                <img
                    src={src}
                    alt={alt}
                    onLoad={() => {
                        setIsLoaded(true);
                        setBlurLoaded(true);
                    }}
                    onError={() => setError(true)}
                    loading="eager"
                    className={`
                        absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out
                        ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}
                        ${imgClassName}
                    `}
                    style={{ 
                        backfaceVisibility: 'hidden', 
                        transform: 'translateZ(0)',
                        willChange: 'transform, opacity' 
                    }}
                />
            )}

            {/* ERROR FALLBACK */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
                    <RadarIcon size={20} className="text-neutral-700 opacity-30" />
                </div>
            )}
        </div>
    );
};


export const Radar = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [nearbyUsers, setNearbyUsers] = useState<RadarUser[]>([]);
    const [isButtonsVisible, setIsButtonsVisible] = useState(false);
    const [loading, setLoading] = useState(true);
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

    const currentUser = nearbyUsers.length > 0 ? nearbyUsers[currentIndex] : null;

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
            if (nearbyUsers[currentIndex]?.user_id) {
                await notificationService.sendInvitation(nearbyUsers[currentIndex].user_id, "Un Aliado");
            }
        }

        handleNext();
        setDirection(null);
        setIsAnimating(false);
    };

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

    // Next-Card Preloading (The secret for instant swiping)
    useEffect(() => {
        if (nearbyUsers.length > 0) {
            const nextIndex = (currentIndex + 1) % nearbyUsers.length;
            const nextUser = nearbyUsers[nextIndex];
            if (nextUser) {
                const preloader = new Image();
                preloader.src = cloudinaryService.getOptimizedImageUrl(nextUser.avatar_url, { width: 100, height: 100 });
                if (nextUser.banner_url) {
                    const bannerPreloader = new Image();
                    bannerPreloader.src = cloudinaryService.getOptimizedImageUrl(nextUser.banner_url, { width: 400, height: 250 });
                }
            }
        }
    }, [currentIndex, nearbyUsers]);

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



    return (
        <div className="h-[100dvh] w-full flex flex-col relative overflow-hidden bg-black selection:bg-gym-primary selection:text-black">



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

                        {/* --- BANNER SECTION (Optimized Height) --- */}
                        <div className="h-36 sm:h-44 shrink-0 relative w-full bg-neutral-800 overflow-hidden">
                            {currentUser.banner_url ? (
                                <FadeInImage
                                    src={cloudinaryService.getOptimizedImageUrl(currentUser.banner_url, { width: 400, height: 200 })}
                                    alt="Banner"
                                    className="absolute inset-0 w-full h-full"
                                    imgClassName="opacity-80 object-cover"
                                />
                            ) : (
                                <div className={`w-full h-full bg-gradient-to-br ${currentUser.tier.gradient} opacity-20 relative`}>
                                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black"></div>
                        </div>


                        {/* --- CONTENT SECTION (Scrollable area inside card) --- */}
                        <div className="flex-1 flex flex-col items-center justify-start relative z-20 -mt-14 px-3 w-full overflow-y-auto overflow-x-hidden custom-scrollbar pb-32">

                            {/* Top Info Group */}
                            <div className="flex flex-col items-center w-full">
                                {/* AVATAR (Compact) */}
                                <div className="relative w-24 h-24 shrink-0 mb-1">
                                    <div className={`absolute inset-0 rounded-full blur-xl transform scale-90 pointer-events-none ${currentUser.tier.color.replace('text-', 'bg-')}/30`}></div>
                                    <div className={`w-full h-full rounded-full overflow-hidden border-[3px] bg-neutral-900 shadow-xl relative z-10 ${currentUser.tier.borderColor}`}>
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
                                <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-0.5 truncate max-w-full">
                                    {currentUser.username}
                                </h1>
                                {currentUser.is_boosted && (
                                    <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-yellow-500/40">
                                        <img 
                                            src="/Gemini_Generated_Image_bjc7ltbjc7ltbjc7 (2).png" 
                                            alt="Boost"
                                            className="w-5 h-5 object-contain"
                                        />
                                        <span className="text-yellow-400 font-black text-[9px] italic tracking-widest uppercase">Boost</span>
                                    </div>
                                )}
                                <p className="text-neutral-400 text-[11px] font-medium leading-tight px-4 max-w-md text-center">
                                    {currentUser.description || "✨ Sin descripción aún"}
                                </p>
                            </div>

                            {/* Middle Stats Group (Ultra Compact) */}
                            <div className="w-full py-2 flex justify-center shrink-0">
                                <div className="grid grid-cols-3 gap-1.5 w-full max-w-[300px]">
                                    <div className="flex flex-col items-center p-1.5 rounded-xl bg-neutral-900/50 border border-white/5">
                                        <span className={`text-base font-black ${currentUser.tier.color}`}>{currentUser.checkins_count}</span>
                                        <span className="text-[7px] text-neutral-500 uppercase font-black tracking-widest">Entrenos</span>
                                    </div>
                                    <div className="flex flex-col items-center p-1.5 rounded-xl bg-neutral-900/50 border border-white/5">
                                        <span className="text-base font-black text-white">{currentUser.followers_count || 0}</span>
                                        <span className="text-[7px] text-neutral-500 uppercase font-black tracking-widest">Seguidores</span>
                                    </div>
                                    <div className="flex flex-col items-center p-1.5 rounded-xl bg-neutral-900/50 border border-white/5">
                                        <span className="text-base font-black text-white">{currentUser.following_count || 0}</span>
                                        <span className="text-[7px] text-neutral-500 uppercase font-black tracking-widest">Seguidos</span>
                                    </div>
                                </div>
                            </div>

                            {/* GYM PRINCIPAL SHOWCASE (iPhone optimized) */}
                            <div className="w-full mt-1.5 px-0.5">
                                <div className="relative h-44 md:h-[350px] rounded-[1.5rem] overflow-hidden shadow-2xl border border-white/5">
                                    {/* Gym Banner/Photo */}
                                    <div 
                                        className="absolute inset-0 bg-neutral-800"
                                        style={{ 
                                            backgroundColor: currentUser.gym_custom_color || '#171717',
                                            backgroundImage: currentUser.gym_banner_url ? `url(${currentUser.gym_banner_url})` : undefined,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center'
                                        }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-95" />
                                    </div>

                                    {/* Gym Content */}
                                    <div className="absolute inset-0 p-4 flex flex-col justify-end items-start">
                                        <div className="flex items-center gap-1.5 mb-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-gym-primary/20">
                                            <Star size={9} className="text-gym-primary" fill="currentColor" />
                                            <span className="text-[8px] font-black text-white uppercase tracking-widest italic">Base Principal</span>
                                        </div>
                                        <h3 className="text-lg md:text-3xl font-black text-white italic uppercase tracking-tighter leading-none">
                                            {currentUser.gym_name}
                                        </h3>
                                    </div>

                                    {/* Distance Badge */}
                                    <div className="absolute top-3 right-3">
                                        <div className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/5">
                                            <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">
                                                {currentUser.distance_km < 1 ? '<1 km' : `${Math.round(currentUser.distance_km)} km`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        {/* --- SLIDABLE ACTION BAR (Clean UI) --- */}
                        <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-none">
                            
                            {/* Toggle Arrow Tab */}
                            <div className="flex justify-center mb-4 pointer-events-auto">
                                <button
                                    onClick={() => setIsButtonsVisible(!isButtonsVisible)}
                                    className={`
                                        w-12 h-10 flex items-center justify-center rounded-t-2xl 
                                        bg-black/90 backdrop-blur-2xl border-t border-x border-white/10 
                                        text-gym-primary shadow-[0_-10px_30px_rgba(0,0,0,0.8)]
                                        transition-all duration-500 ease-out active:scale-90
                                        ${isButtonsVisible ? 'translate-y-2 opacity-50' : 'animate-bounce translate-y-0'}
                                    `}
                                >
                                    {isButtonsVisible ? <ChevronDown size={24} strokeWidth={3} /> : <ChevronUp size={24} strokeWidth={3} />}
                                </button>
                            </div>

                            {/* Slidable Panel */}
                            <div className={`
                                bg-gradient-to-t from-black via-black/98 to-black/90 backdrop-blur-3xl 
                                border-t border-white/10 px-4 pt-6 pb-12
                                transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
                                pointer-events-auto shadow-[0_-20px_50px_rgba(0,0,0,0.9)]
                                ${isButtonsVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
                            `}>
                                <div className="flex items-center justify-center gap-4 max-w-sm mx-auto">
                                    <button
                                        onClick={() => { handleAction('skip'); setIsButtonsVisible(false); }}
                                        disabled={isAnimating}
                                        className="w-14 h-14 rounded-full border-2 border-neutral-800 bg-neutral-900/90 text-neutral-500 flex items-center justify-center active:scale-95 transition-all"
                                    >
                                        <X size={24} />
                                    </button>
                                    <button
                                        onClick={handleFollowToggle}
                                        disabled={isAnimating}
                                        className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 shadow-lg ${isFollowing 
                                            ? 'bg-neutral-800 border-neutral-700 text-neutral-500' 
                                            : 'bg-white border-white text-black hover:bg-neutral-200'}`}
                                    >
                                        {isFollowing ? <UserCheck size={24} /> : <UserPlus size={24} />}
                                    </button>
                                    <button
                                        onClick={() => { handleAction('like'); setIsButtonsVisible(false); }}
                                        disabled={isAnimating}
                                        className="w-20 h-20 rounded-full bg-gym-primary text-black flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-[0_0_40px_rgba(229,255,0,0.4)] relative group"
                                    >
                                        <div className="absolute inset-0 rounded-full bg-gym-primary animate-ping opacity-20"></div>
                                        <Swords size={32} className="relative z-10" />
                                    </button>
                                    <button
                                        onClick={() => navigate(`/player/${currentUser.username}`)}
                                        disabled={isAnimating}
                                        className="w-14 h-14 rounded-full border-2 border-yellow-500/30 bg-yellow-500/10 text-yellow-500 flex items-center justify-center active:scale-95 shadow-lg"
                                    >
                                        <ExternalLink size={24} />
                                    </button>
                                    <button
                                        onClick={() => setIsBoostModalOpen(true)}
                                        disabled={isBoosting}
                                        className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 shadow-lg ${isUserBoosted ? 'bg-yellow-500/10 border-yellow-500 shadow-yellow-500/30' : 'bg-neutral-900/90 border-neutral-800 text-yellow-500'}`}
                                    >
                                        <Zap size={24} fill={isUserBoosted ? "currentColor" : "none"} />
                                    </button>
                                </div>
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
