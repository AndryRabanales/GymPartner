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
                <span className="text-sm">Cargando Alpha...</span>
            </div>
        );
    }

    if (!alpha) {
        return (
            <div className="text-neutral-500 text-sm italic">
                No hay Alpha esta semana
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

    if (showStats) {
        // Versión con stats completos (para gym profile)
        return (
            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                        <Crown
                            size={32}
                            className="text-yellow-500 fill-yellow-500 animate-pulse"
                        />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-ping" />
                    </div>
                    <div>
                        <div className="text-xs text-yellow-500 font-bold uppercase tracking-wider">
                            👑 Alpha Actual
                        </div>
                        <div className="text-white font-bold text-lg">
                            @{alpha.username}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-yellow-500/20">
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
                        <div className="text-2xl font-bold text-yellow-500">
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
        bg-gradient-to-r from-yellow-500 to-yellow-600 
        text-black font-bold rounded-full
        ${s.container}
        shadow-lg shadow-yellow-500/50
        animate-pulse
        hover:scale-105 transition-transform
      `}
        >
            <Crown size={s.crown} className="fill-current" />
            <span className={s.text}>
                ALPHA: {alpha.username}
            </span>
        </div>
    );
};
