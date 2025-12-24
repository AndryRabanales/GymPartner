import { supabase } from '../lib/supabase';
import { COMMON_EQUIPMENT_SEEDS } from './GymEquipmentService';

/**
 * Seeds the exercises table with the common equipment catalog
 * This should be run once to populate the global exercises catalog
 */
export async function seedExercisesCatalog() {
    console.log('[SeedExercises] Starting catalog seed (Batch Mode)...');

    const seeds = COMMON_EQUIPMENT_SEEDS;

    // Prepare rows
    const rows = seeds.map(s => ({
        name: s.name,
        // @ts-ignore
        target_muscle_group: s.targetMuscle
    }));

    // Batch Insert/Upsert
    // ignoreDuplicates: true means if 'name' conflict, do nothing (preserve existing).
    // This requires 'name' to have a UNIQUE constraint. If not, it duplicates.
    // Assuming 'name' is unique or we want duplicates? No, we want unique.
    // Ideally we check schema. But 'upsert' is safest attempt.
    const { data, error } = await supabase
        .from('exercises')
        .upsert(rows, { onConflict: 'name', ignoreDuplicates: true })
        .select();

    if (error) {
        // If 406 or other error, log it but don't crash app
        console.error('[SeedExercises] Batch seed error:', error);
        return { success: false, error };
    }

    console.log(`[SeedExercises] ✅ Sync complete. Checked/Added ${rows.length} items.`);
    return { success: true, count: data?.length };
}

/**
 * Ensures a specific exercise exists in the catalog by name
 * If it doesn't exist, creates it
 */
export async function ensureExerciseExists(name: string) {
    // Check if exercise exists
    const { data: existing } = await supabase
        .from('exercises')
        .select('id')
        .eq('name', name)
        .single();

    if (existing) {
        return { id: existing.id, created: false };
    }

    // Create new exercise
    const { data: newExercise, error } = await supabase
        .from('exercises')
        .insert({
            name
        })
        .select()
        .single();

    if (error) {
        console.error('[EnsureExercise] Error creating exercise:', error);
        return { error };
    }

    console.log('[EnsureExercise] ✅ Created new exercise:', name);
    return { id: newExercise.id, created: true };
}

/**
 * Generates dummy workout data for the user to populate charts
 */
export async function seedDummyData(userId: string) {
    if (!userId) return;
    console.log('[SeedDummy] Starting dummy data generation...');

    // 1. Ensure exercises exist (and get their IDs)
    // We'll pick a few key ones for the radar
    const keyExercises = [
        { name: 'Banco Plano', muscle: 'Pecho' },
        { name: 'Polea Alta (Lat Pulldown)', muscle: 'Espalda' },
        { name: 'Prensa de Piernas', muscle: 'Pierna' },
        { name: 'Press Militar', muscle: 'Hombro' },
        { name: 'Curl de Bíceps', muscle: 'Bíceps' },
        { name: 'Extensiones de Tríceps', muscle: 'Tríceps' }
    ];

    const exerciseIds: Record<string, string> = {};

    for (const ex of keyExercises) {
        // Ensure they exist in DB with correct muscle group
        // First try to find
        const { data: existing } = await supabase
            .from('exercises')
            .select('id')
            .eq('name', ex.name)
            .single();

        if (existing) {
            exerciseIds[ex.name] = existing.id;
        } else {
            // Create if missing
            const { data: newEx } = await supabase
                .from('exercises')
                .insert({ name: ex.name, target_muscle_group: ex.muscle })
                .select()
                .single();
            if (newEx) exerciseIds[ex.name] = newEx.id;
        }
    }

    // 2. Create Sessions (Past 90 Days for Heatmap)
    const sessions = [];
    const now = new Date();

    for (let i = 0; i < 90; i++) {
        // 60% chance of working out on any given day
        if (Math.random() > 0.4) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);

            sessions.push({
                user_id: userId,
                started_at: date.toISOString(),
                end_time: new Date(date.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour later
                name: `Entrenamiento - Día ${i}`,
                status: 'COMPLETED'
            });
        }
    }

    const { data: createdSessions, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert(sessions)
        .select();

    if (sessionError || !createdSessions) {
        console.error('Error creating sessions:', sessionError);
        return { success: false, error: sessionError };
    }

    // 3. Create Logs for each session
    const logs = [];

    for (const session of createdSessions) {
        // Add random exercises to each session
        for (const exName of Object.keys(exerciseIds)) {
            // Random chance to include exercise (Higher chance for variety)
            if (Math.random() > 0.4) {
                logs.push({
                    user_id: userId,
                    session_id: session.id,
                    exercise_id: exerciseIds[exName],
                    sets: Math.floor(Math.random() * 3) + 3, // 3 to 5 sets
                    reps: Math.floor(Math.random() * 10) + 6, // 6 to 15 reps
                    weight_kg: Math.floor(Math.random() * 80) + 20 // 20 to 100 kg
                });
            }
        }
    }

    const { error: logError } = await supabase
        .from('workout_logs')
        .insert(logs);

    if (logError) {
        console.error('Error creating logs:', logError);
        return { success: false, error: logError };
    }

    return { success: true };
}

