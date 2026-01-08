// Add static import at top
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Trophy, Shield, MapPin, Swords, ChevronLeft, ChevronRight } from 'lucide-react';
import { PublicTeaser } from '../components/common/PublicTeaser';
import { PlayerProfileModal } from '../components/profile/PlayerProfileModal';
import { userService } from '../services/UserService';
import type { UserPrimaryGym } from '../services/UserService';

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

    // Gym Switcher State
    const [userGyms, setUserGyms] = useState<UserPrimaryGym[]>([]);
    const [currentGymIndex, setCurrentGymIndex] = useState(0);
    const [loadingGyms, setLoadingGyms] = useState(true);

    // 1. Fetch User Gyms
    useEffect(() => {
        const fetchGyms = async () => {
            if (!user) return;
            try {
                const gyms = await userService.getUserGyms(user.id);
                // Sort: Home Base First
                const sortedGyms = gyms.sort((a, b) => {
                    if (a.is_home_base === b.is_home_base) return 0;
                    return a.is_home_base ? -1 : 1;
                });
                setUserGyms(sortedGyms);
            } catch (err) {
                console.error("Error fetching user gyms:", err);
            } finally {
                setLoadingGyms(false);
            }
        };
        fetchGyms();
    }, [user]);

    // 2. Fetch Leaderboard when Current Gym Changes
    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!user || userGyms.length === 0) return;

            const targetGym = userGyms[currentGymIndex];
            if (!targetGym) return;

            try {
                // Call RPC
                const { data: leaderboardData, error } = await supabase
                    .rpc('get_gym_followers_leaderboard', { gym_id_param: targetGym.gym_id });

                if (error) {
                    console.error('Error fetching gym leaderboard:', error);
                }

                if (leaderboardData) {
                    const mapped = leaderboardData.map((p: any, index: number) => ({
                        id: p.id,
                        username: p.username || 'Usuario',
                        avatar_url: p.avatar_url,
                        xp: p.followers_count, // Displaying Followers
                        rank: index + 1,
                        gym_name: p.gym_name || targetGym.gym_name,
                        is_current_user: p.id === user.id,
                        banner_url: p.banner_url || null,
                        featured_routine_id: null
                    }));
                    setLeaderboard(mapped);
                } else {
                    setLeaderboard([]);
                }

            } catch (err) {
                console.error('Error in ranking fetch:', err);
            }
        };

        if (!loadingGyms) {
            fetchLeaderboard();
        }
    }, [user, userGyms, currentGymIndex, loadingGyms]);

    const handleNextGym = () => {
        if (userGyms.length <= 1) return;
        setCurrentGymIndex((prev) => (prev + 1) % userGyms.length);
    };

    const handlePrevGym = () => {
        if (userGyms.length <= 1) return;
        setCurrentGymIndex((prev) => (prev - 1 + userGyms.length) % userGyms.length);
    };

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
                {/* ... existing teaser content ... */}
            </PublicTeaser>
        );
    }

    const currentGym = userGyms[currentGymIndex];

    return (
        <div className="bg-neutral-950 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-neutral-950/95 backdrop-blur-xl border-b border-white/5 p-4 shadow-2xl shadow-black/50">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                        <Trophy className="text-yellow-500" />
                        Ranking
                    </h1>

                    {/* GYM SWITCHER */}
                    {userGyms.length > 0 ? (
                        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-full p-1 pl-3 pr-1 shadow-inner">
                            <div className="flex flex-col items-end mr-1">
                                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest leading-none">Territorio</span>
                                <span className="text-xs font-bold text-white truncate max-w-[100px] sm:max-w-[150px] leading-tight">
                                    {currentGym?.gym_name || 'Cargando...'}
                                </span>
                            </div>

                            {userGyms.length > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handlePrevGym}
                                        className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 active:scale-95 transition-all"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <button
                                        onClick={handleNextGym}
                                        className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 active:scale-95 transition-all"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full">
                            <Shield size={14} className="text-neutral-500" />
                            <span className="text-xs font-bold text-neutral-500">Sin Gimnasio</span>
                        </div>
                    )}
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
