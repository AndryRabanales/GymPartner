import { supabase } from '../lib/supabase';

export interface WorkoutSession {
    id: string;
    gym_id?: string;
    user_id: string;
    started_at: string;
    finished_at?: string;
    end_time?: string; // DB Column
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
    owner_id?: string; // NEW: Explicitly track who performed this set
}

class WorkoutService {
    // Start a new empty session (The "Battle" begins)
    async startSession(
        userId: string, 
        gymId?: string,
        isMultiplayer?: boolean,
        multiplayerMode?: string,
        partnerId?: string,
        partnerSessionId?: string
    ): Promise<{ data?: WorkoutSession; error?: any }> {
        const { data, error } = await supabase
            .from('workout_sessions')
            .insert({
                user_id: userId,
                gym_id: gymId,
                started_at: new Date().toISOString(),
                is_multiplayer: isMultiplayer || false,
                multiplayer_mode: multiplayerMode || null,
                partner_id: partnerId || null,
                partner_session_id: partnerSessionId || null
            })
            .select()
            .single();

        if (error) {
            console.error('Error starting session:', error);
            return { error };
        }

        // Notify allies that the session has started
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', userId)
                .single();

            const displayName = profile?.username || "Tu amigo";

            let gymLabel = "un Gimnasio";
            if (gymId) {
                const { data: gym } = await supabase
                    .from('gyms')
                    .select('name')
                    .eq('id', gymId)
                    .maybeSingle();
                if (gym?.name) {
                    gymLabel = gym.name;
                }
            }

            const { data: shares } = await supabase
                .from('history_shares')
                .select('shared_with')
                .eq('shared_by', userId);

            if (shares && shares.length > 0) {
                const notificationsPayload = shares
                    .filter(share => share.shared_with !== userId && share.shared_with !== partnerId) // 🚫 Do not notify oneself OR the training partner!
                    .map(share => ({
                        user_id: share.shared_with,
                        type: 'system',
                        title: '🔴 EN VIVO - ENTRENANDO AHORA',
                        message: `¡${displayName} comenzó a entrenar en ${gymLabel}!`,
                        data: {
                            sender_id: userId,
                            sender_name: displayName,
                            session_id: data.id,
                            gym_name: gymLabel,
                            status: 'started',
                            started_at: data.started_at
                        }
                    }));

                if (notificationsPayload.length > 0) {
                    await supabase.from('notifications').insert(notificationsPayload);
                }
            }
        } catch (notifyErr) {
            console.error('Error sending start live notification:', notifyErr);
        }