/**
 * VALIDATION TOOL: Injects specific data to prove the charts work.
 * - Today: Massive Chest Workout (Should spike Radar to Chest + Volume up)
 * - Yesterday: Small Arm Workout (Should light up Calendar yesterday)
 */
/**
 * VALIDATION TOOL: PROGRESIVE EVOLUTION
 * Simulates a user starting from scratch and improving over 4 weeks.
 * Week 1: Beginner (1 workout, Low Volume)
 * Week 2: Consistent (2 workouts, Medium Volume)
 * Week 3: Serious (3 workouts, High Volume)
 * Week 4 (Now): Beast Mode (5 workouts, Massive Volume + PRs)
 * 
 * This ensures the Volume Chart shows a perfect UPWARD LINE.
 */
export async function injectProgressiveHistory(userId: string) {
    console.log('--- INYECTANDO HISTORIA PROGRESIVA ---');
    const today = new Date();

    // 1. Get IDs for variety
    const { data: exercises } = await supabase.from('exercises').select('id, name');
    if (!exercises) return;

    // Helper to find ID
    const getExId = (name: string) => exercises.find(e => e.name === name)?.id || exercises[0].id;
    const chestId = getExId('Banco Plano');
    const legId = getExId('Prensa de Piernas');
    const backId = getExId('Polea Alta (Lat Pulldown)');

    const historyPlan = [
        { weeksAgo: 3, workouts: 1, volumeMultiplier: 1, label: 'Semana 1: Inicio' },
        { weeksAgo: 2, workouts: 2, volumeMultiplier: 2, label: 'Semana 2: Constancia' },
        { weeksAgo: 1, workouts: 3, volumeMultiplier: 3.5, label: 'Semana 3: Intensidad' },
        { weeksAgo: 0, workouts: 5, volumeMultiplier: 5, label: 'Semana 4: Élite' }, // Current week
    ];

    for (const week of historyPlan) {
        // Create N workouts for this week
        for (let i = 0; i < week.workouts; i++) {
            const date = new Date(today);
            // Distribute workouts within the week (e.g., Monday, Wed...)
            date.setDate(date.getDate() - (week.weeksAgo * 7) - i);

            const { data: session } = await supabase.from('workout_sessions').insert({
                user_id: userId,
                started_at: date.toISOString(),
                end_time: new Date(date.getTime() + 3600000).toISOString(),
                name: `Simulación: ${week.label} (${i + 1})`,
                status: 'COMPLETED'
            }).select().single();

            if (session) {
                // progressive overload: more weight/sets based on multiplier
                const weight = 20 * week.volumeMultiplier;
                const sets = 3 + Math.floor(week.volumeMultiplier); // 3 sets -> 8 sets

                await supabase.from('workout_logs').insert([
                    { user_id: userId, session_id: session.id, exercise_id: chestId, sets: sets, reps: 10, weight_kg: weight },
                    { user_id: userId, session_id: session.id, exercise_id: backId, sets: sets, reps: 10, weight_kg: weight },
                    { user_id: userId, session_id: session.id, exercise_id: legId, sets: sets, reps: 10, weight_kg: weight }
                ]);
            }
        }
    }

    return { success: true };
}
