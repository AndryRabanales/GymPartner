export type UserRank = 'Novato' | 'Gym Rat' | 'Elite' | 'Legend' | 'Gym God';

export interface User {
    id: string;
    username: string;
    description: string;
    avatarUrl: string;
    homeGymId?: string; // El gym donde es "regular"
    xp: number;
    rank: UserRank;
    stats: {
        totalCheckins: number;
        gymsVisited: number;
        reviewsWritten: number;
        photosUploaded: number;
    };
    badges: string[]; // IDs de medallas ganadas
}

// PROGRESSION CURVE:
// Delta (XP needed for next level) = Base + (Level * Growth)
// Base = 200, Growth = 15
// Level 1->2: 215 XP
// Level 10->11: 350 XP
// Level 50->51: 950 XP (Approx 1 week of activity)
// Level 99->100: 1700 XP

export const getLevelFromXP = (xp: number): number => {
    let level = 1;
    let currentXpRequirement = 0;

    // Safety break at level 200 to prevent infinite loops if XP is massive
    while (level < 200) {
        // Calculate XP needed for NEXT level
        const xpForNext = 200 + (level * 15);
        if (xp < currentXpRequirement + xpForNext) {
            return level;
        }
        currentXpRequirement += xpForNext;
        level++;
    }
    return level;
};

export const getXPProgress = (xp: number): { currentLevel: number; nextLevelXp: number; levelProgress: number; progressPercent: number } => {
    let level = 1;
    let accumulatedXp = 0;

    while (true) {
        const xpForNext = 200 + (level * 15);
        if (xp < accumulatedXp + xpForNext) {
            const xpInCurrentLevel = xp - accumulatedXp;
            return {
                currentLevel: level,
                nextLevelXp: xpForNext,
                levelProgress: xpInCurrentLevel,
                progressPercent: (xpInCurrentLevel / xpForNext) * 100
            };
        }
        accumulatedXp += xpForNext;
        level++;
    }
};

export const getRankFromXP = (xp: number): UserRank => {
    // Adjusted for new curve
    if (xp >= 100000) return 'Gym God'; // ~Level 100+
    if (xp >= 25000) return 'Legend';   // ~Level 50+
    if (xp >= 7000) return 'Elite';     // ~Level 25+
    if (xp >= 1000) return 'Gym Rat';   // ~Level 5-10
    return 'Novato';
};

