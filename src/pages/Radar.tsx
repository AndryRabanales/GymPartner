import { useState, useEffect, useCallback } from 'react';
import { 
    Search, MapPin, Swords, X, UserPlus, UserCheck, 
    Zap, ExternalLink, Shield, Trophy, ChevronRight,
    Sparkles, ArrowRight, Activity, Users, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { cloudinaryService } from '../services/CloudinaryService';
import { FadeInImage } from '../components/ui/FadeInImage';
import { useSwipeable } from 'react-swipeable';
import { notificationService } from '../services/NotificationService';

interface NearbyUser {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
    banner_url: string;
    bio: string;
    gym_name: string;
    distance?: number;
    training_days_count: number;
    followers_count: number;
    following_count: number;
    is_boosted?: boolean;
    is_pro?: boolean;
}

export const Radar = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [scanComplete, setScanComplete] = useState(false);
    const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [isBoosting, setIsBoosting] = useState(false);
    const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);
    const [direction, setDirection] = useState<'left' | 'right' | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [swipeState, setSwipeState] = useState({ x: 0, isDragging: false });

    // Mock scan animation
    useEffect(() => {
        const timer = setTimeout(() => {
            loadNearbyUsers();
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    const loadNearbyUsers = async () => {
        setLoading(true);
        try {
            // 1. Get current user's profile and gym
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, primary_gym_id')
                .eq('id', user?.id)
                .single();

            // 2. Try to find users in SAME GYM first
            let query = supabase
                .from('profiles')
                .select(`
                    id, 
                    username, 
                    avatar_url, 
                    banner_url, 
                    bio
                `)
                .neq('id', user?.id)
                .limit(20);

            // Filter by gym if the user has one
            if (profile?.primary_gym_id) {
                query = query.eq('primary_gym_id', profile.primary_gym_id);
            }

            let { data: users, error } = await query;

            // 3. FALLBACK: If no one in gym, get ANY users (Global search)
            if (!users || users.length === 0) {
                const { data: globalUsers, error: globalError } = await supabase
                    .from('profiles')
                    .select(`
                        id, 
                        username, 
                        avatar_url, 
                        banner_url, 
                        bio
                    `)
                    .neq('id', user?.id)
                    .limit(20);
                
                users = globalUsers;
                if (globalError) throw globalError;
            }

            if (error) throw error;

            const formattedUsers: NearbyUser[] = (users || []).map(u => ({
                id: u.id,
                username: u.username,
                full_name: u.username, // Fallback to username
                avatar_url: u.avatar_url,
                banner_url: u.banner_url,
                bio: u.bio || '¡Listo para entrenar!',
                gym_name: 'Gimnasio Local',
                distance: Math.floor(Math.random() * 5) + 1,
                training_days_count: Math.floor(Math.random() * 50) + 5, // Fallback stats
                followers_count: Math.floor(Math.random() * 100) + 10,
                following_count: Math.floor(Math.random() * 80) + 5,
                is_boosted: Math.random() > 0.8,
                is_pro: Math.random() > 0.9
            }));

            // Shuffle and sort by boosted
            setNearbyUsers(formattedUsers.sort((a, b) => (b.is_boosted ? 1 : 0) - (a.is_boosted ? 1 : 0)));
            setScanComplete(true);
        } catch (error) {
            console.error("Error loading nearby users:", error);
            setScanComplete(true);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = useCallback(async (act: 'like' | 'skip') => {
        if (isAnimating || nearbyUsers.length === 0) return;
        
        setDirection(act === 'like' ? 'right' : 'left');
        setIsAnimating(true);

        // If it's a like, send invitation
        if (act === 'like') {
            const targetUser = nearbyUsers[currentIndex];
            try {
                await notificationService.sendInvitation(targetUser.id);
            } catch (error) {
                console.error("Error sending invitation:", error);
            }
        }

        setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
            setDirection(null);
            setIsAnimating(false);
            setIsFollowing(false);
            setSwipeState({ x: 0, isDragging: false });
        }, 300);
    }, [currentIndex, nearbyUsers, isAnimating]);

    const handleFollowToggle = () => {
        setIsFollowing(!isFollowing);
    };

    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => handleAction('skip'),
        onSwipedRight: () => handleAction('like'),
        onSwiping: (e) => {
            if (!isAnimating) {
                setSwipeState({ x: e.deltaX, isDragging: true });
            }
        },
        onSwiped: () => {
            setSwipeState({ x: 0, isDragging: false });
        },
        trackMouse: true,
        delta: 100
    });

    const currentUser = nearbyUsers[currentIndex];
    const isUserBoosted = currentUser?.is_boosted;

    if (loading && !scanComplete) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-black relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gym-primary/10 via-transparent to-transparent opacity-50"></div>
                
                <div className="relative w-64 h-64 flex items-center justify-center">
                    <div className="absolute inset-0 border-2 border-gym-primary/20 rounded-full animate-[ping_3s_linear_infinite]"></div>
                    <div className="absolute inset-4 border border-gym-primary/40 rounded-full animate-[ping_2s_linear_infinite]"></div>
                    <div className="absolute inset-8 border-4 border-gym-primary rounded-full animate-pulse"></div>
                    
                    <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gym-primary rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(229,255,0,0.4)]">
                            <Search className="text-black animate-bounce" size={32} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-black text-white italic tracking-tight">ESCANEANDO RADAR</h3>
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.3em] mt-1">Buscando compañeros cerca</p>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-12 left-0 right-0 px-8">
                    <div className="h-1 w-full bg-neutral-900 rounded-full overflow-hidden">
                        <div className="h-full bg-gym-primary animate-[shimmer_2s_infinite]"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full flex flex-col relative overflow-hidden bg-transparent selection:bg-gym-primary selection:text-black">

            {/* Main Content Area - Optimized for Floating Cards */}
            <div className="flex-1 flex flex-col w-full h-full overflow-hidden pt-6 pb-2">

                {/* IDLE/ERROR STATE */}
                {!loading && scanComplete && nearbyUsers.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-neutral-900 rounded-3xl flex items-center justify-center mb-6 text-neutral-700 rotate-12">
                            <MapPin size={48} />
                        </div>
                        <h3 className="text-2xl font-black text-white italic mb-2 tracking-tight">SOLO EN LA ZONA</h3>
                        <p className="text-sm text-neutral-500 max-w-xs font-medium">No hay otros guerreros en tu gimnasio actual ahora mismo. ¡Invita a tus amigos!</p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="mt-8 bg-white text-black px-8 py-3 rounded-2xl font-black text-sm tracking-tighter hover:bg-gym-primary transition-all active:scale-95 shadow-xl"
                        >
                            REESCANEAR ÁREA
                        </button>
                    </div>
                )}

                {/* END OF DECK STATE */}
                {scanComplete && currentIndex >= nearbyUsers.length && nearbyUsers.length > 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-gym-primary rounded-[2.5rem] flex items-center justify-center mb-6 text-black shadow-[0_0_50px_rgba(229,255,0,0.3)]">
                            <Sparkles size={48} fill="currentColor" />
                        </div>
                        <h3 className="text-2xl font-black text-white italic mb-2 tracking-tight">¡OBJETIVO COMPLETADO!</h3>
                        <p className="text-sm text-neutral-500 max-w-xs font-medium">Has visto a todos los guerreros cercanos por hoy. Vuelve más tarde o cambia de gimnasio.</p>
                        <button 
                            onClick={() => navigate('/ranking')}
                            className="mt-8 flex items-center gap-3 bg-white text-black px-8 py-3 rounded-2xl font-black text-sm tracking-tighter hover:bg-gym-primary transition-all active:scale-95 shadow-xl group"
                        >
                            VER RANKINGS <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                )}

                {/* ACTIVE CARD CONTAINER - FLOATING STYLE */}
                {scanComplete && nearbyUsers.length > 0 && currentUser && !loading && (
                    <div
                        {...swipeHandlers}
                        className={`flex-1 flex flex-col relative bg-black/40 backdrop-blur-3xl w-[92%] mx-auto mb-4 rounded-[3rem] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] transition-all duration-300 select-none overflow-hidden ${direction === 'left' ? 'animate-[slideOutLeft_0.3s_ease-out_forwards]' :
                            direction === 'right' ? 'animate-[slideOutRight_0.3s_ease-out_forwards]' :
                                'animate-in fade-in zoom-in-95 slide-in-from-bottom-12 duration-700'
                            }`}
                        style={{
                            transform: swipeState.isDragging
                                ? `translateX(${swipeState.x}px) rotate(${swipeState.x * 0.05}deg)`
                                : 'none'
                        }}
                    >
                        {/* --- BANNER SECTION (Immersive Cover) --- */}
                        <div className="h-40 sm:h-48 shrink-0 relative w-full bg-neutral-800 overflow-hidden">
                            {currentUser.banner_url ? (
                                <FadeInImage
                                    src={cloudinaryService.getOptimizedImageUrl(currentUser.banner_url, { width: 400, height: 200 })}
                                    alt="Banner"
                                    className="w-full h-full object-cover opacity-60"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-950"></div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                            
                            {/* Boost Badge on Banner */}
                            {isUserBoosted && (
                                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-yellow-500/50 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-2xl animate-pulse">
                                    <Zap size={14} className="text-yellow-500" fill="currentColor" />
                                    <span className="text-[10px] font-black text-white italic uppercase tracking-widest">BOOST</span>
                                </div>
                            )}
                        </div>

                        {/* --- PROFILE CONTENT (SCROLLABLE) --- */}
                        <div className="flex-1 flex flex-col items-center justify-start relative z-20 -mt-10 px-3 overflow-y-auto custom-scrollbar pb-6">
                            
                            {/* Avatar with Ring */}
                            <div className="relative group">
                                <div className={`absolute -inset-1 rounded-full blur-xl opacity-40 group-hover:opacity-70 transition-opacity ${isUserBoosted ? 'bg-yellow-500' : 'bg-gym-primary'}`}></div>
                                <div className={`relative w-24 h-24 rounded-full p-1 shadow-2xl ${isUserBoosted ? 'bg-gradient-to-tr from-yellow-600 to-yellow-300' : 'bg-gradient-to-tr from-neutral-800 to-neutral-600'}`}>
                                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden border border-white/10 relative">
                                        {currentUser.avatar_url ? (
                                            <FadeInImage
                                                src={cloudinaryService.getOptimizedImageUrl(currentUser.avatar_url, { width: 100, height: 100 })}
                                                alt={currentUser.username}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-3xl font-black text-white">{currentUser.username[0].toUpperCase()}</span>
                                        )}
                                        
                                        {/* Pro Badge */}
                                        {currentUser.is_pro && (
                                            <div className="absolute bottom-0 right-0 bg-gym-primary text-black p-1 rounded-full border-2 border-black shadow-lg">
                                                <Shield size={10} fill="currentColor" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {isUserBoosted && (
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter shadow-lg border border-black/20">
                                        BOOST
                                    </div>
                                )}
                            </div>

                            {/* Identity */}
                            <div className="text-center mt-4">
                                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-tight drop-shadow-lg">
                                    {currentUser.username.replace('_', ' ')}
                                </h2>
                                <p className="text-[11px] font-medium text-neutral-500 mt-1 flex items-center justify-center gap-1.5 uppercase tracking-wide">
                                    <MapPin size={10} className="text-gym-primary" /> {currentUser.gym_name}
                                </p>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-2 w-full mt-6 px-1">
                                <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5 text-center transition-transform hover:scale-105">
                                    <p className="text-lg font-black text-gym-primary leading-none italic">{currentUser.training_days_count}</p>
                                    <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Entrenos</p>
                                </div>
                                <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5 text-center transition-transform hover:scale-105">
                                    <p className="text-lg font-black text-white leading-none italic">{currentUser.followers_count}</p>
                                    <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Seguidores</p>
                                </div>
                                <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5 text-center transition-transform hover:scale-105">
                                    <p className="text-lg font-black text-white leading-none italic">{currentUser.following_count}</p>
                                    <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Seguidos</p>
                                </div>
                            </div>

                            {/* Bio / Motivation */}
                            <div className="w-full mt-6 px-2">
                                <div className="bg-gradient-to-br from-neutral-900/80 to-black/80 rounded-[2rem] p-4 border border-white/5 relative overflow-hidden group shadow-2xl">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Sparkles size={40} className="text-gym-primary" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 rounded-full bg-gym-primary/10 flex items-center justify-center">
                                                <Sparkles size={12} className="text-gym-primary" />
                                            </div>
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Base Principal</span>
                                        </div>
                                        <p className="text-sm font-black text-white leading-relaxed italic uppercase tracking-tight">
                                            {currentUser.gym_name.toUpperCase()}
                                        </p>
                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-neutral-500">
                                                <Activity size={12} className="text-gym-primary" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Enfocado</span>
                                            </div>
                                            <div className="px-2 py-1 bg-white/5 rounded-lg border border-white/10 text-[9px] font-mono text-neutral-400">
                                                {currentUser.distance} KM
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ACTION BUTTONS (Positioned BELOW the card) --- */}
                {scanComplete && nearbyUsers.length > 0 && currentUser && !loading && (
                    <div className="w-full z-50 px-4 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
                            {/* REJECT BUTTON */}
                            <button
                                onClick={() => handleAction('skip')}
                                disabled={isAnimating}
                                className="w-12 h-12 rounded-full border border-neutral-800 bg-black/40 backdrop-blur-md text-neutral-500 flex items-center justify-center active:scale-90 transition-all shadow-xl"
                            >
                                <X size={20} />
                            </button>

                            {/* FOLLOW BUTTON */}
                            <button
                                onClick={handleFollowToggle}
                                disabled={isAnimating}
                                className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all active:scale-90 shadow-lg ${isFollowing
                                    ? 'bg-neutral-800 border-neutral-700 text-neutral-500'
                                    : 'bg-white border-white text-black'}`}
                            >
                                {isFollowing ? <UserCheck size={20} /> : <UserPlus size={20} />}
                            </button>

                            {/* LIKE/INVITE BUTTON (SWORDS) */}
                            <button
                                onClick={() => handleAction('like')}
                                disabled={isAnimating}
                                className="w-16 h-16 rounded-full bg-gym-primary text-black flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-[0_0_40px_rgba(229,255,0,0.4)] relative"
                            >
                                <div className="absolute inset-0 rounded-full bg-gym-primary animate-ping opacity-10"></div>
                                <Swords size={28} />
                            </button>

                            {/* VIEW PROFILE BUTTON */}
                            <button
                                onClick={() => navigate(`/player/${currentUser.username}`)}
                                disabled={isAnimating}
                                className="w-12 h-12 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-500 flex items-center justify-center active:scale-90 shadow-lg"
                            >
                                <ExternalLink size={20} />
                            </button>

                            {/* BOOST BUTTON */}
                            <button
                                onClick={() => setIsBoostModalOpen(true)}
                                disabled={isBoosting}
                                className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all active:scale-90 shadow-lg ${isUserBoosted ? 'bg-yellow-500/10 border-yellow-500 shadow-yellow-500/30' : 'bg-neutral-900/60 border-neutral-800 text-yellow-500'}`}
                            >
                                <Zap size={20} fill={isUserBoosted ? "currentColor" : "none"} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* BOOST MODAL */}
            {isBoostModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setIsBoostModalOpen(false)}></div>
                    <div className="relative bg-neutral-950 border border-yellow-500/30 rounded-[3rem] p-8 max-w-sm w-full shadow-[0_0_100px_rgba(234,179,8,0.15)] overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Zap size={160} className="text-yellow-500" />
                        </div>
                        <div className="relative z-10 text-center">
                            <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(234,179,8,0.4)]">
                                <Zap size={40} className="text-black" fill="currentColor" />
                            </div>
                            <h3 className="text-3xl font-black text-white italic tracking-tighter mb-2 uppercase">G-BOOST ELITE</h3>
                            <p className="text-neutral-400 text-sm font-medium leading-relaxed">Multiplica tu visibilidad por 10x y conviértete en el guerrero más codiciado de tu zona.</p>
                            
                            <div className="mt-8 space-y-4">
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Duración</p>
                                        <p className="text-lg font-black text-white italic">30 MINUTOS</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Costo</p>
                                        <p className="text-lg font-black text-gym-primary italic">50 G-PTS</p>
                                    </div>
                                </div>
                                
                                <button 
                                    className="w-full bg-yellow-500 text-black py-4 rounded-2xl font-black text-base tracking-tight hover:bg-yellow-400 transition-all active:scale-95 shadow-xl"
                                    onClick={() => {
                                        setIsBoosting(true);
                                        setTimeout(() => {
                                            setIsBoosting(false);
                                            setIsBoostModalOpen(false);
                                        }, 1500);
                                    }}
                                >
                                    {isBoosting ? 'ACTIVANDO...' : 'ACTIVAR BOOST AHORA'}
                                </button>
                                <button 
                                    className="w-full text-neutral-500 text-sm font-bold hover:text-white transition-colors"
                                    onClick={() => setIsBoostModalOpen(false)}
                                >
                                    TAL VEZ LUEGO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
