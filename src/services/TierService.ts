
export type TierLevel = 'IRON' | 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | 'VIBRANIUM';

export interface TierInfo {
    level: TierLevel;
    name: string;
    minWorkouts: number;
    nextThreshold: number | null;
    color: string;
    borderColor: string;
    shadowColor: string;
    gradient: string;
    icon: string; // Emoji for now
}

export const TIERS: Record<TierLevel, TierInfo> = {
    IRON: {
        level: 'IRON',
        name: 'Iron',
        minWorkouts: 0,
        nextThreshold: 10,
        color: 'text-neutral-400',
        borderColor: 'border-neutral-600',
        shadowColor: 'shadow-neutral-900',
        gradient: 'from-neutral-700 to-neutral-500',
        icon: '🔩'
    },
    BRONZE: {
        level: 'BRONZE',
        name: 'Bronze',
        minWorkouts: 10,
        nextThreshold: 50,
        color: 'text-orange-500',
        borderColor: 'border-orange-700',
        shadowColor: 'shadow-orange-900',
        gradient: 'from-orange-800 to-orange-600',
        icon: '🥉'
    },
    SILVER: {
        level: 'SILVER',
        name: 'Silver',
        minWorkouts: 50,
        nextThreshold: 100,
        color: 'text-slate-300',
        borderColor: 'border-slate-400',
        shadowColor: 'shadow-slate-500/20',
        gradient: 'from-slate-400 to-slate-200',
        icon: '🥈'
    },
    GOLD: {
        level: 'GOLD',
        name: 'Gold',
        minWorkouts: 100,
        nextThreshold: 500,
        color: 'text-yellow-400',
        borderColor: 'border-yellow-500',
        shadowColor: 'shadow-yellow-500/40',
        gradient: 'from-yellow-600 to-yellow-300',
        icon: '👑'
    },
    DIAMOND: {
        level: 'DIAMOND',
        name: 'Diamond',
        minWorkouts: 500,
        nextThreshold: 1000,
        color: 'text-cyan-400',
        borderColor: 'border-cyan-500',
        shadowColor: 'shadow-cyan-500/50',
        gradient: 'from-cyan-600 to-cyan-300',
        icon: '💎'
    },
    VIBRANIUM: {
        level: 'VIBRANIUM',
        name: 'Vibranium',
        minWorkouts: 1000,
        nextThreshold: null,
        color: 'text-purple-500',
        borderColor: 'border-purple-500',
        shadowColor: 'shadow-purple-500/60',
        gradient: 'from-purple-600 to-purple-300',
        icon: '⚛️'
    }
};

export const TierService = {
    getTier(workoutsCount: number): TierInfo {
        if (workoutsCount >= TIERS.VIBRANIUM.minWorkouts) return TIERS.VIBRANIUM;
        if (workoutsCount >= TIERS.DIAMOND.minWorkouts) return TIERS.DIAMOND;
        if (workoutsCount >= TIERS.GOLD.minWorkouts) return TIERS.GOLD;
        if (workoutsCount >= TIERS.SILVER.minWorkouts) return TIERS.SILVER;
        if (workoutsCount >= TIERS.BRONZE.minWorkouts) return TIERS.BRONZE;
        return TIERS.IRON;
    },

    getNextTier(currentTier: TierLevel): TierInfo | null {
        switch (currentTier) {
            case 'IRON': return TIERS.BRONZE;
            case 'BRONZE': return TIERS.SILVER;
            case 'SILVER': return TIERS.GOLD;
            case 'GOLD': return TIERS.DIAMOND;
            case 'DIAMOND': return TIERS.VIBRANIUM;
            default: return null;
        }
    },

    getProgress(workoutsCount: number): number {
        const tier = this.getTier(workoutsCount);
        if (!tier.nextThreshold) return 100;

        const range = tier.nextThreshold - tier.minWorkouts;
        const current = workoutsCount - tier.minWorkouts;

        return Math.min(100, Math.max(0, (current / range) * 100));
    }
};
