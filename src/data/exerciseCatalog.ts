/**
 * Curated exercise catalog — ~60 base exercises, each with selectable variants.
 * Variant.seedName must match EXACTLY a name in COMMON_EQUIPMENT_SEEDS so that
 * handleBatchAdd can look it up and create the right WorkoutExercise.
 */

export interface ExerciseVariant {
    id: string;       // e.g. "barra"
    label: string;    // e.g. "Barra"
    seedName: string; // exact name in COMMON_EQUIPMENT_SEEDS
    icon: string;
}

export interface BaseExercise {
    id: string;
    name: string;       // clean display name without variant suffix
    muscle: string;     // e.g. "PECHO"
    icon: string;
    metrics: { weight: boolean; reps: boolean; time: boolean; distance: boolean; rpe: boolean };
    variants: ExerciseVariant[];
}

// ── PECHO ────────────────────────────────────────────────────────────────────
const PECHO: BaseExercise[] = [
    {
        id: 'press_banca_plano',
        name: 'Press Banca Plano',
        muscle: 'PECHO', icon: '🏋️‍♂️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',       label: 'Barra',       seedName: 'Press Banca Plano (Barra)',       icon: '🏋️‍♂️' },
            { id: 'mancuernas',  label: 'Mancuernas',  seedName: 'Press Banca Plano (Mancuernas)',  icon: '🏋️'  },
            { id: 'smith',       label: 'Smith',        seedName: 'Smith Press Plano',               icon: '⚙️'  },
            { id: 'maquina',     label: 'Máquina',      seedName: 'Press de Pecho (Máquina)',        icon: '🤖'  },
            { id: 'cable',       label: 'Cable/Polea',  seedName: 'Press Plano (Polea/Cable)',       icon: '⛓️'  },
        ],
    },
    {
        id: 'press_inclinado',
        name: 'Press Inclinado',
        muscle: 'PECHO', icon: '🏋️‍♂️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',       label: 'Barra',       seedName: 'Press Inclinado (Barra)',       icon: '🏋️‍♂️' },
            { id: 'mancuernas',  label: 'Mancuernas',  seedName: 'Press Inclinado (Mancuernas)',  icon: '🏋️'  },
            { id: 'smith',       label: 'Smith',        seedName: 'Smith Press Inclinado',         icon: '⚙️'  },
            { id: 'maquina',     label: 'Máquina',      seedName: 'Press Inclinado (Máquina)',     icon: '🤖'  },
            { id: 'cable',       label: 'Cable/Polea',  seedName: 'Press Inclinado (Polea/Cable)', icon: '⛓️'  },
        ],
    },
    {
        id: 'press_declinado',
        name: 'Press Declinado',
        muscle: 'PECHO', icon: '📉',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',      label: 'Barra',      seedName: 'Press Declinado (Barra)',      icon: '📉' },
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Press Declinado (Mancuernas)', icon: '🏋️' },
            { id: 'maquina',    label: 'Máquina',    seedName: 'Press Declinado (Máquina)',    icon: '🤖' },
        ],
    },
    {
        id: 'cruce_aperturas',
        name: 'Cruce / Aperturas',
        muscle: 'PECHO', icon: '⚔️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'crossover_alto', label: 'Polea Alta',  seedName: 'Cruce de Poleas (Crossover Alto)', icon: '⚔️' },
            { id: 'crossover_bajo', label: 'Polea Baja',  seedName: 'Crossover en Polea Baja',          icon: '⚔️' },
            { id: 'peck_deck',      label: 'Peck Deck',   seedName: 'Peck Deck (Mariposa)',             icon: '🦋' },
        ],
    },
    {
        id: 'fondos_pecho',
        name: 'Fondos (Dips)',
        muscle: 'PECHO', icon: '🏗️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'paralelas',  label: 'Paralelas', seedName: 'Fondos (Dips)',              icon: '🏗️' },
            { id: 'asistidos',  label: 'Asistidos', seedName: 'Fondos Asistidos (Pecho)',   icon: '🤖' },
        ],
    },
    {
        id: 'pullover_pecho',
        name: 'Pull-Over',
        muscle: 'PECHO', icon: '🎣',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'polea', label: 'Polea', seedName: 'Pull-Over en Polea', icon: '🎣' },
        ],
    },
];

