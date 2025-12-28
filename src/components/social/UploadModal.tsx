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

            // Size Validation (500MB for High Quality)
            if (selectedFile.size > 500 * 1024 * 1024) {
                alert('¡El archivo es demasiado grande! Máximo 500MB.');
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
            <div className="bg-neutral-900 border border-neutral-800 w-full max-w-4xl rounded-xl overflow-hidden relative shadow-2xl flex flex-col md:flex-row max-h-[90vh]">

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
                <div className="flex flex-col h-[500px]">
                    {step === 'select' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in slide-in-from-bottom-5">
                            <div className="w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center mb-6 relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="absolute inset-0 bg-yellow-500/20 rounded-full animate-ping opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Upload size={40} className="text-white relative z-10" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Arrastra fotos o videos aquí</h3>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors"
                            >
                                Seleccionar del ordenador
                            </button>
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
                        <div className="flex-1 flex flex-col md:flex-row bg-neutral-900 animate-in fade-in">
                            {/* Media Preview (Left/Top) */}
                            <div className="flex-1 bg-black flex items-center justify-center relative border-b md:border-b-0 md:border-r border-neutral-800 overflow-hidden">
                                {mediaType === 'video' ? (
                                    <video src={previewUrl} controls className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                                )}
                                <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black text-white uppercase flex items-center gap-1.5 border border-white/10 z-10">
                                    {mediaType === 'video' ? <Film size={12} /> : <ImageIcon size={12} />}
                                    {mediaType === 'video' ? 'REEL' : 'POST'}
                                </div>
                            </div>

                            {/* Details (Right/Bottom) */}
                            <div className="w-full md:w-[350px] p-6 flex flex-col bg-neutral-900">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden border border-white/10">
                                        <img src={user?.user_metadata?.avatar_url || 'https://i.pravatar.cc/150'} className="w-full h-full object-cover" />
                                    </div>
                                    <span className="text-white font-bold text-sm">{user?.user_metadata?.full_name || 'Usuario'}</span>
                                </div>

                                <textarea
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    placeholder="Escribe un pie de foto..."
                                    className="w-full bg-transparent text-white text-sm resize-none focus:outline-none placeholder:text-neutral-500 min-h-[100px] mb-4"
                                />

                                <div className="mt-auto">
                                    <button
                                        onClick={handleUpload}
                                        className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-all text-sm shadow-lg shadow-blue-500/20 active:scale-95"
                                    >
                                        Compartir
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'uploading' && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                            <Loader size={48} className="text-blue-500 animate-spin mb-6" />
                            <h3 className="text-white font-bold text-lg mb-2">Compartiendo...</h3>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 animate-in zoom-in">
                            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6">
                                <Check size={40} className="text-white" />
                            </div>
                            <h3 className="text-white font-bold text-lg mb-2">¡Se ha compartido tu post!</h3>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
