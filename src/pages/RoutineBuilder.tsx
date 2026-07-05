import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/UserService';
import { workoutService } from '../services/WorkoutService';
import { routineCache } from '../lib/offlineCache';
import { CURATED_EXERCISES } from '../data/exerciseCatalog';
import { CatalogModal } from '../components/workout/CatalogModal';
import { ArrowLeft, Plus, Save, Trash2, Dumbbell, Clock, Hash, Trophy } from 'lucide-react';

interface RoutineExerciseConfig {
    exercise_id: string;   // "virtual-${seedName}"
    name: string;          // seedName (human-readable)
    track_weight: boolean;
    track_reps: boolean;
    track_time: boolean;
    track_pr: boolean;
    target_sets: number;
    target_reps_text: string;
    custom_metric?: string;
}

export const RoutineBuilder = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    const [name, setName] = useState('');
    const [selectedExercises, setSelectedExercises] = useState<RoutineExerciseConfig[]>([]);
    const [showSelector, setShowSelector] = useState(false);
    const [selectedCatalogItems, setSelectedCatalogItems] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (id) loadRoutineForEdit(id);
    }, [user, id]);

    const loadRoutineForEdit = async (routineId: string) => {
        try {
            let routine = await userService.getRoutineDetails(routineId).catch(() => null);

            // Offline fallback: find the routine in any cached routines list
            if (!routine && user) {
                const globalCache = await routineCache.load(user.id, null);
                const allCached = globalCache;
                // Also check gym-specific caches by trying all cached keys
                const found = allCached.find((r: any) => r.id === routineId);
                if (found) {
                    routine = {
                        name: found.name,
                        exercises: found.routine_exercises || []
                    };
                }
            }

            if (!routine) return;
            setName(routine.name);
            const exercises = routine.exercises || routine.routine_exercises || [];
            if (exercises.length > 0) {
                const mapped: RoutineExerciseConfig[] = exercises.map((ex: any) => ({
                    exercise_id: ex.exercise_id?.startsWith('virtual-') ? ex.exercise_id : `virtual-${ex.name}`,
                    name: ex.name,
                    track_weight: ex.track_weight ?? true,
                    track_reps: ex.track_reps ?? true,
                    track_time: ex.track_time ?? false,
                    track_pr: ex.track_pr ?? true,
                    target_sets: ex.target_sets || 4,
                    target_reps_text: ex.target_reps_text || '10-12',
                    custom_metric: ex.custom_metric || ''
                }));
                setSelectedExercises(mapped);
                setSelectedCatalogItems(new Set(mapped.map(ex => ex.exercise_id)));
            }
        } catch (err) {
            console.error('Error loading routine for edit:', err);
        }
    };

    const handleCatalogToggle = (virtualId: string) => {
        setSelectedCatalogItems(prev => {
            const next = new Set(prev);
            if (next.has(virtualId)) next.delete(virtualId);
            else next.add(virtualId);
            return next;
        });
    };


    const handleBatchAdd = () => {
        const newSelections: RoutineExerciseConfig[] = [];

        // Keep existing exercises that are still in the selection
        selectedExercises.forEach(ex => {
            if (selectedCatalogItems.has(ex.exercise_id)) {
                newSelections.push(ex);
            }
        });

        // Add newly selected ones
        selectedCatalogItems.forEach(virtualId => {
            if (selectedExercises.some(ex => ex.exercise_id === virtualId)) return;

            const seedName = virtualId.replace(/^virtual-/, '');
            const base = CURATED_EXERCISES.find(b => b.variants.some(v => v.seedName === seedName));
            const metrics = base?.metrics ?? { weight: true, reps: true, time: false, distance: false, rpe: false };

            newSelections.push({
                exercise_id: virtualId,
                name: seedName,
                track_weight: metrics.weight,
                track_reps: metrics.reps,
                track_time: metrics.time,
                track_pr: true,
                target_sets: 4,
                target_reps_text: '10-12',
                custom_metric: ''
            });
        });

        setSelectedExercises(newSelections);
        setShowSelector(false);
    };

    const removeExercise = (index: number) => {
        const newList = [...selectedExercises];
        newList.splice(index, 1);
        setSelectedExercises(newList);
    };

    const toggleMetric = (index: number, field: keyof RoutineExerciseConfig) => {
        const newList = [...selectedExercises];
        (newList[index] as any)[field] = !(newList[index] as any)[field];
        setSelectedExercises(newList);
    };

    const handleSave = async () => {
        if (!user) return;
        if (!name.trim()) {
            alert('Ponle un nombre a tu rutina antes de guardar.');
            return;
        }
        if (selectedExercises.length === 0) {
            alert('Agrega al menos un ejercicio a tu rutina.');
            return;
        }

        // createRoutine resolves virtual-* IDs to real gym_equipment UUIDs
        // (exercise_id is a uuid FK — inserting raw virtual IDs failed the
        // whole batch silently and produced routines with 0 exercises) and
        // queues locally when offline.
        const richPayload = selectedExercises.map(ex => ({
            id: ex.exercise_id,
            name: ex.name,
            track_weight: ex.track_weight,
            track_reps: ex.track_reps,
            track_time: ex.track_time,
            track_pr: ex.track_pr,
            target_sets: ex.target_sets,
            target_reps_text: ex.target_reps_text,
            custom_metric: ex.custom_metric || null
        }));

        const result: any = await workoutService.createRoutine(user.id, name.trim(), richPayload, null);

        if (result?.error || !result?.data) {
            alert('Error al crear la rutina: ' + (result?.error?.message || 'desconocido'));
            return;
        }
        navigate(-1);
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-6 pb-24">
            <header className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="p-2 bg-neutral-900 rounded-full text-neutral-400 hover:text-white">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-2xl font-bold italic">DISEÑAR ESTRATEGIA</h1>
            </header>

            <div className="space-y-6 max-w-2xl mx-auto">
                <div>
                    <label className="block text-neutral-500 text-sm mb-2 font-bold uppercase tracking-wider">Nombre de la Rutina</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Push Day: Destructor de Pecho"
                        className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-xl p-4 focus:ring-2 focus:ring-gym-primary/50 outline-none font-bold text-lg"
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-neutral-500 text-sm font-bold uppercase tracking-wider">Secuencia de Ejercicios</label>
                        <button
                            onClick={() => {
                                setSelectedCatalogItems(new Set(selectedExercises.map(ex => ex.exercise_id)));
                                setShowSelector(true);
                            }}
                            className="text-gym-primary text-sm font-bold hover:underline flex items-center gap-1"
                        >
                            <Plus size={16} /> AGREGAR EJERCICIO
                        </button>
                    </div>

                    {selectedExercises.map((ex, idx) => (
                        <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 relative animate-in slide-in-from-bottom-2">
                            <button onClick={() => removeExercise(idx)} className="absolute top-4 right-4 text-neutral-600 hover:text-red-500">
                                <Trash2 size={18} />
                            </button>

                            <h3 className="font-bold text-lg pr-8 mb-4">{ex.name}</h3>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                {([
                                    { field: 'track_weight', icon: <Dumbbell size={20} />, label: 'PESO' },
                                    { field: 'track_reps',   icon: <Hash size={20} />,    label: 'REPS' },
                                    { field: 'track_time',   icon: <Clock size={20} />,   label: 'TIEMPO' },
                                    { field: 'track_pr',     icon: <Trophy size={20} />,  label: 'TRACK PR' },
                                ] as const).map(({ field, icon, label }) => (
                                    <button
                                        key={field}
                                        onClick={() => toggleMetric(idx, field)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${(ex as any)[field] ? 'bg-gym-primary/10 border-gym-primary text-gym-primary' : 'bg-neutral-800 border-transparent text-neutral-500 hover:bg-neutral-700'}`}
                                    >
                                        {icon}
                                        <span className="text-xs font-bold mt-1">{label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Series Objetivo</label>
                                    <input
                                        type="number"
                                        value={ex.target_sets}
                                        onChange={(e) => { const l = [...selectedExercises]; l[idx].target_sets = parseInt(e.target.value); setSelectedExercises(l); }}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-[16px] text-center font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Reps/Tiempo</label>
                                    <input
                                        type="text"
                                        value={ex.target_reps_text}
                                        onChange={(e) => { const l = [...selectedExercises]; l[idx].target_reps_text = e.target.value; setSelectedExercises(l); }}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-[16px] text-center font-bold"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    {selectedExercises.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-neutral-800 rounded-2xl text-neutral-600">
                            <Dumbbell size={40} className="mx-auto mb-3 opacity-20" />
                            <p className="font-medium">Tu estrategia está vacía.</p>
                            <p className="text-sm">Agrega ejercicios para comenzar.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="fixed bottom-6 left-0 right-0 px-6">
                <button
                    onClick={handleSave}
                    className="w-full max-w-2xl mx-auto bg-gym-primary text-black font-black italic text-lg py-4 rounded-xl shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                    <Save size={20} />
                    GUARDAR RUTINA MAESTRA
                </button>
            </div>

            {showSelector && (
                <CatalogModal
                    selected={selectedCatalogItems}
                    onToggle={handleCatalogToggle}
                    onClose={() => {
                        setSelectedCatalogItems(new Set());
                        setShowSelector(false);
                    }}
                    onConfirm={handleBatchAdd}
                />
            )}
        </div>
    );
};
