/**
 * exerciseCatalog.ts
 *
 * Thin config layer — re-exports the auto-generated catalog from catalogData.ts
 * and keeps: muscle order, backward-compat seed aliases, and localStorage helpers.
 *
 * TO ADD A NEW EXERCISE: add image(s) to public/ejercicioimg/ejercicios/ and run:
 *   npm run catalog
 * No code changes needed here.
 */

import { CATALOG_DATA, type CatalogExercise, type CatalogVariant } from './catalogData';

// ── Public types (kept backward-compatible) ──────────────────────────────────

export interface ExerciseVariant {
    id: string;
    label: string;
    seedName: string;
    icon: string;           // emoji fallback (from muscle group default)
    imagePath?: string;     // direct image URL from filesystem (new)
    isLocked?: boolean;
}

export interface BaseExercise {
    id: string;
    name: string;
    muscle: string;
    icon: string;
    metrics: { weight: boolean; reps: boolean; time: boolean; distance: boolean; rpe: boolean };
    imagePath?: string;
    variants: ExerciseVariant[];
}

// ── Re-export the auto-generated data ────────────────────────────────────────

export const CURATED_EXERCISES: BaseExercise[] = CATALOG_DATA.map((ex: CatalogExercise) => ({
    id:       ex.id,
    name:     ex.name,
    muscle:   ex.muscle,
    icon:     ex.icon,
    metrics:  ex.metrics,
    imagePath: ex.imagePath,
    variants: ex.variants.map((v: CatalogVariant) => ({
        id:        v.id,
        label:     v.label,
        seedName:  v.seedName,
        icon:      ex.icon,  // inherit muscle-group icon
        imagePath: v.imagePath,
        isLocked:  v.isLocked,
    })),
}));

// ── Muscle display order ──────────────────────────────────────────────────────

export const CATALOG_MUSCLES = [
    'PECHO', 'ESPALDA', 'HOMBRO', 'TRÍCEPS',
    'CUÁDRICEPS', 'ISQUIOTIBIALES', 'GLÚTEOS', 'PANTORRILLAS',
    'BÍCEPS', 'ANTEBRAZO', 'ABDOMINALES', 'CUELLO', 'CARDIO',
] as const;

export type CatalogMuscle = typeof CATALOG_MUSCLES[number];

// ── Backward-compat seed aliases ──────────────────────────────────────────────
// Maps OLD hardcoded seedNames → new filesystem-derived seedNames.
// Used when loading routines saved before the filesystem-driven refactor.

