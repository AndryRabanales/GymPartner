import React from 'react';
import { Shield, MapPin, Zap, Sparkles, Activity, X } from 'lucide-react';
import { FadeInImage } from './FadeInImage';
import { cloudinaryService } from '../../services/CloudinaryService';

interface UserProfileCardProps {
    user: {
        id: string;
        username: string;
        avatar_url: string | null;
        banner_url?: string | null;
        gym_name: string;
        gym_image: string | null;
        gym_color?: string;
        training_days_count: number;
        followers_count: number;
        following_count: number;
        distance?: string;
        bio?: string;
        is_pro?: boolean;
    };
    onClose?: () => void;
    actions?: React.ReactNode;
}

const FALLBACK_BANNERS = [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571902258032-783ec5ad6dfc?auto=format&fit=crop&q=80'
];

export const UserProfileCard: React.FC<UserProfileCardProps> = ({ user, onClose, actions }) => {
    console.log("📸 [CARD] Recibiendo datos de perfil:", user.username, "| Seguidores:", user.followers_count, "| Siguiendo:", (user as any).is_following);
    return (
        <div className="flex-1 flex flex-col relative bg-black/40 backdrop-blur-3xl w-full h-full rounded-[3rem] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden select-none">
            {/* Close Button (if provided) */}
            {onClose && (
                <button 
                    onClick={onClose}
                    className="absolute top-4 left-4 z-50 p-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-white/70 hover:text-white transition-all active:scale-90"
                >
                    <X size={20} />
                </button>
            )}

            {/* --- STATIC IDENTITY SECTION --- */}
            <div className="shrink-0 flex flex-col items-center">
                {/* Banner */}
                <div className="h-40 sm:h-48 shrink-0 relative w-full bg-neutral-800 overflow-hidden">
                    <FadeInImage
                        src={user.banner_url || FALLBACK_BANNERS[0]}
                        alt="Banner"
                        className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                </div>

                {/* Avatar */}
                <div className="relative z-30 -mt-12 group">
                    <div className="absolute -inset-1 bg-gym-primary rounded-full blur-xl opacity-40"></div>
                    <div className="relative w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-neutral-800 to-neutral-600 shadow-2xl">
                        <div className="w-full h-full rounded-full bg-neutral-900 flex items-center justify-center overflow-hidden border border-white/10 relative">
                            {user.avatar_url ? (
                                <FadeInImage
                                    src={cloudinaryService.getOptimizedImageUrl(user.avatar_url, { width: 150, height: 150 })}
                                    alt={user.username}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center">
                                    <span className="text-3xl font-black text-gym-primary italic">{user.username[0].toUpperCase()}</span>
                                </div>
                            )}
                            {user.is_pro && (
                                <div className="absolute bottom-0 right-0 bg-gym-primary text-black p-1 rounded-full border-2 border-black shadow-lg">
                                    <Shield size={10} fill="currentColor" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Name & Gym */}
                <div className="text-center mt-3 pb-4 border-b border-white/5 w-full">
                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-tight drop-shadow-lg px-4">
                        {user.username.replace('_', ' ')}
                    </h2>
                    <p className="text-[10px] font-bold text-neutral-500 mt-1 flex items-center justify-center gap-1.5 uppercase tracking-widest">
                        <MapPin size={10} className="text-gym-primary" /> {user.gym_name}
                    </p>
                </div>
            </div>

            {/* --- SCROLLABLE INFORMATION AREA --- */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-8 space-y-6">
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 w-full">
                    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5 text-center">
                        <p className="text-lg font-black text-gym-primary leading-none italic">{user.training_days_count}</p>
                        <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Entrenos</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5 text-center">
                        <p className="text-lg font-black text-white leading-none italic">{user.followers_count}</p>
                        <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Seguidores</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5 text-center">
                        <p className="text-lg font-black text-white leading-none italic">{user.following_count}</p>
                        <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Seguidos</p>
                    </div>
                </div>

                {/* Base Card */}
                <div 
                    className="rounded-[2.5rem] border border-white/5 relative overflow-hidden group shadow-2xl min-h-[160px]"
                    style={{ backgroundColor: user.gym_color || '#E5FF00' }}
                >
                    {user.gym_image && (
                        <div className="absolute inset-0 opacity-100">
                            <img src={user.gym_image} alt="Gym" className="w-full h-full object-cover" />
                        </div>
                    )}
                    {/* Subtle Bottom Overlay only for Text Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    
                    <div className="relative z-10 p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-gym-primary/10 flex items-center justify-center">
                                <Sparkles size={12} className="text-gym-primary" />
                            </div>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest italic" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>
                                Base Principal
                            </span>
                        </div>
                        <p 
                            className="text-base font-black text-white leading-relaxed italic uppercase tracking-tight"
                            style={{ textShadow: '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000' }}
                        >
                            {user.gym_name.toUpperCase()}
                        </p>
                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white/90">
                                <Activity size={14} className="text-gym-primary" />
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>
                                    Enfocado
                                </span>
                            </div>
                            {user.distance && (
                                <div className="px-3 py-1.5 bg-black/40 rounded-xl border border-white/10 text-[10px] font-mono text-white font-bold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                                    {user.distance} KM
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bio Text */}
                {user.bio && (
                    <div className="px-2">
                        <p className="text-sm font-medium text-neutral-400 italic leading-relaxed text-center">
                            "{user.bio}"
                        </p>
                    </div>
                )}
            </div>

            {/* Actions (if provided) */}
            {actions && (
                <div className="shrink-0 p-4 pt-0">
                    {actions}
                </div>
            )}
        </div>
    );
};
