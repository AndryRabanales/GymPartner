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
        // 1. Fetch Source Routine
        // REMOVED items:routine_items(*) as table apparently doesn't exist
        const { data: source, error: fetchError } = await supabase
            .from('routines')
            .select(`*, exercises:routine_exercises(*)`)
            .eq('id', sourceRoutineId)
            .single();

        if (fetchError || !source) return { error: fetchError || 'Routine not found' };

        // 2. Identify Equipment to Clone
        // We need to know which IDs correspond to 'gym_equipment' (Custom) vs 'exercises' (Seeds)
        const allEquipmentIds = new Set<string>();

        // Collect from routine_exercises
        if (source.exercises) {
            source.exercises.forEach((ex: any) => allEquipmentIds.add(ex.exercise_id));
        }

        // Legacy items processing removed as table is 404

        const uniqueIds = Array.from(allEquipmentIds);
        const idMapping = new Map<string, string>(); // OldID -> NewID (or OldID if seed)

        if (uniqueIds.length > 0) {
            // Check which ones are Custom Equipment
            const { data: customEquipment } = await supabase
                .from('gym_equipment')
                .select('*')
                .in('id', uniqueIds);

            // For each custom item found, CLONE it to the new gym
            if (customEquipment && customEquipment.length > 0) {
                for (const item of customEquipment) {
                    // Create copy for this gym
                    const { data: newItem, error: cloneError } = await supabase
                        .from('gym_equipment')
                        .insert({
                            gym_id: targetGymId, // NEW GYM
                            name: item.name,
                            category: item.category,
                            quantity: item.quantity,
                            metrics: item.metrics,
                            verified_by: userId,
                            created_at: new Date().toISOString()
                        })
                        .select()
                        .single();

                    if (!cloneError && newItem) {
                        idMapping.set(item.id, newItem.id); // Map Old -> New
                    } else {
                        console.error('Failed to clone item:', item.name, cloneError);
                        // Fallback: keep old ID (might break if user lacks permissions, but better than crash)
                        idMapping.set(item.id, item.id);
                    }
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

        // 4. Clone Exercises (Merge logic & Apply ID Mapping)
        const validExercises: any[] = [];

        // Priority A: Existing routine_exercises
        if (source.exercises && source.exercises.length > 0) {
            source.exercises.forEach((ex: any) => {
                // Use mapped ID (New Clone) or fallback to Original (Seed)
                const targetId = idMapping.get(ex.exercise_id) || ex.exercise_id;

                validExercises.push({
                    exercise_id: targetId,
                    track_weight: ex.track_weight,
                    track_reps: ex.track_reps,
                    order_index: ex.order_index
                });
            });
        }

        // Priority B: Legacy routine_items
        if (source.items && source.items.length > 0) {
            source.items.forEach((item: any) => {
                const targetId = idMapping.get(item.equipment_id) || item.equipment_id;

                // Avoid duplicates
                if (!validExercises.find(v => v.exercise_id === targetId)) {
                    validExercises.push({
                        exercise_id: targetId,
                        track_weight: true,
                        track_reps: true,
                        order_index: item.order_index
                    });
                }
            });
        }

        if (validExercises.length > 0) {
            const newLinkData = validExercises.map(v => ({
                routine_id: newRoutine.id,
                exercise_id: v.exercise_id,
                order_index: v.order_index,
                track_weight: v.track_weight,
                track_reps: v.track_reps
            }));

            const { error: linkError } = await supabase
                .from('routine_exercises')
                .insert(newLinkData);

            if (linkError) {
                console.error("Error cloning exercises:", linkError);
            }
        }

        return { data: newRoutine };
    }

    async deleteRoutine(routineId: string) {
        const { error } = await supabase.from('routines').delete().eq('id', routineId);
        return { error };
    }

    // Update existing Routine
    async updateRoutine(routineId: string, name: string, equipmentIds: string[]) {
        // 1. Update Name
        const { error: updateError } = await supabase
            .from('routines')
            .update({ name })
            .eq('id', routineId);

        if (updateError) return { error: updateError };

        //  2. Clear old links (routine_exercises only, routine_items doesn't exist)
        await supabase.from('routine_exercises').delete().eq('routine_id', routineId);

        // 3. Link new
        if (equipmentIds.length > 0) {
            await this.linkEquipmentToRoutine(routineId, equipmentIds);
        }

        return { success: true };
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
