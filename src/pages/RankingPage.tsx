import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Trophy, Shield, MapPin } from 'lucide-react';
import { PublicTeaser } from '../components/common/PublicTeaser';

interface RankedUser {
    // id: string; // Removed for privacy
    username: string;
    avatar_url: string;
    xp: number;
    rank: number;
    gym_name?: string;
    is_current_user?: boolean;
    banner_url?: string;
}

export const RankingPage = () => {
    const { user } = useAuth();
    const [leaderboard, setLeaderboard] = useState<RankedUser[]>([]);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!user) return;

            try {
                // 1. Fetch ALL profiles sorted by XP
                const { data: profiles, error } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url, xp, custom_settings, home_gym:gyms(name)')
                    .order('xp', { ascending: false })
                    .limit(50);

                if (error) throw error;

                // 2. Map Update to State (Obfuscating IDs)
                const rankedPlayers: RankedUser[] = (profiles || []).map((p: any, index: number) => ({
                    // id: p.id, // HIDDEN: We don't store the raw UUID to prevent scraping
                    username: p.username || 'Usuario GymPartner',
                    avatar_url: p.avatar_url || `https://ui-avatars.com/api/?name=${p.username || 'User'}&background=random`,
                    xp: p.xp || 0,
                    rank: index + 1,
                    gym_name: p.home_gym?.name || 'Nómada',
                    is_current_user: p.id === user.id, // Checked here, but ID not saved
                    banner_url: p.custom_settings?.banner_url
                }));

                setLeaderboard(rankedPlayers);
            } catch (err) {
                console.error('Error fetching leaderboard:', err);
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
        <div className="min-h-screen bg-neutral-950 pb-20">
            {/* Header */}
            <div className="sticky top-16 z-30 bg-neutral-950/80 backdrop-blur-md border-b border-white/5 p-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                        <Trophy className="text-yellow-500" />
                        Global Ranking
                    </h1>
                    <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full">
                        <Shield size={14} className="text-blue-400" />
                        <span className="text-xs font-bold text-neutral-400">Season 1</span>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 space-y-2 mt-2">
                {leaderboard.map((player) => (
                    <div
                        key={player.rank}
                        className={`relative flex items-center gap-4 p-3 rounded-xl border transition-all overflow-hidden ${getRankStyle(player.rank)} ${player.is_current_user ? 'ring-2 ring-gym-primary ring-offset-2 ring-offset-neutral-950 scale-[1.02] shadow-2xl z-10' : ''}`}
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
                            <h3 className={`font-black text-sm sm:text-base truncate ${player.is_current_user ? 'text-gym-primary' : 'text-white'}`}>
                                {player.username}
                            </h3>
                            <div className="flex items-center gap-1 text-xs text-neutral-400">
                                <MapPin size={10} />
                                <span className="truncate">{player.gym_name}</span>
                            </div>
                        </div>

                        {/* Trophies/XP */}
                        <div className="shrink-0 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 relative z-10">
                            <Trophy size={14} className="text-yellow-500" />
                            <span className="font-black text-white text-sm tabular-nums">{player.xp}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* User Floating Dock if not visible? (Optional, skipping for now) */}
        </div>
    );
};
