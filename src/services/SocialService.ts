import { supabase } from '../lib/supabase';

// Types representing the DB Schema
export interface Post {
    id: string;
    user_id: string;
    type: 'image' | 'video';
    media_url: string;
    thumbnail_url?: string;
    caption?: string;
    linked_routine_id?: string;
    created_at: string;

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

            return { success: true };
        } catch (error: any) {
            console.error('Error creating post:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================================================
    // 📺 READ FEEDS (Profile & Main)
    // ============================================================================

    /**
     * Fetches posts for a specific user's profile (Grid or Reels tab).
     */
    async getUserPosts(userId: string, type: 'image' | 'video'): Promise<Post[]> {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                post_likes (count)
            `)
            .eq('user_id', userId)
            .eq('type', type)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(`Error fetching user ${type} posts:`, error);
            return [];
        }

        // Transform to include simple counts
        return data.map((post: any) => ({
            ...post,
            likes_count: post.post_likes?.[0]?.count || 0
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
                profiles (username, avatar_url),
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
            console.error('Error fetching global feed:', error);

            // Helpful check for the developer/user
            if (error.code === '42P01') {
                console.warn('❌ CRITICAL: The "posts" table does not exist. Please run the "create_social_schema.sql" script in Supabase!');
            }
            return [];
        }

        return data.map((post: any) => ({
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
            const [followers, following] = await Promise.all([
                supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
                supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
                // supabase.from('post_likes').select('user_id', { count: 'exact', head: true }).eq('user_id', userId) // WAIT: This counts likes GIVEN, not RECEIVED. 
            ]);

            // Correction: Total Likes RECEIVED on user's posts
            // This is harder in Supabase without a view or RPC. 
            // For MVP, we might display "Likes Actions" or just skip 'Total Likes Received' unless we make a DB function.
            // Let's stick to Followers/Following for now to be safe and fast.

            return {
                followersCount: followers.count || 0,
                followingCount: following.count || 0,
                totalLikes: 0 // Placeholder
            };
        } catch (e) {
            return { followersCount: 0, followingCount: 0, totalLikes: 0 };
        }
    }
}

export const socialService = new SocialService();
