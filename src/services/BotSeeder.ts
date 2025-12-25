import { supabase } from '../lib/supabase';

// Mexican Names Pool (No numbers, purely realistic)
const FIRST_NAMES = [
    "Santiago", "Mateo", "Sebastián", "Leonardo", "Matías", "Emiliano", "Diego", "Daniel", "Miguel Ángel", "Alejandro",
    "Jesús", "Gael", "Tadeo", "Antonio", "Eduardo", "Isaac", "Javier", "Carlos", "Fernando", "Ricardo",
    "Sofía", "Valentina", "Regina", "María José", "Ximena", "Camila", "María Fernanda", "Victoria", "Renata", "Natalia",
    "Daniela", "Valeria", "Fernanda", "Andrea", "Ana Paula", "Melanie", "Romina", "Mariana", "Laura", "Gabriela"
];

const LAST_NAMES = [
    "Hernández", "García", "Martínez", "López", "González", "Pérez", "Rodríguez", "Sánchez", "Ramírez", "Cruz",
    "Flores", "Gómez", "Morales", "Vázquez", "Jiménez", "Reyes", "Díaz", "Torres", "Gutiérrez", "Ruiz",
    "Mendoza", "Aguilar", "Ortiz", "Moreno", "Castillo", "Romero", "Álvarez", "Méndez", "Chávez", "Rivera",
    "Juárez", "Ramos", "Domínguez", "Herrera", "Medina", "Castro", "Vargas", "Guzmán", "Velázquez", "Rojas"
];

const getAvatar = (name: string) => `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&size=128`;

// Abstract / Cartoon / Gradient / Texture Banners (No people)
const ABSTRACT_BANNERS = [
    // Gradients & Neon
    "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1415&auto=format&fit=crop", // Gradient Blue/Purple
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1470&auto=format&fit=crop", // Neon Fluid
    "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=1374&auto=format&fit=crop", // Abstract Lines
    "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=1470&auto=format&fit=crop", // Abstract Paint
    "https://images.unsplash.com/photo-1550684847-75bdda21cc95?q=80&w=1374&auto=format&fit=crop", // Dark Fluid

    // Geometric & Forms
    "https://images.unsplash.com/photo-1550100136-e074fa714874?q=80&w=1470&auto=format&fit=crop", // Black Geometric
    "https://images.unsplash.com/photo-1497290756760-23ac55edf0d6?q=80&w=1374&auto=format&fit=crop", // Pink Minimal
    "https://images.unsplash.com/photo-1507090960745-b32f65d3113a?q=80&w=1470&auto=format&fit=crop", // Blue Circles
    "https://images.unsplash.com/photo-1554189097-ffe88e998a2b?q=80&w=1374&auto=format&fit=crop", // Abstract Geometric

    // Anime / Cyber / Art Style
    "https://images.unsplash.com/photo-1534972195531-d756b9bfa9f2?q=80&w=1470&auto=format&fit=crop", // Cyberpunk Building
    "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1374&auto=format&fit=crop", // Purple Gradient
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1364&auto=format&fit=crop", // Abstract Fluid Art
    "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=1470&auto=format&fit=crop", // Pink Liquid
    "https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?q=80&w=1376&auto=format&fit=crop", // Dark Mesh

    // Textures
    "https://images.unsplash.com/photo-1618588507085-c79565432917?q=80&w=1374&auto=format&fit=crop", // Holo
    "https://images.unsplash.com/photo-1558470598-a5dda9640f6b?q=80&w=1471&auto=format&fit=crop", // Colorful Powder
    "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=1470&auto=format&fit=crop", // Neon Lights
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1470&auto=format&fit=crop"  // Glitter/Dark
];

const GYM_NAMES = ["Smart Fit", "Sports World", "Anytime Fitness", "Gimnasio Municipal", "Zona Fitness", "Iron Gym", "Spartan Gym", "Fit Center", "Body Tech", "Hércules Gym"];

// CACHE KEY for Persistence
const CACHE_KEY = 'gym_partner_mock_bots_v3_static';

export const BotSeeder = {
    /**
     * Generates a list of mock profiles in memory (for UI fallback)
     * PERSISTENT: Caches results to localStorage so they don't change on reload.
     */
    generateMockProfiles(count: number = 50) {
        // 1. Try Load from Cache
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length >= count) {
                    console.log("✅ Loaded Cached Bots (Static)", parsed.length);
                    return parsed.slice(0, count);
                }
            } catch (e) {
                console.warn('Cache invalid, regenerating bots...');
            }
        }

        // 2. Generate New
        const bots = [];

        // Shuffle banners to ensure uniqueness
        let availableBanners = [...ABSTRACT_BANNERS].sort(() => 0.5 - Math.random());

        for (let i = 0; i < count; i++) {
            const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
            const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
            const name = `${firstName} ${lastName}`;

            // Strict XP: 100, 200, 300, 400, 500
            const xpOptions = [100, 200, 300, 400, 500];
            const xp = xpOptions[Math.floor(Math.random() * xpOptions.length)];

            const id = crypto.randomUUID();

            // Unique & Optional Banners (Mostly Abstract/Colors)
            let banner = null;
            // 70% chance to have a banner, BUT only if we have unique ones left
            if (availableBanners.length > 0 && Math.random() < 0.7) {
                banner = availableBanners.pop();
            }

            const gymName = GYM_NAMES[Math.floor(Math.random() * GYM_NAMES.length)];

            bots.push({
                id: id,
                username: name,
                avatar_url: getAvatar(firstName),
                xp: xp,
                checkins_count: Math.floor(Math.random() * 20),
                photos_count: Math.floor(Math.random() * 5),
                description: "Entrenando duro",
                home_gym: { name: gymName },
                custom_settings: {
                    banner_url: banner
                },
                is_bot: true
            });
        }

        // 3. Save to Cache
        localStorage.setItem(CACHE_KEY, JSON.stringify(bots));
        return bots;
    },

    async seedBots(count: number = 50) {
        // DB Injection logic (kept for fallback/admin usage)
        console.log(`🤖 Starting Abstract Bot Invasion...`);
        const { data: gyms } = await supabase.from('gyms').select('id').limit(10);
        const gymIds = gyms?.map(g => g.id) || [];

        let shuffledBanners = [...ABSTRACT_BANNERS].sort(() => 0.5 - Math.random());

        const bots = [];

        for (let i = 0; i < count; i++) {
            const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
            const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
            const name = `${firstName} ${lastName}`;

            const xpOptions = [100, 200, 300, 400, 500];
            const xp = xpOptions[Math.floor(Math.random() * xpOptions.length)];
            const id = crypto.randomUUID();

            let banner = null;
            if (shuffledBanners.length > 0 && Math.random() < 0.7) {
                banner = shuffledBanners.pop();
            }

            const homeGym = gymIds.length > 0 ? gymIds[Math.floor(Math.random() * gymIds.length)] : null;

            bots.push({
                id: id,
                username: name,
                avatar_url: getAvatar(firstName),
                xp: xp,
                checkins_count: 0,
                photos_count: 0,
                description: "AI Gym Partner",
                home_gym_id: homeGym,
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
            if (error) console.error("Seeding Error:", error);
        } catch (e) { console.error(e) }
    }
};
