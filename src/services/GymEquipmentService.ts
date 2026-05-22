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
    // --- PECHO (CHEST) - SUPERIOR ---
    { name: 'Press Inclinado (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Pecho', icon: '📐' },
    { name: 'Press Inclinado (Mancuernas)', category: 'FREE_WEIGHT', targetMuscle: 'Pecho', icon: '🏋️' },
    { name: 'Press Inclinado (Barra)', category: 'FREE_WEIGHT', targetMuscle: 'Pecho', icon: '🏋️‍♂️' },
    { name: 'Press Inclinado (Polea/Cable)', category: 'CABLE', targetMuscle: 'Pecho', icon: '⛓️' },
    { name: 'Smith Press Inclinado', category: 'STRENGTH_MACHINE', targetMuscle: 'Pecho', icon: '⚙️' },

    // --- PECHO (CHEST) - MEDIO/PLANO ---
    { name: 'Press Banca Plano (Barra)', category: 'FREE_WEIGHT', targetMuscle: 'Pecho', icon: '🏋️‍♂️' },
    { name: 'Press Banca Plano (Mancuernas)', category: 'FREE_WEIGHT', targetMuscle: 'Pecho', icon: '🏋️' },
    { name: 'Press de Pecho (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Pecho', icon: '🤖' },
    { name: 'Press Plano (Polea/Cable)', category: 'CABLE', targetMuscle: 'Pecho', icon: '⛓️' },
    { name: 'Smith Press Plano', category: 'STRENGTH_MACHINE', targetMuscle: 'Pecho', icon: '⚙️' },
    { name: 'Peck Deck (Mariposa)', category: 'STRENGTH_MACHINE', targetMuscle: 'Pecho', icon: '🦋' },
    { name: 'Cruce de Poleas (Crossover Alto)', category: 'CABLE', targetMuscle: 'Pecho', icon: '⚔️' },

    // --- PECHO (CHEST) - INFERIOR ---
    { name: 'Press Declinado (Barra)', category: 'FREE_WEIGHT', targetMuscle: 'Pecho', icon: '📉' },
    { name: 'Press Declinado (Mancuernas)', category: 'FREE_WEIGHT', targetMuscle: 'Pecho', icon: '📉' },
    { name: 'Press Declinado (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Pecho', icon: '🤖' },
    { name: 'Cruce de Poleas (Crossover Bajo)', category: 'CABLE', targetMuscle: 'Pecho', icon: '⚔️' },
    { name: 'Fondos (Dips)', category: 'ACCESSORY', targetMuscle: 'Pecho', icon: '🏗️' },
    { name: 'Fondos Asistidos (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Pecho', icon: '🤖' },

    // --- ESPALDA (BACK) - LATERAL/AMPLITUD ---
    { name: 'Jalón al Pecho (Polea Alta)', category: 'CABLE', targetMuscle: 'Espalda', icon: '🔻' },
    { name: 'Jalón al Pecho (Agarre Estrecho)', category: 'CABLE', targetMuscle: 'Espalda', icon: '🔻' },
    { name: 'Dominadas (Pullups)', category: 'ACCESSORY', targetMuscle: 'Espalda', icon: '🧗' },
    { name: 'Dominadas Asistidas (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Espalda', icon: '🤖' },
    { name: 'Pull-Over en Polea', category: 'CABLE', targetMuscle: 'Espalda', icon: '🎣' },

    // --- ESPALDA (BACK) - DENSIDAD/GROSOR ---
    { name: 'Remo con Barra (Pendlay/Yates)', category: 'FREE_WEIGHT', targetMuscle: 'Espalda', icon: '🚣' },
    { name: 'Remo con Mancuerna (Unilateral)', category: 'FREE_WEIGHT', targetMuscle: 'Espalda', icon: '👜' },
    { name: 'Remo Gironda (Polea Baja)', category: 'CABLE', targetMuscle: 'Espalda', icon: '🛶' },
    { name: 'Remo en Máquina (Pecho Apoyado)', category: 'STRENGTH_MACHINE', targetMuscle: 'Espalda', icon: '🚜' },
    { name: 'Remo en T (Barra/Máquina)', category: 'FREE_WEIGHT', targetMuscle: 'Espalda', icon: '⚓' },
    { name: 'Peso Muerto (Deadlift)', category: 'FREE_WEIGHT', targetMuscle: 'Espalda', icon: '🧟' },

    // --- HOMBRO (SHOULDERS) - ANTERIOR ---
    { name: 'Press Militar (Barra)', category: 'FREE_WEIGHT', targetMuscle: 'Hombro', icon: '💂' },
    { name: 'Press Militar (Mancuernas)', category: 'FREE_WEIGHT', targetMuscle: 'Hombro', icon: '🏋️' },
    { name: 'Press de Hombros (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Hombro', icon: '🤖' },
    { name: 'Elevaciones Frontales (Mancuernas)', category: 'FREE_WEIGHT', targetMuscle: 'Hombro', icon: '🧟‍♂️' },
    { name: 'Elevaciones Frontales (Polea)', category: 'CABLE', targetMuscle: 'Hombro', icon: '🧟‍♂️' },

    // --- HOMBRO (SHOULDERS) - LATERAL ---
    { name: 'Elevaciones Laterales (Mancuernas)', category: 'FREE_WEIGHT', targetMuscle: 'Hombro', icon: '🐦' },
    { name: 'Elevaciones Laterales (Polea)', category: 'CABLE', targetMuscle: 'Hombro', icon: '🐦' },
    { name: 'Elevaciones Laterales (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Hombro', icon: '🤖' },

    // --- HOMBRO (SHOULDERS) - POSTERIOR ---
    { name: 'Pájaros/Vuelos (Mancuernas)', category: 'FREE_WEIGHT', targetMuscle: 'Hombro', icon: '🦅' },
    { name: 'Face Pull', category: 'CABLE', targetMuscle: 'Hombro', icon: '🤡' },
    { name: 'Peck Deck Invertido', category: 'STRENGTH_MACHINE', targetMuscle: 'Hombro', icon: '🦋' },

    // --- PIERNA (LEGS) - CUÁDRICEPS ---
    { name: 'Sentadilla Libre (Barra)', category: 'FREE_WEIGHT', targetMuscle: 'Pierna', icon: '🍑' },
    { name: 'Sentadilla Frontal', category: 'FREE_WEIGHT', targetMuscle: 'Pierna', icon: '🏋️' },
    { name: 'Sentadilla Hack (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Pierna', icon: '🪑' },
    { name: 'Prensa de Piernas (45°)', category: 'STRENGTH_MACHINE', targetMuscle: 'Pierna', icon: '📐' },
    { name: 'Extensiones de Cuádriceps', category: 'STRENGTH_MACHINE', targetMuscle: 'Pierna', icon: '🦵' },
    { name: 'Zancadas/Lunges (Mancuernas/Barra)', category: 'FREE_WEIGHT', targetMuscle: 'Pierna', icon: '🚶' },
    { name: 'Sentadilla Bulgara', category: 'FREE_WEIGHT', targetMuscle: 'Pierna', icon: '🇧🇬' },

    // --- PIERNA (LEGS) - ISQUIOS/FEMORAL ---
    { name: 'Peso Muerto Rumano (Barra/Mancuernas)', category: 'FREE_WEIGHT', targetMuscle: 'Pierna', icon: '🎋' },
    { name: 'Curl Femoral Tumbado (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Pierna', icon: '🥓' },
    { name: 'Curl Femoral Sentado (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Pierna', icon: '🪑' },
    { name: 'Good Mornings (Buenos Días)', category: 'FREE_WEIGHT', targetMuscle: 'Pierna', icon: '🌞' },

    // --- PIERNA (LEGS) - GLÚTEOS ---
    { name: 'Hip Thrust (Barra)', category: 'FREE_WEIGHT', targetMuscle: 'Glúteos', icon: '🌉' },
    { name: 'Hip Thrust (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Glúteos', icon: '🌉' },
    { name: 'Patada de Glúteo (Polea)', category: 'CABLE', targetMuscle: 'Glúteos', icon: '🍑' },
    { name: 'Patada de Glúteo (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Glúteos', icon: '🍑' },

    // --- BÍCEPS (ARMS) ---
    { name: 'Curl con Barra (Recta/Z)', category: 'FREE_WEIGHT', targetMuscle: 'Bíceps', icon: '🥖' },
    { name: 'Curl con Mancuernas (Supino/Alterno)', category: 'FREE_WEIGHT', targetMuscle: 'Bíceps', icon: '🦾' },
    { name: 'Curl Martillo (Mancuernas)', category: 'FREE_WEIGHT', targetMuscle: 'Bíceps', icon: '🔨' },
    { name: 'Curl Predicador (Barra/Mancuerna)', category: 'FREE_WEIGHT', targetMuscle: 'Bíceps', icon: '🙏' },
    { name: 'Curl Predicador (Máquina)', category: 'STRENGTH_MACHINE', targetMuscle: 'Bíceps', icon: '🤖' },
    { name: 'Curl de Bíceps en Polea', category: 'CABLE', targetMuscle: 'Bíceps', icon: '🐍' },
    { name: 'Curl Araña (Spider Curl)', category: 'FREE_WEIGHT', targetMuscle: 'Bíceps', icon: '🕷️' },

    // --- TRÍCEPS (ARMS) ---
    { name: 'Extensiones de Tríceps (Polea/Cuerda)', category: 'CABLE', targetMuscle: 'Tríceps', icon: '🏇' },
    { name: 'Extensiones de Tríceps (Barra recta)', category: 'CABLE', targetMuscle: 'Tríceps', icon: '🦯' },
    { name: 'Press Francés (Barra Z/Mancuernas)', category: 'FREE_WEIGHT', targetMuscle: 'Tríceps', icon: '🇫🇷' },
    { name: 'Copa a una mano (Mancuerna)', category: 'FREE_WEIGHT', targetMuscle: 'Tríceps', icon: '🏆' },
    { name: 'Fondos en Paralelas/Bancos', category: 'ACCESSORY', targetMuscle: 'Tríceps', icon: '🛋️' },
    { name: 'Patada de Tríceps (Mancuerna)', category: 'FREE_WEIGHT', targetMuscle: 'Tríceps', icon: '🐴' },

    // --- ABDOMINALES (ABS) ---
    { name: 'Crunch Abdominal', category: 'ACCESSORY', targetMuscle: 'Abdominales', icon: '🥨' },
    { name: 'Elevación de Piernas (Colgado)', category: 'ACCESSORY', targetMuscle: 'Abdominales', icon: '🥒' },
    { name: 'Plancha (Plank)', category: 'ACCESSORY', targetMuscle: 'Abdominales', icon: '🪵' },
    { name: 'Rueda Abdominal', category: 'ACCESSORY', targetMuscle: 'Abdominales', icon: '🛞' },
    { name: 'Crunch en Máquina', category: 'STRENGTH_MACHINE', targetMuscle: 'Abdominales', icon: '🤖' },
    { name: 'Crunch en Polea Alta', category: 'CABLE', targetMuscle: 'Abdominales', icon: '🙇' },
    { name: 'Russian Twist', category: 'ACCESSORY', targetMuscle: 'Abdominales', icon: '🇷🇺' },

    // --- CARDIO ---
    { name: 'Cinta de Correr', category: 'CARDIO', targetMuscle: 'Cardio', icon: '🏃' },
    { name: 'Elíptica', category: 'CARDIO', targetMuscle: 'Cardio', icon: '⛷️' },
    { name: 'Bicicleta Estática', category: 'CARDIO', targetMuscle: 'Cardio', icon: '🚴' },
    { name: 'Remo (Concept2)', category: 'CARDIO', targetMuscle: 'Cardio', icon: '🚣' },
    { name: 'Escaladora (Stairmaster)', category: 'CARDIO', targetMuscle: 'Cardio', icon: '🧗' },
    { name: 'Salto de Cuerda', category: 'CARDIO', targetMuscle: 'Cardio', icon: '🪢' },
];

// ... (skipping seeds)

class GymEquipmentService {

    // Get inventory for a specific gym
    async getInventory(gymId: string): Promise<Equipment[]> {
        if (!gymId) return [];
        const { data, error } = await supabase
            .from('gym_equipment')
            .select('*')
            .eq('gym_id', gymId)
            .order('name');

        if (error) throw error;
        return data || [];
    }

    // Get personal inventory (gym_id is null, verified_by user)
    async getPersonalInventory(userId: string): Promise<Equipment[]> {
        const { data, error } = await supabase
            .from('gym_equipment')
            .select('*')
            .is('gym_id', null)
            .eq('verified_by', userId)
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
