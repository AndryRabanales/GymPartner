// Updated for final deployment trigger

import React, { useState, useEffect } from 'react';
import { Shield, MapPin, Zap, Sparkles, Activity, X, History, Eye, EyeOff, Lock, Unlock, Swords, Loader2, CheckCircle2, Heart } from 'lucide-react';
import { FadeInImage } from './FadeInImage';
import { cloudinaryService } from '../../services/CloudinaryService';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { socialService } from '../../services/SocialService';
import { notificationService } from '../../services/NotificationService';

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
        gym_passport?: { id: string, name: string, is_favorite?: boolean, is_home_base?: boolean }[];
        custom_settings?: {
            is_history_public?: boolean;
            description?: string;
            banner_url?: string;
        };
    };
    onClose?: () => void;
    actions?: React.ReactNode;
    hidePermissions?: boolean;
    isRadar?: boolean;
}

const FALLBACK_BANNERS = [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571902258032-783ec5ad6dfc?auto=format&fit=crop&q=80'
];

const isDefaultBio = (bio?: string | null) => {
    if (!bio) return true;
    const clean = bio.trim().toLowerCase();
    return (
        clean === '¡hola! soy un nuevo atleta en ginx.' ||
        clean === 'hola! soy un nuevo atleta en ginx.' ||
        clean === 'hola soy un nuevo atleta en ginx.' ||
        clean === '¡hola! soy un nuevo atleta en gympartner.' ||
        clean === 'hola! soy un nuevo atleta en gympartner.' ||
        clean === 'hola soy un nuevo atleta en gympartner.' ||
        clean.includes('entrenando duro para subir de rango') ||
        clean.includes('entrenando para alcanzar el siguiente nivel') ||
        clean === 'entrenando duro en ginx.' ||
        clean === 'entrenando duro en gympartner.'
    );
};

