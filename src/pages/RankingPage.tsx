// Add static import at top
import { useEffect, useState } from 'react';
// import { BotSeeder } from '../services/BotSeeder'; // UNUSED
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Trophy, Shield, MapPin, Swords } from 'lucide-react';
import { PublicTeaser } from '../components/common/PublicTeaser';
import { PlayerProfileModal } from '../components/profile/PlayerProfileModal';

interface RankedUser {
    id: string;
    username: string;
    avatar_url: string;
    xp: number;
    rank: number;
    gym_name?: string;
    is_current_user?: boolean;
    banner_url?: string;
    featured_routine_id?: string | null;
}

export const RankingPage = () => {
    const { user } = useAuth();
    const [leaderboard, setLeaderboard] = useState<RankedUser[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<RankedUser | null>(null);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!user) return;

            try {
                // Determine Gym ID (from user profile or primary gym)
                // For now, we assume user has a home_gym linked in profiles.
                // We first get the user's gym_id.
                const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('home_gym_id')
                    .eq('id', user.id)
                    .single();

                if (userError) console.warn("Error fetching user gym:", userError);

                const gymId = userData?.home_gym_id;
                // Gym name will be retrieved from the leaderboard data itself
                let gymName = 'Gym';

                if (!gymId) {
                    // Fallback if no gym: Show global or empty?
                    // User said "local by gym".
                    // We'll show a message or empty state if no gym.
                    // For now, let's try to fetch global if no gym, or just return empty.
                    console.log("User has no gym assigned for ranking.");
                    setLeaderboard([]);
                    return;
                }

                // Call RPC
                const { data: leaderboardData, error } = await supabase
                    .rpc('get_gym_followers_leaderboard', { gym_id_param: gymId });

                if (error) {
                    console.error('Error fetching gym leaderboard:', error);
                    // Fallback to empty or previous logic?
                    // Since the SQL might not be run yet, this will error.
                    // We should probably handle this gracefully or mock it client side for dev.
                    // MOCK FOR DEV if RPC Missing:
                    // fetch profiles with gym_id, then manually count followers? 
                    // Too expensive. We'll just show empty and console error.
                }

                if (leaderboardData) {
                    const mapped = leaderboardData.map((p: any, index: number) => ({
                        id: p.id,
                        username: p.username || 'Usuario',
                        avatar_url: p.avatar_url,
                        xp: p.followers_count, // Reusing XP field for Followers to minimize interface changes for now, or update interface?
                        // Let's update interface `xp` to be generic `score` or `followers`?
                        // I'll keep `xp` in interface but treat it as score.
                        rank: index + 1,
                        gym_name: p.gym_name || gymName,
                        is_current_user: p.id === user.id,
                        banner_url: p.banner_url || null, // Map from RPC
                        featured_routine_id: null
                    }));
                    setLeaderboard(mapped);
                }

            } catch (err) {
                console.error('Error in ranking fetch:', err);
            }
        };

        fetchLeaderboard();
    }, [user]);

    const getRankStyle = (rank: number) => {
        if (rank === 1) return 'bg-gradient-to-r from-yellow-600/20 to-yellow-400/10 border-yellow-500/50';
        if (rank === 2) return 'bg-gradient-to-r from-slate-400/20 to-slate-200/5 border-slate-400/50';
        if (rank === 3) return 'bg-gradient-to-r from-orange-700/20 to-orange-500/10 border-orange-600/50';
        return 'bg-neutral-900/50 border-neutral-800';
    };

    const getRankBadge = (rank: number) => {
        if (rank === 1) return <div className="w-8 h-8 flex items-center justify-center bg-yellow-500 text-black font-black rounded-lg shadow-[0_0_15px_rgba(234,179,8,0.5)] skew-x-[-10deg]">1</div>;
        if (rank === 2) return <div className="w-8 h-8 flex items-center justify-center bg-slate-300 text-black font-black rounded-lg shadow-sm skew-x-[-10deg]">2</div>;
        if (rank === 3) return <div className="w-8 h-8 flex items-center justify-center bg-orange-600 text-white font-black rounded-lg shadow-sm skew-x-[-10deg]">3</div>;
        return <div className="w-8 h-8 flex items-center justify-center text-neutral-500 font-bold">{rank}</div>;
    };

    const handlePlayerClick = (player: RankedUser) => {
        setSelectedPlayer(player);
    };

    if (!user) {
        return (
            <PublicTeaser
                icon={Trophy}
                title="Grados de Honor"
                description="Compite con tu comunidad local y global. Asciende en los rangos y reclama tu lugar como el Alpha de tu gimnasio."
                benefitTitle="Ascenso Social"
                benefitDescription="Gana XP por cada entrenamiento, conquista territorios y desbloquea insignias de prestigio."
                iconColor="text-yellow-500"
                bgAccent="bg-yellow-500/10"
            >
                <div className="bg-neutral-900 border border-white/5 rounded-2xl p-4 text-left space-y-3 opacity-80 pointer-events-none w-full">
                    <div className="flex items-center justify-between mb-2">
                        <div className="h-3 w-20 bg-neutral-800 rounded" />
                        <div className="h-4 w-12 bg-neutral-800 rounded-full" />
                    </div>

                    <div className="space-y-2">
                        {[1, 2, 3].map((rank) => (
                            <div key={rank} className="flex items-center gap-3 p-2 bg-neutral-800/40 rounded-xl border border-white/5">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs skew-x-[-10deg] ${rank === 1 ? 'bg-yellow-500 text-black' :
                                    rank === 2 ? 'bg-slate-300 text-black' :
                                        'bg-orange-600 text-white'
                                    }`}>
                                    {rank}
                                </div>
                                <div className="flex-1">
                                    <div className="h-2.5 w-24 bg-neutral-700 rounded mb-1" />
                                    <div className="h-1.5 w-16 bg-neutral-700/50 rounded" />
                                </div>
                                <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                                    <Trophy size={10} className="text-yellow-500" />
                                    <div className="h-2 w-8 bg-neutral-700 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </PublicTeaser>
        );
    }

    return (
        <div className="bg-neutral-950 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-neutral-950/95 backdrop-blur-xl border-b border-white/5 p-4 shadow-2xl shadow-black/50">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                        <Trophy className="text-yellow-500" />
                        Ranking {leaderboard.length > 0 ? leaderboard[0].gym_name : 'Local'}
                    </h1>
                    <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full">
                        <Shield size={14} className="text-blue-400" />
                        <span className="text-xs font-bold text-neutral-400">Season 1</span>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 space-y-2 mt-2">
                {leaderboard.map((player) => (
                    <button
                        key={player.rank}
                        onClick={() => handlePlayerClick(player)}
                        className={`w-full text-left relative flex items-center gap-4 p-3 rounded-xl border transition-all overflow-hidden hover:brightness-110 active:scale-[0.98] cursor-pointer ${getRankStyle(player.rank)} ${player.is_current_user ? 'ring-2 ring-gym-primary ring-offset-2 ring-offset-neutral-950 scale-[1.02] shadow-2xl z-10' : ''}`}
                        style={player.banner_url ? {
                            backgroundImage: `url(${player.banner_url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        } : {}}
                    >
                        {/* Banner Overlay */}
                        {player.banner_url && (
                            <div className="absolute inset-0 bg-black/60 z-0"></div>
                        )}

                        {/* Rank */}
                        <div className="shrink-0 w-10 flex justify-center relative z-10">
                            {getRankBadge(player.rank)}
                        </div>

                        {/* Trend (Fake) */}
                        <div className="hidden sm:block text-xs font-bold text-green-500 relative z-10">
                            ▲
                        </div>

                        {/* Avatar */}
                        <div className="relative shrink-0 z-10">
                            <div className="w-12 h-12 rounded-lg bg-neutral-800 border-2 border-neutral-700 overflow-hidden">
                                <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
                            </div>
                            {/* Clan/Gym Icon fake */}
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-neutral-900 rounded border border-neutral-600 flex items-center justify-center">
                                <Shield size={10} className="text-gym-primary" />
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 relative z-10">
                            <div className="flex items-center gap-2">
                                <h3 className={`font-black text-sm sm:text-base truncate ${player.is_current_user ? 'text-gym-primary' : 'text-white'}`}>
                                    {player.username}
                                </h3>
                                {/* Battle Deck Icon */}
                                {player.featured_routine_id && (
                                    <div className="bg-users-500/10 border border-yellow-500/30 rounded px-1.5 py-0.5 flex items-center gap-1" title="Rutina Destacada Activa">
                                        <Swords size={10} className="text-yellow-500" />
                                        <span className="text-[9px] font-bold text-yellow-500 tracking-wider hidden sm:block">RUTINA</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-neutral-400">
                                <MapPin size={10} />
                                <span className="truncate">{player.gym_name}</span>
                            </div>
                        </div>

                        {/* Followers Count */}
                        <div className="shrink-0 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 relative z-10 w-24 justify-end">
                            <span className="font-black text-white text-sm tabular-nums">{player.xp}</span>
                            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Seguidores</span>
                        </div>
                    </button>
                ))}
            </div>

            {/* User Floating Dock if not visible? (Optional, skipping for now) */}

            {/* PLAYER PROFILE INSPECTOR (Clash Royale Style) */}
            {selectedPlayer && (
                <PlayerProfileModal
                    player={selectedPlayer}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}
        </div>
    );
};
