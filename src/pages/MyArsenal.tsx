import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, ChevronRight, Check, Swords, Loader, Trash2, X, Dumbbell, Edit2, Save } from 'lucide-react';
import { userService } from '../services/UserService';
import { InteractiveOverlay } from '../components/onboarding/InteractiveOverlay';
import type { Equipment } from '../services/GymEquipmentService';
import { equipmentService, COMMON_EQUIPMENT_SEEDS, EQUIPMENT_CATEGORIES } from '../services/GymEquipmentService';
import type { CustomCategory, CustomMetric, CustomSettings } from '../services/GymEquipmentService';
import { workoutService } from '../services/WorkoutService';
import { supabase } from '../lib/supabase';
import { PublicTeaser } from '../components/common/PublicTeaser';

// Local constants removed in favor of Service imports

interface ArsenalCardProps {
    item: Equipment;
    muscleGroup?: string;
    isSelected?: boolean;
    userSettings: CustomSettings; // Changed from customCategories to full settings for metrics access
    onEdit?: (item: Equipment) => void;
    configOverride?: any; // Routine specific configuration
}

const ArsenalCard = ({ item, isSelected, userSettings, onEdit, configOverride }: ArsenalCardProps) => {
    // Determine active metrics based on item data or fallback
    // If configOverride is present (Routine Context), use it to determine active flags.
    let activeMetricIds: string[] = [];

    if (configOverride) {
        // We are in routine context, check specific flags
        if (configOverride.track_weight !== false && (configOverride.track_weight || item.metrics?.weight)) activeMetricIds.push('weight');
        if (configOverride.track_reps !== false && (configOverride.track_reps || item.metrics?.reps)) activeMetricIds.push('reps');
        if (configOverride.track_time) activeMetricIds.push('time');
        if (configOverride.track_distance) activeMetricIds.push('distance');
        if (configOverride.track_rpe) activeMetricIds.push('rpe');
        if (configOverride.track_pr) activeMetricIds.push('track_pr');
        // Custom metric string?
    } else {
        // Default View (Inventory)
        activeMetricIds = item.metrics ? Object.keys(item.metrics).filter(k => item.metrics![k]) : ['weight', 'reps'];
    }

    const getMetricInfo = (id: string) => {
        // 1. Check Custom
        const custom = userSettings.metrics.find(m => m.id === id);
        if (custom) return { label: custom.label, icon: custom.icon };

        // 2. Check Defaults
        const defaults: Record<string, { label: string, icon: string }> = {
            weight: { label: 'PESO', icon: '⚖️' },
            reps: { label: 'REPS', icon: '🔄' },
            time: { label: 'TIEMPO', icon: '⏱️' },
            distance: { label: 'DIST', icon: '📏' },
            rpe: { label: 'RPE', icon: '🔥' }
        };
        return defaults[id] || { label: id, icon: '📊' };
    };


    // Find category icon
    const catId = item.category;
    const standardCat = EQUIPMENT_CATEGORIES[catId as keyof typeof EQUIPMENT_CATEGORIES];
    const customCat = userSettings.categories.find(c => c.id === catId);

    // Resolve Icon: Custom > Standard > Fallback string (if emoji directly stored) > Default
    // Sometimes customCategory is just the keys, sometimes dynamic.
    const icon = customCat?.icon || standardCat?.icon || '⚡';

    return (
        <div className={`
            relative group h-full transition-all duration-300
            ${isSelected
                ? 'bg-gym-primary text-black ring-4 ring-gym-primary/30 shadow-[0_0_40px_rgba(255,255,255,0.3)]'
                : 'bg-neutral-900 border border-white/5 hover:bg-neutral-800 hover:border-white/20'
            }
            rounded-2xl overflow-hidden flex flex-col
        `}>
            {/* Selection Indicator */}
            <div className={`absolute top-2 left-2 z-20 flex gap-1 flex-row-reverse`}>
                {onEdit && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all bg-white/10 hover:bg-white text-white hover:text-black`}
                    >
                        {/* Pencil Icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                    </button>
                )}

                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-black text-gym-primary' : 'bg-white/10 text-transparent group-hover:bg-white/20'
                    }`}>
                    <Check size={12} strokeWidth={4} />
                </div>
            </div>

            <div className="flex flex-col h-full relative group aspect-[3/4] min-h-[130px] p-1.5 overflow-hidden bg-neutral-900 border border-white/5 rounded-lg">
                {/* Icon - Centered, slightly smaller to allow breathing room */}
                <div className="flex-1 flex items-center justify-center w-full z-10 pb-2 pt-2">
                    <span className="text-5xl leading-none drop-shadow-md filter brightness-110 grayscale-[0.2] hover:grayscale-0 transition-transform duration-300 transform group-hover:scale-110 select-none">{icon}</span>
                </div>

                {/* Title - Anchored to bottom, with horizontal padding */}
                <div className="text-center w-full px-1.5 leading-none z-20 pb-1.5 min-h-0 flex-shrink-0">
                    <h4 className={`text-[9px] font-black italic uppercase tracking-wider line-clamp-3 text-wrap leading-tight ${isSelected ? 'text-black' : 'text-neutral-200'} drop-shadow-sm`}>
                        {item.name}
                    </h4>
                </div>

                {/* Footer / Stats - Distinct background */}
                <div className={`border-t ${isSelected ? 'border-black/10' : 'border-white/5'} w-full bg-black/40 backdrop-blur-sm`}>
                    <div className="flex flex-wrap gap-1 justify-center w-full py-1">
                        {activeMetricIds.map(mid => {
                            const info = getMetricInfo(mid);
                            if (!info) return null;
                            return (
                                <span key={mid} className={`
                                    text-[6px] font-bold px-1 py-0.5 rounded-[2px]
                                    flex items-center gap-0.5 leading-none
                                    ${isSelected ? 'text-black bg-white/20' : 'text-neutral-400'}
                                `}>
                                    <span>{info.icon}</span>
                                    <span className="tracking-wide uppercase">{info.label}</span>
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

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
    const [customMode, setCustomMode] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customCategory, setCustomCategory] = useState<string>('STRENGTH_MACHINE');
    const [customMetrics, setCustomMetrics] = useState({
        weight: true,
        reps: true,
        time: false,
        distance: false,
        rpe: false
    });
    const [userSettings, setUserSettings] = useState<CustomSettings>({ categories: [], metrics: [] });
    // New state for custom creation forms
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryIcon, setNewCategoryIcon] = useState('✨');

    const [isCreatingMetric, setIsCreatingMetric] = useState(false);
    const [newMetricName, setNewMetricName] = useState('');
    const [newMetricIcon, setNewMetricIcon] = useState('📊');
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
            setEditingItem(null); // Treat as new
        } else {
            setEditingItem(item); // Treat as update
        }

        setCustomName(item.name);
        setCustomCategory(item.category);

        // 1. Load Base Metrics from Equipment
        let loadedMetrics = { ...item.metrics };

        // 2. [FIX] Override with Routine Specifics if available
        // This ensures that if we enabled "RPE" in this routine, the modal shows it enabled.
        const routineOverride = routineConfigs.get(item.id);
        if (routineOverride) {
            loadedMetrics = {
                ...loadedMetrics,
                weight: routineOverride.track_weight ?? loadedMetrics.weight,
                reps: routineOverride.track_reps ?? loadedMetrics.reps,
                time: routineOverride.track_time ?? loadedMetrics.time,
                distance: routineOverride.track_distance ?? loadedMetrics.distance,
                rpe: routineOverride.track_rpe ?? loadedMetrics.rpe,
                track_pr: routineOverride.track_pr ?? (loadedMetrics as any).track_pr
                // Note: custom_metric string is handled elsewhere or implicitly
            };
        }

        if (item.metrics || routineOverride) {
            setCustomMetrics(prev => ({ ...prev, ...loadedMetrics }));
        }
        setAddingMode(true);
        setCustomMode(true);
    };

    const handleCreateCustom = async () => {
        if (!user) {
            alert("Error: Usuario no identificado.");
            return;
        }
        if (!customName.trim()) {
            alert("Por favor escribe un nombre para el ejercicio.");
            return;
        }

        // [FIX] Always save Custom Exercises to Personal Gym so they are available globally
        // instead of attaching them to the specific physical gym currently viewed.
        let finalGymId = null;
        try {
            finalGymId = await userService.ensurePersonalGym(user.id);
        } catch (e) {
            console.error("Error securing personal gym for custom item:", e);
            // Fallback (unlikely)
            finalGymId = (await resolveTargetGymId()) || null;
        }

        // Resolve Icon from Category (Standard or Custom)
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
            gym_id: finalGymId, // Now pointing to Personal Gym
            quantity: 1,
            metrics: customMetrics,
            icon: resolvedIcon // <--- SAVED TO DB
        };
        console.log('Attempting to create custom equipment:', payload);

        console.log('Updating equipment with payload:', { id: editingItem.id, customName, customCategory, resolvedIcon });

        // Log payload about to be sent
        const updatePayload = {
            name: customName,
            category: customCategory,
            metrics: customMetrics,
            icon: resolvedIcon // [FIX] Added icon to update payload
        };
        console.log('[DEBUG] Update Payload:', JSON.stringify(updatePayload));

        if (editingItem) {
            await equipmentService.updateEquipment(editingItem.id, updatePayload);
            newItem = { ...editingItem, name: customName, category: customCategory, metrics: customMetrics, icon: resolvedIcon };

            // Optimistic Update for Edit - Update in both inventories
            setInventory(prev => prev.map(i => i.id === newItem.id ? newItem : i));
            setGlobalInventory(prev => prev.map(i => i.id === newItem.id ? newItem : i));
        } else {
            newItem = await equipmentService.addEquipment(payload, user.id);
            console.log('✅ Exercise created successfully:', newItem);

            // Add to BOTH inventory states so it appears immediately
            // This ensures it shows up in the merged effectiveInventory
            setInventory(prev => [...prev, newItem]);
            setGlobalInventory(prev => {
                // Avoid duplicates
                if (prev.some(item => item.id === newItem.id)) return prev;
                return [...prev, newItem];
            });
        }

        // [FIX] Update Routine Configs immediately so the logic persists!
        // Map the boolean metrics to the table columns format
        const customKeys = Object.keys(customMetrics).filter(k => !['weight', 'reps', 'time', 'distance', 'rpe', 'track_pr'].includes(k) && (customMetrics as any)[k]);
        const foundCustomMetric = customKeys.length > 0 ? customKeys[0] : null;

        setRoutineConfigs(prev => {
            const next = new Map(prev);
            next.set(newItem.id, {
                track_weight: customMetrics.weight ?? true,
                track_reps: customMetrics.reps ?? true,
                track_time: customMetrics.time ?? false,
                track_distance: customMetrics.distance ?? false,
                track_rpe: customMetrics.rpe ?? false,
                track_pr: (customMetrics as any).track_pr ?? false,
                custom_metric: foundCustomMetric
            });
            return next;
        });

        // If creating new, auto-select it?
        // User usually expects "Create" to "Use".
        if (!editingItem) {
            toggleSelection(newItem.id);
        }

        // Success - Close modal and reset form
        setAddingMode(false);
        setCustomMode(false);
        setCustomName('');
        setEditingItem(null);
        setCustomMetrics({
            weight: true,
            reps: true,
            time: false,
            distance: false,
            rpe: false
        });

        alert(`¡Ejercicio "${newItem.name}" creado y añadido a tu arsenal!`);

        // NO LONGER NEEDED: Removed delayed initialize() that was overwriting optimistic updates
        // The item is already in the state and will appear immediately

    } catch (error: any) {
        console.error('Detailed Error saving custom equipment:', error);

        // Auto-Fallback for Enum Issues
        if (error.message && (error.message.includes('enum') || error.message.includes('invalid input value'))) {
            try {
                console.log('Falling back to STRENGTH_MACHINE due to Enum error...');
                const fallbackPayload = { ...payload, category: 'STRENGTH_MACHINE' };
                let fallbackItem: Equipment;

                if (editingItem) {
                    await equipmentService.updateEquipment(editingItem.id, { ...fallbackPayload, id: undefined } as any);
                    fallbackItem = { ...editingItem, ...fallbackPayload };
                } else {
                    fallbackItem = await equipmentService.addEquipment(fallbackPayload, user.id);
                    // Add to both inventories
                    setInventory(prev => [...prev, fallbackItem]);
                    setGlobalInventory(prev => {
                        if (prev.some(item => item.id === fallbackItem.id)) return prev;
                        return [...prev, fallbackItem];
                    });
                }

                setAddingMode(false);
                setCustomMode(false);
                setCustomName('');
                setEditingItem(null);
                alert('¡Ejercicio guardado! (Nota: Se guardó como "Máquina" por restricciones del sistema, pero funcionará correctamente).');
                return;
            } catch (retryError: any) {
                console.error('Fallback failed:', retryError);
                alert(`Error Crítico al guardar: ${retryError.message}`);
                return;
            }
        }

        alert(`Error al guardar: ${error.message || JSON.stringify(error)}`);
    }
};

