import { supabase } from '../lib/supabase';
import { IMAGE_MANIFEST } from '../data/imageManifest';

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
    {
        "name": "Abdominales Inversos",
        "category": "ACCESSORY",
        "targetMuscle": "Abdominales",
        "icon": "🥨",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/Inversos/Inversos.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Russian Twist",
        "category": "ACCESSORY",
        "targetMuscle": "Abdominales",
        "icon": "🇷🇺",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/Russian Twist.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Crunch Abdominal",
        "category": "ACCESSORY",
        "targetMuscle": "Abdominales",
        "icon": "🥨",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/Crunch/Estandar.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Crunch en Máquina",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Abdominales",
        "icon": "🤖",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/Crunch/Maquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Crunch en Polea Alta",
        "category": "CABLE",
        "targetMuscle": "Abdominales",
        "icon": "🙇",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/Crunch/Polea Alta.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Elevación de Piernas (Colgado)",
        "category": "ACCESSORY",
        "targetMuscle": "Abdominales",
        "icon": "🥒",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/Elevacion Piernas Colgado.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Plancha (Plank)",
        "category": "ACCESSORY",
        "targetMuscle": "Abdominales",
        "icon": "🪵",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/plancha/Estatica.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Curl Martillo (Polea/Cuerda)",
        "category": "CABLE",
        "targetMuscle": "Bíceps",
        "icon": "⛓️",
        "image_url": "/ejercicioimg/ejercicios/Biceps/Martillo/Cuerda.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Curl Martillo (Mancuernas)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Bíceps",
        "icon": "🔨",
        "image_url": "/ejercicioimg/ejercicios/Biceps/Martillo/Mancuernas.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Curl de Bíceps (Mancuernas)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Bíceps",
        "icon": "💪",
        "image_url": "/ejercicioimg/ejercicios/Biceps/CurlNormal/Mancuernas.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Curl de Bíceps con Barra",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Bíceps",
        "icon": "🥖",
        "image_url": "/ejercicioimg/ejercicios/Biceps/CurlNormal/Barra.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Curl de Bíceps Bayoneta",
        "category": "CABLE",
        "targetMuscle": "Bíceps",
        "icon": "💪",
        "image_url": "/ejercicioimg/ejercicios/Biceps/Curl Biceps Bayoneta.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Curl de Bíceps en Polea",
        "category": "CABLE",
        "targetMuscle": "Bíceps",
        "icon": "🐍",
        "image_url": "/ejercicioimg/ejercicios/Biceps/CurlNormal/Polea Alta.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Curl Predicador (Barra)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Bíceps",
        "icon": "🙏",
        "image_url": "/ejercicioimg/ejercicios/Biceps/Predicador/Barra.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Curl Predicador (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Bíceps",
        "icon": "🤖",
        "image_url": "/ejercicioimg/ejercicios/Biceps/Predicador/Maquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Curl Araña (Spider Curl)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Bíceps",
        "icon": "🕷️",
        "image_url": "/ejercicioimg/ejercicios/Biceps/Curl Spider.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Bicicleta Estática",
        "category": "CARDIO",
        "targetMuscle": "Cardio",
        "icon": "🚴",
        "image_url": "/ejercicioimg/ejercicios/Cardio/Caminadoras/Bicicleta.png",
        "metrics": {
            "weight": false,
            "reps": false,
            "time": true,
            "distance": true,
            "rpe": false
        }
    },
    {
        "name": "Elíptica",
        "category": "CARDIO",
        "targetMuscle": "Cardio",
        "icon": "⛷️",
        "image_url": "/ejercicioimg/ejercicios/Cardio/Caminadoras/Eliptica.png",
        "metrics": {
            "weight": false,
            "reps": false,
            "time": true,
            "distance": true,
            "rpe": false
        }
    },
    {
        "name": "Cinta de Correr",
        "category": "CARDIO",
        "targetMuscle": "Cardio",
        "icon": "🏃",
        "image_url": "/ejercicioimg/ejercicios/Cardio/Caminadoras/Cinta.png",
        "metrics": {
            "weight": false,
            "reps": false,
            "time": true,
            "distance": true,
            "rpe": false
        }
    },
    {
        "name": "Escaladora (Stairmaster)",
        "category": "CARDIO",
        "targetMuscle": "Cardio",
        "icon": "🧗",
        "image_url": "/ejercicioimg/ejercicios/Cardio/Caminadoras/Escaladora.png",
        "metrics": {
            "weight": false,
            "reps": false,
            "time": true,
            "distance": true,
            "rpe": false
        }
    },
    {
        "name": "Remo (Concept2)",
        "category": "CARDIO",
        "targetMuscle": "Cardio",
        "icon": "🚣",
        "image_url": "/ejercicioimg/ejercicios/Cardio/Remo Concept2.png",
        "metrics": {
            "weight": false,
            "reps": false,
            "time": true,
            "distance": true,
            "rpe": false
        }
    },
    {
        "name": "Salto de Cuerda",
        "category": "CARDIO",
        "targetMuscle": "Cardio",
        "icon": "🪢",
        "image_url": "/ejercicioimg/ejercicios/Cardio/Saltar Cuerda.png",
        "metrics": {
            "weight": false,
            "reps": false,
            "time": true,
            "distance": true,
            "rpe": false
        }
    },
    {
        "name": "Dominadas Asistidas (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Espalda",
        "icon": "🤖",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Dominadas/Asistida.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Dominadas (Pullups)",
        "category": "ACCESSORY",
        "targetMuscle": "Espalda",
        "icon": "🧗",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Dominadas/Libre.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Jalón al Pecho (Agarre Estrecho)",
        "category": "CABLE",
        "targetMuscle": "Espalda",
        "icon": "🔻",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Jalon/Agarre Estrecho.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Jalón al Pecho (Polea Alta)",
        "category": "CABLE",
        "targetMuscle": "Espalda",
        "icon": "🔻",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Jalon/Polea Alta.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Peso Muerto (Deadlift)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Espalda",
        "icon": "🧟",
        "image_url": "/ejercicioimg/ejercicios/Isquiotibiales/Peso Muerto/Convencional.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Pull-Over en Polea",
        "category": "CABLE",
        "targetMuscle": "Espalda",
        "icon": "🎣",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Pull Over Polea.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Remo con Barra Pendlay",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Espalda",
        "icon": "🚣",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Remo/Barra Pendlay.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Remo con Barra Yates",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Espalda",
        "icon": "🚣",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Remo/Barra Yates.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Remo con Mancuerna (Unilateral)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Espalda",
        "icon": "👜",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Remo/Mancuerna.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Remo en Máquina (Pecho Apoyado)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Espalda",
        "icon": "🚜",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Remo sentado/Pecho Apoyado.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Remo en T (Barra/Máquina)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Espalda",
        "icon": "⚓",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Remo/T-Barra.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Remo Gironda (Polea Baja)",
        "category": "CABLE",
        "targetMuscle": "Espalda",
        "icon": "🛶",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Remo sentado/Gironda.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Hip Thrust (Barra Libre)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Glúteos",
        "icon": "🌉",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/HipTrust/Barra.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Hip Thrust (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Glúteos",
        "icon": "🌉",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/HipTrust/Maquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Hip Thrust en Smith",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Glúteos",
        "icon": "⚙️",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/HipTrust/Smith.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Patada de Glúteo (Polea)",
        "category": "CABLE",
        "targetMuscle": "Glúteos",
        "icon": "🍑",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Patada/Polea.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Patada de Glúteo (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Glúteos",
        "icon": "🍑",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Patada/Maquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Elevaciones Frontales (Mancuernas)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Hombro",
        "icon": "🧟‍♂️",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Elevacion frontal/Mancuernas.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Elevaciones Frontales (Polea)",
        "category": "CABLE",
        "targetMuscle": "Hombro",
        "icon": "🧟‍♂️",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Elevacion frontal/Polea.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Elevaciones Laterales (Mancuernas)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Hombro",
        "icon": "🐦",
        "image_url": "/ejercicioimg/ejercicios/Hombro/elevacion lateral/Mancuernas.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Elevaciones Laterales (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Hombro",
        "icon": "🤖",
        "image_url": "/ejercicioimg/ejercicios/Hombro/elevacion lateral/Maquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Elevaciones Laterales (Polea)",
        "category": "CABLE",
        "targetMuscle": "Hombro",
        "icon": "🐦",
        "image_url": "/ejercicioimg/ejercicios/Hombro/elevacion lateral/Polea.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Face Pull",
        "category": "CABLE",
        "targetMuscle": "Hombro",
        "icon": "🤡",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Face Pull.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Peck Deck Invertido",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Hombro",
        "icon": "🦋",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Peck Deck Invertido.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press de Hombros (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Hombro",
        "icon": "🤖",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Militar/Maquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Militar (Barra)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Hombro",
        "icon": "💂",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Militar/Barra.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Militar (Mancuernas)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Hombro",
        "icon": "🏋️",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Militar/Mancuernas.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Pájaros / Vuelos (Mancuernas)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Hombro",
        "icon": "🦅",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Pajaros Vuelos Mancuernas.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Crossover en Polea Baja",
        "category": "CABLE",
        "targetMuscle": "Pecho",
        "icon": "⚔️",
        "image_url": "/ejercicioimg/ejercicios/pecho/Crude de polea/Polea Baja.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Cruce de Poleas (Crossover Alto)",
        "category": "CABLE",
        "targetMuscle": "Pecho",
        "icon": "⚔️",
        "image_url": "/ejercicioimg/ejercicios/pecho/Crude de polea/Polea Alta.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Peck Deck (Mariposa)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pecho",
        "icon": "🦋",
        "image_url": "/ejercicioimg/ejercicios/pecho/Peck Deck Mariposa.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Fondos (Dips)",
        "category": "ACCESSORY",
        "targetMuscle": "Pecho",
        "icon": "🏗️",
        "image_url": "/ejercicioimg/ejercicios/pecho/Fondos pecho/Libre.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Fondos Asistidos (Pecho)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pecho",
        "icon": "🤖",
        "image_url": "/ejercicioimg/ejercicios/pecho/Fondos pecho/Asistido Maquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Banca Plano (Barra)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pecho",
        "icon": "🏋️‍♂️",
        "image_url": "/ejercicioimg/ejercicios/pecho/Plano/Barra.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Banca Plano (Mancuernas)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pecho",
        "icon": "🏋️",
        "image_url": "/ejercicioimg/ejercicios/pecho/Plano/Mancuernas.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Declinado (Barra)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pecho",
        "icon": "📉",
        "image_url": "/ejercicioimg/ejercicios/pecho/Declinado/Barra.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Declinado (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pecho",
        "icon": "🤖",
        "image_url": "/ejercicioimg/ejercicios/pecho/Declinado/PressDeclinadoEnMaquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Declinado (Mancuernas)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pecho",
        "icon": "📉",
        "image_url": "/ejercicioimg/ejercicios/pecho/Declinado/Mancuernas.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Inclinado (Barra)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pecho",
        "icon": "🏋️‍♂️",
        "image_url": "/ejercicioimg/ejercicios/pecho/Inclinado/Barra.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Inclinado (Mancuernas)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pecho",
        "icon": "🏋️",
        "image_url": "/ejercicioimg/ejercicios/pecho/Inclinado/Mancuernas.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Inclinado (Polea/Cable)",
        "category": "CABLE",
        "targetMuscle": "Pecho",
        "icon": "⛓️",
        "image_url": "/ejercicioimg/ejercicios/pecho/Inclinado/Maquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Inclinado (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pecho",
        "icon": "📐",
        "image_url": "/ejercicioimg/ejercicios/pecho/Inclinado/Maquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Smith Press Inclinado",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pecho",
        "icon": "⚙️",
        "image_url": "/ejercicioimg/ejercicios/pecho/Inclinado/Smith.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press de Pecho (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pecho",
        "icon": "🤖",
        "image_url": "/ejercicioimg/ejercicios/pecho/Plano/Maquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Plano (Polea/Cable)",
        "category": "CABLE",
        "targetMuscle": "Pecho",
        "icon": "⛓️",
        "image_url": "/ejercicioimg/ejercicios/pecho/Plano/Maquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Smith Press Plano",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pecho",
        "icon": "⚙️",
        "image_url": "/ejercicioimg/ejercicios/pecho/Plano/Smith.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Curl Femoral Sentado (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pierna",
        "icon": "🪑",
        "image_url": "/ejercicioimg/ejercicios/Isquiotibiales/Curl Femoral Sentado.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Curl Femoral Tumbado (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pierna",
        "icon": "🥓",
        "image_url": "/ejercicioimg/ejercicios/Isquiotibiales/Curl Femoral Tumbado.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Extensiones de Cuádriceps",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pierna",
        "icon": "🦵",
        "image_url": "/ejercicioimg/ejercicios/Pierna/Extensiones Cuadriceps.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Good Mornings (Buenos Días)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pierna",
        "icon": "🌞",
        "image_url": "/ejercicioimg/ejercicios/Pierna/Buenos Dias.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Peso Muerto Rumano (Barra)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pierna",
        "icon": "🎋",
        "image_url": "/ejercicioimg/ejercicios/Isquiotibiales/Peso Muerto/Convencional.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Peso Muerto Rumano (Mancuernas)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pierna",
        "icon": "🎋",
        "image_url": "/ejercicioimg/ejercicios/Isquiotibiales/Peso Muerto/Convencional.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Prensa de Piernas (45°)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pierna",
        "icon": "📐",
        "image_url": "/ejercicioimg/ejercicios/Pierna/Prensa Piernas 45.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Sentadilla Búlgara",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pierna",
        "icon": "🇧🇬",
        "image_url": "/ejercicioimg/ejercicios/Pierna/Zancadas/Bulgara.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Sentadilla Frontal",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pierna",
        "icon": "🏋️",
        "image_url": "/ejercicioimg/ejercicios/Pierna/Sentadilla/Frontal.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Sentadilla Hack (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pierna",
        "icon": "🪑",
        "image_url": "/ejercicioimg/ejercicios/Pierna/Sentadilla/Hack Maquina.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Sentadilla Libre (Barra)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pierna",
        "icon": "🍑",
        "image_url": "/ejercicioimg/ejercicios/Pierna/Sentadilla/Barra Trasera.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Zancadas en Smith",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pierna",
        "icon": "🚶",
        "image_url": "/ejercicioimg/ejercicios/Pierna/Zancadas/Smith.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Zancadas / Lunges (Barra)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pierna",
        "icon": "🚶",
        "image_url": "/ejercicioimg/ejercicios/Pierna/Zancadas/Barra.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Zancadas / Lunges (Mancuernas)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Pierna",
        "icon": "🚶",
        "image_url": "/ejercicioimg/ejercicios/Pierna/Zancadas/Mancuernas.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Copa a dos manos (Mancuerna)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Tríceps",
        "icon": "🏆",
        "image_url": "/ejercicioimg/ejercicios/Triceps/copa/Dos Manos.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Copa a una mano (Mancuerna)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Tríceps",
        "icon": "🏆",
        "image_url": "/ejercicioimg/ejercicios/Triceps/copa/Una Mano.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Extensiones de Tríceps (Barra Recta)",
        "category": "CABLE",
        "targetMuscle": "Tríceps",
        "icon": "🦯",
        "image_url": "/ejercicioimg/ejercicios/Triceps/Extension tricep/Cuerda.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Extensiones de Tríceps (Polea/Cuerda)",
        "category": "CABLE",
        "targetMuscle": "Tríceps",
        "icon": "🏇",
        "image_url": "/ejercicioimg/ejercicios/Triceps/Extension tricep/Cuerda.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Extensiones de Tríceps (Polea)",
        "category": "CABLE",
        "targetMuscle": "Tríceps",
        "icon": "🏇",
        "image_url": "/ejercicioimg/ejercicios/Triceps/Extension tricep/Una Mano.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Fondos en Bancos",
        "category": "ACCESSORY",
        "targetMuscle": "Tríceps",
        "icon": "🛋️",
        "image_url": "/ejercicioimg/ejercicios/Triceps/Fondos/Bancos.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Fondos en Paralelas",
        "category": "ACCESSORY",
        "targetMuscle": "Tríceps",
        "icon": "🛋️",
        "image_url": "/ejercicioimg/ejercicios/Triceps/Fondos/Paralelas.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Patada de Tríceps (Mancuerna)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Tríceps",
        "icon": "🐴",
        "image_url": "/ejercicioimg/ejercicios/Triceps/Patada Triceps Mancuerna.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Francés (Barra Z)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Tríceps",
        "icon": "🇫🇷",
        "image_url": "/ejercicioimg/ejercicios/Triceps/Press frances/Barra Z Acostado.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Press Francés (Mancuernas)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Tríceps",
        "icon": "🇫🇷",
        "image_url": "/ejercicioimg/ejercicios/Triceps/Press frances/Mancuernas.png",
        "metrics": {
            "weight": true,
            "reps": true,
            "time": false,
            "distance": false,
            "rpe": false
        }
    },
    {
        "name": "Cardio (Bicicleta)",
        "category": "CARDIO",
        "targetMuscle": "Cardio",
        "icon": "🚲",
        "image_url": "/ejercicioimg/ejercicios/Cardio/Caminadoras/Bicicleta.png",
        "metrics": {
            "weight": false,
            "reps": false,
            "time": true,
            "distance": true,
            "rpe": true
        }
    },
    {
        "name": "Cardio (Elíptica)",
        "category": "CARDIO",
        "targetMuscle": "Cardio",
        "icon": "🏃",
        "image_url": "/ejercicioimg/ejercicios/Cardio/Caminadoras/Eliptica.png",
        "metrics": {
            "weight": false,
            "reps": false,
            "time": true,
            "distance": true,
            "rpe": true
        }
    },
    {
        "name": "Cardio (Cinta de Correr)",
        "category": "CARDIO",
        "targetMuscle": "Cardio",
        "icon": "🏃",
        "image_url": "/ejercicioimg/ejercicios/Cardio/Caminadoras/Cinta.png",
        "metrics": {
            "weight": false,
            "reps": false,
            "time": true,
            "distance": true,
            "rpe": true
        }
    },
    {
        "name": "Cardio (Escaladora)",
        "category": "CARDIO",
        "targetMuscle": "Cardio",
        "icon": "🪜",
        "image_url": "/ejercicioimg/ejercicios/Cardio/Caminadoras/Escaladora.png",
        "metrics": {
            "weight": false,
            "reps": false,
            "time": true,
            "distance": false,
            "rpe": true
        }
    },
    {
        "name": "Cardio (Remo)",
        "category": "CARDIO",
        "targetMuscle": "Cardio",
        "icon": "🚣",
        "image_url": "/ejercicioimg/ejercicios/Cardio/Remo Concept2.png",
        "metrics": {
            "weight": false,
            "reps": false,
            "time": true,
            "distance": true,
            "rpe": true
        }
    },
    {
        "name": "Cardio (Saltar Cuerda)",
        "category": "CARDIO",
        "targetMuscle": "Cardio",
        "icon": "🪢",
        "image_url": "/ejercicioimg/ejercicios/Cardio/Saltar Cuerda.png",
        "metrics": {
            "weight": false,
            "reps": false,
            "time": true,
            "distance": false,
            "rpe": true
        }
    },
    // ── Bíceps (nuevos) ──────────────────────────────────────────────────
    {
        "name": "Curl de Cable en Polea Alta (De Pie)",
        "category": "CABLE",
        "targetMuscle": "Bíceps",
        "icon": "💪",
        "image_url": "/ejercicioimg/ejercicios/Biceps/CurlNormal/Polea Alta.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Curl de Cable en Polea Baja (Una Mano)",
        "category": "CABLE",
        "targetMuscle": "Bíceps",
        "icon": "💪",
        "image_url": "/ejercicioimg/ejercicios/Biceps/CurlNormal/Polea Baja.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Abdominales (nuevos) ─────────────────────────────────────────────
    {
        "name": "Crunch Oblicuo",
        "category": "ACCESSORY",
        "targetMuscle": "Abdominales",
        "icon": "🥨",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/Crunch oblicuo/Crunch oblicuo.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Encogimientos de Rodillas (Abs)",
        "category": "ACCESSORY",
        "targetMuscle": "Abdominales",
        "icon": "🦵",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/Crunch oblicuo/Encogimientos Rodillas.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Plancha con Flexión",
        "category": "ACCESSORY",
        "targetMuscle": "Abdominales",
        "icon": "🪵",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/plancha/Con Flexion.png",
        "metrics": {"weight": false, "reps": true, "time": true, "distance": false, "rpe": false}
    },
    // ── Antebrazo (nuevos) ───────────────────────────────────────────────
    {
        "name": "Curl de Barra Invertido",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Antebrazo",
        "icon": "💪",
        "image_url": "/ejercicioimg/ejercicios/Antebrazo/Pronacion/Invertido.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Curl de Muñeca con Barra",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Antebrazo",
        "icon": "🦾",
        "image_url": "/ejercicioimg/ejercicios/Antebrazo/Curl Muneca Barra.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Extensión de Muñeca con Barra",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Antebrazo",
        "icon": "🦾",
        "image_url": "/ejercicioimg/ejercicios/Antebrazo/Pronacion/Extension Muneca.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Espalda (nuevos) ─────────────────────────────────────────────────
    {
        "name": "Encogimiento de Hombros con Barra",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Espalda",
        "icon": "🏋️‍♂️",
        "image_url": "/ejercicioimg/ejercicios/Trapecios/Barra.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Encogimiento de Hombros con Mancuernas",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Espalda",
        "icon": "🏋️",
        "image_url": "/ejercicioimg/ejercicios/Trapecios/Mancuernas.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Peso Muerto con Barra Hexagonal",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Espalda",
        "icon": "⬡",
        "image_url": "/ejercicioimg/ejercicios/Isquiotibiales/Peso Muerto/Hexagonal.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Peso Muerto Sumo con Barra",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Espalda",
        "icon": "🤼",
        "image_url": "/ejercicioimg/ejercicios/Isquiotibiales/Peso Muerto/Sumo.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Gemelos (nuevos) ─────────────────────────────────────────────────
    {
        "name": "Elevación de Gemelos de Pie (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pantorrillas",
        "icon": "🦵",
        "image_url": "/ejercicioimg/ejercicios/Gemelos/Parado/Maquina.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Elevación de Gemelos de Pie (Smith)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pantorrillas",
        "icon": "⚙️",
        "image_url": "/ejercicioimg/ejercicios/Gemelos/Parado/Smith.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Elevación de Gemelos Sentado (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pantorrillas",
        "icon": "🦵",
        "image_url": "/ejercicioimg/ejercicios/Gemelos/Gemelos Sentado.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Glúteos (nuevos) ─────────────────────────────────────────────────
    {
        "name": "Abducción de Cadera (Polea)",
        "category": "CABLE",
        "targetMuscle": "Glúteos",
        "icon": "🍑",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Abduccion Maquina.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Abducción de Cadera (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Glúteos",
        "icon": "🍑",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Abduccion Maquina.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Caminata de Pato",
        "category": "ACCESSORY",
        "targetMuscle": "Glúteos",
        "icon": "🦆",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Caminata de Pato.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Columpios con Kettlebell",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Glúteos",
        "icon": "🔔",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Columpios Kettlebell.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Elevación de Rana (Frog Pump)",
        "category": "ACCESSORY",
        "targetMuscle": "Glúteos",
        "icon": "🐸",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Rana Frog Pump.png",
        "metrics": {"weight": false, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Step Up con Mancuernas",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Glúteos",
        "icon": "🚶",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Step Up Mancuernas.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Hombro (nuevos) ──────────────────────────────────────────────────
    {
        "name": "Elevación Frontal con Disco (Dos Manos)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Hombro",
        "icon": "🧟‍♂️",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Elevacion frontal/Disco Dos Manos.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Elevación Frontal con Mancuerna (Dos Manos)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Hombro",
        "icon": "🧟‍♂️",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Elevacion frontal/Mancuerna Dos Manos.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Press Militar en Smith",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Hombro",
        "icon": "⚙️",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Militar/Smith.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Cuello (nuevos) ──────────────────────────────────────────────────
    {
        "name": "Arnés de Cuello (Neck Harness)",
        "category": "ACCESSORY",
        "targetMuscle": "Cuello",
        "icon": "🔗",
        "image_url": "/ejercicioimg/ejercicios/Cuello/Arnes Cuello.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Encogimientos de Hombros con Barra (Trapecios)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Cuello",
        "icon": "🏋️‍♂️",
        "image_url": "/ejercicioimg/ejercicios/Trapecios/Barra.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Encogimientos de Hombros con Mancuernas (Trapecios)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Cuello",
        "icon": "🏋️",
        "image_url": "/ejercicioimg/ejercicios/Trapecios/Mancuernas.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Extensiones de Cuello con Disco",
        "category": "ACCESSORY",
        "targetMuscle": "Cuello",
        "icon": "💆",
        "image_url": "/ejercicioimg/ejercicios/Cuello/Extension Disco.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Flexiones de Cuello con Disco",
        "category": "ACCESSORY",
        "targetMuscle": "Cuello",
        "icon": "💆",
        "image_url": "/ejercicioimg/ejercicios/Cuello/Flexion Disco.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Tríceps (nuevos) ─────────────────────────────────────────────────
    {
        "name": "Extensión de Tríceps con Cable (Una Mano)",
        "category": "CABLE",
        "targetMuscle": "Tríceps",
        "icon": "🏇",
        "image_url": "/ejercicioimg/ejercicios/Triceps/Extension tricep/Una Mano.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Press Francés Sentado con Barra",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Tríceps",
        "icon": "🇫🇷",
        "image_url": "/ejercicioimg/ejercicios/Triceps/Press frances/Barra Z Sentado.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Press Declinado Polea ───────────────────────────────────────────────────
    {
        "name": "Press Declinado (Polea/Cable)",
        "category": "CABLE",
        "targetMuscle": "Pecho",
        "icon": "⛓️",
        "image_url": "/ejercicioimg/ejercicios/pecho/Declinado/Polea Cable.png",
        "metrics": { "weight": true, "reps": true, "time": false, "distance": false, "rpe": false }
    }
];

// ── RESOLUCIÓN DINÁMICA DE IMÁGENES (Cero Hardcode) ───────────────────────────
// Elimina la fragilidad de las rutas hardcodeadas. Escanea el manifiesto dinámico 
// autogenerado y actualiza las URLs de la semilla en tiempo real, restringiendo
// la búsqueda al músculo/carpeta original para evitar falsos positivos (ej. "Mancuernas").
(() => {
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
    
    // Create a fast lookup grouped by folderName from the manifest
    const manifestByFolder: Record<string, { name: string, imagePath: string }[]> = {};
    
    IMAGE_MANIFEST.forEach(ex => {
        const folder = normalize(ex.folderName);
        if (!manifestByFolder[folder]) manifestByFolder[folder] = [];
        
        if (ex.variants && ex.variants.length > 0) {
            ex.variants.forEach(v => manifestByFolder[folder].push({ name: v.name, imagePath: v.imagePath }));
        } else {
            manifestByFolder[folder].push({ name: ex.name, imagePath: ex.imagePath });
        }
    });

    // Update each seed using folder-scoped fuzzy matching
    COMMON_EQUIPMENT_SEEDS.forEach(seed => {
        if (!seed.image_url) return;
        
        const oldParts = seed.image_url.split('/');
        const oldBase = oldParts.pop()?.replace('.png', '') || '';
        const oldFolder = normalize(oldParts.pop() || '');
        const normName = normalize(seed.name);
        
        // Find matching entries within the EXACT same folder structure
        const candidates = manifestByFolder[oldFolder] || [];
        
        let matchedPath = seed.image_url; // fallback to old path
        
        // 1. Try exact match by seed name
        let match = candidates.find(c => normalize(c.name) === normName);
        
        // 2. Try fuzzy match by old filename or seed name
        if (!match) {
            match = candidates.find(c => {
                const cName = normalize(c.name);
                const cBase = normalize(c.imagePath.split('/').pop()?.replace('.png', '') || '');
                return normName.includes(cName) || cName.includes(normName) ||
                       normalize(oldBase).includes(cBase) || cBase.includes(normalize(oldBase));
            });
        }
        
        // 3. Fallback: Search globally if folder logic changed completely
        if (!match) {
            for (const folder in manifestByFolder) {
                const globalMatch = manifestByFolder[folder].find(c => normalize(c.name) === normName);
                if (globalMatch) { match = globalMatch; break; }
            }
        }

        // Apply dynamic route!
        if (match) {
            seed.image_url = match.imagePath;
        }
    });
})();
// ─────────────────────────────────────────────────────────────────────────────

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
