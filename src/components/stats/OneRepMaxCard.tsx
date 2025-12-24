
import { Trophy, TrendingUp } from 'lucide-react';

interface OneRepMaxCardProps {
    exerciseName: string;
    estimatedMax: number;
    bestLift: { weight: number; reps: number; date: string };
}

export const OneRepMaxCard = ({ exerciseName, estimatedMax, bestLift }: OneRepMaxCardProps) => {
    if (estimatedMax === 0) return null;

    return (
        <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-2xl flex flex-col justify-between min-w-[160px] snap-center">
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider truncate w-full pr-2">
                    {exerciseName}
                </span>
                <Trophy size={14} className="text-yellow-500 shrink-0" />
            </div>

            <div className="my-1">
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white tracking-tighter italic">
                        {estimatedMax}
                    </span>
                    <span className="text-xs font-bold text-neutral-500">KG (1RM)</span>
                </div>
            </div>

            <div className="mt-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                    <TrendingUp size={10} className="text-green-500" />
                    <span className="font-bold text-white">PR:</span>
                    <span>{bestLift.weight}kg x {bestLift.reps}</span>
                </div>
                <div className="text-[9px] text-neutral-600 mt-0.5">
                    {new Date(bestLift.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
            </div>
        </div>
    );
};
