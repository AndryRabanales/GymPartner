import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader, Calendar, MapPin, Clock, Dumbbell, Share2, Trash2, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicTeaser } from '../components/common/PublicTeaser';
import { ShareHistoryModal } from '../components/profile/ShareHistoryModal';
import { workoutService } from '../services/WorkoutService';
import toast from 'react-hot-toast';

interface WorkoutRecord {
    id: string;
    gym_name: string;
    gym_id: string;
    started_at: string;
    duration_minutes: number;
    total_volume: number;
    muscles_trained: string[];
    is_multiplayer?: boolean;
    partner_id?: string;
    partner_session_id?: string;
    partner_status?: 'in_progress' | 'finished';
    // All other room participants (may be 1 or more for N-person rooms)
    partner_names?: string[];
}

export const HistoryPage = () => {
    const { user } = useAuth();
    const [showShareModal, setShowShareModal] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<WorkoutRecord[]>([]);

    let pressTimer: any;
    const handlePressStart = (id: string) => {
        pressTimer = setTimeout(() => {
            setIsSelectionMode(true);
            setSelectedIds(new Set([id]));
        }, 600);
    };
    const handlePressEnd = () => {
        clearTimeout(pressTimer);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedIds.size === history.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(history.map(item => item.id)));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;

        const count = selectedIds.size;
        const confirmed = window.confirm(
            count === 1
                ? `¿Estás seguro de que deseas eliminar este entrenamiento?`
                : `¿Estás seguro de que deseas eliminar los ${count} entrenamientos seleccionados?`
        );
        if (!confirmed) return;

        setDeleting(true);
        try {
            const idsArray = Array.from(selectedIds);
            await Promise.all(idsArray.map(id => workoutService.deleteSession(id)));
            
            toast.success(
                count === 1
                    ? "¡Entrenamiento eliminado correctamente! ⚔️"
                    : `¡${count} entrenamientos eliminados correctamente! ⚔️`
            );
            
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            loadHistory();
        } catch (err: any) {
            console.error("Error deleting sessions:", err);
            alert(`Error al eliminar: ${err.message || 'Error desconocido'}`);
        } finally {
            setDeleting(false);
        }
    };

    const loadHistory = async () => {
        if (!user) return;

        setLoading(true);
        try {
             const { data, error } = await supabase
                .from('workout_sessions')
                .select(`
                    id,
                    started_at,
                    end_time,
                    is_multiplayer,
                    multiplayer_mode,
                    partner_id,
                    partner_session_id,
                    gyms ( name, id ),
                    workout_logs (
                        weight_kg,
                        reps,
                        sets,
                        time,
                        distance,
                        metrics_data,
                        category_snapshot,
                        equipment:exercise_id ( target_muscle_group, name )
                    )
                `)
                .eq('user_id', user.id)
                .not('end_time', 'is', null)
                .order('started_at', { ascending: false });

            if (error) throw error;

            // ── N-person room lookup ─────────────────────────────────────────────
            // For each multiplayer session, the "room" is anchored at the HOST's
            // session (roomId). Host: roomId = session.id. Guest: roomId = partner_session_id.
            // We fetch ALL sessions sharing that roomId (host row + all guest rows)
            // to build the full participant list for every session in one pass.
            const multiSessions = (data || []).filter((s: any) => s.is_multiplayer);
            const allRoomIds = [...new Set<string>(
                multiSessions.map((s: any) => s.partner_session_id || s.id)
            )];

            // roomId → array of all participants in that room
            const roomParticipantsMap = new Map<string, { userId: string; username: string; finished: boolean }[]>();

            if (allRoomIds.length > 0) {
                // PostgREST cannot join workout_sessions→profiles via the implicit user_id
                // FK (it's to auth.users, not profiles), so we fetch session rows first
                // and then resolve usernames in a separate profiles query.
                const [{ data: hostRows }, { data: guestRows }] = await Promise.all([
                    supabase
                        .from('workout_sessions')
                        .select('id, user_id, end_time, finished_at')
                        .in('id', allRoomIds),
                    supabase
                        .from('workout_sessions')
                        .select('id, user_id, partner_session_id, end_time, finished_at')
                        .in('partner_session_id', allRoomIds)
                ]);

                // Collect all participant user IDs in one pass, then fetch profiles
                const allParticipantIds = [
                    ...(hostRows || []).map((r: any) => r.user_id),
                    ...(guestRows || []).map((r: any) => r.user_id)
                ].filter(Boolean);

                const uniqueParticipantIds = [...new Set<string>(allParticipantIds)];
                let profileMap = new Map<string, string>();

                if (uniqueParticipantIds.length > 0) {
                    const { data: profileRows } = await supabase
                        .from('profiles')
                        .select('id, username')
                        .in('id', uniqueParticipantIds);
                    (profileRows || []).forEach((p: any) => {
                        if (p.id && p.username) profileMap.set(p.id, p.username);
                    });
                }

                (hostRows || []).forEach((row: any) => {
                    const roomId: string = row.id;
                    if (!roomParticipantsMap.has(roomId)) roomParticipantsMap.set(roomId, []);
                    roomParticipantsMap.get(roomId)!.push({
                        userId: row.user_id,
                        username: profileMap.get(row.user_id) || 'Atleta',
                        finished: !!row.end_time
                    });
                });

                (guestRows || []).forEach((row: any) => {
                    const roomId: string = row.partner_session_id;
                    if (!roomParticipantsMap.has(roomId)) roomParticipantsMap.set(roomId, []);
                    roomParticipantsMap.get(roomId)!.push({
                        userId: row.user_id,
                        username: profileMap.get(row.user_id) || 'Atleta',
                        finished: !!row.end_time
                    });
                });
            }

            const records = (data || []).map((s: any) => {
                const muscleSet = new Set<string>();
                let vol = 0;

                // Standard Mapping (Consistency with StatsAnalyzer)
                const mapping: Record<string, string> = {
                    'chest': 'Pecho', 'pectoral': 'Pecho', 'pectorales': 'Pecho', 'pecho': 'Pecho',
                    'back': 'Espalda', 'dorsales': 'Espalda', 'espalda': 'Espalda',
                    'legs': 'Pierna', 'cuádriceps': 'Pierna', 'isquios': 'Pierna', 'glúteos': 'Pierna', 'pierna': 'Pierna', 'calves': 'Pierna', 'pantorrillas': 'Pierna', 'glutes': 'Pierna',
                    'shoulders': 'Hombro', 'deltoides': 'Hombro', 'hombro': 'Hombro',
                    'biceps': 'Bíceps', 'bíceps': 'Bíceps',
                    'triceps': 'Tríceps', 'tríceps': 'Tríceps',
                    'abs': 'Core', 'abdominales': 'Core', 'core': 'Core',
                    'cardio': 'Cardio'
                };

                const VALID_MUSCLES = ['Pecho', 'Espalda', 'Pierna', 'Hombro', 'Bíceps', 'Tríceps', 'Core', 'Cardio'];
                const IGNORED_TAGS = ['free_weight', 'strength_machine', 'cable', 'accessory', 'custom', 'other', 'unknown'];

                s.workout_logs?.forEach((l: any) => {
                    // 1. Determine Candidate Category
                    let category = l.category_snapshot;

                    // If snapshot is missing or is just a machine type, try the DB target_muscle_group
                    // Safe lower case check
                    const catLower = category ? category.toLowerCase() : '';

                    if (!category || IGNORED_TAGS.includes(catLower)) {
                        category = l.equipment?.target_muscle_group;
                    }

                    // Re-evaluate category after DB check
                    const currentCatLower = category ? category.toLowerCase() : '';

                    // 2. Name Heuristic (The "Detective" Logic)
                    // If we STILL don't have a valid muscle (it's null or still generic), check the name
                    if ((!category || IGNORED_TAGS.includes(currentCatLower)) && l.equipment?.name) {
                        const name = l.equipment.name.toLowerCase();
                        if (name.includes('jalon') || name.includes('remo') || name.includes('dominadas') || name.includes('polea') || name.includes('pull')) category = 'Espalda';
                        else if (name.includes('press') || name.includes('banco') || name.includes('pec') || name.includes('cruce') || name.includes('chest')) category = 'Pecho';
                        else if (name.includes('sentadilla') || name.includes('prensa') || name.includes('extension') || name.includes('curl femoral') || name.includes('zancada') || name.includes('hack') || name.includes('leg') || name.includes('squat')) category = 'Pierna';
                        else if (name.includes('militar') || name.includes('lateral') || name.includes('hombro') || name.includes('shoulder')) category = 'Hombro';
                        else if (name.includes('biceps') || name.includes('bíceps') || name.includes('curl')) category = 'Bíceps';
                        else if (name.includes('triceps') || name.includes('tríceps') || name.includes('copa') || name.includes('fondos')) category = 'Tríceps';
                        else if (name.includes('abs') || name.includes('crunch') || name.includes('plancha') || name.includes('core')) category = 'Core';
                        else if (name.includes('correr') || name.includes('elíptica') || name.includes('bici') || name.includes('cardio')) category = 'Cardio';
                    }

                    // 3. Final Validation & Normalization
                    // Only add if it maps to one of the 8 Sacred Radar Muscles
                    if (category) {
                        const normalized = mapping[category.toLowerCase()] || category;
                        // Exact match against allowed list (preserves casing)
                        const standard = VALID_MUSCLES.find(m => m.toLowerCase() === normalized.toLowerCase());

                        if (standard) {
                            muscleSet.add(standard);
                        }
                    }

                    // Normalized Volume Logic
                    const sets = l.sets || 1;
                    if (l.weight_kg > 0) vol += (l.weight_kg * l.reps * sets);
                    else if (l.reps > 0) vol += (l.reps * 60 * sets * 0.5);
                    else if ((l.time || l.metrics_data?.time) > 0) vol += ((l.time || l.metrics_data?.time) * 1.5);
                    else if ((l.distance || l.metrics_data?.distance) > 0) vol += ((l.distance || l.metrics_data?.distance) * 0.5);
                });

                const start = new Date(s.started_at).getTime();
                const end = new Date(s.end_time).getTime();
                const duration = Math.round((end - start) / (1000 * 60));

                // Determine all OTHER participants in this room (excludes self).
                // roomId: host session id for everyone — guests use partner_session_id.
                const roomId: string = s.partner_session_id || s.id;
                const allRoomParts = roomParticipantsMap.get(roomId) || [];
                const others = allRoomParts.filter(p => p.userId !== s.user_id);
                const partnerNames = others.map(p => p.username);
                // 'in_progress' if any co-participant hasn't closed their session yet.
                const allOthersDone = others.length === 0 || others.every(p => p.finished);

                return {
                    id: s.id,
                    gym_name: s.gyms?.name || 'Gimnasio Desconocido',
                    gym_id: s.gyms?.id,
                    started_at: s.started_at,
                    duration_minutes: duration,
                    total_volume: vol,
                    muscles_trained: Array.from(muscleSet),
                    is_multiplayer: s.is_multiplayer,
                    partner_id: s.partner_id,
                    partner_session_id: s.partner_session_id,
                    partner_status: s.is_multiplayer
                        ? (allOthersDone ? 'finished' : 'in_progress')
                        : undefined,
                    partner_names: partnerNames.length > 0 ? partnerNames : undefined
                };
            });

            console.log('✅ Entrenamientos cargados:', records.length);
            setHistory(records);
            setLoading(false);
        } catch (error) {
            console.error('Error loading history:', error);
            setHistory([]);
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [user]);

    if (!user) {
        return (
            <PublicTeaser
                icon={Calendar}
                title="Historial de Entrenamiento"
                description="Visualiza tu historial de sesiones. Cada sesión es un registro imborrable de tu progreso real."
                benefitTitle="Historial Completo"
                benefitDescription="Accede a un cronograma detallado de todos tus entrenamientos. Compara tu rendimiento pasado y supérate."
                iconColor="text-blue-500"
                bgAccent="bg-blue-500/10"
            />
        );
    }

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-gym-primary"><Loader className="animate-spin" size={32} /></div>;
    }

    if (history.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-neutral-900 p-8 rounded-3xl border border-neutral-800 max-w-md w-full">
                    <Calendar className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Historial Vacío</h2>
                    <p className="text-neutral-400 mb-6">Tu bitácora de entrenamientos se llenará cuando completes tu primera sesión.</p>
                    <Link to="/profile" className="bg-gym-primary text-black font-bold py-3 px-6 rounded-xl hover:bg-yellow-400 transition-colors inline-block">
                        Volver al Perfil
                    </Link>
                </div>
            </div>
        );
    }

    // Group by month
    const groupedByMonth = history.reduce((acc, item) => {
        const date = new Date(item.started_at);
        const monthKey = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
        if (!acc[monthKey]) acc[monthKey] = [];
        acc[monthKey].push(item);
        return acc;
    }, {} as Record<string, WorkoutRecord[]>);

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-24">
            {/* Header */}
            <div className="text-center mb-8 space-y-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight uppercase italic">
                        Historial de Entrenamiento
                    </h1>
                    <p className="text-neutral-400 text-sm">Registro completo de tus entrenamientos</p>
                </div>
                <div className="flex justify-center flex-wrap gap-3">
                    {isSelectionMode ? (
                        <>
                            <button
                                onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
                                className="bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 uppercase tracking-wider"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSelectAll}
                                className="bg-neutral-900 border border-gym-primary/40 text-gym-primary hover:bg-gym-primary/10 px-4 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 uppercase tracking-wider"
                            >
                                {selectedIds.size === history.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
                            </button>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={deleting || selectedIds.size === 0}
                                className="bg-red-950/20 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/30 px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                            >
                                {deleting ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Trash2 size={14} />
                                )}
                                {deleting ? 'Eliminando...' : `Eliminar (${selectedIds.size})`}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsSelectionMode(true)}
                                className="bg-neutral-950 hover:bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-2 uppercase tracking-wider"
                            >
                                <Trash2 size={14} />
                                Eliminar
                            </button>
                            <button
                                onClick={() => setShowShareModal(true)}
                                className="bg-gym-primary hover:bg-yellow-400 text-black px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 active:scale-95 shadow-[0_0_15px_rgba(229,255,0,0.15)] uppercase tracking-wider"
                            >
                                <Share2 size={14} strokeWidth={2.5} />
                                Compartir Historial
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Share History Modal */}
            {showShareModal && (
                <ShareHistoryModal
                    userId={user.id}
                    onClose={() => setShowShareModal(false)}
                />
            )}

            {/* Timeline */}
            <div className="space-y-8">
                {Object.entries(groupedByMonth).map(([month, sessions]) => (
                    <div key={month} className="space-y-4">
                        <div className="flex items-center gap-3 mb-4">
                            <Calendar size={18} className="text-gym-primary" />
                            <h2 className="text-xl font-bold text-white uppercase tracking-wide">{month}</h2>
                            <div className="h-px flex-1 bg-neutral-800"></div>
                        </div>
                        {sessions.map(session => (
                            <WorkoutCard 
                                key={session.id} 
                                session={session} 
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedIds.has(session.id)}
                                onToggleSelect={toggleSelect}
                                onPressStart={handlePressStart}
                                onPressEnd={handlePressEnd}
                            />
                        ))}
                    </div>
                ))}
            </div>

            <div className="text-center pt-8 opacity-50 text-xs text-neutral-500 font-mono">
                {history.length} SESIONES REGISTRADAS
            </div>
        </div>
    );
};

