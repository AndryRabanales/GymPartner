import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Clock, Dumbbell, MapPin, Calendar, Trash2, Loader2 } from 'lucide-react';
import { workoutService } from '../services/WorkoutService';
import toast from 'react-hot-toast';

interface ExerciseDetail {
    exercise_id: string;
    exercise_name: string;
    muscle_group: string;
    sets: {
        set_number: number;
        weight_kg: number;
        reps: number;
        rpe?: number;
        time?: number;
        distance?: number;
        metrics_data?: Record<string, number>;
        is_pr: boolean;
        completedAt?: number;
        restDuration?: number;
        restStatus?: string;
        weightUnit?: 'kg' | 'lb';
    }[];
    metrics?: {
        hasWeight: boolean;
        hasReps: boolean;
        hasTime: boolean;
        hasDistance: boolean;
        hasRpe: boolean;
        hasCompletedAt: boolean;
        hasRestDuration: boolean;
        customKeys: string[];
    };
}


interface RoomParticipant {
    userId: string;
    name: string;
    avatarUrl?: string;
    exercises: ExerciseDetail[];
    volume: number;
    status: 'finished' | 'in_progress';
    sessionId: string;
}

interface WorkoutDetail {
    id: string;
    user_id: string;
    started_at: string;
    end_time: string;
    gym_name: string;
    gym_id: string;
    duration_minutes: number;
    total_volume: number;
    exercises: ExerciseDetail[];
    is_multiplayer?: boolean;
    multiplayer_mode?: string;
    partner_id?: string;
    partner_session_id?: string;
    partner_name?: string;
    partner_avatar?: string;
    partner_status?: 'in_progress' | 'finished';
    partner_exercises?: ExerciseDetail[];
    partner_volume?: number;
    partner_duration_minutes?: number;
    // All room participants (includes all users, not just direct partner)
    room_participants?: RoomParticipant[];
    // Display name of the viewing user (never "Yo")
    my_name?: string;
}

