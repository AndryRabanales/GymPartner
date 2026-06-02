import { useState } from 'react';
import { Plus, Dumbbell, Hash, Clock, MapPin, Flame } from 'lucide-react';
import type { Equipment, CustomSettings } from '../../services/GymEquipmentService';
import { getMuscleGroup, normalizeText } from '../../utils/inventoryUtils';
import { ArsenalCard } from './ArsenalCard';

// Metric definition for the toolbar
interface MetricDef {
    id: string;
    label: string;
    icon: React.ReactNode;
    /** Which exercise categories this metric applies to by default */
    defaultFor: 'strength' | 'cardio' | 'all';
    color: string;
    activeColor: string;
}

const METRIC_DEFS: MetricDef[] = [
    { id: 'weight',   label: 'PESO',    icon: <Dumbbell size={13} strokeWidth={2.5} />, defaultFor: 'strength', color: 'from-amber-500 to-yellow-600', activeColor: 'bg-amber-500' },
    { id: 'reps',     label: 'REPS',    icon: <Hash size={13} strokeWidth={2.5} />,     defaultFor: 'strength', color: 'from-emerald-500 to-green-600', activeColor: 'bg-emerald-500' },
    { id: 'time',     label: 'TIEMPO',  icon: <Clock size={13} strokeWidth={2.5} />,    defaultFor: 'cardio',   color: 'from-blue-500 to-cyan-600', activeColor: 'bg-blue-500' },
    { id: 'distance', label: 'DIST',    icon: <MapPin size={13} strokeWidth={2.5} />,   defaultFor: 'cardio',   color: 'from-purple-500 to-violet-600', activeColor: 'bg-purple-500' },
    { id: 'rpe',      label: 'RPE',     icon: <Flame size={13} strokeWidth={2.5} />,    defaultFor: 'strength',      color: 'from-red-500 to-orange-600', activeColor: 'bg-red-500' },
];

const CARDIO_GROUPS = new Set([
    'CARDIO',
]);

interface ArsenalGridProps {
    inventory: Equipment[];
    selectedItems: Set<string>;
    userSettings: CustomSettings;
    searchTerm: string;
    onToggleSelection: (id: string) => void;
    onOpenCatalog: (section: string) => void;
    onEditItem: (item: Equipment) => void;
    routineConfigs?: Map<string, any>;
    gridClassName?: string;
    sectionOrder?: string[];
    /** Global metric toggles state (managed by parent) */
    globalMetrics?: Record<string, boolean>;
    /** Callback when a global metric toggle is clicked */
    onToggleGlobalMetric?: (metricId: string) => void;
    /** Set of item IDs that have been manually overridden by the user */
    metricOverrides?: Set<string>;
    /** Map of normalized seed name → variant badge info (for catalog view) */
    variantBadgeMap?: Map<string, { label: string; total: number; baseId: string; currentId?: string; variants: any[] }>;
    /** Called when the user cycles to the next variant via the badge arrow */
    onVariantCycle?: (oldId: string, newId: string, baseId: string, newVariant: any) => void;
    /** Set of item IDs that are locked (from ocultos/ folder) */
    lockedItemIds?: Set<string>;
    /** Called when the user taps the lock overlay to unlock an exercise */
    onUnlockItem?: (itemId: string) => void;
}

