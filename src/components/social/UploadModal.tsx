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
    const [files, setFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [caption, setCaption] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);

            // Validate max 10 files
            if (selectedFiles.length > 10) {
                alert('Máximo 10 archivos por post.');
                return;
            }

            // Validate all files are images or videos
            const validFiles = selectedFiles.filter(f => {
                const isValid = f.type.startsWith('video/') || f.type.startsWith('image/');
                if (!isValid) {
                    alert(`${f.name} no es una imagen o video válido.`);
                }
                return isValid;
            });

            // Size Validation (500MB each)
            const oversized = validFiles.filter(f => f.size > 500 * 1024 * 1024);
            if (oversized.length > 0) {
                alert(`Archivos demasiado grandes: ${oversized.map(f => f.name).join(', ')}. Máximo 500MB cada uno.`);
                return;
            }

            setFiles(validFiles);
            setPreviewUrls(validFiles.map(f => URL.createObjectURL(f)));
            setStep('preview');
        }
    };

    const removeFile = (index: number) => {
        const newFiles = files.filter((_, i) => i !== index);
        const newPreviews = previewUrls.filter((_, i) => i !== index);

        // Revoke old URL to prevent memory leak
        URL.revokeObjectURL(previewUrls[index]);

        setFiles(newFiles);
        setPreviewUrls(newPreviews);

        if (newFiles.length === 0) {
            setStep('select');
        }
    };

    const handleUpload = async () => {
        if (!user || files.length === 0) return;

        setStep('uploading');

        // Use multi-media upload if more than 1 file
        const result = files.length > 1
            ? await socialService.createPostWithMultipleMedia(user.id, files, caption)
            : await socialService.createPost(user.id, files[0], files[0].type.startsWith('video') ? 'video' : 'image', caption);

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
                <div className="flex-1 overflow-hidden relative flex flex-col">
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
                                multiple
                                onChange={handleFileSelect}
                            />
                        </div>
                    )}

                    {step === 'preview' && previewUrls.length > 0 && (
                        <div className="flex flex-col md:flex-row h-full animate-in fade-in overflow-hidden">
                            {/* Media Preview Grid (Top on Mobile, Left on Desktop) */}
                            <div className="bg-black flex items-center justify-center relative border-b md:border-b-0 md:border-r border-neutral-800 overflow-auto shrink-0 h-[40vh] md:h-auto md:flex-1 p-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-2xl">
                                    {files.map((file, index) => (
                                        <div key={index} className="relative aspect-square bg-neutral-900 rounded-lg overflow-hidden group">
                                            {file.type.startsWith('video') ? (
                                                <video src={previewUrls[index]} className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={previewUrls[index]} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                                            )}
                                            {/* Remove Button */}
                                            <button
                                                onClick={() => removeFile(index)}
                                                className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white p-1 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <X size={16} />
                                            </button>
                                            {/* Type Badge */}
                                            <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-bold text-white uppercase">
                                                {file.type.startsWith('video') ? <Film size={10} /> : <ImageIcon size={10} />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* File Count Badge */}
                                {files.length > 1 && (
                                    <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white border border-white/10">
                                        {files.length} archivos
                                    </div>
                                )}
                            </div>

                            {/* Details (Bottom on Mobile, Right on Desktop) */}
                            <div className="w-full md:w-[350px] flex flex-col bg-neutral-900 shrink-0 md:h-full overflow-y-auto">
                                <div className="p-4 sm:p-6 flex flex-col h-full">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden border border-white/10 shrink-0">
                                            <img src={user?.user_metadata?.avatar_url || 'https://i.pravatar.cc/150'} className="w-full h-full object-cover" />
                                        </div>
                                        <span className="text-white font-bold text-sm truncate">{user?.user_metadata?.full_name || 'Usuario'}</span>
                                    </div>

                                    <textarea
                                        value={caption}
                                        onChange={(e) => setCaption(e.target.value)}
                                        placeholder="Escribe un pie de foto..."
                                        className="w-full bg-transparent text-white text-base md:text-sm resize-none focus:outline-none placeholder:text-neutral-500 min-h-[100px] mb-4 flex-1 md:flex-none"
                                    />

                                    <div>
                                        <button
                                            onClick={handleUpload}
                                            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-all text-sm shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Upload size={18} />
                                            Compartir Post
                                        </button>
                                    </div>
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