// ── HOMBRO ───────────────────────────────────────────────────────────────────
const HOMBRO: BaseExercise[] = [
    {
        id: 'press_militar',
        name: 'Press Militar',
        muscle: 'HOMBRO', icon: '💂',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',      label: 'Barra',      seedName: 'Press Militar (Barra)',        icon: '💂' },
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Press Militar (Mancuernas)',   icon: '🏋️' },
            { id: 'maquina',    label: 'Máquina',    seedName: 'Press de Hombros (Máquina)',   icon: '🤖' },
        ],
    },
    {
        id: 'elevaciones_laterales',
        name: 'Elevaciones Laterales',
        muscle: 'HOMBRO', icon: '🐦',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Elevaciones Laterales (Mancuernas)', icon: '🐦' },
            { id: 'polea',      label: 'Polea',      seedName: 'Elevaciones Laterales (Polea)',      icon: '🐦' },
            { id: 'maquina',    label: 'Máquina',    seedName: 'Elevaciones Laterales (Máquina)',   icon: '🤖' },
        ],
    },
    {
        id: 'elevaciones_frontales',
        name: 'Elevaciones Frontales',
        muscle: 'HOMBRO', icon: '🧟‍♂️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Elevaciones Frontales (Mancuernas)', icon: '🧟‍♂️' },
            { id: 'polea',      label: 'Polea',      seedName: 'Elevaciones Frontales (Polea)',       icon: '🧟‍♂️' },
        ],
    },
    {
        id: 'pajaros',
        name: 'Pájaros / Posterior',
        muscle: 'HOMBRO', icon: '🦅',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Pájaros / Vuelos (Mancuernas)', icon: '🦅' },
            { id: 'maquina',    label: 'Peck Deck',  seedName: 'Peck Deck Invertido',           icon: '🦋' },
        ],
    },
    {
        id: 'face_pull',
        name: 'Face Pull',
        muscle: 'HOMBRO', icon: '🤡',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'polea', label: 'Polea', seedName: 'Face Pull', icon: '🤡' },
        ],
    },
];

// ── TRÍCEPS ──────────────────────────────────────────────────────────────────
const TRICEPS: BaseExercise[] = [
    {
        id: 'extension_triceps',
        name: 'Extensión Tríceps',
        muscle: 'TRÍCEPS', icon: '🏇',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'cuerda',   label: 'Cuerda',      seedName: 'Extensiones de Tríceps (Polea/Cuerda)', icon: '🏇' },
            { id: 'barra',    label: 'Barra Recta',  seedName: 'Extensiones de Tríceps (Barra Recta)',  icon: '🦯' },
            { id: 'polea',    label: 'Polea',        seedName: 'Extensiones de Tríceps (Polea)',        icon: '🏇' },
        ],
    },
    {
        id: 'press_frances',
        name: 'Press Francés',
        muscle: 'TRÍCEPS', icon: '🇫🇷',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',      label: 'Barra Z',    seedName: 'Press Francés (Barra Z)',    icon: '🇫🇷' },
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Press Francés (Mancuernas)', icon: '🇫🇷' },
        ],
    },
    {
        id: 'copa_triceps',
        name: 'Copa (Overhead)',
        muscle: 'TRÍCEPS', icon: '🏆',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'dos_manos', label: 'Dos Manos', seedName: 'Copa a dos manos (Mancuerna)', icon: '🏆' },
            { id: 'una_mano',  label: 'Una Mano',  seedName: 'Copa a una mano (Mancuerna)',  icon: '🏆' },
        ],
    },
    {
        id: 'fondos_triceps',
        name: 'Fondos Tríceps',
        muscle: 'TRÍCEPS', icon: '🛋️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'banco',      label: 'En Banco',   seedName: 'Fondos en Bancos',    icon: '🛋️' },
            { id: 'paralelas',  label: 'Paralelas',  seedName: 'Fondos en Paralelas', icon: '🛋️' },
        ],
    },
    {
        id: 'patada_triceps',
        name: 'Patada de Tríceps',
        muscle: 'TRÍCEPS', icon: '🐴',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuerna', label: 'Mancuerna', seedName: 'Patada de Tríceps (Mancuerna)', icon: '🐴' },
        ],
    },
];

