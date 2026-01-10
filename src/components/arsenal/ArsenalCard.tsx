import { Check } from 'lucide-react';
import type { Equipment, CustomSettings } from '../../services/GymEquipmentService';
import { EQUIPMENT_CATEGORIES } from '../../services/GymEquipmentService';

export interface ArsenalCardProps {
    item: Equipment;
    muscleGroup?: string;
    isSelected?: boolean;
    userSettings: CustomSettings;
    onEdit?: (item: Equipment) => void;
    configOverride?: any;
}

export const ArsenalCard = ({ item, isSelected, userSettings, onEdit, configOverride }: ArsenalCardProps) => {
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
