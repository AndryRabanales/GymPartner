import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Search, ChevronLeft, ChevronRight, Check, Swords, Loader, Trash2, Dumbbell, Save, Edit2, X, Share2 } from 'lucide-react';
import { userService } from '../services/UserService';

import type { Equipment } from '../services/GymEquipmentService';
import { equipmentService, COMMON_EQUIPMENT_SEEDS, EQUIPMENT_CATEGORIES } from '../services/GymEquipmentService';
import type { CustomSettings } from '../services/GymEquipmentService';
import { workoutService } from '../services/WorkoutService';
import { supabase } from '../lib/supabase';
import { PublicTeaser } from '../components/common/PublicTeaser';
import { normalizeText, getMuscleGroup } from '../utils/inventoryUtils';
import { ArsenalCard } from '../components/arsenal/ArsenalCard';
import { EquipmentForm } from '../components/arsenal/EquipmentForm';
import { ShareRoutineModal } from '../components/profile/ShareRoutineModal';
import { CURATED_EXERCISES, CATALOG_MUSCLES } from '../data/exerciseCatalog';

// Local constants removed in favor of Service imports


interface RoutineCardProps {
    routine: any;
    onDelete: (id: string, name: string) => void;
    onEdit: (routine: any) => void;
    onShare: (id: string, name: string) => void;
    multiSelectMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
}

