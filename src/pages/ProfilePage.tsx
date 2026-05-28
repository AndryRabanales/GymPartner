import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserProfileCard } from '../components/ui/UserProfileCard';
import { Zap, ChevronLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const FALLBACK_BANNERS = [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571902258032-783ec5ad6dfc?auto=format&fit=crop&q=80'
];

export const ProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadProfile(id);
        }
    }, [id]);

    const loadProfile = async (userId: string) => {
        setLoading(true);
        try {
            // SAFE QUERY: Essential columns only to avoid schema errors
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, bio')
                .eq('id', userId)
                .single();

            if (error) throw error;

            if (data) {
                // Enrich with fallbacks for the premium experience
                setProfile({
                    ...data,
                    banner_url: FALLBACK_BANNERS[Math.floor(Math.random() * FALLBACK_BANNERS.length)],
                    gym_name: null,
                    gym_image: null,
                    training_days_count: 0,
                    followers_count: 0,
                    following_count: 0,
                    bio: data.bio || null
                });
            }
        } catch (error) {
            console.error("Error loading profile:", error);
            toast.error("No se pudo encontrar al guerrero");
            navigate('/ranking');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center">
                <Loader2 className="text-gym-primary animate-spin" size={48} />
                <span className="mt-4 text-[10px] font-black text-gym-primary uppercase tracking-[0.3em] animate-pulse italic">
                    Localizando Guerrero...
                </span>
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="flex-1 flex flex-col p-4 sm:p-8 animate-in fade-in duration-700">
            {/* Back Button for internal navigation */}
            <div className="max-w-sm mx-auto w-full mb-4">
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors group"
                >
                    <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Volver</span>
                </button>
            </div>

            {/* THE PREMIUM CARD */}
            <div className="max-w-sm mx-auto w-full h-[85vh] max-h-[750px] shadow-[0_0_100px_rgba(250,204,21,0.1)]">
                <UserProfileCard 
                    user={profile} 
                    actions={
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => navigate('/auth')}
                                className="w-full py-4 bg-white text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl hover:bg-gym-primary transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                                <Zap size={18} fill="currentColor" />
                                ÚNETE A LA LEGIÓN
                            </button>
                            <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest text-center italic">
                                Escanea el radar para encontrar nuevos compañeros
                            </p>
                        </div>
                    }
                />
            </div>
        </div>
    );
};
