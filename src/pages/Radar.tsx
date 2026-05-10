import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import { 
    X, 
    UserPlus, 
    Swords, 
    Eye, 
    Zap, 
    Loader2, 
    MapPin, 
    Shield 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/NotificationService';
import { socialService } from '../services/SocialService';
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
    const [userProfile, setUserProfile] = useState<any>(null);

    useEffect(() => {
        loadNearbyUsers();
    }, [authUser]);

    const loadNearbyUsers = async () => {
        setLoading(true);
        try {
            // 1. Fetch profiles with REAL stats columns
            const { data: profiles, error: pError } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, description, custom_settings, home_gym_id, checkins_count, xp')
                .neq('id', authUser?.id)
                .limit(20);

            if (pError) throw pError;

            if (profiles) {
                // 2. Fetch all Gym names in one batch to be fast
                const gymIds = [...new Set(profiles.map(p => p.home_gym_id).filter(Boolean))];
                const { data: gymsData } = await supabase
                    .from('gyms')
                    .select('id, name')
                    .in('id', gymIds);

                const gymMap = (gymsData || []).reduce((acc: any, g) => {
                    acc[g.id] = g.name;
                    return acc;
                }, {});

                // 3. Enrich with basic profile info (Stats will load lazily)
                const enriched = profiles.map((p, idx) => {
                    const settings = (p.custom_settings as any) || {};
                    return {
                        ...p,
                        gym_name: gymMap[p.home_gym_id || ''] || "Gimnasio Partner",
                        gym_image: FALLBACK_GYM_INTERIORS[idx % FALLBACK_GYM_INTERIORS.length],
                        banner_url: settings.banner_url || FALLBACK_BANNERS[idx % FALLBACK_BANNERS.length],
                        training_days_count: p.checkins_count || 0,
                        followers_count: 0, // Placeholder
                        following_count: 0, // Placeholder
                        is_following: false,
                        stats_loaded: false,
                        distance: (Math.random() * 5 + 0.5).toFixed(1),
                        bio: p.description || settings.description || settings.bio || "¡Entrenando duro para subir de rango! 💪 🔥",
                        is_pro: (p.xp || 0) > 1000
                    };
                });
                setNearbyUsers(enriched);
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

                const updatedUsers = [...nearbyUsers];
                updatedUsers[currentIndex] = {
                    ...currentUser,
                    followers_count: stats.followersCount,
                    following_count: stats.followingCount,
                    is_following: !!followCheck,
                    stats_loaded: true
                };
                setNearbyUsers(updatedUsers);
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

    const handleSkip = () => {
        setDirection('left');
        setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
            setDirection(null);
        }, 300);
    };

    const handleFollow = async () => {
        if (!authUser || !nearbyUsers[currentIndex] || isBoosting) return;
        const targetUser = nearbyUsers[currentIndex];

        // SAFETY CHECK: Don't follow if already following
        if (targetUser.is_following) {
            toast.success("¡Ya sigues a este guerrero!");
            return;
        }

        try {
            await socialService.followUser(authUser.id, targetUser.id);
            toast.success(`¡Siguiendo a ${targetUser.username}!`);
            
            // Optimistic Update
            const updated = [...nearbyUsers];
            updated[currentIndex] = { ...targetUser, is_following: true, followers_count: (targetUser.followers_count || 0) + 1 };
            setNearbyUsers(updated);

            // Notify
            await notificationService.createNotification(targetUser.id, {
                type: 'follow',
                title: 'Nuevo Seguidor',
                content: `${authUser.user_metadata?.full_name || 'Alguien'} ha comenzado a seguirte.`,
                data: { follower_id: authUser.id }
            });
        } catch (error: any) {
            if (error.code === '23505' || error.message?.includes('Conflict')) {
                // Already following (Conflict) - Just update UI
                const updated = [...nearbyUsers];
                updated[currentIndex] = { ...targetUser, is_following: true };
                setNearbyUsers(updated);
            } else {
                console.error("Error following:", error);
                toast.error("No se pudo seguir al usuario");
            }
        }
    };

    const handleInvite = async () => {
        if (!currentUser) return;
        try {
            const success = await notificationService.sendInvitation(currentUser.id, currentUser.username);
            if (success) {
                toast.success("Desafío enviado!");
                setDirection('right');
                setTimeout(() => {
                    setCurrentIndex(prev => prev + 1);
                    setDirection(null);
                }, 300);
            }
        } catch (error) {
            toast.error("Error al enviar invitación");
        }
    };

    const swipeHandlers = useSwipeable({
        onSwipedLeft: handleSkip,
        onSwipedRight: handleInvite,
        trackMouse: true
    });

    const currentUser = nearbyUsers[currentIndex];
    const isUserBoosted = currentIndex === 0;

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
                            onClick={() => { setCurrentIndex(0); setScanComplete(false); loadNearbyUsers(); }}
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
                            transform: direction ? `translateX(${direction === 'left' ? '-100%' : '100%'}) rotate(${direction === 'left' ? '-15deg' : '15deg'})` : 'none'
                        }}
                    >
                        <UserProfileCard 
                            user={currentUser}
                            actions={
                                <div className="flex items-center justify-around w-full gap-3">
                                    {/* Action Buttons */}
                                    <button 
                                        onClick={handleSkip}
                                        className="w-14 h-14 rounded-2xl bg-neutral-900 border border-white/5 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all active:scale-90 shadow-xl group"
                                    >
                                        <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                                    </button>
                                    
                                    <button 
                                        onClick={handleFollow}
                                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl ${
                                            currentUser.is_following 
                                            ? 'bg-blue-500 text-white border-blue-400' 
                                            : 'bg-neutral-900 border border-white/5 text-neutral-500 hover:text-blue-500 hover:bg-blue-500/10'
                                        }`}
                                        title={currentUser.is_following ? "Siguiendo" : "Seguir"}
                                    >
                                        <UserPlus size={24} fill={currentUser.is_following ? "currentColor" : "none"} />
                                    </button>

                                    {/* MAIN ACTION: LIKE/INVITE */}
                                    <button 
                                        onClick={handleInvite}
                                        className="w-20 h-20 rounded-[2rem] bg-white flex items-center justify-center text-black hover:bg-gym-primary transition-all active:scale-95 shadow-[0_15px_30px_rgba(255,255,255,0.2)] hover:shadow-[0_15px_40px_rgba(250,204,21,0.4)] group"
                                    >
                                        <Swords size={32} className="group-hover:scale-110 transition-transform" fill="currentColor" />
                                    </button>

                                    <button 
                                        onClick={() => {
                                            navigate(`/player/${currentUser.id}`);
                                        }}
                                        className="w-14 h-14 rounded-2xl bg-neutral-900 border border-white/5 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all active:scale-90 shadow-xl"
                                        title="Ver Perfil"
                                    >
                                        <Eye size={24} />
                                    </button>

                                    <button 
                                        onClick={() => setIsBoostModalOpen(true)}
                                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl ${
                                            userProfile?.boost_until && new Date(userProfile.boost_until) > new Date()
                                            ? 'bg-yellow-500 text-black border-yellow-400 animate-pulse'
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
