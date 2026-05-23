/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect, useRef, Fragment } from 'react';
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
import { Loader2, ArrowLeft, Image as ImageIcon, MapPin, Search, Plus, Save, Activity, Layers, Tag, Battery, MapIcon, Check, Settings as SettingsIcon, Swords, Trash2, X, RotateCcw, Lock, Play, Loader, MoreVertical, Pause, LockOpen } from 'lucide-react';
import { getCurrentPosition } from '../utils/geolocationUtils';
import type { GymPlace, Database } from '../types/database';
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
    completedAt?: number; // Timestamp of completion
    locked?: boolean;
    // Enhanced Timer Props
    restStatus?: 'running' | 'paused' | 'completed';
    restAccumulated?: number; // ms stored
    restLastStartTime?: number; // ms timestamp of current run start

    db_id?: string;
}

const STORAGE_KEY = 'gympartner_active_session';

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
    // NEW: Per-exercise Weight Unit
    weightUnit?: 'kg' | 'lb';
    category?: string; // SNAPSHOT: For history persistence
}

// Helper Component for Rest Timer
const RestTimerDisplay = ({ status, accumulated, lastStartTime }: { status: 'running' | 'paused' | 'completed', accumulated: number, lastStartTime?: number }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const calculateElapsed = () => {
            if (status === 'running' && lastStartTime) {
                return Math.floor((accumulated + (Date.now() - lastStartTime)) / 1000);
            }
            return Math.floor(accumulated / 1000);
        };

        if (status !== 'running') {
            setElapsed(calculateElapsed());
        }

        if (status === 'running') {
            const interval = setInterval(() => {
                setElapsed(calculateElapsed());
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [status, accumulated, lastStartTime]);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <span className={`text-sm font-black tabular-nums transition-colors ${status === 'running' ? 'text-gym-primary' : 'text-neutral-500'}`}>
            {formatTime(elapsed)}
        </span>
    );
};

export const WorkoutSession = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { gymId: routeGymId } = useParams<{ gymId: string }>();

    // State
    const [loading, setLoading] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<Date | null>(null);
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
    const [originalExerciseIds, setOriginalExerciseIds] = useState<string[]>([]); // To detect changes
    const [originalMetricsSnapshot, setOriginalMetricsSnapshot] = useState<string | null>(null); // To detect changes in routine targets
    const [isRoutineModified, setIsRoutineModified] = useState(false); // Tracks if routine structure changed during session
    // currentGym state removed

    // Tutorial State
    // unused tutorial state removed

    useEffect(() => {
        // Tutorial step check removed since tutorialStep state is removed
    }, []);

    // NEW: Start Options Modal
    const [showStartOptionsModal, setShowStartOptionsModal] = useState(false);
    const [showIntroAnim, setShowIntroAnim] = useState(true);
    const [detectedGymName, setDetectedGymName] = useState('');
    const CATALOG_ORDER = [
        // PECHO
        'PECHO', 'HOMBRO', 'TRÍCEPS',
        // ESPALDA
        'ESPALDA', 'BÍCEPS', 'ANTEBRAZO',
        // PIERNA
        'CUÁDRICEPS', 'ISQUIOTIBIALES', 'GLÚTEOS', 'PANTORRILLAS', 'ADUCTORES',
        // CORE
        'ABDOMINALES', 'LUMBARES', 'CUELLO',
        // CARDIO
        'CARDIO'
    ];

    const scrollToCategory = (category: string) => {
        setActiveMuscleFilter(category);

        // Use a small timeout to ensure state update and DOM alignment
        setTimeout(() => {
            const element = document.getElementById(`category-section-${category}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                if (catalogScrollRef.current) {
                    catalogScrollRef.current.scrollTop = 0;
                }
            }
        }, 100);
    };
    const catalogScrollRef = useRef<HTMLDivElement>(null);

    const [userSettings, setUserSettings] = useState<CustomSettings>({ categories: [], metrics: [] });
    // Arsenal Modal State
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreatingExercise, setIsCreatingExercise] = useState(false);
    const [editingItem, setEditingItem] = useState<Equipment | null>(null);

    // NEW: Batch Selection State
    const [selectedCatalogItems, setSelectedCatalogItems] = useState<Set<string>>(new Set());
    const [activeMuscleFilter, setActiveMuscleFilter] = useState<string | null>(null);

    const handleCatalogToggle = (id: string) => {
        setSelectedCatalogItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // NEW: Rest Timer State
    const [restTimerSetKey, setRestTimerSetKey] = useState<string | null>(null); // "exerciseIdx-setIdx" to show only under specific set

    // NEW: Weight Unit State (Global Default Only)
    // We only use this to initialize new exercises. Exercises themselves hold their state.
    const [defaultWeightUnit, setDefaultWeightUnit] = useState<'kg' | 'lb'>('kg');

    // Load Default Weight Unit on Mount
    useEffect(() => {
        const savedUnit = localStorage.getItem('gympartner_weight_unit');
        if (savedUnit === 'lb') setDefaultWeightUnit('lb');
    }, []);

    // Reset Scroll when filters change
    useEffect(() => {
        if (catalogScrollRef.current) {
            catalogScrollRef.current.scrollTop = 0;
        }
    }, [activeMuscleFilter, searchTerm]);

    // Sync Selected Catalog Items when modal opens
    useEffect(() => {
        if (showAddModal) {
            const currentIds = activeExercises.map(e => e.equipmentId).filter(Boolean) as string[];
            setSelectedCatalogItems(new Set(currentIds));
        }
    }, [showAddModal]);

    // Helpers for Unit Conversion
    const toDisplayWeight = (kgVal: number, unit: 'kg' | 'lb' = 'kg'): string => {
        if (!kgVal) return '';
        if (unit === 'kg') return kgVal.toString();
        // kg -> lb (1 kg = 2.20462 lb)
        const lb = (kgVal * 2.20462);
        // Round to 1 decimal like "45.5" but if it's "100.0" show "100"
        return parseFloat(lb.toFixed(1)).toString();
    };

    const toInternalWeight = (inputVal: string, unit: 'kg' | 'lb' = 'kg'): number => {
        const num = parseFloat(inputVal);
        if (isNaN(num)) return 0;
        if (unit === 'kg') return num;
        // lb -> kg (1 lb = 0.453592 kg)
        // Store precisely
        return num / 2.20462;
    };

    // Toggle Unit for Specific Exercise
    const toggleExerciseUnit = (exerciseIndex: number) => {
        const updated = [...activeExercises];
        const currentUnit = updated[exerciseIndex].weightUnit || 'kg';
        updated[exerciseIndex].weightUnit = currentUnit === 'kg' ? 'lb' : 'kg';
        setActiveExercises(updated);
        // Save as new default preference for future added exercises
        localStorage.setItem('gympartner_weight_unit', updated[exerciseIndex].weightUnit!);
        setDefaultWeightUnit(updated[exerciseIndex].weightUnit!);
    };


    // NEW: Handle Batch Add
    // --- Local Backup / Restore Logic (Simplified to only cleanup) ---
    // [REMOVED] Redundant loadSavedSession useEffect that caused state pollution.
    // Initialization is now strictly handled by initializeBattle.


    // Save state on change
    useEffect(() => {
        if (activeExercises.length === 0 && !currentRoutineName) return;
        if (!user) return; // Only save if user is logged in

        const saveSession = () => {
            const sessionData = {
                savedAt: Date.now(),
                data: {
                    exercises: activeExercises,
                    startTime: startTime?.toISOString(), // Convert Date to string for storage
                    routineName: currentRoutineName,
                    // locationName: '', // No locationName state
                    gymId: resolvedGymId
                }
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
        };

        const timeoutId = setTimeout(saveSession, 1000); // Debounce 1s
        return () => clearTimeout(timeoutId);
    }, [activeExercises, startTime, currentRoutineName, resolvedGymId, user]);

    // --- End Local Backup ---

    const handleBatchAdd = async () => {
        if (selectedCatalogItems.size === 0 && activeExercises.length === 0) return;

        let activeArsenal = arsenal;

        // 1. Start Session if needed (Delayed Start)
        if (!sessionId) {
            console.log("🚀 Auto-starting session on first exercise add...");
            const result = await startNewSession();
            if (result && result.freshArsenal) {
                activeArsenal = result.freshArsenal;
            }
        }

        const effectiveInv = [...activeArsenal];
        COMMON_EQUIPMENT_SEEDS.forEach(seed => {
            if (!effectiveInv.some(i => normalizeText(i.name) === normalizeText(seed.name))) {
                effectiveInv.push({
                    id: seed.id,
                    name: seed.name,
                    category: seed.category,
                    target_muscle_group: seed.category,
                    metrics: seed.metrics
                } as any);
            }
        });

        // 2. Identify keeping, adding, and removing exercises
        // Find existing exercises to keep (those whose equipmentId is still in selectedCatalogItems)
        const exercisesToKeep = activeExercises.filter(e => e.equipmentId && selectedCatalogItems.has(e.equipmentId));

        // Find which selected equipment IDs are new (not already in activeExercises)
        const existingEquipmentIds = new Set(activeExercises.map(e => e.equipmentId).filter(Boolean));
        const newEquipmentIdsToAdd = Array.from(selectedCatalogItems).filter(id => !existingEquipmentIds.has(id));

        const itemsToAdd: Equipment[] = [];
        newEquipmentIdsToAdd.forEach(id => {
            const item = effectiveInv.find(i => i.id === id);
            if (item) itemsToAdd.push(item);
        });

        // Map new ones to WorkoutExercise
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
                category: equipment.target_muscle_group || equipment.category || 'Custom',
                weightUnit: defaultWeightUnit
            } as WorkoutExercise;
        });

        const nextActiveExercises = [...exercisesToKeep, ...newExercises];
        setActiveExercises(nextActiveExercises);
        setIsRoutineModified(true); // Structural change: exercises synchronized

        // 3. Cleanup
        setSelectedCatalogItems(new Set());
        setShowAddModal(false);
        setSearchTerm('');
    };


    // Computed: Merge Seeds (Virtual) only if not already present by NAME in the real/global list
    const effectiveInventory = [...arsenal];
    COMMON_EQUIPMENT_SEEDS.forEach(seed => {
        if (!effectiveInventory.some(i => normalizeText(i.name) === normalizeText(seed.name))) {
            effectiveInventory.push({
                ...seed,
                id: `virtual-${seed.name}`,
                // @ts-expect-error - ignore typing
                gym_id: 'virtual',
                condition: 'GOOD',
                quantity: 1
            } as Equipment);
        }
    });

    const catalogItems = COMMON_EQUIPMENT_SEEDS.filter(seed => {
        if (activeMuscleFilter) {
            // @ts-expect-error - ignore typing
            return getMuscleGroup({ name: seed.name, category: seed.category }, userSettings) === activeMuscleFilter;
        }
        return true;
    });

    // Timer State (RESTORED)
    const [elapsedTime, setElapsedTime] = useState("00:00");
    const [ambiguousGyms, setAmbiguousGyms] = useState<any[]>([]);
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
        if (!userId) return navigate('/login');

        // Parallelize Initial Data Fetching
        try {
            // Start 1s timer for animation immediately
            setTimeout(() => setShowIntroAnim(false), 1200);

            // 1. PHASE 1: Instant Data Fetch (Settings & Gyms)
            const [gyms, settings, allGyms] = await Promise.all([
                userService.getUserGyms(userId),
                equipmentService.getUserSettings(userId),
                userService.getAllGyms()
            ]);

            // Always respect route parameter if explicitly navigated to a gym, otherwise start libre
            const targetGymId = routeGymId || null;

            // Set initial name only if we have a specific route ID, otherwise "Buscando ubicación..."
            if (routeGymId) {
                const routeGym = gyms.find(g => g.gym_id === routeGymId);
                if (routeGym) setDetectedGymName(routeGym.gym_name || '');
            } else {
                setDetectedGymName('Buscando ubicación...');
            }

            setResolvedGymId(targetGymId);
            setUserSettings(settings);

            // 2. PHASE 2: Fetch Inventory and Routines using predicted gym
            const [items, localRoutines, activeResult, personalItems] = await Promise.all([
                equipmentService.getInventory(targetGymId || ''),
                workoutService.getUserRoutines(userId, targetGymId || ''),
                workoutService.getActiveSession(userId),
                equipmentService.getPersonalInventory(userId)
            ]);

            setRoutines(localRoutines);
            const mergedInventory = [...items, ...personalItems.filter(i => !items.some(existing => existing.id === i.id))];
            setArsenal(mergedInventory);

            // 3. PHASE 3: High-Precision Background GPS Resolution
            (async () => {
                try {
                    const gpsPosition = await getCurrentPosition({ enableHighAccuracy: true, timeout: 3500 })
                        .catch(async () => {
                            return await getCurrentPosition({ enableHighAccuracy: false, timeout: 2000 });
                        });

                    if (gpsPosition && !routeGymId) {
                        const userLat = gpsPosition.lat;
                        const userLng = gpsPosition.lng;

                        // Sort all gyms by distance to pick the absolute closest ones
                        const gymsWithDistance = allGyms
                            .filter(g => g.lat && g.lng)
                            .map(g => {
                                const R = 6371;
                                const dLat = (g.lat - userLat) * (Math.PI / 180);
                                const dLon = (g.lng - userLng) * (Math.PI / 180);
                                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(userLat * (Math.PI / 180)) * Math.cos(g.lat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                const dist = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
                                return { ...g, dist };
                            })
                            .filter(g => g.dist <= 0.5) // 500m radius for strict checking
                            .sort((a, b) => a.dist - b.dist);

                        if (gymsWithDistance.length > 0) {
                            // Always present nearby gyms to let the user select where they want to train
                            setAmbiguousGyms(gymsWithDistance);
                        } else {
                            // No gyms nearby! Train Libre normally
                            console.log("📍 No gyms nearby. Training Libre.");
                            setDetectedGymName("Entrenamiento Libre");
                            setResolvedGymId(null);
                        }
                    } else if (!gpsPosition && !routeGymId) {
                        console.log("📍 GPS failed or disabled. Training Libre.");
                        setDetectedGymName("Entrenamiento Libre");
                        setResolvedGymId(null);
                    }
                } catch (err) {
                    console.warn("Precision GPS failed:", err);
                    setDetectedGymName("Entrenamiento Libre");
                    setResolvedGymId(null);
                }
            })();

            const handleSelectAmbiguousGym = async (gym: any) => {
                try {
                    // Ensure it's in passport
                    if (!gyms.some(g => g.gym_id === gym.id)) {
                        await userService.addGymToPassport(user!.id, {
                            place_id: gym.place_id,
                            name: gym.name,
                            address: gym.address || '',
                            location: { lat: gym.lat, lng: gym.lng }
                        });
                    }

                    setDetectedGymName(gym.name || '');
                    setResolvedGymId(gym.id);
                    setAmbiguousGyms([]);

                    // Hot-swap inventory and routines
                    const [newItems, newRoutines] = await Promise.all([
                        equipmentService.getInventory(gym.id),
                        workoutService.getUserRoutines(user!.id, gym.id)
                    ]);

                    setRoutines(newRoutines);
                    setArsenal(prev => {
                        const combined = [...newItems, ...prev];
                        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                        return unique;
                    });
                } catch (err) {
                    console.error("Error setting ambiguous gym", err);
                }
            };

            // Attach to window or state for the JSX to access
            (window as any).__handleSelectAmbiguousGym = handleSelectAmbiguousGym;

            // 3. Restore or Start Logic
            const active = activeResult.data;
            if (active) {
                setSessionId(active.id);
                setStartTime(new Date(active.started_at));

                // Hydrate from Draft or DB
                const savedDraft = localStorage.getItem(`workout_draft_${active.id}`);
                if (savedDraft) {
                    const parsed = JSON.parse(savedDraft);
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        setActiveExercises(parsed.exercises || []);
                        if (parsed.routineName) setCurrentRoutineName(parsed.routineName);
                        if (parsed.originalIds) setOriginalExerciseIds(parsed.originalIds);
                        if (parsed.isRoutineModified !== undefined) setIsRoutineModified(parsed.isRoutineModified);
                    } else {
                        setActiveExercises(Array.isArray(parsed) ? parsed : []);
                    }
                    setLoading(false);
                } else {
                    const logs = await workoutService.getSessionLogs(active.id);
                    if (logs && logs.length > 0) {
                        const restoredExercises: WorkoutExercise[] = [];
                        const exerciseMap = new Map<string, WorkoutExercise>();

                        logs.forEach((log: any) => {
                            const exName = log.exercise?.name || 'Unknown Exercise';
                            const exId = log.exercise_id;
                            const equipItem = items.find(i => normalizeText(i.name) === normalizeText(exName));
                            const defaultMetrics = { weight: true, reps: true, time: false, distance: false, rpe: false };

                            let exercise = exerciseMap.get(exId);
                            if (!exercise) {
                                exercise = {
                                    id: Math.random().toString(),
                                    equipmentId: equipItem?.id || exId,
                                    equipmentName: exName,
                                    metrics: (equipItem?.metrics || defaultMetrics) as any,
                                    sets: [],
                                    category: log.category_snapshot || equipItem?.target_muscle_group || 'Custom'
                                };
                                exerciseMap.set(exId, exercise);
                                restoredExercises.push(exercise);
                            }

                            exercise.sets.push({
                                id: Math.random().toString(),
                                weight: log.weight_kg || 0,
                                reps: log.reps || 0,
                                time: log.time || 0,
                                distance: log.distance || 0,
                                rpe: log.rpe || 0,
                                custom: log.metrics_data || {},
                                completed: true
                            });
                        });
                        setActiveExercises(restoredExercises);
                    } else {
                        setShowAddModal(true);
                    }
                }
            } else {
                if (localRoutines.length === 0) setShowAddModal(true);
                else setShowStartOptionsModal(true);
            }

        } catch (error) {
            console.error('❌ Error initializing battle:', error);
        } finally {
            setLoading(false);
        }
    };

    const getClosestGymIdFromGPS = async (userId: string): Promise<{ id: string; name: string } | null> => {
        try {
            console.log("🎯 Adquiriendo GPS en tiempo real para inicio de entrenamiento...");
            const gpsPosition = await getCurrentPosition({ enableHighAccuracy: true, timeout: 4000 })
                .catch(async () => {
                    console.log("⚠️ GPS de alta precisión falló o timeout, intentando rápido...");
                    return await getCurrentPosition({ enableHighAccuracy: false, timeout: 2000 });
                });

            if (!gpsPosition) {
                console.warn("❌ GPS no disponible.");
                return null;
            }

            const userLat = gpsPosition.lat;
            const userLng = gpsPosition.lng;

            // Fetch user gyms and all system gyms
            const [gyms, allGyms] = await Promise.all([
                userService.getUserGyms(userId),
                userService.getAllGyms()
            ]);

            // Calculate distance to all gyms using Haversine
            const gymsWithDistance = allGyms
                .filter(g => g.lat && g.lng)
                .map(g => {
                    const R = 6371;
                    const dLat = (g.lat - userLat) * (Math.PI / 180);
                    const dLon = (g.lng - userLng) * (Math.PI / 180);
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(userLat * (Math.PI / 180)) * Math.cos(g.lat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                    const dist = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
                    return { ...g, dist };
                })
                .filter(g => g.dist <= 0.5) // Strict 500m radius
                .sort((a, b) => a.dist - b.dist);

            if (gymsWithDistance.length > 0) {
                const closestGym = gymsWithDistance[0];
                console.log(`🎯 Ubicación confirmada en: ${closestGym.name} (${Math.round(closestGym.dist * 1000)}m)`);

                // Auto-add to passport if not already registered
                if (!gyms.some(g => g.gym_id === closestGym.id)) {
                    console.log(`✈️ Agregando ${closestGym.name} al pasaporte de forma automática...`);
                    await userService.addGymToPassport(userId, {
                        place_id: closestGym.place_id,
                        name: closestGym.name,
                        address: closestGym.address || '',
                        location: { lat: closestGym.lat, lng: closestGym.lng }
                    });
                }

                return { id: closestGym.id, name: closestGym.name };
            }
        } catch (e) {
            console.error("Error in getClosestGymIdFromGPS:", e);
        }
        return null;
    };

    const startNewSession = async (customGymId?: string): Promise<{ gymId: string | null; freshArsenal?: any[] }> => {
        if (!user) return { gymId: null };
        setLoading(true);
        try {
            console.log("🚀 Starting NEW Session explicitly...");
            
            let finalGymId = customGymId || resolvedGymId;
            let freshArsenal: any[] | undefined = undefined;

            // 1. Fresh GPS check (only if not locked to routeGymId and no customGymId was chosen)
            if (!routeGymId && !customGymId) {
                const freshGym = await getClosestGymIdFromGPS(user.id);
                if (freshGym) {
                    finalGymId = freshGym.id;
                    setResolvedGymId(freshGym.id);
                    setDetectedGymName(freshGym.name);

                    // Fetch latest inventory for this gym immediately to avoid state delays
                    console.log(`🔄 Fetching fresh inventory for gym: ${freshGym.name}`);
                    const [newItems, newRoutines] = await Promise.all([
                        equipmentService.getInventory(freshGym.id),
                        workoutService.getUserRoutines(user.id, freshGym.id)
                    ]);
                    
                    freshArsenal = newItems;
                    setRoutines(newRoutines);
                    setArsenal(prev => {
                        const combined = [...newItems, ...prev];
                        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                        return unique;
                    });
                }
            }

            const { data: newSession, error: startError } = await workoutService.startSession(user.id, finalGymId || undefined);
            if (startError) throw startError;

            // Clear local backup on success
            localStorage.removeItem(STORAGE_KEY);

            if (newSession) {
                setSessionId(newSession.id);
                setStartTime(new Date());
                setElapsedTime("00:00");
                setIsFinished(false);
                console.log('✅ Session started:', newSession.id);
            }

            return { gymId: finalGymId, freshArsenal };
        } catch (err) {
            console.error("Error starting session:", err);
            alert("Error al iniciar sesión. Intenta nuevamente.");
            return { gymId: null };
        } finally {
            setLoading(false);
        }
    };

    const loadRoutine = async (routine: any, freshArsenal?: any[]) => {
        if (!routine.equipment_ids || routine.equipment_ids.length === 0) return;

        setLoading(true); // Show loading while preparing routine
        const activeArsenal = freshArsenal || arsenal;

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
                let item = activeArsenal.find(i => i.id === detail.exercise_id);

                // 2. Fallback: Normalized Name Match
                if (!item && detail.equipment?.name) {
                    const targetName = normalizeName(detail.equipment.name);
                    item = activeArsenal.find(i => normalizeName(i.name) === targetName);
                }

                // 3. Fallback: Partial Name Match (fuzzy)
                if (!item && detail.equipment?.name) {
                    const targetName = normalizeName(detail.equipment.name);
                    item = activeArsenal.find(i => {
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
                        // @ts-expect-error - ignore typing
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

                        ghostMetrics[detail.custom_metric] = true;
                        console.log(`👻 Added Custom Metric to Ghost Exercise: ${detail.custom_metric}`);
                    }

                    console.log(`👻 FINAL GHOST METRICS FOR ${ghostName}:`, ghostMetrics);

                    // Initialize custom metrics
                    const customMetrics: Record<string, number> = {};
                    // @ts-expect-error - ignore typing
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
                const item = activeArsenal.find(i => i.id === eqId);
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
            setOriginalExerciseIds(exercisesToAdd.map(ex => ex.equipmentId)); // Store original IDs for "Smart Skip"
            setOriginalMetricsSnapshot(JSON.stringify(exercisesToAdd.map(ex => ex.metrics))); // Snapshot metrics
            setIsRoutineModified(false); // Clean loaded routine from template

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

    const removeExercise = (id: string) => {
        setActiveExercises(prev => prev.filter(e => e.id !== id));
        setIsRoutineModified(true); // Structural change: exercise removed
    };

    const updateSet = (exerciseIndex: number, setIndex: number, field: string, value: string | number, isCustom: boolean = false) => {
        const updated = [...activeExercises];
        const val = typeof value === 'string' ? parseFloat(value) : value;

        if (isCustom) {
            if (!updated[exerciseIndex].sets[setIndex].custom) {
                updated[exerciseIndex].sets[setIndex].custom = {};
            }
            updated[exerciseIndex].sets[setIndex].custom![field] = isNaN(val) ? 0 : val;
        } else {
            // @ts-expect-error - ignore typing
            updated[exerciseIndex].sets[setIndex][field] = isNaN(val) ? 0 : val;
        }

        setActiveExercises(updated);
    };

    // [NEW] Remove Single Set (Fixed Immutability & Logic)
    const removeSet = (exerciseIndex: number, setIndex: number) => {
        // Deep copy needed for safety
        const updatedExercises = activeExercises.map(ex => ({
            ...ex,
            sets: ex.sets.map(s => ({ ...s }))
        }));

        // 1. Check if we need to resume the PREVIOUS set's timer
        if (setIndex > 0) {
            const prevSet = updatedExercises[exerciseIndex].sets[setIndex - 1];
            // If prev set was blocking (completed state), resume it
            if (prevSet && prevSet.completed && prevSet.restStatus === 'completed') {
                // Resume only if it was actually "running" before completion? 
                // Simple logic: Go back to running
                prevSet.restStatus = 'running';
                prevSet.restLastStartTime = Date.now();
            }
        }

        updatedExercises[exerciseIndex].sets.splice(setIndex, 1);
        setActiveExercises(updatedExercises);
    };

    // [NEW] Toggle Completion with Timestamp & Lock Logic (Deep Copy)
    const toggleComplete = (exerciseIndex: number, setIndex: number) => {
        // Deep Copy
        const updated = activeExercises.map(ex => ({
            ...ex,
            sets: ex.sets.map(s => ({ ...s }))
        }));

        const set = updated[exerciseIndex].sets[setIndex];

        // 1. If Locked, Block Interaction
        if (set.locked && set.completed) {
            return;
        }

        if (set.completed) {
            // UNMARKING
            set.completed = false;
            // @ts-expect-error - ignore typing
            set.completedAt = undefined;
            // Reset Timer state
            set.restStatus = undefined;
            set.restAccumulated = 0;
            set.restLastStartTime = undefined;

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
            // @ts-expect-error - ignore typing
            set.completedAt = Date.now();

            // Start Rest Timer for THIS set
            set.restStatus = 'running';
            set.restLastStartTime = Date.now();
            set.restAccumulated = 0;

            // Set Legacy Global Timer (Visual backup)
            setRestTimerStart(Date.now());
            setRestTimerSetKey(`${exerciseIndex}-${setIndex}`);

            // FREEZE PREVIOUS TIMER
            let prevSetFound = false;
            for (let i = exerciseIndex; i >= 0; i--) {
                const startJ = i === exerciseIndex ? setIndex - 1 : updated[i].sets.length - 1;
                for (let j = startJ; j >= 0; j--) {
                    const prevSet = updated[i].sets[j];
                    if (prevSet.completed && prevSet.restStatus === 'running') {
                        // Stop it (Complete it)
                        const now = Date.now();
                        prevSet.restAccumulated = (prevSet.restAccumulated || 0) + (now - (prevSet.restLastStartTime || now));
                        prevSet.restStatus = 'completed';
                        prevSet.restLastStartTime = undefined;

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
        const updated = activeExercises.map(ex => ({
            ...ex,
            sets: ex.sets.map(s => ({ ...s }))
        }));

        const set = updated[exerciseIndex].sets[setIndex];

        // Only toggle lock if completed
        if (set.completed) {
            set.locked = !set.locked;
            setActiveExercises(updated);
        }
    };

    // [NEW] Toggle Rest Timer Pause (Individual)
    const toggleTimerPause = (exerciseIndex: number, setIndex: number) => {
        const updated = activeExercises.map(ex => ({
            ...ex,
            sets: ex.sets.map(s => ({ ...s }))
        }));

        const set = updated[exerciseIndex].sets[setIndex];

        if (!set.completed) return;

        if (set.restStatus === 'running') {
            // PAUSE IT
            const now = Date.now();
            set.restAccumulated = (set.restAccumulated || 0) + (now - (set.restLastStartTime || now));
            set.restStatus = 'paused';
            set.restLastStartTime = undefined;
        } else if (set.restStatus === 'paused') {
            // RESUME IT
            set.restStatus = 'running';
            set.restLastStartTime = Date.now();
        }
        setActiveExercises(updated);
    };


    const addSet = (exerciseIndex: number) => {
        // Deep Copy
        const updated = activeExercises.map(ex => ({
            ...ex,
            sets: ex.sets.map(s => ({ ...s }))
        }));

        const previousSet = updated[exerciseIndex].sets[updated[exerciseIndex].sets.length - 1];

        // [NEW] Stop the timer of the previous set when adding a new one
        if (previousSet && previousSet.completed && previousSet.restStatus === 'running') {
            const now = Date.now();
            previousSet.restAccumulated = (previousSet.restAccumulated || 0) + (now - (previousSet.restLastStartTime || now));
            previousSet.restStatus = 'completed';
            previousSet.restLastStartTime = undefined;
        }

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
            const draftPayload = {
                exercises: activeExercises,
                routineName: currentRoutineName,
                originalIds: originalExerciseIds,
                isRoutineModified: isRoutineModified
            };
            localStorage.setItem(`workout_draft_${sessionId}`, JSON.stringify(draftPayload));
        }
    }, [sessionId, activeExercises, currentRoutineName, originalExerciseIds, isRoutineModified]);

    // NEW: Handle Cancel
    const handleCancelSession = async () => {
        if (!sessionId) {
            navigate(-1);
            return;
        }
        if (window.confirm("¿Seguro que quieres cancelar? Se perderá todo el progreso de esta sesión.")) {
            // Clear Local Storage
            localStorage.removeItem(`workout_draft_${sessionId}`);
            localStorage.removeItem(STORAGE_KEY);
            setActiveExercises([]); // Clear state

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
            localStorage.removeItem(STORAGE_KEY);

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

            await startNewSession();

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
    const [isFinalizing, setIsFinalizing] = useState(false);

    // 1. Triggered by UI Button
    const handleFinishRequest = async () => {
        if (isFinalizing) return;
        setIsFinished(true); // Stop timer

        // SMART SKIP: Skip modal if using a routine and the structure wasn't modified
        const hasChanged = currentRoutineName
            ? isRoutineModified
            : true; // Always ask for Quick Start sessions

        if (currentRoutineName && !hasChanged) {
            console.log('✨ Routine matches original template. Skipping save modal...');
            checkLocationStep();
        } else {
            setShowRoutineModal(true);
        }
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
                    const targetGym = resolvedGymId;

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

    // 3. Skip location prompt, go straight to finalize
    const checkLocationStep = async () => {
        handleFinalizeSession();
    };

    // (onSaveLocation removed as it is no longer needed)

    const onSkipLocation = () => {
        setShowLocationModal(false);
        handleFinalizeSession();
    };


    // 5. Finalize (The original handleFinish)
    const handleFinalizeSession = async () => {
        if (isFinalizing) return;
        setIsFinalizing(true);
        // setIsFinished(true); // Already stopped
        if (!sessionId) {
            console.error('❌ No sessionId found!');
            setIsFinished(false);
            setIsFinalizing(false);
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

                // SAVE LOGIC:
                // 1. If it has no DB ID (not saved yet)
                // 2. AND (It is completed OR has some data)
                if (!set.db_id && (set.completed || set.weight > 0 || set.reps > 0 || (set.time || 0) > 0 || (set.distance || 0) > 0)) {
                    // We need the ID now
                    const targetId = await getExId();

                    if (targetId) {
                        console.log(`💾 Saving set ${j + 1} for ${exercise.equipmentName}...`);
                        // Ensure we have valid numbers
                        const weightToSave = Number(set.weight) || 0;
                        const repsToSave = Number(set.reps) || 0;
                        const timeToSave = Number(set.time) || 0;
                        const distanceToSave = Number(set.distance) || 0;

                        // Point 4: Add Timestamps to Metrics
                        const extendedMetrics = {
                            ...(set.custom || {}),
                            ...(set.completed ? { _checklist_timestamp: set.completedAt || Date.now() } : {}),
                            ...(exercise.weightUnit === 'lb' ? { _weight_unit: 'lb' } : {}),
                            _rest_duration_ms: set.restAccumulated || 0,
                            // _rest_status is string, might need cast if DB expects number map, but usually metrics_data is JSONB
                            _rest_status: set.restStatus
                        } as any;

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
                            metrics_data: extendedMetrics, // Save custom metrics + timestamps
                            category_snapshot: exercise.category || 'Custom', // SNAPSHOT: Current Category
                            is_pr: false
                        }).then(res => {
                            if (res.data) {
                                // Mark as saved in local state to avoid dupes if we were to stay on screen
                                set.db_id = res.data.id;
                            }
                        }));
                        savedCount++;
                    } else {
                        console.error(`❌ Failed to resolve ID for ${exercise.equipmentName}, skipping save.`);
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
                localStorage.removeItem(STORAGE_KEY); // Also clear global key
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
                setIsFinalizing(false);
            }
        } catch (error) {
            console.error('❌ Exception terminando sesión:', error);
            // alert('❌ Error inesperado: ' + error);
            setLoading(false);
            setIsFinished(false);
            setIsFinalizing(false);
        }
    };

    // Removed redundant loading screen to speed up startup as per user request
    // Intro animation now covers background loading

    return (
        <div className="min-h-screen bg-neutral-950 text-white pb-32 relative overflow-hidden">

            {/* AMBIGUOUS GYMS MODAL */}
            {ambiguousGyms.length > 0 && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-[2rem] w-full max-w-sm text-center shadow-2xl relative overflow-hidden flex flex-col gap-6">
                        <div>
                            <div className="w-16 h-16 bg-gym-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-gym-primary/20">
                                <MapIcon className="text-gym-primary w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Selecciona tu Base</h2>
                            <p className="text-neutral-400 text-sm">Hemos detectado gimnasios cerca de ti. Selecciona en cuál estás entrenando.</p>
                        </div>
                        
                        <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                            {ambiguousGyms.map(gym => (
                                <button
                                    key={gym.id}
                                    onClick={() => (window as any).__handleSelectAmbiguousGym?.(gym)}
                                    className="w-full bg-black hover:bg-neutral-800 border border-white/10 hover:border-gym-primary/50 rounded-xl p-4 flex items-center justify-between group transition-all text-left"
                                >
                                    <div>
                                        <div className="text-white font-bold text-sm group-hover:text-gym-primary transition-colors">{gym.name}</div>
                                        <div className="text-neutral-500 text-xs">A {Math.round(gym.dist * 1000)}m de ti</div>
                                    </div>
                                    <Check className="text-gym-primary opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => {
                                setAmbiguousGyms([]);
                                setResolvedGymId(null);
                                setDetectedGymName("Entrenamiento Libre");
                            }}
                            className="w-full bg-transparent border border-neutral-800 text-neutral-400 font-bold uppercase py-3 rounded-xl hover:text-white hover:border-white transition-colors"
                        >
                            Entrenar Libre (Sin Gym)
                        </button>
                    </div>
                </div>
            )}

            {/* 0. INTRO ANIMATION (Matching Image Reference) */}
            {showIntroAnim && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-out fade-out duration-300 delay-700">
                    <div className="flex flex-col items-center gap-8 px-6 text-center">
                        {/* Map Icon (Gold) */}
                        <div className="relative">
                            <MapIcon size={100} className="text-gym-primary fill-gym-primary/10 animate-pulse" strokeWidth={1.5} />
                            <div className="absolute inset-0 bg-gym-primary/20 blur-2xl rounded-full" />
                        </div>

                        {/* Text Content */}
                        <div className="space-y-2">
                            <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-[0.15em] text-white animate-in slide-in-from-bottom-2 duration-500">
                                INICIANDO
                            </h2>
                            <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-[0.15em] text-white animate-in slide-in-from-bottom-3 duration-600">
                                ENTRENAMIENTO
                            </h2>
                            <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-wider text-gym-primary animate-in fade-in duration-500">
                                {detectedGymName}
                            </h3>
                        </div>

                        {/* Animated Dots */}
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-gym-primary animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-3 h-3 rounded-full bg-gym-primary animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-3 h-3 rounded-full bg-gym-primary animate-bounce" />
                        </div>
                    </div>
                </div>
            )}
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
                                                                        <label
                                                                            onClick={() => toggleExerciseUnit(mapIndex)}
                                                                            className="text-[9px] font-bold text-neutral-500 block text-center mb-1 cursor-pointer hover:text-gym-primary transition-colors select-none"
                                                                        >
                                                                            PESO ({(exercise.weightUnit || 'kg').toUpperCase()})
                                                                        </label>
                                                                        <input
                                                                            type="number"
                                                                            inputMode="decimal"
                                                                            value={set.weight === 0 ? '' : toDisplayWeight(set.weight, exercise.weightUnit || 'kg')}
                                                                            onChange={(e) => updateSet(mapIndex, setIndex, 'weight', toInternalWeight(e.target.value, exercise.weightUnit || 'kg'))}
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

                                                                        {/* Lock Icon (Only if completed) - Moved to Right */}
                                                                        {isCompleted && (
                                                                            <button
                                                                                onClick={() => toggleLock(mapIndex, setIndex)}
                                                                                className={`p-1 rounded-full transition-colors ${set.locked ? 'text-red-500 bg-red-500/10' : 'text-neutral-500 hover:text-white'}`}
                                                                                title={set.locked ? "Desbloquear para editar" : "Bloquear"}
                                                                            >
                                                                                {set.locked ? <Lock size={15} /> : <LockOpen size={15} />}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {/* Timestamp */}
                                                                    {/* @ts-expect-error - ignore typing */}
                                                                    {isCompleted && set.completedAt && (
                                                                        <span className="text-[10px] font-bold text-green-500 mt-0 tabular-nums tracking-tighter">
                                                                            {(() => {
                                                                                const completedTime = Number(set.completedAt);
                                                                                if (isNaN(completedTime)) return '';
                                                                                const start = startTime?.getTime() || Date.now();
                                                                                const diff = completedTime - start;
                                                                                if (diff < 0) return '00:00';
                                                                                const m = Math.floor(diff / 60000);
                                                                                const s = Math.floor((diff % 60000) / 1000);
                                                                                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                                                            })()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Rest Timer Display (Per Set) */}
                                                        {
                                                            isCompleted && (set.restStatus === 'running' || set.restStatus === 'paused' || set.restStatus === 'completed') && (
                                                                <div className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-2 mt-1 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Descanso</span>
                                                                        <RestTimerDisplay
                                                                            status={set.restStatus}
                                                                            accumulated={set.restAccumulated || 0}
                                                                            lastStartTime={set.restLastStartTime}
                                                                        />
                                                                    </div>

                                                                    {/* Pause/Resume Button (Only if not completed/stopped by next set) */}
                                                                    {set.restStatus !== 'completed' && (
                                                                        <button
                                                                            onClick={() => toggleTimerPause(mapIndex, setIndex)}
                                                                            className={`p-1.5 rounded-full transition-colors ${set.restStatus === 'paused' ? 'bg-yellow-500/10 text-yellow-500' : 'text-neutral-500 hover:text-white'}`}
                                                                            title={set.restStatus === 'paused' ? "Reanudar" : "Pausar"}
                                                                        >
                                                                            {set.restStatus === 'paused' ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )
                                                        }
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
                                                        disabled={isFinalizing}
                                                        className="w-full bg-gradient-to-br from-yellow-400 to-orange-500 text-black font-black uppercase tracking-[0.2em] py-5 rounded-xl shadow-[0_0_30px_rgba(250,204,21,0.5)] hover:shadow-[0_0_50px_rgba(250,204,21,0.7)] text-lg hover:-translate-y-1 active:scale-95 transition-all duration-300 relative overflow-hidden group border border-yellow-300/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isFinalizing ? (
                                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                                <Loader2 className="animate-spin" size={20} />
                                                                Guardando...
                                                            </span>
                                                        ) : (
                                                            <span className="relative z-10">Finalizar Entrenamiento</span>
                                                        )}
                                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-md" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                            }
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
                        <div className="flex-none p-2.5 pb-1 border-b border-white/5 bg-neutral-950">
                            <div className="flex justify-between items-center mb-2">
                                <div>
                                    <h2 className="text-lg md:text-2xl font-black text-white italic uppercase tracking-tighter">
                                        {isCreatingExercise ? (editingItem ? 'Editar Ejercicio' : 'Crear Ejercicio') : 'Catálogo'}
                                    </h2>
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
                                }} className="bg-neutral-900 p-1.5 rounded-full text-white hover:bg-neutral-800 transition-colors">
                                    {isCreatingExercise ? <ArrowLeft size={16} /> : <X size={16} />}
                                </button>
                            </div>

                            {/* Search Bar - only show if NOT creating custom */}
                            {!isCreatingExercise && (
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-neutral-500" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar ejercicio o máquina..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2 pl-9 text-xs md:text-sm text-white focus:outline-none focus:border-gym-primary transition-all font-bold"
                                        autoFocus
                                    />
                                </div>
                            )}

                            {/* Muscle Filter Bar */}
                            {!isCreatingExercise && (
                                <div className="mt-2 flex gap-2 overflow-x-auto py-1 px-1 no-scrollbar scroll-smooth items-center">
                                    {/* --- RAMA: PECHO --- */}
                                    <button
                                        onClick={() => scrollToCategory("PECHO")}
                                        className={`shrink-0 px-6 py-2.5 rounded-xl text-sm font-black italic uppercase tracking-tighter transition-all border-2 ${activeMuscleFilter === "PECHO" ? 'bg-gym-primary text-black border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'bg-neutral-900 text-gym-primary border-neutral-800'}`}
                                    >
                                        PECHO
                                    </button>
                                    {["PECHO", "HOMBRO", "TRÍCEPS"].map(sub => (
                                        <button
                                            key={sub}
                                            onClick={() => scrollToCategory(sub)}
                                            className={`shrink-0 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${activeMuscleFilter === sub ? 'bg-white text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}
                                        >
                                            {sub}
                                        </button>
                                    ))}

                                    <div className="w-px h-6 bg-neutral-800 mx-2 shrink-0" />

                                    {/* --- RAMA: ESPALDA --- */}
                                    <button
                                        onClick={() => scrollToCategory("ESPALDA")}
                                        className={`shrink-0 px-6 py-2.5 rounded-xl text-sm font-black italic uppercase tracking-tighter transition-all border-2 ${activeMuscleFilter === "ESPALDA" ? 'bg-gym-primary text-black border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'bg-neutral-900 text-gym-primary border-neutral-800'}`}
                                    >
                                        ESPALDA
                                    </button>
                                    {["ESPALDA", "BÍCEPS", "ANTEBRAZO"].map(sub => (
                                        <button
                                            key={sub}
                                            onClick={() => scrollToCategory(sub)}
                                            className={`shrink-0 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${activeMuscleFilter === sub ? 'bg-white text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}
                                        >
                                            {sub}
                                        </button>
                                    ))}

                                    <div className="w-px h-6 bg-neutral-800 mx-2 shrink-0" />

                                    {/* --- RAMA: PIERNA --- */}
                                    <button
                                        onClick={() => scrollToCategory("PIERNA")}
                                        className={`shrink-0 px-6 py-2.5 rounded-xl text-sm font-black italic uppercase tracking-tighter transition-all border-2 ${activeMuscleFilter === "PIERNA" ? 'bg-gym-primary text-black border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'bg-neutral-900 text-gym-primary border-neutral-800'}`}
                                    >
                                        PIERNA
                                    </button>
                                    {["CUÁDRICEPS", "ISQUIOTIBIALES", "GLÚTEOS", "PANTORRILLAS", "ADUCTORES"].map(sub => (
                                        <button
                                            key={sub}
                                            onClick={() => scrollToCategory(sub)}
                                            className={`shrink-0 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${activeMuscleFilter === sub ? 'bg-white text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}
                                        >
                                            {sub}
                                        </button>
                                    ))}

                                    <div className="w-px h-6 bg-neutral-800 mx-2 shrink-0" />

                                    {/* --- RAMA: CORE --- */}
                                    <button
                                        onClick={() => scrollToCategory("CORE")}
                                        className={`shrink-0 px-6 py-2.5 rounded-xl text-sm font-black italic uppercase tracking-tighter transition-all border-2 ${activeMuscleFilter === "CORE" ? 'bg-gym-primary text-black border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'bg-neutral-900 text-gym-primary border-neutral-800'}`}
                                    >
                                        CORE
                                    </button>
                                    {["ABDOMINALES", "LUMBARES", "CUELLO"].map(sub => (
                                        <button
                                            key={sub}
                                            onClick={() => scrollToCategory(sub)}
                                            className={`shrink-0 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${activeMuscleFilter === sub ? 'bg-white text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}
                                        >
                                            {sub}
                                        </button>
                                    ))}

                                    <div className="w-px h-6 bg-neutral-800 mx-2 shrink-0" />

                                    {/* --- RAMA: CARDIO --- */}
                                    <button
                                        onClick={() => scrollToCategory("CARDIO")}
                                        className={`shrink-0 px-6 py-2.5 rounded-xl text-sm font-black italic uppercase tracking-tighter transition-all border-2 ${activeMuscleFilter === "CARDIO" ? 'bg-gym-primary text-black border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'bg-neutral-900 text-gym-primary border-neutral-800'}`}
                                    >
                                        CARDIO
                                    </button>
                                </div>
                            )}
                        </div>

                        <div ref={catalogScrollRef} className="flex-1 overflow-y-auto min-h-0 px-2 sm:px-4 pb-32 bg-black">
                            {!isCreatingExercise ? (
                                <div className="pt-4">
                                    <ArsenalGrid
                                        inventory={effectiveInventory}
                                        selectedItems={selectedCatalogItems}
                                        userSettings={userSettings}
                                        searchTerm={searchTerm}
                                        onToggleSelection={handleCatalogToggle}
                                        onOpenCatalog={() => { }}
                                        onEditItem={setEditingItem}
                                        sectionOrder={CATALOG_ORDER}
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
                                    activeSection={activeMuscleFilter || 'CHEST'}
                                    catalogItems={catalogItems}
                                    onQuickAdd={(seed) => {
                                        // Quick Add Seed from Catalog
                                        const tempId = `virtual-${seed.name}`;
                                        // Create virtual item object since it might not be in the list yet
                                        // @ts-expect-error - ignore typing
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
                                    disabled={isSavingFlow || isFinalizing || !routineName.trim()}
                                    className="w-full bg-gym-primary text-black font-black uppercase py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2"
                                >
                                    {(isSavingFlow || isFinalizing) ? <Loader className="animate-spin" size={20} /> : <Check size={20} strokeWidth={3} />}
                                    GUARDAR RUTINA
                                </button>

                                <button
                                    onClick={onSkipRoutine}
                                    disabled={isSavingFlow || isFinalizing}
                                    className="w-full bg-transparent border border-neutral-800 text-neutral-400 font-bold uppercase py-3 rounded-xl hover:text-white hover:border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    NO GUARDAR
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
                                            // 1. Instant UI Feedback
                                            setShowStartOptionsModal(false);
                                            setCurrentRoutineName(routine.name);

                                            // 2. Sequential Async Setup
                                            (async () => {
                                                const result = await startNewSession();
                                                await loadRoutine(routine, result?.freshArsenal);
                                            })();
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


                            </div>
                        </div>
                    </div>
                )
            }
            {/* FULL-SCREEN PREMIUM FINALIZING OVERLAY */}
            {isFinalizing && !showSummary && (
                <div className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-6 text-center max-w-xs relative">
                        {/* Pulse Ambient Effect */}
                        <div className="absolute inset-0 bg-gym-primary/10 blur-3xl rounded-full scale-150 animate-pulse pointer-events-none" />

                        {/* Custom Rotating Loader with Swords / Activity Icons */}
                        <div className="relative flex items-center justify-center w-24 h-24">
                            <Loader2 className="text-gym-primary animate-spin w-20 h-20" strokeWidth={1.5} />
                            <div className="absolute flex items-center justify-center w-12 h-12 bg-neutral-900 border border-white/10 rounded-full shadow-lg">
                                <Activity className="text-gym-primary w-6 h-6 animate-pulse" />
                            </div>
                        </div>

                        {/* Title and Progress message */}
                        <div className="space-y-2 mt-4 relative z-10">
                            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                                GUARDANDO BATALLA
                            </h2>
                            <p className="text-neutral-400 font-medium text-sm animate-pulse">
                                Persistiendo tus récords y notificando a tus aliados...
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

// --- HELPER FUNCTIONS ---

// GPS Helpers Removed
