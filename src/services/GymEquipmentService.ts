import { supabase } from '../lib/supabase';
import { CATALOG_DATA } from '../data/catalogData';
import { SEED_ALIASES } from '../data/exerciseCatalog';

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

// ── Auto-generated from CATALOG_DATA ─────────────────────────────────────────
// To add an exercise: add image to public/ejercicioimg/ejercicios/ + run `npm run catalog`

type SeedEntry = {
    name: string;
    category: string;
    targetMuscle: string;
    icon: string;
    image_url: string;
    metrics: { weight: boolean; reps: boolean; time: boolean; distance: boolean; rpe: boolean };
};

function _deriveCat(label: string, muscle: string): string {
    if (muscle === 'CARDIO') return 'CARDIO';
    const l = label.toLowerCase();
    if (l.includes('máquina') || l.includes('maquina') || l.includes('asistid') || l.includes('smith')) return 'STRENGTH_MACHINE';
    if (l.includes('polea') || l.includes('cable') || l.includes('cuerda') || l.includes('cross')) return 'CABLE';
    return 'FREE_WEIGHT';
}

const _MUSCLE_LABEL: Record<string, string> = {
    'ABDOMINALES': 'Abdominales', 'ANTEBRAZO': 'Antebrazo', 'BÍCEPS': 'Bíceps',
    'CARDIO': 'Cardio', 'CUELLO': 'Cuello', 'ESPALDA': 'Espalda',
    'PANTORRILLAS': 'Pantorrillas', 'GLÚTEOS': 'Glúteos', 'HOMBRO': 'Hombro',
    'ISQUIOTIBIALES': 'Isquiotibiales', 'PECHO': 'Pecho',
    'CUÁDRICEPS': 'Cuádriceps', 'TRÍCEPS': 'Tríceps',
};

const _primarySeeds: SeedEntry[] = CATALOG_DATA.flatMap(ex =>
    ex.variants
        .filter(v => !v.isLocked)
        .map(v => ({
            name:         v.seedName,
            category:     _deriveCat(v.label, ex.muscle),
            targetMuscle: _MUSCLE_LABEL[ex.muscle] ?? ex.muscle,
            icon:         ex.icon,
            image_url:    v.imagePath,
            metrics:      ex.metrics,
        }))
);

const _seedByName = new Map(_primarySeeds.map(e => [e.name, e]));
const _aliasSeeds: SeedEntry[] = Object.entries(SEED_ALIASES).flatMap(([oldName, newName]) => {
    const base = _seedByName.get(newName);
    if (!base || _seedByName.has(oldName)) return [];
    return [{ ...base, name: oldName }];
});

export const COMMON_EQUIPMENT_SEEDS: SeedEntry[] = [..._primarySeeds, ..._aliasSeeds];

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

    // Update user custom settings (merges into existing custom_settings to avoid wiping other keys)
    async updateUserSettings(userId: string, settings: CustomSettings): Promise<void> {
        const { data: current, error: fetchError } = await supabase
            .from('profiles')
            .select('custom_settings')
            .eq('id', userId)
            .single();

        if (fetchError) throw fetchError;

        const merged = {
            ...(current?.custom_settings || {}),
            categories: settings.categories,
            metrics: settings.metrics,
        };

        const { error } = await supabase
            .from('profiles')
            .update({ custom_settings: merged })
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
