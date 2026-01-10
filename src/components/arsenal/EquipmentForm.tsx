import { useState, useEffect } from 'react';
import { Plus, X, Loader } from 'lucide-react';
import type { Equipment, CustomSettings, CustomCategory, CustomMetric } from '../../services/GymEquipmentService';
import { equipmentService, EQUIPMENT_CATEGORIES } from '../../services/GymEquipmentService';

interface EquipmentFormProps {
    user: any;
    userSettings: CustomSettings;
    onUpdateSettings: (newSettings: CustomSettings) => void; // Parent needs to know if settings change
    editingItem?: Equipment | null;
    initialCategory?: string; // For auto-selection based on muscle group
    onClose: () => void;
    onSuccess: (item: Equipment, isEdit: boolean) => void;

    // Catalog Props
    activeSection?: string;
    catalogItems?: any[];
    onQuickAdd?: (item: any) => void;
}

export const EquipmentForm = ({
    user,
    userSettings,
    onUpdateSettings,
    editingItem,
    initialCategory = 'STRENGTH_MACHINE',
    onClose,
    onSuccess,
    activeSection,
    catalogItems = [],
    onQuickAdd
}: EquipmentFormProps) => {

    // View State
    const [mode, setMode] = useState<'CATALOG' | 'CUSTOM'>(editingItem ? 'CUSTOM' : 'CATALOG');
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [customName, setCustomName] = useState('');
    const [customCategory, setCustomCategory] = useState<string>(initialCategory);
    const [customMetrics, setCustomMetrics] = useState<Record<string, boolean>>({
        weight: true, reps: true, time: false, distance: false, rpe: false
    });

    // Sub-Editor State
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryIcon, setNewCategoryIcon] = useState('✨');

    const [isCreatingMetric, setIsCreatingMetric] = useState(false);
    const [newMetricName, setNewMetricName] = useState('');
    const [newMetricIcon, setNewMetricIcon] = useState('📊');

    // Initialize View
    useEffect(() => {
        if (editingItem) {
            setMode('CUSTOM');
            setCustomName(editingItem.name);
            setCustomCategory(editingItem.category);
            setCustomMetrics({
                weight: true, reps: true, time: false, distance: false, rpe: false, // defaults
                ...editingItem.metrics
            });
        }
    }, [editingItem]);

    const handleSave = async () => {
        if (!user || !customName.trim()) return;
        setSubmitting(true);

        try {
            // Resolve Icon
            let resolvedIcon = '⚡';
            const standardCat = EQUIPMENT_CATEGORIES[customCategory as keyof typeof EQUIPMENT_CATEGORIES];
            const customCat = userSettings.categories.find(c => c.id === customCategory);
            // @ts-ignore
            if (standardCat) resolvedIcon = standardCat.icon;
            if (customCat) resolvedIcon = customCat.icon;

            const payload = {
                name: customName,
                category: customCategory,
                metrics: customMetrics,
                icon: resolvedIcon,
                quantity: 1,
                // Gym ID logic handled by service or fixed to Personal for custom items?
                // The original code tried to ensurePersonalGym.
            };

            // Ensure Personal Gym for Custom Items so they are Global
            const personalGymId = await import('../../services/UserService').then(m => m.userService.ensurePersonalGym(user.id));

            let resultItem: Equipment;

            if (editingItem) {
                // UPDATE
                await equipmentService.updateEquipment(editingItem.id, payload);
                resultItem = { ...editingItem, ...payload };
                onSuccess(resultItem, true);
            } else {
                // CREATE
                // @ts-ignore
                resultItem = await equipmentService.addEquipment({ ...payload, gym_id: personalGymId }, user.id);
                onSuccess(resultItem, false);
            }
            onClose();

        } catch (error: any) {
            console.error('Error saving equipment:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 w-full max-w-2xl rounded-[2rem] p-8 shadow-2xl relative max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200">

                {/* Header & Close */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-3xl font-black italic text-white uppercase mb-1">
                            {mode === 'CUSTOM' ? (editingItem ? 'Editar Ejercicio' : 'Crear Ejercicio') : `Catálogo ${activeSection || ''}`}
                        </h2>
                        <p className="text-neutral-400">
                            {mode === 'CUSTOM' ? 'Diseña tu propia máquina o ejercicio.' : 'Añade artillería pesada a tu colección.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <Plus size={24} className="rotate-45" />
                    </button>
                </div>

                {mode === 'CATALOG' ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {catalogItems.length > 0 ? catalogItems.map(seed => (
                                <button
                                    key={seed.name}
                                    onClick={() => onQuickAdd && onQuickAdd(seed)}
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
                            <button onClick={() => setMode('CUSTOM')} className="inline-flex items-center gap-2 text-gym-primary font-bold hover:text-white transition-colors px-6 py-3 rounded-full hover:bg-white/5">
                                <Plus size={18} />
                                CREAR EJERCICIO PERSONALIZADO
                            </button>
                        </div>
                    </div>
                ) : (
                    // CUSTOM FORM
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
                                {Object.entries(EQUIPMENT_CATEGORIES).map(([key, info]: [string, any]) => (
                                    <button
                                        key={key}
                                        onClick={() => setCustomCategory(key)}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${customCategory === key ? 'bg-gym-primary/20 border-gym-primary text-white' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}
                                    >
                                        <span className="text-2xl">{info.icon}</span>
                                        <span className="text-xs font-bold uppercase">{info.label}</span>
                                    </button>
                                ))}
                                {userSettings.categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setCustomCategory(cat.id)}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${customCategory === cat.id ? 'bg-gym-primary/20 border-gym-primary text-white' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}
                                    >
                                        <span className="text-2xl">{cat.icon}</span>
                                        <span className="text-xs font-bold uppercase">{cat.label}</span>
                                    </button>
                                ))}

                                {/* New Category Trigger */}
                                {!isCreatingCategory && (
                                    <button onClick={() => setIsCreatingCategory(true)} className="p-3 rounded-xl border border-dashed border-white/20 flex flex-col items-center gap-2 text-neutral-500 hover:text-white hover:bg-white/5 transition-all group min-h-[88px] justify-center">
                                        <Plus size={16} />
                                        <span className="text-[10px] font-bold uppercase">Nueva</span>
                                    </button>
                                )}
                            </div>

                            {/* Inline Category Creator */}
                            {isCreatingCategory && (
                                <div className="bg-neutral-900 rounded-xl p-4 border border-white/10 flex flex-col gap-4 mt-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-white uppercase">Nueva Categoría</span>
                                        <button onClick={() => setIsCreatingCategory(false)}><X size={18} /></button>
                                    </div>
                                    <input type="text" placeholder="Nombre (ej: Yoga)" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="bg-black border border-white/10 rounded-lg p-3 text-white font-bold w-full" autoFocus />
                                    <div className="flex gap-2">
                                        <input type="text" value={newCategoryIcon} onChange={e => setNewCategoryIcon(e.target.value)} className="w-16 bg-black border border-white/10 rounded-lg p-3 text-2xl text-center" />
                                        <div className="flex-1 flex gap-2 overflow-x-auto items-center">
                                            {['🧘', '🤸', '🧗', '🥊', '🏊', '🚴', '🏃', '🥋', '🎸', '💃'].map(emoji => (
                                                <button key={emoji} onClick={() => setNewCategoryIcon(emoji)} className="text-xl p-2 hover:bg-white/10 rounded">{emoji}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!newCategoryName.trim()) return;
                                            const newCat: CustomCategory = { id: newCategoryName.toUpperCase().replace(/\s+/g, '_'), label: newCategoryName, icon: newCategoryIcon };
                                            const newS = { ...userSettings, categories: [...userSettings.categories, newCat] };
                                            await equipmentService.updateUserSettings(user.id, newS);
                                            onUpdateSettings(newS);
                                            setCustomCategory(newCat.id);
                                            setIsCreatingCategory(false);
                                        }}
                                        className="w-full py-3 bg-gym-primary text-black font-bold rounded-lg"
                                    >CREAR</button>
                                </div>
                            )}
                        </div>

                        {/* Metrics */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Métricas</label>
                            <div className="bg-black/50 rounded-xl p-4 border border-white/5 space-y-3 max-h-[300px] overflow-y-auto">
                                {[
                                    { id: 'weight', label: 'Peso (Lbs/Kgs)', icon: '⚖️' },
                                    { id: 'reps', label: 'Repeticiones', icon: '🔄' },
                                    { id: 'time', label: 'Tiempo', icon: '⏱️' },
                                    { id: 'distance', label: 'Distancia', icon: '📏' },
                                    { id: 'rpe', label: 'RPE', icon: '🔥' },
                                    ...userSettings.metrics
                                ].map(m => (
                                    <div key={m.id} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">{m.icon}</span>
                                            <span className="text-sm font-medium text-neutral-300">{m.label}</span>
                                        </div>
                                        <button
                                            onClick={() => setCustomMetrics(prev => ({ ...prev, [m.id]: !prev[m.id as keyof typeof prev] }))}
                                            className={`w-12 h-7 rounded-full relative ${customMetrics[m.id as keyof typeof customMetrics] ? 'bg-gym-primary' : 'bg-neutral-800'}`}
                                        >
                                            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${customMetrics[m.id as keyof typeof customMetrics] ? 'left-6' : 'left-1'}`} />
                                        </button>
                                    </div>
                                ))}

                                {!isCreatingMetric ? (
                                    <button onClick={() => setIsCreatingMetric(true)} className="w-full py-2 border border-dashed border-white/20 rounded-lg text-neutral-500 hover:text-white uppercase text-xs font-bold flex items-center justify-center gap-2">
                                        <Plus size={14} /> Crear Métrica
                                    </button>
                                ) : (
                                    <div className="bg-neutral-900 rounded-lg p-3 border border-white/10 space-y-3">
                                        <div className="flex justify-between"><span className="text-xs font-bold text-white">NUEVA MÉTRICA</span><button onClick={() => setIsCreatingMetric(false)}><X size={14} /></button></div>
                                        <input type="text" placeholder="Nombre" value={newMetricName} onChange={e => setNewMetricName(e.target.value)} className="w-full bg-black border border-white/10 rounded p-2 text-sm text-white" />
                                        <div className="flex gap-2">
                                            <input type="text" value={newMetricIcon} onChange={e => setNewMetricIcon(e.target.value)} className="w-10 bg-black border border-white/10 rounded p-2 text-center" />
                                            <div className="flex-1 flex gap-1 overflow-x-auto items-center">{['🔥', '💓', '🌡️', '⚡'].map(e => <button key={e} onClick={() => setNewMetricIcon(e)} className="p-1 hover:bg-white/10 rounded">{e}</button>)}</div>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (!newMetricName.trim()) return;
                                                try {
                                                    const newMet: CustomMetric = { id: newMetricName.toLowerCase().replace(/\s+/g, '_'), label: newMetricName, icon: newMetricIcon, default_active: true };

                                                    // Check for duplicates
                                                    if (userSettings.metrics.some(m => m.id === newMet.id)) {
                                                        alert("Esta métrica ya existe.");
                                                        return;
                                                    }

                                                    const newS = { ...userSettings, metrics: [...userSettings.metrics, newMet] };

                                                    await equipmentService.updateUserSettings(user.id, newS);
                                                    onUpdateSettings(newS); // Update parent state

                                                    // Select it immediately for the current custom exercise
                                                    setCustomMetrics(prev => ({ ...prev, [newMet.id]: true }));
                                                    setIsCreatingMetric(false);
                                                } catch (err) {
                                                    console.error("Error creating metric:", err);
                                                    alert("Error al guardar la métrica. Intenta de nuevo.");
                                                }
                                            }}
                                            className="w-full py-2 bg-gym-primary text-black font-bold rounded text-xs"
                                        >GUARDAR</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-white/10">
                            <button onClick={() => { if (mode === 'CUSTOM' && !editingItem) setMode('CATALOG'); else onClose(); }} className="flex-1 py-4 rounded-xl font-bold bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors">VOLVER</button>
                            <button onClick={handleSave} disabled={submitting || !customName.trim()} className="flex-1 py-4 rounded-xl font-bold bg-gym-primary text-black hover:brightness-110 transition-all disabled:opacity-50">
                                {submitting ? <Loader className="animate-spin mx-auto" /> : (editingItem ? 'GUARDAR CAMBIOS' : 'CREAR EJERCICIO')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
