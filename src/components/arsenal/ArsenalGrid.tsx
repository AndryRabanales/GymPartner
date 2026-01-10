import { Plus } from 'lucide-react';
import type { Equipment, CustomSettings } from '../../services/GymEquipmentService';
import { getMuscleGroup, normalizeText } from '../../utils/inventoryUtils';
import { ArsenalCard } from './ArsenalCard';

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
    gridClassName = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2"
}: ArsenalGridProps) => {

    const SECTION_ORDER = [
        'Pecho', 'Espalda', 'Pierna', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazo',
        'Cardio', 'Poleas / Varios', 'Peso Libre (General)', 'Otros',
        ...userSettings.categories.map(c => c.label)
    ];

    const filteredInventory = inventory.filter(item =>
        normalizeText(item.name).includes(normalizeText(searchTerm))
    );

    const groupedInventory: Record<string, Equipment[]> = {};
    filteredInventory.forEach(item => {
        const group = getMuscleGroup(item, userSettings);
        if (!groupedInventory[group]) groupedInventory[group] = [];
        groupedInventory[group].push(item);
    });

    return (
        <div className="space-y-6" id="tut-arsenal-grid">
            {/* Visual Stats Bar */}
            <div className="flex items-center gap-2 mb-4 px-1">
                <div className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-bold text-neutral-400 whitespace-nowrap">
                    {inventory.length} Total
                </div>
                <div className="px-3 py-1 rounded-full bg-gym-primary/10 border border-gym-primary/20 text-[10px] font-bold text-gym-primary whitespace-nowrap">
                    {selectedItems.size} Selected
                </div>
            </div>

            {/* Render Groups */}
            {SECTION_ORDER.map(section => {
                const items = groupedInventory[section] || [];
                const isCore = ['Pecho', 'Espalda', 'Pierna', 'Bíceps', 'Tríceps', 'Hombros'].includes(section);

                // Pass empty sections only if no search is active (so they can add), but if searching, hide empty.
                if (items.length === 0 && !isCore && searchTerm) return null;

                return (
                    <div key={section} className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
                        <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-2 pl-1 sticky top-36 z-30 bg-black/80 backdrop-blur w-fit px-2 rounded-r-full">{section}</h3>

                        <div className={gridClassName}>
                            {items.map(item => {
                                const isSelected = selectedItems.has(item.id);
                                return (
                                    <div key={item.id} className="cursor-pointer" onClick={() => onToggleSelection(item.id)}>
                                        <ArsenalCard
                                            item={item}
                                            muscleGroup={section}
                                            isSelected={isSelected}
                                            userSettings={userSettings}
                                            onEdit={onEditItem}
                                            configOverride={routineConfigs.get(item.id)}
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
        </div>
    );
};
