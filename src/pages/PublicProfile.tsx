import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader, ArrowLeft, Crown, MapPin, Star, Swords } from 'lucide-react';
import { TierService } from '../services/TierService';

export const PublicProfile = () => {
    const { username } = useParams();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
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
                }
            } catch (err) {
                console.error(err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        if (username) fetchProfile();
    }, [username]);

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
        <div className="min-h-screen bg-black text-white pb-20">
            {/* Header / Banner */}
            <div 
                className="relative h-48 sm:h-64 bg-neutral-900 overflow-hidden"
                style={profile.custom_settings?.banner_url ? {
                    backgroundImage: `url(${profile.custom_settings.banner_url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                } : {}}
            >
                <div className="absolute inset-0 bg-black/60"></div>
                <button 
                    onClick={() => navigate(-1)}
                    className="absolute top-6 left-6 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white border border-white/10"
                >
                    <ArrowLeft size={20} />
                </button>
            </div>

            {/* Profile Info */}
            <div className="max-w-3xl mx-auto px-6 -mt-20 relative z-10">
                <div className="flex flex-col items-center">
                    {/* Avatar with Tier Ring */}
                    <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center">
                        <div className={`absolute inset-0 rounded-full blur-2xl transform scale-100 ${currentTier.color.replace('text-', 'bg-')}/20`}></div>
                        
                        <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-lg" viewBox="0 0 160 160">
                            <circle cx="80" cy="80" r="74" fill="transparent" stroke="#1F1F1F" strokeWidth="6" />
                        </svg>

                        <div className={`w-[130px] h-[130px] sm:w-[155px] sm:h-[155px] rounded-full overflow-hidden border-4 bg-neutral-800 shadow-inner ${currentTier.borderColor}`}>
                            <img 
                                src={profile.avatar_url || '/default-avatar.png'} 
                                alt={profile.username}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>

                    {/* Name & Title */}
                    <div className="text-center mt-6">
                        <h1 className={`text-4xl sm:text-5xl font-black ${currentTier.color} italic uppercase tracking-tighter drop-shadow-xl`}>
                            {profile.username}
                        </h1>
                        <div className="flex items-center justify-center gap-3 mt-2">
                            <span className="text-neutral-500 text-xs font-black tracking-[0.3em] uppercase">
                                {currentTier.name}
                            </span>
                        </div>
                    </div>

                    {/* Bio */}
                    {profile.description && (
                        <p className="text-neutral-400 text-center mt-6 max-w-md font-medium leading-relaxed">
                            "{profile.description}"
                        </p>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 w-full mt-10">
                        <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-3xl text-center backdrop-blur-sm">
                            <span className="block text-3xl font-black text-white mb-1">{profile.total_referrals || 0}</span>
                            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Seguidores</span>
                        </div>
                        <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-3xl text-center backdrop-blur-sm">
                            <span className="block text-3xl font-black text-white mb-1">{Math.floor(profile.xp / 100)}</span>
                            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Check-ins</span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="w-full mt-8">
                        <button 
                            onClick={() => alert('¡Función de seguir próximamente!')}
                            className="w-full bg-gym-primary text-black font-black py-4 rounded-2xl uppercase italic tracking-tighter hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(229,255,0,0.2)]"
                        >
                            Seguir a {profile.username}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
