import { supabase } from '../lib/supabase';

export interface Challenge {
    id: string;
    challenger_id: string;
    defender_id: string;
    gym_id?: string;
    wager_amount: number;
    metric: 'total_volume' | 'workout_count';
    status: 'pending' | 'accepted' | 'declined' | 'active' | 'completed' | 'draw';
    start_time?: string;
    end_time?: string;
    winner_id?: string;
    created_at: string;

    // Joined fields
    challenger?: { username: string; avatar_url: string };
    defender?: { username: string; avatar_url: string };
}

export const challengeService = {

    /**
     * Crear un nuevo desafío
     */
    async createChallenge(defenderId: string, wagerAmount: number, metric: 'total_volume' | 'workout_count') {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user logged in');

            // 1. Validar que el usuario tenga racha suficiente para apostar
            // (Esto idealmente se valida también en DB o con un check previo, 
            // pero por ahora confiamos en el UI o en la RLS futura)

            const { data, error } = await supabase
                .from('challenges')
                .insert({
                    challenger_id: user.id,
                    defender_id: defenderId,
                    wager_amount: wagerAmount,
                    metric: metric,
                    status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;
            return { success: true, challenge: data };

        } catch (error: any) {
            console.error('Error creating challenge:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Obtener desafíos del usuario (Activos y Pendientes)
     */
    async getUserChallenges() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from('challenges')
                .select(`
                    *,
                    challenger:challenger_id(username, avatar_url),
                    defender:defender_id(username, avatar_url)
                `)
                .or(`challenger_id.eq.${user.id},defender_id.eq.${user.id}`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Challenge[];

        } catch (error) {
            console.error('Error fetching challenges:', error);
            return [];
        }
    },

    /**
     * Aceptar un desafío
     */
    async acceptChallenge(challengeId: string) {
        try {
            // Al aceptar, inicia el countdown (por ejemplo, empieza YA o empieza mañana)
            // Para V1, digamos que empieza YA y dura 24h.
            const startTime = new Date().toISOString();
            const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // +24h

            const { error } = await supabase
                .from('challenges')
                .update({
                    status: 'active',
                    start_time: startTime,
                    end_time: endTime
                })
                .eq('id', challengeId);

            if (error) throw error;
            return { success: true };

        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Rechazar un desafío
     */
    async declineChallenge(challengeId: string) {
        try {
            const { error } = await supabase
                .from('challenges')
                .update({ status: 'declined' })
                .eq('id', challengeId);

            if (error) throw error;
            return { success: true };

        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
};
