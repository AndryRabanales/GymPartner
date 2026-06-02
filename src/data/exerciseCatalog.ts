/**
 * Curated exercise catalog — one seedName per base exercise, zero duplicates.
 * Variants ordered: POSITION first, then EQUIPMENT within each position.
 */

export interface ExerciseVariant {
    id: string;
    label: string;
    seedName: string; // exact match in COMMON_EQUIPMENT_SEEDS — unique across entire catalog
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
const PECHO: BaseExercise[] = [
    {
        id: 'press_inclinado',
        name: 'Press Inclinado',
        muscle: 'PECHO', icon: '🏋️‍♂️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'maquina',    label: 'Máquina',     seedName: 'Press Inclinado (Máquina)',     icon: '🤖' },
            { id: 'mancuernas', label: 'Mancuernas',  seedName: 'Press Inclinado (Mancuernas)',  icon: '🏋️' },
            { id: 'barra',      label: 'Barra',        seedName: 'Press Inclinado (Barra)',       icon: '🏋️‍♂️' },
            { id: 'cable',      label: 'Polea/Cable',  seedName: 'Press Inclinado (Polea/Cable)', icon: '⛓️' },
            { id: 'smith',      label: 'Smith',        seedName: 'Smith Press Inclinado',         icon: '⚙️' },
        ],
    },
    {
        id: 'press_plano',
        name: 'Press Plano (Banca)',
        muscle: 'PECHO', icon: '🏋️‍♂️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',      label: 'Barra',       seedName: 'Press Banca Plano (Barra)',      icon: '🏋️‍♂️' },
            { id: 'mancuernas', label: 'Mancuernas',  seedName: 'Press Banca Plano (Mancuernas)', icon: '🏋️' },
            { id: 'maquina',    label: 'Máquina',     seedName: 'Press de Pecho (Máquina)',       icon: '🤖' },
            { id: 'cable',      label: 'Polea/Cable', seedName: 'Press Plano (Polea/Cable)',      icon: '⛓️' },
            { id: 'smith',      label: 'Smith',       seedName: 'Smith Press Plano',              icon: '⚙️' },
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
        id: 'cruce_poleas',
        name: 'Cruce de Poleas / Crossover',
        muscle: 'PECHO', icon: '⚔️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'alto', label: 'Polea Alta', seedName: 'Cruce de Poleas (Crossover Alto)', icon: '⚔️' },
            { id: 'bajo', label: 'Polea Baja', seedName: 'Crossover en Polea Baja',          icon: '⚔️' },
        ],
    },
    {
        id: 'peck_deck',
        name: 'Peck Deck Mariposa',
        muscle: 'PECHO', icon: '🦋',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'maquina', label: 'Máquina', seedName: 'Peck Deck (Mariposa)', icon: '🦋' },
        ],
    },
    {
        id: 'fondos_pecho',
        name: 'Fondos (Dips)',
        muscle: 'PECHO', icon: '🏗️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'libre',    label: 'Libre',    seedName: 'Fondos (Dips)',            icon: '🏗️' },
            { id: 'asistido', label: 'Asistido', seedName: 'Fondos Asistidos (Pecho)', icon: '🤖' },
        ],
    },
];

