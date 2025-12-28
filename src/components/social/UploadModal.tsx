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
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Official Reels Specifications
    const REELS_SPECS = {
        ASPECT_RATIO: 9 / 16,
        MIN_RESOLUTION: { width: 720, height: 1280 },
        RECOMMENDED_RESOLUTION: { width: 1080, height: 1920 },
        MIN_DURATION: 3, // seconds
        MAX_DURATION: 90, // seconds
        MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
        ALLOWED_FORMATS: ['video/mp4', 'video/quicktime'], // MP4 and MOV
        MAX_CAPTION_LENGTH: 2200
    };

    const validateVideoFile = async (file: File): Promise<{ valid: boolean; errors: string[] }> => {
        const errors: string[] = [];

        // Format validation
        if (!REELS_SPECS.ALLOWED_FORMATS.includes(file.type)) {
            errors.push(`Formato no válido. Solo se aceptan MP4 y MOV.`);
            return { valid: false, errors };
        }

        // Size validation
        if (file.size > REELS_SPECS.MAX_FILE_SIZE) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            errors.push(`Archivo muy pesado (${sizeMB}MB). Máximo: 500MB.`);
        }

        // Video metadata validation
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';

            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);

                // Duration validation
                if (video.duration < REELS_SPECS.MIN_DURATION) {
                    errors.push(`Video muy corto (${video.duration.toFixed(1)}s). Mínimo: 3 segundos.`);
                }
                if (video.duration > REELS_SPECS.MAX_DURATION) {
                    errors.push(`Video muy largo (${Math.floor(video.duration)}s). Máximo: 90 segundos.`);
                }

                // Resolution validation
                if (video.videoWidth < REELS_SPECS.MIN_RESOLUTION.width ||
                    video.videoHeight < REELS_SPECS.MIN_RESOLUTION.height) {
                    errors.push(`Resolución muy baja (${video.videoWidth}x${video.videoHeight}). Mínimo: 720x1280.`);
                }

                // Aspect ratio validation (9:16 with 5% tolerance)
                const aspectRatio = video.videoWidth / video.videoHeight;
                const targetRatio = REELS_SPECS.ASPECT_RATIO;
                const tolerance = 0.05;
                if (Math.abs(aspectRatio - targetRatio) > tolerance) {
                    errors.push(`Aspecto incorrecto (${aspectRatio.toFixed(2)}). Requerido: 9:16 (vertical).`);
                }

                resolve({ valid: errors.length === 0, errors });
            };

            video.onerror = () => {
                errors.push('Error al leer el video. Intenta con otro archivo.');
                resolve({ valid: false, errors });
            };

            video.src = URL.createObjectURL(file);
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            setValidationErrors([]);

            // Validate max 10 files
            if (selectedFiles.length > 10) {
                alert('Máximo 10 archivos por post.');
                return;
            }

            // Separate images and videos
            const images = selectedFiles.filter(f => f.type.startsWith('image/'));
            const videos = selectedFiles.filter(f => f.type.startsWith('video/'));
            const invalid = selectedFiles.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/'));

            if (invalid.length > 0) {
                alert(`Archivos no válidos: ${invalid.map(f => f.name).join(', ')}`);
                return;
            }

            // Validate videos against Reels specs
            const allErrors: string[] = [];
            const validatedVideos: File[] = [];

            for (const video of videos) {
                const { valid, errors } = await validateVideoFile(video);
                if (valid) {
                    validatedVideos.push(video);
                } else {
                    allErrors.push(`${video.name}: ${errors.join(', ')}`);
                }
            }

            // Show validation errors if any
            if (allErrors.length > 0) {
                setValidationErrors(allErrors);
                // Still allow proceeding with valid files
            }

            const validFiles = [...images, ...validatedVideos];

            if (validFiles.length === 0) {
                alert('No hay archivos válidos para subir.');
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
                            <p className="text-neutral-500 text-xs mb-4 text-center max-w-sm">
                                Videos: 9:16 (vertical), 1080x1920px, 3-90s, MP4/MOV, máx 500MB
                            </p>
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
                                accept="image/*,video/mp4,video/quicktime"
                                multiple
                                onChange={handleFileSelect}
                            />

                            {/* Validation Errors */}
                            {validationErrors.length > 0 && (
                                <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 max-w-md">
                                    <p className="text-red-400 font-bold text-sm mb-2">⚠️ Errores de validación:</p>
                                    <ul className="text-red-300 text-xs space-y-1">
                                        {validationErrors.map((error, i) => (
                                            <li key={i}>• {error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
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

                                    <div className="flex-1 md:flex-none">
                                        <textarea
                                            value={caption}
                                            onChange={(e) => {
                                                const newValue = e.target.value;
                                                if (newValue.length <= REELS_SPECS.MAX_CAPTION_LENGTH) {
                                                    setCaption(newValue);
                                                }
                                            }}
                                            placeholder="Escribe un pie de foto..."
                                            className="w-full bg-transparent text-white text-base md:text-sm resize-none focus:outline-none placeholder:text-neutral-500 min-h-[100px] mb-2"
                                            maxLength={REELS_SPECS.MAX_CAPTION_LENGTH}
                                        />
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-xs text-neutral-500">Máx. {REELS_SPECS.MAX_CAPTION_LENGTH} caracteres</span>
                                            <span className={`text-xs font-mono ${caption.length > REELS_SPECS.MAX_CAPTION_LENGTH * 0.9
                                                    ? 'text-yellow-500'
                                                    : 'text-neutral-500'
                                                }`}>
                                                {caption.length}/{REELS_SPECS.MAX_CAPTION_LENGTH}
                                            </span>
                                        </div>
                                    </div>

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
