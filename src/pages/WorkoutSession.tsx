import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Equipment, CustomSettings } from '../services/GymEquipmentService';
import { equipmentService, EQUIPMENT_CATEGORIES } from '../services/GymEquipmentService';
import { userService } from '../services/UserService';
import { workoutService } from '../services/WorkoutService';
import { WorkoutCarousel } from '../components/workout/WorkoutCarousel';
import { SmartNumpad } from '../components/ui/SmartNumpad';

interface NumpadTarget {
    exerciseIndex: number;
    setIndex: number;
    field: string; // 'weight' | 'reps' | ...
    value: string | number;
    label: string;
    suggestion?: number;
}
// BattleTimer removed
import { Plus, Save, Swords, Trash2, Flame, Loader, Check, ArrowLeft, MoreVertical, X, RotateCcw } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

interface WorkoutSet {
    id: string; // Temporary ID for UI
    weight: number;
    reps: number;
    time?: number;     // Seconds
    distance?: number; // Meters
    rpe?: number;      // 1-10
    custom?: Record<string, number>; // Dynamic metrics (jumps, cadence, etc.)
    completed: boolean;
    db_id?: string; // Real DB ID if saved
}

interface WorkoutExercise {
    id: string; // Temp UI ID
    equipmentId: string;
    equipmentName: string;
    metrics: {
        weight: boolean;
        reps: boolean;
        time: boolean;
        distance: boolean;
        rpe: boolean;
    };
    sets: WorkoutSet[];
    category?: string; // SNAPSHOT: For history persistence
}

