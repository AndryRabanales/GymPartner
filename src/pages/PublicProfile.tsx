import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserProfileCard } from '../components/ui/UserProfileCard';
import { Zap, Loader2, UserPlus, UserCheck, Swords, X } from 'lucide-react';
import { socialService } from '../services/SocialService';
import { notificationService } from '../services/NotificationService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const FALLBACK_BANNERS = [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571902258032-783ec5ad6dfc?auto=format&fit=crop&q=80'
];

export const PublicProfile = () => {
    const { username } = useParams<{ username: string }>();
    const { user: authUser } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);

    useEffect(() => {
        if (username) {
            loadProfile(username);
        }
    }, [username, authUser]);

    const loadProfile = async (identifier: string) => {
        setLoading(true);
        console.log("🔍 [DIAGNOSTICO] Buscando perfil para:", identifier);
        console.log("👤 [DIAGNOSTICO] ¿Usuario logueado?:", authUser ? authUser.email : "NO (MODO INCOGNITO)");

        try {
            // 1. Find the core profile using PUBLIC columns
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
            let query = supabase.from('profiles').select('*');

            if (isUUID) {
                query = query.eq('id', identifier);
            } else {
                query = query.ilike('username', identifier);
            }

            const { data: profileData, error: profileError } = await query.limit(1).maybeSingle();
            
            if (profileError) {
                console.error("❌ [DIAGNOSTICO ERROR] Error en tabla profiles:", profileError);
                throw profileError;
            }

            console.log("📄 [DIAGNOSTICO] Perfil RAW:", profileData);

            if (profileData) {
                // 2. Fetch GYM info from PUBLIC gyms table using home_gym_id
                let gymName = "Gimnasio Partner";
                if (profileData.home_gym_id) {
                    console.log("🏢 [DIAGNOSTICO] Buscando gym ID:", profileData.home_gym_id);
                    const { data: gymData, error: gymError } = await supabase
                        .from('gyms')
                        .select('name')
                        .eq('id', profileData.home_gym_id)
                        .maybeSingle();
                    
                    if (gymError) console.error("❌ [DIAGNOSTICO ERROR] Error en tabla gyms:", gymError);
                    if (gymData) {
                        console.log("🏢 [DIAGNOSTICO] Gym encontrado:", gymData.name);
                        gymName = gymData.name;
                    }
                }

                // 3. Handle stats with PUBLIC fallbacks
                const stats = await socialService.getProfileStats(profileData.id).catch(() => {
                    console.warn("⚠️ [DIAGNOSTICO] Stats bloqueadas por RLS, usando fallbacks.");
                    return { workoutsCount: 0, followersCount: 0, followingCount: 0 };
                });

                console.log("📊 [DIAGNOSTICO] Stats recibidas:", stats);

                // 4. MAP DATA
                const bioFromSettings = (profileData.custom_settings as any)?.description || (profileData.custom_settings as any)?.bio;
                let cleanAvatar = profileData.avatar_url;
                if (cleanAvatar?.includes('avatars/avatars/')) {
                    cleanAvatar = cleanAvatar.replace('avatars/avatars/', 'avatars/');
                }

                const finalProfile = {
                    ...profileData,
                    avatar_url: cleanAvatar,
                    banner_url: (profileData.custom_settings as any)?.banner_url || FALLBACK_BANNERS[0],
                    bio: profileData.description || bioFromSettings || "¡Entrenando duro para subir de rango! 💪🔥",
                    gym_name: gymName,
                    gym_image: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80',
                    training_days_count: stats.workoutsCount || profileData.checkins_count || 32,
                    followers_count: stats.followersCount || Math.floor((profileData.xp || 0) / 100) || 10,
                    following_count: stats.followingCount || 9,
                    distance: 'Local'
                };

                console.log("✅ [DIAGNOSTICO] Perfil final:", finalProfile);
                setProfile(finalProfile);

                if (authUser) {
                    const following = await socialService.getFollowStatus(authUser.id, profileData.id);
                    setIsFollowing(following);
                }
            } else {
                console.warn("⚠️ [DIAGNOSTICO] No se encontró el perfil en modo público.");
                throw new Error("Profile not found");
            }
        } catch (error: any) {
            console.error("❌ [DIAGNOSTICO FATAL]:", error);
            setProfile({
                id: 'unknown',
                username: identifier || 'Guerrero',
                avatar_url: null,
                banner_url: FALLBACK_BANNERS[0],
                bio: `Error de acceso: ${error.message || 'Privado'}`,
                gym_name: "Desconocido",
                gym_image: FALLBACK_BANNERS[1],
                training_days_count: 0,
                followers_count: 0,
                following_count: 0
            });
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async () => {
        if (!authUser || !profile || profile.id === 'unknown') return;
        try {
            if (isFollowing) {
                await socialService.unfollowUser(authUser.id, profile.id);
                setIsFollowing(false);
                toast.success("Dejaste de seguir");
            } else {
                await socialService.followUser(authUser.id, profile.id);
                setIsFollowing(true);
                toast.success("Siguiendo!");
            }
        } catch (e) {
            toast.error("Error en la acción");
        }
    };

    const handleInvite = async () => {
        if (!profile || profile.id === 'unknown') return;
        try {
            const success = await notificationService.sendInvitation(profile.id, profile.username);
            if (success) toast.success("Desafío enviado!");
        } catch (e) {
            toast.error("Error al enviar invitación");
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
                <div className="relative">
                    <div className="absolute inset-0 bg-gym-primary/20 blur-3xl rounded-full animate-pulse"></div>
                    <Loader2 className="text-gym-primary animate-spin relative z-10" size={64} />
                </div>
                <span className="mt-8 text-[11px] font-black text-gym-primary uppercase tracking-[0.4em] animate-pulse italic text-center">
                    Sincronizando Identidad...
                </span>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-700">
            {/* Ambient Background Effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] pointer-events-none opacity-20">
                <div className="absolute inset-0 bg-gradient-radial from-gym-primary/20 via-transparent to-transparent"></div>
            </div>

            {/* THE CARD CONTAINER - Same as Ranking Modal */}
            <div className="relative w-full max-w-sm h-[85vh] max-h-[750px] shadow-[0_40px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(250,204,21,0.1)] animate-in zoom-in-95 slide-in-from-bottom-12 duration-700">
                
                {/* Close/Back Button */}
                <button 
                    onClick={() => navigate(-1)}
                    className="absolute -top-12 right-0 flex items-center gap-2 text-neutral-500 hover:text-white transition-all group"
                >
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Cerrar</span>
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <X size={18} />
                    </div>
                </button>

                <UserProfileCard 
                    user={profile} 
                    actions={
                        <div className="flex gap-3">
                            {authUser ? (
                                <>
                                    <button 
                                        onClick={handleFollow}
                                        className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                            isFollowing 
                                            ? 'bg-neutral-800 text-neutral-400 border border-white/5' 
                                            : 'bg-neutral-900 text-white border border-white/10 hover:bg-neutral-800 shadow-xl'
                                        }`}
                                    >
                                        {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
                                        {isFollowing ? 'SIGUIENDO' : 'SEGUIR'}
                                    </button>
                                    <button 
                                        onClick={handleInvite}
                                        className="flex-[1.5] py-4 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-gym-primary transition-all active:scale-95 shadow-[0_10px_30px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2"
                                    >
                                        <Swords size={18} fill="currentColor" />
                                        DESAFIAR
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={() => navigate('/login')}
                                    className="w-full py-4 bg-white text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl hover:bg-gym-primary transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <Zap size={18} fill="currentColor" />
                                    ÚNETE A GYMPARTNER
                                </button>
                            )}
                        </div>
                    }
                />
            </div>
        </div>
    );
};
