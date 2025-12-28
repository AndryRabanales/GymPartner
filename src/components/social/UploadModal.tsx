import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Film, Check } from 'lucide-react';
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
    const [uploadProgress, setUploadProgress] = useState(0);
    const [compressionProgress, setCompressionProgress] = useState(0);
    const [isCompressing, setIsCompressing] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);
    const [videoMetadata, setVideoMetadata] = useState<{
        size: string;
        resolution: string;
        duration: string;
        format: string;
        needsCompression: boolean;
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Official Reels Specifications
    // NOTE: Supabase Storage free tier has 50MB limit per file
    // We compress videos automatically if they exceed this limit
    const REELS_SPECS = {
        ASPECT_RATIO: 9 / 16,
        MIN_RESOLUTION: { width: 540, height: 960 }, // More lenient (was 720x1280)
        RECOMMENDED_RESOLUTION: { width: 1080, height: 1920 },
        MIN_DURATION: 3, // seconds
        MAX_DURATION: 90, // seconds (Instagram/TikTok standard)
        MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB (for compression trigger)
        ALLOWED_FORMATS: ['video/mp4', 'video/quicktime'], // MP4 and MOV
        MAX_CAPTION_LENGTH: 2200
    };

    const validateVideoFile = async (file: File): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> => {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Format validation (STRICT)
        if (!REELS_SPECS.ALLOWED_FORMATS.includes(file.type)) {
            errors.push(`Formato no válido. Solo se aceptan MP4 y MOV.`);
            return { valid: false, errors, warnings };
        }

        // Size warning (NOT blocking, will compress automatically)
        if (file.size > REELS_SPECS.MAX_FILE_SIZE) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            warnings.push(`Video grande (${sizeMB}MB). Se comprimirá automáticamente.`);
        }

        // Video metadata validation
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';

            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);

                // Duration validation (STRICT - Instagram/TikTok requirement)
                if (video.duration < REELS_SPECS.MIN_DURATION) {
                    errors.push(`Video muy corto (${video.duration.toFixed(1)}s). Mínimo: 3 segundos.`);
                }
                if (video.duration > REELS_SPECS.MAX_DURATION) {
                    errors.push(`Video muy largo (${Math.floor(video.duration)}s). Máximo: 90 segundos.`);
                }

                // Resolution validation (LENIENT - just a warning)
                if (video.videoWidth < REELS_SPECS.MIN_RESOLUTION.width ||
                    video.videoHeight < REELS_SPECS.MIN_RESOLUTION.height) {
                    warnings.push(`Resolución baja (${video.videoWidth}x${video.videoHeight}). Recomendado: 1080x1920.`);
                }

                // Aspect ratio validation (FLEXIBLE - 15% tolerance)
                const aspectRatio = video.videoWidth / video.videoHeight;
                const targetRatio = REELS_SPECS.ASPECT_RATIO;
                const tolerance = 0.15; // Increased from 5% to 15%
                if (Math.abs(aspectRatio - targetRatio) > tolerance) {
                    warnings.push(`Aspecto no ideal (${aspectRatio.toFixed(2)}). Recomendado: 9:16 (vertical).`);
                }

                resolve({ valid: errors.length === 0, errors, warnings });
            };

            video.onerror = () => {
                errors.push('Error al leer el video. Intenta con otro archivo.');
                resolve({ valid: false, errors, warnings });
            };

            video.src = URL.createObjectURL(file);
        });
    };

    /**
     * Compress video if it exceeds 50MB
     * Uses MediaRecorder API to re-encode at lower bitrate while maintaining quality
     */
    const compressVideo = async (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            setIsCompressing(true);
            setCompressionProgress(0);

            const video = document.createElement('video');
            video.preload = 'metadata';

            video.onloadedmetadata = async () => {
                try {
                    // Detect original frame rate (default to 30 if not detectable)
                    const originalFPS = 30; // Most phones record at 30fps

                    // Create canvas for video processing
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d')!;

                    // Maintain aspect ratio, max 1080p
                    const maxWidth = 1080;
                    const maxHeight = 1920;
                    let width = video.videoWidth;
                    let height = video.videoHeight;

                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // Calculate target bitrate to fit in ~45MB (leaving margin)
                    const duration = video.duration;
                    const targetSizeMB = 45;
                    const targetBitrate = (targetSizeMB * 8 * 1024 * 1024) / duration; // bits per second

                    // Use higher quality bitrate (min 1.5 Mbps for smooth playback)
                    const finalBitrate = Math.max(Math.min(targetBitrate, 4000000), 1500000); // Between 1.5-4 Mbps

                    // Try to use H.264 codec first (better compatibility), fallback to VP9
                    let mimeType = 'video/webm;codecs=h264';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = 'video/webm;codecs=vp8'; // VP8 is more compatible than VP9
                        if (!MediaRecorder.isTypeSupported(mimeType)) {
                            mimeType = 'video/webm'; // Ultimate fallback
                        }
                    }

                    console.log(`🎬 Compressing with: ${mimeType}, ${finalBitrate} bps, ${originalFPS} fps`);

                    const stream = canvas.captureStream(originalFPS); // Use detected FPS
                    const mediaRecorder = new MediaRecorder(stream, {
                        mimeType: mimeType,
                        videoBitsPerSecond: finalBitrate
                    });

                    const chunks: Blob[] = [];
                    mediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) {
                            chunks.push(e.data);
                        }
                    };

                    mediaRecorder.onstop = () => {
                        const compressedBlob = new Blob(chunks, { type: mimeType.split(';')[0] });
                        const compressedFile = new File(
                            [compressedBlob],
                            file.name.replace(/\.[^/.]+$/, '.webm'),
                            { type: mimeType.split(';')[0] }
                        );

                        console.log(`✅ Compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

                        setIsCompressing(false);
                        setCompressionProgress(100);
                        resolve(compressedFile);
                    };

                    mediaRecorder.onerror = (error) => {
                        console.error('MediaRecorder error:', error);
                        setIsCompressing(false);
                        reject(error);
                    };

                    // Start recording
                    mediaRecorder.start(100); // Collect data every 100ms

                    // Set playback rate to normal (important!)
                    video.playbackRate = 1.0;
                    video.currentTime = 0;

                    await video.play();

                    // Draw frames to canvas at consistent rate
                    let lastFrameTime = 0;
                    const frameInterval = 1000 / originalFPS; // ms per frame

                    const drawFrame = (currentTime: number) => {
                        if (!video.paused && !video.ended) {
                            // Only draw if enough time has passed (maintain frame rate)
                            if (currentTime - lastFrameTime >= frameInterval) {
                                ctx.drawImage(video, 0, 0, width, height);
                                lastFrameTime = currentTime;
                            }

                            const progress = (video.currentTime / video.duration) * 100;
                            setCompressionProgress(Math.round(progress));
                            requestAnimationFrame(drawFrame);
                        }
                    };

                    video.onplay = () => {
                        requestAnimationFrame(drawFrame);
                    };

                    video.onended = () => {
                        setTimeout(() => {
                            mediaRecorder.stop();
                        }, 100); // Small delay to ensure last frames are captured
                    };
                } catch (error) {
                    console.error('Compression setup error:', error);
                    setIsCompressing(false);
                    reject(error);
                }
            };

            video.onerror = () => {
                setIsCompressing(false);
                reject(new Error('Error loading video for compression'));
            };

            video.src = URL.createObjectURL(file);
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            console.log("📁 Files selected:", selectedFiles.length);
            setValidationErrors([]);
            setLoadProgress(0);
            setVideoMetadata(null);

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

            // Simulate file load progress
            const loadInterval = setInterval(() => {
                setLoadProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(loadInterval);
                        return 100;
                    }
                    return prev + 20;
                });
            }, 100);

            // Extract metadata for first video (if any)
            if (videos.length > 0) {
                const video = videos[0];
                const videoElement = document.createElement('video');
                videoElement.preload = 'metadata';

                videoElement.onloadedmetadata = () => {
                    const sizeMB = (video.size / (1024 * 1024)).toFixed(2);
                    const resolution = `${videoElement.videoWidth}x${videoElement.videoHeight}`;
                    const duration = `${Math.floor(videoElement.duration)}s`;
                    const format = video.type.split('/')[1].toUpperCase();
                    const needsCompression = video.size > REELS_SPECS.MAX_FILE_SIZE;

                    setVideoMetadata({
                        size: `${sizeMB} MB`,
                        resolution,
                        duration,
                        format,
                        needsCompression
                    });

                    URL.revokeObjectURL(videoElement.src);
                };

                videoElement.src = URL.createObjectURL(video);
            }

            // Validate videos against Reels specs
            const allErrors: string[] = [];
            const allWarnings: string[] = [];
            const validatedVideos: File[] = [];

            for (const video of videos) {
                const { valid, errors, warnings } = await validateVideoFile(video);

                // Collect warnings
                if (warnings.length > 0) {
                    allWarnings.push(...warnings);
                }

                if (valid) {
                    // Don't compress here - just add to validated list
                    // Compression will happen during upload if needed
                    validatedVideos.push(video);
                } else {
                    // Only add to errors if validation failed (duration/format issues)
                    allErrors.push(`${video.name}: ${errors.join(', ')}`);
                }
            }

            // Show validation errors if any
            if (allErrors.length > 0) {
                setValidationErrors(allErrors);
            }

            // Show warnings as info (not blocking)
            if (allWarnings.length > 0 && allErrors.length === 0) {
                setValidationErrors(allWarnings.map(w => `ℹ️ ${w}`));
            }

            const validFiles = [...images, ...validatedVideos];
            console.log("✅ Valid files:", validFiles.length, "Images:", images.length, "Videos:", validatedVideos.length);

            if (validFiles.length === 0) {
                alert('No hay archivos válidos para subir.');
                return;
            }

            setFiles(validFiles);
            setPreviewUrls(validFiles.map(f => URL.createObjectURL(f)));
            console.log("🎬 Advancing to preview step");
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
        setUploadProgress(0);

        try {
            // Compress large videos before uploading
            const processedFiles: File[] = [];

            for (const file of files) {
                if (file.type.startsWith('video') && file.size > REELS_SPECS.MAX_FILE_SIZE) {
                    console.log(`🗜️ Compressing large video: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
                    const compressed = await compressVideo(file);
                    processedFiles.push(compressed);
                } else {
                    processedFiles.push(file);
                }
            }

            // Simulate progress (since Supabase doesn't provide real progress)
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) return prev; // Stop at 90% until actual upload completes
                    return prev + 10;
                });
            }, 300);

            // Use multi-media upload if more than 1 file
            const result = processedFiles.length > 1
                ? await socialService.createPostWithMultipleMedia(user.id, processedFiles, caption)
                : await socialService.createPost(user.id, processedFiles[0], processedFiles[0].type.startsWith('video') ? 'video' : 'image', caption);

            clearInterval(progressInterval);
            setUploadProgress(100);

            if (result.success) {
                setStep('success');
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 2000);
            } else {
                alert('Error al subir: ' + result.error);
                console.log("🎬 Advancing to preview step");
                setStep('preview');
                setUploadProgress(0);
            }
        } catch (error: any) {
            alert('Error al procesar el video: ' + error.message);
            console.error('Upload error:', error);
            setStep('preview');
            setUploadProgress(0);
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
                                Videos: 9:16 (vertical), 1080x1920px, 3-90s, MP4/MOV<br />
                                <span className="text-yellow-500">Videos grandes se comprimen automáticamente</span>
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
                                                <img src={previewUrls[index]} alt={`Preview ${index + 1} `} className="w-full h-full object-cover" />
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
                                {/* Video Metadata Card */}
                                {videoMetadata && (
                                    <div className="absolute bottom-4 left-4 right-4 bg-neutral-900/95 backdrop-blur-md border border-neutral-700 rounded-lg p-3 shadow-2xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Film size={16} className="text-yellow-500" />
                                            <h4 className="text-white font-bold text-xs">Info del Video</h4>
                                        </div>

                                        {/* Load Progress */}
                                        {loadProgress < 100 && (
                                            <div className="mb-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] text-neutral-400">Cargando...</span>
                                                    <span className="text-[10px] text-yellow-500 font-mono">{loadProgress}%</span>
                                                </div>
                                                <div className="w-full bg-neutral-700 rounded-full h-1 overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-300"
                                                        style={{ width: `${loadProgress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-4 gap-2">
                                            <div className="bg-neutral-800/50 rounded p-1.5">
                                                <p className="text-[9px] text-neutral-500 mb-0.5">Tamaño</p>
                                                <p className="text-[11px] text-white font-mono font-bold">{videoMetadata.size}</p>
                                            </div>
                                            <div className="bg-neutral-800/50 rounded p-1.5">
                                                <p className="text-[9px] text-neutral-500 mb-0.5">Resolución</p>
                                                <p className="text-[11px] text-white font-mono font-bold">{videoMetadata.resolution}</p>
                                            </div>
                                            <div className="bg-neutral-800/50 rounded p-1.5">
                                                <p className="text-[9px] text-neutral-500 mb-0.5">Duración</p>
                                                <p className="text-[11px] text-white font-mono font-bold">{videoMetadata.duration}</p>
                                            </div>
                                            <div className="bg-neutral-800/50 rounded p-1.5">
                                                <p className="text-[9px] text-neutral-500 mb-0.5">Formato</p>
                                                <p className="text-[11px] text-white font-mono font-bold">{videoMetadata.format}</p>
                                            </div>
                                        </div>

                                        {videoMetadata.needsCompression && (
                                            <div className="mt-2 flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded p-1.5">
                                                <span className="text-yellow-500 text-sm">⚠️</span>
                                                <p className="text-[10px] text-yellow-500 font-bold">Se comprimirá automáticamente a ~45MB</p>
                                            </div>
                                        )}
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
                                            <span className={`text - xs font - mono ${caption.length > REELS_SPECS.MAX_CAPTION_LENGTH * 0.9
                                                ? 'text-yellow-500'
                                                : 'text-neutral-500'
                                                } `}>
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
                            {isCompressing ? (
                                <>
                                    <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mb-6 relative">
                                        <div className="absolute inset-0 rounded-full border-4 border-yellow-500/30"></div>
                                        <div
                                            className="absolute inset-0 rounded-full border-4 border-yellow-500 border-t-transparent animate-spin"
                                            style={{ borderTopColor: 'transparent' }}
                                        ></div>
                                        <span className="text-yellow-500 font-black text-lg z-10">{compressionProgress}%</span>
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-2">Comprimiendo video...</h3>
                                    <p className="text-neutral-400 text-sm mb-4">Reduciendo tamaño para cumplir con el límite</p>
                                    <div className="w-full max-w-xs bg-neutral-800 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-300"
                                            style={{ width: `${compressionProgress}% ` }}
                                        ></div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center mb-6 relative">
                                        <div className="absolute inset-0 rounded-full border-4 border-blue-500/30"></div>
                                        <div
                                            className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"
                                            style={{ borderTopColor: 'transparent' }}
                                        ></div>
                                        <span className="text-blue-500 font-black text-lg z-10">{uploadProgress}%</span>
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-2">Subiendo...</h3>
                                    <p className="text-neutral-400 text-sm mb-4">Compartiendo tu contenido</p>
                                    <div className="w-full max-w-xs bg-neutral-800 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                                            style={{ width: `${uploadProgress}% ` }}
                                        ></div>
                                    </div>
                                </>
                            )}
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
