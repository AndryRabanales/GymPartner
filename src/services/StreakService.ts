import { supabase } from '../lib/supabase';

// La racha es un contador ACUMULATIVO DE POR VIDA: nunca decrece ni se reinicia.
// Suma +1 por cada día calendario en que el usuario completa al menos 20 minutos
// de entrenamiento geo-validado (la misma condición que otorga el GX diario de
// entrenamiento). No existe estado "en riesgo", "congelada" ni "perdida".
export interface UserStreak {
    user_id: string;
    current_streak: number;
    longest_streak: number;
    last_workout_date: string; // YYYY-MM-DD
}

export const streakService = {
    /**
     * Get the current (lifetime) streak counter for a user
     */
    async getUserStreak(userId: string): Promise<UserStreak | null> {
        const { data, error } = await supabase
            .from('user_streaks')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching streak:', error);
            return null;
        }

        if (!data) return null;

        return data as UserStreak;
    },

    /**
     * Record a qualifying training day (>= 20 min, geo-validated — same condition
     * that grants the daily training GX) and grow the lifetime streak counter.
     * Idempotent per calendar day: calling this more than once on the same day
     * has no further effect. The counter NEVER decreases or resets.
     */
    async recordTrainingDay(userId: string): Promise<UserStreak | null> {
        try {
            const today = new Date().toLocaleDateString('en-CA');

            const { data, error } = await supabase
                .from('user_streaks')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.error('Error fetching streak in recordTrainingDay:', error);
                return null;
            }

            if (!data) {
                const newRecord = {
                    user_id: userId,
                    current_streak: 1,
                    longest_streak: 1,
                    last_workout_date: today,
                    status: 'active'
                };

                const { data: inserted, error: insertError } = await supabase
                    .from('user_streaks')
                    .insert(newRecord)
                    .select()
                    .single();

                if (insertError) {
                    console.error('Error inserting new streak record:', insertError);
                    return null;
                }
                return inserted as UserStreak;
            }

            const current = data as UserStreak;

            if (current.last_workout_date === today) {
                // Ya se contó un día calificado hoy — máximo 1 punto por día.
                return current;
            }

            const newStreak = current.current_streak + 1;

            const updatedRecord = {
                current_streak: newStreak,
                longest_streak: Math.max(current.longest_streak, newStreak),
                last_workout_date: today,
                status: 'active',
                recovery_deadline: null
            };

            const { data: updated, error: updateError } = await supabase
                .from('user_streaks')
                .update(updatedRecord)
                .eq('user_id', userId)
                .select()
                .single();

            if (updateError) {
                console.error('Error updating streak record:', updateError);
                return null;
            }

            return updated as UserStreak;

        } catch (e) {
            console.error('Exception inside recordTrainingDay:', e);
            return null;
        }
    }
};
