import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Save, Loader, Swords, Trophy, Eye, EyeOff } from 'lucide-react';
import { userService } from '../../services/UserService';
import type { User } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';

interface EditProfileModalProps {
    user: User;
    currentUsername: string;
    currentAvatarUrl: string;
    currentBannerUrl?: string;
    currentFeaturedRoutineId?: string;
    onClose: () => void;
    onUpdate: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
    user,
    currentUsername,
    currentAvatarUrl,
    currentBannerUrl,
    currentFeaturedRoutineId,
    onClose,
    onUpdate
}) => {
    const [username, setUsername] = useState(currentUsername);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState(currentAvatarUrl);

    // Banner State
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [bannerPreview, setBannerPreview] = useState(currentBannerUrl);

    // Battle Deck State
    const [routines, setRoutines] = useState<any[]>([]);
    const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(currentFeaturedRoutineId || null);

    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    // Fetch Routines on Mount
    useEffect(() => {
        const fetchRoutines = async () => {
            const data = await userService.getUserRoutines(user.id);
            setRoutines(data);
        };
        fetchRoutines();
    }, [user.id]);

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

            // 3. Update Profile Data
            console.log("Saving Profile with Routine ID:", selectedRoutineId); // DEBUG
            const updateResult = await userService.updateProfile(user.id, {
                username: username,
                avatar_url: newAvatarUrl,
                custom_settings: {
                    banner_url: newBannerUrl
                },
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
            <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800/50 w-full max-w-lg rounded-3xl p-8 relative shadow-2xl shadow-black/50 overflow-y-auto max-h-[90vh] custom-scrollbar">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-neutral-400 hover:text-white hover:bg-white/10 transition-all z-10 p-2 rounded-full backdrop-blur-sm"
                >
                    <X size={20} />
                </button>

                <div className="mb-8">
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-400 italic uppercase tracking-tighter">
                        Editar Perfil
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1">Personaliza tu identidad en GymPartner</p>
                </div>

                <div className="space-y-8">
                    {/* Banner Upload Section */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Camera size={12} className="text-gym-primary" />
                            Foto de Portada
                        </label>
                        <div
                            onClick={() => bannerInputRef.current?.click()}
                            className="w-full h-40 rounded-2xl border-2 border-dashed border-neutral-700 hover:border-gym-primary/50 transition-all cursor-pointer relative overflow-hidden group bg-neutral-950"
                        >
                            {bannerPreview ? (
                                <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-300" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-neutral-700 text-sm font-bold uppercase tracking-widest">Sin Portada</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="bg-gym-primary/20 p-3 rounded-full backdrop-blur-sm border border-gym-primary/30">
                                    <Camera className="text-gym-primary" size={24} />
                                </div>
                                <span className="text-xs text-white font-bold uppercase mt-3 tracking-widest">Cambiar Fondo</span>
                            </div>
                        </div>
                        <input
                            type="file"
                            ref={bannerInputRef}
                            onChange={handleBannerChange}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>

                    {/* Avatar Upload Section */}
                    <div className="flex flex-col items-center gap-4 -mt-2">
                        <div
                            className="relative group cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="absolute -inset-1 bg-gradient-to-r from-gym-primary to-yellow-400 rounded-full blur opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                            <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-neutral-800 group-hover:border-gym-primary/50 transition-all duration-300">
                                <img
                                    src={previewUrl || 'https://i.pravatar.cc/300'}
                                    alt="Preview"
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                />
                                {/* Overlay */}
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <Camera className="text-white" size={28} />
                                    <span className="text-white text-xs font-bold uppercase tracking-wider">
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

                    {/* Username Input */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
                            Nombre de Agente
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-neutral-950/50 border-2 border-neutral-800 rounded-xl px-5 py-4 text-white font-bold tracking-tight focus:outline-none focus:border-gym-primary/70 focus:bg-neutral-950 transition-all placeholder:text-neutral-700 hover:border-neutral-700"
                            placeholder="Tu nombre público..."
                        />
                    </div>

                    {/* BATTLE DECK SELECTOR (With Privacy Toggle) */}
                    <div className="space-y-4 pt-6 border-t border-neutral-800/50">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-black text-gym-primary uppercase tracking-wide flex items-center gap-2">
                                <Swords size={16} className="animate-pulse" /> Arsenal Público
                            </label>
                            <Link to="/builder" onClick={onClose} className="text-xs font-bold text-neutral-500 hover:text-gym-primary uppercase flex items-center gap-1.5 transition-colors bg-neutral-900/50 px-3 py-1.5 rounded-full border border-neutral-800 hover:border-gym-primary/30">
                                <Trophy size={12} /> Crear Nueva
                            </Link>
                        </div>

                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            {routines.map((routine, index) => (
                                <div key={routine.id} className="flex gap-2 animate-in slide-in-from-left duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                                    {/* Selection Button (Featured) */}
                                    <button
                                        onClick={() => setSelectedRoutineId(routine.id === selectedRoutineId ? null : routine.id)}
                                        className={`flex-1 text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group relative overflow-hidden ${selectedRoutineId === routine.id
                                                ? 'bg-gym-primary/10 border-gym-primary text-white shadow-lg shadow-gym-primary/10'
                                                : 'bg-neutral-950/50 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-950'
                                            }`}
                                    >
                                        <div className="flex flex-col gap-1 relative z-10">
                                            <span className="font-black text-sm truncate">{routine.name}</span>
                                            <span className="text-[10px] opacity-60 uppercase tracking-wider font-bold">
                                                {selectedRoutineId === routine.id ? '⭐ DESTACADA' : 'Normal'}
                                            </span>
                                        </div>
                                        {selectedRoutineId === routine.id && (
                                            <div className="relative z-10 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-gym-primary animate-pulse"></div>
                                            </div>
                                        )}
                                        {selectedRoutineId === routine.id && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-gym-primary/5 to-transparent"></div>
                                        )}
                                    </button>

                                    {/* Visibility Toggle */}
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            const newStatus = !routine.is_public;

                                            // 🛡️ LIMIT CHECK: Max 5 Public Routines
                                            if (newStatus) {
                                                const publicCount = routines.filter(r => r.is_public).length;
                                                if (publicCount >= 5) {
                                                    alert("⚠️ Límite Alcanzado: Solo puedes tener 5 rutinas públicas visibles en el Ranking. Oculta otra para activar esta.");
                                                    return;
                                                }
                                            }

                                            // Optimistic Update
                                            setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, is_public: newStatus } : r));

                                            await userService.updateRoutineVisibility(routine.id, newStatus);
                                        }}
                                        className={`w-14 flex items-center justify-center rounded-xl border-2 transition-all hover:scale-105 active:scale-95 ${routine.is_public
                                                ? 'bg-green-500/10 border-green-500 text-green-500 hover:bg-green-500/20'
                                                : 'bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20'
                                            }`}
                                        title={routine.is_public ? "Pública (Visible en Ranking)" : "Privada (Solo tú)"}
                                    >
                                        {routine.is_public ? <Eye size={20} /> : <EyeOff size={20} />}
                                    </button>
                                </div>
                            ))}
                            {routines.length === 0 && (
                                <div className="text-center p-6 border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-950/30">
                                    <Swords size={32} className="mx-auto mb-2 text-neutral-700" />
                                    <p className="text-sm text-neutral-600 font-bold">No tienes rutinas creadas.</p>
                                    <p className="text-xs text-neutral-700 mt-1">Crea tu primera estrategia</p>
                                </div>
                            )}
                        </div>
                        <div className="bg-neutral-950/50 border border-neutral-800/50 rounded-xl p-3">
                            <p className="text-[10px] text-neutral-500 leading-relaxed">
                                <span className="text-green-500 font-black">💡 TIP:</span> Solo las rutinas "Públicas" se verán en tu perfil cuando otros te inspeccionen.
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 rounded-xl font-bold text-neutral-400 hover:text-white hover:bg-neutral-800/50 transition-all border-2 border-neutral-800 hover:border-neutral-700"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-gym-primary to-yellow-400 hover:from-yellow-400 hover:to-gym-primary text-black font-black uppercase tracking-wider py-4 rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-gym-primary/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            {loading ? <Loader className="animate-spin" size={20} /> : <Save size={20} />}
                            <span>{loading ? 'Guardando...' : 'Guardar'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
