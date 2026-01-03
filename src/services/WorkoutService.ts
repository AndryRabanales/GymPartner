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

    // Cancel/Delete a session (The "Retreat")
    async deleteSession(sessionId: string): Promise<{ success: boolean; error?: any }> {
        // 1. Delete logs first (optional if cascade is set, but safer)
        await supabase.from('workout_logs').delete().eq('session_id', sessionId);

        // 2. Delete session
        const { error } = await supabase
            .from('workout_sessions')
            .delete()
            .eq('id', sessionId);

        if (error) {
            console.error('Error deleting session:', error);
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
                is_public: false, // Default to HIDDEN (Private)
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
        // 1. USE RPC for Server-Side "Sudo" Cloning (Bypasses RLS to read private data)
        console.log(`[Import] Calling RPC clone_full_routine for ${sourceRoutineId} -> ${targetGymId}`);

        const { data, error } = await supabase.rpc('clone_full_routine', {
            p_user_id: userId,
            p_source_routine_id: sourceRoutineId,
            p_target_gym_id: targetGymId
        });

        if (error) {
            console.error('RPC clone_full_routine failed:', error);
            // Fallback? No, if RPC fails, we likely can't do better manually due to RLS.
            return { error };
        }

        // RPC returns { success: boolean, routine_id: uuid, error: string }
        if (!data || data.success === false) {
            const msg = data?.error || 'Unknown RPC error';
            console.error('RPC Business Logic Error:', msg);
            return { error: { message: msg } };
        }

        // Return expected format { data: { id: ... } }
        return { data: { id: data.routine_id } };
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
            icon: ex.icon, // [FIX] Added icon to persist in routine_exercises
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
