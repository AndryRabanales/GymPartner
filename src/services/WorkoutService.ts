import { supabase } from '../lib/supabase';
import { routineCache, offlineRoutineQueue, nativeStore } from '../lib/offlineCache';

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
    metrics_data?: Record<string, any>; // Flexible JSONB storage
    is_pr?: boolean;
    category_snapshot?: string; // HISTORICAL: Preserves category at time of log
    owner_id?: string; // NEW: Explicitly track who performed this set
    _exercise_name?: string; // Offline only: exercise name when exercise_id couldn't be resolved
}

interface OfflineSessionMeta {
    user_id: string;
    gym_id?: string;
    is_multiplayer: boolean;
    multiplayer_mode?: string;
    partner_id?: string;
    partner_session_id?: string;
    started_at: string;
}

interface OfflineFinishMeta {
    notes?: string;
    routineName?: string;
    geoVerified?: boolean;
}

class WorkoutService {
    // Start a new empty session (The "Battle" begins)
    async startSession(
        userId: string,
        gymId?: string,
        isMultiplayer?: boolean,
        multiplayerMode?: string,
        partnerId?: string,
        partnerSessionId?: string,
        startedAt?: string
    ): Promise<{ data?: WorkoutSession; error?: any }> {
        const { data, error } = await supabase
            .from('workout_sessions')
            .insert({
                user_id: userId,
                gym_id: gymId,
                started_at: startedAt || new Date().toISOString(),
                is_multiplayer: isMultiplayer || false,
                multiplayer_mode: multiplayerMode || null,
                partner_id: partnerId || null,
                partner_session_id: partnerSessionId || null
            })
            .select()
            .single();

        if (error) console.error('[WS] startSession failed:', error.message, { userId, isMultiplayer, partnerSessionId });
        else console.log('[WS] ✓ Session created:', data?.id, { isMultiplayer, partnerSessionId: partnerSessionId ?? null });

        if (error) {
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

            // Collect recipient IDs from both sources:
            // 1. Training partners (chats table = accepted matches)
            // 2. History-share recipients (explicit history access grants)
            const recipientSet = new Set<string>();

            const { data: chats } = await supabase
                .from('chats')
                .select('user_a, user_b')
                .or(`user_a.eq.${userId},user_b.eq.${userId}`);

            (chats || []).forEach(chat => {
                const friendId = chat.user_a === userId ? chat.user_b : chat.user_a;
                recipientSet.add(friendId);
            });

            const { data: shares } = await supabase
                .from('history_shares')
                .select('shared_with')
                .eq('shared_by', userId);

            (shares || []).forEach(share => recipientSet.add(share.shared_with));

            // Remove self and the active training partner (already in the session)
            recipientSet.delete(userId);
            if (partnerId) recipientSet.delete(partnerId);

            if (recipientSet.size > 0) {
                const notificationsPayload = Array.from(recipientSet).map(recipientId => ({
                    user_id: recipientId,
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

                await supabase.from('notifications').insert(notificationsPayload);
            }
        } catch (notifyErr) {
            console.error('Error sending start live notification:', notifyErr);
        }

        return { data };
    }

    // Finish the session (The "Victory")
    // setFinishedAt=true (default, including soft-finalize): sets both finished_at
    // and end_time=now so sessions appear in Historial immediately when Finalizar
    // is pressed — no dependency on room_all_finished to stamp end_time.
    async finishSession(sessionId: string, notes?: string, routineName?: string, isManual: boolean = false, geoVerified?: boolean, setFinishedAt: boolean = true): Promise<{ success: boolean; error?: any }> {
        const now = new Date().toISOString();

        if (setFinishedAt) {
            const updatePayload: any = {
                end_time: now,
                finished_at: now,
                notes,
                session_state: null
            };

            if (routineName) {
                updatePayload.routine_name = routineName;
            }

            const { error } = await supabase
                .from('workout_sessions')
                .update(updatePayload)
                .eq('id', sessionId);

            if (error) console.error('[WS] finishSession failed:', error.message, { sessionId });
            else console.log('[WS] ✓ Session finished:', sessionId);

            if (error) {
                return { success: false, error };
            }
        } else {
            // Soft-finalize: set finished_at NOW so getActiveSession() returns null
            // (prevents rescue modal), but leave end_time null so the session stays
            // hidden in Historial until every room participant finishes.
            const softPayload: any = { finished_at: now, session_state: null };
            if (notes) softPayload.notes = notes;
            if (routineName) softPayload.routine_name = routineName;

            const { error } = await supabase
                .from('workout_sessions')
                .update(softPayload)
                .eq('id', sessionId);

            if (error) {
                // Non-fatal: continue with GX/notifications below
            }
        }

        // If this is an automatic/background close, skip G-points and notifications
        if (!isManual) {
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
                            // Geo check failed — no GX awarded
                        } else {
                        const isMulti = session.is_multiplayer || false;
                        const pointsAwarded = isMulti ? 2 : 1;
                        const reason = isMulti ? 'workout_finished_coop' : 'workout_finished';

                        // Award GX points
                        await userService.addGxPoints(session.user_id, pointsAwarded, reason);

                        // Grow the lifetime streak counter (+1/day, never decreases) —
                        // exact same qualifying condition as the daily training GX above.
                        try {
                            const { streakService } = await import('./StreakService');
                            await streakService.recordTrainingDay(session.user_id);
                        } catch (streakErr) {
                            console.error('Could not record streak training day:', streakErr);
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
                }
            }
        } catch (e) {
            console.error('Could not award GX Points or training cumulative point:', e);
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

    // Lightweight, RLS-safe (self-row only) timestamp stamp used when a
    // multiplayer participant learns — via the `room_all_finished` broadcast —
    // that the LAST participant in the room has finalized. Marks THIS
    // session as finished so it now appears in "Historial".
    async markSessionFinished(sessionId: string, finishedAtIso?: string): Promise<{ success: boolean; error?: any }> {
        const finishedAt = finishedAtIso || new Date().toISOString();
        // finished_at was already set during soft-finalize; only end_time is missing.
        // Filter on end_time IS NULL to avoid re-stamping already-closed sessions.
        const { error } = await supabase
            .from('workout_sessions')
            .update({ finished_at: finishedAt, end_time: finishedAt })
            .eq('id', sessionId)
            .is('end_time', null);

        if (error) {
            console.error('Error marking session finished:', error);
            return { success: false, error };
        }
        return { success: true };
    }

    // Best-effort fallback used when a GUEST turns out to be the LAST
    // participant to finalize a coop room. Mirrors the bulk-update step that
    // closeRoom() already performs for host→guests, but in the opposite
    // direction (guest→host / guest→other guests). If the RLS policy on
    // workout_sessions doesn't allow cross-user updates from a non-host,
    // this silently no-ops — the primary mechanism (room_all_finished
    // broadcast → each client self-stamps via markSessionFinished) covers
    // any participant still connected/on the summary screen.
    async finalizeOtherRoomSessions(roomId: string, excludeSessionId: string): Promise<void> {
        const now = new Date().toISOString();
        try {
            if (roomId !== excludeSessionId) {
                await supabase
                    .from('workout_sessions')
                    .update({ finished_at: now, end_time: now })
                    .eq('id', roomId)
                    .is('end_time', null);
            }
            await supabase
                .from('workout_sessions')
                .update({ finished_at: now, end_time: now })
                .eq('partner_session_id', roomId)
                .neq('id', excludeSessionId)
                .is('end_time', null);
        } catch (e) {
            console.error('finalizeOtherRoomSessions: best-effort cross-user update failed (RLS?):', e);
        }
    }

    // HARD delete used ONLY when a participant hits "Cancelar Entrenamiento"
    // in a multiplayer room. Unlike deleteSession(), this NEVER finalizes as
    // a fallback — the canceller must end up with ZERO history, regardless
    // of whether they already logged sets.
    async forceDeleteSession(sessionId: string): Promise<{ success: boolean; error?: any }> {
        try {
            await supabase.from('workout_logs').delete().eq('session_id', sessionId);
        } catch (e) {
            console.error('forceDeleteSession: error deleting workout_logs (continuing):', e);
        }

        const { error } = await supabase
            .from('workout_sessions')
            .delete()
            .eq('id', sessionId);

        if (error) {
            console.error('Error force-deleting session:', error);
            return { success: false, error };
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
                        await this.finishSession(session.id, 'Cierre automático: límite de 5 horas de sala');
                        closedIds.push(session.id);
                    }
                    continue;
                }

                const { count } = await supabase
                    .from('workout_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('session_id', session.id);

                const hasLogs = (count || 0) > 0;

                if (!hasLogs) {
                    // 3 hours gives enough time for any legitimate workout — including coop
                    // sessions whose is_multiplayer flag wasn't set correctly in the DB row.
                    // 30 minutes was too aggressive and closed active coop participants
                    // who hadn't logged any sets yet, wiping their exercises from state.
                    if (minutesSinceStart > 180) {
                        await this.deleteSession(session.id);
                        closedIds.push(session.id);
                    }
                } else if (minutesSinceStart > 480) {
                    await this.finishSession(session.id, 'Cierre automático por inactividad');
                    closedIds.push(session.id);
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

        if (error) console.error('[WS] logSet failed:', error.message, { sessionId: setData.session_id, exerciseId: setData.exercise_id, setNumber: setData.set_number });
        else console.log('[WS] ✓ Set logged:', { sessionId: setData.session_id, exerciseId: setData.exercise_id, setNumber: setData.set_number, weight: safePayload.weight_kg, reps: safePayload.reps });

        if (error) {
            return { error };
        }
        return { data };
    }

    // Get incomplete session if app crashed or user left
    async getActiveSession(userId: string): Promise<{ data: WorkoutSession | null; error: any }> {
        // Room (multiplayer) sessions live up to 5 hours; solo sessions up to 4 hours.
        const fourHoursAgo  = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
        const fiveHoursAgo  = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

        // ⚠️ GHOST-SESSION FIX: query BOTH the most recent coop session (5h window)
        // AND the most recent session overall (4h window) in parallel, then return
        // whichever was started MORE RECENTLY.
        //
        // The previous version ALWAYS returned an is_multiplayer=true session — even
        // if it was hours older than a brand-new solo session the user just started.
        // That meant a leftover/orphaned coop session ("entrenamiento fantasma") from
        // an earlier interrupted room could SHADOW the session the user is actually,
        // currently training in right now.
        //
        // Concretely this broke the join flow: FriendsPage.handleJoinWorkout resolves
        // `roomSessionId` via a plain "most recently started" query (no is_multiplayer
        // filter), while CoopJoinRequestToast's accept handler resolved `resolvedSession`
        // via THIS method — which could point at a totally different (ghost) session row.
        // Host and guest would then end up listening on two different
        // `coop-workout-${roomId}` realtime channels — guest broadcasts into an empty
        // room, host never sees anything ("llega la notificación pero no carga nada").
        //
        // Always preferring the most-recently-started unfinished session makes this
        // method agree with FriendsPage's resolution (and with "the session the user
        // is obviously in right now") in every case.
        const [coopRes, recentRes] = await Promise.all([
            supabase
                .from('workout_sessions')
                .select('*')
                .eq('user_id', userId)
                .is('finished_at', null)
                .eq('is_multiplayer', true)
                .gt('started_at', fiveHoursAgo)
                .order('started_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from('workout_sessions')
                .select('*')
                .eq('user_id', userId)
                .is('finished_at', null)
                .gt('started_at', fourHoursAgo)
                .order('started_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);

        const { data: coopData, error: coopError } = coopRes;
        const { data: recentData, error: recentError } = recentRes;

        if (coopError && recentError) {
            console.error('getActiveSession: both queries failed', { coopError, recentError });
            return { data: null, error: recentError || coopError };
        }
        if (recentError) {
            console.error('getActiveSession: recent-session query failed, falling back to coop result', recentError);
        }
        if (coopError) {
            console.error('getActiveSession: coop query failed, falling back to recent result', coopError);
        }

        if (coopData && recentData) {
            // Both exist — the row with the LATER started_at is the one the user is
            // actually in right now (could be the same row, or the coop one, or the
            // newer solo one — never blindly prefer multiplayer over recency).
            const coopIsNewer = new Date(coopData.started_at).getTime() > new Date(recentData.started_at).getTime();
            return { data: coopIsNewer ? coopData : recentData, error: null };
        }

        return { data: coopData || recentData || null, error: null };
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
            .is('end_time', null)
            .maybeSingle();
        return !!data;
    }

    /**
     * Returns the count of room participants who have NOT yet soft-finalized
     * (finished_at IS NULL), excluding the caller's own session.
     *
     * Used to determine "am I the last to finish?" purely from DB state,
     * without relying on realtime presence (which breaks when participants
     * navigate to other screens while their session is still open).
     *
     * roomId = host's session id (= partner_session_id for guests).
     */
    async countPendingRoomParticipants(roomId: string, excludeSessionId: string): Promise<number> {
        const [{ data: hostPending }, { count: guestCount }] = await Promise.all([
            supabase
                .from('workout_sessions')
                .select('id')
                .eq('id', roomId)
                .neq('id', excludeSessionId)
                .is('finished_at', null)
                .maybeSingle(),
            supabase
                .from('workout_sessions')
                .select('id', { count: 'exact', head: true })
                .eq('partner_session_id', roomId)
                .neq('id', excludeSessionId)
                .is('finished_at', null)
        ]);
        return (hostPending ? 1 : 0) + (guestCount || 0);
    }

    /**
     * Safety-net for soft-finalized sessions (finished_at set, end_time null).
     * If all other room participants have also soft-finalized, stamps end_time
     * so this session appears in Historial.
     *
     * Called from AppLayout on mount/navigation so missed `room_all_finished`
     * broadcasts are resolved the next time the user opens the app.
     *
     * Returns true if end_time was stamped (session is now fully closed).
     */
    async resolveOrphanedCoopSession(mySessionId: string): Promise<boolean> {
        try {
            const { data: mySession } = await supabase
                .from('workout_sessions')
                .select('id, partner_session_id, is_multiplayer, end_time')
                .eq('id', mySessionId)
                .maybeSingle();

            if (!mySession || mySession.end_time) return false; // already closed
            if (!mySession.is_multiplayer) return false; // solo — shouldn't happen

            const roomId = mySession.partner_session_id || mySession.id;
            const pending = await this.countPendingRoomParticipants(roomId, mySessionId);

            if (pending === 0) {
                await this.markSessionFinished(mySessionId);
                return true;
            }
            return false;
        } catch {
            return false;
        }
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
     * Opens a short-lived realtime channel for the room and broadcasts
     * `session_finished`, then waits briefly so connected guests have time to
     * receive it, save their pending sets, and flip to their summary screen
     * BEFORE we bulk-finalize their session rows in the DB (closeRoom step 2).
     *
     * WHY THIS EXISTS: WorkoutSession.tsx already has a complete handler for
     * `broadcast: { event: 'session_finished' }` (saves the guest's own
     * playerWeights/Reps/etc via logSet, shows "¡Progreso guardado!", then
     * shows the summary) — but NOTHING in the codebase ever sent that event.
     * closeRoom() simply set `finished_at` on every guest's row directly via
     * a bulk UPDATE, with no workout_logs ever written for them: every guest
     * silently lost 100% of their set data the moment a host closed the room,
     * despite the confirm dialog promising "cada participante conservará su
     * progreso en su historial". This wires the existing (until now dead)
     * guest-side handler up at its single source so that promise is kept.
     *
     * Best-effort: any failure here must NEVER block the actual room closure —
     * worst case (e.g. a guest is offline) is identical to the prior behavior.
     */
    private async broadcastSessionFinished(roomId: string): Promise<void> {
        let channel: ReturnType<typeof supabase.channel> | null = null;
        try {
            channel = supabase.channel(`coop-workout-${roomId}`);
            await new Promise<void>((resolve) => {
                let settled = false;
                const finish = () => { if (!settled) { settled = true; resolve(); } };
                channel!.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        channel!.send({
                            type: 'broadcast',
                            event: 'session_finished',
                            // Sentinel id — guaranteed not to equal any real user.id, so
                            // every connected guest's `if (sender === user.id) return;`
                            // guard passes through and their save routine runs.
                            payload: { sender: 'host-close-room' }
                        }).finally(finish);
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        finish();
                    }
                });
                // Safety net — never let closeRoom hang if the channel never subscribes.
                setTimeout(finish, 4000);
            });
            // Give guests' clients time to receive the broadcast, resolve exercise
            // ids, write their workout_logs rows, and show "¡Progreso guardado!".
            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (e) {
            console.error('closeRoom: failed to broadcast session_finished to guests (non-fatal):', e);
        } finally {
            if (channel) {
                try { await supabase.removeChannel(channel); } catch { /* ignore */ }
            }
        }
    }

    /**
     * Host closes the room.
     * 0. Broadcasts `session_finished` so connected guests can save their own
     *    pending sets first (see broadcastSessionFinished above — this is the
     *    fix for guests silently losing all their data on room close).
     * 1. Finalizes host's own session (isManual=true for GX award).
     * 2. Finalizes ALL guest sessions (isManual=false — they already saved their
     *    own logs via the broadcast above; GX is awarded directly below).
     * 3. Sends a `room_closed` notification to every guest's user_id.
     */
    // alreadyFinalizedUserIds: guests who already pressed "Finalizar" themselves
    // (Phase 5 — soft-finalize with setFinishedAt=false). They were already
    // awarded GX/streak/notifications at THAT moment — closeRoom must still
    // bulk-stamp their finished_at/end_time below (2b), but must NOT re-run
    // GX/notifications for them (would double-award).
    async closeRoom(roomId: string, notes?: string, routineName?: string, geoVerified?: boolean, skipBroadcast = false, alreadyFinalizedUserIds: string[] = []): Promise<{ success: boolean }> {
        const now = new Date().toISOString();

        // 0. Let connected guests persist their own workout_logs before their
        // session rows get finalized below — see broadcastSessionFinished's doc.
        // skipBroadcast=true when the caller (WorkoutSession handleFinalizeSession)
        // already sent session_finished via its own live channel — avoids double delivery.
        if (!skipBroadcast) {
            await this.broadcastSessionFinished(roomId);
        }

        // 1. Finalize host session with GX
        const hostResult = await this.finishSession(roomId, notes, routineName, true, geoVerified);
        if (!hostResult.success) {
            console.error('closeRoom: failed to finalize host session', hostResult.error);
            return { success: false };
        }

        // 2. Find and finalize all guest sessions.
        // Filter on end_time IS NULL (not finished_at) because soft-finalized guests
        // already have finished_at set — they still need end_time stamped to appear in Historial.
        const { data: guests } = await supabase
            .from('workout_sessions')
            .select('id, user_id')
            .eq('partner_session_id', roomId)
            .is('end_time', null);

        if (guests && guests.length > 0) {
            // 2a. Get guest session details before finalizing
            const guestSessionIds = guests.map(g => g.id);
            const { data: guestSessions } = await supabase
                .from('workout_sessions')
                .select('id, user_id, started_at')
                .in('id', guestSessionIds);

            // 2b. Stamp end_time (and finished_at as safety) for all guests not yet in Historial
            await supabase
                .from('workout_sessions')
                .update({ finished_at: now, end_time: now, notes: 'Sala cerrada por el anfitrión' })
                .eq('partner_session_id', roomId)
                .is('end_time', null);

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
                    // Already self-finalized (and already awarded GX) before the host
                    // closed the room — only the bulk finished_at/end_time stamp (2b)
                    // applies to them; skip GX/notifications to avoid double-awarding.
                    if (alreadyFinalizedUserIds.includes(gSess.user_id)) continue;

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
                            await userService.addGxPoints(gSess.user_id, 2, 'workout_finished_coop');
                        }
                    }

                    // Send room_closed notification — this wakes up offline guests
                    await supabase.from('notifications').insert({
                        user_id: gSess.user_id,
                        type: 'room_closed',
                        title: '🏁 SALA CERRADA',
                        message: `${hostName} cerró la sala. Tu progreso fue guardado en tu historial.`,
                        data: {
                            room_id: roomId,
                            host_name: hostName,
                            sender_id: hostSession?.user_id,
                            sender_name: hostName
                        }
                    });
                }
            } catch (e) {
                console.error('closeRoom: error awarding guest GX or sending notifications:', e);
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
    // Build the routine list from an offline-routine queue entry so it matches
    // the shape returned by the DB query (used by getUserRoutines below).
    private _buildOfflineRoutineRecord(r: any) {
        return {
            id: r.tempId,
            user_id: r.userId,
            gym_id: r.gymId || null,
            name: r.name,
            created_at: r.created_at,
            is_public: false,
            _isOfflinePending: true,
            equipment_ids: (r.exercises || []).map((e: any) => e.id || e.equipmentId),
            routine_exercises: (r.exercises || []).map((e: any, idx: number) => ({
                id: `local_${r.tempId}_${idx}`,
                routine_id: r.tempId,
                exercise_id: e.id || e.equipmentId,
                name: e.name || e.equipmentName || '',
                order_index: idx,
                track_weight: e.metrics?.weight ?? e.track_weight ?? true,
                track_reps: e.metrics?.reps ?? e.track_reps ?? true,
                track_time: e.metrics?.time ?? e.track_time ?? false,
                track_distance: e.metrics?.distance ?? e.track_distance ?? false,
                track_rpe: e.metrics?.rpe ?? e.track_rpe ?? false,
                equipment: { name: e.name || e.equipmentName || '', metrics: e.metrics }
            }))
        };
    }

    async getUserRoutines(userId: string, gymId?: string | null) {
        // ── Offline: return cached + queued routines ──────────────────────────
        if (!navigator.onLine) {
            let cached = await routineCache.load(userId, gymId);
            // If specific gymId cache is empty, fall back to global cache
            if (cached.length === 0 && gymId) cached = await routineCache.load(userId, null);
            // If still empty (gymId was null), also try global
            if (cached.length === 0) cached = await routineCache.load(userId, null);
            const offlineQueue = await offlineRoutineQueue.getAll();
            const offlineRecords = offlineQueue
                .filter((r: any) => r.userId === userId && (r.gymId === gymId || (!r.gymId && !gymId)))
                .map((r: any) => this._buildOfflineRoutineRecord(r));
            return [...offlineRecords, ...cached];
        }

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
            const cached = await routineCache.load(userId, gymId);
            const offlineQueue = await offlineRoutineQueue.getAll();
            const offlineRecords = offlineQueue
                .filter((r: any) => r.userId === userId && (r.gymId === gymId || (!r.gymId && !gymId)))
                .map((r: any) => this._buildOfflineRoutineRecord(r));
            return [...offlineRecords, ...cached];
        }

        if (!routinesData || routinesData.length === 0) {
            await routineCache.save(userId, gymId, []);
            const offlineQueue = await offlineRoutineQueue.getAll();
            return offlineQueue
                .filter((r: any) => r.userId === userId && (r.gymId === gymId || (!r.gymId && !gymId)))
                .map((r: any) => this._buildOfflineRoutineRecord(r));
        }

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

        if (exercisesError) console.error('Error fetching routine_exercises:', exercisesError);

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
        const onlineResult = routinesData.map(r => {
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
                ],
                routine_exercises: myExercises,
            };
        });

        // Cache for offline use — save under specific gymId AND global fallback
        routineCache.save(userId, gymId, onlineResult).catch(() => {});
        if (gymId) {
            // Merge into global cache so offline access works even when GPS can't resolve gymId
            routineCache.load(userId, null).then(existing => {
                const merged = [...onlineResult, ...existing.filter((r: any) => !onlineResult.some((x: any) => x.id === r.id))];
                routineCache.save(userId, null, merged).catch(() => {});
            }).catch(() => {});
        }

        // Prepend any offline-queued routines (not yet synced)
        const offlineQueue = await offlineRoutineQueue.getAll();
        const offlineRecords = offlineQueue
            .filter((r: any) => r.userId === userId && (r.gymId === gymId || (!r.gymId && !gymId)))
            .map((r: any) => this._buildOfflineRoutineRecord(r));
        return [...offlineRecords, ...onlineResult];
    }

    // Save a routine locally when offline; synced by flushPendingSets on reconnect.
    private _queueOfflineRoutine(userId: string, name: string, exercises: any[], gymId?: string | null) {
        const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        offlineRoutineQueue.add({ tempId, userId, gymId: gymId || null, name, exercises, created_at: new Date().toISOString() })
            .catch(e => console.error('Error queuing offline routine:', e));
        return { data: { id: tempId, _isOfflinePending: true } };
    }

    // Create a new Routine (Master or Gym-Specific)
    async createRoutine(userId: string, name: string, exercises: string[] | any[], gymId?: string | null) {
        // Offline: queue locally and return a temp ID
        if (!navigator.onLine) {
            return this._queueOfflineRoutine(userId, name, exercises as any[], gymId);
        }

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
            // Queue on any failure — navigator.onLine is unreliable with weak WiFi
            return this._queueOfflineRoutine(userId, name, exercises as any[], gymId);
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
            console.error('[linkEquipmentToRoutine] Insert failed:', insertError);
            return;
        }
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
                    console.error("routine_shares table does not exist yet.");
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

    // ── OFFLINE SYNC QUEUE (spec §1.2) ──────────────────────────────────────
    // "Quedarse sin conexión a internet durante un entrenamiento individual
    // nunca cancela la sesión ni pierde ningún dato ya registrado — el usuario
    // puede finalizar normalmente y todo queda guardado. Al recuperar la
    // conexión, todos los datos registrados offline se sincronizan
    // automáticamente con el servidor sin necesidad de acción del usuario."
    //
    // Before this, a logSet() failure at finish-time only showed an error
    // toast — the set's data was permanently lost the moment the local draft
    // was cleared. Now WorkoutSession queues the EXACT payload here instead,
    // and flushPendingSets() (invoked on app load + on the 'online' event from
    // AppLayout) silently recovers and saves it the moment connectivity returns.

    // Queue a set payload that failed to save so it can be retried later.
    queuePendingSet(sessionId: string, payload: WorkoutSetData): void {
        try {
            const key = `ginx_pending_sets_${sessionId}`;
            const existing: WorkoutSetData[] = JSON.parse(localStorage.getItem(key) || '[]');
            existing.push(payload);
            localStorage.setItem(key, JSON.stringify(existing));

            const indexKey = 'ginx_pending_sync_sessions';
            const idx: string[] = JSON.parse(localStorage.getItem(indexKey) || '[]');
            if (!idx.includes(sessionId)) {
                idx.push(sessionId);
                localStorage.setItem(indexKey, JSON.stringify(idx));
            }
        } catch (e) {
            console.error('Error queuing pending set for offline sync:', e);
        }
    }

    // Store session metadata for a workout started without connectivity.
    // The Supabase row is created (and set payloads remapped) in flushPendingSets
    // when connectivity returns.
    queueOfflineSession(localId: string, meta: OfflineSessionMeta): void {
        try {
            localStorage.setItem(`ginx_offline_session_${localId}`, JSON.stringify(meta));
            const indexKey = 'ginx_pending_sync_sessions';
            const idx: string[] = JSON.parse(localStorage.getItem(indexKey) || '[]');
            if (!idx.includes(localId)) {
                idx.push(localId);
                localStorage.setItem(indexKey, JSON.stringify(idx));
            }
        } catch (e) {
            console.error('Error queuing offline session:', e);
        }
    }

    // Store finalization data for a session that could not be finalized online.
    // Picked up by flushPendingSets on reconnect.
    queueOfflineFinish(sessionId: string, meta: OfflineFinishMeta): void {
        try {
            localStorage.setItem(`ginx_offline_finish_${sessionId}`, JSON.stringify(meta));
            // Register in the sync index so flushPendingSets processes this session
            // even when no sets failed (e.g. session started online, all sets saved,
            // but internet dropped exactly at the Finalizar tap).
            const indexKey = 'ginx_pending_sync_sessions';
            const idx: string[] = JSON.parse(localStorage.getItem(indexKey) || '[]');
            if (!idx.includes(sessionId)) {
                idx.push(sessionId);
                localStorage.setItem(indexKey, JSON.stringify(idx));
            }
        } catch (e) {
            console.error('Error queuing offline finish:', e);
        }
    }

    // Push any routines that were created offline to Supabase now that we're back online.
    // Called by flushPendingSets — no need to call it directly.
    private async _flushOfflineRoutines(): Promise<void> {
        try {
            const queue = await offlineRoutineQueue.getAll();
            if (queue.length === 0) return;
            const still: any[] = [];
            for (const r of queue) {
                const res = await this.createRoutine(r.userId, r.name, r.exercises, r.gymId);
                if (res.error || !res.data || (res.data as any)._isOfflinePending) {
                    still.push(r);
                } else {
                    // Invalidate cache so next load picks up the real ID from Supabase
                    await routineCache.save(r.userId, r.gymId, []);
                }
            }
            await offlineRoutineQueue.save(still);
        } catch (e) {
            console.error('Error flushing offline routines:', e);
        }
    }

    // Retry every queued set across every session. Also resolves offline sessions
    // (created without connectivity) by creating the Supabase row and remapping
    // payloads before flushing. Safe to call repeatedly — on app start AND on
    // every 'online' event.
    async flushPendingSets(): Promise<{ recovered: number; stillPending: number }> {
        // Flush offline routines first (they don't depend on session IDs)
        await this._flushOfflineRoutines();

        let recovered = 0;
        let stillPending = 0;
        const indexKey = 'ginx_pending_sync_sessions';

        try {
            const sessionIds: string[] = JSON.parse(localStorage.getItem(indexKey) || '[]');
            if (sessionIds.length === 0) return { recovered, stillPending };

            const stillPendingSessionIds: string[] = [];

            for (const sessionId of sessionIds) {
                // ── Resolve offline session first ──────────────────────────────────
                let resolvedId = sessionId;
                const offlineMetaRaw = localStorage.getItem(`ginx_offline_session_${sessionId}`);
                if (offlineMetaRaw) {
                    try {
                        const offlineMeta: OfflineSessionMeta = JSON.parse(offlineMetaRaw);
                        const { data: realSession, error } = await this.startSession(
                            offlineMeta.user_id,
                            offlineMeta.gym_id,
                            offlineMeta.is_multiplayer,
                            offlineMeta.multiplayer_mode,
                            offlineMeta.partner_id,
                            offlineMeta.partner_session_id,
                            offlineMeta.started_at,
                        );
                        if (error || !realSession) {
                            stillPendingSessionIds.push(sessionId);
                            continue; // still offline — retry next flush
                        }
                        resolvedId = realSession.id;
                        // Remap pending set payloads to the real session ID
                        const oldSetsKey = `ginx_pending_sets_${sessionId}`;
                        const pendingSets: WorkoutSetData[] = JSON.parse(localStorage.getItem(oldSetsKey) || '[]');
                        localStorage.setItem(
                            `ginx_pending_sets_${resolvedId}`,
                            JSON.stringify(pendingSets.map(p => ({ ...p, session_id: resolvedId })))
                        );
                        localStorage.removeItem(oldSetsKey);
                        localStorage.removeItem(`ginx_offline_session_${sessionId}`);
                        // Remap finish meta too
                        const finishMetaRaw = localStorage.getItem(`ginx_offline_finish_${sessionId}`);
                        if (finishMetaRaw) {
                            localStorage.setItem(`ginx_offline_finish_${resolvedId}`, finishMetaRaw);
                            localStorage.removeItem(`ginx_offline_finish_${sessionId}`);
                        }
                    } catch {
                        stillPendingSessionIds.push(sessionId);
                        continue;
                    }
                }

                // ── Flush sets ─────────────────────────────────────────────────────
                const key = `ginx_pending_sets_${resolvedId}`;
                const queued: WorkoutSetData[] = JSON.parse(localStorage.getItem(key) || '[]');
                const remaining: WorkoutSetData[] = [];

                for (const payload of queued) {
                    try {
                        let finalPayload = payload;

                        // Resolve exercise_id for sets queued offline without network access
                        if (payload.exercise_id?.startsWith('__offline_') && payload._exercise_name) {
                            const { data: existing } = await supabase
                                .from('exercises')
                                .select('id')
                                .ilike('name', payload._exercise_name.trim())
                                .limit(1)
                                .maybeSingle();

                            let realId = existing?.id;

                            if (!realId) {
                                const { data: newEx } = await supabase
                                    .from('exercises')
                                    .insert({ name: payload._exercise_name.trim() })
                                    .select('id')
                                    .single();
                                realId = newEx?.id;
                            }

                            if (!realId) {
                                remaining.push(payload); // still can't resolve, retry later
                                continue;
                            }

                            const { _exercise_name: _, ...rest } = payload;
                            finalPayload = { ...rest, exercise_id: realId };
                        }

                        const res = await this.logSet(finalPayload);
                        if (res.data) {
                            recovered++;
                        } else {
                            remaining.push(payload);
                        }
                    } catch {
                        remaining.push(payload);
                    }
                }

                if (remaining.length > 0) {
                    localStorage.setItem(key, JSON.stringify(remaining));
                    stillPendingSessionIds.push(resolvedId);
                    stillPending += remaining.length;
                } else {
                    localStorage.removeItem(key);
                }

                // ── Finalize if queued ─────────────────────────────────────────────
                const finishKey = `ginx_offline_finish_${resolvedId}`;
                const finishMetaRaw = localStorage.getItem(finishKey);
                if (finishMetaRaw && !stillPendingSessionIds.includes(resolvedId)) {
                    try {
                        const finishMeta: OfflineFinishMeta = JSON.parse(finishMetaRaw);
                        const res = await this.finishSession(
                            resolvedId,
                            finishMeta.notes,
                            finishMeta.routineName,
                            true,
                            finishMeta.geoVerified,
                            true,
                        );
                        if (res.success) {
                            localStorage.removeItem(finishKey);
                        }
                    } catch {
                        // Will retry on next flush
                    }
                }
            }

            localStorage.setItem(indexKey, JSON.stringify(stillPendingSessionIds));
        } catch (e) {
            console.error('Error flushing pending offline sets:', e);
        }

        return { recovered, stillPending };
    }

    /**
     * Full training history for ONE exercise (matched by name across ID systems),
     * grouped by session, newest first. Used by the in-workout "Historial" button
     * so the user can self-compare while training.
     */
    private _exHistoryCacheKey(userId: string, exerciseName: string) {
        return `ginx_exhist_${userId}_${exerciseName.trim().toLowerCase()}`;
    }

    async getExerciseHistory(userId: string, exerciseName: string, equipmentId?: string): Promise<{
        date: string;
        sessionId: string;
        sets: { set_number: number; weight_kg: number; reps: number; time: number; distance: number; rpe: number; is_pr: boolean; unit?: 'kg' | 'lb'; created_at?: string }[];
    }[]> {
        const cacheKey = this._exHistoryCacheKey(userId, exerciseName);

        // Offline: serve the snapshot saved the last time this exercise's
        // history was viewed online.
        if (!navigator.onLine) {
            try {
                const raw = await nativeStore.get(cacheKey);
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
        }

        try {
            // 1. Collect candidate exercise IDs: logs are keyed by `exercises.id`
            // (resolved by name at finalize) but legacy/gym flows may use the
            // gym_equipment UUID directly.
            const candidateIds = new Set<string>();
            if (equipmentId && !equipmentId.startsWith('virtual-') && !equipmentId.startsWith('manifest-')) {
                candidateIds.add(equipmentId);
            }
            const { data: exRows } = await supabase
                .from('exercises')
                .select('id')
                .ilike('name', exerciseName.trim());
            (exRows || []).forEach((r: any) => candidateIds.add(r.id));

            if (candidateIds.size === 0) return [];

            // 2. All of this user's logs for those IDs (metrics_data carries the
            // unit the set was originally typed in: _weight_unit === 'lb')
            const { data: logs, error: logsError } = await supabase
                .from('workout_logs')
                .select('session_id, set_number, weight_kg, reps, time, distance, rpe, is_pr, created_at, metrics_data')
                .in('exercise_id', Array.from(candidateIds))
                .eq('owner_id', userId)
                .order('created_at', { ascending: false })
                .limit(400);

            if (logsError || !logs || logs.length === 0) return [];

            // 3. Resolve session dates in one query
            const sessionIds = Array.from(new Set(logs.map(l => l.session_id)));
            const { data: sessions } = await supabase
                .from('workout_sessions')
                .select('id, started_at')
                .in('id', sessionIds);

            const dateBySession = new Map<string, string>();
            (sessions || []).forEach((s: any) => dateBySession.set(s.id, s.started_at));

            // 4. Group by session, newest session first, sets in order
            const bySession = new Map<string, any[]>();
            logs.forEach(l => {
                if (!bySession.has(l.session_id)) bySession.set(l.session_id, []);
                bySession.get(l.session_id)!.push(l);
            });

            const result = Array.from(bySession.entries())
                .map(([sessionId, sessionLogs]) => ({
                    sessionId,
                    date: dateBySession.get(sessionId) || sessionLogs[0]?.created_at || '',
                    sets: sessionLogs
                        .slice()
                        .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
                        .map(l => ({
                            set_number: l.set_number ?? 0,
                            weight_kg: Number(l.weight_kg) || 0,
                            reps: Number(l.reps) || 0,
                            time: Number(l.time) || 0,
                            distance: Number(l.distance) || 0,
                            rpe: Number(l.rpe) || 0,
                            is_pr: !!l.is_pr,
                            unit: ((l as any).metrics_data?._weight_unit === 'lb' ? 'lb' : 'kg') as 'kg' | 'lb',
                            created_at: l.created_at || '',
                        })),
                }))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Snapshot for offline viewing (best-effort, never blocks)
            nativeStore.set(cacheKey, JSON.stringify(result)).catch(() => {});
            return result;
        } catch (err) {
            console.error('Error fetching exercise history:', err);
            // Weak/failed connection: fall back to the last snapshot
            try {
                const raw = await nativeStore.get(cacheKey);
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
        }
    }

    // Fetch ALL user routines (no gym filter) and save to global cache.
    // Called on login to seed offline cache — ensures gym-specific routines
    // are available offline regardless of GPS / gymId resolution.
    async warmupAllRoutines(userId: string): Promise<void> {
        if (!supabase) return;
        const { data: routinesData, error } = await supabase
            .from('routines')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error || !routinesData || routinesData.length === 0) return;

        const routineIds = routinesData.map(r => r.id);

        const { data: exercisesData } = await supabase
            .from('routine_exercises')
            .select(`id, routine_id, exercise_id, name, order_index,
                     track_weight, track_reps, track_time, track_pr,
                     custom_metric, target_sets, target_reps_text`)
            .in('routine_id', routineIds);

        const allExercises = exercisesData || [];

        const result = routinesData.map(r => {
            const myExercises = allExercises.filter(e => e.routine_id === r.id);
            return {
                ...r,
                equipment_ids: myExercises.map(e => e.exercise_id),
                routine_exercises: myExercises,
            };
        });

        await routineCache.save(userId, null, result);
    }
}

export const workoutService = new WorkoutService();
