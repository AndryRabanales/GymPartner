import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
    Loader, ArrowLeft, Crown, MapPin, UserPlus, UserCheck, 
    Swords, Shield, Zap, TrendingUp 
} from 'lucide-react';
import { TierService } from '../services/TierService';
import { socialService } from '../services/SocialService';
import { userService } from '../services/UserService';
import { cloudinaryService } from '../services/CloudinaryService';
import { useAuth } from '../context/AuthContext';

export const PublicProfile = () => {
    const { username } = useParams();
    const { user } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState({ followersCount: 0, followingCount: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeTab, setActiveTab] = useState<'routines' | 'stats'>('routines');
    const [publicRoutines, setPublicRoutines] = useState<any[]>([]);
    
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('username', username)
                    .single();

                if (error || !data) {
                    setError(true);
                } else {
                    setProfile(data);
                    
                    // Fetch Stats
                    const s = await socialService.getProfileStats(data.id);
                    setStats(s);

                    // Check Follow Status
                    if (user && user.id !== data.id) {
                        const following = await socialService.getFollowStatus(user.id, data.id);
                        setIsFollowing(following);
                    }

                    // Fetch Routines
                    const routines = await userService.getUserPublicRoutines(data.id);
                    setPublicRoutines(routines);
                }
            } catch (err) {
                console.error(err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        if (username) fetchProfile();
    }, [username, user]);

    const handleFollowToggle = async () => {
        if (!user || !profile) return;
        const newStatus = !isFollowing;
        setIsFollowing(newStatus);
        setStats(prev => ({ ...prev, followersCount: prev.followersCount + (newStatus ? 1 : -1) }));

        if (newStatus) {
            await socialService.followUser(user.id, profile.id);
        } else {
            await socialService.unfollowUser(user.id, profile.id);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <Loader className="text-gym-primary animate-spin" size={40} />
        </div>
    );

    if (error || !profile) return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-4xl font-black text-white mb-4 italic uppercase">Perfil no encontrado</h1>
            <p className="text-neutral-500 mb-8 uppercase font-bold tracking-widest">El GymRat que buscas no existe o ha cambiado su nombre.</p>
            <button onClick={() => navigate('/')} className="bg-gym-primary text-black font-black px-8 py-3 rounded-full uppercase italic tracking-tighter">Volver al Inicio</button>
        </div>
    );

    const currentTier = TierService.getTier(profile.xp / 100);

    return (
        <div className="min-h-screen bg-black text-white pb-32">
            {/* Header / Banner */}
            <div 
                className="relative h-48 sm:h-72 bg-neutral-900 overflow-hidden"
                style={profile.custom_settings?.banner_url ? {
                    backgroundImage: `url(${cloudinaryService.getOptimizedImageUrl(profile.custom_settings.banner_url, { width: 600, height: 300 })})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                } : {}}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                <button 
                    onClick={() => navigate(-1)}
                    className="absolute top-6 left-6 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white border border-white/10 z-20"
                >
                    <ArrowLeft size={20} />
                </button>

                {/* Boost Badge (If active) */}
                {profile.boost_until && new Date(profile.boost_until) > new Date() && (
                    <div className="absolute top-6 right-6 z-20 animate-pulse">
                        <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.5)] flex items-center gap-1">
                            <Zap size={10} fill="currentColor" />
                            Boost Activo
                        </div>
                    </div>
                )}
            </div>

            {/* Profile Content */}
            <div className="max-w-xl mx-auto px-6 -mt-24 relative z-10">
                <div className="flex flex-col items-center">
                    {/* Avatar with Ring */}
                    <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center mb-6">
                        <div className={`absolute inset-0 rounded-full blur-2xl transform scale-100 ${currentTier.color.replace('text-', 'bg-')}/30 animate-pulse`}></div>
                        
                        <div className={`w-[135px] h-[135px] sm:w-[160px] sm:h-[160px] rounded-full overflow-hidden border-4 bg-neutral-900 shadow-2xl relative z-10 ${currentTier.borderColor}`}>
                            <img 
                                src={cloudinaryService.getOptimizedImageUrl(profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}&background=random`, { width: 160, height: 160 })} 
                                alt={profile.username}
                                className="w-full h-full object-cover scale-105"
                            />
                        </div>
                    </div>

                    {/* Name & Title */}
                    <div className="text-center space-y-2">
                        <h1 className="text-4xl sm:text-5xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg leading-none">
                            {profile.username}
                        </h1>
                        <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${currentTier.color} flex items-center justify-center gap-2`}>
                            <Shield size={12} fill="currentColor" />
                            {currentTier.name}
                            <Shield size={12} fill="currentColor" />
                        </p>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 w-full mt-8 border-y border-white/5 py-6 bg-white/[0.02] rounded-2xl">
                        <div className="text-center">
                            <span className="block text-2xl font-black text-white leading-none mb-1">{stats.followersCount}</span>
                            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Seguidores</span>
                        </div>
                        <div className="text-center border-l border-white/5">
                            <span className="block text-2xl font-black text-white leading-none mb-1">{Math.floor(profile.xp / 100)}</span>
                            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Entrenos</span>
                        </div>
                    </div>

                    {/* Description */}
                    {profile.description && (
                        <p className="mt-8 text-neutral-400 text-center font-medium leading-relaxed italic opacity-80">
                            "{profile.description}"
                        </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 w-full mt-10">
                        {user && user.id !== profile.id ? (
                            <>
                                <button 
                                    onClick={handleFollowToggle}
                                    className={`flex-1 py-4 rounded-2xl font-black uppercase italic tracking-tighter transition-all flex items-center justify-center gap-2 shadow-lg ${
                                        isFollowing 
                                        ? 'bg-neutral-800 text-neutral-400 border border-neutral-700' 
                                        : 'bg-white text-black hover:bg-neutral-200'
                                    }`}
                                >
                                    {isFollowing ? <UserCheck size={18} /> : <UserPlus size={18} />}
                                    {isFollowing ? 'Siguiendo' : 'Seguir'}
                                </button>
                                <button 
                                    onClick={() => alert('¡Invitación enviada!')}
                                    className="flex-[1.5] bg-gym-primary text-black font-black py-4 rounded-2xl uppercase italic tracking-tighter hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(229,255,0,0.3)] flex items-center justify-center gap-2"
                                >
                                    <Swords size={18} />
                                    Invitar
                                </button>
                            </>
                        ) : !user ? (
                            <button 
                                onClick={() => navigate('/login')}
                                className="w-full bg-gym-primary text-black font-black py-4 rounded-2xl uppercase italic tracking-tighter"
                            >
                                Únete a GymPartner
                            </button>
                        ) : null}
                    </div>

                    {/* Tabs switcher */}
                    <div className="flex w-full mt-12 border-b border-white/5">
                        <button 
                            onClick={() => setActiveTab('routines')}
                            className={`flex-1 pb-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'routines' ? 'text-gym-primary' : 'text-neutral-500'}`}
                        >
                            Mazos Públicos
                            {activeTab === 'routines' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gym-primary rounded-t-full shadow-[0_0_15px_rgba(229,255,0,0.5)]"></div>}
                        </button>
                        <button 
                            onClick={() => setActiveTab('stats')}
                            className={`flex-1 pb-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'stats' ? 'text-gym-primary' : 'text-neutral-500'}`}
                        >
                            Logros
                            {activeTab === 'stats' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gym-primary rounded-t-full shadow-[0_0_15px_rgba(229,255,0,0.5)]"></div>}
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="w-full mt-6 space-y-3">
                        {activeTab === 'routines' && (
                            <>
                                {publicRoutines.map(routine => (
                                    <div key={routine.id} className="bg-neutral-900 border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-gym-primary/30 transition-all cursor-pointer">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center text-gym-primary border border-white/5">
                                                <Swords size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white uppercase italic tracking-wider">{routine.name}</h3>
                                                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">{routine.exercises?.length || 0} Ejercicios</p>
                                            </div>
                                        </div>
                                        <ArrowLeft className="text-neutral-600 rotate-180 group-hover:text-gym-primary transition-colors" size={16} />
                                    </div>
                                ))}
                                {publicRoutines.length === 0 && (
                                    <div className="py-12 text-center text-neutral-600 uppercase font-black text-xs tracking-widest opacity-40">
                                        Sin mazos públicos aún
                                    </div>
                                )}
                            </>
                        )}
                        
                        {activeTab === 'stats' && (
                            <div className="grid grid-cols-3 gap-3">
                                {[1,2,3].map(i => (
                                    <div key={i} className="aspect-square bg-neutral-900 rounded-2xl border border-white/5 flex flex-col items-center justify-center opacity-20 grayscale">
                                        <TrendingUp size={24} className="mb-2" />
                                        <span className="text-[8px] font-black uppercase tracking-tighter">Bloqueado</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