// ─────────────────────────── ESPALDA ────────────────────────────────────────
const ESPALDA: BaseExercise[] = [
    {
        id: 'jalon',
        name: 'Jalón al Pecho',
        muscle: 'ESPALDA', icon: '🔻',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'polea_alta',      label: 'Polea Alta',     seedName: 'Jalón al Pecho (Polea Alta)',        icon: '🔻' },
            { id: 'agarre_estrecho', label: 'Agarre Estrecho', seedName: 'Jalón al Pecho (Agarre Estrecho)', icon: '🔻' },
        ],
    },
    {
        id: 'dominadas',
        name: 'Dominadas (Pullups)',
        muscle: 'ESPALDA', icon: '🧗',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'libre',    label: 'Libre',    seedName: 'Dominadas (Pullups)',           icon: '🧗' },
            { id: 'asistida', label: 'Asistida', seedName: 'Dominadas Asistidas (Máquina)', icon: '🤖' },
        ],
    },
    {
        id: 'pullover',
        name: 'Pull-Over en Polea',
        muscle: 'ESPALDA', icon: '🎣',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'polea', label: 'Polea', seedName: 'Pull-Over en Polea', icon: '🎣' },
        ],
    },
    {
        id: 'remo_barra',
        name: 'Remo con Barra',
        muscle: 'ESPALDA', icon: '🚣',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'yates', label: 'Yates',    seedName: 'Remo con Barra Yates',       icon: '🚣' },
            { id: 'en_t',  label: 'T-Barra',  seedName: 'Remo en T (Barra/Máquina)',   icon: '⚓' },
        ],
    },
    {
        id: 'remo_mancuerna',
        name: 'Remo con Mancuerna',
        muscle: 'ESPALDA', icon: '👜',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'unilateral', label: 'Unilateral', seedName: 'Remo con Mancuerna (Unilateral)', icon: '👜' },
        ],
    },
    {
        id: 'remo_polea_maquina',
        name: 'Remo en Polea/Máquina',
        muscle: 'ESPALDA', icon: '🛶',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'gironda',  label: 'Gironda (Polea Baja)', seedName: 'Remo Gironda (Polea Baja)',         icon: '🛶' },
            { id: 'maquina',  label: 'Máquina Pecho Apoyado', seedName: 'Remo en Máquina (Pecho Apoyado)', icon: '🚜' },
        ],
    },
    {
        id: 'peso_muerto',
        name: 'Peso Muerto (Deadlift)',
        muscle: 'ESPALDA', icon: '🧟',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'convencional', label: 'Convencional', seedName: 'Peso Muerto (Deadlift)',           icon: '🧟' },
            { id: 'hexagonal',    label: 'Barra Hexagonal', seedName: 'Peso Muerto con Barra Hexagonal', icon: '⬡' },
            { id: 'sumo',         label: 'Sumo',         seedName: 'Peso Muerto Sumo con Barra',       icon: '🤼' },
        ],
    },
    {
        id: 'encogimientos_espalda',
        name: 'Encogimiento de Hombros',
        muscle: 'ESPALDA', icon: '🏋️‍♂️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',      label: 'Barra',      seedName: 'Encogimiento de Hombros con Barra',      icon: '🏋️‍♂️' },
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Encogimiento de Hombros con Mancuernas', icon: '🏋️' },
        ],
    },
];

// ─────────────────────────── HOMBRO ─────────────────────────────────────────
const HOMBRO: BaseExercise[] = [
    {
        id: 'press_hombros',
        name: 'Press Militar',
        muscle: 'HOMBRO', icon: '💂',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',      label: 'Barra',      seedName: 'Press Militar (Barra)',       icon: '💂' },
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Press Militar (Mancuernas)',  icon: '🏋️' },
            { id: 'maquina',    label: 'Máquina',    seedName: 'Press de Hombros (Máquina)',  icon: '🤖' },
            { id: 'smith',      label: 'Smith',      seedName: 'Press Militar en Smith',      icon: '⚙️' },
        ],
    },
    {
        id: 'elevaciones_frontales',
        name: 'Elevaciones Frontales',
        muscle: 'HOMBRO', icon: '🧟‍♂️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuernas',  label: 'Mancuernas (Unilateral)', seedName: 'Elevaciones Frontales (Mancuernas)',           icon: '🧟‍♂️' },
            { id: 'dos_manos',   label: 'Mancuerna Dos Manos',     seedName: 'Elevación Frontal con Mancuerna (Dos Manos)', icon: '🧟‍♂️' },
            { id: 'disco',       label: 'Disco Dos Manos',          seedName: 'Elevación Frontal con Disco (Dos Manos)',     icon: '🧟‍♂️' },
            { id: 'polea',       label: 'Polea',                    seedName: 'Elevaciones Frontales (Polea)',               icon: '🧟‍♂️' },
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
        id: 'pajaros',
        name: 'Pájaros / Vuelos (Posterior)',
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

