import React, { useState, useRef } from 'react';
import { X, Camera, Save, Loader } from 'lucide-react';
import { userService } from '../../services/UserService';
import type { User } from '@supabase/supabase-js';

interface EditProfileModalProps {
    user: User;
    currentUsername: string;
    currentAvatarUrl: string;
    currentBannerUrl?: string; // New Prop
    onClose: () => void;
    onUpdate: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
    user,
    currentUsername,
    currentAvatarUrl,
    currentBannerUrl,
    onClose,
    onUpdate
}) => {
    const [username, setUsername] = useState(currentUsername);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState(currentAvatarUrl);

    // Banner State
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [bannerPreview, setBannerPreview] = useState(currentBannerUrl);

    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null); // Ref for banner

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
            const updateResult = await userService.updateProfile(user.id, {
                username: username,
                avatar_url: newAvatarUrl,
                custom_settings: {
                    banner_url: newBannerUrl // Save banner in JSONB
                }
            });

            if (updateResult.success) {
                onUpdate(); // Reload parent data
                onClose();
            } else {
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
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl p-6 relative shadow-2xl overflow-y-auto max-h-[90vh]">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors z-10 bg-black/50 p-1 rounded-full"
                >
                    <X size={24} />
                </button>

                <h2 className="text-2xl font-black text-white italic uppercase mb-6 tracking-tighter">
                    Editar Perfil
                </h2>

                <div className="space-y-6">
                    {/* Banner Upload Section */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">
                            Foto de Portada
                        </label>
                        <div
                            onClick={() => bannerInputRef.current?.click()}
                            className="w-full h-32 rounded-xl border-2 border-dashed border-neutral-800 hover:border-yellow-500 transition-colors cursor-pointer relative overflow-hidden group"
                        >
                            {bannerPreview ? (
                                <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-opacity" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
                                    <span className="text-neutral-700 text-xs font-bold">SIN PORTADA</span>
                                </div>
                            )}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <Camera className="text-white/50 group-hover:text-white transition-colors" />
                                <span className="text-[10px] text-white/50 font-bold uppercase mt-1">Cambiar Fondo</span>
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
                    <div className="flex flex-col items-center gap-4">
                        <div
                            className={`relative group cursor-pointer transition-all duration-300`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className={`w-32 h-32 rounded-full overflow-hidden border-4 transition-colors relative border-neutral-800 group-hover:border-yellow-500`}>
                                <img
                                    src={previewUrl || 'https://i.pravatar.cc/300'}
                                    alt="Preview"
                                    className={`w-full h-full object-cover transition-opacity`}
                                />
                                {/* Overlay */}
                                <div className={`absolute inset-0 bg-black/50 flex flex-col items-center justify-center transition-opacity opacity-0 group-hover:opacity-100`}>
                                    <Camera className="text-white mb-1" size={32} />
                                    <span className="text-white/80 text-[10px] font-bold uppercase tracking-widest">
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
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">
                            Nombre de Agente
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white font-bold tracking-tight focus:outline-none focus:border-yellow-500/50 transition-colors placeholder:text-neutral-700"
                            placeholder="Tu nombre público..."
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl font-bold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-wider py-3 rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader className="animate-spin" size={20} /> : <Save size={20} />}
                            <span>Guardar</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
