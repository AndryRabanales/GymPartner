import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, ChevronRight, Check, Swords, Loader, Trash2, Dumbbell, Save, Edit2, X } from 'lucide-react';
import { userService } from '../services/UserService';
import { InteractiveOverlay } from '../components/onboarding/InteractiveOverlay';
import type { Equipment } from '../services/GymEquipmentService';
import { equipmentService, COMMON_EQUIPMENT_SEEDS, EQUIPMENT_CATEGORIES } from '../services/GymEquipmentService';
import type { CustomCategory, CustomSettings } from '../services/GymEquipmentService';
import { workoutService } from '../services/WorkoutService';
import { supabase } from '../lib/supabase';
import { PublicTeaser } from '../components/common/PublicTeaser';
import { normalizeText, getMuscleGroup } from '../utils/inventoryUtils';
import { ArsenalCard } from '../components/arsenal/ArsenalCard';
import { ArsenalGrid } from '../components/arsenal/ArsenalGrid';
import { EquipmentForm } from '../components/arsenal/EquipmentForm';

// Local constants removed in favor of Service imports


export const MyArsenal = () => {
    const { user } = useAuth();
    const { gymId: routeGymId } = useParams<{ gymId: string }>();
    const navigate = useNavigate();

    if (!user) {
        return (
            <PublicTeaser
                icon={Dumbbell}
                title="Tu Armería Personal"
                description="Digitaliza el inventario de tu gimnasio y diseña estrategias de entrenamiento ultra-precisas."
                benefitTitle="Arsenal Digital"
                benefitDescription="Sabe exactamente qué máquinas hay en tu sede base. Configura métricas por equipo y optimiza cada serie."
                iconColor="text-purple-500"
                bgAccent="bg-purple-500/10"
            />
        );
    }

    const [loading, setLoading] = useState(true);

    const [viewMode, setViewMode] = useState<'ROUTINES' | 'MACHINES'>('ROUTINES');
    const [routines, setRoutines] = useState<any[]>([]);
    const [masterRoutines, setMasterRoutines] = useState<any[]>([]);
    const [inventory, setInventory] = useState<Equipment[]>([]);
    const [addingMode, setAddingMode] = useState(false);
    const [importingMode, setImportingMode] = useState(false);
    const [activeSection, setActiveSection] = useState<string | null>(null);

    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [routineConfigs, setRoutineConfigs] = useState<Map<string, any>>(new Map()); // Persistence State
    const [routineName, setRoutineName] = useState('');
    const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // TUTORIAL STATE
    const [tutorialStep, setTutorialStep] = useState(0);
    useEffect(() => {
        const step = localStorage.getItem('tutorial_step');
        if (step) setTutorialStep(parseInt(step));
    }, []);

    // Custom Exercise State
    // Custom Exercise State (Simplified for EquipmentForm)
    const [userSettings, setUserSettings] = useState<CustomSettings>({ categories: [], metrics: [] });
    const [editingItem, setEditingItem] = useState<Equipment | null>(null);



    useEffect(() => {
        initialize();
    }, [user, routeGymId]);

    const resolveTargetGymId = async () => {
        if (!user) return null;
        if (routeGymId) return routeGymId;
        const gyms = await userService.getUserGyms(user.id);
        const gym = gyms.find(g => g.is_home_base) || gyms[0];
        return gym?.gym_id;
    };

    const initialize = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Fetch Routines for specific context (Gym vs Global)
            const userRoutines = await workoutService.getUserRoutines(user.id, routeGymId || null);
            setRoutines(userRoutines);

            // Fetch User Custom Settings
            const settings = await equipmentService.getUserSettings(user.id);
            setUserSettings(settings);

            // Fetch Master Routines for importing (if we are in a Gym)
            if (routeGymId) {
                const masters = await workoutService.getUserRoutines(user.id, null); // Global only
                setMasterRoutines(masters);
            }

            // Inventory Logic (Target Gym, Home Base, or Personal Virtual)
            let targetGymId = await resolveTargetGymId();

            if (!targetGymId) {
                // Fallback to Personal Gym for Global Mode to ensure we see Custom Items
                try {
                    targetGymId = await userService.ensurePersonalGym(user.id);
                } catch (e) {
                    console.warn("Could not load personal gym");
                }
            }

            if (targetGymId) {
                const items = await equipmentService.getInventory(targetGymId);

                // [FIX] ALWAYS Fetch Personal Inventory Logic
                // If the target gym is NOT the personal gym, we must ALSO fetch personal items
                // so the user has access to their "Global Custom Exercises" everywhere.
                let personalItems: Equipment[] = [];
                try {
                    const personalGymId = await userService.ensurePersonalGym(user.id);
                    if (personalGymId && personalGymId !== targetGymId) {
                        personalItems = await equipmentService.getInventory(personalGymId);
                        console.log('🔗 Merged Personal Inventory:', personalItems.length, 'items');
                    }
                } catch (e) { console.warn('Could not fetch personal inventory linkage', e); }

                // Merge: Personal Items + Gym Items (Gym items take precedence if ID conflict, although IDs should be unique)
                setInventory([...personalItems, ...items]);
            }

            // NEW: Fetch Global Exercises to match cloned routine IDs
            const { data: globalExs } = await supabase
                .from('gym_equipment')
                .select('id, name, category, icon, image_url')
                .limit(200);

            if (globalExs) {
                // Store global exercises in a separate state or merge?
                // Let's store them in a new state variable to merge cleanly
                setGlobalInventory(globalExs.map((e: any) => ({
                    id: e.id, // REAL UUID
                    name: e.name,
                    category: 'FREE_WEIGHT', // Default/Fallback
                    quantity: 999,
                    condition: 'GOOD',
                    // Use fetched icon OR fallback to seed logic later if missing
                    icon: e.icon,
                    // Map muscle to category for filtering if needed?
                    // For now, let's keep it simple.
                })));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };



    const handleEditEquipment = (item: Equipment) => {
        // If it's a virtual item (default seed), we treat "Edit" as "Customize/Clone" -> Create New
        const isVirtual = item.id.startsWith('virtual-') || item.verified_by === null;

        if (isVirtual) {
            setEditingItem({ ...item, id: undefined } as any); // Treat as new, prepopulate form
        } else {
            setEditingItem(item); // Treat as update
        }
        setAddingMode(true);
    };

    const handleEquipmentSuccess = (newItem: Equipment, isEdit: boolean) => {
        // Optimistic Update
        if (isEdit) {
            setInventory(prev => prev.map(i => i.id === newItem.id ? newItem : i));
            setGlobalInventory(prev => prev.map(i => i.id === newItem.id ? newItem : i));
        } else {
            setInventory(prev => [...prev, newItem]);
            setGlobalInventory(prev => {
                if (prev.some(item => item.id === newItem.id)) return prev;
                return [...prev, newItem];
            });
            if (!editingItem) toggleSelection(newItem.id);
        }
        alert(`¡Ejercicio "${newItem.name}" guardado!`);
    };


    const handleImportRoutine = async (sourceRoutine: any) => {
        if (!user || !routeGymId) return;
        if (!confirm(`¿Importar estrategia "${sourceRoutine.name}" a este gimnasio?`)) return;

        setLoading(true);
        try {
            await workoutService.importRoutine(user.id, sourceRoutine.id, routeGymId);
            await initialize(); // Refresh
            setImportingMode(false);

            // TUTORIAL ADVANCE: Step 7 -> 8 (Go to Training)
            if (localStorage.getItem('tutorial_step') === '7') {
                localStorage.setItem('tutorial_step', '8');
                setTutorialStep(8);
                alert("¡Arsenal Listo!\n\nRegresando a la base para iniciar el entrenamiento.");
                navigate(-1); // Go back immediately to WorkoutSession/Profile
            } else {
                alert("¡Rutina Importada con éxito!");
            }
        } catch (error) {
            console.error(error);
            alert("Error al importar estrategia.");
        } finally {
            setLoading(false);
        }
    };


    const toggleSelection = (id: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });

        // TUTORIAL RELEASE: If in Step 4 and selecting an item, finish tutorial
        // [FIX] REMOVED: This was killing the tutorial before saving! 
        // We want to keep it at 4 until they click SAVE.
        /*
        if (tutorialStep === 4) {
            setTutorialStep(0);
            localStorage.setItem('tutorial_step', '0');
        }
        */
    };

    const handleEditRoutine = async (routine: any) => {
        console.log('Editing Routine:', routine.name, 'IDs:', routine.equipment_ids);
        setEditingRoutineId(routine.id);
        setRoutineName(routine.name);

        // Fetch Full details to get Names and Configs
        try {
            const details = await userService.getRoutineDetails(routine.id);
            const exercises = details?.exercises || [];

            const resolvedIDs = new Set<string>();
            const newConfigs = new Map<string, any>();
            const ghostItems: Equipment[] = [];

            exercises.forEach((ex: any) => {
                const normName = normalizeText(ex.name);
                let finalId = ex.exercise_id; // Default to existing ID
                let foundMatch = false;

                // 1. Check Custom Inventory (Real ID)
                const customMatch = inventory.find(i => i.id === ex.exercise_id || normalizeText(i.name) === normName);
                if (customMatch) {
                    finalId = customMatch.id;
                    foundMatch = true;
                }

                // 2. Check Global Inventory (Real ID)
                if (!foundMatch) {
                    const globalMatch = globalInventory.find(i => i.id === ex.exercise_id || normalizeText(i.name) === normName);
                    if (globalMatch) {
                        finalId = globalMatch.id;
                        foundMatch = true;
                    }
                }

                // 3. Check Seeds (Virtual ID)
                if (!foundMatch) {
                    const seedMatch = COMMON_EQUIPMENT_SEEDS.find(s => normalizeText(s.name) === normName);
                    if (seedMatch) {
                        finalId = `virtual-${seedMatch.name}`;
                        foundMatch = true;
                    }
                }

                // 4. Ghost Handling (Imported Item not found locally)
                // If we still haven't found a match in our view, we must create a "Ghost" item
                // so the user can see it selected.
                if (!foundMatch) {
                    console.log(`[Ghost] reviving item: ${ex.name} (${ex.exercise_id})`);
                    // Create a temporary "Ghost" item for display
                    const ghost: Equipment = {
                        id: ex.exercise_id, // Keep original ID
                        name: ex.name || 'Ejercicio Importado',
                        category: ex.muscle_group || 'FREE_WEIGHT', // Fallback
                        quantity: 1,
                        condition: 'GOOD',
                        gym_id: 'ghost',
                        icon: ex.icon || '👻',
                        metrics: {
                            weight: ex.track_weight,
                            reps: ex.track_reps,
                            time: ex.track_time
                        }
                    };
                    ghostItems.push(ghost);
                    foundMatch = true;
                }

                if (foundMatch) {
                    resolvedIDs.add(finalId);

                    // Recover Config
                    newConfigs.set(finalId, {
                        track_weight: ex.track_weight,
                        track_reps: ex.track_reps,
                        track_time: ex.track_time,
                        track_pr: ex.track_pr,
                        track_distance: ex.track_distance,
                        track_rpe: ex.track_rpe,
                        custom_metric: ex.custom_metric,
                    });
                }
            });

            // Add Ghosts to View if needed
            if (ghostItems.length > 0) {
                setGlobalInventory(prev => {
                    // Avoid dupes in globalInventory just in case
                    const existingIds = new Set(prev.map(p => p.id));
                    const uniqueGhosts = ghostItems.filter(g => !existingIds.has(g.id));
                    return [...prev, ...uniqueGhosts];
                });
            }

            console.log(`Resolved ${resolvedIDs.size} IDs from ${exercises.length} exercises via Match/Ghost logic`);
            setSelectedItems(resolvedIDs);
            setRoutineConfigs(newConfigs);

        } catch (e) {
            console.error("Error resolving routine details for edit:", e);
            // Fallback to raw IDs if fetch fails
            if (routine.equipment_ids) {
                setSelectedItems(new Set(routine.equipment_ids));
            } else {
                setSelectedItems(new Set());
            }
        }

        setViewMode('MACHINES');
    };

    const handleCreateNew = () => {
        setEditingRoutineId(null);
        setRoutineName('');
        setSelectedItems(new Set());
        setRoutineConfigs(new Map());
        setViewMode('MACHINES');
        setSearchTerm('');

        // TUTORIAL ADVANCE: Step 2 -> 3
        if (tutorialStep === 2) {
            setTutorialStep(3);
            localStorage.setItem('tutorial_step', '3');
        }
    };

    const handleDeleteRoutine = async (routineId: string, routineName: string) => {
        if (!confirm(`¿Eliminar estrategia "${routineName}" permanentemente?`)) return;

        // Optimistic update or refresh
        const { error } = await workoutService.deleteRoutine(routineId);

        if (error) {
            console.error(error);
            alert("Error al eliminar la estrategia.");
            return;
        }

        initialize(); // Refresh routines
    };

    const [globalInventory, setGlobalInventory] = useState<Equipment[]>([]);

    // --- Merge Real Inventory with Global & Seeds ---
    // 1. Custom Inventory (User's Items) - PRIMARY SOURCE OF TRUTH
    // 2. Global Inventory (System Items) - FALLBACK
    // 3. Seeds (Virtual fallback) - LAST RESORT

    // Create a Set of normalized names existing in Local Inventory to prevent ghosts showing up
    const localNames = new Set(inventory.map(i => normalizeText(i.name)));
    const localIds = new Set(inventory.map(i => i.id));

    // Filter Globals: Only include if NOT present locally (by Name OR ID)
    const filteredGlobals = globalInventory.filter(g =>
        !localIds.has(g.id) && !localNames.has(normalizeText(g.name))
    );

    const effectiveInventory = [...inventory, ...filteredGlobals];

    // Merge Seeds (Virtual) only if not already present by NAME in the real/global list
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

    const handleOpenCatalog = (section: string) => {
        setActiveSection(section);
        setAddingMode(true);
    };

    // Filter seeds for the catalog modal based on active section
    const catalogItems = COMMON_EQUIPMENT_SEEDS.filter(seed => {
        // @ts-ignore
        if (activeSection && EQUIPMENT_CATEGORIES[seed.category]) {
            // @ts-ignore
            const catLabel = EQUIPMENT_CATEGORIES[seed.category].label;
            if (activeSection === 'Pecho' && catLabel === 'Pecho') return true;
            // Simplified check:
            return getMuscleGroup({ name: seed.name, category: seed.category }, userSettings) === activeSection;
        }
        return false;
    });

    const handleQuickAdd = (seedItem: any) => {
        // Create virtual item
        const tempId = `virtual-${seedItem.name}`;
        // Just select it
        if (!selectedItems.has(tempId)) {
            toggleSelection(tempId);
        }
        // Set adding mode to false to close modal
        setAddingMode(false);
    };

    const handleSaveRoutine = async () => {
        // [FIX] Allow Saving even if routeGymId is null (Global Routine / Master Arsenal)
        if (!user) {
            alert("Error: Usuario no identificado.");
            return;
        }

        if (!routineName.trim()) {
            alert("Tu estrategia necesita un nombre legendario.");
            return;
        }
        if (selectedItems.size === 0) {
            alert("Selecciona al menos una máquina para la batalla.");
            return;
        }

        setIsSaving(true);
        try {
            const finalEquipmentIds: string[] = [];
            const finalConfigPayload: any[] = [];

            const selectedArray = Array.from(selectedItems);

            for (const id of selectedArray) {
                let finalId = id;
                let finalName = '';

                // 1. Check if it's a GHOST item (Imported but not local)
                // We find it in the current view (globalInventory includes ghosts now)
                const ghostItem = globalInventory.find(i => i.id === id && i.gym_id === 'ghost');

                if (ghostItem) {
                    finalName = ghostItem.name;
                    // We need to REALIFY this ghost:
                    // Check if we already have a real item with this name in Personal Gym
                    const personalGymId = await userService.ensurePersonalGym(user.id);

                    // Try to find existing by Name in Personal Gym to avoid dupes
                    let { data: existingReal } = await supabase
                        .from('gym_equipment')
                        .select('id, name')
                        .eq('gym_id', personalGymId)
                        .ilike('name', ghostItem.name) // Case insensitive match
                        .maybeSingle();

                    if (existingReal) {
                        console.log(`[Ghost] Linking to existing local item: ${existingReal.name}`);
                        finalId = existingReal.id;
                    } else {
                        console.log(`[Ghost] CLONING item to Personal Gym: ${ghostItem.name}`);
                        // CLONE IT
                        const newEq = await equipmentService.addEquipment({
                            name: ghostItem.name,
                            category: ghostItem.category,
                            gym_id: personalGymId,
                            quantity: 1,
                            condition: 'GOOD',
                            icon: ghostItem.icon
                        }, user.id);
                        if (newEq) {
                            finalId = newEq.id;
                        }
                    }
                }

                // 2. Resolve Virtual IDs to Real Items (Seeds)
                else if (id.startsWith('virtual-')) {
                    const seedName = id.replace('virtual-', '');
                    const seedData = COMMON_EQUIPMENT_SEEDS.find(s => s.name === seedName);
                    finalName = seedName;

                    if (seedData) {
                        const targetGymId = await resolveTargetGymId();

                        if (targetGymId) {
                            // Local Gym check
                            const existingLocal = inventory.find(i => normalizeText(i.name) === normalizeText(seedName));
                            if (existingLocal) {
                                finalId = existingLocal.id;
                            } else {
                                // Create new physical item
                                const { targetMuscle, ...cleanSeed } = seedData as any;
                                const newEq = await equipmentService.addEquipment({
                                    name: cleanSeed.name,
                                    category: cleanSeed.category,
                                    gym_id: targetGymId,
                                    quantity: 1,
                                    condition: 'GOOD',
                                    icon: (cleanSeed as any).icon
                                }, user.id);
                                if (newEq) finalId = newEq.id;
                            }
                        } else {
                            // Personal/Global Fallback
                            const personalGymId = await userService.ensurePersonalGym(user.id);
                            let { data: globalItem } = await supabase.from('gym_equipment').select('id').eq('gym_id', personalGymId).eq('name', seedName).maybeSingle();

                            if (!globalItem) {
                                const { targetMuscle, ...cleanSeed } = seedData as any;
                                const newItem = await equipmentService.addEquipment({
                                    name: cleanSeed.name,
                                    category: cleanSeed.category,
                                    gym_id: personalGymId,
                                    quantity: 1,
                                    condition: 'GOOD',
                                    icon: (cleanSeed as any).icon
                                }, user.id);
                                globalItem = newItem;
                            }
                            if (globalItem) finalId = globalItem.id;
                        }
                    }
                } // Close Virtual Block

                // 3. Fallback: If it's a real ID, we must verify it or just trust it?
                // If it's in inventory or global, it's real.
                else {
                    const existingItem = inventory.find(i => i.id === id) || globalInventory.find(i => i.id === id);
                    if (!existingItem) {
                        // Edge case: Item existed when selected, but maybe deleted? 
                        // Or it's a raw ID from edit mode that isn't fully loaded in inventory views?
                        // We'll trust the ID if it looks like a UUID.
                        if (id.includes('-')) {
                            finalId = id;
                        } else {
                            console.warn("Skipping INVALID Item ID:", id);
                            continue;
                        }
                    } else {
                        finalName = existingItem.name;
                        finalId = existingItem.id;
                    }
                }

                if (!finalId || finalId.startsWith('virtual-')) {
                    throw new Error(`Error fatal: No se pudo resolver el ID para el ejercicio "${finalName || id}". Intenta recargar.`);
                }

                finalEquipmentIds.push(finalId);

                // Get Preserved Config
                const config = routineConfigs.get(id) || {};

                // Get icon from the existing item
                const existingItem = inventory.find(i => i.id === finalId) ||
                    globalInventory.find(i => i.id === finalId);

                const defaultMetrics = (existingItem?.metrics as any) || { weight: true, reps: true };

                finalConfigPayload.push({
                    id: finalId, // The REAL DB UUID
                    name: finalName,
                    icon: existingItem?.icon,
                    // Map from config OR from equipment metrics (time -> track_time)
                    track_weight: config.track_weight !== undefined ? config.track_weight : (defaultMetrics.weight ?? true),
                    track_reps: config.track_reps !== undefined ? config.track_reps : (defaultMetrics.reps ?? true),
                    track_time: config.track_time !== undefined ? config.track_time : (defaultMetrics.time ?? false),
                    track_pr: config.track_pr !== undefined ? config.track_pr : (defaultMetrics.track_pr ?? false),
                    track_distance: config.track_distance !== undefined ? config.track_distance : (defaultMetrics.distance ?? false),
                    track_rpe: config.track_rpe !== undefined ? config.track_rpe : (defaultMetrics.rpe ?? false),
                    custom_metric: config.custom_metric !== undefined ? config.custom_metric : (defaultMetrics.custom_metric ?? null)
                });
            }

            console.log('SAVING ROUTINE with Verified IDs:', finalConfigPayload);

            if (editingRoutineId) {
                const { error } = await workoutService.updateRoutine(editingRoutineId, routineName, finalConfigPayload);
                if (error) throw error;
                alert("¡Estrategia actualizada correctamente!");
            } else {
                // 2-Step Creation for Rich Config
                const { data, error } = await workoutService.createRoutine(user.id, routineName, [], routeGymId);
                if (error) throw error;

                if (data) {
                    const { error: updateError } = await workoutService.updateRoutine(data.id, routineName, finalConfigPayload);
                    if (updateError) throw updateError;
                }
                alert("¡Nueva estrategia forjada!");

                // TUTORIAL LOGIC:
                // Step 4 (Creation Save) -> Step 5 (Profile Select Gym)
                // Step 6 (Import Save) -> Step 7 (Profile Start)
                const currentStep = localStorage.getItem('tutorial_step');
                console.log('[TUTORIAL] Saving routine, current step:', currentStep);

                // Allow 2, 3, 4, 5
                if (currentStep && ['2', '3', '4', '5'].includes(currentStep)) {
                    console.log('[TUTORIAL] Transitioning to step 5 and redirecting to home');
                    localStorage.setItem('tutorial_step', '5');
                    setTutorialStep(5);

                    // Force full page reload to UserProfile with explicit tutorial param
                    window.location.href = '/?tutorial=5';
                    return; // Exit early
                }
                // Note: Import logic handles Step 6 elsewhere usually, or if Save handles imports too:
                if (currentStep === '6' && routeGymId) {
                    console.log('[TUTORIAL] Import completed, transitioning to step 7');
                    localStorage.setItem('tutorial_step', '7');
                    setTutorialStep(7);
                    alert("¡Rutina importada con éxito!\n\nRegresa al INICIO para comenzar el entrenamiento.");
                    navigate(-1); // Go back to UserProfile
                    return;
                }
            }

            // Reset
            handleCreateNew();
            initialize(); // Refresh lists
            setViewMode('ROUTINES'); // Go back to list

        } catch (error: any) {
            console.error(error);
            alert(`Error al guardar: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };


    if (loading) return <div className="h-screen flex items-center justify-center bg-black text-gym-primary"><Loader className="animate-spin" /></div>;

    // RENDER ROUTINE LIST (Level 1)
    if (viewMode === 'ROUTINES') {
        return (
            <div className="min-h-screen bg-black text-white p-4 md:p-12 pb-24 font-sans selection:bg-gym-primary selection:text-black">
                <div className="max-w-7xl mx-auto">
                    {/* Header - Compact */}
                    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6 md:mb-12">
                        <div className="flex items-center gap-3">
                            <Link id="tut-arsenal-back-btn" to="/" className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center bg-neutral-900 rounded-full hover:bg-neutral-800 hover:text-gym-primary transition-all border border-neutral-800 shrink-0">
                                <ArrowLeft size={16} className="md:w-6 md:h-6" />
                            </Link>
                            <div>
                                <h1 className="text-xl md:text-5xl font-black uppercase italic tracking-tighter leading-none">Mi Arsenal <span className="text-gym-primary">⚔️</span></h1>
                                <p className="text-neutral-500 text-xs md:text-lg font-bold">
                                    {routeGymId ? "Arsenal de Territorio (Local)" : "Rutinas Maestras (Global)"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                        {/* CREATE / IMPORT CARD */}
                        {!routeGymId ? (
                            // GLOBAL: Create New Master
                            <button
                                id="tut-new-routine-btn"
                                onClick={handleCreateNew}
                                className="bg-neutral-900 border border-neutral-800 hover:border-gym-primary/50 hover:bg-neutral-800 p-6 rounded-2xl flex flex-col items-center justify-center gap-4 group transition-all h-[200px]"
                            >
                                <div className="w-16 h-16 rounded-full bg-gym-primary/10 flex items-center justify-center group-hover:bg-gym-primary group-hover:text-black transition-colors text-gym-primary">
                                    <Plus size={32} />
                                </div>
                                <span className="font-black italic uppercase tracking-wider text-neutral-400 group-hover:text-white">Nueva Rutina Maestra</span>
                            </button>
                        ) : (
                            // GYM: Create OR Import
                            <div className="flex gap-2 h-[200px]">
                                <button
                                    id="tut-new-routine-btn"
                                    onClick={handleCreateNew}
                                    className="flex-1 bg-neutral-900 border border-neutral-800 hover:border-gym-primary/50 hover:bg-neutral-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all"
                                >
                                    <div className="w-12 h-12 rounded-full bg-gym-primary/10 flex items-center justify-center group-hover:bg-gym-primary group-hover:text-black transition-colors text-gym-primary">
                                        <Plus size={24} />
                                    </div>
                                    <span className="font-bold text-xs uppercase text-neutral-400 group-hover:text-white">Crear</span>
                                </button>
                                <button
                                    id="tut-import-routine-btn"
                                    onClick={() => setImportingMode(true)}
                                    className="flex-1 bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all"
                                >
                                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-black transition-colors text-blue-500">
                                        <Dumbbell size={24} />
                                    </div>
                                    <span className="font-bold text-xs uppercase text-neutral-400 group-hover:text-white">Importar</span>
                                </button>
                            </div>
                        )}

                        {/* TUTORIAL OVERLAY STEP 2 (Create Routine) */}
                        {tutorialStep === 2 && !addingMode && !importingMode && (
                            <InteractiveOverlay
                                targetId="tut-new-routine-btn"
                                title="PASO 2: NUEVA RUTINA"
                                message="Haz clic aquí para crear una nueva rutina personalizada desde cero."
                                step={2}
                                totalSteps={7}
                                onNext={() => { }}
                                onClose={() => {
                                    setTutorialStep(0);
                                    localStorage.setItem('hasSeenImportTutorial', 'true');
                                }}
                                placement="bottom"
                                disableNext={true}
                            />
                        )}

                        {/* TUTORIAL OVERLAY STEP 7 (Import Strategy) */}
                        {tutorialStep === 7 && !addingMode && !importingMode && (
                            <InteractiveOverlay
                                targetId="tut-import-routine-btn"
                                title="PASO 7: DESPLIEGUE RÁPIDO"
                                message="Tu base está vacía. Haz clic en 'IMPORTAR MAESTRA' para equiparla con tu estrategia predefinida."
                                step={7}
                                totalSteps={8}
                                onNext={() => { }}
                                onClose={() => {
                                    setTutorialStep(0);
                                    localStorage.setItem('hasSeenImportTutorial', 'true');
                                }}
                                placement="top"
                                disableNext={true}
                            />
                        )}

                        {/* Existing Routines */}
                        {
                            routines.map(routine => (
                                <div key={routine.id} className="group relative bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-4 md:p-8 transition-all hover:bg-neutral-800/50 flex flex-col justify-between min-h-[140px] md:min-h-[280px]">
                                    <div className="absolute top-2 right-2 md:top-0 md:right-0 md:p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Swords size={40} className="md:w-[120px] md:h-[120px]" />
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRoutine(routine.id, routine.name); }}
                                        className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                        title="Eliminar Rutina"
                                    >
                                        <Trash2 size={14} className="md:w-5 md:h-5" />
                                    </button>

                                    <div className="relative z-10">
                                        <h3 className="font-black text-lg md:text-3xl text-white mb-1 md:mb-2 italic uppercase leading-none truncate">{routine.name}</h3>
                                        <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2 mt-2 md:mt-4">
                                            <span className="w-fit px-2 py-0.5 bg-neutral-800 rounded-md text-[9px] md:text-xs font-bold text-neutral-400 border border-neutral-700">
                                                {new Date(routine.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                            <span className="w-fit px-2 py-0.5 bg-gym-primary/10 text-gym-primary rounded-md text-[9px] md:text-xs font-bold border border-gym-primary/20">
                                                {(routine.equipment_ids?.length || routine.routine_exercises?.length || routine.routine_items?.length || 0)} Items
                                            </span>
                                        </div>
                                    </div>

                                    <button onClick={() => handleEditRoutine(routine)} className="relative z-10 w-full mt-3 md:mt-8 bg-white/5 hover:bg-gym-primary hover:text-black text-white px-3 md:px-6 py-2 md:py-4 rounded-lg md:rounded-xl font-bold uppercase tracking-wide transition-colors flex items-center justify-between text-[10px] md:text-base border border-white/10 hover:border-transparent">
                                        <span>Editar Local</span>
                                        <ChevronRight size={14} className="md:w-5 md:h-5" />
                                    </button>
                                </div>
                            ))}

                        {/* CEO Empty State: Mission Briefing */}
                        {routines.length === 0 && (
                            <div className="col-span-2 lg:col-span-3 py-12 px-6 bg-neutral-900/40 border border-dashed border-neutral-800 rounded-[2.5rem] flex flex-col items-center text-center space-y-6">
                                <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center text-neutral-600">
                                    <Swords size={40} />
                                </div>
                                <div className="max-w-md">
                                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Despliegue Requerido</h3>
                                    <p className="text-neutral-500 text-sm font-medium">
                                        No se han detectado estrategias de combate en este sector.
                                        Crea una nueva rutina maestra o importa una del Cuartel General para comenzar.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <button
                                        onClick={handleCreateNew}
                                        className="bg-gym-primary text-black font-black px-8 py-3 rounded-xl hover:bg-yellow-400 transition-all flex items-center gap-2 shadow-lg shadow-gym-primary/10"
                                    >
                                        <Plus size={20} strokeWidth={3} />
                                        NUEVA ESTRATEGIA
                                    </button>
                                    {routeGymId && (
                                        <button
                                            id="tut-import-routine-btn"
                                            onClick={() => setImportingMode(true)}
                                            className="bg-neutral-800 text-white font-bold px-8 py-3 rounded-xl hover:bg-neutral-700 transition-all border border-neutral-700"
                                        >
                                            IMPORTAR MAESTRA
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* TUTORIAL STEP 5 FALLBACK: Guide user back to Profile if they land here */}
                    {tutorialStep === 5 && (
                        <InteractiveOverlay
                            step={5}
                            totalSteps={7}
                            targetId="tut-arsenal-back-btn"
                            title="¡ESTRATEGIA FORJADA!"
                            message="Has creado tu primera rutina maestra. Ahora regresa a tu perfil para desplegarla en un gimnasio real."
                            placement="bottom"
                            onNext={() => { navigate('/'); }}
                            nextLabel="VOLVER AL INICIO"
                            onClose={() => { }}
                        />
                    )}

                    {/* IMPORT MODAL (Local Mode Only) */}
                    {importingMode && (
                        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                            <div className="bg-neutral-900 border border-white/10 w-full max-w-2xl rounded-[2rem] p-8 shadow-2xl relative max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <h2 className="text-3xl font-black italic text-white uppercase mb-1">Tu Arsenal Maestro</h2>
                                        <p className="text-neutral-400">Selecciona una estrategia para desplegar en este territorio.</p>
                                    </div>
                                    <button onClick={() => setImportingMode(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                        <Plus size={24} className="rotate-45" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {masterRoutines.length > 0 ? masterRoutines.map(master => (
                                        <button
                                            key={master.id}
                                            onClick={() => handleImportRoutine(master)}
                                            className="text-left bg-black border border-white/10 hover:border-gym-primary p-4 rounded-xl flex items-center justify-between group transition-all"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-gym-primary">
                                                    <Swords size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white text-lg group-hover:text-gym-primary transition-colors">{master.name}</h4>
                                                    <span className="text-neutral-500 text-xs">{master.equipment_ids?.length || 0} Items • Creada el {new Date(master.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white/5 px-4 py-2 rounded-lg text-sm font-bold text-white group-hover:bg-gym-primary group-hover:text-black transition-colors">
                                                IMPORTAR
                                            </div>
                                        </button>
                                    )) : (
                                        <div className="py-12 text-center">
                                            <p className="text-neutral-500 mb-4">No tienes estrategias maestras creadas.</p>
                                            <Link to="/arsenal" className="text-gym-primary underline font-bold">Ir a crear una Maestra</Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // RENDER MACHINE INVENTORY (Level 2 - Builder Logic)
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-gym-primary selection:text-black">
            {/* STATIC HEADER - SCROLLS AWAY */}
            <div className="bg-black/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
                <div className="max-w-7xl mx-auto p-2 md:p-6 flex flex-col gap-2 md:gap-4">

                    {/* Compact Top Row: Nav + Title + Mobile Save */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setViewMode('ROUTINES')} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10">
                                <ArrowLeft size={16} className="md:w-5 md:h-5" />
                            </button>
                            <h2 className="text-base md:text-2xl font-black italic uppercase tracking-tight flex items-center gap-2 leading-none">
                                {editingRoutineId ? 'Edit' : 'Nueva'} <span className="text-gym-primary">Estrategia</span>
                            </h2>
                        </div>

                        {/* Mobile Save Button (Icon Only) */}
                        <button
                            id="tut-save-routine-btn-mobile"
                            onClick={handleSaveRoutine}
                            disabled={isSaving}
                            className="md:hidden w-12 h-12 flex items-center justify-center bg-green-500 hover:bg-green-400 rounded-xl text-white shadow-[0_0_15px_rgba(34,197,94,0.5)] transition-all active:scale-95"
                        >
                            {isSaving ? <Loader size={20} className="animate-spin" /> : <Check size={28} strokeWidth={4} />}
                        </button>

                        {/* Desktop Save Button (Full) */}
                        <button
                            id="tut-save-routine-btn-desktop"
                            onClick={handleSaveRoutine}
                            disabled={isSaving}
                            className="hidden md:flex bg-gym-primary hover:bg-yellow-400 text-black font-black uppercase tracking-wider px-6 py-2.5 rounded-xl transition-all items-center gap-2 text-sm shadow-[0_0_20px_rgba(250,204,21,0.2)]"
                        >
                            {isSaving ? <Loader className="animate-spin" size={16} /> : <Check size={16} strokeWidth={3} />}
                            <span>Guardar Estrategia</span>
                        </button>
                    </div>

                    {/* Compact Inputs Row - FULL WIDTH MOBILE */}
                    <div className="flex flex-col md:flex-row gap-2 w-full">
                        {/* Routine Name Input */}
                        <div className="w-full md:w-1/3">
                            <input
                                id="tut-routine-name-input"
                                type="text"
                                placeholder="Nombre de la Rutina (Obligatorio)..."
                                value={routineName}
                                onChange={(e) => {
                                    setRoutineName(e.target.value);
                                    if (tutorialStep === 3 && e.target.value.length > 0) {
                                        setTutorialStep(4);
                                        localStorage.setItem('tutorial_step', '4');
                                    }
                                }}
                                required
                                className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-base text-white placeholder-white/30 focus:outline-none focus:bg-white/10 transition-all font-medium ${!routineName.trim() ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-gym-primary/50'}`}
                            />
                        </div>

                        {/* Responsive Search Bar */}
                        <div className="relative group w-full md:flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30 group-focus-within:text-gym-primary transition-colors">
                                <Search size={20} className="md:w-5 md:h-5" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar ejercicio en tu arsenal..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-base text-white placeholder-white/30 focus:outline-none focus:border-gym-primary/50 focus:bg-white/10 transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="max-w-7xl mx-auto px-4 md:px-6 pb-32 w-full relative">

                {/* TUTORIAL STEP 3: NAME STRATEGY */}
                {tutorialStep === 3 && (
                    <InteractiveOverlay
                        targetId="tut-routine-name-input"
                        title="PASO 3: BAUTIZA TU ESTRATEGIA"
                        message="Toda gran batalla comienza con un nombre. Escribe cómo llamarás a este plan de entrenamiento."
                        step={3}
                        totalSteps={7}
                        placement="bottom"
                        onClose={() => {
                            setTutorialStep(0);
                            localStorage.setItem('tutorial_step', '0');
                        }}
                        disableNext={true}
                    />
                )}

                {/* TUTORIAL STEP 4: SELECT WEAPONS AND SAVE */}
                {tutorialStep === 4 && (
                    <InteractiveOverlay
                        targetId={selectedItems.size > 0 ? "tut-save-routine-btn-mobile" : "tut-arsenal-grid"}
                        title={selectedItems.size > 0 ? "PASO 4: GUARDA TU ESTRATEGIA" : "PASO 4: ELIGE TUS ARMAS"}
                        message={selectedItems.size > 0
                            ? "¡Perfecto! Ahora haz clic en el botón verde ✓ para guardar tu rutina y continuar."
                            : "Selecciona las máquinas y ejercicios que formarán parte de esta rutina. Solo haz clic en ellas."}
                        step={4}
                        totalSteps={7}
                        placement="top"
                        onNext={() => {
                            // Do nothing - tutorial continues to Step 5 after save
                        }}
                        nextLabel={selectedItems.size > 0 ? "¡A GUARDAR!" : "¡Entendido!"}
                        onClose={() => {
                            setTutorialStep(0);
                            localStorage.setItem('tutorial_step', '0');
                        }}
                        disableNext={true}
                    />
                )}


                {/* Visual Stats Bar */}
                <div className="flex items-center gap-2 mb-4 px-1">
                    <div className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-bold text-neutral-400 whitespace-nowrap">
                        {inventory.length} Total
                    </div>
                    <div className="px-3 py-1 rounded-full bg-gym-primary/10 border border-gym-primary/20 text-[10px] font-bold text-gym-primary whitespace-nowrap">
                        {selectedItems.size} Selected
                    </div>
                </div>

                <ArsenalGrid
                    inventory={effectiveInventory}
                    selectedItems={selectedItems}
                    userSettings={userSettings}
                    searchTerm={searchTerm}
                    onToggleSelection={toggleSelection}
                    onOpenCatalog={handleOpenCatalog}
                    onEditItem={handleEditEquipment}
                    routineConfigs={routineConfigs}
                />
            </div>

            {addingMode && (
                <EquipmentForm
                    user={user}
                    userSettings={userSettings}
                    onUpdateSettings={setUserSettings}
                    editingItem={editingItem}
                    onClose={() => { setAddingMode(false); setEditingItem(null); }}
                    onSuccess={handleEquipmentSuccess}
                    activeSection={activeSection}
                    catalogItems={catalogItems}
                    onQuickAdd={handleQuickAdd}
                />
            )}

            {/* ROUTINE NAME & SAVE BAR (Floating at bottom for Creation Mode) */}
            {addingMode === false && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-950/90 backdrop-blur-xl border-t border-white/10 z-[60] animate-in slide-in-from-bottom-5">
                    <div className="max-w-7xl mx-auto flex items-center gap-4">
                        <div className="flex-1 max-w-xl relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-gym-primary/20 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full pointer-events-none"></div>
                            <input
                                id="tut-routine-name-input"
                                type="text"
                                placeholder="Nombre de la Nueva Rutina..."
                                className="w-full bg-black/50 border-2 border-white/10 rounded-2xl px-6 py-4 text-xl font-bold text-white placeholder-neutral-600 focus:border-gym-primary focus:outline-none focus:ring-4 focus:ring-gym-primary/10 transition-all shadow-inner"
                                value={routineName}
                                onChange={(e) => {
                                    setRoutineName(e.target.value);
                                    // TUTORIAL ADVANCE: Step 3 -> 4
                                    if (tutorialStep === 3 && e.target.value.length > 2) {
                                        setTutorialStep(4);
                                        localStorage.setItem('tutorial_step', '4');
                                    }
                                }}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none">
                                <Edit2 size={18} />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleCreateNew} // Cancel/Clear
                                className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
                            >
                                <X size={20} />
                            </button>

                            <button
                                id="tut-save-routine-btn"
                                onClick={handleSaveRoutine}
                                disabled={!routineName || isSaving || selectedItems.size === 0}
                                className="bg-gym-primary text-black px-8 py-4 rounded-xl font-black tracking-wide hover:shadow-[0_0_20px_rgba(250,204,21,0.4)] hover:scale-105 transition-all text-sm sm:text-base flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                            >
                                {/* Shimmer Effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-shimmer" />

                                {isSaving ? (
                                    <Loader size={20} className="animate-spin" />
                                ) : (
                                    <Save size={20} strokeWidth={2.5} />
                                )}
                                <span>{editingRoutineId ? 'ACTUALIZAR' : 'CREAR RUTINA'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TUTORIAL STEP 3 (Routine Name) */}
            {tutorialStep === 3 && (
                <InteractiveOverlay
                    targetId="tut-routine-name-input"
                    title="PASO 3: PONER NOMBRE OBLIGATORIO"
                    message="Escribe un nombre épico para tu nueva rutina (ej: 'Pecho Legendario')."
                    step={3}
                    totalSteps={7}
                    onNext={() => { }}
                    onClose={() => {
                        setTutorialStep(0);
                        localStorage.setItem('hasSeenImportTutorial', 'true');
                    }}
                    placement="top"
                    disableNext={true}
                />
            )}

            {/* TUTORIAL STEP 4 (Final Creation) */}
            {tutorialStep === 4 && (
                <InteractiveOverlay
                    targetId="tut-save-routine-btn"
                    title="PASO 4: SELECCIONAR Y GUARDAR"
                    message="Guarda tu nueva rutina. Esto te mandará al inicio para que vayas al mapa."
                    step={4}
                    totalSteps={7}
                    onNext={() => { }}
                    onClose={() => {
                        setTutorialStep(0);
                        localStorage.setItem('hasSeenImportTutorial', 'true');
                    }}
                    placement="top"
                    disableNext={true}
                />
            )}
        </div>
    );
};