// ─────────────────────────── PIERNA ─────────────────────────────────────────
const PIERNA: BaseExercise[] = [
    {
        id: 'sentadilla',
        name: 'Sentadilla',
        muscle: 'PIERNA', icon: '🍑',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'libre_barra', label: 'Libre Barra',  seedName: 'Sentadilla Libre (Barra)',   icon: '🍑' },
            { id: 'frontal',     label: 'Frontal',       seedName: 'Sentadilla Frontal',         icon: '🏋️' },
            { id: 'hack',        label: 'Hack Máquina',  seedName: 'Sentadilla Hack (Máquina)',  icon: '🪑' },
            { id: 'bulgara',     label: 'Búlgara',       seedName: 'Sentadilla Búlgara',         icon: '🇧🇬' },
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
        id: 'curl_femoral',
        name: 'Curl Femoral',
        muscle: 'PIERNA', icon: '🥓',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'tumbado', label: 'Tumbado (Máquina)', seedName: 'Curl Femoral Tumbado (Máquina)', icon: '🥓' },
            { id: 'sentado', label: 'Sentado (Máquina)', seedName: 'Curl Femoral Sentado (Máquina)', icon: '🪑' },
        ],
    },
    {
        id: 'buenos_dias',
        name: 'Good Mornings (Buenos Días)',
        muscle: 'PIERNA', icon: '🌞',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra', label: 'Barra', seedName: 'Good Mornings (Buenos Días)', icon: '🌞' },
        ],
    },
    {
        id: 'step_up',
        name: 'Step Up',
        muscle: 'PIERNA', icon: '🚶',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Step Up con Mancuernas', icon: '🚶' },
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
            { id: 'barra',   label: 'Barra',   seedName: 'Hip Thrust (Barra Libre)', icon: '🌉' },
            { id: 'maquina', label: 'Máquina', seedName: 'Hip Thrust (Máquina)',     icon: '🤖' },
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
    {
        id: 'abduccion_cadera',
        name: 'Abducción de Cadera',
        muscle: 'GLÚTEOS', icon: '🍑',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'polea',   label: 'Polea',   seedName: 'Abducción de Cadera (Polea)',   icon: '⛓️' },
            { id: 'maquina', label: 'Máquina', seedName: 'Abducción de Cadera (Máquina)', icon: '🤖' },
        ],
    },
    {
        id: 'rana_gluteo',
        name: 'Elevación de Rana (Frog Pump)',
        muscle: 'GLÚTEOS', icon: '🐸',
        metrics: { weight: false, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'peso_corporal', label: 'Peso Corporal', seedName: 'Elevación de Rana (Frog Pump)', icon: '🐸' },
        ],
    },
    {
        id: 'columpios',
        name: 'Columpios / Swings',
        muscle: 'GLÚTEOS', icon: '🔔',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'kettlebell', label: 'Kettlebell', seedName: 'Columpios con Kettlebell', icon: '🔔' },
        ],
    },
    {
        id: 'caminata_pato',
        name: 'Caminata de Pato',
        muscle: 'GLÚTEOS', icon: '🦆',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'libre', label: 'Libre', seedName: 'Caminata de Pato', icon: '🦆' },
        ],
    },
];

// ─────────────────────────── BÍCEPS ─────────────────────────────────────────
const BICEPS: BaseExercise[] = [
    {
        id: 'curl_barra',
        name: 'Curl con Barra',
        muscle: 'BÍCEPS', icon: '🥖',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'recta', label: 'Recta',  seedName: 'Curl de Bíceps con Barra', icon: '🥖' },
            { id: 'ez',    label: 'Z / EZ', seedName: 'Curl de Bíceps Bayoneta',  icon: '💪' },
        ],
    },
    {
        id: 'curl_mancuernas',
        name: 'Curl con Mancuernas',
        muscle: 'BÍCEPS', icon: '💪',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'supino',   label: 'Supino',      seedName: 'Curl de Bíceps (Mancuernas)',  icon: '💪' },
            { id: 'martillo', label: 'Martillo',    seedName: 'Curl Martillo (Mancuernas)',    icon: '🔨' },
            { id: 'spider',   label: 'Spider Curl', seedName: 'Curl Araña (Spider Curl)',      icon: '🕷️' },
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
        id: 'curl_cable',
        name: 'Curl en Cable / Polea',
        muscle: 'BÍCEPS', icon: '🐍',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'polea_baja', label: 'Polea Baja (Una Mano)', seedName: 'Curl de Cable en Polea Baja (Una Mano)', icon: '💪' },
            { id: 'polea_alta', label: 'Polea Alta (De Pie)',   seedName: 'Curl de Cable en Polea Alta (De Pie)',   icon: '💪' },
            { id: 'martillo_cable', label: 'Martillo Cuerda',   seedName: 'Curl Martillo (Polea/Cuerda)',           icon: '⛓️' },
            { id: 'bayoneta_polea', label: 'Bayoneta Polea',    seedName: 'Curl de Bíceps en Polea',               icon: '🐍' },
        ],
    },
];

