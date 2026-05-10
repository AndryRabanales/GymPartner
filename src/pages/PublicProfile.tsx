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
        try {
            // SMART SEARCH: Detect if identifier is a UUID or a Username
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
            
            let query = supabase
                .from('profiles')
                .select('id, username, avatar_url');

            if (isUUID) {
                query = query.eq('id', identifier);
            } else {
                query = query.ilike('username', identifier);
            }

            const { data, error } = await query.maybeSingle();

            if (error) {
                console.error("Supabase error:", error);
                throw error;
            }

            if (data) {
                // 1. Fetch REAL stats with direct counts for maximum reliability
                const [followersRes, followingRes, workoutsRes, gymRes] = await Promise.all([
                    supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', data.id),
                    supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', data.id),
                    supabase.from('workout_sessions').select('id', { count: 'exact' }).eq('user_id', data.id),
                    supabase.from('user_gyms').select('*, gyms(name, image_url)').eq('user_id', data.id).eq('is_home_base', true).maybeSingle()
                ]);

                if (authUser) {
                    const following = await socialService.getFollowStatus(authUser.id, data.id);
                    setIsFollowing(following);
                }

                setProfile({
                    ...data,
                    // Use real counts
                    training_days_count: workoutsRes.count || 0,
                    followers_count: followersRes.count || 0,
                    following_count: followingRes.count || 0,
                    // Real Gym Info
                    gym_name: (gymRes.data as any)?.gyms?.name || "Guerrero Independiente",
                    gym_image: (gymRes.data as any)?.gyms?.image_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80',
                    banner_url: data.banner_url || FALLBACK_BANNERS[Math.floor(Math.random() * FALLBACK_BANNERS.length)],
                    bio: data.bio || "Guerrero de la legión GymPartner. 🔥",
                    distance: 'Base'
                });
            } else {
                // Not found state
                throw new Error("Profile not found");
            }
        } catch (error) {
            console.error("Error loading profile:", error);
            setProfile({
                id: 'unknown',
                username: identifier || 'Guerrero',
                avatar_url: null,
                banner_url: FALLBACK_BANNERS[0],
                bio: "Este guerrero aún no ha reclamado su identidad en la legión.",
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
