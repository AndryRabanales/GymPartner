import { useState, useEffect } from 'react';
import { X, Search, Check, Users, Loader2, Share2, Globe, Lock, HelpCircle } from 'lucide-react';
import { socialService } from '../../services/SocialService';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface ShareHistoryModalProps {
    userId: string;
    onClose: () => void;
}

export const ShareHistoryModal = ({ userId, onClose }: ShareHistoryModalProps) => {
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Followers & Following List
    const [followersAndFollowing, setFollowersAndFollowing] = useState<any[]>([]);

    // Selection States (keeps track of who has shared access in real-time)
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    // Public History States
    const [isPublic, setIsPublic] = useState(false);
    const [currentSettings, setCurrentSettings] = useState<any>({});
    const [updatingPrivacy, setUpdatingPrivacy] = useState(false);

    // Toggling User ID tracker for inline spinner
    const [togglingUser, setTogglingUser] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch relations, current shares, and profile custom_settings in parallel
                const [followers, following, existingShares, { data: profile }] = await Promise.all([
                    socialService.getFollowers(userId),
                    socialService.getFollowing(userId),
                    socialService.getHistoryShares(userId),
                    supabase.from('profiles').select('custom_settings').eq('id', userId).maybeSingle()
                ]);

                // Merge and deduplicate by user ID
                const merged = [...(followers || []), ...(following || [])];
                const seen = new Set();
                const uniqueRelations = merged.filter(user => {
                    if (!user || seen.has(user.id)) return false;
                    seen.add(user.id);
                    return true;
                });

                setFollowersAndFollowing(uniqueRelations);
                setSelectedUsers(new Set(existingShares || []));

                if (profile) {
                    const settings = profile.custom_settings || {};
                    setCurrentSettings(settings);
                    setIsPublic(settings.is_history_public === true);
                }
            } catch (err) {
                console.error("Error loading history data:", err);
                toast.error("Error al cargar la información del historial.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [userId]);

    // Toggle Public Privacy Setting instantly in background
    const togglePublicHistory = async () => {
        if (updatingPrivacy) return;
        setUpdatingPrivacy(true);
        const nextValue = !isPublic;
        setIsPublic(nextValue);

        try {
            const updatedSettings = {
                ...currentSettings,
                is_history_public: nextValue
            };

            const { error } = await supabase
                .from('profiles')
                .update({ custom_settings: updatedSettings })
                .eq('id', userId);

            if (error) {
                // Rollback on failure
                setIsPublic(!nextValue);
                toast.error("Error al actualizar la configuración.");
            } else {
                setCurrentSettings(updatedSettings);
                toast.success(nextValue 
                    ? "🔓 ¡Tu historial ahora es público para todos!" 
                    : "🔒 Historial privado (solo accesible para aliados autorizados)."
                );
            }
        } catch (err) {
            setIsPublic(!nextValue);
            console.error("Error toggling public history:", err);
            toast.error("Error inesperado al guardar privacidad.");
        } finally {
            setUpdatingPrivacy(false);
        }
    };

    // Toggle Share with single user instantly in background (one-by-one)
    const toggleShareWithUser = async (targetUserId: string) => {
        if (togglingUser) return; // Prevent double trigger
        setTogglingUser(targetUserId);
        const isShared = selectedUsers.has(targetUserId);

        try {
            if (isShared) {
                // DELETE Access
                const { error } = await supabase
                    .from('history_shares')
                    .delete()
                    .eq('shared_by', userId)
                    .eq('shared_with', targetUserId);

                if (error) throw error;

                setSelectedUsers(prev => {
                    const next = new Set(prev);
                    next.delete(targetUserId);
                    return next;
                });
                toast.success("Acceso revocado correctamente.");
            } else {
                // INSERT Access
                const { error } = await supabase
                    .from('history_shares')
                    .insert({
                        shared_by: userId,
                        shared_with: targetUserId
                    });

                if (error) throw error;

                setSelectedUsers(prev => {
                    const next = new Set(prev);
                    next.add(targetUserId);
                    return next;
                });
                toast.success("¡Historial compartido exitosamente!");
            }
        } catch (err: any) {
            console.error("Error toggling history share:", err);
            if (err && err.code === '42P01') {
                alert("⚠️ Para poder compartir tu historial, debes ejecutar el script SQL de migración 'history_shares_migration.sql' en tu panel de Supabase.");
            } else {
                toast.error("Error al actualizar permisos de acceso.");
            }
        } finally {
            setTogglingUser(null);
        }
    };

    // Filter relations list
    const filteredUsers = followersAndFollowing.filter(user => 
        user.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[999] flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col gap-6 select-none">
                
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gym-primary/10 rounded-2xl flex items-center justify-center text-gym-primary shrink-0">
                            <Share2 size={24} />
                        </div>
                        <div className="text-left">
                            <h2 className="text-xl md:text-2xl font-black italic text-white uppercase tracking-tight">Privacidad del Historial</h2>
                            <p className="text-gym-primary text-xs font-bold uppercase tracking-wider">
                                Control de accesos en tiempo real
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-all active:scale-95 shrink-0"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 1. PUBLIC VISIBILITY CARD TOGGLE */}
                <div className={`p-5 rounded-3xl border transition-all duration-300 ${
                    isPublic 
                        ? 'bg-gym-primary/5 border-gym-primary/30 shadow-[0_0_20px_rgba(229,255,0,0.03)]' 
                        : 'bg-black/30 border-white/5'
                }`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3 text-left">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                isPublic ? 'bg-gym-primary text-black' : 'bg-neutral-800 text-neutral-400'
                            }`}>
                                {isPublic ? <Globe size={20} /> : <Lock size={20} />}
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-white uppercase tracking-wide italic">
                                    Siempre Público
                                </h4>
                                <p className="text-xs text-neutral-400 leading-relaxed max-w-[280px]">
                                    Cualquier persona en los rankings, mapa o radar podrá consultar tus entrenamientos realizados sin restricciones.
                                </p>
                            </div>
                        </div>

                        {/* Toggle Switch */}
                        <button
                            onClick={togglePublicHistory}
                            disabled={updatingPrivacy}
                            className={`w-12 h-7 rounded-full p-1 transition-all duration-300 relative shrink-0 ${
                                isPublic ? 'bg-gym-primary' : 'bg-neutral-800'
                            }`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 absolute top-1 ${
                                isPublic ? 'left-6' : 'left-1'
                            } ${updatingPrivacy ? 'animate-pulse scale-90' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/5 w-full"></div>

                {/* 2. ONE-BY-ONE PRIVACY SHARING LIST */}
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-gym-primary gap-4">
                        <Loader2 className="animate-spin" size={32} />
                        <span className="text-neutral-400 font-bold uppercase tracking-wider text-[10px] animate-pulse">Cargando aliados...</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 text-left">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2 italic">
                                <Users size={16} className="text-gym-primary" />
                                Compartir Uno a Uno
                            </h3>
                            <span className="bg-neutral-800 text-neutral-400 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest">
                                {selectedUsers.size} Compartido(s)
                            </span>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                            <input
                                type="text"
                                placeholder="Buscar aliado por nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-black border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-gym-primary/50 transition-colors"
                            />
                        </div>

                        {/* List */}
                        <div className="max-h-[35vh] overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
                            {filteredUsers.map(user => {
                                const isShared = selectedUsers.has(user.id);
                                const isTogglingThisUser = togglingUser === user.id;

                                return (
                                    <div
                                        key={user.id}
                                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                            isShared
                                                ? 'bg-gym-primary/[0.02] border-gym-primary/20 shadow-[0_0_15px_rgba(229,255,0,0.01)]'
                                                : 'bg-black/20 border-white/5'
                                        }`}
                                    >
                                        {/* Profile teaser */}
                                        <div className="flex items-center gap-3 truncate min-w-0">
                                            <img
                                                src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username || 'U'}&background=random`}
                                                alt={user.username}
                                                className="w-10 h-10 rounded-xl border border-white/5 shrink-0 object-cover"
                                            />
                                            <div className="text-left truncate min-w-0">
                                                <p className="font-bold text-sm text-white truncate">@{user.username}</p>
                                                <p className="text-[9px] font-medium text-neutral-500 uppercase tracking-widest">
                                                    {isShared ? 'Tiene acceso 🔓' : 'Sin acceso 🔒'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action Button: Toggle Sharing One-By-One (Auto-saves instantly) */}
                                        <button
                                            onClick={() => toggleShareWithUser(user.id)}
                                            disabled={!!togglingUser}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 shrink-0 border min-w-[110px] flex items-center justify-center gap-1.5 ${
                                                isShared
                                                    ? 'bg-gym-primary border-transparent text-black hover:bg-yellow-400 active:scale-95 shadow-[0_0_15px_rgba(229,255,0,0.1)]'
                                                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-white/5 active:scale-95'
                                            }`}
                                        >
                                            {isTogglingThisUser ? (
                                                <Loader2 className="animate-spin" size={12} />
                                            ) : isShared ? (
                                                <>
                                                    <Check size={12} strokeWidth={3} />
                                                    Compartido
                                                </>
                                            ) : (
                                                'Compartir'
                                            )}
                                        </button>
                                    </div>
                                );
                            })}

                            {filteredUsers.length === 0 && (
                                <div className="text-center py-12 text-neutral-500 text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-2">
                                    <HelpCircle size={24} className="text-neutral-600" />
                                    {searchTerm ? "No se encontraron usuarios" : "No tienes seguidores ni seguidos aún"}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer Buttons */}
                {!loading && (
                    <div className="mt-2">
                        <button
                            onClick={onClose}
                            className="w-full bg-white text-black font-black py-4 rounded-2xl transition-all uppercase italic tracking-wider text-xs flex items-center justify-center gap-2 active:scale-95 shadow-2xl hover:bg-gym-primary"
                        >
                            Listo, Guardado ✅
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};