// ─────────────────────────── TRÍCEPS ────────────────────────────────────────
const TRICEPS: BaseExercise[] = [
    {
        id: 'extension_cable',
        name: 'Extensiones en Polea/Cable',
        muscle: 'TRÍCEPS', icon: '🏇',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'cuerda',    label: 'Cuerda',       seedName: 'Extensiones de Tríceps (Polea/Cuerda)',     icon: '🏇' },
            { id: 'barra',     label: 'Barra Recta',  seedName: 'Extensiones de Tríceps (Barra Recta)',      icon: '🦯' },
            { id: 'una_mano',  label: 'A Una Mano',   seedName: 'Extensión de Tríceps con Cable (Una Mano)', icon: '🏇' },
        ],
    },
    {
        id: 'press_frances',
        name: 'Press Francés',
        muscle: 'TRÍCEPS', icon: '🇫🇷',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra_z_acostado', label: 'Barra Z Acostado', seedName: 'Press Francés (Barra Z)',          icon: '🇫🇷' },
            { id: 'barra_z_sentado',  label: 'Barra Z Sentado',  seedName: 'Press Francés Sentado con Barra',  icon: '🇫🇷' },
            { id: 'mancuernas',       label: 'Mancuernas',       seedName: 'Press Francés (Mancuernas)',        icon: '🇫🇷' },
        ],
    },
    {
        id: 'copa_overhead',
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
            { id: 'paralelas', label: 'Paralelas', seedName: 'Fondos en Paralelas', icon: '🛋️' },
            { id: 'bancos',    label: 'En Banco',  seedName: 'Fondos en Bancos',    icon: '🛋️' },
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

// ─────────────────────────── ABDOMINALES ────────────────────────────────────
const ABDOMINALES: BaseExercise[] = [
    {
        id: 'crunch',
        name: 'Crunch',
        muscle: 'ABDOMINALES', icon: '🥨',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'estandar', label: 'Estándar', seedName: 'Crunch Abdominal',      icon: '🥨' },
            { id: 'oblicuo',  label: 'Oblicuo',  seedName: 'Crunch Oblicuo',         icon: '🥨' },
            { id: 'maquina',  label: 'Máquina',  seedName: 'Crunch en Máquina',      icon: '🤖' },
            { id: 'polea',    label: 'Polea Alta',seedName: 'Crunch en Polea Alta',  icon: '🙇' },
        ],
    },
    {
        id: 'elevacion_piernas',
        name: 'Elevación de Piernas Colgado',
        muscle: 'ABDOMINALES', icon: '🥒',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'colgado', label: 'Colgado', seedName: 'Elevación de Piernas (Colgado)', icon: '🥒' },
        ],
    },
    {
        id: 'encogimientos_rodillas',
        name: 'Encogimientos de Rodillas',
        muscle: 'ABDOMINALES', icon: '🦵',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'suelo', label: 'Suelo', seedName: 'Encogimientos de Rodillas (Abs)', icon: '🦵' },
        ],
    },
    {
        id: 'plancha',
        name: 'Plancha (Plank)',
        muscle: 'ABDOMINALES', icon: '🪵',
        metrics: { weight: false, reps: true, time: true, distance: false, rpe: false },
        variants: [
            { id: 'estatica',    label: 'Estática',     seedName: 'Plancha (Plank)',      icon: '🪵' },
            { id: 'con_flexion', label: 'Con Flexión',  seedName: 'Plancha con Flexión',  icon: '🪵' },
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
];

// ─────────────────────────── CARDIO ─────────────────────────────────────────
const CARDIO: BaseExercise[] = [
    { id: 'cinta',     name: 'Cinta de Correr',    muscle: 'CARDIO', icon: '🏃', metrics: { weight: false, reps: false, time: true, distance: true, rpe: false }, variants: [{ id: 'cinta',     label: 'Cinta',      seedName: 'Cinta de Correr',          icon: '🏃' }] },
    { id: 'bicicleta', name: 'Bicicleta Estática',  muscle: 'CARDIO', icon: '🚴', metrics: { weight: false, reps: false, time: true, distance: true, rpe: false }, variants: [{ id: 'estatica',  label: 'Estática',   seedName: 'Bicicleta Estática',       icon: '🚴' }] },
    { id: 'eliptica',  name: 'Elíptica',             muscle: 'CARDIO', icon: '⛷️', metrics: { weight: false, reps: false, time: true, distance: true, rpe: false }, variants: [{ id: 'eliptica',  label: 'Elíptica',   seedName: 'Elíptica',                 icon: '⛷️' }] },
    { id: 'remo_c2',   name: 'Remo (Cardio)',        muscle: 'CARDIO', icon: '🚣', metrics: { weight: false, reps: false, time: true, distance: true, rpe: false }, variants: [{ id: 'concept2',  label: 'Concept2',   seedName: 'Remo (Concept2)',           icon: '🚣' }] },
    { id: 'escaladora',name: 'Escaladora',           muscle: 'CARDIO', icon: '🧗', metrics: { weight: false, reps: false, time: true, distance: true, rpe: false }, variants: [{ id: 'stairmaster',label: 'Stairmaster',seedName: 'Escaladora (Stairmaster)',  icon: '🧗' }] },
    { id: 'cuerda',    name: 'Salto a la Cuerda',   muscle: 'CARDIO', icon: '🪢', metrics: { weight: false, reps: false, time: true, distance: false, rpe: false }, variants: [{ id: 'cuerda',    label: 'Cuerda',     seedName: 'Salto de Cuerda',          icon: '🪢' }] },
];

// ─────────────────────────── GEMELOS ────────────────────────────────────────
const GEMELOS: BaseExercise[] = [
    {
        id: 'elevacion_gemelos',
        name: 'Elevación de Gemelos',
        muscle: 'PANTORRILLAS', icon: '🦵',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'de_pie_maquina', label: 'De Pie · Máquina', seedName: 'Elevación de Gemelos de Pie (Máquina)', icon: '🦵' },
            { id: 'de_pie_smith',   label: 'De Pie · Smith',   seedName: 'Elevación de Gemelos de Pie (Smith)',   icon: '⚙️' },
            { id: 'sentado',        label: 'Sentado',           seedName: 'Elevación de Gemelos Sentado (Máquina)', icon: '🦵' },
        ],
    },
];