const RoutineCard = ({ 
    routine, 
    onDelete, 
    onEdit, 
    onShare,
    multiSelectMode = false,
    isSelected = false,
    onToggleSelect
}: RoutineCardProps) => {
    return (
        <div 
            onClick={() => {
                if (multiSelectMode && onToggleSelect) {
                    onToggleSelect(routine.id);
                } else {
                    onEdit(routine);
                }
            }}
            className={`group relative bg-neutral-900 border rounded-2xl p-4 md:p-8 pt-16 md:pt-16 transition-all hover:bg-neutral-800/55 flex flex-col justify-between min-h-[160px] md:min-h-[280px] select-none cursor-pointer ${
                isSelected 
                    ? 'border-gym-primary shadow-lg shadow-gym-primary/10 bg-gym-primary/5 scale-[1.01]' 
                    : 'border-neutral-800 hover:border-neutral-700'
            }`}
        >
            <div className="absolute top-2 right-2 md:top-0 md:right-0 md:p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <Swords size={40} className="md:w-[120px] md:h-[120px]" />
            </div>

            {/* Actions overlay container - TOP CORNERS */}
            {multiSelectMode ? (
                // Multi-select mode: Checkbox in Top-Left
                <div className="absolute top-3 left-3 z-30">
                    <div className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all ${
                        isSelected 
                            ? 'bg-gym-primary border-transparent text-black scale-110 shadow-lg shadow-gym-primary/20' 
                            : 'border-neutral-700 bg-neutral-950/70'
                    }`}>
                        {isSelected && <Check size={18} strokeWidth={3.5} />}
                    </div>
                </div>
            ) : (
                // Normal mode: Share and Delete buttons
                <>
                    {/* Top-Left: Share Button */}
                    <div className="absolute top-3 left-3 z-30">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onShare(routine.id, routine.name);
                            }}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gym-primary/10 text-gym-primary hover:bg-gym-primary hover:text-black transition-all border border-gym-primary/20 shadow-md active:scale-95 cursor-pointer"
                            title="Compartir Rutina"
                        >
                            <Share2 size={16} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Top-Right: Delete Button */}
                    <div className="absolute top-3 right-3 z-30">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onDelete(routine.id, routine.name);
                            }}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20 shadow-md active:scale-95 cursor-pointer"
                            title="Eliminar Rutina"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </>
            )}

            {/* Clickable Card Body & Edit Trigger */}
            <div className="relative z-10 flex-1 flex flex-col justify-between">
                <div className="mt-2">
                    <h3 className={`font-black text-lg md:text-3xl mb-1 md:mb-2 italic uppercase leading-none truncate transition-colors ${
                        isSelected ? 'text-gym-primary' : 'text-white group-hover:text-gym-primary'
                    }`}>{routine.name}</h3>
                    <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2 mt-2 md:mt-4">
                        <span className="w-fit px-2 py-0.5 bg-neutral-800 rounded-md text-[9px] md:text-xs font-bold text-neutral-400 border border-neutral-700">
                            {new Date(routine.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="w-fit px-2 py-0.5 bg-gym-primary/10 text-gym-primary rounded-md text-[9px] md:text-xs font-bold border border-gym-primary/20">
                            {(routine.equipment_ids?.length || routine.routine_exercises?.length || routine.routine_items?.length || 0)} Items
                        </span>
                    </div>
                </div>

                {/* Bottom Premium Edit Button */}
                <div className={`w-full mt-6 px-4 py-2.5 md:py-3.5 rounded-xl font-bold uppercase tracking-wide transition-colors flex items-center justify-between text-[10px] md:text-sm border ${
                    multiSelectMode 
                        ? 'bg-neutral-800/30 text-neutral-500 border-neutral-800/50'
                        : 'bg-white/5 group-hover:bg-gym-primary group-hover:text-black text-white border-white/10 group-hover:border-transparent'
                }`}>
                    <span>{multiSelectMode ? (isSelected ? 'Seleccionada' : 'Seleccionar') : 'Editar Local'}</span>
                    <ChevronRight size={16} className="animate-pulse" />
                </div>
            </div>
        </div>
    );
};


export const MyArsenal = () => {
    const { user } = useAuth();
    const { gymId: routeGymId } = useParams<{ gymId: string }>();


    if (!user) {
        return (
            <PublicTeaser
                icon={Dumbbell}
                title="Tu Catálogo Personal"
                description="Digitaliza el inventario de tu gimnasio y diseña rutinas de entrenamiento precisas."
                benefitTitle="Inventario Digital"
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
    const [sharingRoutineIds, setSharingRoutineIds] = useState<string[]>([]);
    const [sharingRoutineNames, setSharingRoutineNames] = useState<string[]>([]);
    const [showShareModal, setShowShareModal] = useState(false);

    // Multi-Selection and Bulk Delete states
    const [multiSelectMode, setMultiSelectMode] = useState(false);
    const [selectedRoutineIds, setSelectedRoutineIds] = useState<Set<string>>(new Set());

    // Global Metrics Toolbar State
    const [globalMetrics, setGlobalMetrics] = useState<Record<string, boolean>>({
        weight: true, reps: true, time: true, distance: true, rpe: false
    });
    const [metricOverrides, setMetricOverrides] = useState<Set<string>>(new Set());

    // Helper: determine if an item is a cardio exercise based on its category/muscle group
    const isCardioItem = (itemId: string): boolean => {
        // Check virtual seeds first
        if (itemId.startsWith('virtual-')) {
            const seedName = itemId.replace('virtual-', '');
            const seed = COMMON_EQUIPMENT_SEEDS.find(s => s.name === seedName);
            return seed?.category === 'CARDIO';
        }
        // Check real inventory + global
        const item = inventory.find(i => i.id === itemId) ||
            globalInventory.find(i => i.id === itemId);
        if (!item) return false;
        const group = getMuscleGroup(item, userSettings);
        return group === 'CARDIO' || item.category === 'CARDIO';
    };

    // Handler: Toggle a global metric and propagate to all non-overridden exercises
    const handleToggleGlobalMetric = (metricId: string) => {
        const metricDef = {
            weight: 'strength', reps: 'strength',
            time: 'cardio', distance: 'cardio',
            rpe: 'strength'
        } as Record<string, string>;

        const targetCategory = metricDef[metricId] || 'all';

        setGlobalMetrics(prev => {
            const newState = { ...prev, [metricId]: !prev[metricId] };
            const newValue = newState[metricId];

            // Apply to all selected items that match the category and aren't overridden
            setRoutineConfigs(prevConfigs => {
                const next = new Map(prevConfigs);
                selectedItems.forEach(itemId => {
                    if (metricOverrides.has(itemId)) return; // Skip manually overridden

                    const isCardio = isCardioItem(itemId);
                    const shouldApply =
                        targetCategory === 'all' ||
                        (targetCategory === 'cardio' && isCardio) ||
                        (targetCategory === 'strength' && !isCardio);

                    if (shouldApply) {
                        const existing = next.get(itemId) || {};
                        if (['weight', 'reps', 'time', 'distance', 'rpe'].includes(metricId)) {
                            const metricToTrackKey = `track_${metricId}`;
                            next.set(itemId, { ...existing, [metricToTrackKey]: newValue });
                        } else {
                            next.set(itemId, { ...existing, custom_metric: newValue ? metricId : null });
                        }
                    }
                });
                return next;
            });

            return newState;
        });
    };

    // Custom Exercise State (Simplified for EquipmentForm)
    const [userSettings, setUserSettings] = useState<CustomSettings>({ categories: [], metrics: [] });
    const [editingItem, setEditingItem] = useState<Equipment | null>(null);

    // Catalog grid state (MACHINES view)
    const [catalogActiveMuscle, setCatalogActiveMuscle] = useState<string>('PECHO');
    const [catalogVariantIdx, setCatalogVariantIdx] = useState<Record<string, number>>({});

    const catalogExercises = useMemo(
        () => CURATED_EXERCISES.filter(b =>
            b.muscle === catalogActiveMuscle &&
            (searchTerm === '' || b.name.toLowerCase().includes(searchTerm.toLowerCase()))
        ),
        [catalogActiveMuscle, searchTerm]
    );

    const seedLookupForCatalog = useMemo(() => {
        const m = new Map<string, any>();
        (COMMON_EQUIPMENT_SEEDS as any[]).forEach(s => m.set(s.name, s));
        return m;
    }, []);

    const EMPTY_CARD_SETTINGS = { categories: [], metrics: [] };

    const scrollToCategory = (_category: string) => { /* no-op: tabs now filter directly */ };



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

            // Inventory Logic (Target Gym, Home Base)
            let targetGymId = await resolveTargetGymId();

            // ALWAYS Fetch Personal Inventory Logic (Custom Exercises)
            let personalItems: Equipment[] = [];
            try {
                personalItems = await equipmentService.getPersonalInventory(user.id);
                console.log('🔗 Loaded Personal Inventory:', personalItems.length, 'items');
            } catch (e) { 
                console.warn('Could not fetch personal inventory', e); 
            }

            let gymItems: Equipment[] = [];
            if (targetGymId) {
                try {
                    gymItems = await equipmentService.getInventory(targetGymId);
                } catch (e) {
                    console.warn('Could not fetch gym inventory', e);
                }
            }

            // Merge: Personal Items + Gym Items
            setInventory([...personalItems, ...gymItems]);

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
            
            // Mark this item as manually overridden so global toggles ignore it
            setMetricOverrides(prev => {
                const next = new Set(prev);
                next.add(newItem.id);
                return next;
            });

            // Update routine config to match the manual edit
            setRoutineConfigs(prevConfigs => {
                const next = new Map(prevConfigs);
                const existing = next.get(newItem.id) || {};
                
                const activeCustomMetric = Object.keys(newItem.metrics || {}).find(
                    k => !['weight', 'reps', 'time', 'distance', 'rpe'].includes(k) && newItem.metrics![k]
                );

                next.set(newItem.id, {
                    ...existing,
                    track_weight: !!newItem.metrics?.weight,
                    track_reps: !!newItem.metrics?.reps,
                    track_time: !!newItem.metrics?.time,
                    track_distance: !!newItem.metrics?.distance,
                    track_rpe: !!newItem.metrics?.rpe,
                    custom_metric: activeCustomMetric || null
                });
                return next;
            });
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
        if (!confirm(`¿Importar rutina "${sourceRoutine.name}" a este gimnasio?`)) return;

        setLoading(true);
        try {
            await workoutService.importRoutine(user.id, sourceRoutine.id, routeGymId);
            await initialize(); // Refresh
        } catch (error) {
            console.error(error);
            alert("Error al importar rutina.");
        } finally {
            setLoading(false);
        }
    };


    const toggleSelection = (id: string) => {
        const willAdd = !selectedItems.has(id);

        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });

        if (willAdd && !metricOverrides.has(id)) {
            const isCardio = isCardioItem(id);
            setRoutineConfigs(prevConfigs => {
                const nextConfigs = new Map(prevConfigs);
                const existing = nextConfigs.get(id) || {};

                const activeCustomMetric = Object.keys(globalMetrics).find(
                    k => !['weight', 'reps', 'time', 'distance', 'rpe'].includes(k) && globalMetrics[k]
                );

                nextConfigs.set(id, {
                    ...existing,
                    track_weight: !isCardio ? globalMetrics.weight : false,
                    track_reps: !isCardio ? globalMetrics.reps : false,
                    track_time: isCardio ? globalMetrics.time : false,
                    track_distance: isCardio ? globalMetrics.distance : false,
                    track_rpe: !isCardio ? globalMetrics.rpe : false,
                    custom_metric: activeCustomMetric || null
                });
                return nextConfigs;
            });
        }
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

                // 1. Check CURATED_EXERCISES first — always prefer virtual IDs so the
                //    catalog grid can highlight the card as selected on edit.
                for (const base of CURATED_EXERCISES) {
                    const variantMatch = base.variants.find(v => normalizeText(v.seedName) === normName);
                    if (variantMatch) {
                        finalId = `virtual-${variantMatch.seedName}`;
                        foundMatch = true;
                        break;
                    }
                }

                // 2. Check Custom Inventory (Real ID) — for exercises not in the catalog
                if (!foundMatch) {
                    const customMatch = inventory.find(i => i.id === ex.exercise_id || normalizeText(i.name) === normName);
                    if (customMatch) {
                        finalId = customMatch.id;
                        foundMatch = true;
                    }
                }

                // 3. Check Global Inventory (Real ID)
                if (!foundMatch) {
                    const globalMatch = globalInventory.find(i => i.id === ex.exercise_id || normalizeText(i.name) === normName);
                    if (globalMatch) {
                        finalId = globalMatch.id;
                        foundMatch = true;
                    }
                }

                // 4. Check Seeds (Virtual ID) — fallback for legacy seed names
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
        setMetricOverrides(new Set());
        setGlobalMetrics({ weight: true, reps: true, time: true, distance: true, rpe: false });
        setViewMode('MACHINES');
        setSearchTerm('');
    };

    const handleDeleteRoutine = async (routineId: string, routineName: string) => {
        if (!confirm(`¿Eliminar rutina "${routineName}" permanentemente?`)) return;

        // Optimistic update or refresh
        const { error } = await workoutService.deleteRoutine(routineId);

        if (error) {
            console.error(error);
            alert("Error al eliminar la rutina.");
            return;
        }

        initialize(); // Refresh routines
    };

    const toggleRoutineSelection = (id: string) => {
        setSelectedRoutineIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleDeleteSelectedRoutines = async () => {
        if (selectedRoutineIds.size === 0) return;

        const count = selectedRoutineIds.size;
        if (!confirm(`¿Eliminar las ${count} rutinas seleccionadas permanentemente?`)) return;

        setLoading(true);
        try {
            const idsToDelete = Array.from(selectedRoutineIds);
            
            // Delete all selected routines in parallel
            await Promise.all(idsToDelete.map(id => workoutService.deleteRoutine(id)));

            alert(`¡Se eliminaron ${count} rutinas exitosamente!`);
            setSelectedRoutineIds(new Set());
            setMultiSelectMode(false);
            await initialize(); // Refresh
        } catch (err) {
            console.error("Error bulk deleting routines:", err);
            alert("Error al eliminar algunas rutinas.");
        } finally {
            setLoading(false);
        }
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
            alert("Tu rutina necesita un nombre descriptivo.");
            return;
        }
        if (selectedItems.size === 0) {
            alert("Selecciona al menos una máquina para entrenar.");
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
                    // Try to find existing by Name in Personal Inventory to avoid dupes
                    let { data: existingReal } = await supabase
                        .from('gym_equipment')
                        .select('id, name')
                        .is('gym_id', null)
                        .eq('verified_by', user.id)
                        .ilike('name', ghostItem.name) // Case insensitive match
                        .maybeSingle();

                    if (existingReal) {
                        console.log(`[Ghost] Linking to existing local item: ${existingReal.name}`);
                        finalId = existingReal.id;
                    } else {
                        console.log(`[Ghost] CLONING item to Personal Inventory: ${ghostItem.name}`);
                        // CLONE IT
                        const newEq = await equipmentService.addEquipment({
                            name: ghostItem.name,
                            category: ghostItem.category,
                            gym_id: null,
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
                            let { data: globalItem } = await supabase.from('gym_equipment').select('id').is('gym_id', null).eq('verified_by', user.id).eq('name', seedName).maybeSingle();

                            if (!globalItem) {
                                const { targetMuscle, ...cleanSeed } = seedData as any;
                                const newItem = await equipmentService.addEquipment({
                                    name: cleanSeed.name,
                                    category: cleanSeed.category,
                                    gym_id: null,
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
                alert("¡Rutina actualizada correctamente!");
            } else {
                // 2-Step Creation for Rich Config
                const { data, error } = await workoutService.createRoutine(user.id, routineName, [], routeGymId);
                if (error) throw error;

                if (data) {
                    const { error: updateError } = await workoutService.updateRoutine(data.id, routineName, finalConfigPayload);
                    if (updateError) throw updateError;
                }
                alert("¡Nueva rutina guardada!");
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
                    {/* Header - Compact with Bulk Selection Manager */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-12 border-b border-neutral-900 pb-6">
                        <div className="flex items-center gap-3">
                            <Link to="/" className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center bg-neutral-900 rounded-full hover:bg-neutral-800 hover:text-gym-primary transition-all border border-neutral-800 shrink-0">
                                <ArrowLeft size={16} className="md:w-6 md:h-6" />
                            </Link>
                            <div>
                                <h1 className="text-xl md:text-5xl font-black uppercase italic tracking-tighter leading-none">Mis Rutinas <span className="text-gym-primary">📋</span></h1>
                                <p className="text-neutral-500 text-xs md:text-lg font-bold">
                                    {routeGymId ? "Rutinas de Gimnasio (Local)" : "Rutinas Globales"}
                                </p>
                            </div>
                        </div>

                        {/* Bulk/Multi Selection Controls */}
                        {routines.length > 0 && (
                            <div className="flex items-center gap-3 self-end sm:self-auto">
                                {multiSelectMode ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                const selectedIds = Array.from(selectedRoutineIds);
                                                const selectedNames = routines.filter(r => selectedRoutineIds.has(r.id)).map(r => r.name);
                                                setSharingRoutineIds(selectedIds);
                                                setSharingRoutineNames(selectedNames);
                                                setShowShareModal(true);
                                            }}
                                            disabled={selectedRoutineIds.size === 0}
                                            className="px-5 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs bg-gym-primary hover:bg-yellow-400 text-black flex items-center gap-1.5 transition-all shadow-lg shadow-gym-primary/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 border border-transparent cursor-pointer"
                                        >
                                            <Share2 size={14} strokeWidth={2.5} />
                                            Compartir ({selectedRoutineIds.size})
                                        </button>
                                        <button
                                            onClick={handleDeleteSelectedRoutines}
                                            disabled={selectedRoutineIds.size === 0}
                                            className="px-5 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs bg-red-650 hover:bg-red-500 text-white flex items-center gap-1.5 transition-all shadow-lg shadow-red-950/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 border border-red-600/30 cursor-pointer"
                                        >
                                            <Trash2 size={14} />
                                            Eliminar ({selectedRoutineIds.size})
                                        </button>
                                        <button
                                            onClick={() => {
                                                setMultiSelectMode(false);
                                                setSelectedRoutineIds(new Set());
                                            }}
                                            className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white border border-neutral-700 transition-all active:scale-95 cursor-pointer"
                                        >
                                            Cancelar
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setMultiSelectMode(true)}
                                        className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs bg-neutral-900 hover:bg-neutral-800 text-gym-primary hover:text-yellow-400 border border-neutral-800 hover:border-gym-primary/30 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                    >
                                        <Check size={14} strokeWidth={3} />
                                        Seleccionar Varias
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                        {/* CREATE / IMPORT CARD */}
                        {!multiSelectMode && (
                            !routeGymId ? (
                                // GLOBAL: Create New Master
                                <button
                                    onClick={handleCreateNew}
                                    className="bg-neutral-900 border border-neutral-800 hover:border-gym-primary/50 hover:bg-neutral-800 p-6 rounded-2xl flex flex-col items-center justify-center gap-4 group transition-all h-[200px]"
                                >
                                    <div className="w-16 h-16 rounded-full bg-gym-primary/10 flex items-center justify-center group-hover:bg-gym-primary group-hover:text-black transition-colors text-gym-primary">
                                        <Plus size={32} />
                                    </div>
                                    <span className="font-black italic uppercase tracking-wider text-neutral-400 group-hover:text-white">Nueva Rutina Global</span>
                                </button>
                            ) : (
                                // GYM: Create OR Import
                                <div className="flex gap-2 h-[200px]">
                                    <button
                                        onClick={handleCreateNew}
                                        className="flex-1 bg-neutral-900 border border-neutral-800 hover:border-gym-primary/50 hover:bg-neutral-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-gym-primary/10 flex items-center justify-center group-hover:bg-gym-primary group-hover:text-black transition-colors text-gym-primary">
                                            <Plus size={24} />
                                        </div>
                                        <span className="font-bold text-xs uppercase text-neutral-400 group-hover:text-white">Crear</span>
                                    </button>
                                    <button
                                        onClick={() => setImportingMode(true)}
                                        className="flex-1 bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-black transition-colors text-blue-500">
                                            <Dumbbell size={24} />
                                        </div>
                                        <span className="font-bold text-xs uppercase text-neutral-400 group-hover:text-white">Importar</span>
                                    </button>
                                </div>
                            )
                        )}



                        {/* Existing Routines */}
                        {
                            routines.map(routine => (
                                <RoutineCard
                                    key={routine.id}
                                    routine={routine}
                                    onDelete={handleDeleteRoutine}
                                    onEdit={handleEditRoutine}
                                    onShare={(id, name) => {
                                        setSharingRoutineIds([id]);
                                        setSharingRoutineNames([name]);
                                        setShowShareModal(true);
                                    }}
                                    multiSelectMode={multiSelectMode}
                                    isSelected={selectedRoutineIds.has(routine.id)}
                                    onToggleSelect={toggleRoutineSelection}
                                />
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

                    {/* ROUTINE SHARING MODAL (Rendered directly in ROUTINES view branch) */}
                    {showShareModal && sharingRoutineIds.length > 0 && (
                        <ShareRoutineModal
                            userId={user.id}
                            routineIds={sharingRoutineIds}
                            routineNames={sharingRoutineNames}
                            onClose={() => {
                                setShowShareModal(false);
                                setSharingRoutineIds([]);
                                setSharingRoutineNames([]);
                            }}
                        />
                    )}
                </div>
            </div>
        );
    }

    // RENDER MACHINE INVENTORY (Level 2 - Builder Logic)
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-gym-primary selection:text-black flex flex-col">
            {/* STATIC HEADER - SCROLLS AWAY */}
            <div className="bg-black/95 backdrop-blur-xl border-b border-white/5 shadow-2xl flex-none">
                <div className="max-w-7xl mx-auto p-2.5 flex flex-col gap-2.5">

                    {/* Compact Top Row: Nav + Title + Save */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setViewMode('ROUTINES')} 
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10"
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <div>
                                <h2 className="text-lg md:text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2 leading-none">
                                    {editingRoutineId ? 'Editar' : 'Nueva'} <span className="text-gym-primary">Estrategia</span>
                                </h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Desktop Save Button */}
                            <button
                                onClick={handleSaveRoutine}
                                disabled={isSaving || !routineName.trim() || selectedItems.size === 0}
                                className="hidden md:flex bg-gym-primary hover:bg-yellow-400 text-black font-black uppercase tracking-wider px-5 py-2 rounded-xl transition-all items-center gap-2 text-xs shadow-[0_0_20px_rgba(250,204,21,0.2)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isSaving ? <Loader className="animate-spin" size={14} /> : <Check size={14} strokeWidth={3} />}
                                <span>Guardar Estrategia</span>
                            </button>

                            {/* Mobile / General Circular Save Button */}
                            <button
                                onClick={handleSaveRoutine}
                                disabled={isSaving || !routineName.trim() || selectedItems.size === 0}
                                className="w-10 h-10 flex items-center justify-center bg-green-500 hover:bg-green-400 rounded-xl text-white shadow-[0_0_15px_rgba(34,197,94,0.5)] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isSaving ? <Loader size={18} className="animate-spin" /> : <Check size={24} strokeWidth={4} />}
                            </button>
                        </div>
                    </div>

                    {/* Routine Name Input */}
                    <div className="w-full">
                        <input
                            type="text"
                            placeholder="Nombre de la Rutina (Obligatorio)..."
                            value={routineName}
                            onChange={(e) => setRoutineName(e.target.value)}
                            required
                            className={`w-full bg-neutral-900 border-2 rounded-xl px-4 py-2.5 text-[16px] text-white placeholder-neutral-500 focus:outline-none focus:bg-neutral-950 focus:border-gym-primary transition-all font-bold tracking-tight ${!routineName.trim() ? 'border-red-500/30' : 'border-neutral-850'}`}
                        />
                    </div>

                    {/* Responsive Search Bar */}
                    <div className="relative group w-full">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-gym-primary transition-colors">
                            <Search size={16} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar ejercicio o máquina..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-neutral-900 border-2 border-neutral-850 rounded-xl pl-10 pr-4 py-2.5 text-[16px] text-white placeholder-neutral-500 focus:outline-none focus:border-gym-primary focus:bg-neutral-950 transition-all font-bold"
                        />
                    </div>

                    {/* Muscle Filter Tabs */}
                    <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar border-t border-white/5">
                        {CATALOG_MUSCLES.map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => { setCatalogActiveMuscle(m); }}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border transition-all
                                    ${catalogActiveMuscle === m
                                        ? 'bg-gym-primary text-black border-gym-primary'
                                        : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-gym-primary/40'
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT — Exercise Catalog Grid */}
            <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-36 pt-3">
                {catalogExercises.length === 0 ? (
                    <div className="text-center text-neutral-600 font-bold py-12">Sin resultados</div>
                ) : (
                    <div className="grid grid-cols-3 gap-3 mt-1">
                        {catalogExercises.map(base => {
                            const currentIdx = catalogVariantIdx[base.id] ?? 0;
                            const currentVariant = base.variants[currentIdx] ?? base.variants[0];
                            const virtualId = `virtual-${currentVariant.seedName}`;
                            const isSel = selectedItems.has(virtualId);
                            const hasVariants = base.variants.length > 1;
                            const seed = seedLookupForCatalog.get(currentVariant.seedName);
                            const cardItem = {
                                id: virtualId,
                                name: base.name,
                                category: base.muscle,
                                target_muscle_group: base.muscle,
                                metrics: base.metrics,
                                image_url: seed?.image_url ?? null,
                                icon: currentVariant.icon,
                                quantity: 1,
                                status: 'ACTIVE' as const,
                            };

                            return (
                                <div
                                    key={base.id}
                                    className={`relative cursor-pointer rounded-lg transition-all h-52 ${isSel ? 'ring-2 ring-gym-primary ring-offset-2 ring-offset-black' : ''}`}
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).closest('[data-variant-btn="true"]')) return;
                                        setSelectedItems(prev => {
                                            const next = new Set(prev);
                                            if (next.has(virtualId)) next.delete(virtualId);
                                            else next.add(virtualId);
                                            return next;
                                        });
                                    }}
                                >
                                    <ArsenalCard
                                        item={cardItem as any}
                                        isSelected={isSel}
                                        userSettings={EMPTY_CARD_SETTINGS}
                                        onEdit={() => {}}
                                        variantLabel={hasVariants ? currentVariant.label : undefined}
                                        variantTotal={hasVariants ? base.variants.length : undefined}
                                    />
                                    {hasVariants && (
                                        <>
                                            <button
                                                data-variant-btn="true"
                                                onPointerDown={e => e.stopPropagation()}
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    setCatalogVariantIdx(prev => ({
                                                        ...prev,
                                                        [base.id]: (currentIdx - 1 + base.variants.length) % base.variants.length
                                                    }));
                                                }}
                                                className="absolute left-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center w-7 h-10 rounded-r-xl bg-black/70 border border-white/20 border-l-0 text-white hover:text-gym-primary hover:bg-black/90 hover:border-gym-primary/50 transition-all backdrop-blur-sm shadow-lg"
                                            >
                                                <ChevronLeft size={18} strokeWidth={3} />
                                            </button>
                                            <button
                                                data-variant-btn="true"
                                                onPointerDown={e => e.stopPropagation()}
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    setCatalogVariantIdx(prev => ({
                                                        ...prev,
                                                        [base.id]: (currentIdx + 1) % base.variants.length
                                                    }));
                                                }}
                                                className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center w-7 h-10 rounded-l-xl bg-black/70 border border-white/20 border-r-0 text-white hover:text-gym-primary hover:bg-black/90 hover:border-gym-primary/50 transition-all backdrop-blur-sm shadow-lg"
                                            >
                                                <ChevronRight size={18} strokeWidth={3} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {addingMode && (
                <EquipmentForm
                    user={user}
                    userSettings={userSettings}
                    onUpdateSettings={setUserSettings}
                    editingItem={editingItem}
                    onClose={() => { setAddingMode(false); setEditingItem(null); }}
                    onSuccess={handleEquipmentSuccess}
                    activeSection={activeSection || undefined}
                    catalogItems={catalogItems}
                    onQuickAdd={handleQuickAdd}
                />
            )}

            {/* Floating Batch Save Action Button */}
            {selectedItems.size > 0 && (
                <div className="fixed bottom-6 left-0 right-0 px-6 flex justify-center pointer-events-none z-[100]">
                    <button
                        onClick={handleSaveRoutine}
                        disabled={!routineName.trim() || isSaving}
                        className="pointer-events-auto bg-gym-primary text-black font-black uppercase py-4 px-12 rounded-2xl shadow-[0_10px_40px_rgba(250,204,21,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 text-base md:text-lg border-2 border-yellow-400 animate-in slide-in-from-bottom-4 duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isSaving ? <Loader className="animate-spin" size={24} /> : <Check size={24} strokeWidth={3} />}
                        <span>{editingRoutineId ? 'ACTUALIZAR ESTRATEGIA' : 'CREAR ESTRATEGIA'} ({selectedItems.size})</span>
                    </button>
                </div>
            )}


            {showShareModal && sharingRoutineIds.length > 0 && (
                <ShareRoutineModal
                    userId={user.id}
                    routineIds={sharingRoutineIds}
                    routineNames={sharingRoutineNames}
                    onClose={() => {
                        setShowShareModal(false);
                        setSharingRoutineIds([]);
                        setSharingRoutineNames([]);
                    }}
                />
            )}
        </div>
    );
};

