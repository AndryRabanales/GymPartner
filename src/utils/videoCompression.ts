import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let ffmpegLoaded = false;

/**
 * Initialize FFmpeg instance (lazy loading)
 */
async function loadFFmpeg(): Promise<FFmpeg> {
    if (ffmpeg && ffmpegLoaded) {
        return ffmpeg;
    }

    ffmpeg = new FFmpeg();

    // Load FFmpeg core
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegLoaded = true;
    return ffmpeg;
}

/**
 * Compress video to target size while maintaining quality
 * @param file Original video file
 * @param targetSizeMB Target size in MB (default 45MB to leave margin)
 * @param onProgress Progress callback (0-100)
 */
export async function compressVideoToSize(
    file: File,
    targetSizeMB: number = 45,
    onProgress?: (progress: number) => void
): Promise<File> {
    try {
        const ffmpegInstance = await loadFFmpeg();

        // Set up progress listener
        if (onProgress) {
            ffmpegInstance.on('progress', ({ progress }) => {
                onProgress(Math.round(progress * 100));
            });
        }

        // Write input file to FFmpeg virtual filesystem
        const inputName = 'input.mp4';
        const outputName = 'output.mp4';
        await ffmpegInstance.writeFile(inputName, await fetchFile(file));

        // Get video duration to calculate bitrate
        const duration = await getVideoDuration(file);

        // Calculate target bitrate (leaving 10% margin for audio and overhead)
        const targetBits = targetSizeMB * 8 * 1024 * 1024; // Convert MB to bits
        const videoBitrate = Math.floor((targetBits * 0.9) / duration); // 90% for video
        const audioBitrate = 128000; // 128 kbps for audio

        // Compress video with FFmpeg
        // -c:v libx264: Use H.264 codec (best compatibility)
        // -preset medium: Balance between speed and compression
        // -crf 23: Constant Rate Factor (18-28, lower = better quality)
        // -b:v: Target video bitrate
        // -maxrate: Maximum bitrate
        // -bufsize: Buffer size for rate control
        // -c:a aac: Use AAC audio codec
        // -b:a: Audio bitrate
        await ffmpegInstance.exec([
            '-i', inputName,
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-b:v', `${videoBitrate}`,
            '-maxrate', `${videoBitrate * 1.2}`,
            '-bufsize', `${videoBitrate * 2}`,
            '-c:a', 'aac',
            '-b:a', `${audioBitrate}`,
            '-movflags', '+faststart', // Enable streaming
            '-y', // Overwrite output
            outputName
        ]);

        // Read compressed file
        const data = await ffmpegInstance.readFile(outputName) as Uint8Array;
        const compressedBlob = new Blob([new Uint8Array(data)], { type: 'video/mp4' });
        const compressedFile = new File(
            [compressedBlob],
            file.name.replace(/\.[^/.]+$/, '_compressed.mp4'),
            { type: 'video/mp4' }
        );

        // Clean up
        await ffmpegInstance.deleteFile(inputName);
        await ffmpegInstance.deleteFile(outputName);

        console.log(`✅ Compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

        return compressedFile;
    } catch (error) {
        console.error('FFmpeg compression error:', error);
        throw new Error('Failed to compress video. Please try a smaller file.');
    }
}

/**
 * Get video duration in seconds
 */
function getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
            URL.revokeObjectURL(video.src);
            resolve(video.duration);
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load video metadata'));
        };

        video.src = URL.createObjectURL(file);
    });
}

/**
 * Check if video needs compression
 */
export function needsCompression(file: File, maxSizeMB: number = 50): boolean {
    const maxBytes = maxSizeMB * 1024 * 1024;
    return file.size > maxBytes;
}