// ── ESPALDA ──────────────────────────────────────────────────────────────────
const ESPALDA: BaseExercise[] = [
    {
        id: 'dominadas',
        name: 'Dominadas',
        muscle: 'ESPALDA', icon: '🧗',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'peso_corporal', label: 'Peso Corporal', seedName: 'Dominadas (Pullups)',           icon: '🧗' },
            { id: 'asistidas',     label: 'Asistidas',     seedName: 'Dominadas Asistidas (Máquina)', icon: '🤖' },
        ],
    },
    {
        id: 'jalon',
        name: 'Jalón al Pecho',
        muscle: 'ESPALDA', icon: '🔻',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'polea_alta',     label: 'Polea Alta',    seedName: 'Jalón al Pecho (Polea Alta)',        icon: '🔻' },
            { id: 'agarre_estrecho',label: 'Agarre Estrecho',seedName: 'Jalón al Pecho (Agarre Estrecho)', icon: '🔻' },
        ],
    },
    {
        id: 'remo',
        name: 'Remo',
        muscle: 'ESPALDA', icon: '🚣',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuerna',    label: 'Mancuerna',     seedName: 'Remo con Mancuerna (Unilateral)',  icon: '👜' },
            { id: 'barra_pendlay',label: 'Barra Pendlay',  seedName: 'Remo con Barra Pendlay',           icon: '🚣' },
            { id: 'barra_yates',  label: 'Barra Yates',   seedName: 'Remo con Barra Yates',             icon: '🚣' },
            { id: 'en_t',         label: 'En T',           seedName: 'Remo en T (Barra/Máquina)',         icon: '⚓' },
            { id: 'maquina',      label: 'Máquina',        seedName: 'Remo en Máquina (Pecho Apoyado)',  icon: '🚜' },
            { id: 'polea_baja',   label: 'Polea Baja',    seedName: 'Remo Gironda (Polea Baja)',         icon: '🛶' },
        ],
    },
    {
        id: 'peso_muerto',
        name: 'Peso Muerto',
        muscle: 'ESPALDA', icon: '🧟',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'deadlift', label: 'Deadlift', seedName: 'Peso Muerto (Deadlift)', icon: '🧟' },
        ],
    },
    {
        id: 'pullover_espalda',
        name: 'Pull-Over Espalda',
        muscle: 'ESPALDA', icon: '🎣',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'polea', label: 'Polea', seedName: 'Pull-Over en Polea', icon: '🎣' },
        ],
    },
];

// ── BÍCEPS ───────────────────────────────────────────────────────────────────
const BICEPS: BaseExercise[] = [
    {
        id: 'curl_biceps',
        name: 'Curl de Bíceps',
        muscle: 'BÍCEPS', icon: '💪',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Curl de Bíceps (Mancuernas)',  icon: '💪' },
            { id: 'barra',      label: 'Barra',      seedName: 'Curl de Bíceps con Barra',     icon: '🥖' },
            { id: 'polea',      label: 'Polea',      seedName: 'Curl de Bíceps en Polea',      icon: '🐍' },
            { id: 'bayoneta',   label: 'Bayoneta',   seedName: 'Curl de Bíceps Bayoneta',      icon: '💪' },
        ],
    },
    {
        id: 'curl_martillo',
        name: 'Curl Martillo',
        muscle: 'BÍCEPS', icon: '🔨',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Curl Martillo (Mancuernas)',     icon: '🔨' },
            { id: 'cuerda',     label: 'Polea/Cuerda',seedName: 'Curl Martillo (Polea/Cuerda)', icon: '⛓️' },
        ],
    },
    {
        id: 'curl_predicador',
        name: 'Curl Predicador',
        muscle: 'BÍCEPS', icon: '🙏',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',   label: 'Barra',   seedName: 'Curl Predicador (Barra)',   icon: '🙏' },
            { id: 'maquina', label: 'Máquina', seedName: 'Curl Predicador (Máquina)', icon: '🤖' },
        ],
    },
    {
        id: 'curl_arana',
        name: 'Curl Araña',
        muscle: 'BÍCEPS', icon: '🕷️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Curl Araña (Spider Curl)', icon: '🕷️' },
        ],
    },
];