export const WorkoutSession = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { gymId: routeGymId } = useParams<{ gymId: string }>();

    // State
    const [loading, setLoading] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [activeExercises, setActiveExercises] = useState<WorkoutExercise[]>([]);
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [arsenal, setArsenal] = useState<Equipment[]>([]);
    const [routines, setRoutines] = useState<any[]>([]); // NEW: Local Routines
    const [showAddModal, setShowAddModal] = useState(false);
    const [resolvedGymId, setResolvedGymId] = useState<string | null>(null);
    const [showExitMenu, setShowExitMenu] = useState(false);

    // Numpad State
    const [showNumpad, setShowNumpad] = useState(false);
    const [numpadTarget, setNumpadTarget] = useState<NumpadTarget | null>(null);

    const handleNumpadOpen = (exIndex: number, sIndex: number, field: string, currentValue: number, label: string) => {
        // Find last valid value for suggestion (Smart Chip)
        // For now simple logic: check previous set or 0
        let suggestion = 0;
        if (sIndex > 0) {
            // @ts-ignore
            suggestion = activeExercises[exIndex].sets[sIndex - 1][field] || 0;
        } else {
            // Check history? Not implemented yet efficiently here.
            suggestion = 0;
        }

        setNumpadTarget({
            exerciseIndex: exIndex,
            setIndex: sIndex,
            field,
            value: currentValue || '',
            label,
            suggestion
        });
        setShowNumpad(true);
    };

    const [userSettings, setUserSettings] = useState<CustomSettings>({ categories: [], metrics: [] });

    // Timer State (RESTORED)
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [elapsedTime, setElapsedTime] = useState("00:00");
    const [isFinished, setIsFinished] = useState(false);

    // Timer Effect (RESTORED)
    useEffect(() => {
        if (!startTime || isFinished) return;

        const tick = () => {
            const now = new Date();
            const diff = Math.max(0, now.getTime() - new Date(startTime).getTime());

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            if (hours > 0) {
                setElapsedTime(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            } else {
                setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }
        };

        tick(); // Immediate update
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [startTime, isFinished]);

    // Init Logic
    useEffect(() => {
        if (!user) return;
        initializeBattle(user.id);
    }, [user, routeGymId]);

    const initializeBattle = async (userId: string) => {
        if (!userId) {
            console.error('❌ userId is NULL or undefined!');
            alert('Error: No se pudo autenticar al usuario');
            navigate('/login');
            return;
        }

        console.log('🎯 Iniciando batalla para user:', userId);

        try {
            // 1. Resolve Gym
            let targetGymId = routeGymId;
            if (!targetGymId) {
                const gyms = await userService.getUserGyms(userId);
                const gym = gyms.find(g => g.is_home_base) || gyms[0];
                targetGymId = gym?.gym_id;
            }

            // Fallback: If no physical gym, use Personal Virtual Gym (Fix for Global Users)
            if (!targetGymId) {
                try {
                    targetGymId = await userService.ensurePersonalGym(userId);
                    console.log("Using Personal Gym for Battle:", targetGymId);
                } catch (e) {
                    console.warn("Could not resolve personal gym");
                }
            }

            if (!targetGymId) {
                console.warn("No gym found for battle.");
                navigate('/');
                return;
            }
            setResolvedGymId(targetGymId);

            // 2. Load Inventory, Routines AND Custom Settings
            const [items, localRoutines, settings] = await Promise.all([
                equipmentService.getInventory(targetGymId),
                workoutService.getUserRoutines(userId, targetGymId),
                equipmentService.getUserSettings(userId)
            ]);

            setArsenal(items);
            setRoutines(localRoutines);
            setUserSettings(settings);

            // 3. Start or Resume Session
            const active = await workoutService.getActiveSession(userId);

            if (active) {
                console.log('♻️ Sesión activa encontrada:', active.id);
                setSessionId(active.id);
                setStartTime(new Date(active.started_at)); // Set Start Time (RESTORED)
            } else {
                console.log('✨ No hay sesión activa. Preparando nueva batalla.');
                setSessionId(null);
                setStartTime(null);
                setElapsedTime("00:00");
                setActiveExercises([]);
                setIsFinished(false);
            }

        } catch (error) {
            console.error('❌ Error en initializeBattle:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadRoutine = async (routine: any) => {
        if (!routine.equipment_ids || routine.equipment_ids.length === 0) return;

        setLoading(true); // Show loading while starting session

        // 1. STAR SESSION IF NOT ACTIVE
        if (!sessionId && user) {
            console.log("🚀 Starting new session for routine:", routine.name);
            const { data: newSession, error } = await workoutService.startSession(user.id, resolvedGymId || undefined);

            if (newSession) {
                setSessionId(newSession.id);
                setStartTime(new Date()); // Start timer NOW from client time (00:00)
                setIsFinished(false); // Ensure timer is running
            } else {
                console.error("Failed to start session:", error);
                alert("Error iniciando sesión de entrenamiento. Revisa tu conexión.");
                setLoading(false);
                return;
            }
        }

        // Map Routine IDs to Actual Inventory Items
        const exercisesToAdd: WorkoutExercise[] = [];
        const missingExercises: string[] = [];

        const details = routine.routine_exercises || [];

        // Helper to get default metrics
        const defaultMetrics = { weight: true, reps: true, time: false, distance: false, rpe: false };

        // Helper to normalize names for better matching
        const normalizeName = (name: string) => {
            return name
                .toLowerCase()
                .trim()
                .normalize('NFD') // Decompose accented characters
                .replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[^a-z0-9\s]/g, '') // Remove special characters
                .replace(/\s+/g, ' '); // Normalize spaces
        };

        if (details.length > 0) {
            details.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)).forEach((detail: any) => {
                // 1. Try Strict ID Match
                let item = arsenal.find(i => i.id === detail.exercise_id);

                // 2. Fallback: Normalized Name Match
                if (!item && detail.equipment?.name) {
                    const targetName = normalizeName(detail.equipment.name);
                    item = arsenal.find(i => normalizeName(i.name) === targetName);
                }

                // 3. Fallback: Partial Name Match (fuzzy)
                if (!item && detail.equipment?.name) {
                    const targetName = normalizeName(detail.equipment.name);
                    item = arsenal.find(i => {
                        const itemName = normalizeName(i.name);
                        return itemName.includes(targetName) || targetName.includes(itemName);
                    });
                }

                if (item) {
                    // Combine detail override (if any) with item metrics
                    const baseMetrics = {
                        ...(item.metrics || {}),
                        ...(detail.equipment?.metrics || {}), // Merge from DB detail too
                        ...defaultMetrics // Fallback
                    };

                    console.log(`🔧 Loading Metrics for ${item.name}:`, baseMetrics);

                    const metrics = {
                        ...baseMetrics,
                        weight: detail.track_weight !== undefined ? detail.track_weight : baseMetrics.weight,
                        reps: detail.track_reps !== undefined ? detail.track_reps : baseMetrics.reps,
                        time: detail.track_time !== undefined ? detail.track_time : baseMetrics.time,
                        distance: detail.track_distance !== undefined ? detail.track_distance : baseMetrics.distance,
                        rpe: detail.track_rpe !== undefined ? detail.track_rpe : baseMetrics.rpe,
                    };

                    // Add custom metric from routine if exists
                    if (detail.custom_metric) {
                        // @ts-ignore
                        metrics[detail.custom_metric] = true;
                        console.log(`✨ Added Custom Routine Metric: ${detail.custom_metric}`);
                    }

                    // Initialize custom metrics
                    const customMetrics: Record<string, number> = {};
                    // Type cast metrics to any to iterate safely since it's a flexible object
                    const metricsObj = metrics as any || {};

                    Object.keys(metricsObj).forEach(mid => {
                        if (!['weight', 'reps', 'time', 'distance', 'rpe'].includes(mid) && metricsObj[mid]) {
                            customMetrics[mid] = 0;
                        }
                    });

                    exercisesToAdd.push({
                        id: Math.random().toString(),
                        equipmentId: item.id,
                        equipmentName: item.name,
                        metrics: metrics as any, // Cast to any to fix TS error
                        sets: [{
                            id: Math.random().toString(),
                            weight: 0,
                            reps: 0,
                            custom: customMetrics,
                            completed: false
                        }],
                        category: item.target_muscle_group || item.category || 'Custom'
                    });
                } else {
                    // FALLBACK: Ghost Exercise (Not in local inventory, but exists in routine)
                    // We allow it to run so the user can workout anywhere.
                    const ghostName = detail.equipment?.name || detail.name || 'Ejercicio Externo';
                    console.log(`👻 Creating Ghost Exercise: ${ghostName}`);

                    // FIX: Respect Routine Configuration even for Ghosts
                    const baseMetrics = detail.equipment?.metrics || defaultMetrics;
                    const ghostMetrics = {
                        ...baseMetrics,
                        weight: detail.track_weight !== undefined ? detail.track_weight : baseMetrics.weight,
                        reps: detail.track_reps !== undefined ? detail.track_reps : baseMetrics.reps,
                        time: detail.track_time !== undefined ? detail.track_time : baseMetrics.time,
                        distance: detail.track_distance !== undefined ? detail.track_distance : baseMetrics.distance,
                        rpe: detail.track_rpe !== undefined ? detail.track_rpe : baseMetrics.rpe,
                    };

                    // Add custom metric from routine if exists
                    if (detail.custom_metric) {
                        // @ts-ignore
                        ghostMetrics[detail.custom_metric] = true;
                    }

                    // Initialize custom metrics
                    const customMetrics: Record<string, number> = {};
                    // @ts-ignore
                    const metricsObj = ghostMetrics as any || {};

                    Object.keys(metricsObj).forEach(mid => {
                        if (!['weight', 'reps', 'time', 'distance', 'rpe'].includes(mid) && metricsObj[mid]) {
                            customMetrics[mid] = 0;
                        }
                    });

                    exercisesToAdd.push({
                        id: Math.random().toString(),
                        equipmentId: detail.exercise_id || Math.random().toString(),
                        equipmentName: ghostName,
                        metrics: ghostMetrics as any,
                        sets: [{
                            id: Math.random().toString(),
                            weight: 0,
                            reps: 0,
                            custom: customMetrics,
                            completed: false
                        }],
                        category: detail.equipment?.target_muscle_group || 'General'
                    });
                }
            });
        } else {
            // Fallback IDs only
            routine.equipment_ids.forEach((eqId: string) => {
                const item = arsenal.find(i => i.id === eqId);
                if (item) {
                    exercisesToAdd.push({
                        id: Math.random().toString(),
                        equipmentId: item.id,
                        equipmentName: item.name,
                        metrics: (item.metrics || defaultMetrics) as any,
                        sets: [{ id: Math.random().toString(), weight: 0, reps: 0, completed: false }],
                        category: item.target_muscle_group || item.category || 'Custom'
                    });
                } else {
                    missingExercises.push(`Ejercicio ID: ${eqId}`);
                }
            });
        }

        if (exercisesToAdd.length > 0) {
            setActiveExercises(exercisesToAdd);

            // Show warning if some exercises are missing, but allow continuing
            if (missingExercises.length > 0) {
                const missingList = missingExercises.join(', ');
                alert(`⚠️ Algunos ejercicios no están en este gimnasio:\n\n${missingList}\n\nPuedes continuar con los ${exercisesToAdd.length} ejercicios disponibles o agregar los faltantes a tu Arsenal.`);
            }
        } else {
            console.warn("No matching exercises found in this gym's arsenal.");
            const missingList = missingExercises.length > 0 ? `\n\nEjercicios faltantes:\n${missingExercises.join('\n')}` : '';
            alert(`⚠️ No se encontraron ejercicios de esta rutina en este gimnasio.${missingList}\n\nAgrega estos ejercicios a tu Arsenal Local para poder usar esta rutina.`);
        }

        setLoading(false);
    };
    const addExercise = (equipment: Equipment) => {
        const defaultMetrics = { weight: true, reps: true, time: false, distance: false, rpe: false };
        const newExercise: WorkoutExercise = {
            id: Math.random().toString(), // UI Key
            equipmentId: equipment.id,
            equipmentName: equipment.name,
            metrics: (equipment.metrics || defaultMetrics) as any,
            sets: [
                { id: Math.random().toString(), weight: 0, reps: 0, completed: false }
            ],
            category: equipment.target_muscle_group || equipment.category || 'Custom'
        };
        setActiveExercises([...activeExercises, newExercise]);
        setShowAddModal(false);
    };

    const removeExercise = (id: string) => {
        setActiveExercises(prev => prev.filter(e => e.id !== id));
    };

    const updateSet = (exerciseIndex: number, setIndex: number, field: string, value: string, isCustom: boolean = false) => {
        const updated = [...activeExercises];
        const val = parseFloat(value);

        if (isCustom) {
            if (!updated[exerciseIndex].sets[setIndex].custom) {
                updated[exerciseIndex].sets[setIndex].custom = {};
            }
            updated[exerciseIndex].sets[setIndex].custom![field] = isNaN(val) ? 0 : val;
        } else {
            // @ts-ignore
            updated[exerciseIndex].sets[setIndex][field] = isNaN(val) ? 0 : val;
        }

        setActiveExercises(updated);
    };

    const addSet = (exerciseIndex: number) => {
        const updated = [...activeExercises];
        const previousSet = updated[exerciseIndex].sets[updated[exerciseIndex].sets.length - 1];

        // Initialize custom metrics based on what's active in the settings
        const customMetrics: Record<string, number> = {};
        const activeIds = Object.keys(updated[exerciseIndex].metrics || {});

        activeIds.forEach(mid => {
            // standard metrics (weight, reps, time, distance, rpe) are handled separately
            if (!['weight', 'reps', 'time', 'distance', 'rpe'].includes(mid)) {
                customMetrics[mid] = previousSet?.custom?.[mid] || 0;
            }
        });

        updated[exerciseIndex].sets.push({
            id: Math.random().toString(),
            weight: previousSet ? previousSet.weight : 0,
            reps: previousSet ? previousSet.reps : 0,
            time: previousSet?.time || 0,
            distance: previousSet?.distance || 0,
            rpe: previousSet?.rpe || 0,
            custom: customMetrics,
            completed: false
        });
        setActiveExercises(updated);
    };




    // NEW: Handle Cancel
    const handleCancelSession = async () => {
        if (!sessionId) {
            navigate(-1);
            return;
        }
        if (window.confirm("¿Seguro que quieres cancelar? Se perderá todo el progreso de esta sesión.")) {
            setLoading(true);
            await workoutService.deleteSession(sessionId);
            setLoading(false);
            navigate(-1);
        }
    };

    // NEW: Handle Restart
    const handleRestartSession = async () => {
        if (!sessionId) return;
        if (window.confirm("¿Reiniciar entrenamiento? Se borrarán todas las series de hoy.")) {
            setLoading(true);
            await workoutService.deleteSession(sessionId);

            setSessionId(null);
            setStartTime(null);
            setElapsedTime("00:00");
            setIsFinished(false);

            setActiveExercises(prev => prev.map(ex => ({
                ...ex,
                sets: ex.sets.map(s => ({
                    ...s,
                    weight: 0,
                    reps: 0,
                    time: 0,
                    distance: 0,
                    rpe: 0,
                    custom: {},
                    completed: false
                }))
            })));

            const { data: newSession } = await workoutService.startSession(user!.id, resolvedGymId || undefined);
            if (newSession) {
                setSessionId(newSession.id);
                setStartTime(new Date());
            }

            setLoading(false);
            setShowExitMenu(false);
            setCurrentExerciseIndex(0);
        }
    };

    // Helper to resolve Exercise ID (Foreign Key for workout_logs)
    const resolveExerciseId = async (equipmentName: string): Promise<string | null> => {
        try {
            // 1. Try finding in 'exercises' table by name
            const { data: existing } = await supabase
                .from('exercises')
                .select('id')
                .ilike('name', equipmentName)
                .limit(1)
                .single();

            if (existing) return existing.id;

            // 2. If not found, create it in 'exercises'
            console.warn(`Creating new exercise entry for: ${equipmentName}`);
            const { data: newExercise, error } = await supabase
                .from('exercises')
                .insert({
                    name: equipmentName
                    // REMOVED target_muscle_group because it likely causes undefined_column error used against strict schema
                })
                .select()
                .single();

            if (error) {
                console.error("Error creating exercise:", error);
                return null;
            }

            return newExercise.id;
        } catch (err) {
            console.error("Exception resolving exercise ID:", err);
            return null;
        }
    };

    const handleFinish = async () => {
        setIsFinished(true); // STOP TIMER IMMEDIATELY
        if (!sessionId) {
            console.error('❌ No sessionId found!');
            // alert('Error: No hay sesión activa'); // Removed alert
            setIsFinished(false); // Resume if error
            return;
        }

        setLoading(true);
        console.log('🏁 Iniciando proceso de finalización...');

        // 💾 AUTO-SAVE: Save any unsaved sets that have data
        let savedCount = 0;
        const savePromises: Promise<any>[] = [];

        for (let i = 0; i < activeExercises.length; i++) {
            const exercise = activeExercises[i];

            // Resolve ID once per exercise if needed
            let exerciseDbId: string | null = null;

            // Function to get ID lazily
            const getExId = async () => {
                if (exerciseDbId) return exerciseDbId;
                exerciseDbId = await resolveExerciseId(exercise.equipmentName);
                return exerciseDbId;
            };

            for (let j = 0; j < exercise.sets.length; j++) {
                const set = exercise.sets[j];

                // If not completed but has data, SAVE IT!
                if (!set.completed && (set.weight > 0 || set.reps > 0 || (set.time || 0) > 0 || (set.distance || 0) > 0)) {
                    // We need the ID now
                    const targetId = await getExId();

                    if (targetId) {
                        console.log(`💾 Auto-saving set ${j + 1} for ${exercise.equipmentName} (ExID: ${targetId})...`);
                        // Ensure we have valid numbers
                        const weightToSave = Number(set.weight) || 0;
                        const repsToSave = Number(set.reps) || 0;
                        const timeToSave = Number(set.time) || 0;
                        const distanceToSave = Number(set.distance) || 0;

                        savePromises.push(workoutService.logSet({
                            session_id: sessionId,
                            exercise_id: targetId, // Use the resolved ID
                            set_number: j + 1,
                            sets: 1,
                            weight_kg: weightToSave,
                            reps: repsToSave,
                            time: timeToSave,
                            distance: distanceToSave,
                            rpe: Number(set.rpe) || undefined,
                            metrics_data: set.custom || {}, // Save custom metrics
                            category_snapshot: exercise.category || 'Custom', // SNAPSHOT: Current Category
                            is_pr: false
                        }));
                        savedCount++;
                    } else {
                        console.error(`❌ Failed to resolve ID for ${exercise.equipmentName}, skipping auto-save.`);
                    }
                }
            }
        }

        if (savedCount > 0) {
            console.log(`📦 Guardando ${savedCount} sets pendientes...`);
            await Promise.all(savePromises);
        }

        console.log('🏁 Terminando sesión en DB:', sessionId);

        try {
            const result = await workoutService.finishSession(sessionId, "Battle Finished");

            if (result.success) {
                console.log('✅ Sesión terminada exitosamente');
                // Removed blocking alert. 
                // We'll rely on the UI showing "Guardando..." or similar via loading state, 
                // or we could add a specific "Finished" state to show a success message briefly.
                // For now, let's just wait a moment so the user SEES the timer stopped.

                // Optional: Force update the local duration to ensure it matches exactly what we sent? 
                // Actually the backend sets the time. The difference is negligible.

                setTimeout(() => {
                    navigate('/history');
                }, 1500); // 1.5s delay to admire the frozen timer and "Saving" state
            } else {
                console.error('❌ Error terminando sesión:', result.error);
                // alert('❌ Error guardando entrenamiento: ' + JSON.stringify(result.error));
                setLoading(false);
                setIsFinished(false); // Resume timer if failed
            }
        } catch (error) {
            console.error('❌ Exception terminando sesión:', error);
            // alert('❌ Error inesperado: ' + error);
            setLoading(false);
            setIsFinished(false);
        }
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-black text-yellow-500">
            <div className="text-center">
                <Loader className="animate-spin mx-auto mb-4" size={48} />
                <h2 className="text-2xl font-black uppercase tracking-widest animate-pulse">Iniciando Protocolo</h2>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-neutral-950 text-white pb-32 relative overflow-hidden">
            {/* Background Ambient Effects */}
            <div className="fixed top-0 left-0 w-full h-1/2 bg-gradient-to-b from-red-900/10 to-transparent pointer-events-none" />

            {/* Header Removed as per user request */}

            <div className="p-4 relative z-10">
                {/* Empty State / Routine Selection */}
                {activeExercises.length === 0 && (
                    <div className="flex flex-col min-h-[60vh]">
                        <div className="mb-6 px-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="mb-4 p-2 bg-neutral-900 rounded-full text-neutral-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={24} />
                            </button>
                            <h2 className="text-3xl font-black italic uppercase text-white mb-2 tracking-tighter">Estrategia</h2>
                            <p className="text-neutral-400 text-sm">Selecciona un plan para desplegar en este territorio.</p>
                        </div>

                        {routines.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in slide-in-from-bottom-5">
                                <div className="bg-neutral-900/50 p-6 rounded-full border border-neutral-800 mb-6 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                                    <Swords size={64} className="text-neutral-600" strokeWidth={1} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">No hay estrategias</h3>
                                <p className="text-neutral-500 text-sm max-w-xs mx-auto mb-8">Este gimnasio no tiene rutinas asignadas aún.</p>

                                <Link
                                    to={`/territory/${resolvedGymId}/arsenal`}
                                    className="w-full bg-gym-primary hover:bg-yellow-400 text-black font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.3)] flex items-center justify-center gap-3 text-lg"
                                >
                                    <Plus size={20} strokeWidth={3} />
                                    CREAR RUTINA
                                </Link>
                            </div>
                        ) : (
                            <div className="flex-1 px-4 space-y-4 pb-32">
                                {routines.map(routine => (
                                    <button
                                        key={routine.id}
                                        onClick={() => loadRoutine(routine)}
                                        className="w-full bg-neutral-900 border border-neutral-800 hover:border-gym-primary p-6 rounded-2xl flex items-center justify-between group transition-all"
                                    >
                                        <div className="text-left">
                                            <h3 className="font-black text-xl text-white group-hover:text-gym-primary uppercase italic">{routine.name}</h3>
                                            <span className="text-neutral-500 text-xs font-bold">{routine.equipment_ids?.length || 0} Ejercicios</span>
                                        </div>
                                        <div className="bg-neutral-800 p-3 rounded-full group-hover:bg-gym-primary group-hover:text-black transition-colors">
                                            <Check size={20} strokeWidth={3} />
                                        </div>
                                    </button>
                                ))}

                                <div className="pt-8 space-y-4">
                                    <Link
                                        to={`/territory/${resolvedGymId}/arsenal`}
                                        className="w-full bg-neutral-900 border border-dashed border-neutral-700 hover:border-gym-primary text-neutral-400 hover:text-white font-bold uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Plus size={16} /> Crear Nueva Rutina
                                    </Link>

                                    {/* Freestyle Removed */}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Active Exercises List - NOW CAROUSEL */}
                {activeExercises.length > 0 && (
                    <div className="h-[calc(100vh-140px)] flex flex-col"> {/* Fixed height for carousel */}

                        {/* BATTLE HEADER & TIMER */}
                        <div className="flex items-center justify-between mb-2 px-4 shrink-0 relative">
                            {/* Replaced Title with Menu Options */}
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setShowExitMenu(!showExitMenu)}
                                    className="bg-neutral-900 p-2 rounded-full border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
                                >
                                    {showExitMenu ? <X size={20} /> : <MoreVertical size={20} />}
                                </button>
                                <span className="text-[10px] text-neutral-500 font-bold uppercase leading-tight max-w-[80px]">
                                    Cancelar / Reiniciar
                                </span>

                                {!showExitMenu && (
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">
                                            {currentExerciseIndex + 1} / {activeExercises.length}
                                        </h2>
                                    </div>
                                )}
                            </div>

                            {/* Timer */}
                            <div className="bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-full flex items-center gap-3 shadow-lg">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="font-mono font-bold text-xl text-white tracking-widest">{elapsedTime}</span>
                            </div>

                            {/* OPTION MENU OVERLAY */}
                            {showExitMenu && (
                                <div className="absolute top-14 left-4 z-50 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-2 w-48 flex flex-col gap-1 animate-in slide-in-from-top-2">
                                    <button
                                        onClick={handleRestartSession}
                                        className="flex items-center gap-3 w-full p-3 text-left text-sm font-bold text-white hover:bg-neutral-800 rounded-lg transition-colors"
                                    >
                                        <RotateCcw size={16} /> Reiniciar
                                    </button>
                                    <button
                                        onClick={handleCancelSession}
                                        className="flex items-center gap-3 w-full p-3 text-left text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <X size={16} /> Cancelar / Salir
                                    </button>
                                </div>
                            )}
                        </div>

                        <WorkoutCarousel
                            currentIndex={currentExerciseIndex}
                            onIndexChange={setCurrentExerciseIndex}
                        >
                            {activeExercises.map((exercise, mapIndex) => (
                                <div key={exercise.id} className="h-full flex flex-col bg-neutral-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl mx-1 relative">
                                    {/* Header */}
                                    <div className="p-4 flex justify-between items-start bg-white/5 border-b border-white/5 shrink-0">
                                        <div>
                                            <h3 className="text-2xl font-black italic uppercase text-white leading-tight">
                                                {exercise.equipmentName}
                                            </h3>
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    onClick={() => removeExercise(exercise.id)}
                                                    className="text-neutral-500 hover:text-red-500 transition-colors bg-neutral-800/50 p-2 rounded-lg"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sets Container - Scrollable part */}
                                    <div className="flex-1 overflow-y-auto p-2 pb-20">
                                        {/* Header Row REMOVED - Using individual input labels now */}

                                        <div className="space-y-2">
                                            {exercise.sets.map((set, setIndex) => {
                                                const isCompleted = set.completed;
                                                return (
                                                    <div
                                                        key={set.id}
                                                        className={`flex flex-wrap gap-2 p-3 rounded-xl transition-all duration-300 items-center ${isCompleted
                                                            ? 'bg-neutral-900/80 border border-green-500/20'
                                                            : 'bg-black/20 border border-transparent'
                                                            }`}
                                                    >
                                                        {/* Set Number */}
                                                        <div className="w-8 flex justify-center shrink-0 self-center">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isCompleted ? 'bg-green-500/20 text-green-500' : 'bg-neutral-800 text-neutral-400'
                                                                }`}>
                                                                {setIndex + 1}
                                                            </div>
                                                        </div>

                                                        {/* Inputs Container - Wraps on small screens */}
                                                        <div className="flex-1 flex flex-wrap gap-2 items-center min-w-0">

                                                            {exercise.metrics.weight && (
                                                                <div className="flex-1 min-w-[80px] max-w-[120px]">
                                                                    <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1">PESO</label>
                                                                    <input
                                                                        type="text"
                                                                        readOnly
                                                                        inputMode="none"
                                                                        value={set.weight === 0 ? '' : set.weight}
                                                                        onClick={() => handleNumpadOpen(mapIndex, setIndex, 'weight', set.weight, 'PESO (KG)')}
                                                                        className={`w-full bg-neutral-800 text-center font-black text-xl rounded-lg py-2 focus:ring-2 focus:ring-gym-primary outline-none transition-all cursor-pointer select-none caret-transparent ${isCompleted ? 'text-neutral-500' : 'text-white'}`}
                                                                        placeholder="0"
                                                                    />
                                                                </div>
                                                            )}
                                                            {exercise.metrics.reps && (
                                                                <div className="flex-1 min-w-[80px] max-w-[120px]">
                                                                    <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1">REPS</label>
                                                                    <input
                                                                        type="text"
                                                                        readOnly
                                                                        inputMode="none"
                                                                        value={set.reps === 0 ? '' : set.reps}
                                                                        onClick={() => handleNumpadOpen(mapIndex, setIndex, 'reps', set.reps, 'REPETICIONES')}
                                                                        className={`w-full bg-neutral-800 text-center font-black text-xl rounded-lg py-2 focus:ring-2 focus:ring-gym-primary outline-none transition-all cursor-pointer select-none caret-transparent ${isCompleted ? 'text-neutral-500' : 'text-white'}`}
                                                                        placeholder="0"
                                                                    />
                                                                </div>
                                                            )}
                                                            {exercise.metrics.time && (
                                                                <div className="flex-1 min-w-[80px] max-w-[120px]">
                                                                    <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1">TIEMPO (s)</label>
                                                                    <input
                                                                        type="text"
                                                                        readOnly
                                                                        inputMode="none"
                                                                        value={set.time || ''}
                                                                        onClick={() => handleNumpadOpen(mapIndex, setIndex, 'time', set.time || 0, 'TIEMPO (S)')}
                                                                        className="w-full bg-neutral-800 text-center font-bold text-lg rounded-lg py-2 text-white cursor-pointer select-none caret-transparent placeholder-white/20"
                                                                        placeholder="0s"
                                                                    />
                                                                </div>
                                                            )}
                                                            {exercise.metrics.distance && (
                                                                <div className="flex-1 min-w-[80px] max-w-[120px]">
                                                                    <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1">DIST (m)</label>
                                                                    <input
                                                                        type="text"
                                                                        readOnly
                                                                        inputMode="none"
                                                                        value={set.distance === 0 ? '' : set.distance}
                                                                        onClick={() => handleNumpadOpen(mapIndex, setIndex, 'distance', set.distance || 0, 'DISTANCIA (M)')}
                                                                        className="w-full bg-neutral-800 text-center font-bold text-lg rounded-lg py-2 text-white cursor-pointer select-none caret-transparent placeholder-white/20"
                                                                        placeholder="0m"
                                                                    />
                                                                </div>
                                                            )}
                                                            {exercise.metrics.rpe && (
                                                                <div className="flex-1 min-w-[60px] max-w-[80px]">
                                                                    <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1">RPE</label>
                                                                    <input
                                                                        type="text"
                                                                        readOnly
                                                                        inputMode="none"
                                                                        value={set.rpe || ''}
                                                                        onClick={() => handleNumpadOpen(mapIndex, setIndex, 'rpe', set.rpe || 0, 'RPE (1-10)')}
                                                                        className="w-full bg-neutral-800 text-center font-bold text-lg rounded-lg py-2 text-white cursor-pointer select-none caret-transparent placeholder-white/20"
                                                                        placeholder="-"
                                                                    />
                                                                </div>
                                                            )}
                                                            {/* Custom Metrics inputs */}
                                                            {Object.keys(exercise.metrics).map(key => {
                                                                if (['weight', 'reps', 'time', 'distance', 'rpe'].includes(key)) return null;
                                                                if (!exercise.metrics[key as keyof typeof exercise.metrics]) return null;
                                                                return (
                                                                    <div key={key} className="flex-1 min-w-[80px]">
                                                                        <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1 uppercase truncate max-w-[80px] mx-auto">{key}</label>
                                                                        <input
                                                                            type="text"
                                                                            readOnly
                                                                            inputMode="none"
                                                                            value={set.custom?.[key] || ''}
                                                                            onClick={() => handleNumpadOpen(mapIndex, setIndex, key, set.custom?.[key] || 0, key.toUpperCase())}
                                                                            className="w-full bg-neutral-800 text-center font-bold text-lg rounded-lg py-2 text-white cursor-pointer select-none caret-transparent"
                                                                        />
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Add Set Button */}
                                            <button
                                                onClick={() => addSet(mapIndex)}
                                                className="w-full py-4 mt-4 rounded-xl border-2 border-dashed border-neutral-800 text-neutral-500 hover:text-white hover:border-gym-primary/50 hover:bg-neutral-800/30 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                                            >
                                                <Plus size={18} /> Añadir Serie
                                            </button>

                                            {/* Finish/Next Actions specific to this card if needed, or keeping the global button? 
                                                The user can just swipe. But if it's the last card, maybe show Finish? 
                                            */}
                                            {mapIndex === activeExercises.length - 1 && (
                                                <div className="pt-8 pb-4">
                                                    <button
                                                        onClick={handleFinish}
                                                        className="w-full bg-gradient-to-br from-yellow-400 to-orange-500 text-black font-black uppercase tracking-[0.2em] py-5 rounded-xl shadow-[0_0_30px_rgba(250,204,21,0.5)] hover:shadow-[0_0_50px_rgba(250,204,21,0.7)] text-lg hover:-translate-y-1 active:scale-95 transition-all duration-300 relative overflow-hidden group border border-yellow-300/50"
                                                    >
                                                        <span className="relative z-10">Finalizar Entrenamiento</span>
                                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-md" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </WorkoutCarousel>
                    </div>
                )}

                {/* Legacy Finish Button (Now hidden inside the last card for cleaner UI, or we can keep it?) 
                    The previous code had it outside. I moved it inside the last card for "Focus Mode".
                    But wait, what if they want to finish early?
                    Ideally there should be a global menu. 
                    Let's keep the global one HIDDEN if we have the carousel, to enforce focus, BUT standard UX says users might want to bail out early.
                    Actually, let's keep it simple: "Finish" is on the last card. 
                */}
                {activeExercises.length > 0 && (
                    <div className="hidden">
                        {/* Hiding legacy finish button */}
                        <button
                            onClick={handleFinish}
                            disabled={loading || isFinished}
                            className={`w-full font-black uppercase tracking-wider py-4 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.4)] flex items-center justify-center gap-3 transform active:scale-95 transition-all text-xl ${isFinished ? 'bg-green-500 text-black' : 'bg-yellow-500 hover:bg-yellow-400 text-black'
                                }`}
                        >
                            {loading || isFinished ? (
                                <>
                                    <Loader className="animate-spin" size={24} />
                                    {isFinished ? 'FINALIZADO!' : 'GUARDANDO...'}
                                </>
                            ) : (
                                <>
                                    <Save size={24} strokeWidth={2.5} />
                                    TERMINAR ENTRENAMIENTO
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>


            {/* Fab Add Button (Only if exercises exist) */}
            {
                activeExercises.length > 0 && (
                    <div className="fixed bottom-6 left-0 w-full px-4 flex justify-center z-50 pointer-events-none">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="pointer-events-auto bg-red-600 text-white font-black py-4 px-10 rounded-2xl shadow-[0_10px_40px_rgba(220,38,38,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 text-lg border border-red-500/50 backdrop-blur-md"
                        >
                            <Plus size={24} strokeWidth={3} /> AÑADIR EJERCICIO
                        </button>
                    </div>
                )
            }

            {/* Exercise Selector Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 bg-black/95 z-50 p-6 flex flex-col animate-in fade-in duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Armería</h2>
                                <p className="text-neutral-500 text-sm">Elige tu arma para esta batalla.</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="bg-neutral-900 p-2 rounded-full text-white hover:bg-neutral-800"><Flame size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                            {arsenal.length === 0 ? (
                                <div className="text-center mt-20">
                                    <p className="text-neutral-500 mb-4">Tu Arsenal está vacío.</p>
                                    <Link to="/arsenal" className="text-red-500 font-bold underline">Ir a registrar máquinas</Link>
                                </div>
                            ) : (
                                arsenal.map(item => {
                                    // Resolve Category info
                                    // @ts-ignore
                                    const defaultCat = EQUIPMENT_CATEGORIES[item.category];
                                    const customCat = userSettings.categories.find(c => c.id === item.category);
                                    const catLabel = customCat?.label || defaultCat?.label || item.category;
                                    const catIcon = customCat?.icon || defaultCat?.icon;

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => addExercise(item)}
                                            className="w-full text-left bg-neutral-900 border border-neutral-800 p-5 rounded-2xl hover:bg-neutral-800 hover:border-red-500/50 transition-all flex items-center justify-between group"
                                        >
                                            <div>
                                                <span className="font-black text-lg text-white group-hover:text-red-500 transition-colors uppercase italic flex items-center gap-2">
                                                    {item.name}
                                                    {catIcon && <span className="text-base not-italic grayscale group-hover:grayscale-0">{catIcon}</span>}
                                                </span>
                                                <p className="text-xs text-neutral-500 font-bold tracking-widest mt-1">{catLabel}</p>
                                            </div>
                                            <div className="bg-neutral-950 p-2 rounded-lg text-neutral-600 group-hover:text-white transition-colors">
                                                <Plus size={20} />
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )
            }

            {showNumpad && numpadTarget && (
                <SmartNumpad
                    isOpen={showNumpad}
                    onClose={() => { setShowNumpad(false); setNumpadTarget(null); }}
                    onSubmit={() => { setShowNumpad(false); setNumpadTarget(null); }}
                    onInput={(key) => {
                        const { exerciseIndex, setIndex, field, value: currentStr } = numpadTarget;
                        const isCustom = !['weight', 'reps', 'time', 'distance', 'rpe'].includes(field);

                        let newValStr = String(currentStr);

                        if (key === '+2.5') {
                            newValStr = (parseFloat(newValStr || '0') + 2.5).toString();
                        } else if (key === '+1.25') {
                            newValStr = (parseFloat(newValStr || '0') + 1.25).toString();
                        } else if (typeof key === 'number') {
                            newValStr = (newValStr === '0' && key !== 0) ? String(key) : newValStr + key;
                            if (newValStr === '00') newValStr = '0'; // Prevent leading zeros
                        } else if (key === '.') {
                            if (!newValStr.includes('.')) {
                                newValStr = (newValStr || '0') + '.';
                            }
                        } else {
                            // Fallback for direct replacement if any
                            newValStr = String(key);
                        }

                        // 1. Update Buffer (Display)
                        setNumpadTarget(prev => prev ? ({ ...prev, value: newValStr }) : null);

                        // 2. Update Persisted State (Approximate)
                        updateSet(exerciseIndex, setIndex, field, newValStr, isCustom);
                    }}
                    onDelete={() => {
                        const { exerciseIndex, setIndex, field, value: currentStr } = numpadTarget;
                        const isCustom = !['weight', 'reps', 'time', 'distance', 'rpe'].includes(field);

                        let newValStr = String(currentStr).slice(0, -1);
                        if (newValStr === '') newValStr = '0';

                        // 1. Update Buffer
                        setNumpadTarget(prev => prev ? ({ ...prev, value: newValStr }) : null);

                        // 2. Update Persisted State
                        updateSet(exerciseIndex, setIndex, field, newValStr, isCustom);
                    }}
                    value={numpadTarget.value}
                    label={numpadTarget.label}
                    suggestion={numpadTarget.suggestion}
                />
            )}

        </div >
    )
}
