import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserProfileCard } from '../components/ui/UserProfileCard';
import { Zap, ChevronLeft, Loader2, UserPlus, UserCheck, Swords } from 'lucide-react';
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
    }, [username]);

    const loadProfile = async (uname: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, bio')
                .eq('username', uname)
                .single();

            if (error) throw error;

            if (data) {
                // Check follow status
                if (authUser) {
                    const following = await socialService.getFollowStatus(authUser.id, data.id);
                    setIsFollowing(following);
                }

                // Enrich with fallbacks
                setProfile({
                    ...data,
                    banner_url: FALLBACK_BANNERS[Math.floor(Math.random() * FALLBACK_BANNERS.length)],
                    gym_name: "Base Central GymPartner",
                    gym_image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80',
                    training_days_count: Math.floor(Math.random() * 50) + 10,
                    followers_count: Math.floor(Math.random() * 100),
                    following_count: Math.floor(Math.random() * 100),
                    bio: data.bio || "Enfocado en el ascenso. ¡Únete a mi equipo para dominar el ranking! 🔥"
                });
            }
        } catch (error) {
            console.error("Error loading profile:", error);
            toast.error("Guerrero no localizado");
            navigate('/ranking');
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async () => {
        if (!authUser || !profile) return;
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
        if (!profile) return;
        try {
            const success = await notificationService.sendInvitation(profile.id, profile.username);
            if (success) toast.success("Desafío enviado!");
        } catch (e) {
            toast.error("Error al enviar invitación");
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[80vh]">
                <Loader2 className="text-gym-primary animate-spin" size={48} />
                <span className="mt-4 text-[10px] font-black text-gym-primary uppercase tracking-[0.3em] animate-pulse italic text-center">
                    Sincronizando Identidad...
                </span>
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="flex-1 flex flex-col p-4 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Nav Header */}
            <div className="max-w-sm mx-auto w-full mb-6 flex items-center justify-between">
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors group"
                >
                    <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Volver</span>
                </button>
                <div className="text-[10px] font-black text-gym-primary uppercase tracking-widest animate-pulse">
                    Perfil Público
                </div>
            </div>

            {/* THE PREMIUM CARD */}
            <div className="max-w-sm mx-auto w-full h-[85vh] max-h-[750px] shadow-[0_0_100px_rgba(250,204,21,0.15)] relative">
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
                                            : 'bg-neutral-900 text-white border border-white/10 hover:bg-neutral-800'
                                        }`}
                                    >
                                        {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
                                        {isFollowing ? 'SIGUIENDO' : 'SEGUIR'}
                                    </button>
                                    <button 
                                        onClick={handleInvite}
                                        className="flex-[1.5] py-4 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-gym-primary transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
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
