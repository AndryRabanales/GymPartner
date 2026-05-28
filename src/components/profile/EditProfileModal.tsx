import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Save, Loader, Swords, Trophy, Eye, EyeOff, Users, History } from 'lucide-react';
import { userService } from '../../services/UserService';
import type { User } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { socialService } from '../../services/SocialService';

interface EditProfileModalProps {
    user: User;
    currentUsername: string;
    currentAvatarUrl: string;
    currentBannerUrl?: string;
    currentFeaturedRoutineId?: string;
    currentDescription?: string;
    currentSettings?: any;
    onClose: () => void;
    onUpdate: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
    user,
    currentUsername,
    currentAvatarUrl,
    currentBannerUrl,
    currentFeaturedRoutineId,
    currentDescription,
    currentSettings,
    onClose,
    onUpdate
}) => {
    const [username, setUsername] = useState(currentUsername);
    const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');
    const [description, setDescription] = useState(currentDescription || '');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState(currentAvatarUrl);

    // Banner State
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [bannerPreview, setBannerPreview] = useState(currentBannerUrl);

    // Battle Deck State
    const [routines, setRoutines] = useState<any[]>([]);
    const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(currentFeaturedRoutineId || null);
    const [isHistoryPublic, setIsHistoryPublic] = useState<boolean>(currentSettings?.is_history_public ?? false);
    const [sharedHistoryProfiles, setSharedHistoryProfiles] = useState<any[]>([]);
    const [loadingSharedProfiles, setLoadingSharedProfiles] = useState(false);
    const [revokingProfileId, setRevokingProfileId] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    // Fetch Routines on Mount
    useEffect(() => {
        const fetchRoutines = async () => {
            const routinesData = await userService.getUserRoutines(user.id);
            try {
                const { data: sharesData } = await supabase
                    .from('routine_shares')
                    .select('routine_id')
                    .eq('shared_by', user.id);

                if (sharesData) {
                    const counts = sharesData.reduce((acc: Record<string, number>, curr: any) => {
                        acc[curr.routine_id] = (acc[curr.routine_id] || 0) + 1;
                        return acc;
                    }, {});

                    const enriched = routinesData.map((r: any) => ({
                        ...r,
                        shares_count: counts[r.id] || 0
                    }));
                    setRoutines(enriched);
                    return;
                }
            } catch (err) {
                console.error("Error loading routine share counts:", err);
            }
            setRoutines(routinesData);
        };
        fetchRoutines();
    }, [user.id]);

    useEffect(() => {
        if (!isHistoryPublic) {
            const fetchSharedProfiles = async () => {
                setLoadingSharedProfiles(true);
                const profiles = await socialService.getHistorySharedWithProfiles(user.id);
                setSharedHistoryProfiles(profiles);
                setLoadingSharedProfiles(false);
            };
            fetchSharedProfiles();
        }
    }, [isHistoryPublic, user.id]);

    const handleRevokeAccess = async (sharedWithId: string) => {
        setRevokingProfileId(sharedWithId);
        const success = await socialService.revokeHistoryAccess(user.id, sharedWithId);
        if (success) {
            setSharedHistoryProfiles(prev => prev.filter(p => p.id !== sharedWithId));
        } else {
            alert('Error al remover el acceso.');
        }
        setRevokingProfileId(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setBannerFile(file);
            setBannerPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            let newAvatarUrl = currentAvatarUrl;
            let newBannerUrl = currentBannerUrl;

            // 1. Upload new avatar if selected
            if (avatarFile) {
                const uploadResult = await userService.uploadAvatar(user.id, avatarFile);
                if (uploadResult.success && uploadResult.publicUrl) {
                    newAvatarUrl = uploadResult.publicUrl;
                }
            }

            // 2. Upload new banner if selected
            if (bannerFile) {
                const bannerResult = await userService.uploadBanner(user.id, bannerFile);
                if (bannerResult.success && bannerResult.publicUrl) {
                    newBannerUrl = bannerResult.publicUrl;
                }
            }

            // 3. Update Profile Data (including description)
            console.log("Saving Profile with Routine ID:", selectedRoutineId); // DEBUG

            // Check for first profile completion reward (2gx)
            const updatedSettings = {
                ...currentSettings,
                banner_url: newBannerUrl,
                description: description.trim(), // Save description here
                is_history_public: isHistoryPublic,
                profile_completed_reward_awarded: currentSettings?.profile_completed_reward_awarded ?? false
            };

            const hasAvatar = newAvatarUrl && !newAvatarUrl.includes('ui-avatars.com') && !newAvatarUrl.includes('pravatar.cc');
            const hasBio = description.trim().length > 0;
            const alreadyAwarded = currentSettings?.profile_completed_reward_awarded === true;

            if (hasAvatar && hasBio && !alreadyAwarded) {
                console.log("🎉 First profile completion! Awarding 2 GX points.");
                updatedSettings.profile_completed_reward_awarded = true;
                await userService.addGPoints(user.id, 2, 'first_profile_completion');
            }

            const updateResult = await userService.updateProfile(user.id, {
                username: username,
                avatar_url: newAvatarUrl,
                custom_settings: updatedSettings,
                featured_routine_id: selectedRoutineId // Save selected routine
            });

            if (updateResult.success) {
                console.log("Profile Update Success!");
                onUpdate();
                onClose();
            } else {
                console.error("Profile Update Failed:", updateResult.error);
                alert('Error al actualizar perfil: ' + updateResult.error);
            }

        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Error inesperado al guardar.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800/50 w-full max-w-md rounded-[2.5rem] relative shadow-2xl shadow-black/50 flex flex-col max-h-[85vh] overflow-hidden">

                {/* Static Header */}
                <div className="px-6 pt-5 pb-3 border-b border-white/5 relative shrink-0">
                    <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-400 italic uppercase tracking-tighter">
                        Editar Perfil
                    </h2>
                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mt-0.5">Personaliza tu identidad en GINX</p>
                    
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4.5 right-5 text-neutral-400 hover:text-white hover:bg-white/5 transition-all p-2 rounded-full"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Modern Segmented Control / Tabs */}
                <div className="px-6 py-2 border-b border-white/5 bg-neutral-900/40 shrink-0">
                    <div className="flex p-0.5 bg-black/60 rounded-xl border border-white/5 w-full">
                        <button
                            type="button"
                            onClick={() => setActiveTab('profile')}
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                activeTab === 'profile'
                                    ? 'bg-gradient-to-r from-gym-primary to-yellow-400 text-black shadow-md shadow-gym-primary/10'
                                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Perfil
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('settings')}
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                activeTab === 'settings'
                                    ? 'bg-gradient-to-r from-gym-primary to-yellow-400 text-black shadow-md shadow-gym-primary/10'
                                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Ajustes y Rutinas
                        </button>
                    </div>
                </div>

                {/* Scrollable Form Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                    {activeTab === 'profile' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            {/* Unified Cover & Avatar Header */}
                            <div className="relative mb-5 shrink-0">
                                {/* Banner Upload Section */}
                                <div
                                    onClick={() => bannerInputRef.current?.click()}
                                    className="w-full h-24 rounded-2xl border border-neutral-850 hover:border-gym-primary/50 transition-all cursor-pointer relative overflow-hidden group bg-neutral-950"
                                >
                                    {bannerPreview ? (
                                        <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-300" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/60">
                                            <span className="text-neutral-600 text-[9px] font-black uppercase tracking-widest">Sin Portada</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <Camera className="text-gym-primary mb-0.5" size={16} />
                                        <span className="text-[8px] text-white font-bold uppercase tracking-widest">Cambiar Portada</span>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    ref={bannerInputRef}
                                    onChange={handleBannerChange}
                                    accept="image/*"
                                    className="hidden"
                                />

                                {/* Avatar Upload Section - Overlaps Cover bottom edge */}
                                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20">
                                    <div
                                        className="relative group cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fileInputRef.current?.click();
                                        }}
                                    >
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-gym-primary to-yellow-400 rounded-full blur opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                                        <div className="relative w-16 h-16 rounded-full overflow-hidden border-[3px] border-neutral-900 group-hover:border-gym-primary/50 transition-all duration-300 shadow-xl bg-neutral-950">
                                            <img
                                                src={previewUrl || 'https://i.pravatar.cc/300'}
                                                alt="Preview"
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                            />
                                            {/* Overlay */}
                                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <Camera className="text-white mb-0.5" size={14} />
                                                <span className="text-white text-[7px] font-black uppercase tracking-wider">
                                                    Cambiar
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                </div>
                            </div>

                            {/* Username Input */}
                            <div className="space-y-1 mt-6">
                                <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                                    Nombre de Usuario (Máx. 20 caracteres)
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => {
                                        if (e.target.value.length <= 20) {
                                            setUsername(e.target.value);
                                        }
                                    }}
                                    maxLength={20}
                                    className="w-full bg-neutral-950/50 border-2 border-neutral-800 rounded-xl px-3.5 py-2.5 text-white font-bold tracking-tight focus:outline-none focus:border-gym-primary/70 focus:bg-neutral-950 transition-all placeholder:text-neutral-700 hover:border-neutral-700 text-xs"
                                    placeholder="Tu nombre público..."
                                />
                            </div>

                            {/* Description Input */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                                        Descripción (Aparecerá en el Radar)
                                    </label>
                                    <span className={`text-[8px] font-black tracking-wider transition-colors ${description.length > 150
                                            ? 'text-red-500'
                                            : description.length > 130
                                                ? 'text-yellow-500'
                                                : 'text-neutral-600'
                                        }`}>
                                        {description.length}/150
                                    </span>
                                </div>
                                <textarea
                                    value={description}
                                    onChange={(e) => {
                                        if (e.target.value.length <= 150) {
                                            setDescription(e.target.value);
                                        }
                                    }}
                                    rows={2}
                                    className="w-full bg-neutral-950/50 border-2 border-neutral-800 rounded-xl px-3.5 py-2.5 text-white font-medium tracking-tight focus:outline-none focus:border-gym-primary/70 focus:bg-neutral-950 transition-all placeholder:text-neutral-700 hover:border-neutral-700 resize-none text-xs leading-relaxed"
                                    placeholder="Ej: Levantador de pesas | Entrenando..."
                                />
                                <p className="text-[8px] text-neutral-600 ml-1 leading-relaxed">
                                    💡 Otros usuarios verán esto en el Radar al buscar compañeros.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            {/* PRIVACIDAD DEL HISTORIAL */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gym-primary uppercase tracking-wider flex items-center gap-1.5">
                                    <History size={12} className="animate-pulse text-yellow-500" /> Privacidad del Historial
                                </label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setIsHistoryPublic(true)}
                                        className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all gap-0.5 ${isHistoryPublic
                                            ? 'bg-green-500/10 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.1)] scale-[1.01]'
                                            : 'bg-neutral-950/40 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                                        }`}
                                    >
                                        <Eye size={16} className={isHistoryPublic ? 'text-green-500' : 'text-neutral-500'} />
                                        <span className="font-black text-[9px] uppercase tracking-wider">Público 🔓</span>
                                        <span className="text-[7.5px] font-bold text-center text-neutral-500 leading-tight max-w-[110px] mt-0.5">
                                            Cualquiera podrá ver tus entrenamientos
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setIsHistoryPublic(false)}
                                        className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all gap-0.5 ${!isHistoryPublic
                                            ? 'bg-yellow-500/10 border-yellow-500 text-white shadow-[0_0_10px_rgba(234,179,8,0.1)] scale-[1.01]'
                                            : 'bg-neutral-950/40 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                                        }`}
                                    >
                                        <EyeOff size={16} className={!isHistoryPublic ? 'text-yellow-500' : 'text-neutral-500'} />
                                        <span className="font-black text-[9px] uppercase tracking-wider">Compartido 🔒</span>
                                        <span className="text-[7.5px] font-bold text-center text-neutral-500 leading-tight max-w-[110px] mt-0.5">
                                            Solo aliados autorizados o con invitación
                                        </span>
                                    </button>
                                </div>
                                
                                {!isHistoryPublic && (
                                    <div className="bg-neutral-900/50 rounded-xl border border-neutral-800 p-2">
                                        <h4 className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                            <Users size={10} className="text-gym-primary" /> Aliados Autorizados
                                        </h4>
                                        {loadingSharedProfiles ? (
                                            <div className="flex justify-center py-2">
                                                <Loader className="animate-spin text-gym-primary" size={14} />
                                            </div>
                                        ) : sharedHistoryProfiles.length === 0 ? (
                                            <p className="text-[8px] text-neutral-500 text-center py-1">
                                                Nadie tiene acceso a tu historial por ahora.
                                            </p>
                                        ) : (
                                            <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                                                {sharedHistoryProfiles.map(profile => (
                                                    <div key={profile.id} className="flex items-center justify-between bg-neutral-950/50 p-1.5 rounded-lg border border-neutral-800/50">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <img 
                                                                src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}&background=random`} 
                                                                alt={profile.username} 
                                                                className="w-5 h-5 rounded-full border border-neutral-700 object-cover shrink-0"
                                                            />
                                                            <span className="font-bold text-white text-[10px] truncate">@{profile.username}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRevokeAccess(profile.id)}
                                                            disabled={revokingProfileId === profile.id}
                                                            className="px-1.5 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded text-[8px] font-black uppercase tracking-wider transition-all border border-red-500/20 flex items-center gap-0.5"
                                                        >
                                                            {revokingProfileId === profile.id ? <Loader size={8} className="animate-spin" /> : 'Remover'}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* BATTLE DECK SELECTOR */}
                            <div className="space-y-2 pt-3 border-t border-neutral-850">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-gym-primary uppercase tracking-wider flex items-center gap-1">
                                        <Swords size={12} className="animate-pulse" /> Arsenal Público
                                    </label>
                                    <Link to="/builder" onClick={onClose} className="text-[8px] font-black text-neutral-400 hover:text-gym-primary uppercase flex items-center gap-0.5 transition-colors bg-neutral-900/50 px-2 py-0.5 rounded-full border border-neutral-800 hover:border-gym-primary/20">
                                        <Trophy size={8} /> Crear Nueva
                                    </Link>
                                </div>

                                {/* Scrollable Container */}
                                <div className="relative">
                                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1 scroll-smooth arsenal-scrollbar">
                                        {routines.map((routine, index) => (
                                            <div key={routine.id} className="flex gap-1 animate-in slide-in-from-left duration-200" style={{ animationDelay: `${index * 20}ms` }}>
                                                {/* Selection Button */}
                                                <button
                                                    onClick={() => setSelectedRoutineId(routine.id === selectedRoutineId ? null : routine.id)}
                                                    className={`flex-1 text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group relative overflow-hidden ${selectedRoutineId === routine.id
                                                        ? 'bg-gym-primary/5 border-gym-primary text-white'
                                                        : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-950/65'
                                                        }`}
                                                >
                                                    <div className="flex flex-col gap-0.5 relative z-10 w-full pr-2">
                                                        <span className="font-bold text-[11px] text-white truncate">{routine.name}</span>
                                                        <div className="flex items-center flex-wrap gap-1">
                                                            <span className={`text-[7px] px-1 py-0.2 rounded font-black tracking-wider uppercase ${
                                                                selectedRoutineId === routine.id 
                                                                    ? 'bg-gym-primary/25 text-gym-primary' 
                                                                    : 'bg-neutral-800 text-neutral-500'
                                                            }`}>
                                                                {selectedRoutineId === routine.id ? '⭐ DESTACADA' : 'NORMAL'}
                                                            </span>
                                                            {routine.shares_count > 0 && (
                                                                <span className="px-1 py-0.2 rounded bg-gym-primary/10 text-gym-primary text-[7px] font-black uppercase tracking-wide flex items-center gap-0.5 border border-gym-primary/25 shrink-0">
                                                                    <Users size={6} strokeWidth={3} />
                                                                    {routine.shares_count}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {selectedRoutineId === routine.id && (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-gym-primary animate-pulse shrink-0"></div>
                                                    )}
                                                </button>

                                                {/* Visibility Toggle */}
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        const newStatus = !routine.is_public;
                                                        if (newStatus) {
                                                            const publicCount = routines.filter(r => r.is_public).length;
                                                            if (publicCount >= 5) {
                                                                alert("⚠️ Límite: Solo puedes tener 5 rutinas públicas.");
                                                                return;
                                                            }
                                                        }
                                                        setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, is_public: newStatus } : r));
                                                        await userService.updateRoutineVisibility(routine.id, newStatus);
                                                    }}
                                                    className={`w-9 flex items-center justify-center rounded-xl border transition-all ${routine.is_public
                                                        ? 'bg-green-500/10 border-green-500/80 text-green-500 hover:bg-green-500/20'
                                                        : 'bg-red-500/5 border-red-500/30 text-red-500 hover:bg-red-500/10'
                                                        }`}
                                                >
                                                    {routine.is_public ? <Eye size={14} /> : <EyeOff size={14} />}
                                                </button>
                                            </div>
                                        ))}
                                        {routines.length === 0 && (
                                            <div className="text-center p-3 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/20">
                                                <p className="text-[10px] text-neutral-600 font-bold">No tienes rutinas.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Static Pinned Footer Bar */}
                <div className="px-6 py-4 border-t border-white/5 bg-neutral-950/80 backdrop-blur-md flex gap-3 shrink-0 z-10">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-neutral-400 hover:text-white hover:bg-neutral-855 transition-all border border-neutral-800 hover:border-neutral-700"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-[1.2] bg-gradient-to-r from-gym-primary to-yellow-400 hover:from-yellow-400 hover:to-gym-primary text-black font-black uppercase tracking-wider py-3 rounded-xl transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-gym-primary/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-xs"
                    >
                        {loading ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
                        <span>{loading ? 'Guardando...' : 'Guardar Cambios'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
