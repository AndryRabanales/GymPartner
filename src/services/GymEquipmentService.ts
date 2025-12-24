import { supabase } from '../lib/supabase';

export interface Equipment {
    id: string;
    gym_id?: string | null;
    name: string;
    category: string; // Changed from strict union to allow custom categories
    quantity: number;
    condition: 'GOOD' | 'FAIR' | 'POOR' | 'BROKEN';
    notes?: string;
    image_url?: string;
    icon?: string; // Specific emoji for this item
    verified_by?: string;
    metrics?: Record<string, boolean>;
    target_muscle_group?: string; // Critical for Radar Stats
}

export const EQUIPMENT_CATEGORIES = {
    // Existing Equipment Categories
    CARDIO: { label: 'Cardio', icon: '🏃' },
    STRENGTH_MACHINE: { label: 'Máquinas', icon: '⚙️' },
    FREE_WEIGHT: { label: 'Peso Libre', icon: '🏋️' },
    CABLE: { label: 'Poleas / Cables', icon: '⛓️' },
    ACCESSORY: { label: 'Accesorios', icon: '🧘' },

    // Default Muscle/Target Categories
    CHEST: { label: 'Pecho', icon: '🦍' },
    BACK: { label: 'Espalda', icon: '🦅' },
    LEGS: { label: 'Pierna', icon: '🦵' },
    SHOULDERS: { label: 'Hombro', icon: '🥥' },
    ARMS: { label: 'Brazos', icon: '💪' },
    ABS: { label: 'Abdominales', icon: '🍫' },
    CALVES: { label: 'Pantorrillas', icon: '🦵' },
    FOREARMS: { label: 'Antebrazos', icon: '🪵' },
    GLUTES: { label: 'Glúteos', icon: '🍑' }
};

export interface CustomCategory {
    id: string; // usually the label normalized
    label: string;
    icon: string;
}

export interface CustomMetric {
    id: string;
    label: string;
    icon: string;
    default_active: boolean;
}

export interface CustomSettings {
    categories: CustomCategory[];
    metrics: CustomMetric[];
}

