import { useEffect, useState } from 'react';
import { Flame, Snowflake, Skull, Info } from 'lucide-react';
import { streakService, UserStreak } from '../../services/StreakService';

interface StreakFlameProps {
    userId: string;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export const StreakFlame = ({ userId, showLabel = true, size = 'md' }: StreakFlameProps) => {
    const [streak, setStreak] = useState<UserStreak | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStreak();
    }, [userId]);

    const loadStreak = async () => {
        const data = await streakService.getUserStreak(userId);
        setStreak(data);
        setLoading(false);
    };

    if (loading) return <div className="animate-pulse bg-neutral-800 rounded-full w-12 h-6" />;

    // Default zero state
    if (!streak || streak.current_streak === 0) {
        return (
            <div className="flex items-center gap-1 opacity-50 grayscale" title="Sin Racha Activa">
                <Flame size={size === 'lg' ? 24 : size === 'md' ? 20 : 16} />
                {showLabel && <span className="font-bold text-neutral-500">0</span>}
            </div>
        );
    }

    const isAtRisk = streak.status === 'at_risk';
    const isFrozen = streak.status === 'frozen';

    return (
        <div className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-md shadow-lg transition-all
            ${isAtRisk
                ? 'bg-red-500/10 border-red-500/50 text-red-500 animate-pulse'
                : isFrozen
                    ? 'bg-blue-400/10 border-blue-400/50 text-blue-400'
                    : 'bg-orange-500/10 border-orange-500/50 text-orange-500 hover:bg-orange-500/20'
            }
        `}
            title={isAtRisk ? '¡RACHA EN RIESGO! Entrena YA.' : isFrozen ? 'Racha Congelada' : 'Racha Activa'}
        >
            {isAtRisk ? (
                <Flame size={size === 'lg' ? 24 : size === 'md' ? 20 : 16} className="animate-bounce" />
            ) : isFrozen ? (
                <Snowflake size={size === 'lg' ? 24 : size === 'md' ? 20 : 16} />
            ) : (
                <Flame size={size === 'lg' ? 24 : size === 'md' ? 20 : 16} fill="currentColor" className="animate-[pulse_3s_ease-in-out_infinite]" />
            )}

            <span className={`font-black ${size === 'lg' ? 'text-xl' : size === 'md' ? 'text-sm' : 'text-xs'}`}>
                {streak.current_streak}
            </span>

            {isAtRisk && (
                <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wide">
                    SALVAR
                </span>
            )}
        </div>
    );
};
