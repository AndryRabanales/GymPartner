import React, { useEffect, useState } from 'react';
import { X, MapPin, Swords, Shield, ChevronRight, Grid, Film, UserPlus, UserCheck, Heart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/UserService';
import { socialService, type Post } from '../../services/SocialService'; // Import Social Service
import { RoutineViewModal } from './RoutineViewModal';

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
    const [activeTab, setActiveTab] = useState<'routines' | 'grid' | 'reels'>('routines');

    // Content State
    const [publicRoutines, setPublicRoutines] = useState<any[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);

    // View States
    const [viewRoutine, setViewRoutine] = useState<any | null>(null);
    const [copying, setCopying] = useState(false);

    // Initial Load
    useEffect(() => {
        const init = async () => {
            // 1. Fetch Routines (Existing)
            const decks = await userService.getUserPublicRoutines(player.id || '');
            setPublicRoutines(decks);

            // 2. Fetch Social Stats
            const s = await socialService.getProfileStats(player.id);
            setStats(s);

            // 3. Check Follow Status
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

    const handleOpenRoutine = async (routine: any) => {
        if (routine.exercises) {
            setViewRoutine(routine); // Already loaded
        } else {
            // Fetch details if needed (lazy load)
            const detailed = await userService.getRoutineDetails(routine.id);
            setViewRoutine(detailed);
        }
    };

    const handleCopyRoutine = async () => {
        if (!user || !viewRoutine) return;
        setCopying(true);
        const result = await userService.copyRoutine(viewRoutine.id, user.id);
        if (result.success) {
            alert("¡Estrategia robada con éxito! Ahora está en tu arsenal.");
        } else {
            alert("Error al copiar: " + result.error);
        }
        setCopying(false);
    };

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
                                onClick={() => setActiveTab('routines')}
                                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative ${activeTab === 'routines' ? 'text-white' : 'text-neutral-500'}`}
                            >
                                <Swords size={18} className="mx-auto mb-1" />
                                Mazos
                                {activeTab === 'routines' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />}
                            </button>
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

                        {/* 1. ROUTINES TAB */}
                        {activeTab === 'routines' && (
                            <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
                                {publicRoutines.length > 0 ? (
                                    publicRoutines.map(r => (
                                        <button
                                            key={r.id}
                                            onClick={() => handleOpenRoutine(r)}
                                            className="group relative overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-yellow-500 rounded-xl p-3 transition-all hover:bg-neutral-800 text-left flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-yellow-500 group-hover:bg-yellow-500/10 transition-colors border border-white/5">
                                                    <Swords size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white text-sm uppercase italic group-hover:text-yellow-500 transition-colors">{r.name}</h4>
                                                    <span className="text-[10px] text-neutral-500 font-bold tracking-wider block mt-0.5">
                                                        {(r.routine_exercises?.length || r.exercises?.length || 0)} CARTAS
                                                    </span>
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-neutral-600 group-hover:text-yellow-500" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-center py-8 border-2 border-dashed border-neutral-800 rounded-xl">
                                        <Shield size={24} className="mx-auto text-neutral-700 mb-2" />
                                        <p className="text-xs text-neutral-500 font-medium">Sin estrategias registradas</p>
                                    </div>
                                )}
                            </div>
                        )}

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

            {/* ROUTINE DETAIL MODAL (Nested) */}
            {viewRoutine && (
                <RoutineViewModal
                    routine={viewRoutine}
                    onClose={() => setViewRoutine(null)}
                    onCopy={handleCopyRoutine}
                    isCopying={copying}
                />
            )}
        </div>
    );
};
