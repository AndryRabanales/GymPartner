// src/services/AlphaService.ts
import { supabase } from '../lib/supabase';

interface AlphaData {
    alpha_id: string;
    gym_id: string;
    user_id: string;
    username: string;
    avatar_url: string;
    rank: string;
    total_volume: number;
    total_workouts: number;
    consistency_score: number;
    achieved_at: string;
}

export const alphaService = {
    /**
     * Obtener el Alpha actual de un gym
     */
    async getCurrentAlpha(gymId: string): Promise<AlphaData | null> {
        try {
            const { data, error } = await supabase
                .rpc('get_current_alpha', { target_gym_id: gymId })
                .single();

            if (error) {
                console.error('Error getting current alpha:', error);
                return null;
            }

            return data as AlphaData | null;
        } catch (error) {
            console.error('Error in getCurrentAlpha:', error);
            return null;
        }
    },

    /**
     * Verificar si un usuario es el Alpha de un gym
     */
    async isUserAlpha(userId: string, gymId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .rpc('is_user_alpha', {
                    target_user_id: userId,
                    target_gym_id: gymId
                });

            if (error) {
                console.error('Error checking if user is alpha:', error);
                return false;
            }

            return data === true;
        } catch (error) {
            console.error('Error in isUserAlpha:', error);
            return false;
        }
    },

    /**
     * Obtener historial de Alpha de un usuario
     */
    async getUserAlphaHistory(userId: string) {
        try {
            const { data, error } = await supabase
                .from('alpha_history')
                .select(`
          *,
          gym:gyms(id, name, address)
        `)
                .eq('user_id', userId)
                .order('last_alpha_at', { ascending: false });

            if (error) {
                console.error('Error getting alpha history:', error);
                return [];
            }

            return data;
        } catch (error) {
            console.error('Error in getUserAlphaHistory:', error);
            return [];
        }
    }
};
