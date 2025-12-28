import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Film, Loader, Check } from 'lucide-react';
import { socialService } from '../../services/SocialService';
import { useAuth } from '../../context/AuthContext';

interface UploadModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ onClose, onSuccess }) => {
    const { user } = useAuth();
    const [step, setStep] = useState<'select' | 'preview' | 'uploading' | 'success'>('select');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
    const [caption, setCaption] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const isVideo = selectedFile.type.startsWith('video/');
            const isImage = selectedFile.type.startsWith('image/');

            if (!isVideo && !isImage) {
                alert('Solo se permiten imágenes o videos.');
                return;
            }

            // Size Validation (50MB)
            if (selectedFile.size > 50 * 1024 * 1024) {
                alert('¡El archivo es demasiado grande! Máximo 50MB.');
                return;
            }

            setFile(selectedFile);
            setMediaType(isVideo ? 'video' : 'image');
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setStep('preview');
        }
    };

    const handleUpload = async () => {
        if (!user || !file) return;

        setStep('uploading');
        const result = await socialService.createPost(user.id, file, mediaType, caption);

        if (result.success) {
            setStep('success');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);
        } else {
            alert('Error al subir: ' + result.error);
            setStep('preview');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl overflow-hidden relative shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <h2 className="text-lg font-black text-white italic uppercase">
                        {step === 'select' ? 'Crear Post' : step === 'success' ? '¡Éxito!' : 'Nuevo Post'}
                    </h2>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {step === 'select' && (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-neutral-700 hover:border-yellow-500 rounded-2xl h-64 flex flex-col items-center justify-center cursor-pointer transition-colors group"
                        >
                            <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4 group-hover:bg-yellow-500/10 group-hover:text-yellow-500 transition-colors text-neutral-500">
                                <Upload size={32} />
                            </div>
                            <p className="text-neutral-400 font-bold uppercase tracking-wide">Sube Foto o Video</p>
                            <span className="text-xs text-neutral-600 mt-2">JPG, PNG, MP4 (Max 50MB)</span>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*,video/*"
                                onChange={handleFileSelect}
                            />
                        </div>
                    )}

                    {step === 'preview' && previewUrl && (
                        <div className="space-y-4">
                            <div className="rounded-xl overflow-hidden bg-black aspect-[3/4] relative">
                                {mediaType === 'video' ? (
                                    <video src={previewUrl} controls className="w-full h-full object-contain" />
                                ) : (
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                                )}
                                <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded text-xs font-bold text-white uppercase flex items-center gap-1">
                                    {mediaType === 'video' ? <Film size={12} /> : <ImageIcon size={12} />}
                                    {mediaType === 'video' ? 'REEL' : 'POST'}
                                </div>
                            </div>

                            <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="Escribe un pie de foto épico..."
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-yellow-500 placeholder:text-neutral-700 resize-none h-24"
                            />

                            <button
                                onClick={handleUpload}
                                className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-yellow-500/20 active:scale-95"
                            >
                                Publicar
                            </button>
                        </div>
                    )}

                    {step === 'uploading' && (
                        <div className="h-64 flex flex-col items-center justify-center text-center">
                            <Loader size={48} className="text-yellow-500 animate-spin mb-4" />
                            <h3 className="text-white font-bold text-lg">Subiendo a GymTok...</h3>
                            <p className="text-neutral-500 text-sm">No cierres esta ventana.</p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="h-64 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 animate-in zoom-in">
                                <Check size={40} className="text-black" />
                            </div>
                            <h3 className="text-white font-bold text-lg">¡Publicado!</h3>
                            <p className="text-neutral-500 text-sm">Tu post está ahora en el feed.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
