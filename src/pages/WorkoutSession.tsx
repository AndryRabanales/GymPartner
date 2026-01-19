import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Equipment, CustomSettings } from '../services/GymEquipmentService';
import { equipmentService, COMMON_EQUIPMENT_SEEDS } from '../services/GymEquipmentService';
import { userService } from '../services/UserService';
import { workoutService } from '../services/WorkoutService';
import { WorkoutCarousel } from '../components/workout/WorkoutCarousel';
import { ArsenalGrid } from '../components/arsenal/ArsenalGrid';
import { EquipmentForm } from '../components/arsenal/EquipmentForm';
import { normalizeText, getMuscleGroup } from '../utils/inventoryUtils';
// SmartNumpad removed

// Interface NumpadTarget removed
// BattleTimer removed
import { Plus, Swords, Trash2, Check, ArrowLeft, MoreVertical, X, RotateCcw, Search, Loader, Map as MapIcon, BrainCircuit, Lock, LockOpen } from 'lucide-react';
import { InteractiveOverlay } from '../components/onboarding/InteractiveOverlay';
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
    locked?: boolean; // Protects completed status
    restStartTime?: number; // Per-set rest timer
    restEndTime?: number; // Stopped rest timer
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
        [key: string]: boolean; // Allow custom metrics (cadencia, altura, watts, etc.)
    };
    sets: WorkoutSet[];
    category?: string; // SNAPSHOT: For history persistence
}

