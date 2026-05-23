import type { Equipment, CustomSettings } from '../services/GymEquipmentService';

export const normalizeText = (text: any) => {
    if (!text || typeof text !== 'string') return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export const getMuscleGroup = (item: Equipment | { name: string, category: string }, userSettings?: CustomSettings): string => {
    const n = normalizeText(item.name);

    // 1. Check Explicit Target Muscle Group (Seed or DB field)
    // @ts-ignore
    const targetMuscle = item.target_muscle_group || item.targetMuscle;
    if (targetMuscle) {
        const tm = normalizeText(targetMuscle);
        if (tm === 'pecho') return 'PECHO';
        if (tm === 'espalda') return 'ESPALDA';
        if (tm === 'pierna' || tm === 'cuadriceps') return 'CUÁDRICEPS';
        if (tm === 'isquiotibiales') return 'ISQUIOTIBIALES';
        if (tm === 'gluteos' || tm === 'gluteo') return 'GLÚTEOS';
        if (tm === 'pantorrillas') return 'PANTORRILLAS';
        if (tm === 'aductores') return 'ADUCTORES';
        if (tm === 'hombro') return 'HOMBRO';
        if (tm === 'triceps') return 'TRÍCEPS';
        if (tm === 'biceps') return 'BÍCEPS';
        if (tm === 'antebrazo') return 'ANTEBRAZO';
        if (tm === 'abdominales' || tm === 'abdomen') return 'ABDOMINALES';
        if (tm === 'lumbares') return 'LUMBARES';
        if (tm === 'cuello') return 'CUELLO';
        if (tm === 'cardio') return 'Cardio';
    }

    // 2. Check Custom Categories
    if (userSettings && userSettings.categories) {
        const matchedCategory = userSettings.categories.find(c => c.id === item.category);
        if (matchedCategory) return matchedCategory.label;
    }

    // 2. Granular Keyword Matching (Highest Priority)
    if (n.includes('abdominal') || n.includes('crunch') || n.includes('plancha') || n.includes('core')) return 'ABDOMINALES';
    if (n.includes('lumbar') || n.includes('hiperextension') || n.includes('espalda baja')) return 'LUMBARES';
    if (n.includes('cuello') || n.includes('neck')) return 'CUELLO';
    
    if (n.includes('cuadricep') || n.includes('extension de pierna') || n.includes('sentadilla') || n.includes('squat') || n.includes('hack') || n.includes('prensa')) return 'CUÁDRICEPS';
    if (n.includes('isquio') || n.includes('femoral') || n.includes('peso muerto rumano')) return 'ISQUIOTIBIALES';
    if (n.includes('gluteo') || n.includes('hip thrust') || n.includes('patada de gluteo')) return 'GLÚTEOS';
    if (n.includes('pantorrilla') || n.includes('gemelo') || n.includes('costurera')) return 'PANTORRILLAS';
    if (n.includes('aductor') || n.includes('abductor')) return 'ADUCTORES';

    if (n.includes('hombro') || n.includes('militar') || n.includes('lateral') || n.includes('press de hombro') || n.includes('trasnuca') || n.includes('pajaros') || n.includes('face pull')) return 'HOMBRO';
    if (n.includes('tricep') || n.includes('copa') || n.includes('fondos') || n.includes('frances') || n.includes('extension polea alta')) return 'TRÍCEPS';
    if (n.includes('bicep') || n.includes('curl') || n.includes('predicador') || n.includes('martillo')) return 'BÍCEPS';
    if (n.includes('antebrazo') || n.includes('muñeca')) return 'ANTEBRAZO';

    if (n.includes('banca') || n.includes('pecho') || n.includes('chest') || n.includes('apertura') || n.includes('press inclinado') || n.includes('press plano') || n.includes('pec deck')) return 'PECHO';
    if (n.includes('espalda') || n.includes('jalon') || n.includes('remo') || n.includes('dorsal') || n.includes('dominada') || n.includes('t-bar')) return 'ESPALDA';

    // 3. Fallback to Category Enums
    if (item.category === 'CHEST') return 'PECHO';
    if (item.category === 'BACK') return 'ESPALDA';
    if (item.category === 'LEGS') return 'CUÁDRICEPS';
    if (item.category === 'GLUTES') return 'GLÚTEOS';
    if (item.category === 'CALVES') return 'PANTORRILLAS';
    if (item.category === 'SHOULDERS') return 'HOMBRO';
    if (item.category === 'FOREARMS') return 'ANTEBRAZO';
    if (item.category === 'ARMS') return 'BÍCEPS';
    if (item.category === 'CARDIO') return 'Cardio';

    return 'Otros';
};
