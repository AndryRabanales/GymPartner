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
                .maybeSingle();

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
    },

    /**
     * Calcular rankings semanales para todos los gyms
     * Este método se ejecuta vía cron job cada semana
     */
    async calculateWeeklyRankings(): Promise<{ success: boolean; gymsProcessed: number; errors: string[] }> {
        const errors: string[] = [];
        let gymsProcessed = 0;

        try {
            // 1. Obtener todos los gyms activos
            const { data: gyms, error: gymsError } = await supabase
                .from('gyms')
                .select('id, name');

            if (gymsError) {
                errors.push(`Error fetching gyms: ${gymsError.message}`);
                return { success: false, gymsProcessed: 0, errors };
            }

            if (!gyms || gyms.length === 0) {
                return { success: true, gymsProcessed: 0, errors: ['No gyms found'] };
            }

            // 2. Para cada gym, calcular top 10
            for (const gym of gyms) {
                try {
                    await this.calculateGymRankings(gym.id, gym.name);
                    gymsProcessed++;
                } catch (error) {
                    const err = error as Error;
                    errors.push(`Error processing gym ${gym.name}: ${err.message} `);
                }
            }

            return {
                success: errors.length === 0,
                gymsProcessed,
                errors
            };
        } catch (error) {
            const err = error as Error;
            errors.push(`Fatal error: ${err.message} `);
            return { success: false, gymsProcessed, errors };
        }
    },

    /**
     * Calcular rankings para un gym específico
     */
    async calculateGymRankings(gymId: string, gymName: string): Promise<void> {
        // 1. Obtener fecha de la semana actual
        const { data: weekDates } = await supabase.rpc('get_week_start', { target_date: new Date().toISOString() });
        const weekStart = weekDates;
        const { data: weekEnd } = await supabase.rpc('get_week_end', { target_date: new Date().toISOString() });

        // 2. Obtener todos los workouts de esta semana en este gym
        const { data: workouts, error: workoutsError } = await supabase
            .from('workouts')
            .select(`
            id,
                user_id,
                created_at,
                workout_exercises(
                    sets(weight, reps)
                ),
                profiles(id, username, avatar_url, rank)
                    `)
            .eq('gym_id', gymId)
            .gte('created_at', weekStart)
            .lte('created_at', weekEnd);

        if (workoutsError) {
            console.error('Error fetching workouts:', workoutsError);
            return;
        }

        if (!workouts || workouts.length === 0) {
            console.log(`No workouts this week for gym ${gymName}`);
            return;
        }

        // 3. Calcular stats por usuario
        const userStats = new Map<string, {
            userId: string;
            username: string;
            avatarUrl: string;
            rank: string;
            totalVolume: number;
            totalWorkouts: number;
            consistencyScore: number;
        }>();

        for (const workout of workouts) {
            const userId = workout.user_id;
            const profile = Array.isArray(workout.profiles) ? workout.profiles[0] : workout.profiles;

            if (!userStats.has(userId)) {
                userStats.set(userId, {
                    userId,
                    username: profile?.username || 'Unknown',
                    avatarUrl: profile?.avatar_url || '',
                    rank: profile?.rank || 'Novato',
                    totalVolume: 0,
                    totalWorkouts: 0,
                    consistencyScore: 0
                });
            }

            const stats = userStats.get(userId)!;
            stats.totalWorkouts++;

            // Calcular volumen
            if (workout.workout_exercises) {
                for (const exercise of workout.workout_exercises) {
                    if (exercise.sets) {
                        for (const set of exercise.sets) {
                            stats.totalVolume += (set.weight || 0) * (set.reps || 0);
                        }
                    }
                }
            }
        }

        // 4. Calcular consistency score (volumen promedio por workout)
        userStats.forEach(stats => {
            stats.consistencyScore = stats.totalWorkouts > 0
                ? stats.totalVolume / stats.totalWorkouts
                : 0;
        });

        // 5. Ordenar por consistency score y tomar top 10
        const sortedUsers = Array.from(userStats.values())
            .sort((a, b) => b.consistencyScore - a.consistencyScore)
            .slice(0, 10);

        // 6. Marcar rankings antiguos como no actuales
        await supabase
            .from('gym_alphas')
            .update({ is_current: false })
            .eq('gym_id', gymId)
            .eq('is_current', true);

        // 7. Insertar nuevos rankings
        const newRankings = sortedUsers.map(user => ({
            gym_id: gymId,
            user_id: user.userId,
            week_start: weekStart,
            week_end: weekEnd,
            total_volume: user.totalVolume,
            total_workouts: user.totalWorkouts,
            consistency_score: user.consistencyScore,
            is_current: true
        }));

        const { error: insertError } = await supabase
            .from('gym_alphas')
            .insert(newRankings);

        if (insertError) {
            console.error('Error inserting new rankings:', insertError);
            throw insertError;
        }

        console.log(`✅ Rankings calculated for ${gymName}: ${sortedUsers.length} users`);
    }
};
