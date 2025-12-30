import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Equipment, CustomSettings } from '../services/GymEquipmentService';
import { equipmentService, EQUIPMENT_CATEGORIES } from '../services/GymEquipmentService';
import { userService } from '../services/UserService';
import { workoutService } from '../services/WorkoutService';
// BattleTimer removed
import { Plus, Save, Swords, Trash2, Flame, Loader, Check, ArrowLeft } from 'lucide-react';
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
    const LOCAL_STORAGE_KEY = `gp_workout_session_${user?.id}`; // Unique per user

    // State
    const [loading, setLoading] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [activeExercises, setActiveExercises] = useState<WorkoutExercise[]>([]);
    const [arsenal, setArsenal] = useState<Equipment[]>([]);
    const [routines, setRoutines] = useState<any[]>([]); // NEW: Local Routines
    const [showAddModal, setShowAddModal] = useState(false);
    const [resolvedGymId, setResolvedGymId] = useState<string | null>(null);

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

    // 💾 AUTO-SAVE EFFECT (Local Persistence)
    useEffect(() => {
        if (loading) return; // Don't save during initialization

        if (activeExercises.length > 0 || sessionId) {
            const stateToSave = {
                sessionId,
                startTime, // Date object serializes to string
                activeExercises,
                resolvedGymId,
                timestamp: Date.now()
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
        }
    }, [sessionId, startTime, activeExercises, resolvedGymId, loading]);

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

            // 3. Priority: Restore from LocalStorage (Client-side persistence)
            const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
            let restored = false;

            if (savedState) {
                try {
                    const parsed = JSON.parse(savedState);
                    // Check if data is not ancient (e.g. < 24h)? Optional.
                    // For now, adhere to user request: "NEVER DELETE"

                    if (parsed.activeExercises && parsed.activeExercises.length > 0) {
                        console.log("📂 Restoring session from LocalStorage...");
                        setSessionId(parsed.sessionId);
                        setStartTime(parsed.startTime ? new Date(parsed.startTime) : null);
                        setActiveExercises(parsed.activeExercises);
                        // If resolvedGymId changed (moved to another physical gym), we might warn? 
                        // But let's keep consistency with stored session.

                        // If we have a sessionId, verify it's still active in DB? 
                        // Optimistically trust local state for inputs.
                        restored = true;
                    }
                } catch (e) {
                    console.error("Local Restore failed:", e);
                }
            }

            if (!restored) {
                // 4. Fallback: Check DB for active session
                const active = await workoutService.getActiveSession(userId);

                if (active) {
                    console.log('♻️ Sesión activa encontrada en DB:', active.id);
                    setSessionId(active.id);
                    setStartTime(new Date(active.started_at));
                } else {
                    console.log('✨ No hay sesión activa. Preparando nueva batalla.');
                    setSessionId(null);
                    setStartTime(null);
                    setElapsedTime("00:00");
                    setActiveExercises([]);
                    setIsFinished(false);
                }
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
                    const metrics = item.metrics || defaultMetrics;

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

                    const ghostMetrics = detail.equipment?.metrics || defaultMetrics;

                    exercisesToAdd.push({
                        id: Math.random().toString(),
                        equipmentId: detail.exercise_id || Math.random().toString(),
                        equipmentName: ghostName,
                        metrics: ghostMetrics as any,
                        sets: [{
                            id: Math.random().toString(),
                            weight: 0,
                            reps: 0,
                            custom: {},
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

    const handleCancelSession = async () => {
        if (!window.confirm("⚠️ ¿CANCELAR ENTRENAMIENTO?\n\nSe perderán todos los datos y el progreso actual. Esta acción no se puede deshacer.")) return;

        setLoading(true);
        try {
            // 1. Delete from DB if exists
            if (sessionId) {
                console.log("🗑️ Discarding session from DB:", sessionId);
                await workoutService.discardSession(sessionId);
            }

            // 2. Clear Local Storage
            localStorage.removeItem(LOCAL_STORAGE_KEY);

            // 3. Reset Local State completely
            setSessionId(null);
            setStartTime(null);
            setElapsedTime("00:00");
            setActiveExercises([]);
            setIsFinished(false);

            console.log("✨ Session discarded and reset.");
        } catch (error) {
            console.error("Error cancelling session:", error);
            alert("Error al cancelar sesión. Intenta de nuevo.");
        } finally {
            setLoading(false);
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

                // 🧹 CLEAR LOCAL STORAGE ON FINISH
                localStorage.removeItem(LOCAL_STORAGE_KEY);

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
        <div className="min-h-screen bg-neutral-950 text-white pb-64 relative">
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

                {/* Active Exercises List */}
                {activeExercises.length > 0 && (
                    <div className="space-y-6">

                        {/* BATTLE HEADER & TIMER (Restored here) */}
                        <div className="flex items-center justify-between mb-4 px-2">
                            <div className="flex items-center gap-2">
                                <Swords className="text-gym-primary animate-pulse" size={20} />
                                <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">Battle Mode</h2>
                            </div>
                            <div className="bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-full flex items-center gap-3 shadow-lg">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse hover:animate-ping" />
                                <span className="font-mono font-bold text-xl text-white tracking-widest">{elapsedTime}</span>
                            </div>
                        </div>


                        {activeExercises.map((exercise, mapIndex) => (
                            <div key={exercise.id} className="bg-neutral-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
                                {/* Header */}
                                <div className="p-4 flex justify-between items-start bg-white/5 border-b border-white/5">
                                    <div>
                                        <h3 className="text-lg font-black italic uppercase text-white pr-8 leading-tight">
                                            {exercise.equipmentName}
                                        </h3>
                                        <div className="flex gap-2 mt-2">
                                            {/* <span className="text-[10px] font-bold bg-neutral-800 text-neutral-400 px-2 py-1 rounded uppercase tracking-wide">
                                            {arsenal.find(a => a.id === exercise.equipmentId)?.target_muscle_group || 'General'}
                                        </span> */}
                                            <button
                                                onClick={() => removeExercise(exercise.id)}
                                                className="text-neutral-500 hover:text-red-500 transition-colors bg-neutral-800/50 p-1.5 rounded-lg"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Sets Container */}
                                <div className="p-2">
                                    <div className="overflow-x-auto pb-1">
                                        <div className="w-full min-w-fit space-y-1">
                                            {/* Header Row */}
                                            {/* Header Row */}
                                            <div className="flex gap-1 text-[10px] uppercase font-bold text-neutral-500 px-2 mb-1 tracking-widest text-center items-center">
                                                <div className="w-8 sticky left-0 bg-[#171717] z-10">#</div>
                                                {/* Standard Metrics */}
                                                {exercise.metrics.weight && <div className="flex-1 min-w-[50px]">KG</div>}
                                                {exercise.metrics.reps && <div className="flex-1 min-w-[50px]">Reps</div>}
                                                {exercise.metrics.time && <div className="flex-1 min-w-[50px]">Time</div>}
                                                {exercise.metrics.distance && <div className="flex-1 min-w-[50px]">Dist</div>}
                                                {exercise.metrics.rpe && <div className="flex-1 min-w-[40px]">RPE</div>}

                                                {/* Dynamic Custom Metrics */}
                                                {Object.keys(exercise.metrics).map(key => {
                                                    if (['weight', 'reps', 'time', 'distance', 'rpe'].includes(key)) return null;
                                                    if (!exercise.metrics[key as keyof typeof exercise.metrics]) return null;
                                                    return (
                                                        <div key={key} className="flex-1 min-w-[50px] truncate" title={key}>
                                                            {key.substring(0, 4)}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {exercise.sets.map((set, setIndex) => {
                                                const isCompleted = set.completed;
                                                return (
                                                    <div
                                                        key={set.id}
                                                        className={`flex gap-1 p-1 rounded-lg transition-all duration-300 items-center ${isCompleted
                                                            ? 'bg-neutral-900/80 border border-green-500/20'
                                                            : 'bg-black/20 border border-transparent'
                                                            }`}
                                                    >
                                                        {/* Set Number */}
                                                        <div className="w-6 flex justify-center shrink-0">
                                                            <div className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${isCompleted ? 'bg-green-500/20 text-green-500' : 'bg-neutral-800 text-neutral-400'
                                                                }`}>
                                                                {setIndex + 1}
                                                            </div>
                                                        </div>

                                                        {/* Weight Input */}
                                                        {exercise.metrics.weight && (
                                                            <div className="flex-1 min-w-[50px] flex justify-center">
                                                                <input
                                                                    type="number"
                                                                    inputMode="decimal"
                                                                    value={set.weight === 0 ? '' : set.weight}
                                                                    onChange={(e) => updateSet(mapIndex, setIndex, 'weight', e.target.value)}
                                                                    className={`w-full bg-neutral-800 text-center font-bold text-base rounded py-1.5 focus:ring-1 focus:ring-gym-primary outline-none transition-all ${isCompleted ? 'text-neutral-500' : 'text-white'}`}
                                                                    placeholder="0"
                                                                    disabled={isCompleted}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Reps Input */}
                                                        {exercise.metrics.reps && (
                                                            <div className="flex-1 min-w-[50px] flex justify-center">
                                                                <input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    value={set.reps === 0 ? '' : set.reps}
                                                                    onChange={(e) => updateSet(mapIndex, setIndex, 'reps', e.target.value)}
                                                                    className={`w-full bg-neutral-800 text-center font-bold text-base rounded py-1.5 focus:ring-1 focus:ring-gym-primary outline-none transition-all ${isCompleted ? 'text-neutral-500' : 'text-white'}`}
                                                                    placeholder="0"
                                                                    disabled={isCompleted}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Time Input */}
                                                        {exercise.metrics.time && (
                                                            <div className="flex-1 min-w-[50px] flex justify-center">
                                                                <input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    value={set.time || ''}
                                                                    onChange={(e) => updateSet(mapIndex, setIndex, 'time', e.target.value)}
                                                                    className={`w-full bg-neutral-800 text-center font-bold text-base rounded py-1.5 focus:ring-1 focus:ring-gym-primary outline-none transition-all ${isCompleted ? 'text-neutral-500' : 'text-white'}`}
                                                                    placeholder="s"
                                                                    disabled={isCompleted}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Distance Input */}
                                                        {exercise.metrics.distance && (
                                                            <div className="flex-1 min-w-[50px] flex justify-center">
                                                                <input
                                                                    type="number"
                                                                    inputMode="decimal"
                                                                    value={set.distance || ''}
                                                                    onChange={(e) => updateSet(mapIndex, setIndex, 'distance', e.target.value)}
                                                                    className={`w-full bg-neutral-800 text-center font-bold text-base rounded py-1.5 focus:ring-1 focus:ring-gym-primary outline-none transition-all ${isCompleted ? 'text-neutral-500' : 'text-white'}`}
                                                                    placeholder="m"
                                                                    disabled={isCompleted}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* RPE Input */}
                                                        {exercise.metrics.rpe && (
                                                            <div className="flex-1 min-w-[40px] flex justify-center">
                                                                <input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    value={set.rpe || ''}
                                                                    onChange={(e) => updateSet(mapIndex, setIndex, 'rpe', e.target.value)}
                                                                    className={`w-full bg-neutral-800 text-center font-bold text-sm rounded py-1.5 focus:ring-1 focus:ring-gym-primary outline-none transition-all ${isCompleted ? 'text-neutral-500' : 'text-white'}`}
                                                                    placeholder="RPE"
                                                                    disabled={isCompleted}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Dynamic Custom Inputs */}
                                                        {Object.keys(exercise.metrics).map(key => {
                                                            if (['weight', 'reps', 'time', 'distance', 'rpe'].includes(key)) return null;
                                                            if (!exercise.metrics[key as keyof typeof exercise.metrics]) return null;

                                                            const customVal = set.custom?.[key];

                                                            return (
                                                                <div key={key} className="flex-1 min-w-[50px] flex justify-center">
                                                                    <input
                                                                        type="number"
                                                                        inputMode="decimal"
                                                                        value={customVal || ''}
                                                                        onChange={(e) => updateSet(mapIndex, setIndex, key, e.target.value, true)} // Pass true for custom
                                                                        className={`w-full bg-neutral-800 text-center font-bold text-base rounded py-1.5 focus:ring-1 focus:ring-gym-primary outline-none transition-all ${isCompleted ? 'text-neutral-500' : 'text-white'}`}
                                                                        placeholder="-"
                                                                        disabled={isCompleted}
                                                                    />
                                                                </div>
                                                            );
                                                        })}


                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Add Set Button */}
                                    <button
                                        onClick={() => addSet(mapIndex)}
                                        className="w-full py-3 mt-2 rounded-xl border border-dashed border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 hover:bg-neutral-800/30 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                                    >
                                        <Plus size={14} /> Añadir Serie
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div className="px-4 pb-4">
                            <button
                                onClick={handleCancelSession}
                                className="w-full py-4 rounded-xl border border-red-900/30 text-red-700 bg-red-950/10 hover:bg-red-900/20 hover:text-red-500 font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 mb-4"
                            >
                                <Trash2 size={16} /> Cancelar y Reiniciar
                            </button>
                        </div>

                        <div className="h-48 w-full" /> {/* Spacer to prevent fixed button overlap */}
                    </div>
                )}


                {/* Fixed Bottom Action Bar (Dual Buttons) */}
                {
                    activeExercises.length > 0 && (
                        <div className="fixed bottom-0 left-0 w-full px-4 pb-6 pt-12 bg-gradient-to-t from-neutral-950 via-neutral-950/95 to-transparent z-50 flex items-end gap-3 pointer-events-none">

                            {/* Finish Workout (Expanded Yellow - Full Width) */}
                            <button
                                onClick={handleFinish}
                                disabled={loading || isFinished}
                                className={`pointer-events-auto w-full font-black uppercase tracking-wider py-4 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.2)] flex items-center justify-center gap-2 transform active:scale-95 transition-all text-lg h-full border border-yellow-500/20 ${isFinished ? 'bg-green-500 text-black' : 'bg-gym-primary hover:bg-yellow-400 text-black'
                                    }`}
                            >
                                {loading || isFinished ? (
                                    <>
                                        <Loader className="animate-spin" size={20} />
                                        {isFinished ? 'FINALIZADO' : 'GUARDANDO'}
                                    </>
                                ) : (
                                    <>
                                        <Save size={20} strokeWidth={2.5} />
                                        TERMINAR RUTINA
                                    </>
                                )}
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

            </div>
        </div>
    );
};
