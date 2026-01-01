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
   * Obtener el ranking del usuario en un gym (1-10, o null si no está en top 10)
   */
    async getUserRanking(userId: string, gymId: string): Promise<number | null> {
        try {
            const { data, error } = await supabase
                .from('gym_alphas')
                .select('*')
                .eq('gym_id', gymId)
                .eq('is_current', true)
                .order('consistency_score', { ascending: false })
                .limit(10);

            if (error) {
                console.error('Error getting user ranking:', error);
                return null;
            }

            if (!data || data.length === 0) return null;

            // Buscar la posición del usuario en el top 10
            const userIndex = data.findIndex(record => record.user_id === userId);

            if (userIndex === -1) return null; // No está en top 10

            return userIndex + 1; // Retornar ranking (1-based)
        } catch (error) {
            console.error('Error in getUserRanking:', error);
            return null;
        }
    },

    /**
     * Verificar si un usuario es el Alpha de un gym
     * @deprecated Use getUserRanking instead
     */
    async isUserAlpha(userId: string, gymId: string): Promise<boolean> {
        const ranking = await this.getUserRanking(userId, gymId);
        return ranking === 1;
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
