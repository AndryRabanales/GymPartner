/**
 * Curated exercise catalog.
 * Variants are ordered: POSITION first (plano / inclinado / declinado / tumbado / sentado…)
 * then EQUIPMENT within each position (Barra → Mancuernas → Smith → Máquina → Cable).
 * One card per movement family — cycling the arrow shows every position+equipment combo.
 */

export interface ExerciseVariant {
    id: string;
    label: string;    // e.g. "Plano · Barra"
    seedName: string; // exact match in COMMON_EQUIPMENT_SEEDS
    icon: string;
}

export interface BaseExercise {
    id: string;
    name: string;
    muscle: string;
    icon: string;
    metrics: { weight: boolean; reps: boolean; time: boolean; distance: boolean; rpe: boolean };
    variants: ExerciseVariant[];
}

// ─────────────────────────── PECHO ──────────────────────────────────────────
// Press de Pecho: Position (Plano / Inclinado / Declinado) × Equipment (Barra / Mancuernas / Smith / Máquina / Cable)
const PECHO: BaseExercise[] = [
    {
        id: 'press_pecho',
        name: 'Press de Pecho',
        muscle: 'PECHO', icon: '🏋️‍♂️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            // ── Plano (pecho medio) ──
            { id: 'plano_barra',      label: 'Plano · Barra',      seedName: 'Press Banca Plano (Barra)',       icon: '🏋️‍♂️' },
            { id: 'plano_mancuernas', label: 'Plano · Mancuernas', seedName: 'Press Banca Plano (Mancuernas)',  icon: '🏋️'  },
            { id: 'plano_smith',      label: 'Plano · Smith',       seedName: 'Smith Press Plano',               icon: '⚙️'  },
            { id: 'plano_maquina',    label: 'Plano · Máquina',     seedName: 'Press de Pecho (Máquina)',        icon: '🤖'  },
            { id: 'plano_cable',      label: 'Plano · Cable',       seedName: 'Press Plano (Polea/Cable)',       icon: '⛓️'  },
            // ── Inclinado (pecho superior) ──
            { id: 'incl_barra',       label: 'Inclinado · Barra',      seedName: 'Press Inclinado (Barra)',       icon: '🏋️‍♂️' },
            { id: 'incl_mancuernas',  label: 'Inclinado · Mancuernas', seedName: 'Press Inclinado (Mancuernas)',  icon: '🏋️'  },
            { id: 'incl_smith',       label: 'Inclinado · Smith',       seedName: 'Smith Press Inclinado',         icon: '⚙️'  },
            { id: 'incl_maquina',     label: 'Inclinado · Máquina',     seedName: 'Press Inclinado (Máquina)',     icon: '🤖'  },
            { id: 'incl_cable',       label: 'Inclinado · Cable',       seedName: 'Press Inclinado (Polea/Cable)', icon: '⛓️'  },
            // ── Declinado (pecho inferior) ──
            { id: 'decl_barra',       label: 'Declinado · Barra',      seedName: 'Press Declinado (Barra)',      icon: '📉' },
            { id: 'decl_mancuernas',  label: 'Declinado · Mancuernas', seedName: 'Press Declinado (Mancuernas)', icon: '🏋️' },
            { id: 'decl_maquina',     label: 'Declinado · Máquina',    seedName: 'Press Declinado (Máquina)',    icon: '🤖' },
        ],
    },
    {
        id: 'cruce_aperturas',
        name: 'Cruce / Aperturas',
        muscle: 'PECHO', icon: '⚔️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'polea_alta',  label: 'Polea Alta',  seedName: 'Cruce de Poleas (Crossover Alto)', icon: '⚔️' },
            { id: 'polea_baja',  label: 'Polea Baja',  seedName: 'Crossover en Polea Baja',          icon: '⚔️' },
            { id: 'peck_deck',   label: 'Peck Deck',   seedName: 'Peck Deck (Mariposa)',             icon: '🦋' },
        ],
    },
    {
        id: 'fondos_pecho',
        name: 'Fondos (Dips)',
        muscle: 'PECHO', icon: '🏗️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'paralelas', label: 'Paralelas', seedName: 'Fondos (Dips)',            icon: '🏗️' },
            { id: 'asistidos', label: 'Asistidos', seedName: 'Fondos Asistidos (Pecho)', icon: '🤖' },
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

// ─────────────────────────── HOMBRO ─────────────────────────────────────────
const HOMBRO: BaseExercise[] = [
    {
        id: 'press_hombros',
        name: 'Press de Hombros',
        muscle: 'HOMBRO', icon: '💂',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',   label: 'Barra',   seedName: 'Press Militar (Barra)',      icon: '💂' },
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Press Militar (Mancuernas)', icon: '🏋️' },
            { id: 'maquina', label: 'Máquina', seedName: 'Press de Hombros (Máquina)', icon: '🤖' },
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
        id: 'posterior_hombro',
        name: 'Posterior / Pájaros',
        muscle: 'HOMBRO', icon: '🦅',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Pájaros / Vuelos (Mancuernas)', icon: '🦅' },
            { id: 'peck_inv',   label: 'Peck Deck',  seedName: 'Peck Deck Invertido',           icon: '🦋' },
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

// ─────────────────────────── TRÍCEPS ────────────────────────────────────────
const TRICEPS: BaseExercise[] = [
    {
        id: 'extension_triceps',
        name: 'Extensión Tríceps (Polea)',
        muscle: 'TRÍCEPS', icon: '🏇',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            // Pushdown (de pie empujando hacia abajo) — mismo patrón, diferente agarre
            { id: 'cuerda',   label: 'Cuerda',       seedName: 'Extensiones de Tríceps (Polea/Cuerda)', icon: '🏇' },
            { id: 'barra',    label: 'Barra Recta',  seedName: 'Extensiones de Tríceps (Barra Recta)',  icon: '🦯' },
            { id: 'polea',    label: 'Barra V',      seedName: 'Extensiones de Tríceps (Polea)',        icon: '🏇' },
        ],
    },
    {
        id: 'press_frances',
        name: 'Press Francés / Copa',
        muscle: 'TRÍCEPS', icon: '🇫🇷',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            // Tumbado (skull crusher)
            { id: 'tumbado_barra',      label: 'Tumbado · Barra Z',    seedName: 'Press Francés (Barra Z)',       icon: '🇫🇷' },
            { id: 'tumbado_mancuernas', label: 'Tumbado · Mancuernas', seedName: 'Press Francés (Mancuernas)',    icon: '🇫🇷' },
            // Overhead (copa sobre la cabeza)
            { id: 'overhead_dos',       label: 'Overhead · Dos Manos', seedName: 'Copa a dos manos (Mancuerna)',  icon: '🏆' },
            { id: 'overhead_una',       label: 'Overhead · Una Mano',  seedName: 'Copa a una mano (Mancuerna)',   icon: '🏆' },
        ],
    },
    {
        id: 'fondos_triceps',
        name: 'Fondos Tríceps',
        muscle: 'TRÍCEPS', icon: '🛋️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'banco',     label: 'En Banco',  seedName: 'Fondos en Bancos',    icon: '🛋️' },
            { id: 'paralelas', label: 'Paralelas', seedName: 'Fondos en Paralelas', icon: '🛋️' },
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

// ─────────────────────────── ESPALDA ────────────────────────────────────────
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
            // Por agarre (posición de la mano cambia el ángulo de trabajo)
            { id: 'prono_ancho',    label: 'Agarre Prono Ancho',   seedName: 'Jalón al Pecho (Polea Alta)',        icon: '🔻' },
            { id: 'supino_estrecho',label: 'Agarre Estrecho',       seedName: 'Jalón al Pecho (Agarre Estrecho)', icon: '🔻' },
        ],
    },
    {
        id: 'remo',
        name: 'Remo',
        muscle: 'ESPALDA', icon: '🚣',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            // Inclinado libre (torso inclinado, tirando hacia el cuerpo)
            { id: 'pendlay',    label: 'Inclinado · Barra Pendlay', seedName: 'Remo con Barra Pendlay',          icon: '🚣' },
            { id: 'yates',      label: 'Inclinado · Barra Yates',   seedName: 'Remo con Barra Yates',            icon: '🚣' },
            { id: 'mancuerna',  label: 'Inclinado · Mancuerna',     seedName: 'Remo con Mancuerna (Unilateral)', icon: '👜' },
            { id: 'en_t',       label: 'Inclinado · En T',           seedName: 'Remo en T (Barra/Máquina)',       icon: '⚓' },
            // Apoyado / Máquina (soporte para el pecho o asiento)
            { id: 'maquina_pc', label: 'Pecho Apoyado',             seedName: 'Remo en Máquina (Pecho Apoyado)', icon: '🚜' },
            // Cable bajo sentado
            { id: 'gironda',    label: 'Sentado · Polea Baja',      seedName: 'Remo Gironda (Polea Baja)',        icon: '🛶' },
        ],
    },
    {
        id: 'peso_muerto',
        name: 'Peso Muerto',
        muscle: 'ESPALDA', icon: '🧟',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'convencional', label: 'Convencional', seedName: 'Peso Muerto (Deadlift)', icon: '🧟' },
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

