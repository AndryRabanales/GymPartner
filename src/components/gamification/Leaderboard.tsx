import { mockUsers } from '../../data/mockUsers';
import { UserBadge } from './UserBadge';
import { Trophy } from 'lucide-react';

interface LeaderboardProps {
    entries: { userId: string; checkinsMismatch: number }[];
}

export const Leaderboard = ({ entries }: LeaderboardProps) => {
    // Enrich entries with user data and sort
    const sortedEntries = entries
        .map(entry => {
            const user = mockUsers.find(u => u.id === entry.userId);
            return { ...entry, user };
        })
        .filter(item => item.user !== undefined)
        .sort((a, b) => b.checkinsMismatch - a.checkinsMismatch);

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-neutral-900 to-neutral-800 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={20} />
                    <h3 className="font-bold text-white uppercase tracking-wider text-sm">Gym Rulers (Top Monthly)</h3>
                </div>
            </div>

            <div className="divide-y divide-neutral-800">
                {sortedEntries.length > 0 ? (
                    sortedEntries.map((entry, index) => (
                        <div key={entry.userId} className={`flex items-center p-3 hover:bg-neutral-800/50 transition-colors ${index === 0 ? 'bg-yellow-500/5' : ''}`}>
                            <div className={`w-8 font-bold text-center ${index === 0 ? 'text-yellow-500 text-xl' : index === 1 ? 'text-neutral-300' : index === 2 ? 'text-neutral-500' : 'text-neutral-600'}`}>
                                {index + 1}
                            </div>

                            <img
                                src={entry.user!.avatarUrl}
                                alt={entry.user!.username}
                                className={`w-10 h-10 rounded-full object-cover border-2 mr-3 ${index === 0 ? 'border-yellow-500' : 'border-neutral-700'}`}
                            />

                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{entry.user!.username}</span>
                                    <UserBadge rank={entry.user!.rank} size="sm" showLabel={false} />
                                </div>
                                <div className="text-xs text-neutral-500">{entry.user!.description}</div>
                            </div>

                            <div className="text-right">
                                <div className="font-bold text-white text-lg">{entry.checkinsMismatch}</div>
                                <div className="text-[10px] text-neutral-500 uppercase">Check-ins</div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-8 text-center text-neutral-500 italic">
                        No rulers yet. Be the first to conquer this gym!
                    </div>
                )}
            </div>

            <div className="p-3 bg-neutral-900 text-center border-t border-neutral-800">
                <button className="text-xs font-bold text-gym-primary hover:text-white transition-colors uppercase tracking-widest">
                    View Full Rankings
                </button>
            </div>
        </div>
    );
};
