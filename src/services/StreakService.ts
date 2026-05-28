import { supabase } from '../lib/supabase';

export interface UserStreak {
    user_id: string;
    current_streak: number;
    longest_streak: number;
    last_workout_date: string; // YYYY-MM-DD
    status: 'active' | 'at_risk' | 'frozen' | 'lost';
    recovery_deadline?: string;
}

export const streakService = {
    /**
     * Get the current streak for a user
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
     * Check if the user is in immediate danger of losing their streak
     * (i.e., status is 'at_risk')
     */
    isAtRisk(streak: UserStreak): boolean {
        return streak.status === 'at_risk' && !!streak.recovery_deadline;
    },

    /**
     * Get the time remaining for rescue formatted as HH:MM:SS
     * Returns null if not applicable or expired
     */
    getTimeRemaining(deadline: string): string | null {
        const end = new Date(deadline).getTime();
        const now = new Date().getTime();
        const diff = end - now;

        if (diff <= 0) return null;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m`; // Simplified format
    },

    /**
     * Record daily app entry and update user streak immediately
     */
    async recordAppEntry(userId: string): Promise<UserStreak | null> {
        try {
            // Get today and yesterday in local YYYY-MM-DD
            const today = new Date().toLocaleDateString('en-CA');
            const yesterdayObj = new Date();
            yesterdayObj.setDate(yesterdayObj.getDate() - 1);
            const yesterday = yesterdayObj.toLocaleDateString('en-CA');

            // 1. Fetch current streak
            const { data, error } = await supabase
                .from('user_streaks')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.error('Error fetching streak in recordAppEntry:', error);
                return null;
            }

            if (!data) {
                // 2. Create new streak record starting today
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
            const lastActiveDate = current.last_workout_date;

            if (lastActiveDate === today) {
                // Already opened today. Nothing to update!
                return current;
            }

            let newStreak = 1;
            let newLongest = current.longest_streak;

            if (lastActiveDate === yesterday) {
                // Consecutive daily entry!
                newStreak = current.current_streak + 1;
                newLongest = Math.max(current.longest_streak, newStreak);
            }

            const updatedRecord = {
                current_streak: newStreak,
                longest_streak: newLongest,
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
            console.error('Exception inside recordAppEntry:', e);
            return null;
        }
    }
};
