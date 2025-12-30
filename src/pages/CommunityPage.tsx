import { useEffect, useState, useRef } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Music2, Swords } from 'lucide-react';
import { socialService, type Post } from '../services/SocialService';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { CommentsSheet } from '../components/social/CommentsSheet';
import { MediaCarousel } from '../components/social/MediaCarousel';
import { PlayerProfileModal } from '../components/profile/PlayerProfileModal';

export const CommunityPage = () => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

    const [playingPostId, setPlayingPostId] = useState<string | null>(null);
    const observerRefs = useRef<{ [key: string]: HTMLDivElement }>({});

    // Smart Auto-Play Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                let maxRatio = 0;
                let maxId = null;

                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                        if (entry.intersectionRatio > maxRatio) {
                            maxRatio = entry.intersectionRatio;
                            maxId = entry.target.getAttribute('data-post-id');
                        }
                    }
                });

                if (maxId) {
                    setPlayingPostId(maxId);
                }
            },
            { threshold: [0.5, 0.7] }
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
        setPosts(feed);
        setLoading(false);
    };

    const handleLike = async (post: Post) => {
        if (!user) return alert("Inicia sesión para dar like ❤️");

        // Validate post ID
        if (!post.id) {
            console.error("❌ Post ID is missing:", post);
            alert("Error: Post inválido. Recarga la página.");
            return;
        }

        console.log("🔍 DEBUG handleLike:", {
            postId: post.id,
            userId: user.id,
            currentLikeStatus: post.user_has_liked,
            likesCount: post.likes_count,
            postObject: post
        });

        // Optimistic Update
        const isLiked = post.user_has_liked;
        const newCount = (post.likes_count || 0) + (isLiked ? -1 : 1);

        setPosts(prev => prev.map(p => p.id === post.id ? {
            ...p,
            user_has_liked: !isLiked,
            likes_count: newCount
        } : p));

        try {
            const result = await socialService.toggleLike(user.id, post.id);
            console.log("✅ Like successful:", result);
        } catch (error) {
            console.error("❌ Like failed, reverting:", error);
            // Revert state
            setPosts(prev => prev.map(p => p.id === post.id ? {
                ...p,
                user_has_liked: isLiked,
                likes_count: post.likes_count || 0
            } : p));
            alert("Error al dar like: " + (error as Error).message);
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
        <div className="bg-black min-h-full">
            {/* Header (Mobile style) */}
            <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/5 px-4 h-10 flex items-center justify-center">
                <span className="font-black italic text-white tracking-tighter text-lg">GYM<span className="text-yellow-500">TOK</span></span>
            </div>

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
                    posts.map((post) => (
                        <div
                            key={post.id}
                            ref={el => { if (el) observerRefs.current[post.id] = el }}
                            data-post-id={post.id}
                            className="border-b border-white/5 pb-4 mb-4"
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
                            <div className="px-3 py-1">
                                <div className="flex items-center gap-2.5 mb-1.5">
                                    <button
                                        onClick={() => handleLike(post)}
                                        className="transition-transform active:scale-95"
                                    >
                                        <Heart
                                            size={20}
                                            className={post.user_has_liked ? "text-red-500 fill-red-500" : "text-white"}
                                        />
                                    </button>
                                    <button
                                        onClick={() => setActiveCommentPostId(post.id)}
                                        className="text-white hover:text-neutral-300 transition-transform active:scale-95"
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
