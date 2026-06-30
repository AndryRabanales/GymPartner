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
        this.uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ginx_videos';
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

    /**
     * Get optimized image URL with transformations
     * Supports Cloudinary, Unsplash, and Supabase Storage
     * @param url Original URL or publicId
     * @param options Transformation options
     */
    getOptimizedImageUrl(url: string, options: { width?: number, height?: number, crop?: string } = {}): string {
        if (!url) return url;
        
        const { width = 400, height = 400, crop = 'fill' } = options;

        // 1. Cloudinary Optimization
        if (url.includes('res.cloudinary.com')) {
            if (url.includes('/upload/')) {
                const parts = url.split('/upload/');
                const transform = `c_${crop},w_${width},h_${height},f_auto,q_auto:eco,dpr_auto`;
                return `${parts[0]}/upload/${transform}/${parts[1]}`;
            }
        }

        // 2. Unsplash Optimization (Very common for bots/mock data)
        if (url.includes('images.unsplash.com')) {
            const baseUrl = url.split('?')[0];
            return `${baseUrl}?w=${width}&h=${height}&fit=${crop === 'fill' ? 'crop' : 'max'}&q=60&auto=format`;
        }

        // 3. Supabase Storage Optimization (if enabled on the project)
        if (url.includes('.supabase.co/storage/v1/object/public/')) {
            // Supabase supports image transformations via query params if Pro/paid, 
            // but even on free it doesn't hurt to add them or use for future compatibility.
            return `${url}?width=${width}&height=${height}&resize=${crop === 'fill' ? 'cover' : 'contain'}`;
        }

        // 3.5. Facebook Graph Image Optimization to prevent pixelation
        if (url.includes('graph.facebook.com')) {
            const baseUrl = url.split('?')[0];
            // Request high-resolution image from Facebook
            return `${baseUrl}?width=${width}&height=${height}`;
        }

        // 4. Universal Proxy REMOVED due to 401 Unauthorized (restricted in dashboard)
        // If it's not Cloudinary, Unsplash or Supabase, return original URL
        return url;
    }
}

export const cloudinaryService = new CloudinaryService();
export type { CloudinaryUploadResponse, UploadProgress };
