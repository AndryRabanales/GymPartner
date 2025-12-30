import React, { useEffect, useState } from 'react';
import { X, Swords, Grid, Film, MapPin, Heart, UserPlus, UserCheck } from 'lucide-react';
import { FeedViewerOverlay } from '../social/FeedViewerOverlay';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/UserService';
import { socialService, type Post } from '../../services/SocialService';
import { RoutineViewModal } from './RoutineViewModal';
import { useBottomNav } from '../../context/BottomNavContext';

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
    const { hideBottomNav, showBottomNav } = useBottomNav();

    // Social State
    const [stats, setStats] = useState({ followersCount: 0, followingCount: 0, totalLikes: 0 });
    const [viewedPostId, setViewedPostId] = useState<string | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [activeTab, setActiveTab] = useState<'grid' | 'reels' | 'routines'>('grid');

    // Content State
    const [posts, setPosts] = useState<Post[]>([]);
    const [publicRoutines, setPublicRoutines] = useState<any[]>([]);
    const [viewRoutine, setViewRoutine] = useState<any | null>(null);
    const [copying, setCopying] = useState(false);

    // Hide BottomNav when modal opens, show when it closes
    useEffect(() => {
        hideBottomNav();
        return () => {
            showBottomNav();
        };
    }, [hideBottomNav, showBottomNav]);

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

    // Fetch Posts/Routines when tab changes
    useEffect(() => {
        if (activeTab === 'grid') {
            socialService.getUserPosts(player.id, undefined, user?.id).then(setPosts);
        } else if (activeTab === 'reels') {
            socialService.getUserPosts(player.id, 'video', user?.id).then(setPosts);
        } else if (activeTab === 'routines') {
            userService.getUserPublicRoutines(player.id).then(setPublicRoutines);
        }
    }, [activeTab, player.id, user?.id]);

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

    const handleCopyRoutine = async () => {
        if (!user || !viewRoutine) return;
        setCopying(true);
        try {
            await userService.copyRoutine(viewRoutine.id, user.id);
            alert('¡Estrategia robada con éxito! Ahora está en tu arsenal.');
            setViewRoutine(null);
        } catch (error) {
            console.error('Error copying routine:', error);
            alert('Error al copiar la rutina.');
        } finally {
            setCopying(false);
        }
    };

    // Routine handlers removed

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-end md:justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-neutral-900 border-l md:border border-neutral-800 w-full md:max-w-sm h-full md:h-auto md:rounded-3xl overflow-hidden relative shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col md:max-h-[90vh]">

                {/* Close Button (Fixed) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 bg-black/50 text-white p-1 rounded-full hover:bg-black/80 transition-colors z-50"
                >
                    <X size={20} />
                </button>

                {/* Scrollable Content (Banner matches scroll) */}
                <div className="overflow-y-auto flex-1 custom-scrollbar w-full">

                    {/* Header / Banner */}
                    <div className="h-32 bg-neutral-800 relative">
                        {player.banner_url ? (
                            <img src={player.banner_url} alt="Banner" className="w-full h-full object-cover opacity-60" />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-b from-neutral-800 to-neutral-900" />
                        )}

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
                    <div className="relative px-6 pb-6 flex flex-col items-center text-center">

                        {/* Avatar (Centered & Overlapping Banner) */}
                        <div className="-mt-16 mb-4 relative z-10 group">
                            <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl animate-pulse group-hover:bg-yellow-500/40 transition-all"></div>
                            <div className="w-32 h-32 rounded-full border-4 border-neutral-900 bg-neutral-800 overflow-hidden shadow-2xl relative">
                                <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
                            </div>
                            {/* Rank Badge Integration (Optional small badge) */}
                            <div className="absolute bottom-0 right-0 bg-black/80 backdrop-blur border border-yellow-500/50 text-yellow-500 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg">
                                Lvl {Math.floor(player.xp / 1000) + 1}
                            </div>
                        </div>

                        {/* Name & Title */}
                        <div className="mb-6 space-y-1">
                            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-lg">
                                {player.username}
                            </h2>
                            <p className="text-xs text-neutral-400 font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-yellow-500"></span>
                                Agente de Alto Rendimiento
                                <span className="w-1 h-1 rounded-full bg-yellow-500"></span>
                            </p>
                            {player.gym_name && (
                                <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 mt-2 bg-neutral-800/50 py-1 px-3 rounded-full mx-auto w-fit border border-white/5">
                                    <MapPin size={10} />
                                    <span>{player.gym_name}</span>
                                </div>
                            )}
                        </div>

                        {/* Social Stats Row */}
                        <div className="flex items-center justify-center gap-8 mb-8 w-full border-y border-white/5 py-4 bg-white/[0.02]">
                            <div className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform">
                                <span className="font-black text-2xl text-white leading-none mb-1 group-hover:text-yellow-500 transition-colors">{stats.followersCount}</span>
                                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Seguidores</span>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform">
                                <span className="font-black text-2xl text-white leading-none mb-1 group-hover:text-yellow-500 transition-colors">{stats.followingCount}</span>
                                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Siguiendo</span>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform">
                                <span className="font-black text-2xl text-white leading-none mb-1 group-hover:text-red-500 transition-colors">{stats.totalLikes}</span>
                                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Likes</span>
                            </div>
                        </div>

                        {/* Follow Button */}
                        {user && user.id !== player.id && (
                            <button
                                onClick={handleFollowToggle}
                                className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 mb-8 shadow-lg ${isFollowing
                                    ? 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white hover:border-neutral-500'
                                    : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-500/20'
                                    }`}
                            >
                                {isFollowing ? <UserCheck size={18} /> : <UserPlus size={18} />}
                                {isFollowing ? 'Siguiendo' : 'Seguir Agente'}
                            </button>
                        )}

                        {/* TABS SWITCHER */}
                        <div className="flex w-full border-b border-neutral-800 mb-4 sticky top-0 bg-neutral-900/95 backdrop-blur z-20 pt-2">
                            <button
                                onClick={() => setActiveTab('grid')}
                                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative ${activeTab === 'grid' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                <Grid size={18} className="mx-auto mb-1" />
                                Posts
                                {activeTab === 'grid' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 shadow-[0_0_10px_#eab308]" />}
                            </button>
                            <button
                                onClick={() => setActiveTab('reels')}
                                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative ${activeTab === 'reels' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                <Film size={18} className="mx-auto mb-1" />
                                Reels
                                {activeTab === 'reels' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 shadow-[0_0_10px_#eab308]" />}
                            </button>
                            <button
                                onClick={() => setActiveTab('routines')}
                                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative ${activeTab === 'routines' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                <Swords size={18} className="mx-auto mb-1" />
                                Mazos
                                {activeTab === 'routines' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 shadow-[0_0_10px_#eab308]" />}
                            </button>
                        </div>

                        {/* TAB CONTENT (Full Width) */}
                        {/* 1. GRID TAB (Images) */}
                        {activeTab === 'grid' && (
                            <div className="grid grid-cols-3 gap-1 animate-in slide-in-from-bottom-2 fade-in duration-300">
                                {posts.map(post => (
                                    <div
                                        key={post.id}
                                        className="aspect-square bg-neutral-800 relative group overflow-hidden cursor-pointer"
                                        onClick={() => setViewedPostId(post.id)}
                                    >
                                        {post.type === 'video' ? (
                                            <video
                                                src={post.media_url}
                                                className="w-full h-full object-cover"
                                                muted
                                                playsInline
                                                onError={(e) => console.error("Grid Video Error:", post.id, e)}
                                            />
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
                                    <div className="col-span-3 py-12 flex flex-col items-center justify-center text-neutral-600 space-y-3 opacity-60">
                                        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center">
                                            <Grid size={24} />
                                        </div>
                                        <p className="text-sm font-bold uppercase tracking-wider">Sin fotos aún</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* 2. REELS TAB (Videos) */}
                        {activeTab === 'reels' && (
                            <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
                                {posts.map(post => (
                                    <div
                                        key={post.id}
                                        className="aspect-[9/16] bg-neutral-800 rounded-lg relative overflow-hidden cursor-pointer group"
                                        onClick={() => setViewedPostId(post.id)}
                                    >
                                        <video
                                            src={post.media_url}
                                            className="w-full h-full object-cover"
                                            muted
                                            playsInline
                                            onError={(e) => console.error("Reel Video Error:", post.id, e)}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                                        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white text-sm font-bold drop-shadow-md">
                                            <Heart size={14} fill="white" /> {post.likes_count}
                                        </div>
                                    </div>
                                ))}
                                {posts.length === 0 && (
                                    <div className="col-span-2 py-12 flex flex-col items-center justify-center text-neutral-600 space-y-3 opacity-60">
                                        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center">
                                            <Film size={24} />
                                        </div>
                                        <p className="text-sm font-bold uppercase tracking-wider">Sin reels aún</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. ROUTINES TAB (Mazos) */}
                        {activeTab === 'routines' && (
                            <div className="grid grid-cols-1 gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
                                {publicRoutines.map(routine => (
                                    <div
                                        key={routine.id}
                                        onClick={() => setViewRoutine(routine)}
                                        className="bg-neutral-800 p-4 rounded-xl border border-white/5 flex items-center gap-4 cursor-pointer hover:bg-neutral-700 transition-colors"
                                    >
                                        <div className="w-12 h-12 bg-neutral-900 rounded-lg flex items-center justify-center text-2xl border border-white/5">
                                            <Swords size={20} className="text-gym-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-white uppercase italic tracking-wider truncate">{routine.name}</h3>
                                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">{routine.exercises?.length || 0} Cartas</p>
                                        </div>
                                    </div>
                                ))}
                                {publicRoutines.length === 0 && (
                                    <div className="py-12 flex flex-col items-center justify-center text-neutral-600 space-y-3 opacity-60">
                                        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center">
                                            <Swords size={24} />
                                        </div>
                                        <p className="text-sm font-bold uppercase tracking-wider">Sin mazos públicos</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Routine Inspector */}
                    {viewRoutine && (
                        <RoutineViewModal
                            routine={viewRoutine}
                            onClose={() => setViewRoutine(null)}
                            onCopy={handleCopyRoutine}
                            isCopying={copying}
                        />
                    )}
                </div>
            </div>

            {/* Feed Viewer Overlay */}
            {viewedPostId && (
                <FeedViewerOverlay
                    initialPostId={viewedPostId}
                    posts={posts}
                    onClose={() => setViewedPostId(null)}
                    variant={activeTab === 'reels' ? 'reel' : 'feed'}
                />
            )}
        </div>
    );
};
