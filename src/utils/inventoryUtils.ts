import type { Equipment, CustomSettings } from '../services/GymEquipmentService';

export const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export const getMuscleGroup = (item: Equipment | { name: string, category: string }, userSettings?: CustomSettings): string => {
    const n = normalizeText(item.name);

    // 1. Check Custom Categories (Safety Check for userSettings)
    if (userSettings?.categories) {
        const matchedCategory = userSettings.categories.find(c => c.id === item.category);
        if (matchedCategory) return matchedCategory.label;
    }

    // 2. Explicit Category Mapping (Standard)
    if (item.category === 'CHEST') return 'Pecho';
    if (item.category === 'BACK') return 'Espalda';
    if (item.category === 'LEGS' || item.category === 'GLUTES' || item.category === 'CALVES') return 'Pierna';
    if (item.category === 'SHOULDERS') return 'Hombros';
    if (item.category === 'FOREARMS') return 'Antebrazo';
    if (item.category === 'ARMS') {
        if (n.includes('tricep') || n.includes('copa') || n.includes('fondos')) return 'Tríceps';
        return 'Bíceps';
    }

    // 3. Fallback Keyword Matching
    if (item.category === 'CARDIO') return 'Cardio';
    if (n.includes('jalon') || n.includes('remo') || n.includes('espalda') || n.includes('dorsal') || n.includes('lumbares') || n.includes('dominada') || n.includes('pull over') || n.includes('hyper')) return 'Espalda';
    if (n.includes('banca') || n.includes('pecho') || n.includes('chest') || n.includes('flexion') || n.includes('press plano') || n.includes('press inclinado') || n.includes('press declinado') || n.includes('pec deck') || n.includes('cruce de poleas') || n.includes('apertura')) return 'Pecho';
    if (n.includes('pierna') || n.includes('sentadilla') || n.includes('squat') || n.includes('femoral') || n.includes('cuadriceps') || n.includes('gemelo') || n.includes('gluteo') || n.includes('hack') || n.includes('pantorrilla') || n.includes('hip thrust') || n.includes('prensa')) return 'Pierna';
    if (n.includes('hombro') || n.includes('militar') || n.includes('lateral') || n.includes('press de hombro') || n.includes('trasnuca') || n.includes('face pull') || n.includes('pajaros')) return 'Hombros';
    if (n.includes('bicep') || n.includes('curl') || n.includes('predicador')) return 'Bíceps';
    if (n.includes('tricep') || n.includes('copa') || n.includes('fondos') || n.includes('frances')) return 'Tríceps';
    if (n.includes('antebrazo') || n.includes('muñeca')) return 'Antebrazo';
    if (n.includes('mancuerna') || n.includes('smith') || n.includes('multipower')) return 'Peso Libre (General)';
    if (item.category === 'FREE_WEIGHT') return 'Peso Libre (General)';
    if (item.category === 'CABLE') return 'Poleas / Varios';

    return 'Otros';
};