        return { data };
    }

    // Finish the session (The "Victory")
    async finishSession(sessionId: string, notes?: string, routineName?: string, isManual: boolean = false, geoVerified?: boolean): Promise<{ success: boolean; error?: any }> {
        const now = new Date().toISOString();
        const updatePayload: any = {
            end_time: now,
            finished_at: now,
            notes
        };

        if (routineName) {
            updatePayload.routine_name = routineName;
        }

        const { error } = await supabase
            .from('workout_sessions')
            .update(updatePayload)
            .eq('id', sessionId);

        if (error) {
            console.error('Error finishing session:', error);
            return { success: false, error };
        }

        // If this is an automatic/background close, skip G-points and notifications
        if (!isManual) {
            console.log(`ℹ️ [WorkoutService] Sesión ${sessionId} finalizada automáticamente (isManual=false). Omitiendo puntos y notificaciones.`);
            return { success: true };
        }

        // 3. AWARD G-POINTS & TRAINING CUMULATIVE POINT for Training
        try {
            const { data: session } = await supabase.from('workout_sessions').select('user_id, started_at, is_multiplayer').eq('id', sessionId).single();
            if (session) {
                const { userService } = await import('./UserService');
                
                // Calculate session duration
                const startTime = new Date(session.started_at).getTime();
                const endTime = new Date(now).getTime();
                const durationMinutes = (endTime - startTime) / (1000 * 60);
                
                if (durationMinutes >= 20) {
                    // Check if they completed another session today
                    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
                    const { data: todaySessions } = await supabase
                        .from('workout_sessions')
                        .select('id')
                        .eq('user_id', session.user_id)
                        .not('finished_at', 'is', null)
                        .like('finished_at', `${today}%`);

                    // If this is the only finished session today, it is the first qualified workout of the day!
                    const isFirstWorkoutToday = !todaySessions || todaySessions.length <= 1;

                    if (isFirstWorkoutToday) {
                        if (geoVerified === false) {
                            console.log(`📍 Geo check failed — no GX awarded for workout ${sessionId}.`);
                        } else {
                        const isMulti = session.is_multiplayer || false;
                        const pointsAwarded = isMulti ? 3 : 2;
                        const reason = isMulti ? 'workout_finished_coop' : 'workout_finished';

                        console.log(`🎉 First qualified workout of the day (>= 20 mins)! Awarding ${pointsAwarded} GX points (isMultiplayer: ${isMulti}).`);

                        // Award GX points
                        await userService.addGxPoints(session.user_id, pointsAwarded, reason);

                        // Grow the lifetime streak counter (+1/day, never decreases) —
                        // exact same qualifying condition as the daily training GX above.
                        try {
                            const { streakService } = await import('./StreakService');
                            await streakService.recordTrainingDay(session.user_id);
                        } catch (streakErr) {
                            console.warn('Could not record streak training day:', streakErr);
                        }

                        // Increment checkins_count in profile
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('checkins_count')
                            .eq('id', session.user_id)
                            .single();
                            
                        const currentCount = profile?.checkins_count || 0;
                        
                        await supabase
                            .from('profiles')
                            .update({ checkins_count: currentCount + 1 })
                            .eq('id', session.user_id);
                        } // end else (geoVerified !== false)
                    }
                } else {
                    console.log(`⚠️ Session duration (${durationMinutes.toFixed(1)} mins) is less than 20 mins. No GX points awarded.`);
                }
            }
        } catch (e) {
            console.warn('Could not award GX Points or training cumulative point:', e);
        }

        // Notify allies that the session has finished
        try {
            const { data: session } = await supabase
                .from('workout_sessions')
                .select('user_id, gym_id, started_at')
                .eq('id', sessionId)
                .single();

            if (session) {
                const userId = session.user_id;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', userId)
                    .single();

                const displayName = profile?.username || "Tu amigo";

                let gymLabel = "un Gimnasio";
                if (session.gym_id) {
                    const { data: gym } = await supabase
                        .from('gyms')
                        .select('name')
                        .eq('id', session.gym_id)
                        .maybeSingle();
                    if (gym?.name) {
                        gymLabel = gym.name;
                    }
                }

                const logs = await this.getSessionLogs(sessionId);
                let totalVolume = 0;
                const exercisesSet = new Set<string>();
                const musclesSet = new Set<string>();

                logs.forEach((log: any) => {
                    const weight = log.weight_kg || 0;
                    const reps = log.reps || 0;
                    totalVolume += weight * reps;

                    if (log.exercise?.name) {
                        exercisesSet.add(log.exercise.name);
                    }
                    if (log.category_snapshot) {
                        musclesSet.add(log.category_snapshot);
                    } else if (log.exercise?.target_muscle_group) {
                        musclesSet.add(log.exercise.target_muscle_group);
                    }
                });

                const duration = Math.max(1, Math.round((new Date(now).getTime() - new Date(session.started_at).getTime()) / 60000));
                const exercisesList = Array.from(exercisesSet);
                const musclesList = Array.from(musclesSet);

                const { data: shares } = await supabase
                    .from('history_shares')
                    .select('shared_with')
                    .eq('shared_by', userId);

                if (shares && shares.length > 0) {
                    const notificationsPayload = shares
                        .filter(share => share.shared_with !== userId) // 🚫 Do not notify oneself
                        .map(share => ({
                            user_id: share.shared_with,
                            type: 'system',
                            title: '✅ ENTRENAMIENTO FINALIZADO',
                            message: `¡${displayName} terminó su entrenamiento en ${gymLabel}! Duración: ${duration} min.`,
                            data: {
                                sender_id: userId,
                                sender_name: displayName,
                                session_id: sessionId,
                                gym_name: gymLabel,
                                status: 'finished',
                                started_at: session.started_at,
                                finished_at: now,
                                duration: duration,
                                volume: Math.round(totalVolume),
                                exercises: exercisesList,
                                muscles: musclesList
                            }
                        }));

                    if (notificationsPayload.length > 0) {
                        await supabase.from('notifications').insert(notificationsPayload);
                    }
                }
            }
        } catch (notifyErr) {
            console.error('Error sending finish live notification:', notifyErr);
        }

        return { success: true };
    }

    // Cancel/Delete an EMPTY session (no logs) — The "Retreat" / abandon with no data
    // IMPORTANT: NEVER deletes workout_logs. Sessions with logs are finalized (finished_at set),
    // not deleted, so historical data is always preserved.
    async deleteSession(sessionId: string): Promise<{ success: boolean; error?: any }> {
        // Safety check: only delete if the session has no logged sets.
        // If sets exist, finalize instead of delete to avoid permanent data loss.
        const { count } = await supabase
            .from('workout_logs')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sessionId);

        if ((count || 0) > 0) {
            // Session has data — finalize (set finished_at) instead of delete
            console.warn(`⚠️ deleteSession called on session with ${count} logs — finalizing instead of deleting to preserve data.`);
            return this.finishSession(sessionId, 'Sesión cancelada por el usuario');
        }

        // Safe to delete: no logs exist
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

    // Failsafe Cleanup for Orphaned/Ghost Sessions
    // Returns the list of session IDs that were closed/deleted so callers can
    // purge the matching localStorage draft keys.
    async cleanOrphanSessions(userId: string): Promise<string[]> {
        const closedIds: string[] = [];
        try {
            console.log('🧹 [Cleanup] Escaneando sesiones huérfanas para el usuario:', userId);

            // Fetch ALL unfinished sessions, including multiplayer flags to avoid
            // auto-closing active co-op sessions (e.g. when partner locks their phone).
            const { data: activeSessions } = await supabase
                .from('workout_sessions')
                .select('id, started_at, is_multiplayer, partner_session_id')
                .eq('user_id', userId)
                .is('finished_at', null);

            if (!activeSessions || activeSessions.length === 0) return closedIds;

            // Sort newest first so we can keep only the most recent one if needed
            activeSessions.sort((a, b) =>
                new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
            );

            for (const session of activeSessions) {
                const minutesSinceStart =
                    (Date.now() - new Date(session.started_at).getTime()) / (1000 * 60);
                const ROOM_MAX_MINUTES = 300; // 5 hours — max room lifetime

                // 🛡️ MULTIPLAYER GUARD: Preserve active multiplayer sessions unless they
                // exceed the 5-hour room limit. Screen locks cause temporary disconnections
                // but sessions under 5 hours must remain intact for all participants.
                if (session.is_multiplayer || session.partner_session_id) {
                    if (minutesSinceStart > ROOM_MAX_MINUTES) {
                        console.log(`⏰ [Cleanup] Sala multijugador expirada (${minutesSinceStart.toFixed(0)} min > 5h): ${session.id}`);
                        await this.finishSession(session.id, 'Cierre automático: límite de 5 horas de sala');
                        closedIds.push(session.id);
                    } else {
                        console.log(`🛡️ [Cleanup] Sesión multijugador activa preservada (${minutesSinceStart.toFixed(0)} min): ${session.id}`);
                    }
                    continue;
                }

                const { count } = await supabase
                    .from('workout_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('session_id', session.id);

                const hasLogs = (count || 0) > 0;

                if (!hasLogs) {
                    if (minutesSinceStart > 30) {
                        console.log(`🧹 [Cleanup] Eliminando sesión vacía fantasma antigua: ${session.id} (${minutesSinceStart.toFixed(0)} min)`);
                        await this.deleteSession(session.id);
                        closedIds.push(session.id);
                    } else {
                        console.log(`ℹ️ [Cleanup] Sesión vacía reciente (${minutesSinceStart.toFixed(0)} min) — se preserva: ${session.id}`);
                    }
                } else if (minutesSinceStart > 480) {
                    console.log(`🧹 [Cleanup] Cerrando sesión huérfana antigua con datos (${minutesSinceStart.toFixed(0)} min): ${session.id}`);
                    await this.finishSession(session.id, 'Cierre automático por inactividad');
                    closedIds.push(session.id);
                } else {
                    console.log(`ℹ️ [Cleanup] Sesión reciente con datos (${minutesSinceStart.toFixed(0)} min) — se preserva: ${session.id}`);
                }
            }
        } catch (err) {
            console.error('Error in cleanOrphanSessions:', err);
        }
        return closedIds;
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
    async getActiveSession(userId: string): Promise<{ data: WorkoutSession | null; error: any }> {
        // Room (multiplayer) sessions live up to 5 hours; solo sessions up to 4 hours.
        const fourHoursAgo  = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
        const fiveHoursAgo  = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

        // First: check for a recent coop session (5-hour window)
        const { data: coopData, error: coopError } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('user_id', userId)
            .is('finished_at', null)
            .eq('is_multiplayer', true)
            .gt('started_at', fiveHoursAgo)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (coopError) {
            console.error('getActiveSession: coop query failed', coopError);
            return { data: null, error: coopError };
        }
        if (coopData) return { data: coopData, error: null };

        // Fallback: solo session (4h window)
        const { data, error } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('user_id', userId)
            .is('finished_at', null)
            .gt('started_at', fourHoursAgo)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("Error getting active session:", error);
            return { data: null, error };
        }

        return { data, error: null };
    }

    // ─── ROOM METHODS ─────────────────────────────────────────────────────────
    // room_id = the Host's session ID.
    // Host session: id = room_id, is_multiplayer=true
    // Guest sessions: partner_session_id = room_id, is_multiplayer=true

    /** Returns all user_ids currently active in a room (host + guests). */
    async getRoomActiveMembers(roomId: string): Promise<string[]> {
        try {
            // Host
            const { data: host } = await supabase
                .from('workout_sessions')
                .select('user_id')
                .eq('id', roomId)
                .is('finished_at', null)
                .maybeSingle();

            // Guests
            const { data: guests } = await supabase
                .from('workout_sessions')
                .select('user_id')
                .eq('partner_session_id', roomId)
                .is('finished_at', null);

            const ids: string[] = [];
            if (host) ids.push(host.user_id);
            if (guests) guests.forEach(g => ids.push(g.user_id));
            return ids;
        } catch {
            return [];
        }
    }

    /** Returns whether the room (host's session) is still open. */
    async isRoomOpen(roomId: string): Promise<boolean> {
        const { data } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('id', roomId)
            .is('finished_at', null)
            .maybeSingle();
        return !!data;
    }

    /** Given a guest's session, returns the host's user_id so join requests can be routed. */
    async getRoomHostUserId(guestSessionId: string): Promise<string | null> {
        try {
            const { data: guest } = await supabase
                .from('workout_sessions')
                .select('partner_session_id')
                .eq('id', guestSessionId)
                .maybeSingle();

            if (!guest?.partner_session_id) return null;

            const { data: host } = await supabase
                .from('workout_sessions')
                .select('user_id')
                .eq('id', guest.partner_session_id)
                .maybeSingle();

            return host?.user_id || null;
        } catch {
            return null;
        }
    }

    /**
     * Host closes the room.
     * 1. Finalizes host's own session (isManual=true for GX award).
     * 2. Finalizes ALL guest sessions (isManual=false — guests get GX via their own
     *    finalization flow triggered by the `session_finished` broadcast).
     * 3. Sends a `room_closed` notification to every guest's user_id.
     */
    async closeRoom(roomId: string, notes?: string, routineName?: string, geoVerified?: boolean): Promise<{ success: boolean }> {
        const now = new Date().toISOString();

        // 1. Finalize host session with GX
        const hostResult = await this.finishSession(roomId, notes, routineName, true, geoVerified);
        if (!hostResult.success) {
            console.error('closeRoom: failed to finalize host session', hostResult.error);
            return { success: false };
        }

        // 2. Find and finalize all guest sessions
        const { data: guests } = await supabase
            .from('workout_sessions')
            .select('id, user_id')
            .eq('partner_session_id', roomId)
            .is('finished_at', null);

        if (guests && guests.length > 0) {
            // 2a. Get guest session details before finalizing
            const guestSessionIds = guests.map(g => g.id);
            const { data: guestSessions } = await supabase
                .from('workout_sessions')
                .select('id, user_id, started_at')
                .in('id', guestSessionIds);

            // 2b. Bulk set finished_at for all guests
            await supabase
                .from('workout_sessions')
                .update({ finished_at: now, end_time: now, notes: 'Sala cerrada por el anfitrión' })
                .eq('partner_session_id', roomId)
                .is('finished_at', null);

            // 2c. Award GX to each guest + send room_closed notification
            try {
                const { userService } = await import('./UserService');

                // Get host profile for notification message
                const { data: hostSession } = await supabase
                    .from('workout_sessions')
                    .select('user_id')
                    .eq('id', roomId)
                    .maybeSingle();
                const { data: hostProfile } = hostSession
                    ? await supabase.from('profiles').select('username').eq('id', hostSession.user_id).maybeSingle()
                    : { data: null };
                const hostName = hostProfile?.username || 'el anfitrión';

                for (const gSess of (guestSessions || [])) {
                    const durationMinutes = (Date.now() - new Date(gSess.started_at).getTime()) / 60000;

                    if (durationMinutes >= 20) {
                        const today = new Date().toLocaleDateString('en-CA');
                        const { data: todaySessions } = await supabase
                            .from('workout_sessions')
                            .select('id')
                            .eq('user_id', gSess.user_id)
                            .not('finished_at', 'is', null)
                            .like('finished_at', `${today}%`);

                        if (!todaySessions || todaySessions.length <= 1) {
                            await userService.addGxPoints(gSess.user_id, 3, 'workout_finished_coop');
                        }
                    }

                    // Send room_closed notification — this wakes up offline guests
                    await supabase.from('notifications').insert({
                        user_id: gSess.user_id,
                        type: 'room_closed',
                        title: '🏁 SALA CERRADA',
                        message: `${hostName} cerró la sala. Tu progreso fue guardado en tu historial.`,
                        data: { room_id: roomId, host_name: hostName }
                    });
                }
            } catch (e) {
                console.warn('closeRoom: error awarding guest GX or sending notifications:', e);
                // Non-fatal: host session and guest sessions are already closed; only GX/notifications failed
            }
        }

        return { success: true };
    }

    // Get logs for an active session (The "Replay")
    async getSessionLogs(sessionId: string) {
        const { data, error } = await supabase
            .from('workout_logs')
            .select(`
                *,
                exercise:exercises (
                    id,
                    name,
                    target_muscle_group
                )
            `)
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true }); // Order by creation time

        if (error) {
            console.error('Error fetching session logs:', error);
            return [];
        }

        // DEDUPLICATION SAFEGUARD (Corrective Maintenance)
        // Ensure no duplicate log IDs are returned
        const uniqueLogs = Array.from(new Map(data.map((item: any) => [item.id, item])).values());

        return uniqueLogs;
    }


    // Get specific session (The "Target")
    async getSessionById(sessionId: string): Promise<{ data: WorkoutSession | null; error: any }> {
        const { data, error } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('id', sessionId)
            .maybeSingle();

        return { data, error };
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
            .from('workout_logs')
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
            // Show Gym-Specific AND Global Routines
            query = query.or(`gym_id.eq.${gymId},gym_id.is.null`);
        } else {
            // No gym context? Show only Global
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
                custom_metric,
                target_sets,
                target_reps_text
            `)
            .in('routine_id', routineIds);

        if (exercisesError) console.warn('Error fetching routine_exercises:', exercisesError);

        // 3. REMOVED routine_items fetch (404 Not Found)

        // 4. Manual Join: Fetch Exercise Names from 'gym_equipment' (and fallback to 'exercises')
        const allExercises = exercisesData || [];
        const exerciseIds = Array.from(new Set(allExercises.map(e => e.exercise_id)));

        let exercisesMap = new Map<string, any>();

        if (exerciseIds.length > 0) {
            // Try 'gym_equipment' first (Standard + Custom)
            const { data: gymEqData } = await supabase
                .from('gym_equipment')
                .select('id, name, metrics')
                .in('id', exerciseIds);

            if (gymEqData) {
                gymEqData.forEach(ex => exercisesMap.set(ex.id, ex));
            }

            // identify missing IDs
            const missingIds = exerciseIds.filter(id => !exercisesMap.has(id));

            if (missingIds.length > 0) {
                // Try 'exercises' (Legacy or Global Master if exists)
                const { data: exData } = await supabase
                    .from('exercises')
                    .select('id, name')
                    .in('id', missingIds);

                if (exData) {
                    exData.forEach(ex => exercisesMap.set(ex.id, ex));
                }
            }
        }

        // 5. Merge Data
        return routinesData.map(r => {
            const myExercisesRaw = allExercises.filter(e => e.routine_id === r.id);

            // Attach exercise information
            const myExercises = myExercisesRaw.map(e => ({
                ...e,
                equipment: exercisesMap.get(e.exercise_id) || { name: e.name || 'Ejercicio Desconocido' } // Better fallback
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
    async createRoutine(userId: string, name: string, exercises: string[] | any[], gymId?: string | null) {
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

        // 2. Link Exercises
        if (exercises.length > 0) {
            if (typeof exercises[0] === 'string') {
                // Legacy: Array of IDs
                await this.linkEquipmentToRoutine(routineData.id, exercises as string[]);
            } else {
                // Rich Objects: Array of ActiveExercise/GymEquipment
                // We need to map them to the format expected by linkRichExercisesToRoutine
                // If it comes from ActiveExercise (UI), it has 'equipmentId' and 'name'
                // If it comes from DB, it has 'id' and 'name'
                const richPayload = exercises.map(ex => {
                    // RESOLVE CONFIGURATION:
                    // Source A: "metrics" object (from WorkoutSession ActiveExercise)
                    // Source B: Direct "track_*" props (from MyArsenal RoutineConfig)
                    let config = {
                        track_weight: ex.track_weight,
                        track_reps: ex.track_reps,
                        track_time: ex.track_time,
                        track_distance: ex.track_distance,
                        track_rpe: ex.track_rpe,
                        track_pr: ex.track_pr,
                        custom_metric: ex.custom_metric
                    };

                    if (ex.metrics) {
                        config.track_weight = ex.metrics.weight;
                        config.track_reps = ex.metrics.reps;
                        config.track_time = ex.metrics.time;
                        config.track_distance = ex.metrics.distance;
                        config.track_rpe = ex.metrics.rpe;
                        config.track_pr = ex.metrics.track_pr; // Sometimes in metrics

                        // FIND CUSTOM METRIC
                        // Any key in metrics that is TRUE and NOT standard
                        const standardKeys = ['weight', 'reps', 'time', 'distance', 'rpe', 'track_pr'];
                        const customKey = Object.keys(ex.metrics).find(k => !standardKeys.includes(k) && ex.metrics[k] === true);
                        if (customKey) {
                            config.custom_metric = customKey;
                        }
                    }

                    return {
                        id: ex.equipmentId || ex.id, // Support both formats
                        name: ex.equipmentName || ex.name,
                        ...config
                    };
                });
                await this.linkRichExercisesToRoutine(routineData.id, richPayload);
            }
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
                const { error: linkError } = await this.linkRichExercisesToRoutine(routineId, equipmentData);
                if (linkError) return { error: linkError };
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
            // icon: ex.icon, // [REMOVED] Schema doesn't support this yet
            order_index: idx,
            track_weight: ex.track_weight !== undefined ? ex.track_weight : true,
            track_reps: ex.track_reps !== undefined ? ex.track_reps : true,
            track_time: ex.track_time !== undefined ? ex.track_time : false,
            track_pr: ex.track_pr !== undefined ? ex.track_pr : false,
            track_distance: ex.track_distance !== undefined ? ex.track_distance : false,
            track_rpe: ex.track_rpe !== undefined ? ex.track_rpe : false,
            custom_metric: ex.custom_metric !== undefined ? ex.custom_metric : null,
            // Add other fields when DB supports them fully
            // target_sets: ex.target_sets,
        }));

        const { error } = await supabase.from('routine_exercises').insert(exerciseRows);
        if (error) {
            console.error("Error saving rich exercises:", error);
            return { error };
        }
        return { error: null };
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





    /**
     * Get ALL sets for a specific exercise from the LAST time the user did it.
     * Used for the "Ghost" System (Predictive Autofill).
     */
    async getGhostSets(exerciseId: string, userId: string): Promise<any[]> {
        try {
            // Two-step approach to avoid PostgREST 406 on foreign table filters
            // Step 1: Get the user's recent finished session IDs
            const { data: userSessions } = await supabase
                .from('workout_sessions')
                .select('id')
                .eq('user_id', userId)
                .not('end_time', 'is', null)
                .order('started_at', { ascending: false })
                .limit(20);

            if (!userSessions || userSessions.length === 0) return [];

            const sessionIds = userSessions.map(s => s.id);

            // Step 2: Find the most recent log for this exercise within those sessions, owned by this user
            const { data: lastLog, error: lastLogError } = await supabase
                .from('workout_logs')
                .select('session_id')
                .eq('exercise_id', exerciseId)
                .eq('owner_id', userId)
                .in('session_id', sessionIds)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastLogError || !lastLog) return [];

            // Step 3: Fetch all sets for that session and exercise, strictly scoped to this user
            const { data: ghostSets, error: setsError } = await supabase
                .from('workout_logs')
                .select('*')
                .eq('session_id', lastLog.session_id)
                .eq('exercise_id', exerciseId)
                .eq('owner_id', userId)
                .order('created_at', { ascending: true });

            if (setsError) return [];
            return ghostSets || [];
        } catch (err) {
            console.error('Exception fetching ghost sets:', err);
            return [];
        }
    }

    /**
     * Get the most recent log for a specific exercise and user.
     * Used for "Smart Chips" to suggest weights/reps.
     */
    async getLastLog(exerciseId: string, userId: string): Promise<{ weight: number, reps: number } | null> {
        try {
            // Two-step approach to avoid PostgREST 406 on foreign table filters
            const { data: userSessions } = await supabase
                .from('workout_sessions')
                .select('id')
                .eq('user_id', userId)
                .not('end_time', 'is', null)
                .order('started_at', { ascending: false })
                .limit(20);

            if (!userSessions || userSessions.length === 0) return null;

            const sessionIds = userSessions.map(s => s.id);

            const { data, error } = await supabase
                .from('workout_logs')
                .select('weight_kg, reps')
                .eq('exercise_id', exerciseId)
                .in('session_id', sessionIds)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                // It's normal to have no history
                if (error.code !== 'PGRST116') {
                    console.error('Error fetching last log:', error);
                }
                return null;
            }

            return {
                weight: data.weight_kg,
                reps: data.reps
            };
        } catch (err) {
            console.error('Exception fetching last log:', err);
            return null;
        }
    }

    // Share a routine with multiple users
    async shareRoutine(routineId: string, sharedBy: string, sharedWithUserIds: string[]) {
        try {
            // First, delete any existing shares for this routine so we can rewrite them cleanly
            await supabase
                .from('routine_shares')
                .delete()
                .eq('routine_id', routineId);

            if (sharedWithUserIds.length === 0) {
                return { success: true };
            }

            const payload = sharedWithUserIds.map(userId => ({
                routine_id: routineId,
                shared_by: sharedBy,
                shared_with: userId
            }));

            const { error } = await supabase
                .from('routine_shares')
                .insert(payload);

            if (error) {
                console.error("Error sharing routine:", error);
                if (error.code === '42P01') { // Relation does not exist
                    alert("⚠️ Para poder compartir rutinas, debes ejecutar el script SQL de migración 'routine_shares_migration.sql' en tu panel de Supabase.");
                }
                return { success: false, error };
            }
            return { success: true };
        } catch (err) {
            console.error("Exception sharing routine:", err);
            return { success: false, error: err };
        }
    }

    // Get list of user IDs a routine is currently shared with
    async getRoutineShares(routineId: string): Promise<string[]> {
        try {
            const { data, error } = await supabase
                .from('routine_shares')
                .select('shared_with')
                .eq('routine_id', routineId);

            if (error) {
                if (error.code === '42P01') {
                    console.warn("routine_shares table does not exist yet.");
                } else {
                    console.error("Error getting routine shares:", error);
                }
                return [];
            }
            return data?.map(d => d.shared_with) || [];
        } catch (err) {
            console.error("Exception getting routine shares:", err);
            return [];
        }
    }
}

export const workoutService = new WorkoutService();