const WorkoutCard = ({ 
    session, 
    isSelectionMode, 
    isSelected, 
    onToggleSelect,
    onPressStart,
    onPressEnd
}: { 
    session: WorkoutRecord;
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
    onPressStart: (id: string) => void;
    onPressEnd: () => void;
}) => {
    const navigate = useNavigate();
    const date = new Date(session.started_at);
    const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' });
    const dayNum = date.getDate();
    const monthShort = date.toLocaleDateString('es-ES', { month: 'short' });

    const handleClick = (e: React.MouseEvent) => {
        if (isSelectionMode) {
            e.preventDefault();
            onToggleSelect(session.id);
        } else {
            navigate(`/history/${session.id}`);
        }
    };

    return (
        <div
            onClick={handleClick}
            onMouseDown={() => onPressStart(session.id)}
            onMouseUp={onPressEnd}
            onMouseLeave={onPressEnd}
            onTouchStart={() => onPressStart(session.id)}
            onTouchEnd={onPressEnd}
            className={`block bg-neutral-900 border ${isSelected ? 'border-gym-primary shadow-[0_0_15px_rgba(229,255,0,0.1)]' : 'border-neutral-800'} rounded-3xl p-4 md:p-6 hover:border-gym-primary/50 transition-all group relative overflow-hidden cursor-pointer select-none`}
        >
            <div className="absolute inset-0 bg-gradient-to-r from-gym-primary/0 via-gym-primary/5 to-gym-primary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

            <div className="flex items-center gap-4 relative z-10">
                {/* Selection Indicator checkbox */}
                {isSelectionMode && (
                    <div className="shrink-0 mr-1 animate-in slide-in-from-left-4 duration-300">
                        {isSelected ? (
                            <CheckCircle2 className="text-gym-primary shrink-0" size={24} fill="currentColor" stroke="black" />
                        ) : (
                            <Circle className="text-neutral-600 shrink-0" size={24} />
                        )}
                    </div>
                )}

                {/* Date Badge */}
                <div className="shrink-0">
                    <div className="bg-neutral-800 border border-neutral-700 rounded-xl w-16 h-16 md:w-20 md:h-20 flex flex-col items-center justify-center group-hover:border-gym-primary/50 transition-colors">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase">{dayName}</span>
                        <span className="text-2xl md:text-3xl font-black text-white">{dayNum}</span>
                        <span className="text-[10px] font-bold text-neutral-500 uppercase">{monthShort}</span>
                    </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-3">
                    {/* Gym Name */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-white font-bold text-base md:text-lg group-hover:text-gym-primary transition-colors flex items-center gap-2 truncate">
                            <MapPin size={16} className="shrink-0" />
                            <span className="truncate">{session.gym_name}</span>
                        </div>
                        {session.is_multiplayer && (
                            <span className="shrink-0 inline-flex items-center gap-1 bg-gym-primary/10 border border-gym-primary/30 text-gym-primary px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                                ⚔️ CO-OP
                            </span>
                        )}
                    </div>

                    {/* Muscles Trained */}
                    {session.muscles_trained.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {session.muscles_trained.map(muscle => (
                                <span
                                    key={muscle}
                                    className="bg-gym-primary/20 border border-gym-primary/40 text-gym-primary px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wide"
                                >
                                    💪 {muscle}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Multiplayer Status Indicator */}
                    {session.is_multiplayer && (
                        <div className="flex items-center gap-2 text-xs">
                            {session.partner_status === 'in_progress' ? (
                                <span className="inline-flex items-center gap-1.5 text-amber-500 font-bold bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    {session.partner_names && session.partner_names.length > 0
                                        ? session.partner_names.map(n => n.substring(0, 10)).join(', ')
                                        : 'Compañero'} en proceso ⚔️
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 text-green-500 font-bold bg-green-500/10 px-3 py-1 rounded-xl border border-green-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    Conjunto con {session.partner_names && session.partner_names.length > 0
                                        ? session.partner_names.map(n => n.substring(0, 10)).join(', ')
                                        : 'Compañero'} finalizado 🤝
                                </span>
                            )}
                        </div>
                    )}

                    {/* Metrics Row */}
                    <div className="flex items-center gap-4 text-xs md:text-sm">
                        <div className="flex items-center gap-1.5 text-neutral-400">
                            <Clock size={14} className="text-blue-500" />
                            <span className="font-bold">{session.duration_minutes} min</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-neutral-400">
                            <Dumbbell size={14} className="text-gym-primary" />
                            <span className="font-bold">{session.total_volume > 0 ? `${(session.total_volume / 1000).toFixed(1)}k kg` : '0 kg'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
