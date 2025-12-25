import { supabase } from '../lib/supabase';

// Bot Usernames pool
const BOT_NAMES = [
    "IronTitan", "SarahFits", "GymRat_99", "MuscleMike", "FitQueen_88",
    "CardioKing", "LiftHeavy", "SquatMaster", "BenchPresser", "DeadliftDiva",
    "ProteinPapi", "GainsGoblin", "WheyWarrior", "RepReaper", "SetSlayer",
    "FlexFriday", "SwolePatrol", "NattyOrNot", "GymBro_Alpha", "FitnessFreak",
    "BulkHulk", "CutCommander", "ShredderPro", "MassMonster", "PowerlifterX",
    "CrossFitCaleb", "YogaYoda", "PilatesPrincess", "ZumbaZombie", "CalisthenicsKid",
    "RunnerRick", "SprinterSam", "MarathonMax", "TriathlonTina", "CyclistCarl",
    "SwimmerSue", "BoxerBob", "MmaMark", "KarateKid", "JudoJoe",
    "WrestlerWill", "LifterLuke", "SpotterSteve", "TrainerTom", "CoachCarter",
    "DietDave", "NutritionNancy", "WellnessWendy", "HealthHal", "VitalityVick"
];

// Random Avatar pool (using UI Avatars for consistency)
const getAvatar = (name: string) => `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&size=128`;

export const BotSeeder = {
    /**
     * Seeds the database with 50 fake users.
     * WARNING: This creates actual Auth users if not careful, but for 'profiles' table we can just insert directly
     * if RLS allows it. However, usually profiles are linked to auth.users.
     * 
     * STRATEGY: 
     * Since we can't easily create 50 auth users programmatically without admin,
     * we will insert directly into 'profiles' table. 
     * This assumes 'profiles' table does NOT have a strict foreign key constraint checking auth.users 
     * OR that we are okay with these "ghosts" not being able to login.
     * 
     * IF strict FK exists: We can't do this easily from client.
     * WORKAROUND: We will create them as "Ghost" profiles if the schema allows, 
     * or we just simulate them in the Frontend (Leaderboard) if DB is strict.
     * 
     * LET'S TRY: Insert to 'profiles'. If it fails, we fall back to localStorage simulation or warn user.
     */
    async seedBots(count: number = 50) {
        console.log(`🤖 Starting Bot Invasion: Generating ${count} clones...`);

        const bots = [];

        for (let i = 0; i < count; i++) {
            const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + `_${Math.floor(Math.random() * 100)}`;
            const xp = Math.floor(Math.random() * 15000); // 0 to 15k XP
            // Fake UUID
            const id = crypto.randomUUID();

            bots.push({
                id: id, // generating a random UUID
                username: name,
                avatar_url: getAvatar(name),
                xp: xp,
                checkins_count: Math.floor(Math.random() * 50),
                photos_count: Math.floor(Math.random() * 10),
                description: "AI Generated Gym Partner",
                updated_at: new Date().toISOString()
            });
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .insert(bots) // Inserting ghosts
                .select();

            if (error) {
                console.error("❌ Bot Invasion Failed:", error);

                if (error.code === '23503') { // Foreign Key Violation
                    alert("⚠️ Error: No se pueden crear bots porque la base de datos requiere usuarios reales (Auth).");
                    return { success: false, error: 'Strict FK Constraint' };
                }

                throw error;
            }

            console.log("✅ Bot Invasion Successful!", data?.length);
            return { success: true, count: data?.length };

        } catch (err: any) {
            console.error("Critical Seeder Error:", err);
            return { success: false, error: err.message };
        }
    }
};
