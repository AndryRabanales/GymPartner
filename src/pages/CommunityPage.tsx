import { useEffect, useState, useRef } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Music2, Swords } from 'lucide-react';
import { socialService, type Post } from '../services/SocialService';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { CommentsSheet } from '../components/social/CommentsSheet';
import { MediaCarousel } from '../components/social/MediaCarousel';
import { PlayerProfileModal } from '../components/profile/PlayerProfileModal';

// Seen Posts Storage Key
const SEEN_STORAGE_KEY = 'community_seen_posts';

export const CommunityPage = () => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

    const [playingPostId, setPlayingPostId] = useState<string | null>(null);
    const observerRefs = useRef<{ [key: string]: HTMLDivElement }>({});

    // Pull-to-Refresh State
    const [refreshing, setRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const touchStartY = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Helper: Get seen posts from localStorage
    const getSeenPosts = (): string[] => {
        try {
            return JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) || '[]');
        } catch {
            return [];
        }
    };

    // Helper: Mark post as seen
    const markPostAsSeen = (postId: string) => {
        const seen = getSeenPosts();
        if (!seen.includes(postId)) {
            seen.push(postId);
            // Keep only last 100 seen posts
            localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(seen.slice(-100)));
        }
    };

    // Helper: Rotate feed (unseen first, seen last)
    const rotateFeed = (posts: Post[]): Post[] => {
        const seenIds = getSeenPosts();
        const unseen = posts.filter(p => !seenIds.includes(p.id));
        const seen = posts.filter(p => seenIds.includes(p.id));
        return [...unseen, ...seen];
    };

    // Helper: Shuffle top N posts (Fisher-Yates)
    const shufflePosts = (posts: Post[], count: number = 5): Post[] => {
        if (posts.length <= count) {
            const shuffled = [...posts];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }

        const toShuffle = posts.slice(0, count);
        const rest = posts.slice(count);

        for (let i = toShuffle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
        }

        return [...toShuffle, ...rest];
    };

    // Smart Auto-Play Observer + Seen Posts Tracker
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                let maxRatio = 0;
                let maxId = null;

                entries.forEach((entry) => {
                    // Mark as seen when 60% visible
                    if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                        const postId = entry.target.getAttribute('data-post-id');
                        if (postId) {
                            markPostAsSeen(postId);
                        }

                        if (entry.intersectionRatio > maxRatio) {
                            maxRatio = entry.intersectionRatio;
                            maxId = postId;
                        }
                    }
                });

                if (maxId) {
                    setPlayingPostId(maxId);
                }
            },
            { threshold: [0.5, 0.6, 0.7] }
        );

        Object.values(observerRefs.current).forEach((el) => {
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [posts]);

    const handleShare = async (post: Post) => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: `GymPartner: ${post.profiles?.username}`,
                    text: post.caption || 'Entrenamiento en GymPartner',
                    url: window.location.href
                });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                alert('Link copiado 📋');
            }
        } catch (error) { console.log(error); }
    };

    useEffect(() => {
        loadFeed();
    }, []);

    const loadFeed = async () => {
        setLoading(true);
        // Using getGlobalFeed for discovery (default behavior: grouped posts, perfect for Community feed)
        const feed = await socialService.getGlobalFeed(user?.id, undefined, false);

        // Apply smart rotation
        const rotated = rotateFeed(feed);
        const shuffled = shufflePosts(rotated, 5); // Shuffle top 5 for variety

        setPosts(shuffled);
        setLoading(false);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadFeed();
        setTimeout(() => {
            setRefreshing(false);
            setPullDistance(0);
        }, 500);
    };

    // Pull-to-Refresh Touch Handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        if (containerRef.current && containerRef.current.scrollTop === 0) {
            touchStartY.current = e.touches[0].clientY;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (containerRef.current && containerRef.current.scrollTop === 0 && !refreshing) {
            const touchY = e.touches[0].clientY;
            const distance = Math.max(0, touchY - touchStartY.current);
            if (distance > 0 && distance < 150) {
                setPullDistance(distance);
            }
        }
    };

    const handleTouchEnd = () => {
        if (pullDistance > 80 && !refreshing) {
            handleRefresh();
        } else {
            setPullDistance(0);
        }
        touchStartY.current = 0;
    };

    const handleLike = async (post: Post) => {
        if (!user) return;
        if (!post.id) return;

        // Optimistic Update
        const isLiked = post.user_has_liked;
        const newCount = (post.likes_count || 0) + (isLiked ? -1 : 1);

        setPosts(prev => prev.map(p => p.id === post.id ? {
            ...p,
            user_has_liked: !isLiked,
            likes_count: newCount
        } : p));

        try {
            await socialService.toggleLike(user.id, post.id);
        } catch (error) {
            // Revert state silently
            setPosts(prev => prev.map(p => p.id === post.id ? {
                ...p,
                user_has_liked: isLiked,
                likes_count: post.likes_count || 0
            } : p));
        }
    };

    const togglePlayPause = (e: React.MouseEvent<HTMLVideoElement>) => {
        const video = e.currentTarget;
        if (video.paused) {
            video.play().catch(() => { });
        } else {
            video.pause();
        }
    };



    return (
        <div
            ref={containerRef}
            className="bg-black min-h-full overflow-y-auto"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Header (Mobile style) */}
            <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/5 px-4 h-10 flex items-center justify-center">
                <span className="font-black italic text-white tracking-tighter text-lg">GYM<span className="text-yellow-500">JUMPS</span></span>
            </div>

            {/* Pull-to-Refresh Indicator */}
            {pullDistance > 0 && (
                <div
                    className="flex items-center justify-center py-2 transition-all"
                    style={{
                        transform: `translateY(${Math.min(pullDistance - 80, 0)}px)`,
                        opacity: Math.min(pullDistance / 80, 1)
                    }}
                >
                    <div className={`w-6 h-6 border-4 border-yellow-500 border-t-transparent rounded-full ${refreshing ? 'animate-spin' : ''}`}
                        style={{ transform: `rotate(${pullDistance * 3}deg)` }}
                    />
                </div>
            )}

            <div className="max-w-md mx-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-neutral-500 text-xs font-bold uppercase">Cargando Feed...</p>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-20 px-6">
                        <p className="text-white font-bold text-lg mb-2">Está muy tranquilo por aquí... 🦗</p>
                        <p className="text-neutral-500 text-sm mb-6">Sé el primero en subir un post.</p>
                    </div>
                ) : (
                    posts.map((post, index) => (
                        <div
                            key={post.id}
                            ref={el => { if (el) observerRefs.current[post.id] = el }}
                            data-post-id={post.id}
                            className={`border-b border-white/5 pb-4 mb-4 ${index === 0 ? 'mt-4' : ''}`}
                        >

                            {/* Post Header */}
                            <div className="flex items-center justify-between px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelectedPlayer({
                                            id: post.user_id,
                                            username: post.profiles?.username || 'Usuario',
                                            avatar_url: post.profiles?.avatar_url,
                                            xp: 0,
                                            rank: 0
                                        })}
                                        className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden border border-white/10"
                                    >
                                        <img
                                            src={post.profiles?.avatar_url || 'https://i.pravatar.cc/150'}
                                            alt={post.profiles?.username}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                className="font-bold text-sm text-white hover:text-yellow-500 transition-colors"
                                            >
                                                {post.profiles?.username || 'Usuario'}
                                            </button>
                                            <span className="text-[10px] text-neutral-500">• 2h</span>
                                        </div>
                                        {post.linked_routine_id && post.routines && (
                                            <Link to="/arsenal" className="flex items-center gap-1 text-[10px] text-yellow-500 hover:underline">
                                                <Swords size={10} />
                                                <span>{post.routines.name}</span>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                                <button className="text-neutral-400">
                                    <MoreHorizontal size={16} />
                                </button>
                            </div>

                            {/* Media */}
                            {post.media && post.media.length > 0 ? (
                                <MediaCarousel media={post.media} isPlaying={playingPostId === post.id} />
                            ) : (
                                <div className="bg-neutral-900 w-full relative aspect-[4/5] max-h-[500px] overflow-hidden rounded-sm">
                                    {post.type === 'video' ? (
                                        <div className="w-full h-full flex items-center justify-center bg-black group">
                                            <video
                                                ref={el => {
                                                    if (el) {
                                                        if (playingPostId === post.id) {
                                                            const promise = el.play();
                                                            if (promise !== undefined) {
                                                                promise.catch(() => { });
                                                            }
                                                        } else {
                                                            el.pause();
                                                        }
                                                    }
                                                }}
                                                src={post.media_url}
                                                className="w-full h-full object-contain cursor-pointer"
                                                playsInline
                                                loop
                                                preload="none"
                                                muted
                                                onClick={togglePlayPause}
                                            />
                                            <button
                                                className="absolute bottom-3 right-3 bg-black/50 p-1.5 rounded-full backdrop-blur-sm text-white hover:bg-black/70 transition-colors active:scale-95"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const v = e.currentTarget.parentElement?.querySelector('video');
                                                    if (v) v.muted = !v.muted;
                                                }}
                                            >
                                                <Music2 size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-black">
                                            <img src={post.media_url} alt="Post" className="w-full h-full object-contain" />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="px-3 py-1 relative z-50">
                                <div className="flex items-center gap-2.5 mb-1.5" style={{ position: 'relative', zIndex: 100 }}>
                                    <button
                                        onClick={() => handleLike(post)}
                                        onTouchEnd={(e) => {
                                            e.preventDefault();
                                            handleLike(post);
                                        }}
                                        className="transition-transform active:scale-95 cursor-pointer"
                                        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                                    >
                                        <Heart
                                            size={20}
                                            className={post.user_has_liked ? "text-red-500 fill-red-500" : "text-white"}
                                        />
                                    </button>
                                    <button
                                        onClick={() => setActiveCommentPostId(post.id)}
                                        onTouchEnd={(e) => {
                                            e.preventDefault();
                                            setActiveCommentPostId(post.id);
                                        }}
                                        className="text-white hover:text-neutral-300 transition-transform active:scale-95 cursor-pointer"
                                        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                                    >
                                        <MessageCircle size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleShare(post)}
                                        className="text-white hover:text-neutral-300 ml-auto transition-transform active:scale-95"
                                    >
                                        <Share2 size={18} />
                                    </button>
                                </div>

                                {/* Likes Count */}
                                <div className="mb-1">
                                    <span className="font-bold text-xs text-white">{post.likes_count} Me gusta</span>
                                </div>

                                {/* Caption */}
                                <div className="space-y-0.5">
                                    <p className="text-xs text-white line-clamp-2">
                                        <button
                                            onClick={() => setSelectedPlayer({
                                                id: post.user_id,
                                                username: post.profiles?.username || 'Usuario',
                                                avatar_url: post.profiles?.avatar_url,
                                                xp: 0,
                                                rank: 0
                                            })}
                                            className="font-bold mr-1.5 hover:text-yellow-500 transition-colors cursor-pointer"
                                        >
                                            {post.profiles?.username}
                                        </button>
                                        {post.caption}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* COMMENTS SHEET OVERLAY */}
            {activeCommentPostId && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setActiveCommentPostId(null)}>
                    <div onClick={e => e.stopPropagation()} className="w-full max-w-md">
                        <CommentsSheet
                            postId={activeCommentPostId}
                            onClose={() => setActiveCommentPostId(null)}
                        />
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