export default function WorkoutDetailPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
    const [currentUser, setCurrentUser] = useState<any | null>(null);
    // Default to joint view for multiplayer sessions so all participants' data is always visible
    const [viewMode, setViewMode] = useState<'mine' | 'partner' | 'joint'>('mine');
    // Raw coop_summary snapshot — when present, renders the summary-screen style view
    const [coopSummaryRaw, setCoopSummaryRaw] = useState<{ players: any[]; exerciseSets: any[] } | null>(null);
    const [summaryTab, setSummaryTab] = useState<'grupal' | 'individual'>('grupal');
    const [selectedPlayerIdx, setSelectedPlayerIdx] = useState(0);
    // Set joint as default once we know it's multiplayer
    useEffect(() => {
        if (workout?.is_multiplayer && workout?.multiplayer_mode === 'conjunto') {
            setViewMode('joint');
        }
    }, [workout?.is_multiplayer, workout?.multiplayer_mode]);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setCurrentUser(user);
        });
    }, []);

    useEffect(() => {
        if (sessionId) {
            loadWorkoutDetail(sessionId);
        }
    }, [sessionId]);

    const handleDeleteWorkout = async () => {
        if (!workout) return;
        
        const confirmed = window.confirm("¿Estás seguro de que deseas eliminar este entrenamiento? Esta acción no se puede deshacer y borrará permanentemente sus estadísticas del radar.");
        if (!confirmed) return;

        setDeleting(true);
        try {
            const { success, error } = await workoutService.deleteSession(workout.id);
            if (success) {
                toast.success("¡Entrenamiento eliminado correctamente! ⚔️");
                navigate(-1);
            } else {
                alert(`Error al eliminar: ${error?.message || 'Error desconocido'}`);
            }
        } catch (err: any) {
            console.error("Error deleting session:", err);
            alert(`Error al eliminar: ${err.message || 'Error desconocido'}`);
        } finally {
            setDeleting(false);
        }
    };

    const loadWorkoutDetail = async (id: string) => {
        setLoading(true);
        try {
            // Get session data
            const { data: session, error: sessionError } = await supabase
                .from('workout_sessions')
                .select(`
                    id,
                    user_id,
                    started_at,
                    end_time,
                    is_multiplayer,
                    multiplayer_mode,
                    partner_id,
                    partner_session_id,
                    gyms ( name, id )
                `)
                .eq('id', id)
                .single();

            if (sessionError) throw sessionError;

            // Fetch current user's display name (never show "Yo")
            const { data: myProfile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', session.user_id)
                .maybeSingle();
            const myName: string = myProfile?.username || 'Atleta';

            // Auto-heal: resolve the partner session ID for legacy sessions where it
            // wasn't written at session-start. Never write back to DB — the previous
            // approach corrupted the HOST's partner_session_id with a guest's ID,
            // breaking all subsequent N-person history lookups.
            let resolvedPartnerSessionId = session.partner_session_id;
            if (session.is_multiplayer && !resolvedPartnerSessionId && session.partner_id) {
                const { data: foundPartner } = await supabase
                    .from('workout_sessions')
                    .select('id')
                    .eq('user_id', session.partner_id)
                    .eq('is_multiplayer', true)
                    .eq('partner_id', session.user_id)
                    .order('started_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (foundPartner?.id) {
                    resolvedPartnerSessionId = foundPartner.id;
                    // NOTE: intentionally NOT writing back to DB here.
                }
            }

            // Get workout logs with exercise details
            const { data: logs, error: logsError } = await supabase
                .from('workout_logs')
                .select(`
                    exercise_id,
                    set_number,
                    weight_kg,
                    reps,
                    rpe,
                    time,
                    distance,
                    metrics_data,
                    is_pr,
                    category_snapshot,
                    equipment:exercise_id ( name, target_muscle_group )
                `)
                .eq('session_id', id)
                .order('exercise_id')
                .order('set_number');

            if (logsError) throw logsError;

            // Group logs by exercise
            const exerciseMap = new Map<string, ExerciseDetail>();
            let totalVol = 0;

            logs?.forEach((log: any) => {
                const exId = log.exercise_id;
                if (!exerciseMap.has(exId)) {
                    exerciseMap.set(exId, {
                        exercise_id: exId,
                        exercise_name: log.equipment?.name || 'Ejercicio Desconocido',
                        muscle_group: log.category_snapshot || log.equipment?.target_muscle_group || 'General',
                        sets: []
                    });
                }

                const exercise = exerciseMap.get(exId)!;
                exercise.sets.push({
                    set_number: log.set_number,
                    weight_kg: log.weight_kg || 0,
                    reps: log.reps || 0,
                    rpe: log.rpe,
                    time: log.time,
                    distance: log.distance,
                    metrics_data: log.metrics_data || {},
                    is_pr: log.is_pr || false,
                    completedAt: log.metrics_data?._checklist_timestamp,
                    restDuration: log.metrics_data?._rest_duration_ms,
                    restStatus: log.metrics_data?._rest_status,
                    weightUnit: log.metrics_data?._weight_unit || 'kg' // Extract unit
                });

                totalVol += (log.weight_kg || 0) * (log.reps || 0);
            });

            // Calculate metrics flags for each exercise
            exerciseMap.forEach((ex) => {
                const allCustomKeys = new Set<string>();
                const internalKeys = ['_checklist_timestamp', '_rest_duration_ms', '_rest_status'];

                ex.sets.forEach(s => {
                    if (s.metrics_data) {
                        Object.keys(s.metrics_data).forEach(k => {
                            if (!internalKeys.includes(k)) {
                                allCustomKeys.add(k);
                            }
                        });
                    }
                });

                ex.metrics = {
                    hasWeight: ex.sets.some(s => s.weight_kg > 0),
                    hasReps: ex.sets.some(s => s.reps > 0),
                    hasTime: ex.sets.some(s => (s.time || 0) > 0),
                    hasDistance: ex.sets.some(s => (s.distance || 0) > 0),
                    hasRpe: ex.sets.some(s => (s.rpe || 0) > 0),
                    hasCompletedAt: ex.sets.some(s => !!s.completedAt),
                    hasRestDuration: ex.sets.some(s => (s.restDuration || 0) > 0),
                    customKeys: Array.from(allCustomKeys)
                };
            });

            // Fetch partner logs if multiplayer
            let partnerName = 'Compañero';
            let partnerAvatar = undefined;
            let partnerStatus: 'in_progress' | 'finished' = 'in_progress';
            let partnerExercises: ExerciseDetail[] = [];
            let partnerVol = 0;
            let partnerDuration = 0;

            if (session.is_multiplayer && session.partner_id) {
                const { data: pProfile } = await supabase
                    .from('profiles')
                    .select('username, avatar_url')
                    .eq('id', session.partner_id)
                    .maybeSingle();
                
                if (pProfile?.username) partnerName = pProfile.username;
                if (pProfile?.avatar_url) partnerAvatar = pProfile.avatar_url;
            }

            if (resolvedPartnerSessionId) {
                const { data: pSession } = await supabase
                    .from('workout_sessions')
                    .select('started_at, end_time, finished_at')
                    .eq('id', resolvedPartnerSessionId)
                    .maybeSingle();

                if (pSession) {
                    const pFinished = !!pSession.end_time;
                    partnerStatus = pFinished ? 'finished' : 'in_progress';

                    // Fetch partner logs
                    const { data: pLogs } = await supabase
                        .from('workout_logs')
                        .select(`
                            exercise_id,
                            set_number,
                            weight_kg,
                            reps,
                            rpe,
                            time,
                            distance,
                            metrics_data,
                            is_pr,
                            category_snapshot,
                            equipment:exercise_id ( name, target_muscle_group )
                        `)
                        .eq('session_id', resolvedPartnerSessionId)
                        .order('exercise_id')
                        .order('set_number');

                    if (pLogs && pLogs.length > 0) {
                        const pExerciseMap = new Map<string, ExerciseDetail>();
                        pLogs.forEach((log: any) => {
                            const exId = log.exercise_id;
                            if (!pExerciseMap.has(exId)) {
                                pExerciseMap.set(exId, {
                                    exercise_id: exId,
                                    exercise_name: log.equipment?.name || 'Ejercicio Desconocido',
                                    muscle_group: log.category_snapshot || log.equipment?.target_muscle_group || 'General',
                                    sets: []
                                });
                            }

                            const exercise = pExerciseMap.get(exId)!;
                            exercise.sets.push({
                                set_number: log.set_number,
                                weight_kg: log.weight_kg || 0,
                                reps: log.reps || 0,
                                rpe: log.rpe,
                                time: log.time,
                                distance: log.distance,
                                metrics_data: log.metrics_data || {},
                                is_pr: log.is_pr || false,
                                completedAt: log.metrics_data?._checklist_timestamp,
                                restDuration: log.metrics_data?._rest_duration_ms,
                                restStatus: log.metrics_data?._rest_status,
                                weightUnit: log.metrics_data?._weight_unit || 'kg'
                            });

                            partnerVol += (log.weight_kg || 0) * (log.reps || 0);
                        });

                        pExerciseMap.forEach((ex) => {
                            const allCustomKeys = new Set<string>();
                            const internalKeys = ['_checklist_timestamp', '_rest_duration_ms', '_rest_status'];

                            ex.sets.forEach(s => {
                                if (s.metrics_data) {
                                    Object.keys(s.metrics_data).forEach(k => {
                                        if (!internalKeys.includes(k)) {
                                            allCustomKeys.add(k);
                                        }
                                    });
                                }
                            });

                            ex.metrics = {
                                hasWeight: ex.sets.some(s => s.weight_kg > 0),
                                hasReps: ex.sets.some(s => s.reps > 0),
                                hasTime: ex.sets.some(s => (s.time || 0) > 0),
                                hasDistance: ex.sets.some(s => (s.distance || 0) > 0),
                                hasRpe: ex.sets.some(s => (s.rpe || 0) > 0),
                                hasCompletedAt: ex.sets.some(s => !!s.completedAt),
                                hasRestDuration: ex.sets.some(s => (s.restDuration || 0) > 0),
                                customKeys: Array.from(allCustomKeys)
                            };
                        });

                        partnerExercises = Array.from(pExerciseMap.values());
                    }

                    if (pSession.started_at && (pSession.end_time || pSession.finished_at)) {
                        const pStart = new Date(pSession.started_at).getTime();
                        const pEnd = new Date(pSession.end_time || pSession.finished_at).getTime();
                        partnerDuration = Math.round((pEnd - pStart) / (1000 * 60));
                    }
                }
            }

            const start = new Date(session.started_at).getTime();
            const end = new Date(session.end_time).getTime();
            const duration = Math.round((end - start) / (1000 * 60));

            // Fix gym access (handle array or object)
            const gymData = Array.isArray(session.gyms) ? session.gyms[0] : session.gyms;

            // ── Fetch ALL room participants for group history ────────────────
            // The direct partner data (above) is kept for backward compat.
            // room_participants includes everyone in the room for the joint view.
            let roomParticipants: RoomParticipant[] = [];

            if (session.is_multiplayer && session.multiplayer_mode === 'conjunto') {
                try {
                // Determine the room anchor (HOST's session ID) robustly.
                //
                // HOST (clean):      partner_session_id = null → roomId = session.id ✓
                // GUEST:             partner_session_id = host_id, host has no
                //                    partner_session_id → roomId = host_id ✓
                // HOST (corrupted):  auto-heal previously wrote guest1_id here.
                //                    guest1 has partner_session_id = host_id (non-null)
                //                    → the "partner" is NOT the host → roomId = session.id ✓
                let roomId = session.id;
                const candidatePartnerId = session.partner_session_id || resolvedPartnerSessionId;
                if (candidatePartnerId) {
                    try {
                        const { data: partnerMeta } = await supabase
                            .from('workout_sessions')
                            .select('id, partner_session_id')
                            .eq('id', candidatePartnerId)
                            .maybeSingle();

                        if (partnerMeta) {
                            // Only keep session.id as anchor when the candidate points
                            // BACK to us (true circular/mutual reference = we are the host).
                            // In all other cases trust the pointer chain, even if the candidate
                            // also has a non-null partner_session_id (e.g. historical corruption
                            // where a later guest pointed to an earlier guest instead of the host).
                            const candidatePointsBackToUs =
                                partnerMeta.partner_session_id === session.id;
                            if (!candidatePointsBackToUs) {
                                roomId = candidatePartnerId;
                            }
                        }
                    } catch { /* fallback to session.id */ }
                }

                // ── Fast path: read pre-built coop_summary from the host session ──────
                // Saved by WorkoutSession.tsx when the last participant finalizes.
                // RLS allows all room members to read the host (anchor) session row.
                const { data: hostWithSummary } = await supabase
                    .from('workout_sessions')
                    .select('coop_summary')
                    .eq('id', roomId)
                    .maybeSingle();

                const coopSummary: any = (hostWithSummary as any)?.coop_summary ?? null;

                // New format: { players, exerciseSets }
                // Old format (array) is ignored — sessions will fall through to fallback
                if (coopSummary && coopSummary.players && coopSummary.exerciseSets) {
                    setCoopSummaryRaw(coopSummary);
                }

                // Legacy array format — still used for roomParticipants fallback build
                const coopSummaryArr: any[] | null = Array.isArray(coopSummary) ? coopSummary : null;

                if (coopSummaryArr && coopSummaryArr.length > 0) {
                    // Map snapshot → RoomParticipant[], excluding the current viewer
                    // (their own data is already rendered from the main session query).
                    roomParticipants = coopSummaryArr
                        .filter((p: any) => p.userId !== session.user_id)
                        .map((p: any) => {
                            const exArr: ExerciseDetail[] = (p.exercises || []).map((ex: any) => ({
                                exercise_id: ex.exercise_id,
                                exercise_name: ex.exercise_name || 'Ejercicio',
                                muscle_group: ex.muscle_group || 'General',
                                sets: (ex.sets || []).map((s: any) => ({
                                    set_number: s.set_number,
                                    weight_kg: s.weight_kg || 0,
                                    reps: s.reps || 0,
                                    rpe: s.rpe,
                                    time: s.time,
                                    distance: s.distance,
                                    metrics_data: s.metrics_data,
                                    is_pr: s.is_pr || false,
                                    weightUnit: s.weightUnit || s.metrics_data?._weight_unit || 'kg'
                                })),
                                metrics: {
                                    hasWeight: (ex.sets || []).some((s: any) => (s.weight_kg || 0) > 0),
                                    hasReps: (ex.sets || []).some((s: any) => (s.reps || 0) > 0),
                                    hasTime: (ex.sets || []).some((s: any) => (s.time || 0) > 0),
                                    hasDistance: (ex.sets || []).some((s: any) => (s.distance || 0) > 0),
                                    hasRpe: (ex.sets || []).some((s: any) => (s.rpe || 0) > 0),
                                    hasCompletedAt: false,
                                    hasRestDuration: false,
                                    customKeys: []
                                }
                            }));

                            return {
                                userId: p.userId,
                                name: p.username || 'Participante',
                                avatarUrl: p.avatarUrl,
                                exercises: exArr,
                                volume: p.volume || 0,
                                status: (p.status || 'finished') as 'finished' | 'in_progress' | 'cancelled',
                                sessionId: p.sessionId
                            } satisfies RoomParticipant;
                        });
                    console.log('✅ [History] coop_summary cargado:', roomParticipants.length, 'otros participantes');
                } else {
                // ── Fallback: reconstruct from raw session + logs (legacy / no summary) ──
                const [{ data: guestSessions, error: gErr }, { data: hostRow, error: hErr }] = await Promise.all([
                    supabase
                        .from('workout_sessions')
                        .select('id, user_id, started_at, end_time, finished_at')
                        .eq('partner_session_id', roomId)
                        .not('user_id', 'eq', session.user_id),
                    supabase
                        .from('workout_sessions')
                        .select('id, user_id, started_at, end_time, finished_at')
                        .eq('id', roomId)
                        .neq('user_id', session.user_id)
                        .maybeSingle()
                ]);
                if (gErr) console.warn('⚠️ Could not fetch guest sessions (RLS):', gErr.message);
                if (hErr) console.warn('⚠️ Could not fetch host session (RLS):', hErr.message);

                const otherSessions = [
                    ...(guestSessions || []),
                    ...(hostRow ? [hostRow] : [])
                ].filter((s, idx, arr) => arr.findIndex(x => x.id === s.id) === idx); // dedup

                await Promise.all(otherSessions.map(async (ps) => {
                    const [{ data: prof }, { data: pLogs, error: pLogsErr }] = await Promise.all([
                        supabase.from('profiles').select('username, avatar_url').eq('id', ps.user_id).maybeSingle(),
                        supabase
                            .from('workout_logs')
                            .select(`
                                exercise_id, set_number, weight_kg, reps, rpe, time, distance,
                                metrics_data, is_pr, category_snapshot,
                                equipment:exercise_id ( name, target_muscle_group )
                            `)
                            .eq('session_id', ps.id)
                            .order('exercise_id')
                            .order('set_number')
                    ]);
                    if (pLogsErr) console.warn(`⚠️ Could not fetch logs for participant ${ps.user_id} (RLS?):`, pLogsErr.message);

                    const pExMap = new Map<string, ExerciseDetail>();
                    let pVol = 0;
                    (pLogs || []).forEach((log: any) => {
                        const exId = log.exercise_id;
                        if (!pExMap.has(exId)) {
                            pExMap.set(exId, {
                                exercise_id: exId,
                                exercise_name: log.equipment?.name || 'Ejercicio',
                                muscle_group: log.category_snapshot || log.equipment?.target_muscle_group || 'General',
                                sets: []
                            });
                        }
                        pExMap.get(exId)!.sets.push({
                            set_number: log.set_number,
                            weight_kg: log.weight_kg || 0,
                            reps: log.reps || 0,
                            rpe: log.rpe,
                            time: log.time,
                            distance: log.distance,
                            metrics_data: log.metrics_data,
                            is_pr: log.is_pr || false,
                            weightUnit: log.metrics_data?._weight_unit || 'kg'
                        });
                        pVol += (log.weight_kg || 0) * (log.reps || 0);
                    });

                    const pExArr = Array.from(pExMap.values());
                    pExArr.forEach(ex => {
                        ex.metrics = {
                            hasWeight: ex.sets.some(s => s.weight_kg > 0),
                            hasReps: ex.sets.some(s => s.reps > 0),
                            hasTime: ex.sets.some(s => (s.time || 0) > 0),
                            hasDistance: ex.sets.some(s => (s.distance || 0) > 0),
                            hasRpe: ex.sets.some(s => (s.rpe || 0) > 0),
                            hasCompletedAt: false,
                            hasRestDuration: false,
                            customKeys: []
                        };
                    });

                    roomParticipants.push({
                        userId: ps.user_id,
                        name: prof?.username || 'Participante',
                        avatarUrl: prof?.avatar_url,
                        exercises: pExArr,
                        volume: Math.round(pVol),
                        status: !!ps.end_time ? 'finished' : 'in_progress',
                        sessionId: ps.id
                    });
                }));
                } // end fallback
                } catch (roomFetchErr) {
                    console.warn('⚠️ Room participant fetch failed (RLS or network):', roomFetchErr);
                    // Gracefully continue — show own session without partner columns
                }
            }

            setWorkout({
                id: session.id,
                user_id: session.user_id,
                started_at: session.started_at,
                end_time: session.end_time,
                gym_name: gymData?.name || 'Gimnasio Desconocido',
                gym_id: gymData?.id,
                duration_minutes: duration,
                total_volume: totalVol,
                exercises: Array.from(exerciseMap.values()),
                is_multiplayer: session.is_multiplayer,
                multiplayer_mode: session.multiplayer_mode,
                partner_id: session.partner_id,
                partner_session_id: resolvedPartnerSessionId,
                partner_name: partnerName,
                partner_avatar: partnerAvatar,
                partner_status: partnerStatus,
                partner_exercises: partnerExercises,
                partner_volume: partnerVol,
                partner_duration_minutes: partnerDuration,
                room_participants: roomParticipants.length > 0 ? roomParticipants : undefined,
                my_name: myName
            });

            setLoading(false);
        } catch (error) {
            console.error('Error loading workout detail:', error);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-gym-primary text-xl font-bold animate-pulse">
                    Cargando detalles...
                </div>
            </div>
        );
    }

    if (!workout) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <p className="text-neutral-400 mb-4">Entrenamiento no encontrado</p>
                    <button
                        onClick={() => navigate('/history')}
                        className="text-gym-primary hover:underline"
                    >
                        Volver al Historial
                    </button>
                </div>
            </div>
        );
    }

    // ── Co-op Summary History View ───────────────────────────────────────────
    // Exact replica of WorkoutSession's summary screen, reading from coop_summary JSONB.
    if (workout.is_multiplayer && workout.multiplayer_mode === 'conjunto' && coopSummaryRaw) {
        const { players: allPlayers, exerciseSets } = coopSummaryRaw;
        const isGroupMode = allPlayers.length > 1;

        const columnCount = (summaryTab === 'grupal' && isGroupMode) ? allPlayers.length : 1;
        let gridWidthClass = 'w-[60%] max-w-md';
        let headerTextSize = 'text-[9px]';
        let colHeaderTextSize = 'text-[8px]';
        let rowTextSize = 'text-[8px]';
        let wTextSize = 'text-[9.5px]';
        let wUnitSize = 'text-[5.5px]';
        let detailTextSize = 'text-[8.5px]';
        if (columnCount === 2) {
            gridWidthClass = 'w-[65%] max-w-md'; headerTextSize = 'text-[8.5px]'; colHeaderTextSize = 'text-[7.5px]';
            rowTextSize = 'text-[7.5px]'; wTextSize = 'text-[9px]'; wUnitSize = 'text-[5px]'; detailTextSize = 'text-[8px]';
        } else if (columnCount === 3) {
            gridWidthClass = 'w-[65%] max-w-md'; headerTextSize = 'text-[9.5px]'; colHeaderTextSize = 'text-[8px]';
            rowTextSize = 'text-[8px]'; wTextSize = 'text-[9.5px]'; wUnitSize = 'text-[5.5px]'; detailTextSize = 'text-[8.5px]';
        } else if (columnCount === 4) {
            gridWidthClass = 'w-[75%] max-w-lg'; headerTextSize = 'text-[9px]'; colHeaderTextSize = 'text-[7.5px]';
            rowTextSize = 'text-[7.5px]'; wTextSize = 'text-[9px]'; wUnitSize = 'text-[5px]'; detailTextSize = 'text-[7.5px]';
        } else if (columnCount > 4) {
            gridWidthClass = 'w-[90%] max-w-4xl'; headerTextSize = 'text-[8.5px]'; colHeaderTextSize = 'text-[7px]';
            rowTextSize = 'text-[7px]'; wTextSize = 'text-[8.5px]'; wUnitSize = 'text-[4.5px]'; detailTextSize = 'text-[7px]';
        }

        const cardStyle = 'bg-[#141310] rounded-md overflow-hidden border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]';
        const cardSpacing = 'gap-1';
        const headerPadding = 'px-1.5 py-0.5';
        const colHeaderPadding = 'px-1.5 py-px';
        const rowPadding = 'px-1.5 py-[1px]';

        // For INDIVIDUAL tab: exercises of the selected player, built from exerciseSets
        const selectedPlayer = allPlayers[selectedPlayerIdx] || allPlayers[0];
        const indivExs = exerciseSets
            .map((ex: any) => {
                const mySets = (ex.sets || []).filter((s: any) => {
                    const d = s.playerData?.[selectedPlayer?.id];
                    return d && (d.weight > 0 || d.reps > 0 || d.time > 0 || d.distance > 0);
                });
                return mySets.length ? { ...ex, filteredSets: mySets } : null;
            })
            .filter(Boolean);

        return (
            <div className="fixed inset-0 z-[180] flex flex-col summary-animated-bg overflow-hidden">
                <style dangerouslySetInnerHTML={{__html: `
                    .summary-animated-bg {
                        background: linear-gradient(-45deg, #000000, #4d4002, #000000, #7a6603, #000000);
                        background-size: 400% 400%;
                        animation: premiumGradient 9s ease infinite;
                    }
                    @keyframes premiumGradient {
                        0% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                    }
                `}} />

                {/* STICKY HEADER */}
                <div className="flex-shrink-0 bg-black/40 border-b border-black pt-1.5 px-2 pb-1.5 relative">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1 text-yellow-500/60 text-[9px] font-black uppercase tracking-widest mb-1 active:opacity-60"
                    >
                        ‹ Volver
                    </button>
                    <div className="text-center flex flex-col items-center mb-1">
                        <h1 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-yellow-400 drop-shadow-[0_1.5px_0_#000] border-y border-yellow-400/20 px-3 py-0 select-none animate-pulse"
                            style={{ fontFamily: "'Impact', 'Arial Black', sans-serif" }}>
                            ¡RESULTADOS!
                        </h1>
                        <p className="text-[7.5px] font-black tracking-[0.2em] text-yellow-500/50 uppercase mt-0">
                            STUDIO GYNX ENTERTAINMENT INC.
                        </p>
                        <p className="text-[8px] text-neutral-500 capitalize mt-0.5">
                            {new Date(workout.started_at).toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · {workout.gym_name}
                        </p>
                    </div>

                    <div className="flex gap-1.5 w-[90%] max-w-sm mx-auto">
                        {isGroupMode && (
                            <button
                                onClick={() => setSummaryTab('grupal')}
                                className={`flex-1 py-1 px-2 rounded-md text-[9.5px] font-black uppercase tracking-wider border-2 transition-all transform hover:scale-[1.03] active:scale-95 duration-100 ${
                                    summaryTab === 'grupal'
                                        ? 'bg-yellow-400 border-black text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                        : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                                }`}
                            >GRUPAL</button>
                        )}
                        <button
                            onClick={() => setSummaryTab('individual')}
                            className={`flex-1 py-1 px-2 rounded-md text-[9.5px] font-black uppercase tracking-wider border-2 transition-all transform hover:scale-[1.03] active:scale-95 duration-100 ${
                                summaryTab === 'individual' || !isGroupMode
                                    ? 'bg-yellow-400 border-black text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                            }`}
                        >INDIVIDUAL</button>
                    </div>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div className={`flex-1 overflow-y-auto px-1 pt-2 pb-20 mx-auto flex flex-col justify-start ${gridWidthClass}`}>

                    {/* ── GRUPAL TAB ── */}
                    {summaryTab === 'grupal' && isGroupMode && (
                        <div className={`flex flex-col ${cardSpacing}`}>
                            {exerciseSets.map((ex: any, exIdx: number) => {
                                const hasAnyData = (ex.sets || []).some((s: any) =>
                                    allPlayers.some((p: any) => {
                                        const d = s.playerData?.[p.id];
                                        return d && (d.weight > 0 || d.reps > 0 || d.time > 0 || d.distance > 0);
                                    })
                                );
                                if (!hasAnyData) return null;
                                return (
                                    <div key={ex.exerciseId} className={`${cardStyle} transform hover:-translate-y-0.5 transition-transform duration-200`}>
                                        <div className={`${headerPadding} bg-gradient-to-r from-yellow-500/15 via-yellow-500/5 to-transparent border-b border-black flex justify-between items-center`}>
                                            <span className={`${headerTextSize} font-black uppercase tracking-widest text-yellow-400 italic`}>★ {ex.exerciseName}</span>
                                            <span className="text-[7px] font-black text-yellow-500/40 uppercase">EX-{exIdx + 1}</span>
                                        </div>
                                        <div className={`grid ${colHeaderPadding} bg-black/50 border-b border-black ${colHeaderTextSize} font-bold text-neutral-400 uppercase tracking-wider`}
                                            style={{ gridTemplateColumns: `32px repeat(${allPlayers.length}, 1fr)` }}>
                                            <div className="text-yellow-500/80 font-black">SET</div>
                                            {allPlayers.map((p: any) => {
                                                const nm = (p.username || 'U').split(' ')[0].substring(0, 7);
                                                const isMe = p.id === workout.user_id;
                                                return (
                                                    <div key={p.id} className={`text-center font-black truncate ${colHeaderTextSize} ${isMe ? 'text-yellow-400 italic underline decoration-yellow-400/40' : 'text-neutral-300'}`}>
                                                        {nm}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {(ex.sets || []).map((s: any) => {
                                            const hasAny = allPlayers.some((p: any) => {
                                                const d = s.playerData?.[p.id];
                                                return d && (d.weight > 0 || d.reps > 0 || d.time > 0 || d.distance > 0);
                                            });
                                            if (!hasAny) return null;
                                            return (
                                                <div key={s.setNumber} className={`grid ${rowPadding} border-b border-black/20 last:border-0 items-center bg-black/10 hover:bg-black/20 transition-colors`}
                                                    style={{ gridTemplateColumns: `32px repeat(${allPlayers.length}, 1fr)` }}>
                                                    <div className={`${rowTextSize} text-yellow-500/40 font-black italic`}>#{s.setNumber}</div>
                                                    {allPlayers.map((p: any) => {
                                                        const d = s.playerData?.[p.id];
                                                        const w = d?.weight || 0; const r = d?.reps || 0;
                                                        const t = d?.time || 0; const dist = d?.distance || 0;
                                                        const unit = d?.weightUnit || 'kg';
                                                        const hasVal = w > 0 || r > 0 || t > 0 || dist > 0;
                                                        const isMe = p.id === workout.user_id;
                                                        return (
                                                            <div key={p.id} className="flex flex-col items-center justify-center py-0.5">
                                                                {hasVal ? (
                                                                    <div className="flex flex-col items-center">
                                                                        {w > 0 && <span className={`${wTextSize} font-black leading-none tracking-tight ${isMe ? 'text-yellow-400' : 'text-white'}`}>{w}<span className={`${wUnitSize} font-bold text-neutral-400 ml-0.5`}>{unit}</span></span>}
                                                                        {r > 0 && <span className={`${detailTextSize} text-neutral-400 leading-none font-bold mt-0.5`}>{r}r</span>}
                                                                        {t > 0 && <span className={`${detailTextSize} text-neutral-400 leading-none font-bold mt-0.5`}>{t}s</span>}
                                                                        {dist > 0 && <span className={`${detailTextSize} text-neutral-400 leading-none font-bold mt-0.5`}>{dist}m</span>}
                                                                    </div>
                                                                ) : (
                                                                    <span className={`${rowTextSize} text-neutral-700 font-bold`}>—</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                            {exerciseSets.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-16 text-neutral-600">
                                    <p className={`${rowTextSize} font-black uppercase tracking-widest`}>No se registraron ejercicios</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── INDIVIDUAL TAB ── */}
                    {(summaryTab === 'individual' || !isGroupMode) && (
                        <div className={`flex flex-col ${cardSpacing}`}>
                            {/* Player selector tabs */}
                            {isGroupMode && (
                                <div className="flex gap-1 mb-1.5 overflow-x-auto pb-1">
                                    {allPlayers.map((p: any, idx: number) => (
                                        <button
                                            key={p.id}
                                            onClick={() => setSelectedPlayerIdx(idx)}
                                            className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border-2 transition-all active:scale-95 ${
                                                selectedPlayerIdx === idx
                                                    ? 'bg-yellow-400 border-black text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                                            }`}
                                        >
                                            {(p.username || 'U').substring(0, 10)}{p.id === workout.user_id ? ' ★' : ''}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {indivExs.map((ex: any, exIdx: number) => {
                                const hasTD = ex.filteredSets.some((s: any) => {
                                    const d = s.playerData?.[selectedPlayer?.id];
                                    return d && (d.time > 0 || d.distance > 0);
                                });
                                return (
                                    <div key={ex.exerciseId} className={`${cardStyle} transform hover:-translate-y-0.5 transition-transform duration-200`}>
                                        <div className={`${headerPadding} bg-gradient-to-r from-yellow-500/15 via-yellow-500/5 to-transparent border-b border-black flex justify-between items-center`}>
                                            <span className={`${headerTextSize} font-black uppercase tracking-widest text-yellow-400 italic`}>★ {ex.exerciseName}</span>
                                            <span className="text-[7px] font-black text-yellow-500/40 uppercase">EX-{exIdx + 1}</span>
                                        </div>
                                        <div className={`grid ${hasTD ? 'grid-cols-4' : 'grid-cols-3'} ${colHeaderPadding} bg-black/50 border-b border-black text-[8px] font-bold text-neutral-400 uppercase tracking-wider`}>
                                            <div className="text-yellow-500/80 font-black leading-none">SET</div>
                                            <div className="text-center font-black leading-none">PESO</div>
                                            <div className="text-center font-black leading-none">REPS</div>
                                            {hasTD && <div className="text-center font-black leading-none">TIEMPO/DIST</div>}
                                        </div>
                                        {ex.filteredSets.map((s: any) => {
                                            const d = s.playerData?.[selectedPlayer?.id] || {};
                                            const w = d.weight || 0; const r = d.reps || 0;
                                            const t = d.time || 0; const dist = d.distance || 0;
                                            const unit = d.weightUnit || 'kg';
                                            return (
                                                <div key={s.setNumber} className={`grid ${hasTD ? 'grid-cols-4' : 'grid-cols-3'} ${rowPadding} border-b border-black/20 last:border-0 items-center bg-black/10 hover:bg-black/20 transition-colors`}>
                                                    <div className={`${rowTextSize} text-yellow-500/40 font-black italic leading-none`}>#{s.setNumber}</div>
                                                    <div className="text-center leading-none">
                                                        {w > 0
                                                            ? <span className={`${wTextSize} font-black text-yellow-400 leading-none`}>{w}<span className={`${wUnitSize} font-bold text-neutral-400 ml-0.5`}>{unit}</span></span>
                                                            : <span className={`text-neutral-700 ${rowTextSize} font-bold leading-none`}>—</span>}
                                                    </div>
                                                    <div className="text-center leading-none">
                                                        {r > 0
                                                            ? <span className={`${wTextSize} font-black text-white leading-none`}>{r}</span>
                                                            : <span className={`text-neutral-700 ${rowTextSize} font-bold leading-none`}>—</span>}
                                                    </div>
                                                    {hasTD && (
                                                        <div className="text-center leading-none">
                                                            {t > 0 ? <span className={`${detailTextSize} font-bold text-neutral-300 leading-none`}>{t}s</span>
                                                                : dist > 0 ? <span className={`${detailTextSize} font-bold text-neutral-300 leading-none`}>{dist}m</span>
                                                                : <span className={`text-neutral-700 ${rowTextSize} font-bold leading-none`}>—</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                            {indivExs.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-16 text-neutral-600">
                                    <p className={`${rowTextSize} font-black uppercase tracking-widest`}>No se registraron ejercicios</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* FOOTER — same as summary screen */}
                <div className="flex-shrink-0 py-2 px-4 bg-gradient-to-t from-[#0c0b09] via-[#0c0b09]/95 to-transparent border-t border-black/25">
                    <div className="w-full max-w-md mx-auto px-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-full bg-[#f43f5e] hover:bg-[#e11d48] border-2 border-black text-white font-black uppercase py-2.5 rounded-xl text-[11px] tracking-widest shadow-[0_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] active:translate-y-[3px] active:shadow-none transition-all duration-150"
                        >
                            ¡VOLVER AL HISTORIAL!
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const date = new Date(workout.started_at);
    const dateStr = date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="min-h-screen bg-black text-white pb-24">
            {/* Header */}
            <div className="bg-gradient-to-b from-neutral-900 to-black border-b border-neutral-800 p-6">
                <div className="flex justify-between items-start gap-4">
                    <div>
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 text-gym-primary mb-4 hover:underline"
                        >
                            <ChevronLeft size={20} />
                            Volver
                        </button>

                        <h1 className="text-2xl md:text-3xl font-black uppercase italic mb-2">
                            Detalles de Sesión
                        </h1>
                    </div>

                </div>

                <div className="flex flex-col gap-1 mb-4 text-neutral-400">
                    <div className="flex items-center gap-2 text-sm">
                        <Calendar size={16} />
                        <span className="capitalize">{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-500 ml-6">
                        {new Date(workout.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span>-</span>
                        {workout.end_time ? new Date(workout.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '???'}
                    </div>
                </div>

                <div className="flex items-center gap-2 text-white mb-2">
                    <MapPin size={18} className="text-gym-primary" />
                    <Link
                        to={workout.gym_id ? `/territory/${workout.gym_id}` : '#'}
                        className="font-bold hover:text-gym-primary transition-colors"
                    >
                        {workout.gym_name}
                    </Link>
                </div>

                {/* Stats */}
                <div className="flex gap-6 mt-4">
                    <div className="flex items-center gap-2">
                        <Clock size={18} className="text-blue-500" />
                        <span className="font-bold">{workout.duration_minutes} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Dumbbell size={18} className="text-gym-primary" />
                        <span className="font-bold">
                            {workout.total_volume >= 1000
                                ? `${(workout.total_volume / 1000).toFixed(1)}k`
                                : workout.total_volume
                            } kg
                        </span>
                    </div>
                </div>

                {/* Multiplayer Co-op Header Banner */}
                {workout.is_multiplayer && (
                    <div className="mt-6 p-4 rounded-3xl bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-transparent border border-yellow-500/20">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-black text-gym-primary uppercase tracking-widest flex items-center gap-1.5">
                                ⚔️ ENTRENAMIENTO COOPERATIVO
                            </span>
                            {workout.partner_status === 'in_progress' ? (
                                <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                                    ⚡ {workout.partner_name?.substring(0, 10)} entrenando...
                                </span>
                            ) : (
                                <span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-2.5 py-0.5 rounded-full font-bold">
                                    🤝 Completado
                                </span>
                            )}
                        </div>

                        {/* Stats Comparison Summary — scales to N participants */}
                        {workout.room_participants && workout.room_participants.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mt-2">
                                <div className="bg-neutral-950 p-3 rounded-2xl border border-neutral-800 flex-1 min-w-[100px]">
                                    <div className="text-[10px] text-gym-primary font-bold uppercase truncate">{workout.my_name?.substring(0, 10) || 'Yo'}</div>
                                    <div className="text-lg font-black text-white font-mono">{workout.total_volume} kg</div>
                                    <div className="text-[10px] text-neutral-500">{workout.duration_minutes} min</div>
                                </div>
                                {workout.room_participants.map((p, idx) => {
                                    const colors = ['text-blue-400', 'text-purple-400', 'text-green-400', 'text-orange-400', 'text-pink-400', 'text-cyan-400', 'text-rose-400'];
                                    return (
                                        <div key={p.userId} className="bg-neutral-950 p-3 rounded-2xl border border-neutral-800 flex-1 min-w-[100px]">
                                            <div className={`text-[10px] font-bold uppercase truncate ${colors[idx % colors.length]}`}>{p.name.substring(0, 10)}</div>
                                            {p.status === 'in_progress' ? (
                                                <div className="text-xs font-bold text-amber-500 italic mt-1 animate-pulse">Entrenando...</div>
                                            ) : (
                                                <>
                                                    <div className="text-lg font-black text-white font-mono">{p.volume} kg</div>
                                                    <div className="text-[10px] text-neutral-500">finalizado</div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                                <div className="bg-neutral-950 p-3 rounded-2xl border border-neutral-800">
                                    <div className="text-[10px] text-neutral-400 font-bold uppercase">Mi Volumen</div>
                                    <div className="text-lg font-black text-white font-mono">{workout.total_volume} kg</div>
                                    <div className="text-[10px] text-neutral-500">{workout.duration_minutes} min</div>
                                </div>
                                <div className="bg-neutral-950 p-3 rounded-2xl border border-neutral-800">
                                    <div className="text-[10px] text-neutral-400 font-bold uppercase">{workout.partner_name?.substring(0, 10)}</div>
                                    {workout.partner_status === 'in_progress' ? (
                                        <div className="text-xs font-bold text-amber-500 italic mt-1 animate-pulse">
                                            Aún entrenando...
                                        </div>
                                    ) : (
                                        <>
                                            <div className="text-lg font-black text-white font-mono">{workout.partner_volume || 0} kg</div>
                                            <div className="text-[10px] text-neutral-500">{workout.partner_duration_minutes || 0} min</div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* View Mode Tabs Selector */}
                        <div className="flex gap-2 mt-4 bg-neutral-950 p-1 rounded-2xl border border-neutral-800">
                            <button
                                onClick={() => setViewMode('mine')}
                                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${viewMode === 'mine' ? 'bg-gym-primary text-black' : 'text-neutral-400 hover:text-white'}`}
                            >
                                Mis Datos
                            </button>
                            <button
                                onClick={() => setViewMode('partner')}
                                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${viewMode === 'partner' ? 'bg-gym-primary text-black' : 'text-neutral-400 hover:text-white'}`}
                            >
                                {workout.partner_name?.substring(0, 10)}
                            </button>
                            <button
                                onClick={() => {
                                    // Allow joint view when all participants have finished OR when room_participants has data
                                    const hasRoomData = workout.room_participants && workout.room_participants.length > 0;
                                    const allDone = hasRoomData
                                        ? workout.room_participants!.every(p => p.status === 'finished')
                                        : workout.partner_status !== 'in_progress';
                                    if (!allDone && !hasRoomData) {
                                        toast.error('Espera a que todos finalicen.');
                                    } else {
                                        setViewMode('joint');
                                    }
                                }}
                                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${viewMode === 'joint' ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg font-black' : 'text-neutral-400 hover:text-white'}`}
                            >
                                Historial Conjunto 🤝
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Exercise List */}
            <div className="max-w-4xl mx-auto p-4 space-y-6">
                {viewMode === 'mine' && (
                    workout.exercises.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-neutral-500 space-y-4">
                            <Dumbbell size={48} className="opacity-20" />
                            <p className="text-sm uppercase tracking-widest font-bold">No se registraron ejercicios</p>
                        </div>
                    ) : (
                        workout.exercises.map((exercise) => (
                            <ExerciseCard key={exercise.exercise_id} exercise={exercise} isMine={true} workoutStartedAt={workout.started_at} />
                        ))
                    )
                )}

                {viewMode === 'partner' && (
                    !workout.partner_exercises || workout.partner_exercises.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-3xl space-y-4">
                            <Dumbbell size={48} className="opacity-20 text-blue-500" />
                            <p className="text-sm uppercase tracking-widest font-bold text-neutral-400">
                                {workout.partner_name} no ha registrado ejercicios aún
                            </p>
                        </div>
                    ) : (
                        workout.partner_exercises.map((exercise) => (
                            <ExerciseCard key={exercise.exercise_id} exercise={exercise} isMine={false} workoutStartedAt={workout.started_at} partnerName={workout.partner_name} />
                        ))
                    )
                )}

                {viewMode === 'joint' && (
                    (() => {
                        // Use room_participants (all users) if available, else fall back to direct partner
                        const allOtherParticipants = workout.room_participants && workout.room_participants.length > 0
                            ? workout.room_participants
                            : (workout.partner_exercises && workout.partner_exercises.length > 0
                                ? [{ userId: workout.partner_id || '', name: workout.partner_name || 'Compañero', exercises: workout.partner_exercises || [], volume: workout.partner_volume || 0, status: workout.partner_status || 'finished', sessionId: workout.partner_session_id || '' } as RoomParticipant]
                                : []);

                        const allExerciseIds = Array.from(new Set([
                            ...workout.exercises.map(e => e.exercise_id),
                            ...allOtherParticipants.flatMap(p => p.exercises.map(e => e.exercise_id))
                        ]));

                        if (allExerciseIds.length === 0) {
                            return (
                                <div className="flex flex-col items-center justify-center py-20 text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-3xl space-y-4">
                                    <Dumbbell size={48} className="opacity-20" />
                                    <p className="text-sm uppercase tracking-widest font-bold">No hay ejercicios para comparar</p>
                                </div>
                            );
                        }

                        const playerColors = ['text-gym-primary', 'text-blue-400', 'text-purple-400', 'text-green-400', 'text-orange-400'];

                        // Detect partners who haven't finalized yet — their logs are empty until they finish
                        const hasInProgress = allOtherParticipants.some(p => p.status === 'in_progress');
                        const inProgressNames = allOtherParticipants
                            .filter(p => p.status === 'in_progress')
                            .map(p => p.name)
                            .join(', ');

                        const cards = allExerciseIds.map((exId) => {
                            const myEx = workout.exercises.find(e => e.exercise_id === exId);
                            const name = myEx?.exercise_name
                                || allOtherParticipants.find(p => p.exercises.find(e => e.exercise_id === exId))?.exercises.find(e => e.exercise_id === exId)?.exercise_name
                                || 'Ejercicio Desconocido';
                            const muscle = myEx?.muscle_group
                                || allOtherParticipants.find(p => p.exercises.find(e => e.exercise_id === exId))?.exercises.find(e => e.exercise_id === exId)?.muscle_group
                                || 'General';

                            // All participants including me, each as { name, ex, colorClass, status }
                            const allParticipantsForEx = [
                                { name: workout.my_name || 'Atleta', ex: myEx, color: playerColors[0], isMine: true, status: 'finished' as 'finished' | 'in_progress' },
                                ...allOtherParticipants.map((p, idx) => ({
                                    name: p.name,
                                    ex: p.exercises.find(e => e.exercise_id === exId),
                                    color: playerColors[(idx + 1) % playerColors.length],
                                    isMine: false,
                                    status: p.status
                                }))
                            ];

                            const gridCols = allParticipantsForEx.length === 2
                                ? 'grid-cols-1 md:grid-cols-2'
                                : allParticipantsForEx.length === 3
                                    ? 'grid-cols-1 md:grid-cols-3'
                                    : 'grid-cols-2 md:grid-cols-4';

                            return (
                                <div key={exId} className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl relative">
                                    {/* Header */}
                                    <div className="p-4 md:p-6 border-b border-neutral-800 flex flex-wrap justify-between items-center bg-neutral-900/50 backdrop-blur-sm gap-3">
                                        <div>
                                            <h3 className="text-lg md:text-2xl font-black text-white italic uppercase tracking-tight mb-1">
                                                {name}
                                            </h3>
                                            <span className="inline-flex items-center gap-1.5 bg-neutral-800 text-neutral-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                <div className="w-1.5 h-1.5 rounded-full bg-gym-primary" />
                                                {muscle}
                                            </span>
                                        </div>
                                        <div className="flex gap-3 flex-wrap">
                                            {allParticipantsForEx.map((p, idx) => (
                                                <div key={idx} className="text-right">
                                                    <div className={`text-base font-black ${p.color} font-mono tracking-tighter`}>
                                                        {p.ex?.sets.reduce((sum, s) => sum + (s.weight_kg * s.reps), 0).toFixed(0) || '—'}
                                                        {p.ex && <span className="text-[9px] text-neutral-500 ml-0.5 font-sans font-bold">kg</span>}
                                                    </div>
                                                    <div className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest truncate max-w-[60px]">{p.name.substring(0, 8)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Per-participant sets columns */}
                                    <div className={`grid ${gridCols} divide-y md:divide-y-0 md:divide-x divide-neutral-800`}>
                                        {allParticipantsForEx.map((p, idx) => (
                                            <div key={idx} className="p-3 md:p-4 space-y-2">
                                                <div className={`text-[10px] font-black ${p.color} uppercase tracking-widest px-2 flex justify-between`}>
                                                    <span>{p.isMine ? `${p.name} ⚡` : `${p.name.substring(0, 10)} ⚔️`}</span>
                                                    <span className="text-neutral-500 font-normal lowercase">({p.ex?.sets.length || 0} sets)</span>
                                                </div>
                                                {p.ex ? (
                                                    <SetsTableCompact exercise={p.ex} workoutStartedAt={workout.started_at} isMine={p.isMine} />
                                                ) : p.status === 'in_progress' ? (
                                                    <div className="text-center py-4 text-[10px] text-yellow-600/70 italic font-bold uppercase tracking-wider">⏳ aún en sesión</div>
                                                ) : (
                                                    <div className="text-center py-4 text-[10px] text-neutral-700 italic font-bold uppercase tracking-wider">— no registró —</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        });

                        return (
                            <>
                                {hasInProgress && (
                                    <div className="mb-4 bg-yellow-950/30 border border-yellow-600/30 rounded-2xl p-4 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-yellow-500/80 text-[11px] font-black uppercase tracking-wider">
                                                ⏳ {inProgressNames} — aún en sesión
                                            </p>
                                            <p className="text-neutral-500 text-[10px] mt-0.5">
                                                Sus datos aparecerán aquí cuando terminen. Actualiza para ver el historial completo.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => { if (sessionId) loadWorkoutDetail(sessionId); }}
                                            className="shrink-0 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-500 font-black uppercase text-[10px] tracking-wider px-3 py-2 rounded-xl transition-colors border border-yellow-600/20 whitespace-nowrap"
                                        >
                                            Actualizar
                                        </button>
                                    </div>
                                )}
                                {cards}
                            </>
                        );
                    })()
                )}
            </div>
        </div>
    );
}

// Helper components to keep things exceptionally structured and premium
const ExerciseCard = ({ exercise, isMine, workoutStartedAt, partnerName }: { exercise: ExerciseDetail; isMine: boolean; workoutStartedAt: string; partnerName?: string }) => {
    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl relative group">
            <div className={`absolute top-0 right-0 w-32 h-32 ${isMine ? 'bg-gym-primary/5' : 'bg-blue-500/5'} rounded-full blur-3xl group-hover:opacity-100 transition-all pointer-events-none`} />

            <div className="p-6 border-b border-neutral-800 flex justify-between items-start bg-neutral-900/50 backdrop-blur-sm">
                <div>
                    <h3 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tight mb-2">
                        {exercise.exercise_name}
                    </h3>
                    <span className="inline-flex items-center gap-1.5 bg-neutral-800 text-neutral-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                        <div className={`w-1.5 h-1.5 rounded-full ${isMine ? 'bg-gym-primary' : 'bg-blue-400'}`} />
                        {exercise.muscle_group}
                    </span>
                </div>
                <div className="text-right">
                    <div className={`text-2xl font-black ${isMine ? 'text-gym-primary' : 'text-blue-400'} font-mono tracking-tighter`}>
                        {exercise.sets.reduce((sum, set) => sum + (set.weight_kg * set.reps), 0).toFixed(0)}
                        <span className="text-xs text-neutral-500 ml-1 font-sans font-bold">KG</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                        {isMine ? 'Mi Volumen' : `Volumen de ${partnerName?.substring(0, 10)}`}
                    </div>
                </div>
            </div>

            <div className="p-4">
                <SetsTableCompact exercise={exercise} workoutStartedAt={workoutStartedAt} isMine={isMine} />
            </div>
        </div>
    );
};

const SetsTableCompact = ({ exercise, workoutStartedAt, isMine }: { exercise: ExerciseDetail; workoutStartedAt: string; isMine: boolean }) => {
    return (
        <div className="overflow-x-auto pb-1">
            <div className="min-w-fit space-y-1">
                {/* Dynamic Header */}
                <div className="flex gap-1 px-2 pb-2 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center border-b border-neutral-800/50">
                    <div className="w-6 text-center">#</div>
                    {exercise.metrics?.hasWeight && <div className="flex-1 min-w-[50px]">KG</div>}
                    {exercise.metrics?.hasReps && <div className="flex-1 min-w-[50px]">Reps</div>}
                    {exercise.metrics?.hasTime && <div className="flex-1 min-w-[50px]">Tie</div>}
                    {exercise.metrics?.hasDistance && <div className="flex-1 min-w-[50px]">Dist</div>}
                    {exercise.metrics?.hasRpe && <div className="flex-1 min-w-[40px]">RPE</div>}
                    {exercise.metrics?.hasCompletedAt && <div className="flex-1 min-w-[50px]">Fin</div>}
                    {exercise.metrics?.hasRestDuration && <div className="flex-1 min-w-[50px]">Desc</div>}
                    {exercise.metrics?.customKeys?.map(key => (
                        <div key={key} className="flex-1 min-w-[50px] truncate" title={key}>
                            {key.substring(0, 4)}
                        </div>
                    ))}
                    {(exercise.metrics?.hasWeight && exercise.metrics?.hasReps) && <div className="flex-1 min-w-[50px] text-right">Vol</div>}
                </div>

                {/* Rows */}
                <div className="space-y-1 mt-1">
                    {exercise.sets.map((set, index) => (
                        <div
                            key={`set-${index}-${set.set_number}`}
                            className={`flex gap-1 px-2 py-1.5 rounded-lg items-center text-center transition-colors ${set.is_pr
                                ? isMine 
                                    ? 'bg-gradient-to-r from-gym-primary/10 to-transparent border border-gym-primary/20'
                                    : 'bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20'
                                : 'hover:bg-neutral-800/30'
                            }`}
                        >
                            <div className="w-6 text-center font-bold text-neutral-500 text-[10px] flex justify-center">
                                <span className="w-4 h-4 rounded flex items-center justify-center bg-neutral-800/50">
                                    {set.set_number}
                                </span>
                            </div>

                            {exercise.metrics?.hasWeight && (
                                <div className="flex-1 min-w-[50px] font-mono font-bold text-white text-xs">
                                    {set.weightUnit === 'lb'
                                        ? `${Math.round(set.weight_kg * 2.20462)} lb`
                                        : `${parseFloat(set.weight_kg.toFixed(1))} kg`
                                    }
                                </div>
                            )}

                            {exercise.metrics?.hasReps && (
                                <div className="flex-1 min-w-[50px] font-mono font-bold text-white text-xs">
                                    {set.reps > 0 ? set.reps : <span className="text-neutral-700">-</span>}
                                </div>
                            )}

                            {exercise.metrics?.hasTime && (
                                <div className="flex-1 min-w-[50px] font-mono font-bold text-white text-xs">
                                    {set.time ? `${set.time}s` : <span className="text-neutral-700">-</span>}
                                </div>
                            )}

                            {exercise.metrics?.hasDistance && (
                                <div className="flex-1 min-w-[50px] font-mono font-bold text-white text-xs">
                                    {set.distance ? `${set.distance}m` : <span className="text-neutral-700">-</span>}
                                </div>
                            )}

                            {exercise.metrics?.hasRpe && (
                                <div className={`flex-1 min-w-[40px] font-mono font-bold ${isMine ? 'text-gym-primary/80' : 'text-blue-400/80'} text-[10px]`}>
                                    {set.rpe || <span className="text-neutral-700">-</span>}
                                </div>
                            )}

                            {exercise.metrics?.hasCompletedAt && (
                                <div className="flex-1 min-w-[50px] font-mono font-bold text-white text-[10px]">
                                    {set.completedAt ? (() => {
                                        const start = new Date(workoutStartedAt).getTime();
                                        const completedTime = Number(set.completedAt);
                                        if (isNaN(completedTime)) return '-';
                                        const diff = completedTime - start;
                                        if (diff < 0) return '-';
                                        const totalSeconds = Math.floor(diff / 1000);
                                        const h = Math.floor(totalSeconds / 3600);
                                        const m = Math.floor((totalSeconds % 3600) / 60);
                                        const s = totalSeconds % 60;
                                        
                                        let timeStr = '';
                                        if (h > 0) timeStr += `${h}h `;
                                        if (m > 0 || h > 0) timeStr += `${m}m `;
                                        timeStr += `${s}s`;
                                        
                                        return timeStr.trim();
                                    })() : <span className="text-neutral-700">-</span>}
                                </div>
                            )}

                            {exercise.metrics?.hasRestDuration && (
                                <div className="flex-1 min-w-[50px] font-mono font-bold text-blue-400 text-[10px]">
                                    {set.restDuration ? (() => {
                                        const secs = Math.floor(set.restDuration / 1000);
                                        const m = Math.floor(secs / 60);
                                        const s = secs % 60;
                                        return `${m}:${s.toString().padStart(2, '0')}`;
                                    })() : <span className="text-neutral-700">-</span>}
                                </div>
                            )}

                            {exercise.metrics?.customKeys?.map(key => (
                                <div key={key} className="flex-1 min-w-[50px] font-mono font-bold text-white text-xs">
                                    {set.metrics_data?.[key] ? set.metrics_data[key] : <span className="text-neutral-700">-</span>}
                                </div>
                            ))}

                            {(exercise.metrics?.hasWeight && exercise.metrics?.hasReps) && (
                                <div className="flex-1 min-w-[50px] text-right font-mono font-black text-neutral-600 text-[9px]">
                                    {set.weight_kg > 0 && set.reps > 0
                                        ? (set.weight_kg * set.reps).toFixed(0)
                                        : '-'
                                    }
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
