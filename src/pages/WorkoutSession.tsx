import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Equipment, CustomSettings, CustomMetric } from '../services/GymEquipmentService';
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
import { ArrowLeft, Check, Edit2, Flame, Loader, MoreVertical, Plus, RotateCcw, Save, Search, Swords, Trash2, X } from 'lucide-react';
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

export const WorkoutSession = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { gymId: routeGymId } = useParams<{ gymId: string }>();

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [arsenal, setArsenal] = useState<Equipment[]>([]);
    const [routines, setRoutines] = useState<any[]>([]);
    const [resolvedGymId, setResolvedGymId] = useState<string | null>(null);
    const [currentGym, setCurrentGym] = useState<any>(null);
    const [userSettings, setUserSettings] = useState<CustomSettings>({ categories: [], metrics: [] });
    const [showExitMenu, setShowExitMenu] = useState(false);

    // Session State
    const [activeExercises, setActiveExercises] = useState<WorkoutExercise[]>([]);
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [elapsedTime, setElapsedTime] = useState("00:00");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isFinished, setIsFinished] = useState(false);

    // UI State
    const [showAddModal, setShowAddModal] = useState(false);
    const [numpadTarget, setNumpadTarget] = useState<NumpadTarget | null>(null);
    const [showNumpad, setShowNumpad] = useState(false);

    // Advanced Add Modal State
    const [searchTerm, setSearchTerm] = useState('');
    const [customMode, setCustomMode] = useState(false);

    const [customName, setCustomName] = useState('');
    const [customCategory, setCustomCategory] = useState<string>('STRENGTH_MACHINE');
    const [customMetrics, setCustomMetrics] = useState({
        weight: true,
        reps: true,
        time: false,
        distance: false,
        rpe: false,
        // Dynamic custom metrics will be added here
        // [key: string]: boolean;
    });
    const [isCreatingMetric, setIsCreatingMetric] = useState(false);
    const [newMetricName, setNewMetricName] = useState('');
    const [newMetricIcon, setNewMetricIcon] = useState('📊');
    const [editingItem, setEditingItem] = useState<Equipment | null>(null);

    // Save Routine Prompt
    const [showSavePrompt, setShowSavePrompt] = useState(false);
    const [routineName, setRoutineName] = useState('');
    const [isSavingRoutine, setIsSavingRoutine] = useState(false);

    // Tutorial State
    const [tutorialStep, setTutorialStep] = useState(0);

    useEffect(() => {
        const step = parseInt(localStorage.getItem('tutorial_step') || '0');
        if (step === 6 || step === 7) {
            setTutorialStep(step);
        }
    }, []);

    // Numpad Logic
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
                if (gym) {
                    targetGymId = gym.gym_id;
                    // Fetch full gym data for coordinates (getUserGyms returns minimal info usually)
                    // But we can try to fetch the gym details specifically if needed, OR relies on what we have.
                    // Let's safe fetch the gym details to be sure we have Lat/Lng
                }
            }

            // Fetch actual Gym Details for GPS check (Lat/Lng)
            if (targetGymId) {
                const { data: gymDetails } = await supabase.from('gyms').select('*').eq('id', targetGymId).single();
                setCurrentGym(gymDetails);
            }

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
                setStartTime(null);
                setElapsedTime("00:00");
                setActiveExercises([]);
                setIsFinished(false);

                // AUTO-START CHECKS (Smart Start)
                // If user has NO routines (New User or Freestyle mode), start immediately.
                if (localRoutines.length === 0) {
                    console.log("🚀 Smart Start: No Routines detected. Starting Freestyle Session...");

                    // Start Session Immediately
                    const { data: newSession } = await workoutService.startSession(userId, targetGymId);
                    if (newSession) {
                        setSessionId(newSession.id);
                        setStartTime(new Date());
                        setShowAddModal(true); // Open Catalog immediately
                    }
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

    const handleStartTraining = async () => {
        if (!user) return;

        // 1. Bypass if no GPS data available (Personal Gyms or Data Error)
        if (!currentGym || !currentGym.lat || !currentGym.lng) {
            console.log("⚠️ No GPS data for gym. Byassing check.");
            await startSessionInternal();
            return;
        }

        setLoading(true);

        // 2. GPS Verification
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                const gymLat = parseFloat(currentGym.lat);
                const gymLng = parseFloat(currentGym.lng);

                const distance = getDistanceFromLatLonInKm(userLat, userLng, gymLat, gymLng) * 1000; // Meters

                console.log(`📍 GPS Check: User(${userLat},${userLng}) vs Gym(${gymLat},${gymLng}) = ${Math.round(distance)}m`);

                if (distance > 200) { // 200 Meters Tolerance
                    setLoading(false);
                    alert(`⛔ ACCESSO DENEGADO\n\nEstás a ${Math.round(distance)} metros de la base.\nDebes estar dentro del gimnasio para iniciar la operación.`);
                    return;
                }

                // GPS Verified
                await startSessionInternal();
            },
            (error) => {
                console.error("GPS Error:", error);
                setLoading(false);
                alert("⚠️ Error de GPS. Asegúrate de tener la ubicación activada para verificar tu presencia en el gimnasio.");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    // --- HELPER FOR CATEGORIES (From MyArsenal) ---
    const normalizeText = (text: string) => {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    };

    const getMuscleGroup = (item: Equipment | { name: string, category: string }): string => {
        const n = normalizeText(item.name);

        // 1. Check Custom Categories
        if (userSettings?.categories) {
            const matchedCategory = userSettings.categories.find(c => c.id === item.category);
            if (matchedCategory) return matchedCategory.label;
        }

        // 2. Explicit Category Mapping (Standard)
        if (item.category === 'CHEST') return 'Pecho';
        if (item.category === 'BACK') return 'Espalda';
        if (item.category === 'LEGS' || item.category === 'GLUTES' || item.category === 'CALVES') return 'Pierna';
        if (item.category === 'SHOULDERS') return 'Hombros';
        if (item.category === 'FOREARMS') return 'Antebrazo';
        if (item.category === 'ARMS') {
            if (n.includes('tricep') || n.includes('copa') || n.includes('fondos')) return 'Tríceps';
            return 'Bíceps';
        }

        // 3. Fallback Keyword Matching
        if (item.category === 'CARDIO') return 'Cardio';
        if (n.includes('jalon') || n.includes('remo') || n.includes('espalda') || n.includes('dorsal') || n.includes('lumbares') || n.includes('dominada') || n.includes('pull over') || n.includes('hyper')) return 'Espalda';
        if (n.includes('banca') || n.includes('pecho') || n.includes('chest') || n.includes('flexion') || n.includes('press plano') || n.includes('press inclinado') || n.includes('press declinado') || n.includes('pec deck') || n.includes('cruce de poleas') || n.includes('apertura')) return 'Pecho';
        if (n.includes('pierna') || n.includes('sentadilla') || n.includes('squat') || n.includes('femoral') || n.includes('cuadriceps') || n.includes('gemelo') || n.includes('gluteo') || n.includes('hack') || n.includes('pantorrilla') || n.includes('hip thrust') || n.includes('prensa')) return 'Pierna';
        if (n.includes('hombro') || n.includes('militar') || n.includes('lateral') || n.includes('press de hombro') || n.includes('trasnuca') || n.includes('face pull') || n.includes('pajaros')) return 'Hombros';
        if (n.includes('bicep') || n.includes('curl') || n.includes('predicador')) return 'Bíceps';
        if (n.includes('tricep') || n.includes('copa') || n.includes('fondos') || n.includes('frances')) return 'Tríceps';
        if (n.includes('antebrazo') || n.includes('muñeca')) return 'Antebrazo';
        if (n.includes('mancuerna') || n.includes('smith') || n.includes('multipower')) return 'Peso Libre (General)';
        if (item.category === 'FREE_WEIGHT') return 'Peso Libre (General)';
        if (item.category === 'CABLE') return 'Poleas / Varios';

        return 'Otros';
    };

    const handleCreateCustom = async () => {
        if (!user) return;
        if (!customName.trim()) {
            alert("Por favor escribe un nombre para el ejercicio.");
            return;
        }

        let finalGymId = null;
        try {
            finalGymId = await userService.ensurePersonalGym(user.id);
        } catch (e) {
            console.error("Error securing personal gym:", e);
        }

        let resolvedIcon = '⚡';
        // @ts-ignore
        if (EQUIPMENT_CATEGORIES[customCategory]) {
            // @ts-ignore
            resolvedIcon = EQUIPMENT_CATEGORIES[customCategory].icon;
        } else {
            const customCat = userSettings.categories.find(c => c.id === customCategory);
            if (customCat) resolvedIcon = customCat.icon;
        }

        const payload = {
            name: customName,
            category: customCategory,
            gym_id: finalGymId,
            quantity: 1,
            metrics: customMetrics,
            icon: resolvedIcon
        };

        try {
            if (editingItem) {
                // UPDATE
                const updatePayload = {
                    name: customName,
                    category: customCategory,
                    metrics: customMetrics,
                    icon: resolvedIcon
                };
                await equipmentService.updateEquipment(editingItem.id, updatePayload);
                const updatedItem = { ...editingItem, ...updatePayload };
                setArsenal(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
                setEditingItem(null);

            } else {
                // CREATE NEW
                const newItem = await equipmentService.addEquipment(payload, user.id);
                setArsenal(prev => [...prev, newItem]);
                // OPTIONAL: Add directly to current workout?
                // addExercise(newItem);
            }

            setCustomMode(false);
            setCustomName('');
            setCustomMetrics({ weight: true, reps: true, time: false, distance: false, rpe: false });
            alert(editingItem ? "Ejercicio actualizado" : "Ejercicio creado");

        } catch (error: any) {
            console.error(error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleEditRequest = (item: Equipment) => {
        setEditingItem(item);
        setCustomName(item.name);
        setCustomCategory(item.category);
        setCustomMetrics({
            weight: item.metrics?.weight ?? true,
            reps: item.metrics?.reps ?? true,
            time: item.metrics?.time ?? false,
            distance: item.metrics?.distance ?? false,
            rpe: item.metrics?.rpe ?? false,
            // Add other custom metrics from item.metrics
            ...Object.fromEntries(
                Object.entries(item.metrics || {}).filter(([key]) => !['weight', 'reps', 'time', 'distance', 'rpe'].includes(key))
            )
        });
        setCustomMode(true);
    };

    const openCreateMode = (section: string) => {
        // Map section name back to ID (approximate)
        let defaultCat = 'STRENGTH_MACHINE';
        switch (section) {
            case 'Pecho': defaultCat = 'CHEST'; break;
            case 'Espalda': defaultCat = 'BACK'; break;
            case 'Pierna': defaultCat = 'LEGS'; break;
            case 'Hombros': defaultCat = 'SHOULDERS'; break;
            case 'Bíceps':
            case 'Tríceps':
                defaultCat = 'ARMS'; break;
            case 'Antebrazo': defaultCat = 'FOREARMS'; break;
            case 'Cardio': defaultCat = 'CARDIO'; break;
            case 'Core': defaultCat = 'ABS'; break;
        }
        setCustomCategory(defaultCat);
        setEditingItem(null);
        setCustomName('');
        setCustomMetrics({ weight: true, reps: true, time: false, distance: false, rpe: false });
        setCustomMode(true);
    }

    const startSessionInternal = async () => {
        if (!user) return;
        setLoading(true);
        console.log("🚀 Starting verified session...");

        try {
            const { data: newSession, error } = await workoutService.startSession(user.id, resolvedGymId || undefined);

            if (newSession) {
                setSessionId(newSession.id);
                setStartTime(new Date());
                setIsFinished(false);
            } else {
                throw error;
            }
        } catch (e: any) {
            console.error("Failed to start session:", e);
            alert("Error al iniciar sesión. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = async () => {
        setIsFinished(true); // STOP TIMER IMMEDIATELY

        // INTERCEPT: Ask to Save Routine first if we have exercises
        // Only if we are NOT already in a routine session (checked via sessionId logic or routines list...
        // actually simplest is just to ask ALWAYS, or ask if it was a freestyle?)
        // User request: "finalizar(desea guardar su rutina?)" implies asking.

        // Check if we already clicked "No Save" or verified save
        // Actually, let's just show the modal, and the modal calls the REAL finish.
        // We need a flag to bypass this if called from the modal itself?
        // No, we can just split the logic.

        setShowSavePrompt(true);
    };

    const confirmFinish = async (shouldSave: boolean) => {
        setShowSavePrompt(false);
        await finishSessionInternal(shouldSave);
    };

    const finishSessionInternal = async (shouldSaveRoutine: boolean) => {
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



        // SAVE ROUTINE IF REQUESTED
        if (shouldSaveRoutine && routineName.trim()) {
            setIsSavingRoutine(true);
            try {
                // Map activeExercises to ID list or Rich Config Payload
                // We want to save the CONFIG (metrics used), not just IDs if possible.
                // workoutService.createRoutine supports rich config now?
                // Looking at createRoutine definition: async createRoutine(userId, name, equipmentIds, gymId)
                // It takes string[] for equipmentIds.
                // Wait, updateRoutine supports rich config. createRoutine might need update or we just pass IDs for now.
                // Let's pass IDs for now to be safe, or check if we can pass more.
                // The service reads: linkEquipmentToRoutine(routineId, equipmentIds).
                // So currently it only links IDs.
                // TODO: Enhance createRoutine to support rich config in one go.
                // For now, we save basic routine.
                const equipIds = activeExercises.map(e => e.equipmentId);
                const { error: routineError } = await workoutService.createRoutine(user!.id, routineName, equipIds, resolvedGymId);

                if (routineError) {
                    console.error("Error creating routine:", routineError);
                    alert("Entrenamiento guardado, pero hubo un error creando la rutina.");
                } else {
                    alert("¡Rutina creada con éxito!");
                }

            } catch (e) {
                console.error("Exception saving routine:", e);
            }
            setIsSavingRoutine(false);
        }

        console.log('🏁 Terminando sesión en DB:', sessionId);

        try {
            const result = await workoutService.finishSession(sessionId, "Battle Finished");

            if (result.success) {
                console.log('✅ Sesión terminada exitosamente');
                setTimeout(() => {
                    navigate('/history');
                }, 1500);
            } else {
                console.error('❌ Error terminando sesión:', result.error);
                setLoading(false);
                setIsFinished(false); // Resume timer if failed
            }
        } catch (error) {
            console.error('❌ Exception terminando sesión:', error);
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
                                {/* LIST EXISTING ROUTINES */}
                                <div className="space-y-4">
                                    <h4 className="text-white font-bold uppercase tracking-widest text-xs border-b border-white/10 pb-2 mb-2">
                                        Mis Estrategias Guardadas
                                    </h4>
                                    {routines.map((routine, index) => (
                                        <button
                                            key={routine.id}
                                            id={index === 0 ? 'tut-routine-first' : undefined}
                                            onClick={() => {
                                                if (tutorialStep === 6) {
                                                    setTutorialStep(0);
                                                    localStorage.setItem('tutorial_step', '0');
                                                    localStorage.setItem('hasSeenImportTutorial', 'true');
                                                }
                                                loadRoutine(routine);
                                            }}
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
                                </div>

                                <div className="pt-8 space-y-4">
                                    <h4 className="text-white font-bold uppercase tracking-widest text-xs border-b border-white/10 pb-2 mb-2">
                                        Operaciones de Campo
                                    </h4>

                                    {/* FREESTYLE START BUTTON */}
                                    <button
                                        onClick={() => {
                                            // Just close the "Empty State" by creating a session?
                                            // We are ALREADY in a view that expects `activeExercises`.
                                            // If we want to start empty, we just need to let them use the FAB.
                                            // But the UI shows this block IF activeExercises.length === 0.
                                            // So we need to switch "mode" or just trigger "Start Session" with 0 items?
                                            // But initialize() handles session check.
                                            // If we are here, we have no active session OR no exercises.
                                            // Let's just manually trigger showAddModal?
                                            setShowAddModal(true);
                                        }}
                                        className="w-full bg-neutral-800 hover:bg-white/10 text-white font-black uppercase tracking-widest py-5 rounded-2xl border border-white/10 flex items-center justify-center gap-3 transition-all"
                                    >
                                        <Swords size={20} className="text-neutral-400" />
                                        Iniciar Entrenamiento Libre
                                    </button>

                                    <Link
                                        to={`/territory/${resolvedGymId}/arsenal`}
                                        className="w-full bg-neutral-900 border border-dashed border-neutral-700 hover:border-gym-primary text-neutral-400 hover:text-white font-bold uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-all opacity-60 hover:opacity-100"
                                    >
                                        <Plus size={16} /> Construir Nueva Rutina
                                    </Link>
                                </div>
                            </div>
                        )}

                        {tutorialStep === 6 && (
                            <InteractiveOverlay
                                targetId="tut-routine-first"
                                title="PASO 2: IMPORTAR ESTRATEGIA"
                                message="Aquí está tu rutina creada. Selecciónala para cargar tu plan de entrenamiento en este gimnasio."
                                step={2}
                                totalSteps={2}
                                onNext={() => { }}
                                onClose={() => {
                                    setTutorialStep(0);
                                    localStorage.setItem('hasSeenImportTutorial', 'true');
                                }}
                                placement="top"
                                disableNext={true}
                            />
                        )}

                        {/* STEP 7 Pre-Step: Select Routine if not loaded */}
                        {tutorialStep === 7 && (
                            <InteractiveOverlay
                                targetId="tut-routine-first"
                                title="PASO 3: DESPLIEGUE"
                                message="Estrategia adquirida. Selecciónala para proceder al despliegue operativo."
                                step={3}
                                totalSteps={3}
                                onNext={() => { }}
                                onClose={() => {
                                    setTutorialStep(0); // If they close here, they lose flow, but okay.
                                }}
                                placement="top"
                                disableNext={true}
                            />
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
                                                        <div className="flex-1 flex flex-wrap gap-2 items-start min-w-0">

                                                            {exercise.metrics.weight && (
                                                                <div className="min-w-[75px] w-[75px]">
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
                                                                <div className="min-w-[75px] w-[75px]">
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
                                                                <div className="min-w-[75px] w-[75px]">
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
                                                                <div className="min-w-[75px] w-[75px]">
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
                                                                <div className="min-w-[60px] w-[60px]">
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
                                                                    <div key={key} className="min-w-[75px] w-[75px]">
                                                                        <label className="text-[9px] font-bold text-neutral-500 block text-center mb-1 uppercase truncate">{key}</label>
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
                {activeExercises.length > 0 && !sessionId && (
                    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
                        <div className="w-full max-w-md space-y-6 text-center">
                            <div className="w-24 h-24 bg-gym-primary/10 rounded-full flex items-center justify-center mx-auto ring-4 ring-gym-primary/20 animate-pulse">
                                <Swords size={48} className="text-gym-primary" />
                            </div>

                            <div>
                                <h2 className="text-3xl font-black italic uppercase text-white mb-2">Orden de Batalla Lista</h2>
                                <p className="text-neutral-400">Todo el equipo está cargado. Confirma que estás en la base para iniciar el cronómetro.</p>
                            </div>

                            {/* START BUTTON */}
                            <button
                                id="tut-start-btn"
                                onClick={handleStartTraining}
                                disabled={loading}
                                className="w-full bg-gym-primary hover:bg-yellow-400 text-black font-black uppercase tracking-widest py-5 rounded-2xl shadow-[0_0_40px_rgba(250,204,21,0.4)] hover:shadow-[0_0_60px_rgba(250,204,21,0.6)] text-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                {loading ? <Loader className="animate-spin" /> : <Flame size={24} strokeWidth={3} />}
                                INICIAR ENTRENAMIENTO
                            </button>

                            <div className="flex items-center justify-center gap-2 text-xs font-bold text-neutral-500 uppercase tracking-widest">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                GPS Requerido
                            </div>
                        </div>

                    </div>
                )}
            </div>


            {/* Fab Add Button (Always visible) */}
            {
                (activeExercises.length > 0 || sessionId) && (
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
                    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col animate-in fade-in duration-200">
                        {/* HEADER */}
                        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-neutral-900/50 backdrop-blur-md z-10">
                            <div>
                                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                                    {customMode ? (editingItem ? 'Editar Arma' : 'Forjar Arma') : 'Armería'}
                                </h2>
                                <p className="text-neutral-500 text-sm">
                                    {customMode ? 'Configura tu equipo.' : 'Elige tu arma para esta batalla.'}
                                </p>
                            </div>
                            <button onClick={() => { setShowAddModal(false); setCustomMode(false); }} className="bg-neutral-800 p-2 rounded-full text-white hover:bg-neutral-700 hover:text-red-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-black">
                            {customMode ? (
                                // --- CUSTOM CREATE/EDIT FORM (Reused from MyArsenal) ---
                                <div className="p-6 max-w-2xl mx-auto space-y-8 pb-32">
                                    {/* Name Input */}
                                    <div className="space-y-4">
                                        <div className="relative group">
                                            <div className="absolute -inset-1 bg-gradient-to-r from-gym-primary/20 to-purple-600/20 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                                            <input
                                                type="text"
                                                placeholder="Nombre del Ejercicio (ej: Press de Banca)"
                                                value={customName}
                                                onChange={(e) => setCustomName(e.target.value)}
                                                className="relative w-full bg-neutral-900 border border-white/10 rounded-xl px-6 py-6 text-2xl font-black text-white placeholder-neutral-600 focus:border-gym-primary focus:outline-none focus:ring-1 focus:ring-gym-primary transition-all text-center uppercase italic tracking-widest"
                                            />
                                        </div>
                                    </div>

                                    {/* Category Selector */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Categoría / Músculo</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[...Object.entries(EQUIPMENT_CATEGORIES), ...userSettings.categories.map(c => [c.id, c])].map(([key, cat]: any) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setCustomCategory(key)}
                                                    className={`
                                                        p-3 rounded-xl border flex flex-col items-center gap-2 transition-all
                                                        ${customCategory === key
                                                            ? 'bg-gym-primary text-black border-gym-primary shadow-[0_0_20px_rgba(250,204,21,0.3)]'
                                                            : 'bg-neutral-900 border-white/5 text-neutral-500 hover:bg-neutral-800 hover:text-white'}
                                                    `}
                                                >
                                                    <span className="text-2xl">{cat.icon}</span>
                                                    <span className="text-[9px] font-bold uppercase truncate w-full text-center">{cat.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Metrics Selector */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Métricas a Registrar</label>
                                        <div className="bg-neutral-900 rounded-xl p-4 border border-white/5 space-y-3">
                                            {[
                                                { id: 'weight', label: 'Peso (Lbs/Kgs)', icon: '⚖️' },
                                                { id: 'reps', label: 'Repeticiones', icon: '🔄' },
                                                { id: 'time', label: 'Tiempo / Duración', icon: '⏱️' },
                                                { id: 'distance', label: 'Distancia', icon: '📏' },
                                                { id: 'rpe', label: 'RPE (Esfuerzo)', icon: '🔥' },
                                                ...userSettings.metrics
                                            ].map(metric => (
                                                <div key={metric.id} className="flex items-center justify-between group">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg opacity-50 group-hover:opacity-100 transition-opacity">{metric.icon}</span>
                                                        <span className="text-sm font-medium text-neutral-300">{metric.label}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setCustomMetrics(prev => {
                                                            const isSelected = prev[metric.id as keyof typeof prev];
                                                            return { ...prev, [metric.id]: !isSelected };
                                                        })}
                                                        className={`w-12 h-7 rounded-full transition-colors relative ${customMetrics[metric.id as keyof typeof customMetrics] ? 'bg-gym-primary' : 'bg-neutral-800'}`}
                                                    >
                                                        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${customMetrics[metric.id as keyof typeof customMetrics] ? 'left-6' : 'left-1'}`} />
                                                    </button>
                                                </div>
                                            ))}
                                            {/* New Metric Button */}
                                            {!isCreatingMetric ? (
                                                <button
                                                    onClick={() => setIsCreatingMetric(true)}
                                                    className="w-full py-2 border border-dashed border-white/20 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Plus size={14} /> Crear Métrica
                                                </button>
                                            ) : (
                                                // Mini Form for Metric
                                                <div className="bg-black rounded-lg p-3 border border-white/10 space-y-2">
                                                    <div className="flex justify-between"><span className="text-xs font-bold uppercase">Nueva Métrica</span><button onClick={() => setIsCreatingMetric(false)}><X size={14} /></button></div>
                                                    <input type="text" placeholder="Nombre" value={newMetricName} onChange={e => setNewMetricName(e.target.value)} className="w-full bg-neutral-900 border border-white/10 rounded p-2 text-sm focus:border-gym-primary outline-none" />
                                                    <div className="flex gap-2">
                                                        <input type="text" value={newMetricIcon} onChange={e => setNewMetricIcon(e.target.value)} className="w-10 bg-neutral-900 border border-white/10 rounded p-2 text-center" />
                                                        <button onClick={async () => {
                                                            if (!user) return;
                                                            try {
                                                                const newMetric: CustomMetric = {
                                                                    id: newMetricName.toLowerCase().replace(/\s+/g, '_'),
                                                                    label: newMetricName,
                                                                    icon: newMetricIcon || '📊',
                                                                    default_active: true
                                                                };
                                                                const newSettings = { ...userSettings, metrics: [...userSettings.metrics, newMetric] };
                                                                setUserSettings(newSettings);
                                                                setCustomMetrics(prev => ({ ...prev, [newMetric.id]: true }));
                                                                await equipmentService.updateUserSettings(user.id, newSettings);
                                                                setIsCreatingMetric(false);
                                                            } catch (e: any) { alert(e.message); }
                                                        }} className="flex-1 bg-gym-primary text-black font-bold rounded text-xs">GUARDAR</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-8 flex gap-4">
                                        <button onClick={() => setCustomMode(false)} className="flex-1 py-4 rounded-xl bg-neutral-800 text-neutral-400 font-bold hover:bg-white/10 hover:text-white">CANCELAR</button>
                                        <button onClick={handleCreateCustom} className="flex-1 py-4 rounded-xl bg-gym-primary text-black font-black hover:brightness-110 shadow-lg shadow-yellow-500/20">{editingItem ? 'GUARDAR' : 'CREAR'}</button>
                                    </div>

                                </div>
                            ) : (
                                // --- MAIN GRID ---
                                <div className="p-4 md:p-6 space-y-12">
                                    {searchTerm && (
                                        <div className="sticky top-0 z-20 bg-black/80 backdrop-blur pb-4">
                                            <p className="text-neutral-500 italic">Resultados para "{searchTerm}"...</p>
                                        </div>
                                    )}

                                    {/* SEARCH BAR */}
                                    <div className="relative mb-6">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                                        <input
                                            type="text"
                                            placeholder="Buscar ejercicio..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-neutral-900 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white focus:border-gym-primary focus:outline-none font-bold placeholder-neutral-600"
                                        />
                                    </div>

                                    {/* SECTIONS */}
                                    {(() => {
                                        // Group items
                                        const grouped: Record<string, Equipment[]> = {};
                                        const sections = [
                                            'Pecho', 'Espalda', 'Pierna', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazo',
                                            'Cardio', 'Poleas / Varios', 'Peso Libre (General)', 'Otros',
                                            ...userSettings.categories.map(c => c.label)
                                        ];

                                        const filtered = arsenal.filter(item => normalizeText(item.name).includes(normalizeText(searchTerm)));

                                        filtered.forEach(item => {
                                            const g = getMuscleGroup(item);
                                            if (!grouped[g]) grouped[g] = [];
                                            grouped[g].push(item);
                                        });

                                        return sections.map(section => {
                                            const items = grouped[section] || [];
                                            // Always show section if check is passed, OR if user wants to add new to this section?
                                            // Ideally we show strictly populated sections + Always ability to add new?
                                            // Or show ALL sections? Let's show all sections so user can add to empty ones.

                                            return (
                                                <div key={section} className="space-y-4">
                                                    <h3 className="text-xl font-black italic uppercase text-neutral-600 border-b border-white/10 pb-2 tracking-widest pl-2">
                                                        {section}
                                                    </h3>

                                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                                        {items.map(item => {
                                                            const isActive = activeExercises.some(e => e.equipmentId === item.id);
                                                            const catInfo = userSettings.categories.find(c => c.id === item.category) || (EQUIPMENT_CATEGORIES as any)[item.category];
                                                            const icon = item.icon || catInfo?.icon || '⚡';
                                                            const metricIds = Object.keys(item.metrics || {}).filter(k => item.metrics?.[k as keyof typeof item.metrics]);

                                                            return (
                                                                <div key={item.id} className="relative group">
                                                                    <button
                                                                        onClick={() => { setShowAddModal(false); addExercise(item); }}
                                                                        className={`
                                                                            w-full aspect-[3/4] flex flex-col items-center justify-between
                                                                            bg-neutral-900 border ${isActive ? 'border-gym-primary' : 'border-white/5'}
                                                                            hover:bg-neutral-800 hover:border-white/20 hover:scale-[1.02]
                                                                            rounded-2xl overflow-hidden transition-all duration-300 shadow-lg
                                                                        `}
                                                                    >
                                                                        {/* Active Indicator */}
                                                                        {isActive && <div className="absolute top-2 right-2 bg-gym-primary text-black w-6 h-6 rounded-full flex items-center justify-center font-bold z-10"><Check size={14} strokeWidth={4} /></div>}

                                                                        {/* Icon */}
                                                                        <div className="flex-1 flex items-center justify-center w-full">
                                                                            <span className="text-5xl md:text-6xl drop-shadow-2xl filter grayscale-[0.3] group-hover:grayscale-0 transition-all">{icon}</span>
                                                                        </div>

                                                                        {/* Footer */}
                                                                        <div className="w-full bg-black/40 backdrop-blur border-t border-white/5 p-3 flex flex-col gap-1 z-10">
                                                                            <h4 className="text-[10px] md:text-xs font-black italic uppercase text-white leading-tight line-clamp-2 text-center h-8 flex items-center justify-center">{item.name}</h4>

                                                                            <div className="flex flex-wrap justify-center gap-1 opacity-70">
                                                                                {metricIds.slice(0, 3).map(m => (
                                                                                    <span key={m} className="text-[6px] font-bold bg-white/10 px-1 py-[2px] rounded text-neutral-300 uppercase">{m === 'weight' ? 'PESO' : m === 'reps' ? 'REPS' : m}</span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </button>

                                                                    {/* Edit Button */}
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleEditRequest(item); }}
                                                                        className="absolute top-2 left-2 p-1.5 rounded-full bg-black/20 text-neutral-500 hover:text-white hover:bg-neutral-700 backdrop-blur z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >
                                                                        <Edit2 size={12} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}

                                                        {/* ADD NEW TO SECTION BUTTON */}
                                                        <button
                                                            onClick={() => openCreateMode(section)}
                                                            className="aspect-[3/4] rounded-2xl border-2 border-dashed border-white/10 hover:border-gym-primary/50 hover:bg-gym-primary/5 flex flex-col items-center justify-center gap-2 group transition-all"
                                                        >
                                                            <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-gym-primary group-hover:text-black flex items-center justify-center transition-colors">
                                                                <Plus size={24} />
                                                            </div>
                                                            <span className="text-[10px] font-black uppercase text-neutral-500 group-hover:text-gym-primary">Agregar A<br />{section}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {
                showNumpad && numpadTarget && (
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
                )
            }






            {/* SAVE ROUTINE PROMPT MODAL */}
            {showSavePrompt && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/20">
                                <Swords size={32} className="text-yellow-500" />
                            </div>
                            <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">
                                ¡Misión Cumplida!
                            </h2>
                            <p className="text-neutral-400 text-sm">
                                ¿Deseas guardar esta configuración de batalla como una rutina para usarla en el futuro?
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1 mb-2 block">Nombre de la Rutina</label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Ej: Pierna día 1..."
                                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-yellow-500 rounded-xl p-4 text-white font-bold outline-none transition-colors"
                                    value={routineName}
                                    onChange={(e) => setRoutineName(e.target.value)}
                                />
                            </div>

                            <button
                                onClick={() => confirmFinish(true)}
                                disabled={!routineName.trim() || isSavingRoutine}
                                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest py-4 rounded-xl shadow-lg shadow-yellow-500/20 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                            >
                                {isSavingRoutine ? <Loader className="animate-spin" size={20} /> : <Save size={20} />}
                                {isSavingRoutine ? "Guardando..." : "Guardar y Finalizar"}
                            </button>

                            <button
                                onClick={() => confirmFinish(false)}
                                className="w-full bg-transparent hover:bg-white/5 text-neutral-400 font-bold uppercase tracking-widest py-4 rounded-xl transition-all"
                            >
                                No, solo finalizar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div >
    )

}

// --- HELPER FUNCTIONS ---

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}
