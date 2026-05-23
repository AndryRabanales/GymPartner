import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { equipmentService } from '../services/GymEquipmentService';
import { userService } from '../services/UserService';
import type { CustomSettings, Equipment } from '../services/GymEquipmentService';
import { ArrowLeft, Plus, Save, Trash2, Dumbbell, Clock, Hash, Trophy, Search, X, Check, Map as MapIcon } from 'lucide-react';
import { ArsenalGrid } from '../components/arsenal/ArsenalGrid';

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

    // NEW: Search & Muscle filter states for the premium selector format
    const [searchTerm, setSearchTerm] = useState('');
    const [activeMuscleFilter, setActiveMuscleFilter] = useState<string | null>(null);
    const [selectedCatalogItems, setSelectedCatalogItems] = useState<Set<string>>(new Set());
    const catalogScrollRef = useRef<HTMLDivElement>(null);

    const { id } = useParams<{ id: string }>(); // Get ID from URL

    // ... logic ...

    useEffect(() => {
        const init = async () => {
            if (user) {
                const settings = await equipmentService.getUserSettings(user.id);
                setUserSettings(settings);
            }
            await loadCatalog();

            // NEW: Load existing routine if ID is present
            if (id) {
                await loadRoutineForEdit(id);
            }
        };
        init();
    }, [user, id]);

    const loadRoutineForEdit = async (routineId: string) => {
        try {
            // We use the same service as the Profile View, which already has the fallback logic!
            const routine = await userService.getRoutineDetails(routineId);

            if (routine) {
                setName(routine.name);

                // Map to Builder Format
                if (routine.exercises) {
                    console.log("Found exercises to map:", routine.exercises);
                    const mappedExercises: RoutineExerciseConfig[] = routine.exercises.map((ex: any) => ({
                        exercise_id: ex.exercise_id,
                        name: ex.name, // The service already hydrated this name!
                        track_weight: ex.track_weight,
                        track_reps: ex.track_reps,
                        track_time: ex.track_time,
                        track_pr: ex.track_pr,
                        target_sets: ex.target_sets || 4,
                        target_reps_text: ex.target_reps_text || '10-12',
                        custom_metric: ex.custom_metric || ''
                    }));
                    console.log("Mapped Exercises for State:", mappedExercises);
                    setSelectedExercises(mappedExercises);
                } else {
                    console.warn("Routine has no exercises array:", routine);
                }
            }
        } catch (err) {
            console.error("Error loading routine for edit:", err);
        }
    };

    const loadCatalog = async () => {
        try {
            // 1. Fetch User's Custom Equipment
            const { data: customData } = await supabase
                .from('gym_equipment')
                .select('*')
                .limit(50);

            // 2. Fetch Global Seed Exercises
            const { data: globalData } = await supabase
                .from('exercises')
                .select('id, name, target_muscle')
                .limit(100);

            let combinedCatalog: Exercise[] = [];

            // Map Custom
            if (customData) {
                combinedCatalog = [...combinedCatalog, ...customData.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    muscle_group: item.category || 'General'
                }))];
            }

            // Map Global
            if (globalData) {
                combinedCatalog = [...combinedCatalog, ...globalData.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    muscle_group: item.target_muscle || 'General'
                }))];
            }

            // If empty, fallback
            if (combinedCatalog.length === 0) {
                setCatalog([
                    { id: '1', name: 'Press Banca (Barra)', muscle_group: 'Pecho' },
                    { id: '2', name: 'Prensa 45°', muscle_group: 'Pierna' },
                    { id: '3', name: 'Jalón al Pecho', muscle_group: 'Espalda' },
                ]);
            } else {
                // Deduplicate by ID just in case
                const uniqueCatalog = Array.from(new Map(combinedCatalog.map(item => [item.id, item])).values());
                setCatalog(uniqueCatalog);
            }

        } catch (error) {
            console.error("Error loading full catalog:", error);
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

    const scrollToCategory = (category: string) => {
        setActiveMuscleFilter(category);
        setTimeout(() => {
            const element = document.getElementById(`category-section-${category}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (catalogScrollRef.current) {
                catalogScrollRef.current.scrollTop = 0;
            }
        }, 100);
    };

    const handleCatalogToggle = (itemId: string) => {
        setSelectedCatalogItems(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    };

    const handleBatchAdd = () => {
        const newSelections: RoutineExerciseConfig[] = [];
        
        // 1. Keep existing configurations for exercises that are still selected
        selectedExercises.forEach(ex => {
            if (selectedCatalogItems.has(ex.exercise_id)) {
                newSelections.push(ex);
            }
        });
        
        // 2. Add newly selected exercises
        selectedCatalogItems.forEach(id => {
            if (!selectedExercises.some(ex => ex.exercise_id === id)) {
                const catalogItem = catalog.find(ex => ex.id === id);
                if (catalogItem) {
                    newSelections.push({
                        exercise_id: catalogItem.id,
                        name: catalogItem.name,
                        track_weight: true,
                        track_reps: true,
                        track_time: false,
                        track_pr: true,
                        target_sets: 4,
                        target_reps_text: '10-12',
                        custom_metric: ''
                    });
                }
            }
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
        if (!user || !name) return;

        // 1. Create Routine
        const { data: routine, error } = await supabase
            .from('routines')
            .insert({
                user_id: user.id,
                name: name,
                is_public: true // Force public for Viral Growth
            })
            .select()
            .single();

        if (error) {
            alert('Error creating routine: ' + error.message);
            return;
        }

        // 2. Add Exercises
        const exercisesToInsert = selectedExercises.map((ex, i) => ({
            routine_id: routine.id,
            exercise_id: ex.exercise_id,
            name: ex.name, // FIXED: Added missing cached name
            order_index: i,
            track_weight: ex.track_weight,
            track_reps: ex.track_reps,
            track_time: ex.track_time,
            target_sets: ex.target_sets,
            target_reps_text: ex.target_reps_text
        }));

        const { error: exError } = await supabase
            .from('routine_exercises')
            .insert(exercisesToInsert);

        if (exError) {
            console.error(exError);
            alert('Error al guardar ejercicios: ' + exError.message);
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
                    GUARDAR RUTINA MAESTRA
                </button>
            </div>

            {/* Exercise Selector Modal */}
            {showSelector && (() => {
                const categoryEnumMap: Record<string, string> = {
                    'pecho': 'CHEST',
                    'espalda': 'BACK',
                    'pierna': 'LEGS',
                    'hombro': 'SHOULDERS',
                    'triceps': 'ARMS',
                    'biceps': 'ARMS',
                    'antebrazo': 'FOREARMS',
                    'core': 'CHEST',
                    'cardio': 'CARDIO'
                };
                const CATALOG_ORDER = [
                    'PECHO', 'HOMBRO', 'TRÍCEPS',
                    'ESPALDA', 'BÍCEPS', 'ANTEBRAZO',
                    'CUÁDRICEPS', 'ISQUIOTIBIALES', 'GLÚTEOS', 'PANTORRILLAS', 'ADUCTORES',
                    'ABDOMINALES', 'LUMBARES', 'CUELLO', 'CARDIO'
                ];
                const mappedCatalog: Equipment[] = catalog.map(ex => {
                    const norm = ex.muscle_group.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                    const cat = categoryEnumMap[norm] || 'BACK';
                    return {
                        id: ex.id,
                        name: ex.name,
                        category: cat,
                        target_muscle_group: ex.muscle_group,
                        quantity: 1,
                        status: 'ACTIVE' as const
                    };
                });

                return (
                    <div className="fixed inset-0 bg-black/95 z-50 p-4 sm:p-6 flex flex-col animate-in fade-in duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-wider text-white">Catálogo de Ejercicios</h2>
                                <p className="text-neutral-500 text-xs sm:text-sm">Selecciona los ejercicios que compondrán tu rutina maestra.</p>
                            </div>
                            <button
                                onClick={() => setShowSelector(false)}
                                className="bg-neutral-900 p-2.5 rounded-full text-white hover:bg-neutral-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-3.5 text-neutral-500" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar ejercicio o músculo..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-850 rounded-xl py-3.5 pl-10 pr-4 text-white focus:outline-none focus:border-gym-primary transition-all font-bold text-sm"
                                autoFocus
                            />
                        </div>

                        {/* Muscle Filter Bar */}
                        <div className="flex gap-2 overflow-x-auto py-2 px-1 mb-4 no-scrollbar scroll-smooth items-center min-h-[50px]">
                            {/* --- RAMA: PECHO --- */}
                            <button
                                onClick={() => scrollToCategory("PECHO")}
                                className={`shrink-0 px-5 py-2 rounded-xl text-xs font-black italic uppercase tracking-tighter transition-all border-2 ${activeMuscleFilter === "PECHO" ? 'bg-gym-primary text-black border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'bg-neutral-900 text-gym-primary border-neutral-800'}`}
                            >
                                PECHO
                            </button>
                            {["PECHO", "HOMBRO", "TRÍCEPS"].map(sub => (
                                <button
                                    key={sub}
                                    onClick={() => scrollToCategory(sub)}
                                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border ${activeMuscleFilter === sub ? 'bg-white text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}
                                >
                                    {sub}
                                </button>
                            ))}

                            <div className="w-px h-6 bg-neutral-800 mx-2 shrink-0" />

                            {/* --- RAMA: ESPALDA --- */}
                            <button
                                onClick={() => scrollToCategory("ESPALDA")}
                                className={`shrink-0 px-5 py-2 rounded-xl text-xs font-black italic uppercase tracking-tighter transition-all border-2 ${activeMuscleFilter === "ESPALDA" ? 'bg-gym-primary text-black border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'bg-neutral-900 text-gym-primary border-neutral-800'}`}
                            >
                                ESPALDA
                            </button>
                            {["ESPALDA", "BÍCEPS", "ANTEBRAZO"].map(sub => (
                                <button
                                    key={sub}
                                    onClick={() => scrollToCategory(sub)}
                                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border ${activeMuscleFilter === sub ? 'bg-white text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}
                                >
                                    {sub}
                                </button>
                            ))}

                            <div className="w-px h-6 bg-neutral-800 mx-2 shrink-0" />

                            {/* --- RAMA: PIERNA --- */}
                            <button
                                onClick={() => scrollToCategory("PIERNA")}
                                className={`shrink-0 px-5 py-2 rounded-xl text-xs font-black italic uppercase tracking-tighter transition-all border-2 ${activeMuscleFilter === "PIERNA" ? 'bg-gym-primary text-black border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'bg-neutral-900 text-gym-primary border-neutral-800'}`}
                            >
                                PIERNA
                            </button>
                            {["CUÁDRICEPS", "ISQUIOTIBIALES", "GLÚTEOS", "PANTORRILLAS", "ADUCTORES"].map(sub => (
                                <button
                                    key={sub}
                                    onClick={() => scrollToCategory(sub)}
                                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border ${activeMuscleFilter === sub ? 'bg-white text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}
                                >
                                    {sub}
                                </button>
                            ))}

                            <div className="w-px h-6 bg-neutral-800 mx-2 shrink-0" />

                            {/* --- RAMA: CORE --- */}
                            <button
                                onClick={() => scrollToCategory("CORE")}
                                className={`shrink-0 px-5 py-2 rounded-xl text-xs font-black italic uppercase tracking-tighter transition-all border-2 ${activeMuscleFilter === "CORE" ? 'bg-gym-primary text-black border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'bg-neutral-900 text-gym-primary border-neutral-800'}`}
                            >
                                CORE
                            </button>
                            {["ABDOMINALES", "LUMBARES", "CUELLO"].map(sub => (
                                <button
                                    key={sub}
                                    onClick={() => scrollToCategory(sub)}
                                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border ${activeMuscleFilter === sub ? 'bg-white text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}
                                >
                                    {sub}
                                </button>
                            ))}

                            <div className="w-px h-6 bg-neutral-800 mx-2 shrink-0" />

                            {/* --- CARDIO --- */}
                            <button
                                onClick={() => scrollToCategory("CARDIO")}
                                className={`shrink-0 px-5 py-2 rounded-xl text-xs font-black italic uppercase tracking-tighter transition-all border-2 ${activeMuscleFilter === "CARDIO" ? 'bg-gym-primary text-black border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'bg-neutral-900 text-gym-primary border-neutral-800'}`}
                            >
                                CARDIO
                            </button>
                        </div>

                        {/* Grid */}
                        <div ref={catalogScrollRef} className="flex-1 overflow-y-auto px-1 pb-32 bg-black/40 rounded-2xl border border-neutral-900/60 p-4">
                            <ArsenalGrid
                                inventory={mappedCatalog}
                                selectedItems={selectedCatalogItems}
                                userSettings={userSettings}
                                searchTerm={searchTerm}
                                onToggleSelection={handleCatalogToggle}
                                onOpenCatalog={() => { }}
                                onEditItem={() => { }}
                                sectionOrder={CATALOG_ORDER}
                                gridClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2"
                            />
                        </div>

                        {/* Floating Action Button for batch confirms */}
                        {selectedCatalogItems.size > 0 && (
                            <div className="fixed bottom-6 left-0 right-0 px-6 flex justify-center pointer-events-none z-[100]">
                                <button
                                    onClick={handleBatchAdd}
                                    className="pointer-events-auto bg-gym-primary text-black font-black uppercase py-4 px-12 rounded-2xl shadow-[0_10px_40px_rgba(250,204,21,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 text-lg border-2 border-yellow-400 animate-in slide-in-from-bottom-4 duration-300"
                                >
                                    <Check size={24} strokeWidth={3} />
                                    CONFIRMAR ({selectedCatalogItems.size})
                                </button>
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
};
