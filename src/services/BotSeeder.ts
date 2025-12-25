import { supabase } from '../lib/supabase';

// Bot Usernames pool
// Bot Usernames pool (Mix of Nicknames and Real-ish names)
const BOT_NAMES = [
    "IronTitan", "SarahFits", "GymRat_99", "MuscleMike", "FitQueen_88",
    "CardioKing", "LiftHeavy", "SquatMaster", "BenchPresser", "DeadliftDiva",
    "Carlos Ruiz", "Ana Morales", "Juan Pablo", "Sofia Lima", "Diego Torres",
    "Valentina Roa", "Mateo Silva", "Isabella Gomez", "Lucas Fernandez", "Camila Diaz",
    "Alex Chen", "Jordan Lee", "Casey Jones", "Taylor Swift_Fan", "Morgan Stark",
    "ProteinPapi", "GainsGoblin", "WheyWarrior", "RepReaper", "SetSlayer",
    "Javier Mendez", "Lucia Herrero", "Fernando Vega", "Gabriela Solis", "Ricardo Montiel"
];

// Random Avatar pool (using UI Avatars for consistency)
const getAvatar = (name: string) => `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&size=128`;

// Cool Banner Images (Cyberpunk / Gym aesthetic)
const BANNERS = [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop", // Dark Gym
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1470&auto=format&fit=crop", // Weights
    "https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?q=80&w=1469&auto=format&fit=crop", // Neon
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1469&auto=format&fit=crop", // Fitness
    "https://images.unsplash.com/photo-1623874514711-0f321325f318?q=80&w=1470&auto=format&fit=crop", // Abstract Tech
    "https://images.unsplash.com/photo-1550345332-09e3ac987658?q=80&w=1374&auto=format&fit=crop"  // Cyberpunk City
];

export const BotSeeder = {
    async seedBots(count: number = 50) {
        console.log(`🤖 Starting Bot Invasion 2.0: Generating ${count} realistic clones...`);

        // 1. Fetch available gyms to assign homes
        const { data: gyms } = await supabase.from('gyms').select('id').limit(10);
        const gymIds = gyms?.map(g => g.id) || [];

        const bots = [];

        for (let i = 0; i < count; i++) {
            const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + `_${Math.floor(Math.random() * 100)}`;
            const xp = Math.floor(Math.random() * 25000); // 0 to 25k XP
            const id = crypto.randomUUID();
            const banner = Math.random() > 0.3 ? BANNERS[Math.floor(Math.random() * BANNERS.length)] : null;
            const homeGym = gymIds.length > 0 && Math.random() > 0.2 ? gymIds[Math.floor(Math.random() * gymIds.length)] : null;

            bots.push({
                id: id,
                username: name,
                avatar_url: getAvatar(name),
                xp: xp,
                checkins_count: Math.floor(Math.random() * 50),
                photos_count: Math.floor(Math.random() * 10),
                description: "AI Generated Gym Partner",
                home_gym_id: homeGym, // Assigning territory
                custom_settings: {
                    banner_url: banner
                },
                updated_at: new Date().toISOString()
            });
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .insert(bots)
                .select();

            if (error) {
                console.error("❌ Bot Invasion Failed:", error);
                if (error.code === '23503') {
                    alert("⚠️ Error: Strict FK Constraint on Auth Users.");
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
