import { useState, useMemo } from 'react';
import { X, Plus, ChevronDown, Check, ChevronLeft } from 'lucide-react';
import {
    CURATED_EXERCISES, CATALOG_MUSCLES, type BaseExercise, type ExerciseVariant,
    getVariantPrefs, saveVariantPref, getPreferredSeedName,
    addUserExtra, getUserExtras, getExtrasForMuscle,
} from '../../data/exerciseCatalog';
import { COMMON_EQUIPMENT_SEEDS } from '../../services/GymEquipmentService';

interface Props {
    /** Items already selected — Set of "virtual-${seedName}" IDs (matching handleBatchAdd format) */
    selected: Set<string>;
    /** Called with "virtual-${seedName}" — compatible with handleCatalogToggle */
    onToggle: (virtualId: string) => void;
    onClose: () => void;
}

type View = 'catalog' | 'extras';

export const WorkoutCatalog = ({ selected, onToggle, onClose }: Props) => {
    const [activeMuscle, setActiveMuscle] = useState<string>('PECHO');
    const [view, setView] = useState<View>('catalog');
    /** Base exercise currently showing variant picker */
    const [pickingVariantFor, setPickingVariantFor] = useState<BaseExercise | null>(null);
    const [variantPrefs, setVariantPrefs] = useState<Record<string, string>>(getVariantPrefs);
    const [userExtras, setUserExtras] = useState<string[]>(getUserExtras);

    // ── Curated exercises for active muscle ──────────────────────────────────
    const curatedForMuscle = useMemo(
        () => CURATED_EXERCISES.filter(b => b.muscle === activeMuscle),
        [activeMuscle]
    );

    // ── Extra (non-curated) seeds for active muscle ──────────────────────────
    const extrasForMuscle = useMemo(
        () => getExtrasForMuscle(activeMuscle, COMMON_EQUIPMENT_SEEDS as any),
        [activeMuscle]
    );
    const userExtrasForMuscle = useMemo(
        () => extrasForMuscle.filter(name => userExtras.includes(name)),
        [extrasForMuscle, userExtras]
    );
    const remainingExtras = useMemo(
        () => extrasForMuscle.filter(name => !userExtras.includes(name)),
        [extrasForMuscle, userExtras]
    );

    // ── Helpers ──────────────────────────────────────────────────────────────
    const vid = (seedName: string) => `virtual-${seedName}`;

    // Source of truth: which variant of this base exercise is currently in the selection set.
    // Falls back to saved preference, then to the first variant.
    const getActiveVariant = (base: BaseExercise): ExerciseVariant => {
        for (const variant of base.variants) {
            if (selected.has(vid(variant.seedName))) return variant;
        }
        const prefId = variantPrefs[base.id];
        if (prefId) {
            const pref = base.variants.find(v => v.id === prefId);
            if (pref) return pref;
        }
        return base.variants[0];
    };

    const isVariantSelected = (variant: ExerciseVariant): boolean =>
        selected.has(vid(variant.seedName));

    const isBaseSelected = (base: BaseExercise): boolean =>
        base.variants.some(v => selected.has(vid(v.seedName)));

    const handleBaseClick = (base: BaseExercise) => {
        if (base.variants.length === 1) {
            onToggle(vid(base.variants[0].seedName));
            return;
        }
        // Multi-variant: show picker
        setPickingVariantFor(base);
    };

    const handleVariantPick = (base: BaseExercise, variant: ExerciseVariant) => {
        // Deselect ALL other variants of this base exercise that are currently selected
        base.variants.forEach(v => {
            if (v.id !== variant.id && selected.has(vid(v.seedName))) {
                onToggle(vid(v.seedName));
            }
        });

        // Save preference
        saveVariantPref(base.id, variant.id);
        setVariantPrefs(prev => ({ ...prev, [base.id]: variant.id }));

        // Toggle the chosen variant (select if not selected, deselect if already selected)
        onToggle(vid(variant.seedName));

        setPickingVariantFor(null);
    };

    const handleAddExtra = (seedName: string) => {
        addUserExtra(seedName);
        setUserExtras(getUserExtras());
        onToggle(vid(seedName));
        setView('catalog');
    };

    const selectedCount = selected.size;

    // ────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full">

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-white/5 shrink-0">
                {view === 'extras' ? (
                    <button onClick={() => setView('catalog')} className="flex items-center gap-1 text-gym-primary font-bold text-sm">
                        <ChevronLeft size={18} /> Volver
                    </button>
                ) : (
                    <h2 className="text-lg font-black italic uppercase tracking-tight text-white">Catálogo</h2>
                )}
                <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors p-1">
                    <X size={22} />
                </button>
            </div>

            {/* ── Muscle tabs ── */}
            <div className="flex gap-2 px-4 py-3 overflow-x-auto shrink-0 no-scrollbar">
                {CATALOG_MUSCLES.map(m => (
                    <button
                        key={m}
                        onClick={() => { setActiveMuscle(m); setView('catalog'); }}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border transition-all
                            ${activeMuscle === m
                                ? 'bg-gym-primary text-black border-gym-primary'
                                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-gym-primary/40'
                            }`}
                    >
                        {m}
                    </button>
                ))}
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">

                {view === 'catalog' && (
                    <>
                        {/* Curated base exercises */}
                        <div className="space-y-2 mb-4">
                            {curatedForMuscle.map(base => {
                                const isSel = isBaseSelected(base);
                                const selectedVariants = base.variants.filter(v => isVariantSelected(v));
                                const activeVariant = getActiveVariant(base);
                                const subtitleLabel = selectedVariants.length > 1
                                    ? `${selectedVariants.length} variantes`
                                    : activeVariant.label;
                                return (
                                    <button
                                        key={base.id}
                                        onClick={() => handleBaseClick(base)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
                                            ${isSel
                                                ? 'bg-gym-primary/10 border-gym-primary/60'
                                                : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
                                            }`}
                                    >
                                        <span className="text-xl shrink-0">{base.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-bold text-sm truncate ${isSel ? 'text-gym-primary' : 'text-white'}`}>
                                                {base.name}
                                            </div>
                                            {base.variants.length > 1 && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="text-neutral-500 text-[10px] font-bold uppercase">
                                                        {subtitleLabel}
                                                    </span>
                                                    <ChevronDown size={10} className="text-neutral-600" />
                                                </div>
                                            )}
                                        </div>
                                        {isSel && (
                                            <div className="shrink-0 w-5 h-5 rounded-full bg-gym-primary flex items-center justify-center">
                                                <Check size={12} className="text-black" strokeWidth={3} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* User-added extras for this muscle */}
                        {userExtrasForMuscle.length > 0 && (
                            <div className="space-y-2 mb-4">
                                <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest px-1">Tus añadidos</p>
                                {userExtrasForMuscle.map(seedName => {
                                    const isSel = selected.has(vid(seedName));
                                    const seed = (COMMON_EQUIPMENT_SEEDS as any[]).find(s => s.name === seedName);
                                    return (
                                        <button
                                            key={seedName}
                                            onClick={() => onToggle(vid(seedName))}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
                                                ${isSel
                                                    ? 'bg-gym-primary/10 border-gym-primary/60'
                                                    : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
                                                }`}
                                        >
                                            <span className="text-xl shrink-0">{seed?.icon ?? '💪'}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-bold text-sm truncate ${isSel ? 'text-gym-primary' : 'text-white'}`}>
                                                    {seedName}
                                                </div>
                                            </div>
                                            {isSel && (
                                                <div className="shrink-0 w-5 h-5 rounded-full bg-gym-primary flex items-center justify-center">
                                                    <Check size={12} className="text-black" strokeWidth={3} />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* + Ver más button */}
                        {remainingExtras.length > 0 && (
                            <button
                                onClick={() => setView('extras')}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-all text-sm font-bold"
                            >
                                <Plus size={16} />
                                Ver más {activeMuscle} ({remainingExtras.length})
                            </button>
                        )}
                    </>
                )}

                {view === 'extras' && (
                    <div className="space-y-2 pt-2">
                        <p className="text-xs text-neutral-500 px-1 pb-2">
                            Añade ejercicios a tu lista principal de {activeMuscle.toLowerCase()}.
                        </p>
                        {remainingExtras.map(seedName => {
                            const seed = (COMMON_EQUIPMENT_SEEDS as any[]).find(s => s.name === seedName);
                            return (
                                <button
                                    key={seedName}
                                    onClick={() => handleAddExtra(seedName)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-neutral-800 bg-neutral-900 hover:border-gym-primary/50 hover:bg-gym-primary/5 transition-all text-left"
                                >
                                    <span className="text-xl shrink-0">{seed?.icon ?? '💪'}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm text-white truncate">{seedName}</div>
                                    </div>
                                    <Plus size={16} className="text-gym-primary shrink-0" />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Variant Picker overlay ── */}
            {pickingVariantFor && (
                <div
                    className="absolute inset-0 z-10 bg-black/80 backdrop-blur-sm flex items-end"
                    onClick={() => setPickingVariantFor(null)}
                >
                    <div
                        className="w-full bg-neutral-900 border-t border-white/10 rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom-4 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-white font-black text-base">{pickingVariantFor.name}</p>
                                <p className="text-neutral-500 text-xs font-bold">Selecciona una variante</p>
                            </div>
                            <button onClick={() => setPickingVariantFor(null)}>
                                <X size={20} className="text-neutral-400" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {pickingVariantFor.variants.map(variant => {
                                const isSel = isVariantSelected(variant);
                                const isDefault = !isBaseSelected(pickingVariantFor) && (variantPrefs[pickingVariantFor.id] ?? pickingVariantFor.variants[0].id) === variant.id;
                                return (
                                    <button
                                        key={variant.id}
                                        onClick={() => handleVariantPick(pickingVariantFor, variant)}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all
                                            ${isSel
                                                ? 'bg-gym-primary/15 border-gym-primary text-gym-primary'
                                                : isDefault
                                                    ? 'bg-neutral-800/80 border-neutral-600 text-neutral-300'
                                                    : 'bg-neutral-800 border-neutral-700 text-white hover:border-neutral-500'
                                            }`}
                                    >
                                        <span className="text-2xl">{variant.icon}</span>
                                        <span className="text-xs font-bold">{variant.label}</span>
                                        {isSel && (
                                            <Check size={12} className="text-gym-primary" strokeWidth={3} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Footer: Agregar button ── */}
            {selectedCount > 0 && (
                <div className="px-4 pb-4 pt-2 shrink-0 border-t border-white/5">
                    <div className="text-center text-xs text-neutral-500 font-bold uppercase tracking-wider mb-2">
                        {selectedCount} ejercicio{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}
                    </div>
                </div>
            )}
        </div>
    );
};