export const COMMON_EQUIPMENT_SEEDS = [
    // --- PECHO (CHEST) ---
    // --- PECHO (CHEST) ---
    { name: 'Press Banca Plano (Barra)', category: 'FREE_WEIGHT', targetMuscle: 'Pecho', icon: '🏋️‍♂️' },
    { name: 'Press Banca Inclinado (Mancuernas)', category: 'FREE_WEIGHT', targetMuscle: 'Pecho', icon: '📐' },
    { name: 'Press Banca Declinado', category: 'FREE_WEIGHT', targetMuscle: 'Pecho', icon: '📉' },
    { name: 'Peck Deck (Mariposa)', category: 'STRENGTH_MACHINE', targetMuscle: 'Pecho', icon: '🦋' },
    { name: 'Cruce de Poleas (Crossover)', category: 'CABLE', targetMuscle: 'Pecho', icon: '⚔️' },
    { name: 'Press de Pecho en Máquina', category: 'STRENGTH_MACHINE', targetMuscle: 'Pecho', icon: '🤖' },
    { name: 'Fondos (Dips)', category: 'ACCESSORY', targetMuscle: 'Pecho', icon: '🏗️' },
    { name: 'Flexiones (Pushups)', category: 'ACCESSORY', targetMuscle: 'Pecho', icon: '🆙' },

    // --- ESPALDA (BACK) ---
    // --- ESPALDA (BACK) ---
    { name: 'Jalón al Pecho (Polea Alta)', category: 'CABLE', targetMuscle: 'Espalda', icon: '🔻' },
    { name: 'Remo con Barra', category: 'FREE_WEIGHT', targetMuscle: 'Espalda', icon: '🚣' },
    { name: 'Remo Gironda (Polea Baja)', category: 'CABLE', targetMuscle: 'Espalda', icon: '🛶' },
    { name: 'Dominadas (Pullups)', category: 'ACCESSORY', targetMuscle: 'Espalda', icon: '🧗' },
    { name: 'Remo con Mancuerna (Unilateral)', category: 'FREE_WEIGHT', targetMuscle: 'Espalda', icon: '👜' },
    { name: 'Pull-Over en Polea', category: 'CABLE', targetMuscle: 'Espalda', icon: '🎣' },
    { name: 'Remo en Máquina (Asistido)', category: 'STRENGTH_MACHINE', targetMuscle: 'Espalda', icon: '🚜' },
    { name: 'Peso Muerto (Deadlift)', category: 'FREE_WEIGHT', targetMuscle: 'Espalda', icon: '🧟' },

    // --- PIERNA (LEGS) ---
    // --- PIERNA (LEGS) ---
    { name: 'Sentadilla Libre (Barra)', category: 'FREE_WEIGHT', targetMuscle: 'Pierna', icon: '🍑' },
    { name: 'Prensa de Piernas (45°)', category: 'STRENGTH_MACHINE', targetMuscle: 'Pierna', icon: '📐' },
    { name: 'Hack Squat', category: 'STRENGTH_MACHINE', targetMuscle: 'Pierna', icon: '🪑' },
    { name: 'Extensiones de Cuádriceps', category: 'STRENGTH_MACHINE', targetMuscle: 'Pierna', icon: '🦵' },
    { name: 'Curl Femoral Tumbado', category: 'STRENGTH_MACHINE', targetMuscle: 'Pierna', icon: '🥓' }, // Hamstring
    { name: 'Zancadas (Lunges)', category: 'FREE_WEIGHT', targetMuscle: 'Pierna', icon: '🚶' },
    { name: 'Peso Muerto Rumano', category: 'FREE_WEIGHT', targetMuscle: 'Pierna', icon: '🎋' }, // Bamboo (stiff)
    { name: 'Elevación de Talones (Pantorrilla)', category: 'STRENGTH_MACHINE', targetMuscle: 'Pantorrillas', icon: '👠' },
    { name: 'Hip Thrust (Puente de Glúteo)', category: 'FREE_WEIGHT', targetMuscle: 'Glúteos', icon: '🌉' },

    // --- HOMBRO (SHOULDERS) ---
    // --- HOMBRO (SHOULDERS) ---
    { name: 'Press Militar (Barra)', category: 'FREE_WEIGHT', targetMuscle: 'Hombro', icon: '💂' },
    { name: 'Press Militar con Mancuernas', category: 'FREE_WEIGHT', targetMuscle: 'Hombro', icon: '🏋️' },
    { name: 'Elevaciones Laterales', category: 'FREE_WEIGHT', targetMuscle: 'Hombro', icon: '🐦' }, // Bird/Fly
    { name: 'Elevaciones Frontales', category: 'FREE_WEIGHT', targetMuscle: 'Hombro', icon: '🧟‍♂️' }, // Zombie walk
    { name: 'Press Arnold', category: 'FREE_WEIGHT', targetMuscle: 'Hombro', icon: '💪' },
    { name: 'Pájaros (Posterior)', category: 'FREE_WEIGHT', targetMuscle: 'Hombro', icon: '🦅' },
    { name: 'Face Pull', category: 'CABLE', targetMuscle: 'Hombro', icon: '🤡' },

    // --- BÍCEPS (ARMS) ---
    { name: 'Curl con Barra (Recta/Z)', category: 'FREE_WEIGHT', targetMuscle: 'Bíceps', icon: '🥖' }, // Bar
    { name: 'Curl con Mancuernas (Alterno)', category: 'FREE_WEIGHT', targetMuscle: 'Bíceps', icon: '🦾' },
    { name: 'Curl Martillo', category: 'FREE_WEIGHT', targetMuscle: 'Bíceps', icon: '🔨' },
    { name: 'Curl Predicador (Banco Scott)', category: 'FREE_WEIGHT', targetMuscle: 'Bíceps', icon: '🙏' },
    { name: 'Curl de Bíceps en Polea', category: 'CABLE', targetMuscle: 'Bíceps', icon: '🐍' },

    // --- TRÍCEPS (ARMS) ---
    { name: 'Extensiones de Tríceps en Polea', category: 'CABLE', targetMuscle: 'Tríceps', icon: '🏇' }, // Reins
    { name: 'Press Francés', category: 'FREE_WEIGHT', targetMuscle: 'Tríceps', icon: '🇫🇷' },
    { name: 'Fondos en Bancos', category: 'ACCESSORY', targetMuscle: 'Tríceps', icon: '🛋️' },
    { name: 'Patada de Tríceps (Mancuerna)', category: 'FREE_WEIGHT', targetMuscle: 'Tríceps', icon: '🐴' },
    { name: 'Extensiones sobre la cabeza', category: 'FREE_WEIGHT', targetMuscle: 'Tríceps', icon: '🙆' },

    // --- ABDOMINALES (ABS) ---
    { name: 'Crunch Abdominal', category: 'ACCESSORY', targetMuscle: 'Abdominales', icon: '🥨' },
    { name: 'Elevación de Piernas', category: 'ACCESSORY', targetMuscle: 'Abdominales', icon: '🥒' },
    { name: 'Plancha (Plank)', category: 'ACCESSORY', targetMuscle: 'Abdominales', icon: '🪵' },
    { name: 'Rueda Abdominal', category: 'ACCESSORY', targetMuscle: 'Abdominales', icon: '🛞' },
    { name: 'Russian Twist', category: 'ACCESSORY', targetMuscle: 'Abdominales', icon: '🇷🇺' },

    // --- CARDIO ---
    { name: 'Cinta de Correr', category: 'CARDIO', targetMuscle: 'Cardio' },
    { name: 'Elíptica', category: 'CARDIO', targetMuscle: 'Cardio' },
    { name: 'Bicicleta Estática', category: 'CARDIO', targetMuscle: 'Cardio' },
    { name: 'Remo (Concept2)', category: 'CARDIO', targetMuscle: 'Cardio' },
    { name: 'Escaladora (Stairmaster)', category: 'CARDIO', targetMuscle: 'Cardio' },
];