// ─────────────────────────── ANTEBRAZO ──────────────────────────────────────
const ANTEBRAZO: BaseExercise[] = [
    {
        id: 'curl_muneca',
        name: 'Curl de Muñeca',
        muscle: 'ANTEBRAZO', icon: '🦾',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'supino',    label: 'Supino (Sentado)',   seedName: 'Curl de Muñeca con Barra',  icon: '🦾' },
            { id: 'invertido', label: 'Invertido (Prono)',  seedName: 'Curl de Barra Invertido',   icon: '💪' },
        ],
    },
    {
        id: 'extension_muneca',
        name: 'Extensión de Muñeca',
        muscle: 'ANTEBRAZO', icon: '🦾',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'sentado', label: 'Sentado', seedName: 'Extensión de Muñeca con Barra', icon: '🦾' },
        ],
    },
];

// ─────────────────────────── CUELLO ─────────────────────────────────────────
const CUELLO: BaseExercise[] = [
    {
        id: 'flexion_extension_disco',
        name: 'Flexión / Extensión con Disco',
        muscle: 'CUELLO', icon: '💆',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'flexion',   label: 'Flexión Cervical',   seedName: 'Flexiones de Cuello con Disco',   icon: '💆' },
            { id: 'extension', label: 'Extensión Cervical', seedName: 'Extensiones de Cuello con Disco', icon: '💆' },
        ],
    },
    {
        id: 'arnes_cuello',
        name: 'Arnés de Cuello (Neck Harness)',
        muscle: 'CUELLO', icon: '🔗',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'arnes', label: 'Arnés', seedName: 'Arnés de Cuello (Neck Harness)', icon: '🔗' },
        ],
    },
    {
        id: 'shrugs_cuello',
        name: 'Encogimientos (Trapecios)',
        muscle: 'CUELLO', icon: '🏋️‍♂️',
        metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
        variants: [
            { id: 'barra',      label: 'Barra',      seedName: 'Encogimientos de Hombros con Barra (Trapecios)',      icon: '🏋️‍♂️' },
            { id: 'mancuernas', label: 'Mancuernas', seedName: 'Encogimientos de Hombros con Mancuernas (Trapecios)', icon: '🏋️' },
        ],
    },
];