// Helper Component for Rest Timer
const RestTimerDisplay = ({ startTime, endTime }: { startTime: number, endTime?: number }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (endTime) {
            setElapsed(Math.floor((endTime - startTime) / 1000));
            return;
        }

        // Initial calc
        setElapsed(Math.floor((Date.now() - startTime) / 1000));

        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime, endTime]);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-2 mt-1 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Descanso</span>
            <span className="text-sm font-black text-gym-primary tabular-nums">{formatTime(elapsed)}</span>
        </div>
    );
};

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
    const [showSummary, setShowSummary] = useState(false);
    // NEW: Track Routine Name for AI Diagnosis
    const [currentRoutineName, setCurrentRoutineName] = useState<string | undefined>(undefined);
    // currentGym state removed

    // Tutorial State
    const [tutorialStep, setTutorialStep] = useState(0);

    // NEW: Start Options Modal
    const [showStartOptionsModal, setShowStartOptionsModal] = useState(false);

    useEffect(() => {
        const step = parseInt(localStorage.getItem('tutorial_step') || '0');
        if (step === 6 || step === 7) {
            setTutorialStep(step);
        }
    }, []);

    // Numpad State Removed
    // handleNumpadOpen Removed

    const [userSettings, setUserSettings] = useState<CustomSettings>({ categories: [], metrics: [] });
    // Arsenal Modal State
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [isCreatingExercise, setIsCreatingExercise] = useState(false);
    const [editingItem, setEditingItem] = useState<Equipment | null>(null);

    // NEW: Batch Selection State
    const [selectedCatalogItems, setSelectedCatalogItems] = useState<Set<string>>(new Set());

    // NEW: Rest Timer State
    const [restTimerStart, setRestTimerStart] = useState<number | null>(null); // Timestamp in ms
    const [restTimerSetKey, setRestTimerSetKey] = useState<string | null>(null); // "exerciseIdx-setIdx" to show only under specific set


    // NEW: Handle Batch Add
    const handleBatchAdd = async () => {
        if (selectedCatalogItems.size === 0) return;

        // 1. Start Session if needed (Delayed Start)
        if (!sessionId) {
            console.log("🚀 Auto-starting session on first exercise add...");
            await startNewSession();
        }

        // 2. Add All Selected Items
        const itemsToAdd: Equipment[] = [];
        selectedCatalogItems.forEach(id => {
            const item = effectiveInventory.find(i => i.id === id);
            if (item) itemsToAdd.push(item);
        });

        // Batch update to avoid multiple re-renders
        const newExercises = itemsToAdd.map(equipment => {
            const defaultMetrics = { weight: true, reps: true, time: false, distance: false, rpe: false };
            return {
                id: Math.random().toString(), // UI Key
                equipmentId: equipment.id,
                equipmentName: equipment.name,
                metrics: (equipment.metrics || defaultMetrics) as any,
                sets: [
                    { id: Math.random().toString(), weight: 0, reps: 0, completed: false }
                ],
                category: equipment.target_muscle_group || equipment.category || 'Custom'
            } as WorkoutExercise;
        });

        setActiveExercises(prev => [...prev, ...newExercises]);

        // 3. Cleanup
        setSelectedCatalogItems(new Set());
        setShowAddModal(false);
        setSearchTerm('');
    };

    // Toggle Selection Helper
    const toggleCatalogItem = (id: string) => {
        const newSet = new Set(selectedCatalogItems);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedCatalogItems(newSet);
    };

    // Computed: Merge Seeds (Virtual) only if not already present by NAME in the real/global list
    const effectiveInventory = [...arsenal];
    COMMON_EQUIPMENT_SEEDS.forEach(seed => {
        if (!effectiveInventory.some(i => normalizeText(i.name) === normalizeText(seed.name))) {
            effectiveInventory.push({
                ...seed,
                id: `virtual-${seed.name}`,
                // @ts-ignore
                gym_id: 'virtual',
                condition: 'GOOD',
                quantity: 1
            } as Equipment);
        }
    });

    const catalogItems = COMMON_EQUIPMENT_SEEDS.filter(seed => {
        if (activeSection) {
            // @ts-ignore
            return getMuscleGroup({ name: seed.name, category: seed.category }, userSettings) === activeSection;
        }
        return true;
    });

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
            let targetGymId = routeGymId === 'personal' ? undefined : routeGymId;

            if (!targetGymId) {
                const gyms = await userService.getUserGyms(userId);
                const gym = gyms.find(g => g.is_home_base) || gyms[0];
                if (gym) {
                    targetGymId = gym.gym_id;
                }
            }

            // Fetch actual Gym Details for GPS check (Lat/Lng) - REMOVED as redundant for now with auto-start

            // Fallback: If no physical gym, use Personal Virtual Gym (Fix for Global Users)
            if (!targetGymId) {
                try {
                    targetGymId = await userService.ensurePersonalGym(userId);
                    console.log("Using Personal Gym for Battle:", targetGymId);
                    // Personal gym might not have GPS, we can handle that in handleStartTraining
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

            // [FIX] ALWAYS Fetch Personal Inventory Logic (Global Custom Exercises)
            let finalInventory = [...items];
            try {
                const personalGymId = await userService.ensurePersonalGym(userId);
                if (personalGymId && personalGymId !== targetGymId) {
                    const personalItems = await equipmentService.getInventory(personalGymId);
                    console.log('🔗 Merged Personal Inventory into Session:', personalItems.length, 'items');

                    // Merge avoiding duplicates by ID
                    const existingIds = new Set(items.map(i => i.id));
                    const newItems = personalItems.filter(i => !existingIds.has(i.id));
                    finalInventory = [...finalInventory, ...newItems];
                }
            } catch (e) {
                console.warn('Could not fetch personal inventory linkage', e);
            }

            setArsenal(finalInventory);
            setRoutines(localRoutines);
            setUserSettings(settings);

            // 3. Start or Resume Session
            let active = null;
            let activeError = null;

            // 3a. Check if we have an INTENDED session from navigation (Volver button)
            const intendedSessionId = (location as any).state?.sessionId;
            if (intendedSessionId) {
                console.log("📍 Resuming specific session from navigation:", intendedSessionId);
                const result = await workoutService.getSessionById(intendedSessionId);
                // Handle split return {data, error}
                if (result.data && !result.data.end_time) {
                    active = result.data;
                } else {
                    console.warn("Intended session not found or closed. Checking for any active session.");
                }
            }

            // 3b. If no specific session found, check general active session
            if (!active) {
                const result = await workoutService.getActiveSession(userId);
                active = result.data;
                activeError = result.error;
            }

            if (activeError) {
                console.error("Error fetching active session:", activeError);
                // Optionally alert user or fail gracefully
            }

            if (active) {
                console.log('♻️ Sesión activa encontrada:', active.id);
                setSessionId(active.id);
                setStartTime(new Date(active.started_at));

                // NEW: Restore State (Hydrate activeExercises)
                setLoading(true);

                // 1. FAST RESTORE: Local Storage Draft (Preserves unsaved inputs)
                // This fixes the issue where returning to the session shows the routine list instead of the active exercises
                const savedDraft = localStorage.getItem(`workout_draft_${active.id}`);
                if (savedDraft) {
                    try {
                        const parsed = JSON.parse(savedDraft);
                        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
                            setActiveExercises(parsed);
                            console.log('⚡ Draft restored from LocalStorage - Skipping DB Log Fetch');
                            setLoading(false);
                            // Early return to skip DB fetch since we have the latest UI state
                            return;
                        }
                    } catch (e) {
                        console.warn('Failed to parse workout draft', e);
                    }
                }

                // 2. SLOW RESTORE: Database Logs (Only if no local draft found)
                const logs = await workoutService.getSessionLogs(active.id);

                if (logs && logs.length > 0) {
                    // Group logs by Exercise ID (or Name if unique in session context) to reconstruct cards
                    const restoredExercises: WorkoutExercise[] = [];
                    const exerciseMap = new Map<string, WorkoutExercise>(); // Map by Exercise Name or ID

                    logs.forEach((log: any) => {
                        const exName = log.exercise?.name || 'Unknown Exercise';
                        const exId = log.exercise_id;

                        // Find matching equipment in local arsenal to get metrics config
                        // If not found in arsenal, fallback to default metrics
                        const equipItem = items.find(i => normalizeText(i.name) === normalizeText(exName));
                        const defaultMetrics = { weight: true, reps: true, time: false, distance: false, rpe: false };

                        let exercise = exerciseMap.get(exId);
                        if (!exercise) {
                            exercise = {
                                id: Math.random().toString(), // UI Key
                                equipmentId: equipItem?.id || exId,
                                equipmentName: exName,
                                metrics: (equipItem?.metrics || defaultMetrics) as any,
                                sets: [],
                                category: log.category_snapshot || equipItem?.target_muscle_group || 'Custom'
                            };
                            exerciseMap.set(exId, exercise);
                            restoredExercises.push(exercise);
                        }

                        // Add Set
                        exercise.sets.push({
                            id: Math.random().toString(),
                            weight: log.weight_kg || 0,
                            reps: log.reps || 0,
                            time: log.time || 0,
                            distance: log.distance || 0,
                            rpe: log.rpe || 0,
                            custom: log.metrics_data || {},
                            completed: true // Logged means completed/saved? Usually yes.
                            // Actually, restore as uncompleted if we want them editable readily? 
                            // User wants "datos donde escribes ... mantenerse". If allowed to edit old sets, keep incomplete?
                            // But logs are usually final. Let's mark as completed but editable.
                        });
                    });

                    if (restoredExercises.length > 0) {
                        setActiveExercises(restoredExercises);
                        console.log('📦 State Restored:', restoredExercises.length, 'exercises');
                    } else {
                        // Active Session found, but 0 exercises logged -> User was in "Armería"
                        console.log('📦 Empty Active Session -> Re-opening Armería');
                        setShowAddModal(true);
                    }
                } else {
                    // No logs found -> User implies 0 exercises -> Open Armería
                    console.log('📦 No Logs -> Re-opening Armería');
                    setShowAddModal(true);
                }
                setLoading(false);

            } else {
                console.log('✨ No hay sesión activa. Esperando input del usuario...');

                // DO NOT START SESSION HERE. WAIT FOR USER ACTION.
                setSessionId(null);
                setStartTime(null);

                // If no routines exist, auto-open "Add Exercise" modal (All Exercises)
                // If routines exist, prompt choices (Start Options Modal)
                if (localRoutines.length === 0) {
                    console.log('🔰 No routines found - Auto-opening exercise picker');
                    setShowAddModal(true);
                } else {
                    console.log('🔰 Routines found - Asking user intent');
                    setShowStartOptionsModal(true);
                }
            }

        } catch (error) {
            console.error('❌ Error en initializeBattle:', error);
        } finally {
            setLoading(false);
        }
    };

    const startNewSession = async () => {
        if (!user) return;
        try {
            console.log("🚀 Starting NEW Session explicitly...");
            const { data: newSession, error: startError } = await workoutService.startSession(user.id, resolvedGymId || undefined);
            if (startError) throw startError;

            if (newSession) {
                setSessionId(newSession.id);
                setStartTime(new Date());
                setElapsedTime("00:00");
                setIsFinished(false);
                console.log('✅ Session started:', newSession.id);
            }
        } catch (err) {
            console.error("Error starting session:", err);
            alert("Error al iniciar sesión. Intenta nuevamente.");
        }
    };

    const loadRoutine = async (routine: any) => {
        if (!routine.equipment_ids || routine.equipment_ids.length === 0) return;

        setLoading(true); // Show loading while preparing routine

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
                    // DEBUG: Log the raw detail object from DB
                    console.log(`📋 RAW DETAIL from DB for ${item.name}:`, {
                        track_weight: detail.track_weight,
                        track_reps: detail.track_reps,
                        track_time: detail.track_time,
                        track_distance: detail.track_distance,
                        track_rpe: detail.track_rpe,
                        custom_metric: detail.custom_metric,
                        equipment_metrics: detail.equipment?.metrics
                    });

                    // CRITICAL FIX: equipment.metrics from DB should have HIGHEST priority
                    const baseMetrics = {
                        ...defaultMetrics, // Start with defaults
                        ...(item.metrics || {}), // Local inventory override
                        ...(detail.equipment?.metrics || {}), // DB JSONB has HIGHEST priority (custom metrics here!)
                    };

                    console.log(`🔧 Base Metrics After Merge:`, baseMetrics);

                    // Start with baseMetrics (includes ALL metrics from equipment.metrics)
                    const metrics = {
                        ...baseMetrics, // Preserve ALL metrics including custom ones
                    };

                    // Override ONLY the 5 standard metrics if routine has specific settings
                    if (detail.track_weight !== undefined) metrics.weight = detail.track_weight;
                    if (detail.track_reps !== undefined) metrics.reps = detail.track_reps;
                    if (detail.track_time !== undefined) metrics.time = detail.track_time;
                    if (detail.track_distance !== undefined) metrics.distance = detail.track_distance;
                    if (detail.track_rpe !== undefined) metrics.rpe = detail.track_rpe;

                    // Add custom metric from routine if exists
                    if (detail.custom_metric) {
                        // @ts-ignore
                        metrics[detail.custom_metric] = true;
                        console.log(`✨ Added Custom Routine Metric: ${detail.custom_metric}`);
                    }

                    console.log(`✅ FINAL METRICS FOR ${item.name}:`, metrics);
                    console.log(`📊 Custom Metrics Count: ${Object.keys(metrics).filter(k => !['weight', 'reps', 'time', 'distance', 'rpe'].includes(k)).length}`);

                    // Initialize custom metrics
                    const customMetrics: Record<string, number> = {};
                    // Type cast metrics to any to iterate safely since it's a flexible object
                    const metricsObj = metrics as any || {};

                    Object.keys(metricsObj).forEach(mid => {
                        if (!['weight', 'reps', 'time', 'distance', 'rpe'].includes(mid) && metricsObj[mid]) {
                            customMetrics[mid] = 0;
                            console.log(`🎯 Initialized custom metric "${mid}" in set.custom object`);
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
                    console.log(`👻 Creating Ghost Exercise: ${ghostName}`, detail);
                    console.log(`👻 detail.equipment FULL OBJECT:`, detail.equipment);
                    console.log(`👻 detail.equipment?.metrics:`, detail.equipment?.metrics);
                    console.log(`👻 Is detail.equipment?.metrics truthy?`, !!detail.equipment?.metrics);

                    // FIX: Respect Routine Configuration even for Ghosts
                    const baseMetrics = detail.equipment?.metrics || defaultMetrics;
                    console.log(`👻 baseMetrics selected:`, baseMetrics);

                    // Start with baseMetrics (includes ALL metrics from equipment.metrics)
                    const ghostMetrics = {
                        ...baseMetrics, // Preserve ALL metrics including custom ones
                    };

                    // Override ONLY the 5 standard metrics if routine has specific settings
                    if (detail.track_weight !== undefined) ghostMetrics.weight = detail.track_weight;
                    if (detail.track_reps !== undefined) ghostMetrics.reps = detail.track_reps;
                    if (detail.track_time !== undefined) ghostMetrics.time = detail.track_time;
                    if (detail.track_distance !== undefined) ghostMetrics.distance = detail.track_distance;
                    if (detail.track_rpe !== undefined) ghostMetrics.rpe = detail.track_rpe;

                    // Add custom metric from routine if exists
                    if (detail.custom_metric) {
                        // @ts-ignore
                        ghostMetrics[detail.custom_metric] = true;
                        console.log(`👻 Added Custom Metric to Ghost Exercise: ${detail.custom_metric}`);
                    }

                    console.log(`👻 FINAL GHOST METRICS FOR ${ghostName}:`, ghostMetrics);

                    // Initialize custom metrics
                    const customMetrics: Record<string, number> = {};
                    // @ts-ignore
                    const metricsObj = ghostMetrics as any || {};

                    Object.keys(metricsObj).forEach(mid => {
                        if (!['weight', 'reps', 'time', 'distance', 'rpe'].includes(mid) && metricsObj[mid]) {
                            customMetrics[mid] = 0;
                            console.log(`👻 Initialized ghost custom metric "${mid}"`);
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

    // [NEW] Remove Single Set
    const removeSet = (exerciseIndex: number, setIndex: number) => {
        const updatedExercises = [...activeExercises];
        updatedExercises[exerciseIndex].sets.splice(setIndex, 1);
        setActiveExercises(updatedExercises);
    };

    // [NEW] Toggle Completion with Timestamp & Lock Logic
    const toggleComplete = (exerciseIndex: number, setIndex: number) => {
        const updated = [...activeExercises];
        const set = updated[exerciseIndex].sets[setIndex];

        // 1. If Locked, Block Interaction
        if (set.locked && set.completed) {
            return;
        }

        if (set.completed) {
            // UNMARKING
            set.completed = false;
            // @ts-ignore
            set.completedAt = undefined;
            set.restStartTime = undefined;
            set.restEndTime = undefined;

            set.locked = false;

            // Clear legacy global timer
            if (restTimerSetKey === `${exerciseIndex}-${setIndex}`) {
                setRestTimerStart(null);
                setRestTimerSetKey(null);
            }

        } else {
            // MARKING COMPLETE
            set.completed = true;
            set.locked = true; // Auto-lock
            // @ts-ignore
            set.completedAt = elapsedTime;

            // Start Rest Timer for THIS set
            const now = Date.now();
            set.restStartTime = now;
            set.restEndTime = undefined;

            // Set Legacy Global Timer
            setRestTimerStart(now);
            setRestTimerSetKey(`${exerciseIndex}-${setIndex}`);

            // FREEZE PREVIOUS TIMER
            let prevSetFound = false;
            for (let i = exerciseIndex; i >= 0; i--) {
                const startJ = i === exerciseIndex ? setIndex - 1 : updated[i].sets.length - 1;
                for (let j = startJ; j >= 0; j--) {
                    const prevSet = updated[i].sets[j];
                    if (prevSet.completed && prevSet.restStartTime && !prevSet.restEndTime) {
                        prevSet.restEndTime = now; // Freeze it
                        prevSetFound = true;
                        break;
                    }
                }
                if (prevSetFound) break;
            }
        }
        setActiveExercises(updated);
    };

    const toggleLock = (exerciseIndex: number, setIndex: number) => {
        const updated = [...activeExercises];
        const set = updated[exerciseIndex].sets[setIndex];

        // Only toggle lock if completed
        if (set.completed) {
            set.locked = !set.locked;
            setActiveExercises(updated);
        }
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




    // NEW: Persist Active Exercises to LocalStorage
    useEffect(() => {
        if (sessionId && activeExercises.length > 0) {
            localStorage.setItem(`workout_draft_${sessionId}`, JSON.stringify(activeExercises));
        }
    }, [sessionId, activeExercises]);

    // NEW: Handle Cancel
    const handleCancelSession = async () => {
        if (!sessionId) {
            navigate(-1);
            return;
        }
        if (window.confirm("¿Seguro que quieres cancelar? Se perderá todo el progreso de esta sesión.")) {
            // Clear Local Storage
            localStorage.removeItem(`workout_draft_${sessionId}`);

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
            // Clear Local Storage
            localStorage.removeItem(`workout_draft_${sessionId}`);

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

    // handleStartTraining removed as it is no longer used (auto-start logic in initialization)

    // startSessionInternal removed

    // --- FINISH FLOW STATE ---
    const [showRoutineModal, setShowRoutineModal] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [routineName, setRoutineName] = useState('');
    const [locationName, setLocationName] = useState('');
    const [isSavingFlow, setIsSavingFlow] = useState(false);

    // 1. Triggered by UI Button
    const handleFinishRequest = async () => {
        setIsFinished(true); // Stop timer
        setShowRoutineModal(true);
    };

    // 2. Save Routine (Optional)
    // 2. Save Routine (Optional)
    const onSaveRoutine = async (name: string) => {
        if (name.trim()) {
            setIsSavingFlow(true);

            // 0. Resolve Virtual IDs to Real UUIDs
            // Just like MyArsenal, we must ensure every item exists in the DB before linking.
            const resolvedExercises = await Promise.all(activeExercises.map(async (ex) => {
                let finalId = ex.equipmentId;

                if (finalId.startsWith('virtual-')) {
                    // It's a seed item. Check if it exists in the current gym by name first.
                    const seedName = ex.equipmentName; // Should match the seed name
                    const targetGym = resolvedGymId === 'personal' || !resolvedGymId ? await userService.ensurePersonalGym(user!.id) : resolvedGymId;

                    try {
                        // Check if already exists in target gym (by name)
                        const { data: existing } = await supabase
                            .from('gym_equipment')
                            .select('id')
                            .eq('gym_id', targetGym)
                            .ilike('name', seedName)
                            .maybeSingle();

                        if (existing) {
                            finalId = existing.id;
                        } else {
                            // Create it!
                            // Find seed data to get category/icon
                            const seed = COMMON_EQUIPMENT_SEEDS.find(s => normalizeText(s.name) === normalizeText(seedName));

                            const newEq = await equipmentService.addEquipment({
                                name: seedName,
                                category: seed?.category || 'FREE_WEIGHT',
                                gym_id: targetGym,
                                quantity: 1,
                                condition: 'GOOD',
                                icon: (seed as any)?.icon
                            }, user!.id);

                            if (newEq) finalId = newEq.id;
                        }
                    } catch (err) {
                        console.error("Error resolving virtual item:", err);
                    }
                }

                return {
                    ...ex,
                    equipmentId: finalId
                };
            }));

            // Pass FULL activeExercises (resolved) to capture config (metrics, etc.)
            await workoutService.createRoutine(user!.id, name, resolvedExercises, null);
            setIsSavingFlow(false);
        }
        setShowRoutineModal(false);
        checkLocationStep();
    };

    const onSkipRoutine = () => {
        setShowRoutineModal(false);
        checkLocationStep();
    }

    // 3. Check if we need to save location
    const checkLocationStep = async () => {
        // Fetch current gym details to see if it's "Personal" (dummy)
        if (!resolvedGymId) {
            handleFinalizeSession();
            return;
        }

        const { data: gym } = await supabase.from('gyms').select('place_id').eq('id', resolvedGymId).single();

        // If it's the Personal Arsenal (virtual/home), prompt to save location
        if (gym && (gym.place_id.startsWith('personal_arsenal') || gym.place_id === 'virtual')) {
            setShowLocationModal(true);
        } else {
            handleFinalizeSession();
        }
    };

    // 4. Save Location (Optional)
    const onSaveLocation = async (name: string) => {
        if (name.trim()) {
            setIsSavingFlow(true);
            // Get GPS
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const { latitude, longitude } = position.coords;
                    const placeId = `custom_loc_${Date.now()}`; // Unique ID

                    // Create Gym
                    const gymPlace = {
                        place_id: placeId,
                        name: name,
                        address: "Ubicación Personalizada",
                        location: { lat: latitude, lng: longitude },
                        types: ['gym'],
                        rating: 5,
                        user_ratings_total: 1
                    };

                    const result = await userService.addGymToPassport(user!.id, gymPlace as any);

                    if (result.success && result.gym_id && sessionId) {
                        // Update the current session to point to this NEW gym
                        await supabase.from('workout_sessions').update({ gym_id: result.gym_id }).eq('id', sessionId);
                        console.log('📍 Session moved to new gym:', result.gym_id);
                    }

                    setIsSavingFlow(false);
                    setShowLocationModal(false);
                    handleFinalizeSession();

                }, (err) => {
                    console.error("GPS Error", err);
                    alert("No se pudo obtener la ubicación. Guardando sin ubicación nueva.");
                    setIsSavingFlow(false);
                    setShowLocationModal(false);
                    handleFinalizeSession();
                });
            } else {
                alert("Geolocalización no soportada.");
                setIsSavingFlow(false);
                setShowLocationModal(false);
                handleFinalizeSession();
            }
        } else {
            // Empty name? Just skip
            setShowLocationModal(false);
            handleFinalizeSession();
        }
    };

    const onSkipLocation = () => {
        setShowLocationModal(false);
        handleFinalizeSession();
    };


    // 5. Finalize (The original handleFinish)
    const handleFinalizeSession = async () => {
        // setIsFinished(true); // Already stopped
        if (!sessionId) {
            console.error('❌ No sessionId found!');
            setIsFinished(false);
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
            const result = await workoutService.finishSession(sessionId, "Battle Finished", currentRoutineName);

            if (result.success) {
                console.log('✅ Sesión terminada exitosamente');
                localStorage.removeItem(`workout_draft_${sessionId}`);
                // Removed blocking alert. 
                // We'll rely on the UI showing "Guardando..." or similar via loading state, 
                // or we could add a specific "Finished" state to show a success message briefly.
                // For now, let's just wait a moment so the user SEES the timer stopped.

                // Optional: Force update the local duration to ensure it matches exactly what we sent? 
                // Actually the backend sets the time. The difference is negligible.

                setTimeout(() => {
                    setLoading(false);
                    setShowSummary(true);
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
                <h2 className="text-2xl font-black uppercase tracking-widest animate-pulse">Iniciando...</h2>
            </div>
            {/* 4. NEW: SUMMARY / MISSION COMPLETE MODAL */}
            {/* Moved to main return */}

        </div>
    );

    return (
        <div className="min-h-screen bg-neutral-950 text-white pb-32 relative overflow-hidden">
            {/* Background Ambient Effects */}
            <div className="fixed top-0 left-0 w-full h-1/2 bg-gradient-to-b from-red-900/10 to-transparent pointer-events-none" />

            {/* Header Removed as per user request */}

            <div className="p-4 relative z-10">
                {/* Empty State / Routine Selection */}
                {/* Empty State / Fallback if Modal is Closed */}
                {activeExercises.length === 0 && !showAddModal && !loading && (
                    <div className="h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
                        <div className="bg-neutral-900/50 p-8 rounded-full border border-neutral-800 mb-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                            <Swords size={80} className="text-neutral-600" strokeWidth={1} />
                        </div>
                        <h2 className="text-3xl font-black italic uppercase text-white mb-4 tracking-tighter">¿Listo para entrenar?</h2>
                        <p className="text-neutral-500 font-bold mb-8 max-w-xs mx-auto">Selecciona tus ejercicios para comenzar la batalla.</p>

                        <button
                            onClick={() => setShowAddModal(true)}
                            className="w-full max-w-xs bg-gym-primary hover:bg-yellow-400 text-black font-black uppercase tracking-widest py-5 rounded-2xl shadow-[0_0_30px_rgba(250,204,21,0.3)] hover:scale-105 transition-all text-xl flex items-center justify-center gap-3"
                        >
                            <Plus size={24} strokeWidth={3} />
                            ABRIR CATÁLOGO
                        </button>
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
                                                    <Fragment key={set.id}>
                                                        <div
                                                            className={`relative flex flex-wrap gap-2 p-3 rounded-xl transition-all duration-300 items-center ${isCompleted
                                                                ? 'bg-neutral-900/80 border border-green-500/20'
                                                                : 'bg-black/20 border border-transparent'
                                                                }`}
                                                        >
                                                            {/* [MOVED] Delete Set Button - Top Left */}
                                                            <button
                                                                onClick={() => removeSet(mapIndex, setIndex)}
                                                                className="absolute -top-2 -left-2 bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-red-500 rounded-full p-1.5 shadow-lg z-10 scale-75 hover:scale-100 transition-all"
                                                                title="Eliminar Serie"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                            {/* Set Number */}
                                                            <div className="w-8 flex justify-center shrink-0 self-center">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isCompleted ? 'bg-green-500/20 text-green-500' : 'bg-neutral-800 text-neutral-400'
                                                                    }`}>
                                                                    {setIndex + 1}
                                                                </div>
                                                            </div>

                                                            {/* Inputs Container - Wraps on small screens */}
                                                            <div className="flex-1 flex flex-wrap gap-2 items-start min-w-0">

                                                                {exercise.metrics.weight && (
                                                                    <div className="min-w-[75px] w-[75px]">
                                                                        <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1">PESO</label>
                                                                        <input
                                                                            type="number"
                                                                            inputMode="decimal"
                                                                            value={set.weight === 0 ? '' : set.weight}
                                                                            onChange={(e) => updateSet(mapIndex, setIndex, 'weight', e.target.value)}
                                                                            className={`w-full bg-neutral-800 text-center font-black text-xl rounded-lg py-2 focus:ring-2 focus:ring-gym-primary outline-none transition-all ${isCompleted ? 'text-neutral-500' : 'text-white'}`}
                                                                            placeholder="0"
                                                                        />
                                                                    </div>
                                                                )}
                                                                {exercise.metrics.reps && (
                                                                    <div className="min-w-[75px] w-[75px]">
                                                                        <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1">REPS</label>
                                                                        <input
                                                                            type="number"
                                                                            inputMode="numeric"
                                                                            value={set.reps === 0 ? '' : set.reps}
                                                                            onChange={(e) => updateSet(mapIndex, setIndex, 'reps', e.target.value)}
                                                                            className={`w-full bg-neutral-800 text-center font-black text-xl rounded-lg py-2 focus:ring-2 focus:ring-gym-primary outline-none transition-all ${isCompleted ? 'text-neutral-500' : 'text-white'}`}
                                                                            placeholder="0"
                                                                        />
                                                                    </div>
                                                                )}
                                                                {exercise.metrics.time && (
                                                                    <div className="min-w-[75px] w-[75px]">
                                                                        <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1">TIEMPO (s)</label>
                                                                        <input
                                                                            type="number"
                                                                            inputMode="numeric"
                                                                            value={set.time || ''}
                                                                            onChange={(e) => updateSet(mapIndex, setIndex, 'time', e.target.value)}
                                                                            className="w-full bg-neutral-800 text-center font-bold text-lg rounded-lg py-2 text-white placeholder-white/20 focus:ring-2 focus:ring-gym-primary outline-none"
                                                                            placeholder="0s"
                                                                        />
                                                                    </div>
                                                                )}
                                                                {exercise.metrics.distance && (
                                                                    <div className="min-w-[75px] w-[75px]">
                                                                        <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1">DIST (m)</label>
                                                                        <input
                                                                            type="number"
                                                                            inputMode="decimal"
                                                                            value={set.distance === 0 ? '' : set.distance}
                                                                            onChange={(e) => updateSet(mapIndex, setIndex, 'distance', e.target.value)}
                                                                            className="w-full bg-neutral-800 text-center font-bold text-lg rounded-lg py-2 text-white placeholder-white/20 focus:ring-2 focus:ring-gym-primary outline-none"
                                                                            placeholder="0m"
                                                                        />
                                                                    </div>
                                                                )}
                                                                {exercise.metrics.rpe && (
                                                                    <div className="min-w-[60px] w-[60px]">
                                                                        <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1">RPE</label>
                                                                        <input
                                                                            type="number"
                                                                            inputMode="numeric"
                                                                            max={10}
                                                                            value={set.rpe || ''}
                                                                            onChange={(e) => updateSet(mapIndex, setIndex, 'rpe', e.target.value)}
                                                                            className="w-full bg-neutral-800 text-center font-bold text-lg rounded-lg py-2 text-white placeholder-white/20 focus:ring-2 focus:ring-gym-primary outline-none"
                                                                            placeholder="-"
                                                                        />
                                                                    </div>
                                                                )}
                                                                {/* Custom Metrics inputs */}
                                                                {Object.keys(exercise.metrics).map(key => {
                                                                    if (['weight', 'reps', 'time', 'distance', 'rpe'].includes(key)) return null;
                                                                    if (!exercise.metrics[key as keyof typeof exercise.metrics]) return null;
                                                                    return (
                                                                        <div key={key} className="min-w-[75px] w-[75px]">
                                                                            <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1 uppercase truncate">{key}</label>
                                                                            <input
                                                                                type="number"
                                                                                inputMode="decimal"
                                                                                value={set.custom?.[key] || ''}
                                                                                onChange={(e) => updateSet(mapIndex, setIndex, key, e.target.value, true)} // isCustom=true
                                                                                className="w-full bg-neutral-800 text-center font-bold text-lg rounded-lg py-2 text-white focus:ring-2 focus:ring-gym-primary outline-none"
                                                                            />
                                                                        </div>
                                                                    )
                                                                })}



                                                                {/* [NEW] Toggle Complete Button & Lock */}
                                                                <div className="flex flex-col items-center justify-center self-center h-full pt-1 pl-1 gap-1">
                                                                    <div className="flex items-center gap-1">
                                                                        {/* Lock Icon (Only if completed) */}
                                                                        {isCompleted && (
                                                                            <button
                                                                                onClick={() => toggleLock(mapIndex, setIndex)}
                                                                                className={`p-1 rounded-full transition-colors ${set.locked ? 'text-red-500 bg-red-500/10' : 'text-neutral-500 hover:text-white'}`}
                                                                                title={set.locked ? "Desbloquear para editar" : "Bloquear"}
                                                                            >
                                                                                {set.locked ? <Lock size={14} /> : <LockOpen size={14} />}
                                                                            </button>
                                                                        )}

                                                                        <button
                                                                            onClick={() => toggleComplete(mapIndex, setIndex)}
                                                                            disabled={set.locked}
                                                                            className={`p-2 rounded-full border-2 transition-all ${isCompleted
                                                                                ? set.locked
                                                                                    ? 'bg-neutral-800 border-neutral-700 text-neutral-500 cursor-not-allowed opacity-80' // Locked State
                                                                                    : 'bg-green-500 border-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.6)]' // Unlocked Complete
                                                                                : 'bg-transparent border-neutral-700 text-neutral-600 hover:border-neutral-500' // Incomplete
                                                                                }`}
                                                                            title={set.locked ? "Desbloquea primero" : (isCompleted ? "Marcar incompleto" : "Marcar listo")}
                                                                        >
                                                                            <Check size={20} strokeWidth={3} />
                                                                        </button>
                                                                    </div>
                                                                    {/* Timestamp */}
                                                                    {/* @ts-ignore */}
                                                                    {isCompleted && set.completedAt && (
                                                                        <span className="text-[10px] font-bold text-green-500 mt-0 tabular-nums tracking-tighter">
                                                                            {/* @ts-ignore */}
                                                                            {set.completedAt}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Rest Timer Display (Per Set) */}
                                                        {isCompleted && set.restStartTime && (
                                                            <RestTimerDisplay startTime={set.restStartTime} endTime={set.restEndTime} />
                                                        )}
                                                    </Fragment>
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
                                                        onClick={handleFinishRequest}
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
                )
                }

                {/* Legacy Finish Button (Now hidden inside the last card for cleaner UI, or we can keep it?) 
                    The previous code had it outside. I moved it inside the last card for "Focus Mode".
                    But wait, what if they want to finish early?
                    Ideally there should be a global menu. 
                    Let's keep the global one HIDDEN if we have the carousel, to enforce focus, BUT standard UX says users might want to bail out early.
                    Actually, let's keep it simple: "Finish" is on the last card. 
                */}
                {/* REMOVED: Battle Order Ready Overlay - Auto-start logic implemented instead */}
            </div >


            {/* Fab Add Button (Only if exercises exist) */}
            {
                activeExercises.length > 0 && (
                    <div className="fixed bottom-24 left-0 w-full px-4 flex justify-center z-50 pointer-events-none">
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
                    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col animate-in fade-in duration-200">
                        {/* Header */}
                        <div className="flex-none p-6 pb-2 border-b border-white/5 bg-neutral-950">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                                        {isCreatingExercise ? (editingItem ? 'Editar Ejercicio' : 'Crear Ejercicio') : 'Catálogo'}
                                    </h2>
                                    <p className="text-neutral-500 text-sm">
                                        {isCreatingExercise ? 'Personaliza tu equipo.' : 'Selecciona los ejercicios para hoy.'}
                                    </p>
                                </div>
                                <button onClick={() => {
                                    if (isCreatingExercise) { setIsCreatingExercise(false); setEditingItem(null); }
                                    else {
                                        // If closing "Armería" with 0 exercises, go back to Profile (Cancel Session)
                                        if (activeExercises.length === 0) {
                                            navigate('/');
                                        } else {
                                            setShowAddModal(false);
                                        }
                                    }
                                }} className="bg-neutral-900 p-2 rounded-full text-white hover:bg-neutral-800 transition-colors">
                                    {isCreatingExercise ? <ArrowLeft size={20} /> : <X size={20} />}
                                </button>
                            </div>

                            {/* Search Bar - only show if NOT creating custom */}
                            {!isCreatingExercise && (
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-neutral-500" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Buscar ejercicio o máquina..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-3 pl-10 text-white focus:outline-none focus:border-gym-primary transition-all"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 px-2 sm:px-4 pb-32 bg-black">
                            {/* Content Switch */}
                            {!isCreatingExercise ? (
                                <div className="pt-4">
                                    <ArsenalGrid
                                        inventory={effectiveInventory}
                                        selectedItems={selectedCatalogItems}
                                        userSettings={userSettings}
                                        searchTerm={searchTerm}
                                        onToggleSelection={(id) => {
                                            toggleCatalogItem(id);
                                        }}
                                        onOpenCatalog={(section) => {
                                            setActiveSection(section);
                                            setIsCreatingExercise(true);
                                        }}
                                        onEditItem={(item) => {
                                            setEditingItem(item);
                                            setIsCreatingExercise(true);
                                        }}
                                        routineConfigs={new Map()}
                                        gridClassName="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
                                    />
                                </div>
                            ) : (
                                <EquipmentForm
                                    user={user}
                                    userSettings={userSettings}
                                    onUpdateSettings={setUserSettings}
                                    editingItem={editingItem}
                                    onClose={() => { setIsCreatingExercise(false); setEditingItem(null); }}
                                    onSuccess={(newItem, isEdit) => {
                                        // Update Local Inventory State (Optimistic)
                                        setArsenal(prev => {
                                            if (isEdit) return prev.map(i => i.id === newItem.id ? newItem : i);
                                            return [...prev, newItem];
                                        });

                                        if (isEdit) {
                                            // If Editing: Just update the visual state, DO NOT start session.
                                            // Ensure it is selected so the user can see it's ready.
                                            setSelectedCatalogItems(prev => {
                                                const newSet = new Set(prev);
                                                newSet.add(newItem.id);
                                                return newSet;
                                            });
                                            // Close the form to return to grid
                                            setIsCreatingExercise(false);
                                            setEditingItem(null);
                                        } else {
                                            // If New Creation: Select it and return to grid (User might want to add more)
                                            // PREVIOUSLY: addExercise(newItem) -> Auto-start.
                                            // NEW BEHAVIOR: Just Select it.
                                            setSelectedCatalogItems(prev => {
                                                const newSet = new Set(prev);
                                                newSet.add(newItem.id);
                                                return newSet;
                                            });
                                            // setShowAddModal(false); // REMOVED: Keep user in Catalog
                                            // User said "haz que el boton de guardar... te siga manteniendo en el mismo lugar". 
                                            // Return to Grid View
                                            setIsCreatingExercise(false);
                                            setEditingItem(null);
                                            setSearchTerm('');
                                        }
                                    }}
                                    activeSection={activeSection || 'CHEST'}
                                    catalogItems={catalogItems}
                                    onQuickAdd={(seed) => {
                                        // Quick Add Seed from Catalog
                                        const tempId = `virtual-${seed.name}`;
                                        // Create virtual item object since it might not be in the list yet
                                        // @ts-ignore
                                        const virtualItem: Equipment = {
                                            ...seed,
                                            id: tempId,
                                            gym_id: 'virtual',
                                            quantity: 1,
                                            condition: 'GOOD'
                                        };

                                        // addExercise(virtualItem); // REMOVED: Auto-start legacy
                                        // setShowAddModal(false);   // REMOVED: Close legacy

                                        // NEW: Select it and keep in catalog
                                        setSelectedCatalogItems(prev => {
                                            const newSet = new Set(prev);
                                            newSet.add(virtualItem.id);
                                            return newSet;
                                        });
                                        // Add to inventory so it renders as selected
                                        setArsenal(prev => [...prev, virtualItem]);

                                        setIsCreatingExercise(false);
                                    }}
                                />
                            )}

                            {/* Floating "Add" Button for Batch Selection */}
                            {!isCreatingExercise && selectedCatalogItems.size > 0 && (
                                <div className="fixed bottom-6 left-0 w-full px-4 z-[100] flex justify-center pointer-events-none">
                                    <button
                                        onClick={handleBatchAdd}
                                        className="pointer-events-auto bg-gym-primary text-black font-black uppercase py-4 px-12 rounded-2xl shadow-[0_10px_40px_rgba(250,204,21,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 text-lg animate-in slide-in-from-bottom-4 border-2 border-yellow-400"
                                    >
                                        <Plus size={24} strokeWidth={3} />
                                        AGREGAR ({selectedCatalogItems.size})
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* SmartNumpad Removed */}



            {/* --- MODALS --- */}

            {/* 1. Save Routine Modal */}
            {
                showRoutineModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
                            <h3 className="text-xl font-black italic uppercase text-white mb-2">¿Guardar Rutina?</h3>
                            <p className="text-neutral-400 text-sm mb-6">Puedes guardar esta sesión como una rutina para repetirla en el futuro.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-neutral-500 uppercase block mb-2">Nombre de la Rutina</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Ej. Pecho y Tríceps Destructor"
                                        value={routineName}
                                        onChange={(e) => setRoutineName(e.target.value)}
                                        className="w-full bg-black border border-neutral-700 rounded-lg p-3 text-white font-bold focus:border-gym-primary outline-none transition-colors"
                                    />
                                </div>

                                <button
                                    onClick={() => onSaveRoutine(routineName)}
                                    disabled={isSavingFlow || !routineName.trim()}
                                    className="w-full bg-gym-primary text-black font-black uppercase py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSavingFlow ? <Loader className="animate-spin" size={20} /> : <Check size={20} strokeWidth={3} />}
                                    GUARDAR RUTINA
                                </button>

                                <button
                                    onClick={onSkipRoutine}
                                    disabled={isSavingFlow}
                                    className="w-full bg-transparent border border-neutral-800 text-neutral-400 font-bold uppercase py-3 rounded-xl hover:text-white hover:border-white transition-colors"
                                >
                                    NO GUARDAR
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 2. Save Location Modal */}
            {
                showLocationModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                                ¡Nueva Ubicación!
                            </div>
                            <h3 className="text-xl font-black italic uppercase text-white mb-2 text-center mt-2">¿Guardar Ubicación?</h3>
                            <p className="text-neutral-400 text-sm mb-6 text-center">Parece que estás en un lugar nuevo. ¿Quieres guardarlo como un gimnasio personalizado?</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-neutral-500 uppercase block mb-2">Nombre del Lugar</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Ej. Parque de Calistenia Norte"
                                        value={locationName}
                                        onChange={(e) => setLocationName(e.target.value)}
                                        className="w-full bg-black border border-neutral-700 rounded-lg p-3 text-white font-bold focus:border-gym-primary outline-none transition-colors"
                                    />
                                </div>

                                <button
                                    onClick={() => onSaveLocation(locationName)}
                                    disabled={isSavingFlow || !locationName.trim()}
                                    className="w-full bg-white text-black font-black uppercase py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                                >
                                    {isSavingFlow ? <Loader className="animate-spin" size={20} /> : <MapIcon size={20} strokeWidth={3} />}
                                    GUARDAR UBICACIÓN
                                </button>

                                <button
                                    onClick={onSkipLocation}
                                    disabled={isSavingFlow}
                                    className="w-full bg-transparent border border-neutral-800 text-neutral-400 font-bold uppercase py-3 rounded-xl hover:text-white hover:border-white transition-colors"
                                >
                                    NO, SOLO FINALIZAR
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* 3. NEW: Start Options Modal (Routine vs Quick Start) */}
            {
                showStartOptionsModal && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300 p-4">
                        <div className="w-full max-w-md bg-neutral-900/50 border border-neutral-800 rounded-3xl p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
                            {/* Background FX */}
                            <div className="absolute -top-20 -right-20 w-64 h-64 bg-gym-primary/5 rounded-full blur-3xl pointer-events-none"></div>

                            {/* Back Button */}
                            <button
                                onClick={() => navigate(-1)}
                                className="absolute top-6 left-6 text-neutral-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
                            >
                                <ArrowLeft size={20} />
                            </button>

                            <div className="text-center pt-2">
                                <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter mb-1">Estrategia de Hoy</h2>
                                <p className="text-neutral-500 font-bold text-sm">Selecciona una rutina o inicia libre.</p>
                            </div>

                            {/* Routine List (Compact) */}
                            <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                {routines.map((routine) => (
                                    <button
                                        key={routine.id}
                                        onClick={() => {
                                            startNewSession(); // START TIMER HERE
                                            loadRoutine(routine);
                                            setCurrentRoutineName(routine.name);
                                            setShowStartOptionsModal(false);
                                        }}
                                        className="flex items-center justify-between p-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-gym-primary/50 transition-all group"
                                    >
                                        <div className="text-left">
                                            <h3 className="font-bold text-white group-hover:text-gym-primary transition-colors uppercase italic">{routine.name}</h3>
                                            <span className="text-xs text-neutral-500 font-medium">
                                                {(routine.equipment_ids?.length || routine.routine_exercises?.length || 0)} Ejercicios
                                            </span>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-gym-primary group-hover:text-black transition-colors">
                                            <Swords size={16} />
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="relative">
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-neutral-800"></div>
                                <span className="relative z-10 bg-neutral-900 px-2 text-neutral-500 text-[10px] font-black uppercase tracking-widest mx-auto block w-fit">O inicia libre</span>
                            </div>

                            {/* Quick Start Button */}
                            <button
                                onClick={() => {
                                    // startNewSession(); // REMOVED: Delayed Start logic
                                    setShowStartOptionsModal(false);
                                    setShowAddModal(true); // Open the exercise picker directly
                                }}
                                className="w-full bg-white text-black font-black uppercase py-4 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                            >
                                <Plus size={20} strokeWidth={3} />
                                INICIO RÁPIDO
                            </button>
                        </div>
                    </div>
                )
            }

            {/* 4. NEW: SUMMARY / MISSION COMPLETE MODAL (Correct Position) */}
            {
                showSummary && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-500 p-4">
                        <div className="w-full max-w-sm flex flex-col items-center text-center space-y-8 relative">
                            {/* Confetti/Success FX */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gym-primary/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

                            <div className="relative">
                                <Check size={64} className="text-gym-primary animate-bounce" strokeWidth={4} />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">
                                    SESIÓN<br />FINALIZADA
                                </h2>
                                <p className="text-neutral-400 font-bold">Sesión registrada exitosamente.</p>
                            </div>

                            <div className="w-full space-y-3">
                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full bg-gym-primary hover:bg-yellow-400 text-black font-black uppercase py-4 rounded-xl shadow-[0_0_30px_rgba(250,204,21,0.3)] transition-all hover:scale-105 flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft size={24} />
                                    VOLVER AL INICIO
                                </button>

                                <button
                                    onClick={() => navigate('/journal')}
                                    className="w-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white font-bold uppercase py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <BrainCircuit size={20} />
                                    VER JOURNAL
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

// --- HELPER FUNCTIONS ---

// GPS Helpers Removed