// ... (skipping seeds)

class GymEquipmentService {

    // Get inventory for a specific gym
    async getInventory(gymId: string): Promise<Equipment[]> {
        const { data, error } = await supabase
            .from('gym_equipment')
            .select('*')
            .eq('gym_id', gymId)
            .order('name');

        if (error) throw error;
        return data || [];
    }

    // Add a new piece of equipment (Crowdsourced)
    async addEquipment(equipment: Partial<Equipment>, userId: string): Promise<Equipment> {
        const { data, error } = await supabase
            .from('gym_equipment')
            .insert({
                ...equipment,
                verified_by: userId,
                condition: 'GOOD', // Default
                quantity: 1,
                // Ensure metrics has a default if not provided
                metrics: equipment.metrics || { weight: true, reps: true, time: false, distance: false, rpe: false }
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Get user custom settings
    async getUserSettings(userId: string): Promise<CustomSettings> {
        const { data, error } = await supabase
            .from('profiles')
            .select('custom_settings')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching custom settings:', error);
            // Return empty structure on error to prevent UI crashes
            return { categories: [], metrics: [] };
        }

        const settings = data?.custom_settings || {};
        return {
            categories: settings.categories || [],
            metrics: settings.metrics || []
        };
    }

    // Update user custom settings
    async updateUserSettings(userId: string, settings: CustomSettings): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({ custom_settings: settings })
            .eq('id', userId);

        if (error) throw error;
    }

    // Update equipment condition/details
    async updateStatus(equipmentId: string, condition: string, notes: string): Promise<void> {
        const { error } = await supabase
            .from('gym_equipment')
            .update({ condition, notes }) // Note: In a real app we might want a separate log table for this
            .eq('id', equipmentId);

        if (error) throw error;
    }

    // Update full equipment details (Name, Category, Metrics)
    async updateEquipment(equipmentId: string, updates: Partial<Equipment>): Promise<void> {
        const { error } = await supabase
            .from('gym_equipment')
            .update(updates)
            .eq('id', equipmentId);

        if (error) throw error;
    }
}

export const equipmentService = new GymEquipmentService();