export const SEED_ALIASES: Record<string, string> = {
    // PECHO
    'Smith Press Inclinado':                        'Press Inclinado (Smith)',
    'Press Banca Plano (Barra)':                    'Press Plano (Barra)',
    'Press Banca Plano (Mancuernas)':               'Press Plano (Mancuernas)',
    'Press de Pecho (Máquina)':                     'Press Plano (Máquina)',
    'Smith Press Plano':                            'Press Plano (Smith)',
    'Press Declinado (Polea/Cable)':                'Press Declinado (Polea Cable)',
    'Cruce de Poleas (Crossover Alto)':             'Cruce de Poleas (Polea Alta)',
    'Crossover en Polea Baja':                      'Cruce de Poleas (Polea Baja)',
    'Peck Deck (Mariposa)':                         'Peck Deck Mariposa',
    'Fondos (Dips)':                                'Fondos (Libre)',
    'Fondos Asistidos (Pecho)':                     'Fondos (Asistido Máquina)',
    // ESPALDA
    'Jalón al Pecho (Polea Alta)':                  'Jalón (Polea Alta)',
    'Jalón al Pecho (Agarre Estrecho)':             'Jalón (Agarre Estrecho)',
    'Dominadas (Pullups)':                          'Dominadas (Libre)',
    'Dominadas Asistidas (Máquina)':                'Dominadas (Asistida)',
    'Pull-Over en Polea':                           'Pull Over Polea',
    'Remo con Barra Yates':                         'Remo con Barra (Barra Yates)',
    'Remo en T (Barra/Máquina)':                    'Remo con Barra (T-Barra)',
    'Remo con Mancuerna (Unilateral)':              'Remo con Barra (Mancuernas)',
    'Remo Gironda (Polea Baja)':                    'Remo Sentado (Gironda)',
    'Remo en Máquina (Pecho Apoyado)':              'Remo Sentado (Pecho Apoyado)',
    'Peso Muerto (Deadlift)':                       'Peso Muerto (Convencional)',
    'Peso Muerto con Barra Hexagonal':              'Peso Muerto (Hexagonal)',
    'Peso Muerto Sumo con Barra':                   'Peso Muerto (Sumo)',
    'Encogimiento de Hombros con Barra':            'Encogimientos (Barra)',
    'Encogimiento de Hombros con Mancuernas':       'Encogimientos (Mancuernas)',
    // HOMBRO
    'Press de Hombros (Máquina)':                   'Press Militar (Máquina)',
    'Press Militar en Smith':                       'Press Militar (Smith)',
    'Elevación Frontal con Mancuerna (Dos Manos)':  'Elevaciones Frontales (Mancuerna Dos Manos)',
    'Elevación Frontal con Disco (Dos Manos)':      'Elevaciones Frontales (Disco Dos Manos)',
    'Pájaros / Vuelos (Mancuernas)':                'Pájaros Vuelos Posterior',
    // CUÁDRICEPS
    'Sentadilla Libre (Barra)':                     'Sentadilla (Barra Trasera)',
    'Sentadilla Frontal':                           'Sentadilla (Frontal)',
    'Sentadilla Hack (Máquina)':                    'Sentadilla (Hack Máquina)',
    'Sentadilla Búlgara':                           'Zancadas (Búlgara)',
    'Prensa de Piernas (45°)':                      'Prensa Piernas 45',
    'Extensiones de Cuádriceps':                    'Extensiones Cuádriceps',
    'Zancadas / Lunges (Mancuernas)':               'Zancadas (Mancuernas)',
    'Zancadas / Lunges (Barra)':                    'Zancadas (Barra)',
    'Zancadas en Smith':                            'Zancadas (Smith)',
    'Step Up con Mancuernas':                       'Step Up',
    // ISQUIOTIBIALES
    'Peso Muerto Rumano (Barra)':                   'Peso Muerto (Convencional)',
    'Peso Muerto Rumano (Mancuernas)':              'Peso Muerto (Convencional)',
    'Curl Femoral Tumbado (Máquina)':               'Curl Femoral Tumbado',
    'Curl Femoral Sentado (Máquina)':               'Curl Femoral Sentado',
    'Good Mornings (Buenos Días)':                  'Buenos Días',
    // GLÚTEOS
    'Hip Thrust (Barra Libre)':                     'Hip Thrust (Barra)',
    'Abducción de Cadera (Polea)':                  'Abducción de Cadera',
    'Abducción de Cadera (Máquina)':                'Abducción de Cadera',
    'Elevación de Rana (Frog Pump)':                'Elevación de Rana',
    'Columpios con Kettlebell':                     'Columpios Kettlebell',
    'Caminata de Pato':                             'Caminata de Pato',
    // BÍCEPS
    'Curl de Bíceps con Barra':                     'Curl Normal (Barra)',
    'Curl de Bíceps Bayoneta':                      'Curl Bayoneta',
    'Curl de Bíceps (Mancuernas)':                  'Curl Normal (Mancuernas)',
    'Curl Martillo (Mancuernas)':                   'Martillo (Mancuernas)',
    'Curl Araña (Spider Curl)':                     'Curl Spider',
    'Curl Predicador (Barra)':                      'Predicador (Barra)',
    'Curl Predicador (Máquina)':                    'Predicador (Máquina)',
    'Curl de Cable en Polea Baja (Una Mano)':       'Curl Normal (Polea Baja)',
    'Curl de Cable en Polea Alta (De Pie)':         'Curl Normal (Polea Alta)',
    'Curl Martillo (Polea/Cuerda)':                 'Martillo (Cuerda)',
    'Curl de Bíceps en Polea':                      'Curl Normal (Polea Baja)',
    // TRÍCEPS
    'Extensiones de Tríceps (Polea/Cuerda)':        'Extensiones en Polea (Cuerda)',
    'Extensión de Tríceps con Cable (Una Mano)':    'Extensiones en Polea (Una Mano)',
    'Press Francés (Barra Z)':                      'Press Francés (Barra Z Acostado)',
    'Press Francés Sentado con Barra':              'Press Francés (Barra Z Sentado)',
    'Copa a dos manos (Mancuerna)':                 'Copa (Dos Manos)',
    'Copa a una mano (Mancuerna)':                  'Copa (Una Mano)',
    'Fondos en Paralelas':                          'Fondos (Paralelas)',
    'Fondos en Bancos':                             'Fondos (Bancos)',
    'Patada de Tríceps (Mancuerna)':                'Patada de Tríceps',
    // ABDOMINALES
    'Crunch Abdominal':                             'Crunch (Estándar)',
    'Crunch Oblicuo':                               'Crunch Oblicuo (Estándar)',
    'Crunch en Máquina':                            'Crunch (Máquina)',
    'Crunch en Polea Alta':                         'Crunch (Polea Alta)',
    'Elevación de Piernas (Colgado)':               'Elevación de Piernas',
    'Encogimientos de Rodillas (Abs)':              'Crunch Inverso (Encogimientos de Rodillas)',
    'Plancha (Plank)':                              'Plancha (Estática)',
    'Plancha con Flexión':                          'Plancha (Con Flexión)',
    // CARDIO
    'Cardio (Bicicleta)':                           'Caminadoras (Bicicleta)',
    'Cardio (Cinta de Correr)':                     'Caminadoras (Cinta)',
    'Cardio (Elíptica)':                            'Caminadoras (Elíptica)',
    'Cardio (Escaladora)':                          'Caminadoras (Escaladora)',
    'Cardio (Remo)':                                'Remo',
    'Cardio (Saltar Cuerda)':                       'Salto a la Cuerda',
    // PANTORRILLAS
    'Elevación de Gemelos de Pie (Máquina)':        'Elevación de Pie (Máquina)',
    'Elevación de Gemelos de Pie (Smith)':          'Elevación de Pie (Smith)',
    'Elevación de Gemelos Sentado (Máquina)':       'Elevación Sentado',
    // ANTEBRAZO
    'Curl de Muñeca con Barra':                     'Curl de Muñeca',
    'Curl de Barra Invertido':                      'Extensión de Muñeca (Invertido)',
    'Extensión de Muñeca con Barra':                'Extensión de Muñeca (Supino)',
    // CUELLO
    'Flexiones de Cuello con Disco':                'Flexión con Disco',
    'Extensiones de Cuello con Disco':              'Extensión con Disco',
    'Arnés de Cuello (Neck Harness)':               'Arnés de Cuello',
    'Encogimientos de Hombros con Barra (Trapecios)':       'Encogimientos (Barra)',
    'Encogimientos de Hombros con Mancuernas (Trapecios)':  'Encogimientos (Mancuernas)',
};

/** Resolve a seedName: if it's an old alias, return the current seedName */
export const resolveSeedName = (name: string): string => SEED_ALIASES[name] ?? name;

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Find which base exercise a given seed name belongs to */
export const findBaseExercise = (seedName: string): BaseExercise | null => {
    const resolved = resolveSeedName(seedName);
    const n = resolved.toLowerCase().trim();
    return CURATED_EXERCISES.find(b =>
        b.variants.some(v => v.seedName.toLowerCase() === n)
    ) ?? null;
};

/** Get the image path for a seedName (resolves aliases) */
export const getImageForSeed = (seedName: string): string | null => {
    const resolved = resolveSeedName(seedName);
    for (const ex of CURATED_EXERCISES) {
        const v = ex.variants.find(v => v.seedName === resolved);
        if (v?.imagePath) return v.imagePath;
    }
    return null;
};

// ── localStorage helpers ──────────────────────────────────────────────────────

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