export const ArsenalGrid = ({
    inventory,
    selectedItems,
    userSettings,
    searchTerm,
    onToggleSelection,
    onOpenCatalog,
    onEditItem,
    routineConfigs = new Map(),
    gridClassName = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2",
    sectionOrder,
    globalMetrics,
    onToggleGlobalMetric,
    metricOverrides,
    variantBadgeMap,
    onVariantCycle,
    lockedItemIds,
    onUnlockItem,
}: ArsenalGridProps) => {

    const DEFAULT_ORDER = [
        'PECHO', 'HOMBRO', 'TRÍCEPS',
        'ESPALDA', 'BÍCEPS', 'ANTEBRAZO',
        'CUÁDRICEPS', 'ISQUIOTIBIALES', 'GLÚTEOS', 'PANTORRILLAS', 'ADUCTORES',
        'ABDOMINALES', 'LUMBARES', 'CUELLO',
        'CARDIO',
        'Otros'
    ];

    const finalOrder = sectionOrder || DEFAULT_ORDER;

    const filteredInventory = inventory.filter(item =>
        normalizeText(item.name).includes(normalizeText(searchTerm))
    );

    const groupedInventory: Record<string, Equipment[]> = {};
    filteredInventory.forEach(item => {
        const group = getMuscleGroup(item, userSettings);
        if (!groupedInventory[group]) groupedInventory[group] = [];
        groupedInventory[group].push(item);
    });

    // Toolbar animation state
    const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);

    const showToolbar = globalMetrics && onToggleGlobalMetric;

    return (
        <div className="space-y-6" id="tut-arsenal-grid">
            {/* Visual Stats Bar + Global Metrics Toolbar */}
            <div className="flex flex-col gap-2 mb-4 px-1">
                {/* Row 1: Counts */}
                <div className="flex items-center gap-2">
                    <div className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-bold text-neutral-400 whitespace-nowrap">
                        {inventory.length} Total
                    </div>
                    <div className="px-3 py-1 rounded-full bg-gym-primary/10 border border-gym-primary/20 text-[10px] font-bold text-gym-primary whitespace-nowrap">
                        {selectedItems.size} Selected
                    </div>
                </div>

                {/* Row 2: Global Metrics Toolbar */}
                {showToolbar && (
                    <div 
                        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1"
                        style={{ animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
                    >
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600 shrink-0 mr-1 select-none hidden sm:inline-block">
                            Métricas
                        </span>
                        
                        {[...METRIC_DEFS, ...(userSettings.metrics || []).map(m => ({ id: m.id, label: m.label, icon: m.icon, defaultFor: 'all' as const }))].map((metric) => {
                            const isActive = globalMetrics![metric.id] ?? false;
                            
                            return (
                                <button
                                    key={metric.id}
                                    type="button"
                                    onClick={() => onToggleGlobalMetric!(metric.id)}
                                    className={`
                                        shrink-0 flex items-center gap-1 px-2 py-1 rounded-md
                                        text-[9px] font-bold uppercase tracking-wider
                                        transition-all duration-200 cursor-pointer border select-none
                                        ${isActive
                                            ? 'bg-gym-primary/10 text-gym-primary border-gym-primary/50 shadow-[0_0_10px_rgba(250,204,21,0.1)]'
                                            : 'bg-neutral-900/50 text-neutral-500 border-neutral-800 hover:bg-neutral-800 hover:text-neutral-400'
                                        }
                                        active:scale-95
                                    `}
                                    title={`Activar/Desactivar ${metric.label}`}
                                >
                                    <span>{metric.icon}</span>
                                    <span>{metric.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Render Groups */}
            {finalOrder.map(section => {
                const items = groupedInventory[section] || [];
                // Only show essential categories if search is active
                if (items.length === 0 && searchTerm) return null;
                if (items.length === 0 && section === 'Otros') return null;

                return (
                    <div 
                        key={section} 
                        id={`category-section-${section}`}
                        className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both scroll-mt-40"
                    >
                        <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-2 pl-1 sticky top-36 z-30 bg-black/80 backdrop-blur w-fit px-2 rounded-r-full border-l-2 border-gym-primary">{section}</h3>

                        <div className={gridClassName}>
                            {items.map(item => {
                                const variantInfo = variantBadgeMap?.get(item.id);
                                const locked = lockedItemIds?.has(item.id) ?? false;
                                // When a variant is active, selection is scoped to that specific variant
                                // (format: "manifest-X__variantId"). Non-variant items use item.id directly.
                                const effectiveSelectionId = variantInfo?.currentId
                                    ? `${item.id}__${variantInfo.currentId}`
                                    : item.id;
                                const isSelected = selectedItems.has(effectiveSelectionId);
                                let effectiveConfig = routineConfigs.get(item.id);

                                // Preview global metrics for unselected items
                                if (!isSelected && globalMetrics) {
                                    const isCardio = section === 'CARDIO' || getMuscleGroup(item, userSettings) === 'CARDIO';
                                    const activeCustomMetric = Object.keys(globalMetrics).find(
                                        k => !['weight', 'reps', 'time', 'distance', 'rpe'].includes(k) && globalMetrics[k]
                                    );
                                    effectiveConfig = {
                                        track_weight: !isCardio ? globalMetrics.weight : false,
                                        track_reps: !isCardio ? globalMetrics.reps : false,
                                        track_time: isCardio ? globalMetrics.time : false,
                                        track_distance: isCardio ? globalMetrics.distance : false,
                                        track_rpe: !isCardio ? globalMetrics.rpe : false,
                                        custom_metric: activeCustomMetric || null
                                    };
                                }
                                return (
                                    <div
                                        key={item.id}
                                        className="cursor-pointer"
                                        onClick={(e) => {
                                            if (locked) return;
                                            if ((e.target as HTMLElement).closest('[data-variant-btn="true"]')) return;
                                            onToggleSelection(effectiveSelectionId);
                                        }}
                                    >
                                        <ArsenalCard
                                            item={item}
                                            muscleGroup={section}
                                            isSelected={isSelected}
                                            userSettings={userSettings}
                                            onEdit={onEditItem}
                                            configOverride={effectiveConfig}
                                            variantLabel={variantInfo?.label}
                                            variantTotal={variantInfo?.total}
                                            isLocked={locked}
                                            onUnlock={locked && onUnlockItem ? () => onUnlockItem(item.id) : undefined}
                                            onVariantCycle={!locked && variantInfo && onVariantCycle ? (direction) => {
                                                const variants = variantInfo.variants;
                                                const currentIdx = variants.findIndex((v: any) => v.label === variantInfo.label);
                                                let nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
                                                if (nextIdx < 0) nextIdx = variants.length - 1;
                                                if (nextIdx >= variants.length) nextIdx = 0;
                                                const next = variants[nextIdx];
                                                onVariantCycle(item.id, `${item.id}__${next.id}`, variantInfo.baseId, next);
                                            } : undefined}
                                        />
                                    </div>
                                );
                            })}

                            {/* Premium Add Button */}
                            <button
                                onClick={() => onOpenCatalog(section)}
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

            {/* Inline keyframes */}
            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 0.2; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </div>
    );
};
