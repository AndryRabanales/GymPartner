/**
 * Browser-native video compression using MediaRecorder API
 * Works in production builds without external dependencies
 */

/**
 * Compress video to target size using browser's MediaRecorder
 * @param file Original video file
 * @param targetSizeMB Target size in MB (default 45MB)
 * @param onProgress Progress callback (0-100)
 */
export async function compressVideoToSize(
    file: File,
    targetSizeMB: number = 45,
    onProgress?: (progress: number) => void
): Promise<File> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = async () => {
            try {
                // Create canvas for re-encoding
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;

                // Calculate optimal resolution (max 1080p for compression)
                let width = video.videoWidth;
                let height = video.videoHeight;
                const maxDimension = 1080;

                if (width > height) {
                    if (width > maxDimension) {
                        height = (height * maxDimension) / width;
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = (width * maxDimension) / height;
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // Calculate target bitrate
                const duration = video.duration;
                const targetBits = targetSizeMB * 8 * 1024 * 1024;
                const videoBitrate = Math.floor((targetBits * 0.85) / duration); // 85% for video
                const audioBitrate = 128000; // 128 kbps for audio

                // Use best available codec
                const mimeTypes = [
                    'video/webm;codecs=vp9,opus',
                    'video/webm;codecs=vp8,opus',
                    'video/webm;codecs=h264,opus',
                    'video/webm'
                ];

                let selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

                console.log(`🎬 Compressing with: ${selectedMimeType}, ${videoBitrate} bps`);

                const stream = canvas.captureStream(30); // 30 FPS

                // Try to add audio if available
                try {
                    const audioContext = new AudioContext();
                    const source = audioContext.createMediaElementSource(video);
                    const destination = audioContext.createMediaStreamDestination();
                    source.connect(destination);

                    // Combine video and audio
                    destination.stream.getAudioTracks().forEach(track => {
                        stream.addTrack(track);
                    });
                } catch (audioError) {
                    console.warn('Could not add audio track:', audioError);
                }

                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: selectedMimeType,
                    videoBitsPerSecond: Math.max(videoBitrate, 1000000), // Min 1 Mbps
                    audioBitsPerSecond: audioBitrate
                });

                const chunks: Blob[] = [];

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    const compressedBlob = new Blob(chunks, { type: selectedMimeType });
                    const compressedFile = new File(
                        [compressedBlob],
                        file.name.replace(/\.[^/.]+$/, '_compressed.webm'),
                        { type: selectedMimeType }
                    );

                    console.log(`✅ Compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
                    resolve(compressedFile);
                };

                mediaRecorder.onerror = (error) => {
                    console.error('MediaRecorder error:', error);
                    reject(new Error('Compression failed'));
                };

                // Start recording
                mediaRecorder.start(100);
                video.currentTime = 0;
                video.playbackRate = 1.0;
                await video.play();

                // Draw frames
                let frameCount = 0;
                const totalFrames = Math.floor(duration * 30);

                const drawFrame = () => {
                    if (!video.paused && !video.ended) {
                        ctx.drawImage(video, 0, 0, width, height);
                        frameCount++;

                        if (onProgress) {
                            const progress = Math.min((frameCount / totalFrames) * 100, 99);
                            onProgress(Math.round(progress));
                        }

                        requestAnimationFrame(drawFrame);
                    }
                };

                video.onplay = () => {
                    drawFrame();
                };

                video.onended = () => {
                    setTimeout(() => {
                        mediaRecorder.stop();
                        if (onProgress) onProgress(100);
                    }, 100);
                };

            } catch (error) {
                console.error('Compression setup error:', error);
                reject(error);
            }
        };

        video.onerror = () => {
            reject(new Error('Failed to load video'));
        };

        video.src = URL.createObjectURL(file);
    });
}

/**
 * Check if video needs compression
 */
export function needsCompression(file: File, maxSizeMB: number = 50): boolean {
    return file.size > maxSizeMB * 1024 * 1024;
}
