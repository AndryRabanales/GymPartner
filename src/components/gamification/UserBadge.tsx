import type { UserRank } from '../../types/user';
import { Crown, Medal, Dumbbell, Star, Shield } from 'lucide-react';

interface UserBadgeProps {
    rank: UserRank;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

export const UserBadge = ({ rank, size = 'md', showLabel = true }: UserBadgeProps) => {
    const getSize = () => {
        switch (size) {
            case 'sm': return 'w-4 h-4';
            case 'lg': return 'w-8 h-8';
            default: return 'w-6 h-6';
        }
    };

    const getRankConfig = () => {
        switch (rank) {
            case 'Gym God': return { icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/50' };
            case 'Legend': return { icon: Medal, color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/50' };
            case 'Elite': return { icon: Star, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/50' };
            case 'Gym Rat': return { icon: Dumbbell, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/50' };
            default: return { icon: Shield, color: 'text-neutral-400', bg: 'bg-neutral-800 border-neutral-700' };
        }
    };

    const config = getRankConfig();
    const Icon = config.icon;

    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${config.bg} ${showLabel ? '' : 'justify-center px-1'}`}>
            <Icon className={`${getSize()} ${config.color}`} fill="currentColor" fillOpacity={0.2} />
            {showLabel && (
                <span className={`font-bold uppercase tracking-wider ${config.color} text-[10px]`}>
                    {rank}
                </span>
            )}
        </div>
    );
};
