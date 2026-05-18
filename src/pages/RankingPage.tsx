import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Trophy, Shield, MapPin, Swords, ChevronLeft, ChevronRight, Zap, UserPlus } from 'lucide-react';
import { PublicTeaser } from '../components/common/PublicTeaser';
import { userService } from '../services/UserService';
import type { UserPrimaryGym } from '../services/UserService';
import { PlayerProfileModal } from '../components/profile/PlayerProfileModal';

import { socialService } from '../services/SocialService';
import { notificationService } from '../services/NotificationService';
import toast from 'react-hot-toast';

interface RankedUser {
    id: string;
    username: string;
    avatar_url: string;
    followers_count: number;
    rank: number;
    gym_name?: string;
    is_current_user?: boolean;
    banner_url?: string;
    featured_routine_id?: string | null;
}

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
                // A. Fetch all profiles assigned to this home gym
                const { data: gymProfiles, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url, custom_settings')
                    .eq('home_gym_id', targetGym.gym_id);

                if (profilesError) throw profilesError;

                if (!gymProfiles || gymProfiles.length === 0) {
                    setLeaderboard([]);
                    return;
                }

                // B. Fetch all follows where the target is one of the gym members to get absolute, real-time counts
                const profileIds = gymProfiles.map(p => p.id);
                const { data: followsData, error: followsError } = await supabase
                    .from('follows')
                    .select('following_id, follower_id')
                    .in('following_id', profileIds);

                if (followsError) throw followsError;

                // C. Map follows count and custom settings banner
                const followersMap = (followsData || []).reduce((acc: Record<string, number>, follow: any) => {
                    acc[follow.following_id] = (acc[follow.following_id] || 0) + 1;
                    return acc;
                }, {});

                const mapped = gymProfiles.map((p: any) => {
                    const count = followersMap[p.id] || 0;
                    const settings = p.custom_settings || {};
                    return {
                        id: p.id,
                        username: p.username || 'Usuario',
                        avatar_url: p.avatar_url || `https://ui-avatars.com/api/?name=${p.username || 'U'}&background=random`,
                        followers_count: count,
                        gym_name: targetGym.gym_name,
                        is_current_user: p.id === user.id,
                        banner_url: settings.banner_url || null,
                        featured_routine_id: null
                    };
                });

                // D. Sort by followers count descending and map ranks (highest followers = #1)
                const sorted = mapped.sort((a, b) => b.followers_count - a.followers_count);
                const finalLeaderboard = sorted.map((p, index) => ({
                    ...p,
                    rank: index + 1
                }));

                setLeaderboard(finalLeaderboard);
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
                            <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-black text-sm text-white truncate uppercase italic tracking-tight">
                                {player.username}
                            </h3>
                            <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                                <MapPin size={10} /> {player.gym_name}
                            </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end">
                            <span className="font-black text-white text-sm italic">{player.followers_count}</span>
                            <span className="text-[8px] text-neutral-500 font-bold uppercase">Seguidores</span>
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
                                    return {
                                        ...p,
                                        followers_count: Math.max(0, p.followers_count + (newIsFollowing ? 1 : -1))
                                    };
                                }
                                return p;
                            });
                            const sorted = [...updated].sort((a, b) => b.followers_count - a.followers_count);
                            return sorted.map((p, idx) => ({ ...p, rank: idx + 1 }));
                        });
                    }}
                />
            )}
        </div>
    );
};
