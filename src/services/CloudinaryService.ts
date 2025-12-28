/**
 * Cloudinary Service for video uploads and optimization
 * Handles server-side video compression and transcoding
 */

interface CloudinaryUploadResponse {
    secure_url: string;
    public_id: string;
    format: string;
    resource_type: string;
    duration?: number;
    width?: number;
    height?: number;
    thumbnail_url?: string;
}

interface UploadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

class CloudinaryService {
    private cloudName: string;
    private uploadPreset: string;

    constructor() {
        // Get credentials from environment variables
        this.cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
        this.uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'gympartner_videos';
    }

    /**
     * Check if Cloudinary is configured
     */
    isConfigured(): boolean {
        return !!this.cloudName;
    }

    /**
     * Upload video to Cloudinary with automatic optimization
     * @param file Video file to upload
     * @param onProgress Progress callback
     * @returns Cloudinary response with optimized video URL
     */
    async uploadVideo(
        file: File,
        onProgress?: (progress: UploadProgress) => void
    ): Promise<CloudinaryUploadResponse> {
        if (!this.isConfigured()) {
            throw new Error('Cloudinary not configured. Please add VITE_CLOUDINARY_CLOUD_NAME to .env');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', this.uploadPreset);

        // Video optimization parameters
        formData.append('resource_type', 'video');
        formData.append('quality', 'auto:good'); // Automatic quality optimization
        formData.append('fetch_format', 'mp4'); // Force MP4 output
        formData.append('video_codec', 'h264'); // H.264 for compatibility
        formData.append('audio_codec', 'aac'); // AAC audio

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress({
                        loaded: e.loaded,
                        total: e.total,
                        percentage: Math.round((e.loaded / e.total) * 100)
                    });
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);

                    // Generate thumbnail URL
                    const thumbnailUrl = this.getThumbnailUrl(response.public_id);

                    resolve({
                        secure_url: response.secure_url,
                        public_id: response.public_id,
                        format: response.format,
                        resource_type: response.resource_type,
                        duration: response.duration,
                        width: response.width,
                        height: response.height,
                        thumbnail_url: thumbnailUrl
                    });
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload cancelled'));
            });

            const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/video/upload`;
            xhr.open('POST', uploadUrl);
            xhr.send(formData);
        });
    }

    /**
     * Upload image to Cloudinary
     * @param file Image file to upload
     * @param onProgress Progress callback
     */
    async uploadImage(
        file: File,
        onProgress?: (progress: UploadProgress) => void
    ): Promise<CloudinaryUploadResponse> {
        if (!this.isConfigured()) {
            throw new Error('Cloudinary not configured. Please add VITE_CLOUDINARY_CLOUD_NAME to .env');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', this.uploadPreset);
        formData.append('resource_type', 'image');

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress({
                        loaded: e.loaded,
                        total: e.total,
                        percentage: Math.round((e.loaded / e.total) * 100)
                    });
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    resolve({
                        secure_url: response.secure_url,
                        public_id: response.public_id,
                        format: response.format,
                        resource_type: response.resource_type
                    });
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });

            const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
            xhr.open('POST', uploadUrl);
            xhr.send(formData);
        });
    }

    /**
     * Get thumbnail URL for a video
     */
    private getThumbnailUrl(publicId: string): string {
        return `https://res.cloudinary.com/${this.cloudName}/video/upload/so_0,w_400,h_400,c_fill/${publicId}.jpg`;
    }

    /**
     * Get optimized video URL with transformations
     */
    getOptimizedVideoUrl(publicId: string): string {
        return `https://res.cloudinary.com/${this.cloudName}/video/upload/q_auto:good,f_mp4,vc_h264,ac_aac/${publicId}`;
    }
}

export const cloudinaryService = new CloudinaryService();
export type { CloudinaryUploadResponse, UploadProgress };
