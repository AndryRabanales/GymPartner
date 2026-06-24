import { Flame } from 'lucide-react';

interface StreakFlameProps {
    count: number;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export const StreakFlame = ({ count, showLabel = true, size = 'md' }: StreakFlameProps) => {
    if (count === 0) {
        return (
            <div className="flex items-center gap-1 opacity-50 grayscale" title="Sin entrenos">
                <Flame size={size === 'lg' ? 24 : size === 'md' ? 20 : 16} />
                {showLabel && <span className="font-bold text-neutral-500">0</span>}
            </div>
        );
    }

    return (
        <div className={`
            flex items-center rounded-full border backdrop-blur-md shadow-lg transition-all
            ${size === 'sm' ? 'gap-1 px-2 py-0.5' : 'gap-1.5 px-2.5 py-1'}
            bg-orange-500/10 border-orange-500/50 text-orange-500 hover:bg-orange-500/20
        `}
            title={`${count} día(s) entrenados`}
        >
            <Flame size={size === 'lg' ? 24 : size === 'md' ? 20 : 16} fill="currentColor" className="animate-[pulse_3s_ease-in-out_infinite]" />
            <span className={`font-black ${size === 'lg' ? 'text-xl' : size === 'md' ? 'text-sm' : 'text-xs'}`}>
                {count}
            </span>
        </div>
    );
};
