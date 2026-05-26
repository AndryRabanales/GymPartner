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
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-3">
            <div className="bg-neutral-900/95 border border-white/10 w-full max-w-md rounded-[1.25rem] p-4 shadow-2xl relative max-h-[98vh] overflow-y-auto animate-in zoom-in-95 duration-200 no-scrollbar">

                {/* Header Row (Merged & Compact) */}
                <div className="flex justify-between items-center pb-2 mb-3 border-b border-white/5">
                    <h2 className="text-base font-black italic text-white uppercase tracking-tight flex items-center gap-1.5 select-none">
                        <span className="text-gym-primary animate-pulse">⚡</span> 
                        {editingItem ? 'Editar Ejercicio' : 'Crear Ejercicio'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-all shrink-0">
                        <Plus size={18} className="rotate-45 text-neutral-400 hover:text-white" />
                    </button>
                </div>

                {mode === 'CATALOG' ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-1.5">
                            {catalogItems.length > 0 ? catalogItems.map(seed => (
                                <button
                                    key={seed.name}
                                    onClick={() => onQuickAdd && onQuickAdd(seed)}
                                    className="text-left bg-black border border-white/5 hover:border-gym-primary/50 p-2.5 rounded-lg flex items-center justify-between group transition-all"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-lg bg-white/5 p-1 rounded-md shrink-0">
                                            {/* @ts-ignore */}
                                            {EQUIPMENT_CATEGORIES[seed.category]?.icon}
                                        </span>
                                        <span className="font-bold text-xs text-neutral-300 group-hover:text-white transition-colors">{seed.name}</span>
                                    </div>
                                    <div className="text-gym-primary opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all shrink-0">
                                        <Plus size={14} strokeWidth={3} />
                                    </div>
                                </button>
                            )) : (
                                <div className="py-6 text-center text-[10px] text-neutral-500 border border-dashed border-white/10 rounded-lg">
                                    <p>No hay más sugerencias comunes.</p>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-white/5 pt-2.5 text-center">
                            <button onClick={() => setMode('CUSTOM')} className="inline-flex items-center gap-1.5 text-gym-primary text-xs font-bold hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-white/5">
                                <Plus size={12} />
                                CREAR EJERCICIO PERSONALIZADO
                            </button>
                        </div>
                    </div>
                ) : (
                    // CUSTOM FORM (ULTRA-COMPACTED, ROUND & DYNAMIC)
                    <div className="space-y-3.5">
                        {/* Name Input - Sleek Floating Style & Fully Rounded */}
                        <div className="relative group">
                            <input
                                type="text"
                                autoFocus
                                placeholder="Nombre del Ejercicio..."
                                className="w-full bg-neutral-950 border border-white/10 rounded-full pl-5 pr-16 py-2 text-white placeholder-neutral-600 focus:border-gym-primary/60 focus:ring-2 focus:ring-gym-primary/10 focus:outline-none text-sm font-bold transition-all duration-300 shadow-inner group-hover:border-white/20"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                            />
                            <span className="absolute right-4 top-2 text-[8px] font-black text-neutral-500 uppercase tracking-widest pointer-events-none select-none transition-colors duration-300 group-focus-within:text-gym-primary">
                                NOMBRE
                            </span>
                        </div>

                        {/* Category Selector Grid (Elegant Pill Capsules) */}
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-wider pl-1 select-none">Categoría</span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {Object.entries(EQUIPMENT_CATEGORIES).map(([key, info]: [string, any]) => {
                                    const isSelected = customCategory === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setCustomCategory(key)}
                                            className={`relative p-1 pr-3 rounded-full border flex flex-row items-center gap-2 text-left transition-all ease-[cubic-bezier(0.34,1.56,0.64,1)] duration-300 h-9 w-full group select-none ${
                                                isSelected 
                                                    ? 'bg-gym-primary text-black border-gym-primary shadow-[0_4px_12px_rgba(250,204,21,0.3)] scale-[1.03] z-10 font-black' 
                                                    : 'bg-black/45 border-white/5 text-neutral-400 hover:border-white/20 hover:bg-neutral-900/60 hover:text-white hover:scale-[1.02]'
                                            }`}
                                        >
                                            {/* Circular Image/Emoji Frame */}
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 ${
                                                isSelected ? 'bg-black/90 text-gym-primary scale-105' : 'bg-white/5 group-hover:bg-white/10 text-neutral-300'
                                            }`}>
                                                <span className="text-base leading-none">{info.icon}</span>
                                            </div>
                                            {/* Label */}
                                            <span className={`text-[8.5px] font-black uppercase tracking-wider line-clamp-1 truncate transition-colors duration-300 ${
                                                isSelected ? 'text-black font-extrabold' : 'text-neutral-400 group-hover:text-neutral-200'
                                            }`}>
                                                {info.label}
                                            </span>
                                        </button>
                                    );
                                })}
                                {(userSettings?.categories || []).map((cat) => {
                                    const isSelected = customCategory === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setCustomCategory(cat.id)}
                                            className={`relative p-1 pr-3 rounded-full border flex flex-row items-center gap-2 text-left transition-all ease-[cubic-bezier(0.34,1.56,0.64,1)] duration-300 h-9 w-full group select-none ${
                                                isSelected 
                                                    ? 'bg-gym-primary text-black border-gym-primary shadow-[0_4px_12px_rgba(250,204,21,0.3)] scale-[1.03] z-10 font-black' 
                                                    : 'bg-black/35 border-white/5 text-neutral-400 hover:border-white/20 hover:bg-neutral-900/60 hover:text-white hover:scale-[1.02]'
                                            }`}
                                        >
                                            {/* Circular Image/Emoji Frame */}
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 ${
                                                isSelected ? 'bg-black/90 text-gym-primary scale-105' : 'bg-white/5 group-hover:bg-white/10 text-neutral-300'
                                            }`}>
                                                <span className="text-base leading-none">{cat.icon}</span>
                                            </div>
                                            {/* Label */}
                                            <span className={`text-[8.5px] font-black uppercase tracking-wider line-clamp-1 truncate transition-colors duration-300 ${
                                                isSelected ? 'text-black font-extrabold' : 'text-neutral-400 group-hover:text-neutral-200'
                                            }`}>
                                                {cat.label}
                                            </span>
                                        </button>
                                    );
                                })}

                                {/* New Category Trigger - Fully Rounded Pill */}
                                {!isCreatingCategory && (
                                    <button 
                                        onClick={() => setIsCreatingCategory(true)} 
                                        className="relative p-1 pr-3 rounded-full border border-dashed border-white/25 flex flex-row items-center gap-2 text-left text-neutral-500 hover:text-white hover:bg-white/5 hover:border-white/40 transition-all ease-[cubic-bezier(0.34,1.56,0.64,1)] duration-300 h-9 w-full group select-none"
                                    >
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white/5 group-hover:bg-white/10 transition-all duration-300 shrink-0">
                                            <Plus size={12} className="group-hover:scale-110 group-hover:rotate-90 transition-all duration-300" />
                                        </div>
                                        <span className="text-[8.5px] font-black uppercase tracking-wider leading-none text-neutral-500 group-hover:text-neutral-300">
                                            Nueva
                                        </span>
                                    </button>
                                )}
                            </div>

                            {/* Inline Category Creator - Smooth Rounded Card */}
                            {isCreatingCategory && (
                                <div className="bg-neutral-900 border border-white/10 rounded-2xl p-3 flex flex-col gap-2 mt-2 animate-in zoom-in-95 duration-200 ease-out">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black text-white uppercase tracking-wider pl-1">Nueva Categoría</span>
                                        <button onClick={() => setIsCreatingCategory(false)} className="text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded-full"><X size={12} /></button>
                                    </div>
                                    <input type="text" placeholder="Nombre (ej: Yoga)" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="bg-black border border-white/15 rounded-full px-3.5 py-2 text-xs text-white font-bold w-full focus:outline-none focus:border-gym-primary" autoFocus />
                                    <div className="flex gap-2">
                                        <input type="text" value={newCategoryIcon} onChange={e => setNewCategoryIcon(e.target.value)} className="w-11 bg-black border border-white/15 rounded-full p-2 text-base text-center" />
                                        <div className="flex-1 flex gap-1.5 overflow-x-auto items-center no-scrollbar">
                                            {['🧘', '🤸', '🧗', '🥊', '🏊', '🚴', '🏃', '🥋', '🎸', '💃'].map(emoji => (
                                                <button key={emoji} onClick={() => setNewCategoryIcon(emoji)} className="text-lg p-1.5 hover:bg-white/10 rounded-full shrink-0 transition-transform active:scale-95">{emoji}</button>
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
                                        className="w-full py-1.5 bg-gym-primary text-black font-black text-[10px] rounded-full uppercase tracking-wider hover:brightness-110 shadow-lg shadow-gym-primary/10 active:scale-95 transition-all"
                                    >CREAR</button>
                                </div>
                            )}
                        </div>

                        {/* Metrics Section (Premium Fully Rounded Chips) */}
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-wider pl-1 select-none">Métricas Activas</span>
                            <div className="grid grid-cols-2 gap-1.5">
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
                                        <div 
                                            key={m.id} 
                                            onClick={() => setCustomMetrics(prev => ({ ...prev, [m.id]: !prev[m.id as keyof typeof prev] }))}
                                            className={`flex items-center justify-between p-1.5 pl-3 pr-2.5 rounded-full border cursor-pointer select-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.02] ${
                                                isChecked 
                                                    ? 'bg-gym-primary/10 border-gym-primary/45 shadow-[0_4px_12px_rgba(250,204,21,0.1)] text-gym-primary font-bold' 
                                                    : 'bg-neutral-900/50 border-white/5 text-neutral-400 hover:border-white/10 hover:bg-neutral-900/80 hover:text-neutral-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="text-sm shrink-0">{m.icon}</span>
                                                <span className={`text-[9px] font-black uppercase tracking-widest truncate ${isChecked ? 'text-white' : 'text-neutral-500'}`}>{m.label}</span>
                                            </div>
                                            <div
                                                className={`w-7 h-4 rounded-full relative transition-colors duration-300 shrink-0 ${
                                                    isChecked ? 'bg-gym-primary' : 'bg-neutral-800'
                                                }`}
                                            >
                                                <div 
                                                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-300 shadow-md ${
                                                        isChecked ? 'translate-x-3.5' : 'translate-x-0'
                                                    }`} 
                                                    style={{ left: '2px' }} 
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Actions - Fully Rounded & Dynamic */}
                        <div className="flex gap-2.5 pt-2.5 border-t border-white/5">
                            <button onClick={() => { if (mode === 'CUSTOM' && !editingItem) setMode('CATALOG'); else onClose(); }} className="flex-1 py-2 rounded-full font-black text-[10px] bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-all active:scale-95 uppercase tracking-wider">VOLVER</button>
                            <button onClick={handleSave} disabled={submitting || !customName.trim()} className="flex-1 py-2 rounded-full font-black text-[10px] bg-gym-primary text-black hover:brightness-110 shadow-lg shadow-gym-primary/10 active:scale-95 transition-all disabled:opacity-50 uppercase tracking-wider">
                                {submitting ? <Loader className="animate-spin mx-auto" size={14} /> : (editingItem ? 'GUARDAR' : 'CREAR')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