const handleImportRoutine = async (sourceRoutine: any) => {
    if (!user || !routeGymId) return;
    if (!confirm(`¿Importar estrategia "${sourceRoutine.name}" a este gimnasio?`)) return;

    setLoading(true);
    try {
        await workoutService.importRoutine(user.id, sourceRoutine.id, routeGymId);
        await initialize(); // Refresh
        setImportingMode(false);

        // TUTORIAL ADVANCE: Step 2 -> 3 (Final Phase)
        if (localStorage.getItem('tutorial_step') === '6') {
            localStorage.setItem('tutorial_step', '7');
            setTutorialStep(7);
            alert("¡Rutina Importada!\n\nRegresando al perfil para iniciar...");
            navigate(-1); // Go back immediately to WorkoutSession
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

const handleQuickAdd = async (seedItem: any) => {
    if (!user) return;
    // In a real scenario, this would create the item. 
    // For now, we rely on the component re-render or explicit add call if needed.
    // But since we use virtual items, we don't strictly *need* to add it to state if we select it.
    // However, the user flow is "Browse > Click Add". 
    // Let's implement optimistic update for adding a seed to "inventory" locally so it shows up immediately.

    // Actually, we just need to "select" it? 
    // No, "Add" suggests making it available. 
    // Let's just create it immediately? Or add to local list.
    // const fakeGymId = routeGymId || 'temp';
    const tempId = `virtual-${seedItem.name}`; // Keep using virtual ID logic
    // We just close the modal, assuming the user will find it in the list now?
    // Wait, if it's already in the list (because we merge seeds), then "Add" in modal is redundant unless we are strictly filtering.
    // Our seeds cover most things. 
    // Let's say "Quick Add" adds it to SELECTION immediately.

    if (!selectedItems.has(tempId)) {
        toggleSelection(tempId);
    }
    setAddingMode(false);
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
    if (tutorialStep === 4) {
        setTutorialStep(0);
        localStorage.setItem('tutorial_step', '0');
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

const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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

// Removed excessive debug logs that were causing console noise during normal renders
// Only log when there are actual issues to diagnose

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

const filteredInventory = effectiveInventory.filter(item =>
    normalizeText(item.name).includes(normalizeText(searchTerm))
);

const getMuscleGroup = (item: Equipment | { name: string, category: string }): string => {
    const n = normalizeText(item.name);
    // FORCE_REFRESH: Ensure latest version is loaded

    // 1. Check Custom Categories (Safety Check for userSettings)
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

const groupedInventory: Record<string, Equipment[]> = {};
const SECTION_ORDER = [
    'Pecho', 'Espalda', 'Pierna', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazo',
    'Cardio', 'Poleas / Varios', 'Peso Libre (General)', 'Otros',
    ...userSettings.categories.map(c => c.label)
];

filteredInventory.forEach(item => {
    const group = getMuscleGroup(item);
    if (!groupedInventory[group]) groupedInventory[group] = [];
    groupedInventory[group].push(item);
});

const openCatalog = (section: string) => {
    setActiveSection(section);

    // Auto-select category based on section
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
    setAddingMode(true);
};

const handleSaveRoutine = async () => {
    if (!user) return;
    if (!routineName.trim()) {
        alert("⚠️ ¡Tu estrategia necesita un nombre!");
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
            if (currentStep === '4') {
                localStorage.setItem('tutorial_step', '5');
                setTutorialStep(5);
                alert("¡Rutina creada con éxito!\n\nRegresa al INICIO, ve al MAPA/LISTA y SELECCIONA TU GYM para configurarlo.");
                navigate(-1); // Go back to UserProfile
                return;
            }
            // Note: Import logic handles Step 6 elsewhere usually, or if Save handles imports too:
            if (currentStep === '6' && routeGymId) {
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

const catalogItems = COMMON_EQUIPMENT_SEEDS.filter(seed => {
    if (activeSection) {
        // @ts-ignore
        const seedGroup = getMuscleGroup(seed);
        return seedGroup === activeSection;
    }
    return true;
});

if (loading) return <div className="h-screen flex items-center justify-center bg-black text-gym-primary"><Loader className="animate-spin" /></div>;

// RENDER ROUTINE LIST (Level 1)
if (viewMode === 'ROUTINES') {
    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-12 pb-24 font-sans selection:bg-gym-primary selection:text-black">
            <div className="max-w-7xl mx-auto">
                {/* Header - Compact */}
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6 md:mb-12">
                    <div className="flex items-center gap-3">
                        <Link to="/" className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center bg-neutral-900 rounded-full hover:bg-neutral-800 hover:text-gym-primary transition-all border border-neutral-800 shrink-0">
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

                    {/* TUTORIAL OVERLAY STEP 6 (Import Strategy) */}
                    {tutorialStep === 6 && !addingMode && !importingMode && (
                        <InteractiveOverlay
                            targetId="tut-import-routine-btn"
                            title="PASO 6: IMPORTAR DESDE EL PERFIL"
                            message="Haz clic en 'IMPORTAR' para traer la rutina que creaste a este gimnasio."
                            step={6}
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
                )
                }
            </div >
        </div >
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
                        onClick={handleSaveRoutine}
                        disabled={isSaving}
                        className="md:hidden w-12 h-12 flex items-center justify-center bg-green-500 hover:bg-green-400 rounded-xl text-white shadow-[0_0_15px_rgba(34,197,94,0.5)] transition-all active:scale-95"
                    >
                        {isSaving ? <Loader size={20} className="animate-spin" /> : <Check size={28} strokeWidth={4} />}
                    </button>

                    {/* Desktop Save Button (Full) */}
                    <button
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
                    totalSteps={4}
                    placement="bottom"
                    onClose={() => {
                        setTutorialStep(0);
                        localStorage.setItem('tutorial_step', '0');
                    }}
                    disableNext={true}
                />
            )}

            {/* TUTORIAL STEP 4: SELECT WEAPONS */}
            {tutorialStep === 4 && (
                <InteractiveOverlay
                    targetId="tut-arsenal-grid"
                    title="PASO 4: ELIGE TUS ARMAS"
                    message="Selecciona las máquinas y ejercicios que formarán parte de esta rutina. Solo haz clic en ellas."
                    step={4}
                    totalSteps={4}
                    placement="top"
                    onNext={() => {
                        setTutorialStep(0);
                        localStorage.setItem('tutorial_step', '0');
                    }}
                    nextLabel="¡Entendido!"
                    onClose={() => {
                        setTutorialStep(0);
                        localStorage.setItem('tutorial_step', '0');
                    }}
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

            <div className="space-y-6" id="tut-arsenal-grid">
                {/* Render Groups */}
                {SECTION_ORDER.map(section => {
                    const items = groupedInventory[section] || [];
                    const isCore = ['Pecho', 'Espalda', 'Pierna', 'Bíceps', 'Tríceps', 'Hombros'].includes(section);

                    // Pass empty sections only if no search is active (so they can add), but if searching, hide empty.
                    if (items.length === 0 && !isCore && searchTerm) return null;

                    return (
                        <div key={section} className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
                            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-2 pl-1 sticky top-36 z-30 bg-black/80 backdrop-blur w-fit px-2 rounded-r-full">{section}</h3>

                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                                {items.map(item => {
                                    const isSelected = selectedItems.has(item.id);
                                    return (
                                        <div key={item.id} className="cursor-pointer" onClick={() => toggleSelection(item.id)}>
                                            <ArsenalCard
                                                item={item}
                                                muscleGroup={section}
                                                isSelected={isSelected}
                                                userSettings={userSettings}
                                                onEdit={handleEditEquipment}  // Always allow edit (Edit or Clone)
                                                configOverride={routineConfigs.get(item.id)}
                                            />
                                        </div>
                                    );
                                })}

                                {/* Premium Add Button */}
                                <button
                                    onClick={() => openCatalog(section)}
                                    className="h-full min-h-[70px] rounded-lg border border-dashed border-neutral-800 hover:border-gym-primary/50 bg-neutral-900/30 hover:bg-neutral-900/80 flex flex-col items-center justify-center gap-1 transition-all group p-2"
                                >
                                    <div className="w-16 h-16 rounded-full bg-neutral-800 group-hover:bg-gym-primary flex items-center justify-center text-neutral-500 group-hover:text-black transition-all shadow-lg group-hover:scale-110 duration-300">
                                        <Plus size={32} strokeWidth={3} />
                                    </div>
                                    <span className="font-bold text-sm text-neutral-500 group-hover:text-white uppercase tracking-widest transition-colors">Agregar a {section}</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Quick Add Modal (Refined) */}
        {addingMode && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-neutral-900 border border-white/10 w-full max-w-2xl rounded-[2rem] p-8 shadow-2xl relative max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200">

                    {/* Header & Close */}
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-3xl font-black italic text-white uppercase mb-1">
                                {customMode ? (editingItem ? 'Editar Ejercicio' : 'Crear Ejercicio') : `Catálogo ${activeSection}`}
                            </h2>
                            <p className="text-neutral-400">
                                {customMode ? 'Diseña tu propia máquina o ejercicio.' : 'Añade artillería pesada a tu colección.'}
                            </p>
                        </div>
                        <button onClick={() => { setAddingMode(false); setCustomMode(false); }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <Plus size={24} className="rotate-45" />
                        </button>
                    </div>

                    {!customMode ? (
                        // MODE A: CATALOG SELECTION
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {catalogItems.length > 0 ? catalogItems.map(seed => (
                                    <button
                                        key={seed.name}
                                        onClick={() => handleQuickAdd(seed)}
                                        className="text-left bg-black border border-white/10 hover:border-gym-primary p-4 rounded-xl flex items-center justify-between group transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl bg-white/5 p-2 rounded-lg">
                                                {/* @ts-ignore */}
                                                {EQUIPMENT_CATEGORIES[seed.category]?.icon}
                                            </span>
                                            <span className="font-bold text-neutral-300 group-hover:text-white transition-colors">{seed.name}</span>
                                        </div>
                                        <div className="text-gym-primary opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all">
                                            <Plus size={20} strokeWidth={3} />
                                        </div>
                                    </button>
                                )) : (
                                    <div className="col-span-full py-8 text-center text-neutral-500 border border-dashed border-white/10 rounded-2xl">
                                        <p>No hay más sugerencias comunes.</p>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-white/10 pt-4 mt-4 text-center">
                                <button
                                    onClick={() => setCustomMode(true)}
                                    className="inline-flex items-center gap-2 text-gym-primary font-bold hover:text-white transition-colors px-6 py-3 rounded-full hover:bg-white/5"
                                >
                                    <Plus size={18} />
                                    CREAR EJERCICIO PERSONALIZADO
                                </button>
                            </div>
                        </div>
                    ) : (
                        // MODE B: CUSTOM CREATION FORM
                        <div className="space-y-6">
                            {/* Name Input */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Nombre del Ejercicio</label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Ej: Press Militar en Máquina Vikinga"
                                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-white placeholder-neutral-600 focus:border-gym-primary focus:outline-none text-lg font-bold"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                />
                            </div>

                            {/* Category Selection */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Categoría</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {/* Default Categories */}
                                    {Object.entries(EQUIPMENT_CATEGORIES).map(([key, info]: [string, any]) => (
                                        <button
                                            key={key}
                                            onClick={() => setCustomCategory(key as any)}
                                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${customCategory === key
                                                ? 'bg-gym-primary/20 border-gym-primary text-white'
                                                : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'
                                                }`}
                                        >
                                            <span className="text-2xl">{info.icon}</span>
                                            <span className="text-xs font-bold uppercase">{info.label}</span>
                                        </button>
                                    ))}

                                    {/* Custom Categories */}
                                    {userSettings.categories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setCustomCategory(cat.id)}
                                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${customCategory === cat.id
                                                ? 'bg-gym-primary/20 border-gym-primary text-white'
                                                : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'
                                                }`}
                                        >
                                            <span className="text-2xl">{cat.icon}</span>
                                            <span className="text-xs font-bold uppercase">{cat.label}</span>
                                        </button>
                                    ))}

                                    {/* Inline Category Creation Form */}
                                    {isCreatingCategory && (
                                        <div className="col-span-2 sm:col-span-3 bg-neutral-900 rounded-xl p-4 border border-white/10 flex flex-col gap-4 z-10 relative mt-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-white uppercase">Nueva Categoría</span>
                                                <button onClick={() => setIsCreatingCategory(false)} className="text-neutral-500 hover:text-white"><X size={18} /></button>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-neutral-400 font-bold uppercase">Nombre</label>
                                                    <input
                                                        type="text"
                                                        placeholder="ej: Yoga"
                                                        value={newCategoryName}
                                                        onChange={e => setNewCategoryName(e.target.value)}
                                                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-white focus:border-gym-primary focus:outline-none font-bold"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-neutral-400 font-bold uppercase">Icono (Emoji)</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={newCategoryIcon}
                                                            onChange={e => setNewCategoryIcon(e.target.value)}
                                                            className="w-16 bg-black border border-white/10 rounded-lg p-3 text-2xl text-center focus:border-gym-primary focus:outline-none bg-transparent"
                                                        />
                                                        <div className="flex-1 flex gap-2 overflow-x-auto pb-2 items-center">
                                                            {['🧘', '🤸', '🧗', '🥊', '🏊', '🚴', '🏃', '🥋', '🎸', '💃'].map(emoji => (
                                                                <button
                                                                    key={emoji}
                                                                    onClick={() => setNewCategoryIcon(emoji)}
                                                                    className="p-2 hover:bg-white/10 rounded-lg text-xl transition-colors"
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        if (!user) return;
                                                        if (!newCategoryName.trim()) return;

                                                        try {
                                                            const newCategory: CustomCategory = {
                                                                id: newCategoryName.toUpperCase().replace(/\s+/g, '_'),
                                                                label: newCategoryName,
                                                                icon: newCategoryIcon || '✨'
                                                            };

                                                            const newSettings = {
                                                                ...userSettings,
                                                                categories: [...userSettings.categories, newCategory]
                                                            };

                                                            setUserSettings(newSettings);
                                                            setCustomCategory(newCategory.id);
                                                            await equipmentService.updateUserSettings(user.id, newSettings);
                                                            setIsCreatingCategory(false);
                                                            setNewCategoryName('');
                                                            setNewCategoryIcon('✨');
                                                        } catch (error: any) {
                                                            console.error('Error creating category:', error);
                                                            alert(`Error al crear categoría: ${error.message}`);
                                                        }
                                                    }}
                                                    className="w-full py-3 bg-gym-primary text-black font-bold rounded-lg hover:brightness-110 transition-all mt-2"
                                                >
                                                    CREAR CATEGORÍA
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Button for Category (Normal Mode) */}
                                    {!isCreatingCategory && (
                                        <button
                                            onClick={() => setIsCreatingCategory(true)}
                                            className="p-3 rounded-xl border border-dashed border-white/20 flex flex-col items-center gap-2 text-neutral-500 hover:text-white hover:bg-white/5 transition-all group min-h-[88px] justify-center"
                                        >
                                            <span className="p-1 rounded-full bg-white/5 group-hover:bg-gym-primary text-gym-primary group-hover:text-black transition-colors">
                                                <Plus size={16} />
                                            </span>
                                            <span className="text-[10px] font-bold uppercase">Nueva</span>
                                        </button>
                                    )}

                                </div>
                            </div>

                            {/* Metrics Configuration */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">¿Qué deseas registrar?</label>
                                <div className="bg-black/50 rounded-xl p-4 border border-white/5 space-y-3 max-h-[300px] overflow-y-auto">
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
                                                className={`w-12 h-7 rounded-full transition-colors relative ${customMetrics[metric.id as keyof typeof customMetrics] ? 'bg-gym-primary' : 'bg-neutral-800'
                                                    }`}
                                            >
                                                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${customMetrics[metric.id as keyof typeof customMetrics] ? 'left-6' : 'left-1'
                                                    }`} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Add Metric Button */}
                                    {/* Add Metric Button */}
                                    {!isCreatingMetric ? (
                                        <button
                                            onClick={() => setIsCreatingMetric(true)}
                                            className="w-full py-2 border border-dashed border-white/20 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"
                                        >
                                            <Plus size={14} />
                                            Crear Métrica
                                        </button>
                                    ) : (
                                        <div className="bg-neutral-900 rounded-lg p-3 border border-white/10 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-white uppercase">Nueva Métrica</span>
                                                <button onClick={() => setIsCreatingMetric(false)} className="text-neutral-500 hover:text-white"><X size={14} /></button>
                                            </div>
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    placeholder="Nombre (ej: Calorías)"
                                                    value={newMetricName}
                                                    onChange={e => setNewMetricName(e.target.value)}
                                                    className="w-full bg-black border border-white/10 rounded p-2 text-sm text-white focus:border-gym-primary focus:outline-none"
                                                    autoFocus
                                                />
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={newMetricIcon}
                                                        onChange={e => setNewMetricIcon(e.target.value)}
                                                        className="w-10 bg-black border border-white/10 rounded p-2 text-center text-lg focus:border-gym-primary focus:outline-none"
                                                    />
                                                    <div className="flex-1 flex gap-1 overflow-x-auto items-center pb-1">
                                                        {['🔥', '💓', '🌡️', '📏', '⏱️', '📈', '💧', '⚡'].map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => setNewMetricIcon(emoji)}
                                                                className="p-1 hover:bg-white/10 rounded text-lg transition-colors"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (!user) return;
                                                    if (!newMetricName.trim()) return;

                                                    try {
                                                        const newMetric: CustomMetric = {
                                                            id: newMetricName.toLowerCase().replace(/\s+/g, '_'),
                                                            label: newMetricName,
                                                            icon: newMetricIcon || '📊',
                                                            default_active: true
                                                        };

                                                        const newSettings = {
                                                            ...userSettings,
                                                            metrics: [...userSettings.metrics, newMetric]
                                                        };

                                                        setUserSettings(newSettings);
                                                        setCustomMetrics(prev => ({ ...prev, [newMetric.id]: true }));
                                                        await equipmentService.updateUserSettings(user.id, newSettings);
                                                        setIsCreatingMetric(false);
                                                        setNewMetricName('');
                                                        setNewMetricIcon('📊');
                                                    } catch (error: any) {
                                                        console.error('Error creating metric:', error);
                                                        alert(`Error al crear métrica: ${error.message}`);
                                                    }
                                                }}
                                                className="w-full py-2 bg-gym-primary text-black font-bold rounded text-xs hover:brightness-110 transition-all"
                                            >
                                                GUARDAR MÉTRICA
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-white/10">
                                <button
                                    onClick={() => setCustomMode(false)}
                                    className="flex-1 py-4 rounded-xl font-bold bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors"
                                >
                                    VOLVER
                                </button>
                                <button
                                    onClick={handleCreateCustom}
                                    disabled={!customName.trim()}
                                    className="flex-1 py-4 rounded-xl font-bold bg-gym-primary text-black hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {editingItem ? 'GUARDAR CAMBIOS' : 'CREAR EJERCICIO'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* ROUTINE NAME & SAVE BAR (Floating at bottom for Creation Mode) */}
        {addingMode && !customMode && (
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

