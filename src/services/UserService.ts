import { supabase } from '../lib/supabase';
import type { GymPlace } from './MapsService';
import { COMMON_EQUIPMENT_SEEDS } from './GymEquipmentService';

export interface UserPrimaryGym {
    gym_id: string; // Internal UUID
    google_place_id: string;
    gym_name: string;
    since: string;
    is_home_base?: boolean;
    lat?: number;
    lng?: number;
    equipment_count?: number;
}

class UserService {

    // Get all gyms associated with the user (Passport)
    async getUserGyms(userId: string): Promise<UserPrimaryGym[]> {
        try {
            const { data, error } = await supabase
                .from('user_gyms')
                .select(`
                    gym_id,
                    since,
                    is_home_base,
                    gyms (
                        id,
                        name,
                        address,
                        place_id,
                        lat,
                        lng,
                        gym_equipment(count)
                    )
                `)
                .eq('user_id', userId);

            if (error) throw error;

            if (!data) return [];

            return data.map((item: any) => ({
                gym_id: item.gyms.id,
                google_place_id: item.gyms.place_id || 'mock_id',
                gym_name: item.gyms.name,
                since: item.since,
                is_home_base: item.is_home_base,
                lat: item.gyms.lat,
                lng: item.gyms.lng,
                equipment_count: item.gyms.gym_equipment?.[0]?.count || 0
            }));

        } catch (error) {
            console.error('Error getting user gyms:', error);
            return [];
        }
    }

    // Add a gym to the user's passport
    async addGymToPassport(userId: string, gymPlace: GymPlace): Promise<{ success: boolean; error?: string; gym_id?: string; xp_gained?: number }> {
        try {
            // 1. Upsert Gym (Ensure it exists in our DB)
            const { data: existingGym } = await supabase
                .from('gyms')
                .select('id')
                .eq('place_id', gymPlace.place_id)
                .maybeSingle();

            let gymId = existingGym?.id;

            if (!gymId) {
                const { data: newGym, error: createError } = await supabase
                    .from('gyms')
                    .insert({
                        name: gymPlace.name,
                        address: gymPlace.address,
                        lat: gymPlace.location.lat,
                        lng: gymPlace.location.lng,
                        place_id: gymPlace.place_id,
                        vibe: 'Unknown',
                        crowd_level: 'Moderate'
                    })
                    .select()
                    .single();

                if (createError) throw createError;
                gymId = newGym.id;
            }

            // 2. Link User to Gym (Add to Passport)
            // Determine if this is their first gym (set as home base if so)
            const { count } = await supabase
                .from('user_gyms')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            const isFirstGym = count === 0;

            const { error: linkError } = await supabase
                .from('user_gyms')
                .upsert({
                    user_id: userId,
                    gym_id: gymId,
                    since: new Date().toISOString(),
                    is_home_base: isFirstGym // Set as true only if it's the first one
                });

            if (linkError) throw linkError;

            // 3. Update Profile Cache (if it's home base)
            if (isFirstGym) {
                await supabase
                    .from('profiles')
                    .update({ home_gym_id: gymId })
                    .eq('id', userId);
            }

            // 4. AWARD XP (MOVED TO FIRST PHYSICAL CHECK-IN)
            // We no longer award XP just for adding the gym to the map.
            const xpReward = 0;

            // 5. REFERRAL CHECK REMOVED (Moved to AuthContext for Registration/Login trigger)
            // Logic moved to processReferral()

            return { success: true, gym_id: gymId, xp_gained: xpReward };

        } catch (error: any) {
            console.error('Error adding gym to passport:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Process a referral reward (+250 XP)
     * Called when a new user registers with a ?ref=CODE
     */
    async processReferral(newUserId: string, referrerId: string): Promise<boolean> {
        try {
            if (newUserId === referrerId) return false; // Self-referral prevention

            console.log(`🎁 Processing Referral: ${referrerId} -> ${newUserId}`);

            // 1. Award XP to Referrer (250 XP)
            const { error: xpError } = await supabase.rpc('increment_xp', {
                u_id: referrerId,
                amount: 250
            });

            if (xpError) throw xpError;

            // 2. Mark New User as Referred (Prevents duplicates)
            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    referred_by: referrerId,
                    referral_date: new Date().toISOString()
                }
            });

            if (updateError) throw updateError;

            return true;
        } catch (error) {
            console.error("Error processing referral:", error);
            return false;
        }
    }

