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
    const topThree = leaderboard.slice(0, 3);
    const restOfUsers = leaderboard.slice(3);
    const currentUserRank = leaderboard.find(p => p.is_current_user);

    return (
        <div className="min-h-screen bg-neutral-950 text-white pb-32 relative overflow-hidden">
            {/* Background Ambient Glows */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gym-primary/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Header / Arena Selector */}
            <div className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-2xl border-b border-white/5 px-4 py-6">
                <div className="max-w-xl mx-auto flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-gym-primary/20 p-2 rounded-xl border border-gym-primary/30">
                                <Trophy className="text-gym-primary" size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">Ranking</h1>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-1">Hall of Fame</p>
                            </div>
                        </div>

                        {/* GYM SWITCHER - STAGE STYLE */}
                        {userGyms.length > 0 && (
                            <div className="flex items-center gap-3 bg-neutral-900/50 border border-white/5 rounded-2xl p-1.5 pl-4 shadow-2xl">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-neutral-500 font-black uppercase tracking-tighter leading-none">Territorio</span>
                                    <span className="text-xs font-black text-gym-primary truncate max-w-[100px] uppercase italic">
                                        {currentGym?.gym_name || 'Cargando...'}
                                    </span>
                                </div>
                                {userGyms.length > 1 && (
                                    <div className="flex gap-1">
                                        <button onClick={handlePrevGym} className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition-colors">
                                            <ChevronLeft size={16} />
                                        </button>
                                        <button onClick={handleNextGym} className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition-colors">
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-xl mx-auto px-4 pt-8">
                {/* 🏆 PODIUM SECTION (Top 3) */}
                {topThree.length > 0 && (
                    <div className="flex items-end justify-center gap-2 mb-12 h-64 relative">
                        {/* Rank 2 (Left) */}
                        {topThree[1] && (
                            <div className="flex-1 flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 delay-100">
                                <div 
                                    onClick={() => handlePlayerClick(topThree[1])}
                                    className="relative group cursor-pointer"
                                >
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-400/50 shadow-[0_0_20px_rgba(148,163,184,0.2)] bg-neutral-900">
                                        <img src={topThree[1].avatar_url} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-slate-400 text-black font-black flex items-center justify-center rounded-lg text-xs skew-x-[-10deg]">2</div>
                                </div>
                                <span className="mt-4 font-black text-[10px] uppercase text-slate-400 truncate w-20 text-center">{topThree[1].username}</span>
                                <div className="mt-1 flex flex-col items-center">
                                    <span className="text-[10px] font-black text-white">{topThree[1].xp}</span>
                                    <span className="text-[7px] font-bold text-neutral-500 uppercase tracking-tighter">Poder</span>
                                </div>
                                <div className="h-20 w-full max-w-[80px] mt-2 bg-gradient-to-t from-slate-400/20 to-transparent rounded-t-xl border-x border-t border-slate-400/10"></div>
                            </div>
                        )}

                        {/* Rank 1 (Center) */}
                        {topThree[0] && (
                            <div className="flex-1 flex flex-col items-center z-10 animate-in zoom-in duration-500">
                                <div className="absolute -top-10 animate-bounce">
                                    <div className="bg-gym-primary p-2 rounded-xl shadow-[0_0_40px_rgba(250,204,21,0.6)] border border-white/20">
                                        <Trophy size={20} className="text-black" />
                                    </div>
                                </div>
                                <div 
                                    onClick={() => handlePlayerClick(topThree[0])}
                                    className="relative group cursor-pointer"
                                >
                                    <div className="w-28 h-28 rounded-3xl overflow-hidden border-4 border-gym-primary shadow-[0_0_60px_rgba(250,204,21,0.4)] ring-8 ring-gym-primary/10 bg-neutral-900">
                                        <img src={topThree[0].avatar_url} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-gym-primary text-black font-black flex items-center justify-center rounded-xl text-xl skew-x-[-10deg] shadow-2xl border-2 border-black/20">1</div>
                                </div>
                                <span className="mt-6 font-black text-base uppercase text-gym-primary italic tracking-tight truncate w-24 text-center leading-none">{topThree[0].username}</span>
                                <div className="mt-1 flex flex-col items-center">
                                    <span className="text-sm font-black text-white">{topThree[0].xp}</span>
                                    <span className="text-[8px] font-bold text-gym-primary/60 uppercase tracking-widest">Poder Social</span>
                                </div>
                                <div className="h-28 w-full max-w-[110px] mt-2 bg-gradient-to-t from-gym-primary/30 to-transparent rounded-t-2xl border-x border-t border-gym-primary/20 relative">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gym-primary/50 blur-sm"></div>
                                </div>
                            </div>
                        )}

                        {/* Rank 3 (Right) */}
                        {topThree[2] && (
                            <div className="flex-1 flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 delay-200">
                                <div 
                                    onClick={() => handlePlayerClick(topThree[2])}
                                    className="relative group cursor-pointer"
                                >
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-orange-600/50 shadow-[0_0_20px_rgba(234,88,12,0.2)] bg-neutral-900">
                                        <img src={topThree[2].avatar_url} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-orange-600 text-white font-black flex items-center justify-center rounded-lg text-xs skew-x-[-10deg]">3</div>
                                </div>
                                <span className="mt-4 font-black text-[10px] uppercase text-orange-500 truncate w-20 text-center">{topThree[2].username}</span>
                                <div className="mt-1 flex flex-col items-center">
                                    <span className="text-[10px] font-black text-white">{topThree[2].xp}</span>
                                    <span className="text-[7px] font-bold text-neutral-500 uppercase tracking-tighter">Poder</span>
                                </div>
                                <div className="h-16 w-full max-w-[80px] mt-2 bg-gradient-to-t from-orange-600/20 to-transparent rounded-t-xl border-x border-t border-orange-600/10"></div>
                            </div>
                        )}
                    </div>
                )}

                {/* 📋 LEADERBOARD LIST */}
                <div className="space-y-3 pb-10">
                    {restOfUsers.length > 0 ? (
                        restOfUsers.map((player) => (
                            <div
                                key={player.id}
                                onClick={() => handlePlayerClick(player)}
                                className={`group relative flex items-center gap-4 p-3 rounded-2xl border transition-all hover:bg-white/5 active:scale-[0.98] cursor-pointer ${
                                    player.is_current_user ? 'bg-gym-primary/10 border-gym-primary/30 shadow-[0_0_30px_rgba(250,204,21,0.1)]' : 'bg-neutral-900/40 border-white/5'
                                }`}
                            >
                                {/* Rank Number */}
                                <div className="w-8 flex justify-center text-sm font-black italic text-neutral-500 group-hover:text-white transition-colors">
                                    #{player.rank}
                                </div>

                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/10 group-hover:border-gym-primary/50 transition-colors">
                                        <img src={player.avatar_url} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-neutral-900 rounded-full border border-white/10 flex items-center justify-center">
                                        <Shield size={8} className="text-gym-primary" />
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className={`font-bold text-sm truncate uppercase italic ${player.is_current_user ? 'text-gym-primary' : 'text-white'}`}>
                                        {player.username}
                                    </h3>
                                    <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-bold uppercase">
                                        <MapPin size={8} />
                                        <span className="truncate">{player.gym_name}</span>
                                    </div>
                                </div>

                                {/* Score */}
                                <div className="shrink-0 flex flex-col items-end">
                                    <span className="font-black text-white text-sm tracking-tighter">{player.xp}</span>
                                    <span className="text-[8px] text-neutral-500 font-black uppercase tracking-widest">Poder Social</span>
                                </div>

                                {player.is_current_user && (
                                    <div className="absolute left-0 top-0 w-1 h-full bg-gym-primary rounded-l-2xl"></div>
                                )}
                            </div>
                        ))
                    ) : (
                        topThree.length === 0 && (
                            <div className="py-20 text-center">
                                <div className="bg-neutral-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                                    <Shield size={32} className="text-neutral-700" />
                                </div>
                                <h3 className="text-white font-black uppercase italic">Territorio Inexplorado</h3>
                                <p className="text-neutral-500 text-xs font-bold mt-1">Sé el primero en reclamar el trono.</p>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* 👤 STICKY MY PROGRESS DOCK */}
            {currentUserRank && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50 animate-in slide-in-from-bottom-10 duration-1000">
                    <div 
                        onClick={() => handlePlayerClick(currentUserRank)}
                        className="bg-neutral-900/80 backdrop-blur-3xl border border-gym-primary/30 p-4 rounded-2xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4 cursor-pointer hover:bg-neutral-800 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-gym-primary flex items-center justify-center text-black font-black italic shadow-[0_0_20px_rgba(250,204,21,0.4)]">
                            #{currentUserRank.rank}
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-gym-primary font-black uppercase tracking-widest leading-none">Tu Posición Actual</p>
                            <h4 className="text-white font-black uppercase italic text-sm mt-1">{currentUserRank.username}</h4>
                        </div>
                        <div className="text-right">
                            <span className="font-black text-gym-primary text-sm italic">{currentUserRank.xp}</span>
                            <p className="text-[8px] text-neutral-500 font-black uppercase">Puntos de Poder</p>
                        </div>
                    </div>
                </div>
            )}

            {/* PLAYER PROFILE MODAL */}
            {selectedPlayer && (
                <PlayerProfileModal
                    player={selectedPlayer}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}
        </div>
    );
};