// ── PIERNA ───────────────────────────────────────────────────────────────────
const PIERNA: BaseExercise[] = [
    {
        id: 'sentadilla',
        name: 'Sentadilla',
        muscle: 'PIERNA', icon: '🍑',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',   label: 'Barra Libre', seedName: 'Sentadilla Libre (Barra)', icon: '🍑' },
            { id: 'frontal', label: 'Frontal',      seedName: 'Sentadilla Frontal',       icon: '🏋️' },
            { id: 'bulgara', label: 'Búlgara',      seedName: 'Sentadilla Búlgara',       icon: '🇧🇬' },
        ],
    },
    {
        id: 'prensa_piernas',
        name: 'Prensa de Piernas',
        muscle: 'PIERNA', icon: '📐',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: '45', label: '45°', seedName: 'Prensa de Piernas (45°)', icon: '📐' },
        ],
    },
    {
        id: 'extension_cuadriceps',
        name: 'Extensión de Cuádriceps',
        muscle: 'PIERNA', icon: '🦵',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'maquina', label: 'Máquina', seedName: 'Extensiones de Cuádriceps', icon: '🦵' },
        ],
    },
    {
        id: 'zancadas',
        name: 'Zancadas / Lunges',
        muscle: 'PIERNA', icon: '🚶',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Zancadas / Lunges (Mancuernas)', icon: '🚶' },
            { id: 'barra',      label: 'Barra',      seedName: 'Zancadas / Lunges (Barra)',      icon: '🚶' },
            { id: 'smith',      label: 'Smith',       seedName: 'Zancadas en Smith',              icon: '⚙️' },
        ],
    },
    {
        id: 'hack_squat',
        name: 'Hack Squat',
        muscle: 'PIERNA', icon: '🪑',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'maquina', label: 'Máquina', seedName: 'Sentadilla Hack (Máquina)', icon: '🪑' },
        ],
    },
    {
        id: 'curl_femoral',
        name: 'Curl Femoral',
        muscle: 'PIERNA', icon: '🥓',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'tumbado',  label: 'Tumbado',  seedName: 'Curl Femoral Tumbado (Máquina)',  icon: '🥓' },
            { id: 'sentado',  label: 'Sentado',  seedName: 'Curl Femoral Sentado (Máquina)',  icon: '🪑' },
        ],
    },
    {
        id: 'peso_muerto_rumano',
        name: 'Peso Muerto Rumano',
        muscle: 'PIERNA', icon: '🎋',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',      label: 'Barra',      seedName: 'Peso Muerto Rumano (Barra)',      icon: '🎋' },
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Peso Muerto Rumano (Mancuernas)', icon: '🎋' },
        ],
    },
    {
        id: 'buenos_dias',
        name: 'Buenos Días',
        muscle: 'PIERNA', icon: '🌞',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra', label: 'Barra', seedName: 'Good Mornings (Buenos Días)', icon: '🌞' },
        ],
    },
];

// ── GLÚTEOS ──────────────────────────────────────────────────────────────────
const GLUTEOS: BaseExercise[] = [
    {
        id: 'hip_thrust',
        name: 'Hip Thrust',
        muscle: 'GLÚTEOS', icon: '🌉',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',   label: 'Barra Libre', seedName: 'Hip Thrust (Barra Libre)', icon: '🌉' },
            { id: 'smith',   label: 'Smith',        seedName: 'Hip Thrust en Smith',      icon: '⚙️' },
            { id: 'maquina', label: 'Máquina',      seedName: 'Hip Thrust (Máquina)',     icon: '🤖' },
        ],
    },
    {
        id: 'patada_gluteo',
        name: 'Patada de Glúteo',
        muscle: 'GLÚTEOS', icon: '🍑',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'polea',   label: 'Polea',   seedName: 'Patada de Glúteo (Polea)',   icon: '🍑' },
            { id: 'maquina', label: 'Máquina', seedName: 'Patada de Glúteo (Máquina)', icon: '🤖' },
        ],
    },
];

