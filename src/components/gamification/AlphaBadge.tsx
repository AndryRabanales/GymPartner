// src/components/gamification/AlphaBadge.tsx
import { useEffect, useState } from 'react';
import { Crown, Loader } from 'lucide-react';
import { alphaService } from '../../services/AlphaService';

interface AlphaBadgeProps {
    gymId: string;
    size?: 'sm' | 'md' | 'lg';
    showStats?: boolean;
}

interface AlphaData {
    user_id: string;
    username: string;
    avatar_url: string;
    rank: string;
    total_volume: number;
    total_workouts: number;
    consistency_score: number;
    achieved_at: string;
}

export const AlphaBadge = ({
    gymId,
    size = 'md',
    showStats = false
}: AlphaBadgeProps) => {
    const [alpha, setAlpha] = useState<AlphaData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAlpha();
    }, [gymId]);

    const loadAlpha = async () => {
        setLoading(true);
        const data = await alphaService.getCurrentAlpha(gymId);
        setAlpha(data);
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-neutral-500">
                <Loader size={16} className="animate-spin" />
                <span className="text-sm">Cargando Top...</span>
            </div>
        );
    }

    if (!alpha) {
        return (
            <div className="text-neutral-500 text-sm italic">
                No hay ranking esta semana
            </div>
        );
    }

    // Tamaños
    const sizeClasses = {
        sm: {
            container: 'text-xs px-2 py-1',
            crown: 12,
            text: 'text-xs'
        },
        md: {
            container: 'text-sm px-3 py-1.5',
            crown: 16,
            text: 'text-sm'
        },
        lg: {
            container: 'text-base px-4 py-2',
            crown: 20,
            text: 'text-base'
        }
    };

    const s = sizeClasses[size];

    // Colores basados en ranking (asumiendo que rank viene como 'Alpha', 'Beta', etc.)
    const isTop1 = alpha.rank === 'Alpha' || alpha.rank === 'Leyenda';
    const gradientClass = isTop1 ? 'from-yellow-500 to-yellow-600' : 'from-blue-500 to-blue-600';
    const textColor = isTop1 ? 'text-black' : 'text-white';
    const shadowClass = isTop1 ? 'shadow-yellow-500/50' : 'shadow-blue-500/50';

    if (showStats) {
        // Versión con stats completos (para gym profile)
        return (
            <div className={`bg-gradient-to-r ${isTop1 ? 'from-yellow-500/10 to-orange-500/10 border-yellow-500' : 'from-blue-500/10 to-blue-600/10 border-blue-500'} border-2 rounded-xl p-4`}>
                <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                        <Crown
                            size={32}
                            className={`${isTop1 ? 'text-yellow-500 fill-yellow-500 animate-pulse' : 'text-blue-500 fill-blue-500'}`}
                        />
                        {isTop1 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-ping" />}
                    </div>
                    <div>
                        <div className={`text-xs ${isTop1 ? 'text-yellow-500' : 'text-blue-400'} font-bold uppercase tracking-wider`}>
                            {isTop1 ? '👑 TOP #1' : '🏆 TOP Performer'}
                        </div>
                        <div className="text-white font-bold text-lg">
                            @{alpha.username}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-neutral-700">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">
                            {alpha.total_workouts}
                        </div>
                        <div className="text-xs text-neutral-400">Workouts</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">
                            {(alpha.total_volume / 1000).toFixed(1)}T
                        </div>
                        <div className="text-xs text-neutral-400">Volumen</div>
                    </div>
                    <div className="text-center">
                        <div className={`text-2xl font-bold ${isTop1 ? 'text-yellow-500' : 'text-blue-400'}`}>
                            {Math.round(alpha.consistency_score)}
                        </div>
                        <div className="text-xs text-neutral-400">Score</div>
                    </div>
                </div>

                <div className="mt-3 text-xs text-neutral-500 text-center">
                    Desde {new Date(alpha.achieved_at).toLocaleDateString()}
                </div>
            </div>
        );
    }

    // Versión compacta (badge inline)
    return (
        <div
            className={`
        inline-flex items-center gap-2
        bg-gradient-to-r ${gradientClass}
        ${textColor} font-bold rounded-full
        ${s.container}
        shadow-lg ${shadowClass}
        ${isTop1 ? 'animate-pulse' : ''}
        hover:scale-105 transition-transform
      `}
        >
            <Crown size={s.crown} className="fill-current" />
            <span className={s.text}>
                {isTop1 ? 'TOP #1' : 'TOP'}: {alpha.username}
            </span>
        </div>
    );
};
