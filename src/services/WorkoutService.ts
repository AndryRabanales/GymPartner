import { supabase } from '../lib/supabase';

export interface WorkoutSession {
    id: string;
    gym_id?: string;
    user_id: string;
    started_at: string;
    finished_at?: string;
    notes?: string;
    gym?: {
        name: string;
        place_id?: string;
    };
}

export interface WorkoutSetData {
    session_id: string;
    exercise_id: string;
    set_number: number;
    sets?: number; // Number of sets performed
    weight_kg?: number;
    reps?: number;
    rpe?: number;
    time?: number;
    distance?: number;
    metrics_data?: Record<string, number>; // Flexible JSONB storage
    is_pr?: boolean;
    category_snapshot?: string; // HISTORICAL: Preserves category at time of log
}

class WorkoutService {
    // Start a new empty session (The "Battle" begins)
    async startSession(userId: string, gymId?: string): Promise<{ data?: WorkoutSession; error?: any }> {
        const { data, error } = await supabase
            .from('workout_sessions')
            .insert({
                user_id: userId,
                gym_id: gymId,
                started_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Error starting session:', error);
            return { error };
        }
        return { data };
    }

    // Finish the session (The "Victory")
    async finishSession(sessionId: string, notes?: string): Promise<{ success: boolean; error?: any }> {
        const now = new Date().toISOString();
        const { error } = await supabase
            .from('workout_sessions')
            .update({
                end_time: now,
                finished_at: now, // Update both to be safe against schema variations
                notes
            })
            .eq('id', sessionId);

        if (error) {
            console.error('Error finishing session:', error);
            return { success: false, error };
        }
        return { success: true };
    }

    // Log a single set (The "Hit")
    async logSet(setData: WorkoutSetData): Promise<{ data?: any; error?: any }> {
        // Validation / Clamping to avoid DB overflow (numeric(6,2) -> max 9999.99)
        const SAFE_MAX_WEIGHT = 9999;
        const SAFE_MAX_REPS = 9999;
        const SAFE_MAX_TIME = 999999; // seconds?
        const SAFE_MAX_DISTANCE = 99999.99;

        const safePayload = {
            ...setData,
            weight_kg: Math.min(Math.abs(setData.weight_kg || 0), SAFE_MAX_WEIGHT),
            reps: Math.min(Math.abs(setData.reps || 0), SAFE_MAX_REPS),
            time: setData.time ? Math.min(Math.abs(setData.time), SAFE_MAX_TIME) : 0,
            distance: setData.distance ? Math.min(Math.abs(setData.distance), SAFE_MAX_DISTANCE) : 0,
            rpe: setData.rpe, // Allow it to pass through
            metrics_data: setData.metrics_data || {}, // Save custom metrics
            category_snapshot: setData.category_snapshot // Save historical category
        };

        const { data, error } = await supabase
            .from('workout_logs')
            .insert(safePayload)
            .select()
            .single();

        if (error) {
            console.error('Error logging set:', error);
            return { error };
        }
        return { data };
    }

    // Get incomplete session if app crashed or user left
    async getActiveSession(userId: string): Promise<WorkoutSession | null> {
        const { data } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('user_id', userId)
            .is('end_time', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .single();

        return data;
    }

    // Get full history (The "Saga")
    async getHistory(userId: string): Promise<WorkoutSession[]> {
        const { data } = await supabase
            .from('workout_sessions')
            .select(`
                *,
                gym:gyms (
                    name,
                    place_id
                )
            `)
            .eq('user_id', userId)
            .eq('user_id', userId)
            // Check EITHER end_time OR finished_at 
            .not('end_time', 'is', null)
            .order('end_time', { ascending: false });

        return data || [];
    }

    // Get User Stats (The "Character Sheet")
    async getUserStats(userId: string) {
        // Parallel queries for efficiency
        const [sessionsRes, gymsRes] = await Promise.all([
            supabase
                .from('workout_sessions')
                .select('id', { count: 'exact' })
                .eq('user_id', userId)
                .not('finished_at', 'is', null),

            supabase
                .from('user_gyms')
                .select('id', { count: 'exact' })
                .eq('user_id', userId)
        ]);

        return {
            totalWorkouts: sessionsRes.count || 0,
            gymsVisited: gymsRes.count || 0,
            // Mocking streak for MVP until we track daily logs properly
            currentStreak: Math.floor(Math.random() * 5) + 1
        };
    }

    // Check for PR (The "Breakthrough")
    async checkPersonalRecord(_userId: string, exerciseId: string, weight: number): Promise<boolean> {
        // Find existing max weight for this exercise
        const { data } = await supabase
            .from('workout_sets')
            .select('weight_kg')
            .eq('exercise_id', exerciseId)
            .gt('weight_kg', 0)
            .order('weight_kg', { ascending: false })
            .limit(1)
            .maybeSingle();

        // If no data, it's a first PR? Yes.
        if (!data) return true;

        // If current weight > stored max, it's a PR
        return weight > (data.weight_kg || 0);
    }

    // Get User Routines (Filtered by Gym vs Global)
    async getUserRoutines(userId: string, gymId?: string | null) {
        // 1. Fetch Routines Base Data
        let query = supabase
            .from('routines')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (gymId) {
            query = query.eq('gym_id', gymId);
        } else {
            query = query.is('gym_id', null);
        }

        const { data: routinesData, error: routinesError } = await query;

        if (routinesError) {
            console.error('Error fetching routines:', routinesError);
            return [];
        }

        if (!routinesData || routinesData.length === 0) return [];

        const routineIds = routinesData.map(r => r.id);

        // 2. Fetch Exercises (Raw, No Joins to avoid PGRST200)
        const { data: exercisesData, error: exercisesError } = await supabase
            .from('routine_exercises')
            .select('*')
            .in('routine_id', routineIds);

        if (exercisesError) console.warn('Error fetching routine_exercises:', exercisesError);

        // 3. REMOVED routine_items fetch (404 Not Found)

        // 4. Manual Join: Fetch Exercise Names from 'exercises' table (NOT 'equipment')
        const allExercises = exercisesData || [];
        const exerciseIds = Array.from(new Set(allExercises.map(e => e.exercise_id)));

        let exercisesMap = new Map<string, any>();

        if (exerciseIds.length > 0) {
            const { data: exData } = await supabase
                .from('exercises')
                .select('id, name')
                .in('id', exerciseIds);

            if (exData) {
                exData.forEach(ex => exercisesMap.set(ex.id, ex));
            }
        }

        // 5. Merge Data
        return routinesData.map(r => {
            const myExercisesRaw = allExercises.filter(e => e.routine_id === r.id);
            // const myItems = itemsData?.filter(i => i.routine_id === r.id) || []; // REMOVED

            // Attach exercise name to exercises manually
            const myExercises = myExercisesRaw.map(e => ({
                ...e,
                equipment: exercisesMap.get(e.exercise_id)
            }));

            return {
                ...r,
                equipment_ids: [
                    ...myExercises.map(e => e.exercise_id),
                    // ...myItems.map(i => i.equipment_id) // REMOVED
                ],
                routine_exercises: myExercises,
                // routine_items: myItems // REMOVED
            };
        });
    }

    // Create a new Routine (Master or Gym-Specific)
    async createRoutine(userId: string, name: string, equipmentIds: string[], gymId?: string | null) {
        // 1. Create Routine
        const { data: routineData, error: routineError } = await supabase
            .from('routines')
            .insert({
                user_id: userId,
                gym_id: gymId || null, // Explicitly handle null for Global
                name: name,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (routineError) {
            console.error('Error creating routine:', routineError);
            return { error: routineError };
        }

        if (equipmentIds.length > 0) {
            await this.linkEquipmentToRoutine(routineData.id, equipmentIds);
        }
        return { data: routineData };
    }

    // Import (Clone) a Master Routine to a Gym
    async importRoutine(userId: string, sourceRoutineId: string, targetGymId: string) {
        // 1. Fetch Source Details (using UserService to get Rich Data including Names from Snapshot)
        // We assume userService is imported or available via 'this.userService'? 
        // No, 'userService' is a separate export. We can import it or use a raw fetch improved here.
        // Let's rely on a robust local implementation to avoid circular dependencies if possible.
        // But since we need "Rich" data (names), and getRoutineDetails has logic for it, we should use it if we can.
        // If we can't import userService here (circular), we replicate the logic: Fetch routine_exercises and rely on 'name' column.

        // Fetch source routine with exercises
        const { data: source, error: sourceError } = await supabase
            .from('routines')
            .select(`
                id,
                name,
                description,
                is_public,
                user_id,
                gym_id,
                created_at,
                exercises:routine_exercises(*)
            `)
            .eq('id', sourceRoutineId)
            .single();

        if (sourceError || !source) return { error: sourceError || 'Source not found' };

        const exercises = source.exercises || [];
        const idMapping = new Map<string, string>(); // OldID -> NewID

        // 2. Process Exercises: Clone Custom items if needed
        for (const ex of exercises) {
            // Priority: Name in Snapshot > Fetch from gym_equipment (if allowed) > Fallback
            let exName = ex.name;
            let exCategory = 'FREE_WEIGHT';
            let exIcon: string | undefined = undefined; // Undefined icon falls back to default

            // If snapshot name missing (Legacy data), try fetch
            if (!exName) {
                const { data: eqData } = await supabase.from('gym_equipment').select('name, category, icon, image_url').eq('id', ex.exercise_id).maybeSingle();
                if (eqData) {
                    exName = eqData.name;
                    exCategory = eqData.category;
                    exIcon = eqData.icon || (eqData as any).image_url;
                } else {
                    exName = 'Ejercicio Importado';
                }
            } else {
                // We have name, but need category/icon for potentially creating a new item
                // Try fetch to get metadata, if RLS fails, we fallback to defaults
                const { data: eqData } = await supabase.from('gym_equipment').select('category, icon, image_url').eq('id', ex.exercise_id).maybeSingle();
                if (eqData) {
                    exCategory = eqData.category;
                    exIcon = eqData.icon || (eqData as any).image_url;
                }
            }

            // Normalization helper
            const normalize = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

            // Check if exists in Target Gym
            const { data: existingLocal } = await supabase
                .from('gym_equipment')
                .select('id')
                .eq('gym_id', targetGymId)
                .ilike('name', exName) // Case insensitive check
                .maybeSingle();

            if (existingLocal) {
                idMapping.set(ex.exercise_id, existingLocal.id);
            } else {
                // CLONE IT (Create new User-Owned Item)
                console.log(`[Import] Cloning exercise "${exName}" to gym ${targetGymId}`);

                // If category is unknown, try to infer from name
                if (exCategory === 'FREE_WEIGHT' || !exCategory) {
                    const n = normalize(exName);
                    if (n.includes('bicep') || n.includes('curl')) exCategory = 'ARMS';
                    else if (n.includes('pecho') || n.includes('press')) exCategory = 'CHEST';
                    else if (n.includes('espalda') || n.includes('remo')) exCategory = 'BACK';
                    else if (n.includes('pierna') || n.includes('sentadilla') || n.includes('squat')) exCategory = 'LEGS';
                }

                const { data: newItem, error: createError } = await supabase
                    .from('gym_equipment')
                    .insert({
                        gym_id: targetGymId,
                        name: exName,
                        category: exCategory,
                        quantity: 1, // Default
                        condition: 'GOOD',
                        metrics: { weight: ex.track_weight, reps: ex.track_reps },
                        icon: exIcon,
                        verified_by: userId
                    })
                    .select('id')
                    .single();

                if (newItem && !createError) {
                    idMapping.set(ex.exercise_id, newItem.id);
                } else {
                    console.error("[Import] Failed to clone item, keeping old ID:", exName);
                    idMapping.set(ex.exercise_id, ex.exercise_id);
                }
            }
        }

        // 3. Create New Routine (Clone)
        const { data: newRoutine, error: createError } = await supabase
            .from('routines')
            .insert({
                user_id: userId,
                gym_id: targetGymId, // Link to Gym
                name: source.name, // Keep same name
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (createError) return { error: createError };

        // 4. Link Exercises (Using Mapped IDs)
        const newLinkData = exercises.map((ex: any) => {
            const finalId = idMapping.get(ex.exercise_id) || ex.exercise_id;

            // Persist Name in the link (Snapshot)
            // If we cloned it, we have the name. If we mapped it, we rely on the linked item.
            // But we ALWAYS want a snapshot just in case.
            let snapshotName = ex.name;
            if (!snapshotName) {
                // Try to recover from mapped logic? Too complex. Use 'Ejercicio Importado' if missing.
                snapshotName = 'Ejercicio Importado';
            }

            return {
                routine_id: newRoutine.id,
                exercise_id: finalId,
                name: snapshotName,
                order_index: ex.order_index,
                track_weight: ex.track_weight,
                track_reps: ex.track_reps,
                track_time: ex.track_time,
                track_pr: ex.track_pr || false,
                target_sets: ex.target_sets,
                target_reps_text: ex.target_reps_text
            };
        });

        const { error: linkError } = await supabase
            .from('routine_exercises')
            .insert(newLinkData);

        if (linkError) console.error("Error cloning exercises:", linkError);

        return { data: newRoutine };
    }

    async deleteRoutine(routineId: string) {
        const { error } = await supabase.from('routines').delete().eq('id', routineId);
        return { error };
    }

    // Interface for exercise update
    /* 
    interface RoutineExerciseConfig {
        id: string; // The equipment/exercise ID
        track_weight?: boolean;
        track_reps?: boolean;
        target_sets?: number;
        target_reps_text?: string;
    } 
    */

    // Update existing Routine
    async updateRoutine(routineId: string, name: string, equipmentData: string[] | any[]) {
        // 1. Update Name
        const { error: updateError } = await supabase
            .from('routines')
            .update({ name })
            .eq('id', routineId);

        if (updateError) return { error: updateError };

        //  2. Clear old links (routine_exercises only, routine_items doesn't exist)
        await supabase.from('routine_exercises').delete().eq('routine_id', routineId);

        // 3. Link new
        if (equipmentData.length > 0) {
            // Check if payload is rich objects or legacy strings
            if (typeof equipmentData[0] === 'string') {
                // Legacy string mode
                await this.linkEquipmentToRoutine(routineId, equipmentData as string[]); // Fallback to defaults
            } else {
                // Rich config mode
                await this.linkRichExercisesToRoutine(routineId, equipmentData);
            }
        }

        return { success: true };
    }

    // NEW Helper for Rich Config
    private async linkRichExercisesToRoutine(routineId: string, exercises: any[]) {
        console.log('[linkRichExercisesToRoutine] Saving rich config for', exercises.length, 'items');

        const exerciseRows = exercises.map((ex, idx) => ({
            routine_id: routineId,
            exercise_id: ex.id, // Use ID from config
            name: ex.name || 'Ejercicio Personalizado', // Snapshot Name!
            order_index: idx,
            track_weight: ex.track_weight !== undefined ? ex.track_weight : true,
            track_reps: ex.track_reps !== undefined ? ex.track_reps : true,
            track_time: ex.track_time || false,
            track_pr: ex.track_pr || false,
            // Add other fields when DB supports them fully
            // target_sets: ex.target_sets,
        }));

        const { error } = await supabase.from('routine_exercises').insert(exerciseRows);
        if (error) console.error("Error saving rich exercises:", error);
    }

    // Helper to link equipment to routine
    private async linkEquipmentToRoutine(routineId: string, equipmentIds: string[]) {
        if (equipmentIds.length === 0) return;

        console.log('[linkEquipmentToRoutine] Starting with IDs:', equipmentIds);

        // Build exercise rows - use the IDs directly as exercise_ids
        // These IDs can be from gym_equipment OR from exercises table
        const exerciseRows = equipmentIds.map((eqId, idx) => ({
            routine_id: routineId,
            exercise_id: eqId,
            name: 'Ejercicio', // Fallback name for legacy calls
            order_index: idx,
            track_weight: true,
            track_reps: true
        }));

        const { data: insertedExercises, error: insertError } = await supabase
            .from('routine_exercises')
            .insert(exerciseRows)
            .select();

        if (insertError) {
            console.error('[linkEquipmentToRoutine] ❌ Insert failed:', insertError);
            console.error('[linkEquipmentToRoutine] IDs that failed:', equipmentIds);

            // Log which table these IDs might belong to
            const { data: inGymEquipment } = await supabase
                .from('gym_equipment')
                .select('id, name')
                .in('id', equipmentIds);

            const { data: inExercises } = await supabase
                .from('exercises')
                .select('id, name')
                .in('id', equipmentIds);

            console.log('[linkEquipmentToRoutine] Found in gym_equipment:', inGymEquipment?.length || 0, inGymEquipment);
            console.log('[linkEquipmentToRoutine] Found in exercises:', inExercises?.length || 0, inExercises);

            return;
        }

        console.log('[linkEquipmentToRoutine] ✅ Successfully saved', insertedExercises?.length, 'exercises');
    }



}

export const workoutService = new WorkoutService();