    /**
     * Add XP to a user
     * @param userId The user ID to add XP to
     * @param amount The amount of XP to add
     */
    async addXP(userId: string, amount: number): Promise<{ success: boolean; new_xp?: number; error?: string }> {
        try {
            // 1. Try connecting via RPC (Atomic)
            const { error: rpcError } = await supabase.rpc('increment_xp', {
                u_id: userId,
                amount: amount
            });

            if (!rpcError) {
                return { success: true };
            }

            console.warn('[UserService] RPC increment_xp failed, using manual update:', rpcError.message);

            // 2. Fallback: Manual Read-Modify-Write
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('xp')
                .eq('id', userId)
                .single();

            if (fetchError) throw fetchError;

            const currentXp = profile?.xp || 0;
            const newXp = currentXp + amount;

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ xp: newXp })
                .eq('id', userId);

            if (updateError) throw updateError;

            return { success: true, new_xp: newXp };

        } catch (error: any) {
            console.error('Error adding XP:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all gyms in the system (for the global map)
    async getAllGyms(): Promise<any[]> {
        const { data, error } = await supabase
            .from('gyms')
            .select('*');

        if (error) {
            console.error('Error fetching all gyms:', error);
            return [];
        }
        return data || [];
    }
    // Get user's created routines
    async getUserRoutines(userId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('routines')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching routines:', error);
            return [];
        }
        return data || [];
    }

    // Get full details of a specific routine (for Profile Inspector)
    async getRoutineDetails(routineId: string): Promise<any | null> {
        try {
            // 1. Get Routine Metadata (Explicit Select)
            const { data: routine, error: rError } = await supabase
                .from('routines')
                .select(`
                    id,
                    user_id,
                    name,
                    description,
                    is_public,
                    created_at,
                    gym_id
                `)
                .eq('id', routineId)
                .single();

            if (rError) throw rError;

            // 2. Get Exercises (Link Table) (Explicit Select)
            const { data: routeExs, error: eError } = await supabase
                .from('routine_exercises')
                .select(`
                    id,
                    routine_id,
                    exercise_id,
                    name,
                    order_index,
                    track_weight,
                    track_reps,
                    track_time,
                    track_distance,
                    track_rpe,
                    track_pr,
                    target_sets,
                    target_reps_text,
                    custom_metric
                `)
                .eq('routine_id', routineId)
                .order('order_index', { ascending: true });

            if (eError) throw eError;

            // 3. Manual Join to get Exercise Details (Names)
            // We need to fetch from 'gym_equipment' table where id matches.
            const exerciseIds = routeExs?.map(re => re.exercise_id) || [];
            let enrichedExercises = routeExs || [];

            if (exerciseIds.length > 0) {
                let equipmentData: any[] | null = null;

                // Try fetching with icon (Schema V2)
                const { data: dataV2, error: errorV2 } = await supabase
                    .from('gym_equipment')
                    .select('id, name, category, image_url, icon, metrics')
                    .in('id', exerciseIds);

                if (!errorV2 && dataV2) {
                    equipmentData = dataV2;
                } else {
                    console.warn('Failed to fetch icons (Schema V2), falling back to legacy schema:', errorV2?.message);

                    // Fallback Level 1: Fetch without icon (Schema V1 - with image_url)
                    const { data: dataV1, error: errorV1 } = await supabase
                        .from('gym_equipment')
                        .select('id, name, category, image_url, metrics')
                        .in('id', exerciseIds);

                    if (!errorV1 && dataV1) {
                        equipmentData = dataV1;
                    } else {
                        console.warn('Failed to fetch images (Schema V1), falling back to primitive schema:', errorV1?.message);
                        // Fallback Level 2 (Doomsday): Fetch only base fields (Schema V0)
                        const { data: dataV0 } = await supabase
                            .from('gym_equipment')
                            .select('id, name, category, metrics')
                            .in('id', exerciseIds);
                        equipmentData = dataV0;
                    }
                }

                // Map back
                const equipmentMap = new Map(equipmentData?.map(e => [e.id, e]) || []);

                enrichedExercises = routeExs!.map(re => {
                    const eq = equipmentMap.get(re.exercise_id);

                    // CRITICAL DEBUG: Log what metrics we're getting from DB
                    console.log(`🔍 [UserService] Loading exercise "${re.name}":`, {
                        exercise_id: re.exercise_id,
                        has_equipment: !!eq,
                        equipment_metrics: eq?.metrics,
                        routine_track_flags: {
                            track_weight: re.track_weight,
                            track_reps: re.track_reps,
                            track_time: re.track_time,
                            track_distance: re.track_distance,
                            track_rpe: re.track_rpe
                        },
                        custom_metric: re.custom_metric
                    });

                    // Logic to recover Icon for Old Data (Hydration from Seeds)
                    let finalIcon = eq?.icon;
                    if (!finalIcon && (eq?.name || re.name)) {
                        const targetName = eq?.name || re.name;
                        // Helper for normalization
                        const normalize = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

                        const normalizeName = normalize(targetName);
                        const seed = COMMON_EQUIPMENT_SEEDS.find(s => normalize(s.name) === normalizeName);

                        if (seed) {
                            finalIcon = seed.icon;
                            // console.log(`[Hydration] Recovered icon for "${targetName}": ${seed.icon}`);
                        } else {
                            console.warn(`[Hydration] Failed to find seed for "${targetName}" (Normalized: "${normalizeName}")`);
                        }
                    }

                    return {
                        ...re,
                        // Priority: 1. Equipment Data, 2. Cached Name in Routine Table, 3. Fallback
                        name: eq?.name || re.name || 'Ejercicio Desconocido',
                        muscle_group: eq?.category || 'General',
                        image_url: eq?.image_url, // Map image
                        icon: finalIcon, // Map icon (DB or Seed Hydrated)
                        equipment: eq // Include full equipment data (with metrics!)
                    };
                });
            }

            return { ...routine, exercises: enrichedExercises };

        } catch (error) {
            console.error('Error fetching routine details:', error);
            return null;
        }
    }

    // Copy a routine to the current user's library (Clash Royale feature)
    async copyRoutine(sourceRoutineId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
        try {
            // 1. Fetch Source
            const source = await this.getRoutineDetails(sourceRoutineId);
            if (!source) throw new Error('Routine not found');

            // 2. Create New Routine
            const { data: newRoutine, error: createError } = await supabase
                .from('routines')
                .insert({
                    user_id: targetUserId,
                    name: `Copia de ${source.name}`,
                    is_public: true
                })
                .select()
                .single();

            if (createError) throw createError;

            // 3. Copy Exercises
            if (source.exercises && source.exercises.length > 0) {
                const exercisesToInsert = source.exercises.map((ex: any) => ({
                    routine_id: newRoutine.id,
                    exercise_id: ex.exercise_id,
                    name: ex.name, // Copy the name snapshot!
                    order_index: ex.order_index,
                    track_weight: ex.track_weight,
                    track_reps: ex.track_reps,
                    track_time: ex.track_time,
                    track_distance: ex.track_distance,
                    track_rpe: ex.track_rpe,
                    track_pr: ex.track_pr,
                    target_sets: ex.target_sets,
                    target_reps_text: ex.target_reps_text,
                    custom_metric: ex.custom_metric
                }));

                const { error: insertError } = await supabase
                    .from('routine_exercises')
                    .insert(exercisesToInsert);

                if (insertError) throw insertError;
            }

            return { success: true };

        } catch (error: any) {
            console.error('Copy routine error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all public routines for a user (Profile Inspector - All Decks)
    async getUserPublicRoutines(userId: string): Promise<any[]> {
        // Safety check for Bots or invalid IDs
        if (!userId || userId.startsWith('bot-')) return [];

        try {
            // 1. Get routine IDs
            const { data: routines, error } = await supabase
                .from('routines')
                .select('id')
                .eq('user_id', userId)
                .eq('is_public', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!routines || routines.length === 0) return [];

            // 2. Fetch full details for each routine (includes exercises with icons/images)
            const detailedRoutines = await Promise.all(
                routines.map(r => this.getRoutineDetails(r.id))
            );

            // Filter out any null results
            return detailedRoutines.filter(r => r !== null);
        } catch (error) {
            console.error('Error fetching user public routines:', error);
            return [];
        }
    }

    // Update user profile
    async updateProfile(userId: string, updates: { username?: string; avatar_url?: string; custom_settings?: any; featured_routine_id?: string | null }): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId);

            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            console.error('Error updating profile:', error);
            return { success: false, error: error.message };
        }
    }

    // Toggle Routine Visibility (Public/Private)
    async updateRoutineVisibility(routineId: string, isPublic: boolean): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('routines')
                .update({ is_public: isPublic })
                .eq('id', routineId);

            if (error) throw error;
            console.log(`[UserService] Routine ${routineId} visibility updated to: ${isPublic}`);
            return { success: true };
        } catch (error: any) {
            console.error('Error updating routine visibility:', error);
            return { success: false, error: error.message };
        }
    }

    // Set a gym as Home Base (Sede)
    async setHomeBase(userId: string, gymId: string): Promise<{ success: boolean; error?: string }> {
        try {
            // 1. Reset all other gyms for this user to false
            const { error: resetError } = await supabase
                .from('user_gyms')
                .update({ is_home_base: false })
                .eq('user_id', userId);

            if (resetError) throw resetError;

            // 2. Set the target gym to true
            const { error: updateError } = await supabase
                .from('user_gyms')
                .update({ is_home_base: true })
                .match({ user_id: userId, gym_id: gymId });

            if (updateError) throw updateError;

            return { success: true };
        } catch (error: any) {
            console.error('Error setting home base:', error);
            return { success: false, error: error.message };
        }
    }

    // Upload avatar to Supabase Storage
    async uploadAvatar(userId: string, file: File): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars') // Make sure this bucket exists in Supabase
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            return { success: true, publicUrl: data.publicUrl };
        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            return { success: false, error: error.message };
        }
    }

    // Upload banner to Supabase Storage
    async uploadBanner(userId: string, file: File): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `banner-${userId}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            return { success: true, publicUrl: data.publicUrl };
        } catch (error: any) {
            console.error('Error uploading banner:', error);
            return { success: false, error: error.message };
        }
    }

    // Hard Reset: Wipe all user data (Gyms, History, Custom items)
    async resetAccountData(userId: string): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('[UserService] RESETTING ACCOUNT DATA FOR:', userId);

            // 1. Delete History (Logs & Sessions)
            await supabase.from('workout_logs').delete().eq('user_id', userId);
            await supabase.from('workout_sessions').delete().eq('user_id', userId);

            // 2. Delete Gym Memberships
            await supabase.from('user_gyms').delete().eq('user_id', userId);

            // 3. Delete Created Equipment (Crowdsourced)
            await supabase.from('gym_equipment').delete().eq('verified_by', userId);

            // 4. Delete Custom Exercises
            try {
                const { error: exError } = await supabase.from('exercises').delete().eq('created_by', userId);
                if (exError) console.warn('Custom exercise delete warning:', exError.message);
            } catch (e) {
                console.warn('Skipping custom exercises delete (schema mismatch likely).');
            }

            // 5. Delete Routines
            await supabase.from('routines').delete().eq('created_by', userId);

            // 6. Reset Profile Stats
            await supabase.from('profiles').update({
                xp: 0,
                checkins_count: 0,
                photos_count: 0,
                home_gym_id: null,
                custom_settings: {}
            }).eq('id', userId);

            return { success: true };
        } catch (error: any) {
            console.error('Error resetting account:', error);
            return { success: false, error: error.message };
        }
    }
    // Ensure a "Personal Gym" exists for this user (Workaround for DB Not Null constraint)
    async ensurePersonalGym(userId: string): Promise<string> {
        const personalPlaceId = `personal_arsenal_${userId}`;

        // 1. Check if it exists
        const { data: existing } = await supabase
            .from('gyms')
            .select('id')
            .eq('place_id', personalPlaceId)
            .maybeSingle();

        if (existing) return existing.id;

        // 2. Create it if not
        const { data: newGym, error } = await supabase
            .from('gyms')
            .insert({
                name: 'Tu Arsenal Personal 🏠',
                address: 'Base de Operaciones',
                lat: 0,
                lng: 0,
                place_id: personalPlaceId,
                vibe: 'Personal',
                crowd_level: 'Low'
            })
            .select('id')
            .single();

        if (error) {
            console.error('Error creating personal gym:', error);
            throw new Error('Could not create personal workspace');
        }

        return newGym.id;
    }

    // Find the nearest gym to the given coordinates
    async findNearestGym(lat: number, lng: number): Promise<UserPrimaryGym | null> {
        try {
            const allGyms = await this.getAllGyms();
            if (allGyms.length === 0) return null;

            let closestGym = null;
            let minDistance = Infinity;

            for (const gym of allGyms) {
                // Simple distance calculation (Haversine not strictly needed for short comparisons but better)
                // Using simple Euclidean approximation for speed if needed, but Haversine is safer.
                // Let's implement a quick Haversine here or helper.
                const R = 6371; // km
                const dLat = (gym.lat - lat) * Math.PI / 180;
                const dLon = (gym.lng - lng) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat * Math.PI / 180) * Math.cos(gym.lat * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const d = R * c;

                if (d < minDistance) {
                    minDistance = d;
                    closestGym = gym;
                }
            }

            // Return closest gym regardless of distance? 
            // The prompt implies we confirm "Estás en X?". 
            // So we return the closest.
            if (closestGym) {
                return {
                    gym_id: closestGym.id,
                    google_place_id: closestGym.place_id,
                    gym_name: closestGym.name,
                    since: new Date().toISOString(), // Dummy
                    lat: closestGym.lat,
                    lng: closestGym.lng
                };
            }
            return null;

        } catch (error) {
            console.error('Error finding nearest gym:', error);
            return null;
        }
    }
}

export const userService = new UserService();
