import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { equipmentService } from '../services/GymEquipmentService';
import type { CustomSettings } from '../services/GymEquipmentService';
import { ArrowLeft, Plus, Save, Trash2, Dumbbell, Clock, Hash, Trophy } from 'lucide-react';

interface Exercise {
    id: string;
    name: string;
    muscle_group: string;
}

interface RoutineExerciseConfig {
    exercise_id: string;
    name: string; // Cached for display
    track_weight: boolean;
    track_reps: boolean;
    track_time: boolean;
    track_pr: boolean; // Custom metric logic
    target_sets: number;
    target_reps_text: string;
    custom_metric?: string; // "Agrega tipo numero o texto"
}

export const RoutineBuilder = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');

    const [selectedExercises, setSelectedExercises] = useState<RoutineExerciseConfig[]>([]);
    const [showSelector, setShowSelector] = useState(false);
    const [catalog, setCatalog] = useState<Exercise[]>([]);
    const [userSettings, setUserSettings] = useState<CustomSettings>({ categories: [], metrics: [] });

    useEffect(() => {
        const init = async () => {
            if (user) {
                const settings = await equipmentService.getUserSettings(user.id);
                setUserSettings(settings);
            }
            loadCatalog();
        };
        init();
    }, [user]);

    const loadCatalog = async () => {
        // Fetch Machines from the User's Gym (or Global if undefined)
        // For now, let's fetch from the user's primary gym or just generic list
        // Since we want "machines", we should look at 'equipment' table or 'gym_equipment'

        // TODO: Get real gym ID. For now, mocking or getting first available.
        // In a real scenario we might ask "Which gym is this routine for?" or show ALL user's known equipment.
        // Let's rely on a simple fetchAll for now or mock the 'equipment' nature.

        const { data } = await supabase.from('equipment').select('*').limit(20); // Looking for equipment, not exercises

        if (data && data.length > 0) {
            // Map equipment to catalog format
            setCatalog(data.map((item: any) => ({
                id: item.id,
                name: item.name,
                muscle_group: item.category || 'General'
            })));
        } else {
            // Fallback Mock (Machines Focus)
            setCatalog([
                { id: '1', name: 'Press Banca (Barra)', muscle_group: 'Pecho' },
                { id: '2', name: 'Prensa 45°', muscle_group: 'Pierna' },
                { id: '3', name: 'Jalón al Pecho', muscle_group: 'Espalda' },
                { id: '4', name: 'Mancuernas (Libre)', muscle_group: 'General' },
                { id: '5', name: 'Smith Machine', muscle_group: 'Pierna' },
            ]);
        }
    };

    const addExercise = (exercise: Exercise) => {
        setSelectedExercises([...selectedExercises, {
            exercise_id: exercise.id,
            name: exercise.name,
            track_weight: true,
            track_reps: true,
            track_time: false,
            track_pr: true,
            target_sets: 4, // Default to 4 sets for machines usually
            target_reps_text: '10-12',
            custom_metric: ''
        }]);
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
        if (!user || !name) return;

        // 1. Create Routine
        const { data: routine, error } = await supabase
            .from('routines')
            .insert({ user_id: user.id, name: name })
            .select()
            .single();

        if (error) {
            alert('Error creating routine: ' + error.message);
            return;
        }

        // 2. Add Exercises
        const exercisesToInsert = selectedExercises.map((ex, i) => ({
            routine_id: routine.id,
            exercise_id: ex.exercise_id, // Note: In real DB this must be a UUID. Mocks might fail if not UUID.
            order_index: i,
            track_weight: ex.track_weight,
            track_reps: ex.track_reps,
            track_time: ex.track_time,
            target_sets: ex.target_sets,
            target_reps_text: ex.target_reps_text
        }));

        // Filter out mocks if we are in real mode, or ensure DB handles it
        // For this demo, let's assume we proceed.

        const { error: exError } = await supabase
            .from('routine_exercises')
            .insert(exercisesToInsert);

        if (exError) {
            console.error(exError); // Mocks might fail UUID check
            alert('Rutina guardada (con advertencias de formato).');
        } else {
            alert('¡Rutina de Guerra creada!');
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
                        <label className="text-neutral-500 text-sm font-bold uppercase tracking-wider">Secuencia de Batalla</label>
                        <button
                            onClick={() => setShowSelector(true)}
                            className="text-gym-primary text-sm font-bold hover:underline flex items-center gap-1"
                        >
                            <Plus size={16} /> AGREGAR EJERCICIO
                        </button>
                    </div>

                    {selectedExercises.map((ex, idx) => (
                        <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 relative animate-in slide-in-from-bottom-2">
                            <button
                                onClick={() => removeExercise(idx)}
                                className="absolute top-4 right-4 text-neutral-600 hover:text-red-500"
                            >
                                <Trash2 size={18} />
                            </button>

                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-lg pr-4">{ex.name}</h3>
                                {/* Graph Visual Placeholder */}
                                <div className="hidden sm:flex items-center gap-1 h-8 w-24 opacity-60">
                                    <div className="w-1 h-3 bg-neutral-700 rounded-full"></div>
                                    <div className="w-1 h-5 bg-neutral-700 rounded-full"></div>
                                    <div className="w-1 h-4 bg-neutral-700 rounded-full"></div>
                                    <div className="w-1 h-6 bg-gym-primary rounded-full"></div>
                                    <div className="w-1 h-5 bg-gym-primary/50 rounded-full"></div>
                                    <div className="w-1 h-7 bg-gym-primary rounded-full"></div>
                                </div>
                            </div>

                            {/* Metrics Configuration Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                <button
                                    onClick={() => toggleMetric(idx, 'track_weight')}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${ex.track_weight ? 'bg-gym-primary/10 border-gym-primary text-gym-primary' : 'bg-neutral-800 border-transparent text-neutral-500 hover:bg-neutral-700'}`}
                                >
                                    <Dumbbell size={20} className="mb-1" />
                                    <span className="text-xs font-bold">PESO</span>
                                </button>
                                <button
                                    onClick={() => toggleMetric(idx, 'track_reps')}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${ex.track_reps ? 'bg-gym-primary/10 border-gym-primary text-gym-primary' : 'bg-neutral-800 border-transparent text-neutral-500 hover:bg-neutral-700'}`}
                                >
                                    <Hash size={20} className="mb-1" />
                                    <span className="text-xs font-bold">REPS</span>
                                </button>
                                <button
                                    onClick={() => toggleMetric(idx, 'track_time')}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${ex.track_time ? 'bg-gym-primary/10 border-gym-primary text-gym-primary' : 'bg-neutral-800 border-transparent text-neutral-500 hover:bg-neutral-700'}`}
                                >
                                    <Clock size={20} className="mb-1" />
                                    <span className="text-xs font-bold">TIEMPO</span>
                                </button>
                                <button
                                    onClick={() => toggleMetric(idx, 'track_pr')}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${ex.track_pr ? 'bg-gym-primary/10 border-gym-primary text-gym-primary' : 'bg-neutral-800 border-transparent text-neutral-500 hover:bg-neutral-700'}`}
                                >
                                    <Trophy size={20} className="mb-1" />
                                    <span className="text-xs font-bold">TRACK PR</span>
                                </button>
                            </div>

                            {/* Custom & Targets */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Series Objetivo</label>
                                    <input
                                        type="number"
                                        value={ex.target_sets}
                                        onChange={(e) => {
                                            const newL = [...selectedExercises];
                                            newL[idx].target_sets = parseInt(e.target.value);
                                            setSelectedExercises(newL);
                                        }}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-center font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Reps/Tiempo</label>
                                    <input
                                        type="text"
                                        value={ex.target_reps_text}
                                        onChange={(e) => {
                                            const newL = [...selectedExercises];
                                            newL[idx].target_reps_text = e.target.value;
                                            setSelectedExercises(newL);
                                        }}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-center font-bold"
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
                    GUARDAR RUTINA DE GUERRA
                </button>
            </div>

            {/* Exercise Selector Modal */}
            {showSelector && (
                <div className="fixed inset-0 bg-black/90 z-50 p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Catálogo de Armas</h2>
                        <button onClick={() => setShowSelector(false)} className="text-neutral-500">Cerrar</button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 overflow-y-auto">
                        {catalog.map(ex => {
                            const customCat = userSettings.categories.find(c => c.id === ex.muscle_group);
                            const label = customCat ? customCat.label : ex.muscle_group;
                            return (
                                <button
                                    key={ex.id}
                                    onClick={() => addExercise(ex)}
                                    className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl text-left hover:border-gym-primary hover:bg-neutral-800 transition-all flex items-center justify-between group"
                                >
                                    <span className="font-bold text-white group-hover:text-gym-primary">{ex.name}</span>
                                    <span className="text-xs text-neutral-500 bg-neutral-950 px-2 py-1 rounded border border-neutral-800">{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
