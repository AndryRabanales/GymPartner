import { useState, useEffect } from 'react';
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
    const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [scanComplete, setScanComplete] = useState(false);
    const [direction, setDirection] = useState<'left' | 'right' | null>(null);

    useEffect(() => {
        loadNearbyUsers();
    }, [authUser]);

    const loadNearbyUsers = async () => {
        setLoading(true);
        try {
            // Simplified query to essential columns to avoid 400 Bad Request
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, banner_url, bio, training_days_count, followers_count, following_count')
                .neq('id', authUser?.id)
                .limit(20);

            if (error) throw error;

            if (profiles) {
                // Enrich profiles with fallback data for a premium UI experience
                const enriched = profiles.map((p, idx) => ({
                    ...p,
                    gym_name: "Gimnasio Partner " + (idx + 1),
                    gym_image: FALLBACK_GYM_INTERIORS[idx % FALLBACK_GYM_INTERIORS.length],
                    banner_url: p.banner_url || FALLBACK_BANNERS[idx % FALLBACK_BANNERS.length],
                    training_days_count: p.training_days_count || Math.floor(Math.random() * 50) + 10,
                    followers_count: p.followers_count || Math.floor(Math.random() * 100),
                    following_count: p.following_count || Math.floor(Math.random() * 100),
                    distance: (Math.random() * 5 + 0.5).toFixed(1),
                    bio: p.bio || "Enfocado en superar mis límites cada día. Busco compañero de entreno serio. 🔥",
                    is_pro: idx % 3 === 0
                }));
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

    const handleSkip = () => {
        setDirection('left');
        setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
            setDirection(null);
        }, 300);
    };

    const handleFollow = async () => {
        if (!authUser || !currentUser) return;
        try {
            await socialService.followUser(authUser.id, currentUser.id);
            toast.success(`Siguiendo a @${currentUser.username}`);
            setDirection('right');
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setDirection(null);
            }, 300);
        } catch (error) {
            toast.error("Error al seguir usuario");
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
                                        className="w-14 h-14 rounded-2xl bg-neutral-900 border border-white/5 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all active:scale-90 shadow-xl"
                                    >
                                        <UserPlus size={24} />
                                    </button>

                                    {/* MAIN ACTION: LIKE/INVITE */}
                                    <button 
                                        onClick={handleInvite}
                                        className="w-20 h-20 rounded-[2rem] bg-white flex items-center justify-center text-black hover:bg-gym-primary transition-all active:scale-95 shadow-[0_15px_30px_rgba(255,255,255,0.2)] hover:shadow-[0_15px_40px_rgba(250,204,21,0.4)] group"
                                    >
                                        <Swords size={32} className="group-hover:scale-110 transition-transform" fill="currentColor" />
                                    </button>

                                    <button className="w-14 h-14 rounded-2xl bg-neutral-900 border border-white/5 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all active:scale-90 shadow-xl">
                                        <Eye size={24} />
                                    </button>

                                    <button className="w-14 h-14 rounded-2xl bg-neutral-900 border border-white/5 flex items-center justify-center text-neutral-500 hover:text-yellow-500 hover:bg-yellow-500/10 transition-all active:scale-90 shadow-xl">
                                        <Zap size={24} />
                                    </button>
                                </div>
                            }
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
