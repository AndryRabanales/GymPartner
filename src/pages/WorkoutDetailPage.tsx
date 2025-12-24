import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Clock, Dumbbell, MapPin, Calendar } from 'lucide-react';

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
    }[];
    metrics?: {
        hasWeight: boolean;
        hasReps: boolean;
        hasTime: boolean;
        hasDistance: boolean;
        hasRpe: boolean;
        customKeys: string[];
    };
}

interface WorkoutDetail {
    id: string;
    started_at: string;
    end_time: string;
    gym_name: string;
    gym_id: string;
    duration_minutes: number;
    total_volume: number;
    exercises: ExerciseDetail[];
}

export default function WorkoutDetailPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [workout, setWorkout] = useState<WorkoutDetail | null>(null);

    useEffect(() => {
        if (sessionId) {
            loadWorkoutDetail(sessionId);
        }
    }, [sessionId]);

    const loadWorkoutDetail = async (id: string) => {
        try {
            // Get session data
            const { data: session, error: sessionError } = await supabase
                .from('workout_sessions')
                .select(`
                    id,
                    started_at,
                    end_time,
                    gyms ( name, id )
                `)
                .eq('id', id)
                .single();

            if (sessionError) throw sessionError;

            // Get workout logs with exercise details
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
                    equipment:exercise_id ( name )
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
                        muscle_group: (log.equipment as any)?.target_muscle_group || 'General',
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
                    is_pr: log.is_pr || false
                });

                totalVol += (log.weight_kg || 0) * (log.reps || 0);
            });

            // Calculate metrics flags for each exercise
            exerciseMap.forEach((ex) => {
                const allCustomKeys = new Set<string>();
                ex.sets.forEach(s => {
                    if (s.metrics_data) {
                        Object.keys(s.metrics_data).forEach(k => allCustomKeys.add(k));
                    }
                });

                ex.metrics = {
                    hasWeight: ex.sets.some(s => s.weight_kg > 0),
                    hasReps: ex.sets.some(s => s.reps > 0),
                    hasTime: ex.sets.some(s => (s.time || 0) > 0),
                    hasDistance: ex.sets.some(s => (s.distance || 0) > 0),
                    hasRpe: ex.sets.some(s => (s.rpe || 0) > 0),
                    customKeys: Array.from(allCustomKeys)
                };
            });

            const start = new Date(session.started_at).getTime();
            const end = new Date(session.end_time).getTime();
            const duration = Math.round((end - start) / (1000 * 60));

            // Fix gym access (handle array or object)
            const gymData = Array.isArray(session.gyms) ? session.gyms[0] : session.gyms;

            setWorkout({
                id: session.id,
                started_at: session.started_at,
                end_time: session.end_time,
                gym_name: gymData?.name || 'Gimnasio Desconocido',
                gym_id: gymData?.id,
                duration_minutes: duration,
                total_volume: totalVol,
                exercises: Array.from(exerciseMap.values())
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
                <button
                    onClick={() => navigate('/history')}
                    className="flex items-center gap-2 text-gym-primary mb-4 hover:underline"
                >
                    <ChevronLeft size={20} />
                    Volver al Historial
                </button>

                <h1 className="text-2xl md:text-3xl font-black uppercase italic mb-2">
                    Detalles de Batalla
                </h1>

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
            </div>

            {/* Exercise List */}
            <div className="max-w-4xl mx-auto p-4 space-y-6">
                {workout.exercises.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-neutral-500 space-y-4">
                        <Dumbbell size={48} className="opacity-20" />
                        <p className="text-sm uppercase tracking-widest font-bold">No se registraron ejercicios</p>
                    </div>
                ) : (
                    workout.exercises.map((exercise) => (
                        <div
                            key={exercise.exercise_id}
                            className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl relative group"
                        >
                            {/* Decorative Gradient Blob */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gym-primary/5 rounded-full blur-3xl group-hover:bg-gym-primary/10 transition-all pointer-events-none" />

                            {/* Exercise Header */}
                            <div className="p-6 border-b border-neutral-800 flex justify-between items-start bg-neutral-900/50 backdrop-blur-sm">
                                <div>
                                    <h3 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tight mb-2">
                                        {exercise.exercise_name}
                                    </h3>
                                    <span className="inline-flex items-center gap-1.5 bg-neutral-800 text-neutral-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                        <div className="w-1.5 h-1.5 rounded-full bg-gym-primary" />
                                        {exercise.muscle_group}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-gym-primary font-mono tracking-tighter">
                                        {exercise.sets.reduce((sum, set) => sum + (set.weight_kg * set.reps), 0).toFixed(0)}
                                        <span className="text-xs text-neutral-500 ml-1 font-sans font-bold">KG</span>
                                    </div>
                                    <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Volumen Total</div>
                                </div>
                            </div>

                            {/* Sets Table */}
                            <div className="p-4">
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
                                            {/* Dynamic Custom Headers */}
                                            {exercise.metrics?.customKeys?.map(key => (
                                                <div key={key} className="flex-1 min-w-[50px] truncate" title={key}>
                                                    {key.substring(0, 4)}
                                                </div>
                                            ))}
                                            {/* Total Volume Column only if we have weight/reps */}
                                            {(exercise.metrics?.hasWeight && exercise.metrics?.hasReps) && <div className="flex-1 min-w-[50px] text-right">Vol</div>}
                                        </div>

                                        {/* Dynamic Rows */}
                                        <div className="space-y-1 mt-1">
                                            {exercise.sets.map((set, index) => (
                                                <div
                                                    key={`set-${index}-${set.set_number}`}
                                                    className={`flex gap-1 px-2 py-2 rounded-lg items-center text-center transition-colors ${set.is_pr
                                                        ? 'bg-gradient-to-r from-gym-primary/10 to-transparent border border-gym-primary/20'
                                                        : 'hover:bg-neutral-800/30'
                                                        }`}
                                                >
                                                    {/* Set Number */}
                                                    <div className="w-6 text-center font-bold text-neutral-500 text-xs flex justify-center">
                                                        <span className="w-5 h-5 rounded flex items-center justify-center bg-neutral-800/50">
                                                            {set.set_number}
                                                        </span>
                                                    </div>

                                                    {/* Weight */}
                                                    {exercise.metrics?.hasWeight && (
                                                        <div className="flex-1 min-w-[50px] font-mono font-bold text-white text-sm">
                                                            {set.weight_kg > 0 ? set.weight_kg : <span className="text-neutral-700">-</span>}
                                                        </div>
                                                    )}

                                                    {/* Reps */}
                                                    {exercise.metrics?.hasReps && (
                                                        <div className="flex-1 min-w-[50px] font-mono font-bold text-white text-sm">
                                                            {set.reps > 0 ? set.reps : <span className="text-neutral-700">-</span>}
                                                        </div>
                                                    )}

                                                    {/* Time */}
                                                    {exercise.metrics?.hasTime && (
                                                        <div className="flex-1 min-w-[50px] font-mono font-bold text-white text-sm">
                                                            {set.time ? `${set.time}s` : <span className="text-neutral-700">-</span>}
                                                        </div>
                                                    )}

                                                    {/* Distance */}
                                                    {exercise.metrics?.hasDistance && (
                                                        <div className="flex-1 min-w-[50px] font-mono font-bold text-white text-sm">
                                                            {set.distance ? `${set.distance}m` : <span className="text-neutral-700">-</span>}
                                                        </div>
                                                    )}

                                                    {/* RPE */}
                                                    {exercise.metrics?.hasRpe && (
                                                        <div className="flex-1 min-w-[40px] font-mono font-bold text-gym-primary/80 text-xs">
                                                            {set.rpe || <span className="text-neutral-700">-</span>}
                                                        </div>
                                                    )}

                                                    {/* Dynamic Custom Cells */}
                                                    {exercise.metrics?.customKeys?.map(key => (
                                                        <div key={key} className="flex-1 min-w-[50px] font-mono font-bold text-white text-sm">
                                                            {set.metrics_data?.[key] ? set.metrics_data[key] : <span className="text-neutral-700">-</span>}
                                                        </div>
                                                    ))}

                                                    {/* Volume (Calculated) */}
                                                    {(exercise.metrics?.hasWeight && exercise.metrics?.hasReps) && (
                                                        <div className="flex-1 min-w-[50px] text-right font-mono font-black text-neutral-600 text-[10px]">
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
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