// ─────────────────────────── Exports ────────────────────────────────────────

export const CURATED_EXERCISES: BaseExercise[] = [
    ...PECHO,
    ...ESPALDA,
    ...HOMBRO,
    ...PIERNA,
    ...GLUTEOS,
    ...BICEPS,
    ...TRICEPS,
    ...ABDOMINALES,
    ...CARDIO,
    ...GEMELOS,
    ...ANTEBRAZO,
    ...CUELLO,
];

export const CATALOG_MUSCLES = [
    'PECHO', 'ESPALDA', 'HOMBRO', 'TRÍCEPS',
    'CUÁDRICEPS', 'ISQUIOTIBIALES', 'GLÚTEOS', 'PANTORRILLAS',
    'BÍCEPS', 'ANTEBRAZO', 'ABDOMINALES', 'CUELLO', 'CARDIO',
] as const;

export type CatalogMuscle = typeof CATALOG_MUSCLES[number];

/** Find which base exercise a given seed name belongs to (for active-workout variant switcher) */
export const findBaseExercise = (seedName: string): BaseExercise | null => {
    const n = seedName.toLowerCase().trim();
    return CURATED_EXERCISES.find(b =>
        b.variants.some(v => v.seedName.toLowerCase() === n)
    ) ?? null;
};

// ── localStorage helpers ─────────────────────────────────────────────────────
const VARIANT_PREFS_KEY = 'ginx_variant_prefs';
const USER_EXTRAS_KEY   = 'ginx_catalog_extras';

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

/** Seeds NOT in the curated catalog for a given ArsenalGrid section name */
export const getExtrasForMuscle = (section: string, allSeeds: { name: string; targetMuscle?: string }[]): string[] => {
    // Map ArsenalGrid section names to the catalog muscle group (for filtering)
    const sectionMap: Record<string, string[]> = {
        'CUÁDRICEPS':    ['PIERNA'],
        'ISQUIOTIBIALES':['PIERNA'],
        'PANTORRILLAS':  ['GEMELOS', 'PANTORRILLAS'],
        'GLÚTEOS':       ['GLÚTEOS'],
        'ABDOMINALES':   ['ABDOMINALES'],
        'CUELLO':        ['CUELLO'],
        'ANTEBRAZO':     ['ANTEBRAZO'],
        'BÍCEPS':        ['BÍCEPS'],
        'TRÍCEPS':       ['TRÍCEPS'],
        'ESPALDA':       ['ESPALDA'],
        'HOMBRO':        ['HOMBRO'],
        'PECHO':         ['PECHO'],
        'CARDIO':        ['CARDIO'],
    };
    const muscles = sectionMap[section] ?? [section];
    const curatedNames = new Set(
        CURATED_EXERCISES
            .filter(b => muscles.includes(b.muscle))
            .flatMap(b => b.variants.map(v => v.seedName.toLowerCase()))
    );
    return allSeeds
        .filter(s => !curatedNames.has((s.name || '').toLowerCase()))
        .map(s => s.name);
};
