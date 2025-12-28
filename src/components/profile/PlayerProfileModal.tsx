import React, { useEffect, useState } from 'react';
import { X, MapPin, Grid, Film, UserPlus, UserCheck, Heart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
// userService removed
import { socialService, type Post } from '../../services/SocialService'; // Import Social Service
// RoutineViewModal import removed

interface PlayerProfileModalProps {
    player: {
        id: string;
        username: string;
        avatar_url: string;
        xp: number;
        rank: number;
        gym_name?: string;
        banner_url?: string;
        featured_routine_id?: string | null;
    };
    onClose: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ player, onClose }) => {
    const { user } = useAuth();

    // Social State
    const [stats, setStats] = useState({ followersCount: 0, followingCount: 0, totalLikes: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [activeTab, setActiveTab] = useState<'grid' | 'reels'>('grid');

    // Content State
    const [posts, setPosts] = useState<Post[]>([]);

    // Initial Load
    useEffect(() => {
        const init = async () => {
            // 1. Fetch Social Stats
            const s = await socialService.getProfileStats(player.id);
            setStats(s);

            // 2. Check Follow Status
            if (user && user.id !== player.id) {
                const following = await socialService.getFollowStatus(user.id, player.id);
                setIsFollowing(following);
            }
        };
        init();
    }, [player, user]);

    // Fetch Posts when tab changes
    useEffect(() => {
        if (activeTab === 'grid') {
            // Fetch ALL posts (Images + Videos) for the main grid
            socialService.getUserPosts(player.id).then(setPosts);
        } else if (activeTab === 'reels') {
            // Fetch ONLY videos for Reels tab
            socialService.getUserPosts(player.id, 'video').then(setPosts);
        }
    }, [activeTab, player.id]);

    const handleFollowToggle = async () => {
        if (!user) return;

        // Optimistic UI
        const newStatus = !isFollowing;
        setIsFollowing(newStatus);
        setStats(prev => ({ ...prev, followersCount: prev.followersCount + (newStatus ? 1 : -1) }));

        if (newStatus) {
            await socialService.followUser(user.id, player.id);
        } else {
            await socialService.unfollowUser(user.id, player.id);
        }
    };

    // Routine handlers removed

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-end md:justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-neutral-900 border-l md:border border-neutral-800 w-full md:max-w-sm h-full md:h-auto md:rounded-3xl overflow-hidden relative shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col md:max-h-[90vh]">

                {/* Header / Banner */}
                <div className="h-32 bg-neutral-800 relative shrink-0">
                    {player.banner_url ? (
                        <img src={player.banner_url} alt="Banner" className="w-full h-full object-cover opacity-60" />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-b from-neutral-800 to-neutral-900" />
                    )}

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-black/50 text-white p-1 rounded-full hover:bg-black/80 transition-colors z-20"
                    >
                        <X size={20} />
                    </button>

                    {/* Rank Badge */}
                    <div className="absolute top-4 left-4 z-20">
                        {player.rank <= 3 ? (
                            <div className={`w-10 h-10 flex items-center justify-center font-black rounded-lg shadow-lg skew-x-[-10deg] border border-white/20 ${player.rank === 1 ? 'bg-yellow-500 text-black' :
                                player.rank === 2 ? 'bg-slate-300 text-black' :
                                    'bg-orange-600 text-white'
                                }`}>
                                {player.rank}
                            </div>
                        ) : (
                            <div className="bg-black/60 backdrop-blur px-3 py-1 rounded-lg border border-white/10 text-xs font-bold text-white">
                                #{player.rank}
                            </div>
                        )}
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <div className="relative px-6 pb-6 -mt-12">
                        {/* Avatar & Stats */}
                        <div className="flex justify-between items-end mb-4">
                            <div className="w-24 h-24 rounded-2xl border-4 border-neutral-900 bg-neutral-800 overflow-hidden shadow-lg relative z-10">
                                <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
                            </div>

                            {/* Social Stats */}
                            <div className="flex-1 flex justify-end gap-4 mb-2">
                                <div className="text-center">
                                    <span className="block font-black text-white text-lg leading-none">{stats.followersCount}</span>
                                    <span className="text-[10px] text-neutral-500 font-bold uppercase">Seguidores</span>
                                </div>
                                <div className="text-center">
                                    <span className="block font-black text-white text-lg leading-none">{stats.followingCount}</span>
                                    <span className="text-[10px] text-neutral-500 font-bold uppercase">Siguiendo</span>
                                </div>
                            </div>
                        </div>

                        {/* Name & Follow Button */}
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-1 leading-none">{player.username}</h2>
                                <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mb-1">Agente de Alto Rendimiento</p>
                                {player.gym_name && (
                                    <div className="flex items-center gap-1 text-xs text-neutral-400">
                                        <MapPin size={10} />
                                        <span className="truncate max-w-[150px]">{player.gym_name}</span>
                                    </div>
                                )}
                            </div>

                            {user && user.id !== player.id && (
                                <button
                                    onClick={handleFollowToggle}
                                    className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${isFollowing
                                        ? 'bg-neutral-800 text-white border border-neutral-700'
                                        : 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                                        }`}
                                >
                                    {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
                                    {isFollowing ? 'Siguiendo' : 'Seguir'}
                                </button>
                            )}
                        </div>

                        {/* TABS SWITCHER */}
                        <div className="flex border-b border-neutral-800 mb-4">
                            <button
                                onClick={() => setActiveTab('grid')}
                                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative ${activeTab === 'grid' ? 'text-white' : 'text-neutral-500'}`}
                            >
                                <Grid size={18} className="mx-auto mb-1" />
                                Posts
                                {activeTab === 'grid' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />}
                            </button>
                            <button
                                onClick={() => setActiveTab('reels')}
                                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative ${activeTab === 'reels' ? 'text-white' : 'text-neutral-500'}`}
                            >
                                <Film size={18} className="mx-auto mb-1" />
                                Reels
                                {activeTab === 'reels' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />}
                            </button>
                        </div>

                        {/* TAB CONTENT */}

                        {/* 1. GRID TAB (Images) */}

                        {/* 2. GRID TAB (Images) */}
                        {activeTab === 'grid' && (
                            <div className="grid grid-cols-3 gap-1 animate-in slide-in-from-bottom-2 fade-in duration-300">
                                {posts.map(post => (
                                    <div key={post.id} className="aspect-square bg-neutral-800 relative group overflow-hidden cursor-pointer" onClick={() => alert('Ver Post ' + post.id)}>
                                        {post.type === 'video' ? (
                                            <video src={post.media_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={post.media_url} alt="Post" className="w-full h-full object-cover" />
                                        )}

                                        {/* Type Indicator */}
                                        {post.type === 'video' && (
                                            <div className="absolute top-2 right-2">
                                                <Film size={16} className="text-white drop-shadow-md" />
                                            </div>
                                        )}

                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-bold">
                                            <Heart size={12} fill="white" /> {post.likes_count}
                                        </div>
                                    </div>
                                ))}
                                {posts.length === 0 && (
                                    <div className="col-span-3 text-center py-8 text-neutral-600 text-xs">
                                        Sin fotos aún.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. REELS TAB (Videos) */}
                        {activeTab === 'reels' && (
                            <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
                                {posts.map(post => (
                                    <div key={post.id} className="aspect-[9/16] bg-neutral-800 rounded-lg relative overflow-hidden cursor-pointer">
                                        <video src={post.media_url} className="w-full h-full object-cover" />
                                        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs font-bold dropshadow-md">
                                            <Film size={12} /> {post.likes_count}
                                        </div>
                                    </div>
                                ))}
                                {posts.length === 0 && (
                                    <div className="col-span-2 text-center py-8 text-neutral-600 text-xs">
                                        Sin reels aún.
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>

            </div>

// Routine Modal helper removed
        </div>
    );
};
