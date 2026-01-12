import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader, Calendar, MapPin, Clock, Dumbbell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PublicTeaser } from '../components/common/PublicTeaser';

interface WorkoutRecord {
    id: string;
    gym_name: string;
    gym_id: string;
    started_at: string;
    duration_minutes: number;
    total_volume: number;
    muscles_trained: string[];
}

export const HistoryPage = () => {
    const { user } = useAuth();

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

    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<WorkoutRecord[]>([]);

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

                return {
                    id: s.id,
                    gym_name: s.gyms?.name || 'Gimnasio Desconocido',
                    gym_id: s.gyms?.id,
                    started_at: s.started_at,
                    duration_minutes: duration,
                    total_volume: vol,
                    muscles_trained: Array.from(muscleSet)
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
            <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight uppercase italic">
                    Historial de Entrenamiento
                </h1>
                <p className="text-neutral-400 text-sm mb-4">Registro completo de tus entrenamientos</p>
                <button
                    onClick={loadHistory}
                    className="bg-gym-primary/20 hover:bg-gym-primary/30 text-gym-primary border border-gym-primary/40 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                >
                    🔄 Recargar Historial
                </button>
            </div>

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
                            <WorkoutCard key={session.id} session={session} />
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

const WorkoutCard = ({ session }: { session: WorkoutRecord }) => {
    const date = new Date(session.started_at);
    const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' });
    const dayNum = date.getDate();
    const monthShort = date.toLocaleDateString('es-ES', { month: 'short' });

    return (
        <Link
            to={`/history/${session.id}`}
            className="block bg-neutral-900 border border-neutral-800 rounded-2xl p-4 md:p-6 hover:border-gym-primary/50 transition-all group relative overflow-hidden cursor-pointer"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-gym-primary/0 via-gym-primary/5 to-gym-primary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

            <div className="flex gap-4 relative z-10">
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
                    <div className="flex-1 min-w-0">
                        <div className="text-white font-bold text-base md:text-lg group-hover:text-gym-primary transition-colors flex items-center gap-2 truncate">
                            <MapPin size={16} className="shrink-0" />
                            <span className="truncate">{session.gym_name}</span>
                        </div>
                    </div>

                    {/* Muscles Trained - PROMINENTE */}
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
        </Link>
    );
};