// ─────────────────────────── BÍCEPS ─────────────────────────────────────────
const BICEPS: BaseExercise[] = [
    {
        id: 'curl_biceps',
        name: 'Curl de Bíceps',
        muscle: 'BÍCEPS', icon: '💪',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            // De pie — equipamiento cambia el ángulo de supinación
            { id: 'barra',      label: 'De Pie · Barra',      seedName: 'Curl de Bíceps con Barra',     icon: '🥖' },
            { id: 'mancuernas', label: 'De Pie · Mancuernas', seedName: 'Curl de Bíceps (Mancuernas)',  icon: '💪' },
            { id: 'bayoneta',   label: 'De Pie · Bayoneta',   seedName: 'Curl de Bíceps Bayoneta',      icon: '💪' },
            { id: 'polea',      label: 'De Pie · Polea',      seedName: 'Curl de Bíceps en Polea',      icon: '🐍' },
        ],
    },
    {
        id: 'curl_predicador',
        name: 'Curl Predicador / Araña',
        muscle: 'BÍCEPS', icon: '🙏',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            // Inclinado sobre banco predicador (mismo ángulo, diferente equipo)
            { id: 'predicador_barra',   label: 'Predicador · Barra',   seedName: 'Curl Predicador (Barra)',   icon: '🙏' },
            { id: 'predicador_maquina', label: 'Predicador · Máquina', seedName: 'Curl Predicador (Máquina)', icon: '🤖' },
            // Spider (apoyo en banco inclinado boca abajo)
            { id: 'spider',             label: 'Araña (Spider)',        seedName: 'Curl Araña (Spider Curl)',  icon: '🕷️' },
        ],
    },
    {
        id: 'curl_martillo',
        name: 'Curl Martillo',
        muscle: 'BÍCEPS', icon: '🔨',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuernas', label: 'Mancuernas',  seedName: 'Curl Martillo (Mancuernas)',     icon: '🔨' },
            { id: 'cuerda',     label: 'Polea/Cuerda', seedName: 'Curl Martillo (Polea/Cuerda)', icon: '⛓️' },
        ],
    },
];

