
import { supabase } from '../lib/supabase';
import { TierService } from './TierService';


export interface RadarUser {
    user_id: string;
    username: string;
    avatar_url: string;
    banner_url?: string;
    gym_banner_url?: string;
    gym_custom_color?: string;
    description?: string;
    checkins_count: number;
    gym_id: string;
    gym_name: string;
    gym_lat: number;
    gym_lng: number;
    distance_km: number;
    followers_count: number; 
    following_count: number;
    is_boosted?: boolean;
    // Computed on frontend
    tier: any;
}

export const radarService = {
    /**
     * Find GymRats in a radius around the user.
     * @param lat Current User Latitude
     * @param lng Current User Longitude
     * @param radiusKm Search Radius (Default 100)
     */
    async getNearbyGymRats(lat: number, lng: number, radiusKm: number = 99999): Promise<RadarUser[]> {
        console.log('📡 Radar Scanning...', { lat, lng, radiusKm });

        const { data: { user: currentUser } } = await supabase.auth.getUser();

        const [radarResult, blocksResult] = await Promise.all([
            supabase.rpc('get_nearby_gymrats', { current_lat: lat, current_lng: lng, radius_km: radiusKm }),
            currentUser
                ? supabase.from('user_blocks').select('blocked_user, blocked_by').or(`blocked_by.eq.${currentUser.id},blocked_user.eq.${currentUser.id}`)
                : Promise.resolve({ data: [], error: null })
        ]);

        if (radarResult.error) {
            console.error('Radar Error:', radarResult.error);
            return [];
        }

        if (!radarResult.data) return [];

        // Build set of blocked user IDs (both directions)
        const blockedIds = new Set<string>();
        if (blocksResult.data) {
            for (const b of blocksResult.data) {
                blockedIds.add(b.blocked_user);
                blockedIds.add(b.blocked_by);
            }
            if (currentUser) blockedIds.delete(currentUser.id); // don't exclude self
        }

        const data = radarResult.data.filter((u: any) => !blockedIds.has(u.user_id));

        // Map and enrich with Tier info
        return data.map((user: any) => ({
            user_id: user.user_id,
            username: user.username,
            avatar_url: user.avatar_url,
            banner_url: user.banner_url,
            gym_banner_url: user.gym_banner_url,
            gym_custom_color: user.gym_custom_color,
            description: user.description,
            checkins_count: user.checkins_count,
            gym_id: user.gym_id,
            gym_name: user.gym_name,
            gym_lat: user.gym_lat,
            gym_lng: user.gym_lng,
            distance_km: user.distance_km,
            followers_count: Number(user.followers_count || 0),
            following_count: Number(user.following_count || 0),
            is_boosted: user.is_boosted,
            tier: TierService.getTier(user.checkins_count)
        }));
    }
};
