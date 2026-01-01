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
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // No data found
            console.error('Error fetching streak:', error);
            return null;
        }

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
    }
};
