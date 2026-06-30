import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Trophy, Shield, MapPin, Swords, ChevronLeft, ChevronRight, Zap, UserPlus } from 'lucide-react';
import { PublicTeaser } from '../components/common/PublicTeaser';
import { userService } from '../services/UserService';
import type { UserPrimaryGym } from '../services/UserService';
import { PlayerProfileModal } from '../components/profile/PlayerProfileModal';
import { cloudinaryService } from '../services/CloudinaryService';

import { socialService } from '../services/SocialService';
import { notificationService } from '../services/NotificationService';
import toast from 'react-hot-toast';

interface RankedUser {
    id: string;
    username: string;
    avatar_url: string;
    followers_count: number;
    gx_points: number;
    checkins_count: number;
    is_boosted?: boolean;
    rank: number;
    gym_name?: string;
    is_current_user?: boolean;
    banner_url?: string;
    featured_routine_id?: string | null;
}

const isDefaultBio = (bio?: string | null) => {
    if (!bio) return true;
    const clean = bio.trim().toLowerCase();
    return clean.includes('nuevo atleta') || clean.includes('entrenando') || clean.includes('gympartner') || clean.includes('ginx');
};

export const RankingPage = () => {
    const { user } = useAuth();
    const [leaderboard, setLeaderboard] = useState<RankedUser[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);


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
                // Fetch profiles in this gym via the safe SECURITY DEFINER RPC
                const { data: leaderboardData, error } = await supabase
                    .rpc('get_gym_followers_leaderboard', { gym_id_param: targetGym.gym_id });

                if (error) throw error;

                if (leaderboardData) {
                    const mapped: RankedUser[] = leaderboardData.map((p: any, index: number) => ({
                        id: p.id,
                        username: p.username || 'Usuario',
                        avatar_url: p.avatar_url || `https://ui-avatars.com/api/?name=${p.username || 'U'}&background=random`,
                        followers_count: Number(p.followers_count) || 0,
                        gx_points: Number(p.gx_points) || 0,
                        checkins_count: Number(p.checkins_count) || 0,
                        is_boosted: p.is_boosted || false,
                        rank: index + 1,
                        gym_name: p.gym_name || targetGym.gym_name,
                        is_current_user: p.id === user.id,
                        banner_url: p.banner_url || null,
                        featured_routine_id: p.featured_routine_id || null,
                        description: p.description || ''
                    }));
                    setLeaderboard(mapped);
                } else {
                    setLeaderboard([]);
                }
            } catch (err) {
                console.error('Error in ranking fetch:', err);
                setLeaderboard([]);
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
                benefitTitle="Influencia Social"
                benefitDescription="Gana seguidores por cada entrenamiento y contenido compartido, conquista territorios y desbloquea insignias de prestigio."
                iconColor="text-yellow-500"
                bgAccent="bg-yellow-500/10"
            />
        );
    }

    return (
        <div className="pb-24 bg-transparent">
            {/* Header */}
            <div className="sticky top-2 z-30 px-4 pt-1">
                <div className="max-w-7xl mx-auto flex items-center justify-between bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-2 px-6 shadow-2xl">
                    <h1 className="flex items-center gap-2">
                        <Trophy className="text-yellow-500" size={22} />
                        <span className="text-xl font-black text-white italic uppercase tracking-tighter">Ranking</span>
                    </h1>

                    {userGyms.length > 0 && (
                        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full p-1 pl-4 shadow-xl">
                            <span className="text-[11px] font-black text-white uppercase italic truncate max-w-[120px]">
                                {userGyms[currentGymIndex]?.gym_name}
                            </span>
                            {userGyms.length > 1 && (
                                <div className="flex gap-1">
                                    <button onClick={handlePrevGym} className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white"><ChevronLeft size={16} /></button>
                                    <button onClick={handleNextGym} className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white"><ChevronRight size={16} /></button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Leaderboard List */}
            <div className="max-w-7xl mx-auto p-4 space-y-2 mt-4">
                {leaderboard.map((player) => (
                    <button
                        key={player.id}
                        onClick={() => handlePlayerClick(player)}
                        className={`w-full text-left relative flex items-center gap-4 p-3 rounded-2xl border transition-all hover:brightness-125 active:scale-[0.98] ${getRankStyle(player.rank)} ${player.is_current_user ? 'ring-1 ring-gym-primary' : ''}`}
                    >
                        <div className="shrink-0 w-8 flex justify-center font-black text-neutral-500">
                            {getRankBadge(player.rank)}
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-neutral-800 overflow-hidden shrink-0 border border-white/10">
                            <img
                                src={cloudinaryService.getOptimizedImageUrl(player.avatar_url, { width: 96, height: 96 })}
                                alt={player.username}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-black text-sm text-white truncate uppercase italic tracking-tight flex items-center gap-1">
                                {player.username}
                                {player.is_boosted && <Zap size={14} className="text-yellow-400 fill-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]" />}
                            </h3>
                            <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                                <MapPin size={10} /> {player.gym_name}
                            </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end">
                            <span className="font-black text-gym-primary text-sm italic">{player.gx_points} GX</span>
                            <span className="text-[8px] text-neutral-500 font-bold uppercase flex items-center gap-0.5">
                                🔥 {player.checkins_count} entrenos
                            </span>
                        </div>
                    </button>
                ))}
            </div>

            {/* PREMIUM PROFILE MODAL */}
            {selectedPlayer && (
                <PlayerProfileModal 
                    player={selectedPlayer} 
                    onClose={() => setSelectedPlayer(null)}
                    onFollowToggle={(newIsFollowing) => {
                        setLeaderboard(prev => {
                            const updated = prev.map(p => {
                                if (p.id === selectedPlayer.id) {
                                    const diff = newIsFollowing ? 1 : -1;
                                    const newFollowers = Math.max(0, p.followers_count + diff);
                                    const newGxPoints = Math.max(0, p.gx_points + diff);
                                    return {
                                        ...p,
                                        followers_count: newFollowers,
                                        gx_points: newGxPoints
                                    };
                                }
                                return p;
                            });
                            const sorted = [...updated].sort((a, b) => {
                                if (a.is_boosted !== b.is_boosted) {
                                    return a.is_boosted ? -1 : 1;
                                }
                                return b.gx_points - a.gx_points;
                            });
                            return sorted.map((p, idx) => ({ ...p, rank: idx + 1 }));
                        });
                    }}
                />
            )}
        </div>
    );
};
