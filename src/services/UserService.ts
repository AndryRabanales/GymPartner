import { supabase } from '../lib/supabase';
import type { GymPlace } from './MapsService';

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

            // 4. AWARD XP (Gamification)
            // Default 500 XP for unlocking a new territory
            const xpReward = 500;
            const { error: xpError } = await supabase.rpc('increment_xp', {
                u_id: userId,
                amount: xpReward
            });

            // Fallback if RPC doesn't exist (Manual Update)
            if (xpError) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('xp')
                    .eq('id', userId)
                    .single();

                const currentXp = profile?.xp || 0;
                await supabase
                    .from('profiles')
                    .update({ xp: currentXp + xpReward })
                    .eq('id', userId);
            }

            return { success: true, gym_id: gymId, xp_gained: xpReward };

        } catch (error: any) {
            console.error('Error adding gym to passport:', error);
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
    // Update user profile
    async updateProfile(userId: string, updates: { username?: string; avatar_url?: string; custom_settings?: any }): Promise<{ success: boolean; error?: string }> {
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
}

export const userService = new UserService();
