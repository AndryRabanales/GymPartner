import { supabase } from '../lib/supabase';
import { userService } from './UserService';

// Types representing the DB Schema
export interface MediaItem {
    url: string;
    type: 'image' | 'video';
    order_index: number;
}

export interface Post {
    id: string;
    user_id: string;
    type: 'image' | 'video';
    media_url: string;
    thumbnail_url?: string;
    caption?: string;
    linked_routine_id?: string;
    created_at: string;

    // Multi-media support
    media?: MediaItem[]; // Array of media items for carousel posts

    // Aggregated/Joined data
    likes_count?: number;
    user_has_liked?: boolean;
    profiles?: {
        username: string;
        avatar_url: string;
    };
    routines?: {
        name: string;
    }
}

export interface SocialProfileStats {
    followersCount: number;
    followingCount: number;
    totalLikes: number;
}

class SocialService {

    // ============================================================================
    // 📝 POSTS (Upload & Create)
    // ============================================================================

    /**
     * Helper: Upload a single file to Supabase Storage and return public URL.
     */
    async uploadFile(userId: string, file: File): Promise<string> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('gym-social-media')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('gym-social-media')
            .getPublicUrl(fileName);

        return publicUrl;
    }

    /**
     * Creates a post with multiple pre-uploaded media items (URLs).
     * This unifies Cloudinary (videos) and Supabase (images) workflows.
     */
    async createPostWithMixedMedia(
        userId: string,
        mediaItems: { url: string; type: 'video' | 'image' }[],
        caption?: string,
        linkedRoutineId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            if (mediaItems.length === 0) throw new Error('No media items provided');

            // 1. Create Post
            const { data: post, error: postError } = await supabase
                .from('posts')
                .insert({
                    user_id: userId,
                    type: mediaItems[0].type, // Primary type from first item
                    media_url: mediaItems[0].url, // Backward compatibility
                    caption: caption,
                    linked_routine_id: linkedRoutineId
                })
                .select()
                .single();

            if (postError) throw postError;

            // 2. Insert Media Records
            const mediaRecords = mediaItems.map((item, index) => ({
                post_id: post.id,
                media_url: item.url,
                media_type: item.type,
                order_index: index
            }));

            const { error: mediaError } = await supabase
                .from('post_media')
                .insert(mediaRecords);

            if (mediaError) throw mediaError;

            // 🎉 Award XP: 10 XP per media item (Video/Photo)
            const totalXP = mediaItems.length * 10;
            await userService.addXP(userId, totalXP);

            return { success: true };
        } catch (error: any) {
            console.error('Error creating mixed-media post:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Uploads a file to Supabase Storage and creates a Post record.
     */
    async createPost(
        userId: string,
        file: File,
        type: 'image' | 'video',
        caption?: string,
        linkedRoutineId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // 1. Upload File to Bucket
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${Date.now()}.${fileExt}`;
            // const bucketName = type === 'image' ? 'gym-social-media' : 'gym-social-media';

            const { error: uploadError } = await supabase.storage
                .from('gym-social-media')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('gym-social-media')
                .getPublicUrl(fileName);

            // 3. Insert into DB
            const { error: dbError } = await supabase
                .from('posts')
                .insert({
                    user_id: userId,
                    type: type,
                    media_url: publicUrl,
                    caption: caption,
                    linked_routine_id: linkedRoutineId
                    // thumbnail_url: for videos, we might need a separate client-side generator later
                });

            if (dbError) throw dbError;

            // 🎉 Award XP for social engagement
            await userService.addXP(userId, 10);

            return { success: true };
        } catch (error: any) {
            console.error('Error creating post:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Creates a post with multiple media files (carousel)
     */
    async createPostWithMultipleMedia(
        userId: string,
        files: File[],
        caption?: string,
        linkedRoutineId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            if (files.length === 0) {
                throw new Error('No files provided');
            }

            // 1. Create the post record first
            const { data: post, error: postError } = await supabase
                .from('posts')
                .insert({
                    user_id: userId,
                    type: files[0].type.startsWith('video') ? 'video' : 'image', // Primary type
                    media_url: '', // Will be updated with first media URL
                    caption: caption,
                    linked_routine_id: linkedRoutineId
                })
                .select()
                .single();

            if (postError) throw postError;

            // 2. Upload all files and create post_media records
            const mediaRecords = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${userId}/${Date.now()}_${i}.${fileExt}`;
                const mediaType = file.type.startsWith('video') ? 'video' : 'image';

                // Upload to storage
                const { error: uploadError } = await supabase.storage
                    .from('gym-social-media')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('gym-social-media')
                    .getPublicUrl(fileName);

                mediaRecords.push({
                    post_id: post.id,
                    media_url: publicUrl,
                    media_type: mediaType,
                    order_index: i
                });

                // Update main post with first media URL for backward compatibility
                if (i === 0) {
                    await supabase
                        .from('posts')
                        .update({ media_url: publicUrl })
                        .eq('id', post.id);
                }
            }

            // 3. Insert all media records
            const { error: mediaError } = await supabase
                .from('post_media')
                .insert(mediaRecords);

            if (mediaError) throw mediaError;

            // 🎉 Award XP for social engagement
            await userService.addXP(userId, 10);

            return { success: true };
        } catch (error: any) {
            console.error('Error creating multi-media post:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Creates a post with an external URL (e.g., from Cloudinary)
     * Used when video is uploaded to external service
     */
    async createPostWithExternalUrl(
        userId: string,
        mediaUrl: string,
        type: 'image' | 'video',
        caption?: string,
        linkedRoutineId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error: dbError } = await supabase
                .from('posts')
                .insert({
                    user_id: userId,
                    type: type,
                    media_url: mediaUrl,
                    caption: caption,
                    linked_routine_id: linkedRoutineId
                });

            if (dbError) throw dbError;

            // 🎉 Award XP for social engagement
            await userService.addXP(userId, 10);

            return { success: true };
        } catch (error: any) {
            console.error('Error creating post with external URL:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================================================
    // 📺 READ FEEDS (Profile & Main)
    // ============================================================================

    /**
     * Fetches posts for a specific user's profile (Grid or Reels tab).
     */
    async getUserPosts(userId: string, type?: 'image' | 'video'): Promise<Post[]> {
        let query = supabase
            .from('posts')
            .select(`
                *,
                post_likes (count)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (type) {
            query = query.eq('type', type);
        }

        const { data, error } = await query;

        if (error) {
            console.error(`Error fetching user ${type} posts:`, error);
            return [];
        }

        // Fetch media for all posts
        const postsWithMedia = await this.attachMediaToPosts(data);

        // Transform to include simple counts
        return postsWithMedia.map((post: any) => ({
            ...post,
            likes_count: post.post_likes?.[0]?.count || 0
        }));
    }

    /**
     * Helper: Attach media array from post_media table to posts
     */
    private async attachMediaToPosts(posts: any[]): Promise<any[]> {
        if (!posts || posts.length === 0) return [];

        const postIds = posts.map(p => p.id);

        // Fetch all media for these posts
        const { data: mediaData } = await supabase
            .from('post_media')
            .select('*')
            .in('post_id', postIds)
            .order('order_index', { ascending: true });

        // Group media by post_id
        const mediaByPost = new Map<string, MediaItem[]>();
        mediaData?.forEach((m: any) => {
            if (!mediaByPost.has(m.post_id)) {
                mediaByPost.set(m.post_id, []);
            }
            mediaByPost.get(m.post_id)!.push({
                url: m.media_url,
                type: m.media_type,
                order_index: m.order_index
            });
        });

        // Attach media to posts
        return posts.map(post => ({
            ...post,
            media: mediaByPost.get(post.id) || []
        }));
    }

    /**
     * Fetches the main feed (Global or Following). 
     * Currently implements Global Feed (Discovery).
     */
    async getGlobalFeed(currentUserId?: string, type?: 'image' | 'video'): Promise<Post[]> {
        // Fetch posts + Creator info + Routine info (if linked)
        let query = supabase
            .from('posts')
            .select(`
                *,
                profiles!fk_posts_profiles (username, avatar_url),
                routines (name),
                post_likes (user_id)
            `)
            .order('created_at', { ascending: false })
            .limit(20);

        if (type) {
            query = query.eq('type', type);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching global feed:', JSON.stringify(error, null, 2));

            // Helpful check for the developer/user
            if (error.code === '42P01') {
                console.warn('❌ CRITICAL: The "posts" table does not exist. Please run the "create_social_schema.sql" script in Supabase!');
            }
            return [];
        }

        // Fetch media for all posts
        const postsWithMedia = await this.attachMediaToPosts(data);

        return postsWithMedia.map((post: any) => ({
            ...post,
            // Check if current user liked it (if logged in)
            user_has_liked: currentUserId
                ? post.post_likes?.some((like: any) => like.user_id === currentUserId)
                : false,
            // Count likes (this is a rough count based on fetched rows, usually better with a .count() join but this works for MVP)
            likes_count: post.post_likes?.length || 0
        }));
    }

    // ============================================================================
    // ❤️ LIKES
    // ============================================================================

    async toggleLike(userId: string, postId: string): Promise<boolean> {
        // 1. Check if exists
        const { data: existing } = await supabase
            .from('post_likes')
            .select('post_id')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .maybeSingle();

        if (existing) {
            // UNLIKE
            await supabase
                .from('post_likes')
                .delete()
                .eq('post_id', postId)
                .eq('user_id', userId);
            return false; // Not liked anymore
        } else {
            // LIKE
            await supabase
                .from('post_likes')
                .insert({ post_id: postId, user_id: userId });
            return true; // Liked
        }
    }

    // ============================================================================
    // 🤝 FOLLOWS
    // ============================================================================

    async followUser(followerId: string, followingId: string) {
        return await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });
    }

    async unfollowUser(followerId: string, followingId: string) {
        return await supabase
            .from('follows')
            .delete()
            .eq('follower_id', followerId)
            .eq('following_id', followingId);
    }

    async getFollowStatus(followerId: string, followingId: string): Promise<boolean> {
        const { data } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', followerId)
            .eq('following_id', followingId)
            .maybeSingle();
        return !!data;
    }

    async getProfileStats(userId: string): Promise<SocialProfileStats> {
        try {
            // Parallel fetch for perf
            const [followers, following, postsWithLikes] = await Promise.all([
                supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
                supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
                supabase.from('posts').select('id, post_likes(count)', { count: 'exact' }).eq('user_id', userId)
            ]);

            // Calculate Total Likes Received
            const totalLikesReceived = postsWithLikes.data?.reduce((acc: number, post: any) => {
                return acc + (post.post_likes?.[0]?.count || 0);
            }, 0) || 0;

            return {
                followersCount: followers.count || 0,
                followingCount: following.count || 0,
                totalLikes: totalLikesReceived
            };
        } catch (e) {
            console.error(e);
            return { followersCount: 0, followingCount: 0, totalLikes: 0 };
        }
    }

    // ============================================================================
    // 💬 COMMENTS
    // ============================================================================

    async getComments(postId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('comments')
            .select(`
                *,
                profiles!fk_comments_profiles (username, avatar_url)
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error fetching comments:", error);
            return [];
        }
        return data;
    }

    async addComment(userId: string, postId: string, content: string) {
        return await supabase
            .from('comments')
            .insert({
                user_id: userId,
                post_id: postId,
                content: content
            })
            .select('*, profiles!fk_comments_profiles(username, avatar_url)')
            .single();
    }
}

export const socialService = new SocialService();