export const UserProfileCard: React.FC<UserProfileCardProps> = ({ user, onClose, actions, hidePermissions = false, isRadar = false }) => {
    console.log("📸 [CARD] Recibiendo datos de perfil:", user.username, "| Pasaporte:", user.gym_passport?.length);
    
    const { user: authUser } = useAuth();
    const [hasHistoryAccess, setHasHistoryAccess] = useState(false);
    const [historyRequestSent, setHistoryRequestSent] = useState(false);
    const [requestingHistory, setRequestingHistory] = useState(false);
    const [routinesRequestSent, setRoutinesRequestSent] = useState(false);
    const [requestingRoutines, setRequestingRoutines] = useState(false);
    const [publicRoutinesCount, setPublicRoutinesCount] = useState(0);
    const [loadingAccess, setLoadingAccess] = useState(true);

    useEffect(() => {
        const checkAccess = async () => {
            if (!authUser) {
                setLoadingAccess(false);
                return;
            }
            if (authUser.id === user.id) {
                setHasHistoryAccess(true);
                setLoadingAccess(false);
                return;
            }

            setLoadingAccess(true);
            try {
                // 1. Check History Access (Public or Shared)
                const isHistoryPublic = user.custom_settings?.is_history_public === true;
                if (isHistoryPublic) {
                    setHasHistoryAccess(true);
                } else {
                    const shared = await socialService.checkHistoryAccess(user.id, authUser.id);
                    setHasHistoryAccess(shared);
                }

                // 2. Check Pending History Request
                const { data: histReq } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('type', 'system')
                    .eq('data->>type', 'request_history')
                    .eq('data->>requester_id', authUser.id)
                    .maybeSingle();

                setHistoryRequestSent(!!histReq);

                // 3. Check Pending Routines Request
                const { data: routReq } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('type', 'system')
                    .eq('data->>type', 'request_routines')
                    .eq('data->>requester_id', authUser.id)
                    .maybeSingle();

                setRoutinesRequestSent(!!routReq);

                // 4. Get public routines count
                const { count } = isHistoryPublic
                    ? await supabase
                        .from('routines')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', user.id)
                    : await supabase
                        .from('routines')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', user.id)
                        .eq('is_public', true);
                
                setPublicRoutinesCount(count || 0);

            } catch (err) {
                console.error("Error checking profile card access state:", err);
            } finally {
                setLoadingAccess(false);
            }
        };

        checkAccess();
    }, [user.id, authUser, user.custom_settings]);

    const handleRequestHistory = async () => {
        if (!authUser || requestingHistory) return;
        setRequestingHistory(true);
        try {
            const success = await notificationService.createNotification(user.id, {
                type: 'system',
                title: '📥 SOLICITUD DE HISTORIAL',
                content: `@${authUser.user_metadata?.username || authUser.username || 'Un guerrero'} te ha solicitado acceso a tu historial de entrenamientos.`,
                data: {
                    type: 'request_history',
                    requester_id: authUser.id,
                    requester_username: authUser.user_metadata?.username || authUser.username || 'Un guerrero'
                }
            });
            if (success) {
                setHistoryRequestSent(true);
                alert("¡Solicitud de acceso al historial enviada! Se le notificará a tu aliado.");
            } else {
                alert("Error al enviar la solicitud.");
            }
        } catch (err) {
            console.error("Error requesting history:", err);
        } finally {
            setRequestingHistory(false);
        }
    };

    const handleRequestRoutines = async () => {
        if (!authUser || requestingRoutines) return;
        setRequestingRoutines(true);
        try {
            const success = await notificationService.createNotification(user.id, {
                type: 'system',
                title: '📥 SOLICITUD DE RUTINAS',
                content: `@${authUser.user_metadata?.username || authUser.username || 'Un guerrero'} te ha solicitado acceso a tus rutinas privadas.`,
                data: {
                    type: 'request_routines',
                    requester_id: authUser.id,
                    requester_username: authUser.user_metadata?.username || authUser.username || 'Un guerrero'
                }
            });
            if (success) {
                setRoutinesRequestSent(true);
                alert("¡Solicitud de acceso a rutinas enviada! Se le notificará a tu aliado.");
            } else {
                alert("Error al enviar la solicitud.");
            }
        } catch (err) {
            console.error("Error requesting routines:", err);
        } finally {
            setRequestingRoutines(false);
        }
    };

    const cardBody = (
        <>
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
                <div className="relative z-30 -mt-14 group">
                    <div className="absolute -inset-1 bg-gym-primary rounded-full blur-xl opacity-40"></div>
                    <div className="relative w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-neutral-800 to-neutral-600 shadow-2xl">
                        <div className="w-full h-full rounded-full bg-neutral-900 flex items-center justify-center overflow-hidden border border-white/10 relative">
                            {user.avatar_url ? (
                                <FadeInImage
                                    src={cloudinaryService.getOptimizedImageUrl(user.avatar_url, { width: 150, height: 150 })}
                                    alt={user.username || 'Atleta'}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center">
                                    <span className="text-3xl font-black text-gym-primary italic">{(user.username?.[0] || 'G').toUpperCase()}</span>
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
                <div className="text-center mt-1 pb-2 border-b border-white/5 w-full">
                    <h2 className="text-xl font-black text-white italic tracking-tighter uppercase leading-tight drop-shadow-lg px-4">
                        {(user.username || 'Guerrero').replace('_', ' ')}
                    </h2>
                    {user.gym_name && (
                        <p className="text-[9px] font-bold text-neutral-500 mt-0.5 flex items-center justify-center gap-1 uppercase tracking-widest">
                            <MapPin size={9} className="text-gym-primary" /> {user.gym_name}
                        </p>
                    )}
                </div>
            </div>

            {/* --- SCROLLABLE INFORMATION AREA --- */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pt-4 pb-8 space-y-3.5">
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-1.5 w-full">
                    <div className="bg-white/5 backdrop-blur-md rounded-xl py-1.5 px-2 border border-white/5 text-center">
                        <p className="text-xs font-black text-gym-primary leading-none italic">{user.training_days_count}</p>
                        <p className="text-[7px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">Entrenos</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md rounded-xl py-1.5 px-2 border border-white/5 text-center">
                        <p className="text-xs font-black text-white leading-none italic">{user.followers_count}</p>
                        <p className="text-[7px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">Seguidores</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md rounded-xl py-1.5 px-2 border border-white/5 text-center">
                        <p className="text-xs font-black text-white leading-none italic">{user.following_count}</p>
                        <p className="text-[7px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">Seguidos</p>
                    </div>
                </div>


                {/* Gym Passport (Visited Gyms) */}
                {user.gym_passport && user.gym_passport.filter(g => !g.name.includes('Arsenal Personal')).length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-center mt-1 -mx-2.5">
                        {user.gym_passport.filter(g => !g.name.includes('Arsenal Personal')).slice(0, 8).map((gym, idx) => {
                            const isFav = gym.is_favorite;
                            const isHome = gym.is_home_base;
                            const borderColor = isFav ? 'border-red-500/50 hover:border-red-500' : isHome ? 'border-yellow-500/50 hover:border-yellow-500' : 'border-white/5 hover:border-white/10';
                            const textColor = isFav ? 'text-red-400 hover:text-red-300' : isHome ? 'text-yellow-400 hover:text-yellow-300' : 'text-neutral-300 hover:text-white';
                            const bgColor = isFav ? 'bg-red-500/10 hover:bg-red-500/20' : isHome ? 'bg-yellow-500/10 hover:bg-yellow-500/20' : 'bg-neutral-900/60 hover:bg-neutral-900/70';
                            const iconColor = isFav ? 'text-red-500' : isHome ? 'text-yellow-500' : 'text-neutral-500';
                            const shadow = 'hover:shadow-[0_0_15px_rgba(0,0,0,0.2)]';
                            return (
                                <div
                                    key={`${gym.id}-${idx}`}
                                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${bgColor} border ${borderColor} ${textColor} ${shadow} text-[9px] font-black uppercase tracking-wider shrink-0`}
                                >
                                    <MapPin size={8} className={`${iconColor} shrink-0`} />
                                    {isFav && <Heart size={8} className="text-red-500 shrink-0" />}
                                    <span className="truncate max-w-[75px]">{gym.name}</span>
                                </div>
                            );
                        })}
                        {user.gym_passport.filter(g => !g.name.includes('Arsenal Personal')).length > 8 && (
                            <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-neutral-900/60 border border-white/5 text-[9px] font-black italic uppercase tracking-tighter text-neutral-400 shrink-0">
                                +{user.gym_passport.filter(g => !g.name.includes('Arsenal Personal')).length - 8} MÁS
                            </div>
                        )}
                    </div>
                )}

                {/* Base Card */}
                {user.gym_name ? (
                    <div 
                        className="rounded-[2.5rem] border border-white/5 relative overflow-hidden group shadow-2xl min-h-[140px]"
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
                                <span className="text-[10px] font-black text-white uppercase tracking-widest italic" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>
                                    GIMNASIO PRINCIPAL
                                </span>
                            </div>
                            <p 
                                className="text-base font-black text-white leading-relaxed italic uppercase tracking-tight"
                                style={{ textShadow: '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000' }}
                            >
                                {user.gym_name.toUpperCase()}
                            </p>
                        </div>
                    </div>
                ) : null}

                {/* Bio Text */}
                <div className="px-2">
                    <p className="text-sm font-medium text-neutral-400 italic leading-relaxed text-center">
                        {(!user.bio || isDefaultBio(user.bio)) ? '"Usuario sin descripción"' : `"${user.bio}"`}
                    </p>
                </div>

                {/* ACCESOS & PERMISOS PANEL */}
                {authUser && authUser.id !== user.id && !hidePermissions && (
                    <div className="bg-white/[0.03] backdrop-blur-md rounded-[2rem] border border-white/10 p-5 space-y-4 shadow-xl">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                            <Shield className="text-gym-primary" size={16} />
                            <h3 className="text-xs font-black text-white italic uppercase tracking-wider">
                                Conexión & Permisos
                            </h3>
                        </div>

                        {loadingAccess ? (
                            <div className="py-4 flex items-center justify-center gap-2 text-neutral-500">
                                <Loader2 className="animate-spin text-gym-primary" size={16} />
                                <span className="text-[10px] font-bold uppercase tracking-wider animate-pulse">Sincronizando...</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Historial Row */}
                                <div className="flex items-center justify-between gap-3 bg-black/20 p-3 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-neutral-950 flex items-center justify-center shrink-0">
                                            <History size={16} className="text-blue-400" />
                                        </div>
                                        <div className="text-left min-w-0">
                                            <p className="text-[10px] font-black text-white uppercase tracking-wide truncate">Historial</p>
                                            <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest truncate">
                                                {user.custom_settings?.is_history_public ? '🔓 Público' : '🔒 Solo aliados'}
                                            </p>
                                        </div>
                                    </div>

                                    {hasHistoryAccess ? (
                                        <div className="bg-green-500/10 border border-green-500/30 text-green-500 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                                            <CheckCircle2 size={10} /> Concedido
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleRequestHistory}
                                            disabled={historyRequestSent || requestingHistory}
                                            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 border flex items-center gap-1 ${
                                                historyRequestSent
                                                    ? 'bg-neutral-800 border-neutral-700 text-neutral-500 cursor-not-allowed'
                                                    : 'bg-gym-primary hover:bg-yellow-400 text-black border-transparent shadow-[0_0_10px_rgba(229,255,0,0.1)] active:scale-95'
                                            }`}
                                        >
                                            {requestingHistory ? (
                                                <Loader2 className="animate-spin" size={10} />
                                            ) : historyRequestSent ? (
                                                'Solicitado ⏳'
                                            ) : (
                                                'Solicitar 📈'
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Rutinas Row */}
                                <div className="flex items-center justify-between gap-3 bg-black/20 p-3 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-neutral-950 flex items-center justify-center shrink-0">
                                            <Swords size={16} className="text-yellow-500" />
                                        </div>
                                        <div className="text-left min-w-0">
                                            <p className="text-[10px] font-black text-white uppercase tracking-wide truncate">Rutinas Arsenal</p>
                                            <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest truncate">
                                                👁️ {publicRoutinesCount} Públicas
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleRequestRoutines}
                                        disabled={routinesRequestSent || requestingRoutines}
                                        className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 border flex items-center gap-1 ${
                                            routinesRequestSent
                                                ? 'bg-neutral-800 border-neutral-700 text-neutral-500 cursor-not-allowed'
                                                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20 active:scale-95'
                                        }`}
                                    >
                                        {requestingRoutines ? (
                                            <Loader2 className="animate-spin" size={10} />
                                        ) : routinesRequestSent ? (
                                            'Solicitado ⏳'
                                        ) : (
                                            'Solicitar 📥'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

        </>
    );

    if (isRadar) {
        return (
            <div className="flex-1 flex flex-col relative w-full h-full p-[2px] rounded-[3rem] bg-gradient-to-br from-orange-600 via-orange-500 to-orange-200 shadow-[0_0_50px_rgba(234,88,12,0.25)] overflow-hidden select-none">
                <div className="flex-1 flex flex-col relative bg-black/95 backdrop-blur-3xl w-full h-full rounded-[2.85rem] overflow-hidden">
                    {cardBody}
                    {actions && (
                        <div className="shrink-0 p-4 pt-0">
                            {actions}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col relative bg-black/40 backdrop-blur-3xl w-full h-full rounded-[3rem] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden select-none">
            {cardBody}
            {actions && (
                <div className="shrink-0 p-4 pt-0">
                    {actions}
                </div>
            )}
        </div>
    );
};
