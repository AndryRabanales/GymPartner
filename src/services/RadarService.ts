
import { supabase } from '../lib/supabase';
import { TierService } from './TierService';
import type { TierInfo } from './TierService';

export interface RadarUser {
    user_id: string;
    username: string;
    avatar_url: string;
    banner_url?: string;
    description?: string;
    checkins_count: number;
    gym_id: string;
    gym_name: string;
    gym_lat: number;
    gym_lng: number;
    distance_km: number;
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
    async getNearbyGymRats(lat: number, lng: number, radiusKm: number = 100): Promise<RadarUser[]> {
        console.log('📡 Radar Scanning...', { lat, lng, radiusKm });

        const { data, error } = await supabase
            .rpc('get_nearby_gymrats', {
                current_lat: lat,
                current_lng: lng,
                radius_km: radiusKm
            });

        if (error) {
            console.error('Radar Error:', error);
            // Fallback for demo/dev if RPC missing
            return [];
        }

        if (!data) return [];

        // Map and enrich with Tier info
        return data.map((user: any) => ({
            user_id: user.user_id,
            username: user.username,
            avatar_url: user.avatar_url,
            checkins_count: user.checkins_count,
            gym_id: user.gym_id,
            gym_name: user.gym_name,
            gym_lat: user.gym_lat,
            gym_lng: user.gym_lng,
            distance_km: user.distance_km,
            tier: TierService.getTier(user.checkins_count)
        }));
    }
};