// ─────────────────────────── PIERNA ─────────────────────────────────────────
const PIERNA: BaseExercise[] = [
    {
        id: 'sentadilla',
        name: 'Sentadilla',
        muscle: 'PIERNA', icon: '🍑',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            // Por posición (cambia el ángulo de la cadera y el músculo trabajado)
            { id: 'barra_trasera', label: 'Barra Trasera',  seedName: 'Sentadilla Libre (Barra)', icon: '🍑' },
            { id: 'frontal',       label: 'Frontal',         seedName: 'Sentadilla Frontal',       icon: '🏋️' },
            { id: 'bulgara',       label: 'Búlgara',         seedName: 'Sentadilla Búlgara',       icon: '🇧🇬' },
            { id: 'hack_maquina',  label: 'Hack (Máquina)',  seedName: 'Sentadilla Hack (Máquina)', icon: '🪑' },
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
            { id: 'maquina', label: 'Sentado · Máquina', seedName: 'Extensiones de Cuádriceps', icon: '🦵' },
        ],
    },
    {
        id: 'curl_femoral',
        name: 'Curl Femoral',
        muscle: 'PIERNA', icon: '🥓',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            // Diferente posición → ángulo de cadera diferente → estira más o menos el recto femoral
            { id: 'tumbado',  label: 'Tumbado (Prono)',  seedName: 'Curl Femoral Tumbado (Máquina)',  icon: '🥓' },
            { id: 'sentado',  label: 'Sentado',           seedName: 'Curl Femoral Sentado (Máquina)',  icon: '🪑' },
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
        id: 'buenos_dias',
        name: 'Buenos Días',
        muscle: 'PIERNA', icon: '🌞',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra', label: 'Barra', seedName: 'Good Mornings (Buenos Días)', icon: '🌞' },
        ],
    },
];

