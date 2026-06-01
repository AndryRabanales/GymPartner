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
    {
        "name": "Abdominales Inversos",
        "category": "ACCESSORY",
        "targetMuscle": "Abdominales",
        "icon": "🥨",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/AbdominalesInversos.png",
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
        "image_url": "/ejercicioimg/ejercicios/Abdomen/AbdominalRussianTwist.png",
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
        "image_url": "/ejercicioimg/ejercicios/Abdomen/CrunchAbdominal.png",
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
        "image_url": "/ejercicioimg/ejercicios/Abdomen/CrunchAbdominalEnMaquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/Abdomen/CrunchPoleaAlta.png",
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
        "image_url": "/ejercicioimg/ejercicios/Abdomen/ElevacionesDePiernaColgado.png",
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
        "image_url": "/ejercicioimg/ejercicios/Abdomen/Plancha.png",
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
        "image_url": "/ejercicioimg/ejercicios/Biceps/Curl Martillo cuerdas .png",
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
        "image_url": "/ejercicioimg/ejercicios/Biceps/Curl Martillo Mancuernas.png",
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
        "image_url": "/ejercicioimg/ejercicios/Biceps/CurlDeBiceps(1).png",
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
        "image_url": "/ejercicioimg/ejercicios/Biceps/CurlDeBiceps.png",
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
        "image_url": "/ejercicioimg/ejercicios/Biceps/CurlDeBicepsBayoneta.png",
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
        "image_url": "/ejercicioimg/ejercicios/Biceps/CurlDeBicepsEnPolea.png",
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
        "image_url": "/ejercicioimg/ejercicios/Biceps/CurlDeBicepsPredicadorBarra.png",
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
        "image_url": "/ejercicioimg/ejercicios/Biceps/CurlDeBicepsPredicadorMaquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/Biceps/CurlSpiderman.png",
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
        "image_url": "/ejercicioimg/ejercicios/Cardio/CardioBicicleta.png",
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
        "image_url": "/ejercicioimg/ejercicios/Cardio/CardioEliptica.png",
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
        "image_url": "/ejercicioimg/ejercicios/Cardio/CardioEnCinta.png",
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
        "image_url": "/ejercicioimg/ejercicios/Cardio/CardioEscalera.png",
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
        "image_url": "/ejercicioimg/ejercicios/Cardio/CardioRemo.png",
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
        "image_url": "/ejercicioimg/ejercicios/Cardio/CardioSaltarCuerda.png",
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
        "image_url": "/ejercicioimg/ejercicios/Espalda/Dominadas Asistidas Máquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/Espalda/Dominadas Pullups.png",
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
        "image_url": "/ejercicioimg/ejercicios/Espalda/Jalón al Pecho Agarre Estrecho.png",
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
        "image_url": "/ejercicioimg/ejercicios/Espalda/Jalón al Pecho Polea Alta.png",
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
        "image_url": "/ejercicioimg/ejercicios/Espalda/Peso Muerto Deadlift.png",
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
        "image_url": "/ejercicioimg/ejercicios/Espalda/Pull-Over en Polea.png",
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
        "image_url": "/ejercicioimg/ejercicios/Espalda/Remo con Barra Pendlay.png",
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
        "image_url": "/ejercicioimg/ejercicios/Espalda/Remo con Barra Yates.png",
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
        "image_url": "/ejercicioimg/ejercicios/Espalda/Remo con Mancuerna Unilateral.png",
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
        "image_url": "/ejercicioimg/ejercicios/Espalda/Remo en Máquina Pecho Apoyado.png",
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
        "image_url": "/ejercicioimg/ejercicios/Espalda/Remo en T Barra_Máquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/Espalda/Remo Gironda Polea Baja.png",
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
        "image_url": "/ejercicioimg/ejercicios/Gluteo/HiptrustBarraLibre.png",
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
        "image_url": "/ejercicioimg/ejercicios/Gluteo/HiptrustEnMaquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/Gluteo/HipTrustEnsMITH.png",
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
        "image_url": "/ejercicioimg/ejercicios/Gluteo/PatadaDeGluteo.png",
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
        "image_url": "/ejercicioimg/ejercicios/Gluteo/PatadaDeGluteoEnMaquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/Hombro/Elevaciones Frontales Mancuernas.png",
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
        "image_url": "/ejercicioimg/ejercicios/Hombro/Elevaciones Frontales Polea.png",
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
        "image_url": "/ejercicioimg/ejercicios/Hombro/Elevaciones Laterales Mancuernas.png",
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
        "image_url": "/ejercicioimg/ejercicios/Hombro/Elevaciones Laterales Máquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/Hombro/Elevaciones Laterales Polea.png",
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
        "image_url": "/ejercicioimg/ejercicios/Hombro/Press de Hombros Máquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/Hombro/Press Militar Barra.png",
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
        "image_url": "/ejercicioimg/ejercicios/Hombro/Press Militar Mancuernas.png",
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
        "image_url": "/ejercicioimg/ejercicios/Hombro/Pájaros_Vuelos Mancuernas.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/CrossOverEnPoleaBaja.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/CruceDePoleasAltaCrossOver.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/FlyesMariposaPeckDeck.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/FondosDips(pecho).png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/FondosDipsAsistido(Pecho).png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressBancaPlanoLibre.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressBancaPlanoMancuerna.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressDeclinadoEnBarra.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressDeclinadoEnMaquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressDeclinadoMancuerna.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressInclinadoConBarra.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressInclinadoConMancuerna.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressInclinadoConPolea.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressInclinadoEnMaquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressInclinadoEnSmith.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressPlanoEnMaquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressPlanoEnPolea.png",
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
        "image_url": "/ejercicioimg/ejercicios/pecho/PressPlanoEnSmith.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Curl Femoral Sentado Máquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Curl Femoral Tumbado Máquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Extensiones de Cuádriceps.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Good Mornings Buenos Días.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Peso Muerto Rumano Barra.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Peso Muerto Rumano Mancuernas.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Prensa de Piernas 45°.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Sentadilla Bulgara.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Sentadilla Frontal.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Sentadilla Hack Máquina.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Sentadilla Libre Barra.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Zancadas con smith.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Zancadas_Lunges con Barra.png",
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
        "image_url": "/ejercicioimg/ejercicios/Pierna/Zancadas_Lunges con Mancuernas.png",
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
        "image_url": "/ejercicioimg/ejercicios/Triceps/Copa a dos manos Mancuerna.png",
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
        "image_url": "/ejercicioimg/ejercicios/Triceps/Copa a una mano Mancuerna.png",
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
        "image_url": "/ejercicioimg/ejercicios/Triceps/Extensiones de Tríceps Barra Recta.png",
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
        "image_url": "/ejercicioimg/ejercicios/Triceps/Extensiones de Tríceps Cuerda.png",
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
        "image_url": "/ejercicioimg/ejercicios/Triceps/Extensiones de Tríceps Polea.png",
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
        "image_url": "/ejercicioimg/ejercicios/Triceps/Fondos en Bancos.png",
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
        "image_url": "/ejercicioimg/ejercicios/Triceps/Fondos en Paralelas.png",
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
        "image_url": "/ejercicioimg/ejercicios/Triceps/Patada de Tríceps Mancuerna.png",
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
        "image_url": "/ejercicioimg/ejercicios/Triceps/Press Francés Barra Z.png",
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
        "image_url": "/ejercicioimg/ejercicios/Triceps/Press Francés Mancuernas.png",
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
        "image_url": "/ejercicioimg/ejercicios/Cardio/CardioBicicleta.png",
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
        "image_url": "/ejercicioimg/ejercicios/Cardio/CardioEliptica.png",
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
        "image_url": "/ejercicioimg/ejercicios/Cardio/CardioEnCinta.png",
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
        "image_url": "/ejercicioimg/ejercicios/Cardio/CardioEscalera.png",
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
        "image_url": "/ejercicioimg/ejercicios/Cardio/CardioRemo.png",
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
        "image_url": "/ejercicioimg/ejercicios/Cardio/CardioSaltarCuerda.png",
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
        "image_url": "/ejercicioimg/ejercicios/Biceps/Curl de cable en polea alta de pie.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Curl de Cable en Polea Baja (Una Mano)",
        "category": "CABLE",
        "targetMuscle": "Bíceps",
        "icon": "💪",
        "image_url": "/ejercicioimg/ejercicios/Biceps/Curl de cable en polea baja a una mano.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Abdominales (nuevos) ─────────────────────────────────────────────
    {
        "name": "Crunch Oblicuo",
        "category": "ACCESSORY",
        "targetMuscle": "Abdominales",
        "icon": "🥨",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/Crunch oblicuo.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Encogimientos de Rodillas (Abs)",
        "category": "ACCESSORY",
        "targetMuscle": "Abdominales",
        "icon": "🦵",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/Encogimientos de rodillas para abdominales.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Plancha con Flexión",
        "category": "ACCESSORY",
        "targetMuscle": "Abdominales",
        "icon": "🪵",
        "image_url": "/ejercicioimg/ejercicios/Abdomen/Plancha con flexión.png",
        "metrics": {"weight": false, "reps": true, "time": true, "distance": false, "rpe": false}
    },
    // ── Antebrazo (nuevos) ───────────────────────────────────────────────
    {
        "name": "Curl de Barra Invertido",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Antebrazo",
        "icon": "💪",
        "image_url": "/ejercicioimg/ejercicios/Antebrazo/Curl de barra invertido.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Curl de Muñeca con Barra",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Antebrazo",
        "icon": "🦾",
        "image_url": "/ejercicioimg/ejercicios/Antebrazo/Curl de muñeca con barra sentado.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Extensión de Muñeca con Barra",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Antebrazo",
        "icon": "🦾",
        "image_url": "/ejercicioimg/ejercicios/Antebrazo/extensión de muñeca con barra sentado.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Espalda (nuevos) ─────────────────────────────────────────────────
    {
        "name": "Encogimiento de Hombros con Barra",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Hombro",
        "icon": "🏋️‍♂️",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Encogimiento de hombros con barra.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Encogimiento de Hombros con Mancuernas",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Hombro",
        "icon": "🏋️",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Encogimiento de hombros con mancuernas.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Peso Muerto con Barra Hexagonal",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Espalda",
        "icon": "⬡",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Peso muerto con barra hexagonal.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Peso Muerto Sumo con Barra",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Espalda",
        "icon": "🤼",
        "image_url": "/ejercicioimg/ejercicios/Espalda/Peso muerto sumo con barra.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Gemelos (nuevos) ─────────────────────────────────────────────────
    {
        "name": "Elevación de Gemelos de Pie (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pantorrillas",
        "icon": "🦵",
        "image_url": "/ejercicioimg/ejercicios/Gemelos/Elevacion de gemelos de pie en maquina .png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Elevación de Gemelos de Pie (Smith)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pantorrillas",
        "icon": "⚙️",
        "image_url": "/ejercicioimg/ejercicios/Gemelos/Elevacion de gemelos de pie en smith .png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Elevación de Gemelos Sentado (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Pantorrillas",
        "icon": "🦵",
        "image_url": "/ejercicioimg/ejercicios/Gemelos/Elevación de gemelos sentado.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Glúteos (nuevos) ─────────────────────────────────────────────────
    {
        "name": "Abducción de Cadera (Polea)",
        "category": "CABLE",
        "targetMuscle": "Glúteos",
        "icon": "🍑",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Abducción con polea.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Abducción de Cadera (Máquina)",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Glúteos",
        "icon": "🍑",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Abducción de cadera con máquina de abducción de cadera.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Caminata de Pato",
        "category": "ACCESSORY",
        "targetMuscle": "Glúteos",
        "icon": "🦆",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Caminata de pato.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Columpios con Kettlebell",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Glúteos",
        "icon": "🔔",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Columpios con kettlebell.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Elevación de Rana (Frog Pump)",
        "category": "ACCESSORY",
        "targetMuscle": "Glúteos",
        "icon": "🐸",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Elevaciones en posición de rana con propio peso.png",
        "metrics": {"weight": false, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Step Up con Mancuernas",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Glúteos",
        "icon": "🚶",
        "image_url": "/ejercicioimg/ejercicios/Gluteo/Step Up con mancuernas.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Hombro (nuevos) ──────────────────────────────────────────────────
    {
        "name": "Elevación Frontal con Disco (Dos Manos)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Hombro",
        "icon": "🧟‍♂️",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Elevación frontal con disco a dos manos.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Elevación Frontal con Mancuerna (Dos Manos)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Hombro",
        "icon": "🧟‍♂️",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Elevación frontal con mancuerna a dos manos.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Press Militar en Smith",
        "category": "STRENGTH_MACHINE",
        "targetMuscle": "Hombro",
        "icon": "⚙️",
        "image_url": "/ejercicioimg/ejercicios/Hombro/Press militar en smith .png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Cuello (nuevos) ──────────────────────────────────────────────────
    {
        "name": "Arnés de Cuello (Neck Harness)",
        "category": "ACCESSORY",
        "targetMuscle": "Cuello",
        "icon": "🔗",
        "image_url": "/ejercicioimg/ejercicios/Cuello/Arnés de cuello (Neck Harness).png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Encogimientos de Hombros con Barra (Trapecios)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Cuello",
        "icon": "🏋️‍♂️",
        "image_url": "/ejercicioimg/ejercicios/Cuello/Encogimientos de hombros con barra.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Encogimientos de Hombros con Mancuernas (Trapecios)",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Cuello",
        "icon": "🏋️",
        "image_url": "/ejercicioimg/ejercicios/Cuello/Encogimientos de hombros con mancuernas.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Extensiones de Cuello con Disco",
        "category": "ACCESSORY",
        "targetMuscle": "Cuello",
        "icon": "💆",
        "image_url": "/ejercicioimg/ejercicios/Cuello/Extensiones de cuello con disco.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Flexiones de Cuello con Disco",
        "category": "ACCESSORY",
        "targetMuscle": "Cuello",
        "icon": "💆",
        "image_url": "/ejercicioimg/ejercicios/Cuello/Flexiones de cuello con disco.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    // ── Tríceps (nuevos) ─────────────────────────────────────────────────
    {
        "name": "Extensión de Tríceps con Cable (Una Mano)",
        "category": "CABLE",
        "targetMuscle": "Tríceps",
        "icon": "🏇",
        "image_url": "/ejercicioimg/ejercicios/Triceps/Extensión de tríceps con cable a una mano.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    },
    {
        "name": "Press Francés Sentado con Barra",
        "category": "FREE_WEIGHT",
        "targetMuscle": "Tríceps",
        "icon": "🇫🇷",
        "image_url": "/ejercicioimg/ejercicios/Triceps/Press francés sentado con barra.png",
        "metrics": {"weight": true, "reps": true, "time": false, "distance": false, "rpe": false}
    }
];;

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