// ── ABDOMINALES ──────────────────────────────────────────────────────────────
const ABDOMINALES: BaseExercise[] = [
    {
        id: 'crunch',
        name: 'Crunch Abdominal',
        muscle: 'ABDOMINALES', icon: '🥨',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'suelo',   label: 'Suelo',   seedName: 'Crunch Abdominal',         icon: '🥨' },
            { id: 'maquina', label: 'Máquina', seedName: 'Crunch en Máquina',         icon: '🤖' },
            { id: 'polea',   label: 'Polea',   seedName: 'Crunch en Polea Alta',      icon: '🙇' },
        ],
    },
    {
        id: 'plancha',
        name: 'Plancha (Plank)',
        muscle: 'ABDOMINALES', icon: '🪵',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'suelo', label: 'Suelo', seedName: 'Plancha (Plank)', icon: '🪵' },
        ],
    },
    {
        id: 'elevacion_piernas',
        name: 'Elevación de Piernas',
        muscle: 'ABDOMINALES', icon: '🥒',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'colgado', label: 'Colgado', seedName: 'Elevación de Piernas (Colgado)', icon: '🥒' },
        ],
    },
    {
        id: 'russian_twist',
        name: 'Russian Twist',
        muscle: 'ABDOMINALES', icon: '🇷🇺',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'suelo', label: 'Suelo', seedName: 'Russian Twist', icon: '🇷🇺' },
        ],
    },
    {
        id: 'abdominales_inversos',
        name: 'Abdominales Inversos',
        muscle: 'ABDOMINALES', icon: '🥨',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'suelo', label: 'Suelo', seedName: 'Abdominales Inversos', icon: '🥨' },
        ],
    },
];

// ── CARDIO ───────────────────────────────────────────────────────────────────
const CARDIO: BaseExercise[] = [
    {
        id: 'cinta_correr',
        name: 'Cinta de Correr',
        muscle: 'CARDIO', icon: '🏃',
        metrics: { weight: false, reps: false, time: true, distance: true, rpe: false },
        variants: [{ id: 'cinta', label: 'Cinta', seedName: 'Cinta de Correr', icon: '🏃' }],
    },
    {
        id: 'bicicleta_estatica',
        name: 'Bicicleta Estática',
        muscle: 'CARDIO', icon: '🚴',
        metrics: { weight: false, reps: false, time: true, distance: true, rpe: false },
        variants: [{ id: 'estatica', label: 'Estática', seedName: 'Bicicleta Estática', icon: '🚴' }],
    },
    {
        id: 'eliptica',
        name: 'Elíptica',
        muscle: 'CARDIO', icon: '⛷️',
        metrics: { weight: false, reps: false, time: true, distance: true, rpe: false },
        variants: [{ id: 'eliptica', label: 'Elíptica', seedName: 'Elíptica', icon: '⛷️' }],
    },
    {
        id: 'escaladora',
        name: 'Escaladora',
        muscle: 'CARDIO', icon: '🧗',
        metrics: { weight: false, reps: false, time: true, distance: true, rpe: false },
        variants: [{ id: 'stairmaster', label: 'Stairmaster', seedName: 'Escaladora (Stairmaster)', icon: '🧗' }],
    },
    {
        id: 'remo_cardio',
        name: 'Remo (Cardio)',
        muscle: 'CARDIO', icon: '🚣',
        metrics: { weight: false, reps: false, time: true, distance: true, rpe: false },
        variants: [{ id: 'concept2', label: 'Concept2', seedName: 'Remo (Concept2)', icon: '🚣' }],
    },
    {
        id: 'salto_cuerda',
        name: 'Salto a la Cuerda',
        muscle: 'CARDIO', icon: '🪢',
        metrics: { weight: false, reps: false, time: true, distance: false, rpe: false },
        variants: [{ id: 'cuerda', label: 'Cuerda', seedName: 'Salto de Cuerda', icon: '🪢' }],
    },
];