// ─────────────────────────── GLÚTEOS ────────────────────────────────────────
const GLUTEOS: BaseExercise[] = [
    {
        id: 'hip_thrust',
        name: 'Hip Thrust',
        muscle: 'GLÚTEOS', icon: '🌉',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            // Misma posición (tumbado, cadera empujando hacia arriba) — distinto equipo
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

// ─────────────────────────── ABDOMINALES ────────────────────────────────────
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

// ─────────────────────────── CARDIO ─────────────────────────────────────────
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

// ─────────────────────────── Exports ────────────────────────────────────────

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

export const CATALOG_MUSCLES = [
    'PECHO', 'HOMBRO', 'TRÍCEPS', 'ESPALDA', 'BÍCEPS',
    'PIERNA', 'GLÚTEOS', 'ABDOMINALES', 'CARDIO',
] as const;

export type CatalogMuscle = typeof CATALOG_MUSCLES[number];

/** Find the base exercise that owns a given seed name (for the active-workout variant switcher) */
export const findBaseExercise = (seedName: string): BaseExercise | null => {
    const n = seedName.toLowerCase().trim();
    return CURATED_EXERCISES.find(b =>
        b.variants.some(v => v.seedName.toLowerCase() === n)
    ) ?? null;
};

// ── localStorage helpers ──────────────────────────────────────────────────────
const VARIANT_PREFS_KEY = 'ginx_variant_prefs';   // Record<baseId, variantId>
const USER_EXTRAS_KEY   = 'ginx_catalog_extras';  // string[] extra seedNames

export const getVariantPrefs = (): Record<string, string> => {
    try { return JSON.parse(localStorage.getItem(VARIANT_PREFS_KEY) || '{}'); }
    catch { return {}; }
};
export const saveVariantPref = (baseId: string, variantId: string): void => {
    const p = getVariantPrefs(); p[baseId] = variantId;
    localStorage.setItem(VARIANT_PREFS_KEY, JSON.stringify(p));
};

export const getUserExtras = (): string[] => {
    try { return JSON.parse(localStorage.getItem(USER_EXTRAS_KEY) || '[]'); }
    catch { return []; }
};
export const addUserExtra = (seedName: string): void => {
    const e = getUserExtras();
    if (!e.includes(seedName)) { e.push(seedName); localStorage.setItem(USER_EXTRAS_KEY, JSON.stringify(e)); }
};

export const getPreferredSeedName = (base: BaseExercise): string => {
    const prefs = getVariantPrefs();
    const id = prefs[base.id];
    return (id ? base.variants.find(v => v.id === id) : null)?.seedName ?? base.variants[0].seedName;
};

/** All seedNames from COMMON_EQUIPMENT_SEEDS that are NOT covered by any curated variant */
export const getExtrasForMuscle = (muscle: string, allSeeds: { name: string; targetMuscle: string }[]): string[] => {
    const curatedNames = new Set(
        CURATED_EXERCISES
            .filter(b => b.muscle === muscle)
            .flatMap(b => b.variants.map(v => v.seedName.toLowerCase()))
    );
    return allSeeds
        .filter(s => {
            const m = s.targetMuscle?.toUpperCase();
            const match =
                muscle === 'PIERNA'      ? ['PIERNA', 'CUÁDRICEPS', 'ISQUIOTIBIALES'].includes(m) :
                muscle === 'ABDOMINALES' ? m === 'ABDOMINALES' :
                muscle === 'GLÚTEOS'     ? m === 'GLÚTEOS' :
                muscle === 'CARDIO'      ? m === 'CARDIO' :
                m === muscle;
            return match && !curatedNames.has(s.name.toLowerCase());
        })
        .map(s => s.name);
};
