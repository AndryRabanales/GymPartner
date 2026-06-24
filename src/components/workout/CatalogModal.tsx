/**
 * CatalogModal — shared exercise selector for RoutineBuilder AND WorkoutSession.
 *
 * UX:
 *  - Muscle tabs across the top
 *  - One ArsenalCard per base exercise (collapsed view)
 *  - Left/right arrows cycle through variants without leaving the grid
 *  - Tapping a card toggles that specific variant (virtual-${seedName} ID)
 *  - "Confirmar" button at the bottom confirms the selection
 *
 * IDs: `virtual-${variant.seedName}` — identical in RoutineBuilder and WorkoutSession.
 */

import { useState, useMemo } from 'react';
import { X, Check } from 'lucide-react';
import { CURATED_EXERCISES, CATALOG_MUSCLES, type BaseExercise } from '../../data/exerciseCatalog';
import { COMMON_EQUIPMENT_SEEDS } from '../../services/GymEquipmentService';
import { ArsenalCard } from '../arsenal/ArsenalCard';

interface Props {
    /** IDs already selected: `virtual-${seedName}` */
    selected: Set<string>;
    onToggle: (virtualId: string) => void;
    /** Atomic swap: removes oldId and adds newId in one state update (avoids React batching bug). */
    onSwapVariant: (oldId: string, newId: string) => void;
    onClose: () => void;
    onConfirm: () => void;
}

const EMPTY_SETTINGS = { categories: [], metrics: [] };
const vid = (seedName: string) => `virtual-${seedName}`;

export const CatalogModal = ({ selected, onToggle, onSwapVariant, onClose, onConfirm }: Props) => {
    const [activeMuscle, setActiveMuscle] = useState<string>('PECHO');
    const [searchTerm, setSearchTerm] = useState('');
    // variantIdx: baseId → index of currently displayed variant
    const [variantIdx, setVariantIdx] = useState<Record<string, number>>({});

    const exercisesForMuscle = useMemo(
        () => CURATED_EXERCISES.filter(b =>
            b.muscle === activeMuscle &&
            (searchTerm === '' || b.name.toLowerCase().includes(searchTerm.toLowerCase()))
        ),
        [activeMuscle, searchTerm]
    );

    const seedLookup = useMemo(() => {
        const m = new Map<string, any>();
        (COMMON_EQUIPMENT_SEEDS as any[]).forEach(s => m.set(s.name, s));
        return m;
    }, []);

    // Return the Equipment-like object for the currently displayed variant of a base exercise
    const itemForBase = (base: BaseExercise) => {
        const idx = variantIdx[base.id] ?? 0;
        const variant = base.variants[idx] ?? base.variants[0];
        const seed = seedLookup.get(variant.seedName);
        return {
            id: vid(variant.seedName),
            name: variant.seedName,
            category: base.muscle,
            target_muscle_group: base.muscle,
            metrics: base.metrics,
            image_url: seed?.image_url ?? null,
            icon: variant.icon,
            quantity: 1,
            status: 'ACTIVE' as const,
        };
    };

    const cycleVariant = (base: BaseExercise, dir: 'next' | 'prev') => {
        const currentIdx = variantIdx[base.id] ?? 0;
        const nextIdx = dir === 'next'
            ? (currentIdx + 1) % base.variants.length
            : (currentIdx - 1 + base.variants.length) % base.variants.length;

        const oldVariant = base.variants[currentIdx];
        const newVariant = base.variants[nextIdx];

        // Atomic swap: one state update so React batching doesn't leave old selected.
        if (selected.has(vid(oldVariant.seedName))) {
            onSwapVariant(vid(oldVariant.seedName), vid(newVariant.seedName));
        }

        setVariantIdx(prev => ({ ...prev, [base.id]: nextIdx }));
    };

    const selectedCount = selected.size;

    return (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-white/5 shrink-0">
                <h2 className="text-lg font-black italic uppercase tracking-tight text-white">Catálogo de Ejercicios</h2>
                <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors p-1">
                    <X size={22} />
                </button>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 shrink-0">
                <input
                    type="text"
                    placeholder="Buscar ejercicio..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-gym-primary text-sm font-bold"
                />
            </div>

            {/* Muscle tabs */}
            <div className="flex gap-2 px-4 py-3 overflow-x-auto shrink-0 no-scrollbar">
                {CATALOG_MUSCLES.map(m => (
                    <button
                        key={m}
                        onClick={() => { setActiveMuscle(m); setSearchTerm(''); }}
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

            {/* Grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {exercisesForMuscle.length === 0 ? (
                    <div className="text-center text-neutral-600 font-bold py-12">Sin resultados</div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {exercisesForMuscle.map(base => {
                            const currentIdx = variantIdx[base.id] ?? 0;
                            const currentVariant = base.variants[currentIdx] ?? base.variants[0];
                            const item = itemForBase(base);
                            const isSel = selected.has(vid(currentVariant.seedName));
                            // Also check if ANY variant of this base is selected
                            const anySelected = base.variants.some(v => selected.has(vid(v.seedName)));

                            return (
                                <div
                                    key={base.id}
                                    className={`cursor-pointer rounded-lg transition-all ${anySelected ? 'ring-2 ring-gym-primary ring-offset-1 ring-offset-black' : ''}`}
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).closest('[data-variant-btn="true"]')) return;
                                        onToggle(vid(currentVariant.seedName));
                                    }}
                                >
                                    <ArsenalCard
                                        item={item as any}
                                        isSelected={isSel}
                                        userSettings={EMPTY_SETTINGS}
                                        onEdit={() => {}}
                                        variantLabel={base.variants.length > 1 ? currentVariant.label : undefined}
                                        variantTotal={base.variants.length > 1 ? base.variants.length : undefined}
                                        onVariantCycle={base.variants.length > 1 ? (dir) => cycleVariant(base, dir) : undefined}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            {selectedCount > 0 && (
                <div className="px-4 pb-6 pt-2 shrink-0 border-t border-white/5 bg-neutral-950">
                    <div className="text-center text-xs text-neutral-500 font-bold uppercase tracking-wider mb-2">
                        {selectedCount} ejercicio{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}
                    </div>
                    <button
                        onClick={onConfirm}
                        className="w-full bg-gym-primary text-black font-black uppercase py-4 rounded-2xl shadow-[0_10px_40px_rgba(250,204,21,0.4)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg"
                    >
                        <Check size={22} strokeWidth={3} />
                        CONFIRMAR ({selectedCount})
                    </button>
                </div>
            )}
        </div>
    );
};
