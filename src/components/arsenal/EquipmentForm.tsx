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
            setCustomCategory(editingItem.category || 'STRENGTH_MACHINE'); // Fallback

            // CRITICAL: Ensure we preserve ALL existing metrics from the item
            setCustomMetrics({
                weight: true, reps: true, time: false, distance: false, rpe: false, // Baseline defaults
                ...(editingItem.metrics || {}) // Overlay saved state
            });
            console.log("📝 Editing Item Loaded:", editingItem.name, editingItem.metrics);
        } else {
            // Reset for New
            setCustomMetrics({
                weight: true, reps: true, time: false, distance: false, rpe: false
            });
            setCustomName('');
            setCustomCategory(initialCategory);
        }
    }, [editingItem]);

    const handleSave = async () => {
        if (!user || !customName.trim()) return;
        setSubmitting(true);

        try {
            // 0. AUTO-SAVE PENDING METRICS/CATEGORIES (UX Safety Net)
            let currentSettings = { ...userSettings };
            let updatedSettings = false;

            // Check Pending Category
            if (isCreatingCategory && newCategoryName.trim()) {
                const newCatId = newCategoryName.toUpperCase().replace(/\s+/g, '_');
                // Avoid duplicates
                if (!(currentSettings?.categories || []).some(c => c.id === newCatId)) {
                    const newCat: CustomCategory = { id: newCatId, label: newCategoryName, icon: newCategoryIcon };
                    currentSettings.categories = [...(currentSettings.categories || []), newCat];
                    setCustomCategory(newCat.id); // Auto-select
                    updatedSettings = true;
                }
            }

            // Check Pending Metric
            if (isCreatingMetric && newMetricName.trim()) {
                const newMetId = newMetricName.toLowerCase().replace(/\s+/g, '_');
                // Avoid duplicates
                if (!currentSettings.metrics.some(m => m.id === newMetId)) {
                    const newMet: CustomMetric = { id: newMetId, label: newMetricName, icon: newMetricIcon, default_active: true };
                    currentSettings.metrics = [...currentSettings.metrics, newMet];
                    // Auto-enable for this item
                    setCustomMetrics(prev => ({ ...prev, [newMetId]: true }));
                    updatedSettings = true;
                }
            }

            // Force Save Settings if changed
            if (updatedSettings) {
                await equipmentService.updateUserSettings(user.id, currentSettings);
                onUpdateSettings(currentSettings); // Sync Parent
            }

            // Resolve Icon
            let resolvedIcon = '⚡';
            const standardCat = EQUIPMENT_CATEGORIES[customCategory as keyof typeof EQUIPMENT_CATEGORIES];
            const customCat = (currentSettings?.categories || []).find(c => c.id === customCategory); // Use Latest
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

            let resultItem: Equipment;

            // Check if it's a "Virtual" item (from seeds) that is being "Start"ed/Modified for real use
            const isVirtual = editingItem?.id.startsWith('virtual-') || editingItem?.id.startsWith('new-');

            if (editingItem && !isVirtual) {
                // UPDATE REAL ITEM
                await equipmentService.updateEquipment(editingItem.id, payload);
                resultItem = { ...editingItem, ...payload };
                onSuccess(resultItem, true);
            } else {
                // CREATE (Fresh or Instantiating Virtual Item)
                // If it was virtual, we effectively "clone" it into a real DB item
                // @ts-ignore
                resultItem = await equipmentService.addEquipment({ ...payload, gym_id: null }, user.id);
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
            <div className="bg-neutral-900 border border-white/10 w-full max-w-xl rounded-[1.5rem] p-5 shadow-2xl relative max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-200">

                {/* Header & Close */}
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-black italic text-white uppercase tracking-tight">
                            {mode === 'CUSTOM' ? (editingItem ? 'Editar Ejercicio' : 'Crear Ejercicio') : `Catálogo ${activeSection || ''}`}
                        </h2>
                        <p className="text-[10px] text-neutral-400 tracking-wide mt-0.5">
                            {mode === 'CUSTOM' ? 'Diseña tu propia máquina o ejercicio.' : 'Añade artillería pesada a tu colección.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors shrink-0">
                        <Plus size={20} className="rotate-45 text-neutral-400 hover:text-white" />
                    </button>
                </div>

                {mode === 'CATALOG' ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {catalogItems.length > 0 ? catalogItems.map(seed => (
                                <button
                                    key={seed.name}
                                    onClick={() => onQuickAdd && onQuickAdd(seed)}
                                    className="text-left bg-black border border-white/10 hover:border-gym-primary p-3 rounded-lg flex items-center justify-between group transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl bg-white/5 p-1.5 rounded-lg">
                                            {/* @ts-ignore */}
                                            {EQUIPMENT_CATEGORIES[seed.category]?.icon}
                                        </span>
                                        <span className="font-bold text-xs text-neutral-300 group-hover:text-white transition-colors">{seed.name}</span>
                                    </div>
                                    <div className="text-gym-primary opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all shrink-0">
                                        <Plus size={16} strokeWidth={3} />
                                    </div>
                                </button>
                            )) : (
                                <div className="col-span-full py-6 text-center text-xs text-neutral-500 border border-dashed border-white/10 rounded-xl">
                                    <p>No hay más sugerencias comunes.</p>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-white/10 pt-3 text-center">
                            <button onClick={() => setMode('CUSTOM')} className="inline-flex items-center gap-1.5 text-gym-primary text-xs font-bold hover:text-white transition-colors px-4 py-2 rounded-full hover:bg-white/5">
                                <Plus size={14} />
                                CREAR EJERCICIO PERSONALIZADO
                            </button>
                        </div>
                    </div>
                ) : (
                    // CUSTOM FORM (COMPACTED)
                    <div className="space-y-4">
                        {/* Name Input */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Nombre del Ejercicio</label>
                            <input
                                type="text"
                                autoFocus
                                placeholder="Ej: Press Militar en Máquina Vikinga"
                                className="w-full bg-black border border-white/10 rounded-xl p-3 text-white placeholder-neutral-600 focus:border-gym-primary focus:outline-none text-base font-bold transition-all"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                            />
                        </div>

                        {/* Category Selection */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Categoría</label>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                {Object.entries(EQUIPMENT_CATEGORIES).map(([key, info]: [string, any]) => (
                                    <button
                                        key={key}
                                        onClick={() => setCustomCategory(key)}
                                        className={`p-1 rounded-xl border flex flex-col items-center justify-center text-center transition-all h-14 select-none ${customCategory === key ? 'bg-gym-primary/20 border-gym-primary text-white font-extrabold' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}
                                    >
                                        <span className="text-lg leading-none mb-1">{info.icon}</span>
                                        <span className="text-[8px] font-bold uppercase tracking-tight line-clamp-1 w-full px-1">{info.label}</span>
                                    </button>
                                ))}
                                {(userSettings?.categories || []).map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setCustomCategory(cat.id)}
                                        className={`p-1 rounded-xl border flex flex-col items-center justify-center text-center transition-all h-14 select-none ${customCategory === cat.id ? 'bg-gym-primary/20 border-gym-primary text-white font-extrabold' : 'bg-black border-white/10 text-neutral-400 hover:border-white/30'}`}
                                    >
                                        <span className="text-lg leading-none mb-1">{cat.icon}</span>
                                        <span className="text-[8px] font-bold uppercase tracking-tight line-clamp-1 w-full px-1">{cat.label}</span>
                                    </button>
                                ))}

                                {/* New Category Trigger */}
                                {!isCreatingCategory && (
                                    <button onClick={() => setIsCreatingCategory(true)} className="p-1 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center text-center text-neutral-500 hover:text-white hover:bg-white/5 transition-all h-14 select-none">
                                        <Plus size={14} className="mb-0.5" />
                                        <span className="text-[8px] font-black uppercase tracking-wider">Nueva</span>
                                    </button>
                                )}
                            </div>

                            {/* Inline Category Creator */}
                            {isCreatingCategory && (
                                <div className="bg-neutral-900 rounded-xl p-3 border border-white/10 flex flex-col gap-2 mt-1.5 animate-in slide-in-from-top-2 duration-150">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-white uppercase">Nueva Categoría</span>
                                        <button onClick={() => setIsCreatingCategory(false)} className="text-neutral-400 hover:text-white"><X size={14} /></button>
                                    </div>
                                    <input type="text" placeholder="Nombre (ej: Yoga)" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="bg-black border border-white/10 rounded-lg p-2 text-xs text-white font-bold w-full" autoFocus />
                                    <div className="flex gap-2">
                                        <input type="text" value={newCategoryIcon} onChange={e => setNewCategoryIcon(e.target.value)} className="w-12 bg-black border border-white/10 rounded-lg p-1.5 text-lg text-center" />
                                        <div className="flex-1 flex gap-1.5 overflow-x-auto items-center no-scrollbar">
                                            {['🧘', '🤸', '🧗', '🥊', '🏊', '🚴', '🏃', '🥋', '🎸', '💃'].map(emoji => (
                                                <button key={emoji} onClick={() => setNewCategoryIcon(emoji)} className="text-base p-1 hover:bg-white/10 rounded">{emoji}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!newCategoryName.trim()) return;
                                            const newCat: CustomCategory = { id: newCategoryName.toUpperCase().replace(/\s+/g, '_'), label: newCategoryName, icon: newCategoryIcon };
                                            const newS = { ...userSettings, categories: [...(userSettings?.categories || []), newCat] };
                                            await equipmentService.updateUserSettings(user.id, newS);
                                            onUpdateSettings(newS);
                                            setCustomCategory(newCat.id);
                                            setIsCreatingCategory(false);
                                        }}
                                        className="w-full py-2 bg-gym-primary text-black font-black text-xs rounded-lg uppercase tracking-wider hover:brightness-110"
                                    >CREAR</button>
                                </div>
                            )}
                        </div>

                        {/* Metrics Section (SUPER COMPACT GRID) */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Métricas Activas</label>
                            <div className="bg-black/30 rounded-xl p-3 border border-white/5 shadow-inner">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[
                                        { id: 'weight', label: 'Peso', icon: '⚖️' },
                                        { id: 'reps', label: 'Reps', icon: '🔄' },
                                        { id: 'time', label: 'Tiempo', icon: '⏱️' },
                                        { id: 'distance', label: 'Distancia', icon: '📏' },
                                        { id: 'rpe', label: 'RPE', icon: '🔥' },
                                        ...userSettings.metrics
                                    ].map(m => {
                                        const isChecked = !!customMetrics[m.id as keyof typeof customMetrics];
                                        return (
                                            <div key={m.id} className={`flex items-center justify-between p-2 px-2.5 rounded-lg border transition-all ${isChecked ? 'bg-gym-primary/10 border-gym-primary/30' : 'bg-neutral-900/50 border-white/5 hover:border-white/10'}`}>
                                                <div className="flex items-center gap-1.5 select-none">
                                                    <span className="text-base shrink-0">{m.icon}</span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-tight ${isChecked ? 'text-white font-extrabold' : 'text-neutral-400'}`}>{m.label}</span>
                                                </div>
                                                <button
                                                    onClick={() => setCustomMetrics(prev => ({ ...prev, [m.id]: !prev[m.id as keyof typeof prev] }))}
                                                    className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${isChecked ? 'bg-gym-primary' : 'bg-neutral-800'}`}
                                                >
                                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-md ${isChecked ? 'translate-x-4.5' : 'translate-x-0'}`} style={{ left: '2px' }} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-3 border-t border-white/10">
                            <button onClick={() => { if (mode === 'CUSTOM' && !editingItem) setMode('CATALOG'); else onClose(); }} className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors uppercase tracking-wider">VOLVER</button>
                            <button onClick={handleSave} disabled={submitting || !customName.trim()} className="flex-1 py-2.5 rounded-xl font-black text-xs bg-gym-primary text-black hover:brightness-110 transition-all disabled:opacity-50 uppercase tracking-wider">
                                {submitting ? <Loader className="animate-spin mx-auto" size={16} /> : (editingItem ? 'GUARDAR CAMBIOS' : 'CREAR EJERCICIO')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