// ── Export ───────────────────────────────────────────────────────────────────

/** All curated base exercises in catalog order */
export const CURATED_EXERCISES: BaseExercise[] = [
    ...PECHO,
    ...HOMBRO,
    ...TRICEPS,
    ...ESPALDA,
    ...BICEPS,
    ...PIERNA,
    ...GLUTEOS,
    ...ABDOMINALES,
    ...CARDIO,
];

/** Muscles in display order */
export const CATALOG_MUSCLES = [
    'PECHO', 'HOMBRO', 'TRÍCEPS', 'ESPALDA', 'BÍCEPS',
    'PIERNA', 'GLÚTEOS', 'ABDOMINALES', 'CARDIO',
] as const;

export type CatalogMuscle = typeof CATALOG_MUSCLES[number];

/** Find which base exercise a given seed name belongs to (for variant switcher) */
export const findBaseExercise = (seedName: string): BaseExercise | null => {
    const n = seedName.toLowerCase().trim();
    return CURATED_EXERCISES.find(b =>
        b.variants.some(v => v.seedName.toLowerCase() === n)
    ) ?? null;
};

/** localStorage keys */
const VARIANT_PREFS_KEY = 'ginx_variant_prefs';   // Record<baseId, variantId>
const USER_EXTRAS_KEY   = 'ginx_catalog_extras';  // string[] of extra seedNames added by user

export const getVariantPrefs = (): Record<string, string> => {
    try { return JSON.parse(localStorage.getItem(VARIANT_PREFS_KEY) || '{}'); }
    catch { return {}; }
};
export const saveVariantPref = (baseId: string, variantId: string): void => {
    const prefs = getVariantPrefs();
    prefs[baseId] = variantId;
    localStorage.setItem(VARIANT_PREFS_KEY, JSON.stringify(prefs));
};

export const getUserExtras = (): string[] => {
    try { return JSON.parse(localStorage.getItem(USER_EXTRAS_KEY) || '[]'); }
    catch { return []; }
};
export const addUserExtra = (seedName: string): void => {
    const extras = getUserExtras();
    if (!extras.includes(seedName)) {
        extras.push(seedName);
        localStorage.setItem(USER_EXTRAS_KEY, JSON.stringify(extras));
    }
};

/** Get preferred variant seedName for a base exercise */
export const getPreferredSeedName = (base: BaseExercise): string => {
    const prefs = getVariantPrefs();
    const preferredId = prefs[base.id];
    const variant = preferredId ? base.variants.find(v => v.id === preferredId) : null;
    return (variant ?? base.variants[0]).seedName;
};

/** All seedNames from COMMON_EQUIPMENT_SEEDS that are NOT covered by curated variants */
export const getExtrasForMuscle = (muscle: string, allSeeds: { name: string; targetMuscle: string }[]): string[] => {
    const curatedNames = new Set(
        CURATED_EXERCISES
            .filter(b => b.muscle === muscle)
            .flatMap(b => b.variants.map(v => v.seedName.toLowerCase()))
    );
    return allSeeds
        .filter(s => {
            const m = s.targetMuscle?.toUpperCase();
            const muscleMatch =
                muscle === 'PIERNA' ? ['PIERNA', 'CUÁDRICEPS', 'ISQUIOTIBIALES'].includes(m) :
                muscle === 'ABDOMINALES' ? m === 'ABDOMINALES' :
                muscle === 'GLÚTEOS' ? m === 'GLÚTEOS' :
                muscle === 'CARDIO' ? m === 'CARDIO' :
                m === muscle;
            return muscleMatch && !curatedNames.has(s.name.toLowerCase());
        })
        .map(s => s.name);
};
