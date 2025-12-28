import { useEffect, useState, useRef } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Music2, Swords } from 'lucide-react';
import { socialService, type Post } from '../services/SocialService';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { CommentsSheet } from '../components/social/CommentsSheet';
import { MediaCarousel } from '../components/social/MediaCarousel';

export const CommunityPage = () => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);

    // Auto-play videos intersection observer
    const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});

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
        // Using getGlobalFeed for discovery
        const feed = await socialService.getGlobalFeed(user?.id);
        setPosts(feed);
        setLoading(false);
    };

    // Intersection Observer for Auto-Play
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const video = entry.target as HTMLVideoElement;
                    if (entry.isIntersecting) {
                        video.play().catch(() => { }); // catch abort errors
                    } else {
                        video.pause();
                    }
                });
            },
            { threshold: 0.6 } // Play when 60% visible
        );

        Object.values(videoRefs.current).forEach((video) => {
            if (video) observer.observe(video);
        });

        return () => observer.disconnect();
    }, [posts]);

    const handleLike = async (post: Post) => {
        if (!user) return alert("Inicia sesión para dar like ❤️");

        // Optimistic Update
        const isLiked = post.user_has_liked;
        const newCount = (post.likes_count || 0) + (isLiked ? -1 : 1);

        setPosts(prev => prev.map(p => p.id === post.id ? {
            ...p,
            user_has_liked: !isLiked,
            likes_count: newCount
        } : p));

        await socialService.toggleLike(user.id, post.id);
    };

    return (
        <div className="min-h-screen bg-black pb-20">
            {/* Header (Mobile style) */}
            <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 h-14 flex items-center justify-center">
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
                        <p className="text-xs text-neutral-600">Haz click en el botón (+) arriba.</p>
                    </div>
                ) : (
                    posts.map((post) => (
                        <div key={post.id} className="border-b border-white/5 pb-1 mb-1">

                            {/* Post Header */}
                            <div className="flex items-center justify-between px-3 py-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-neutral-800 overflow-hidden border border-white/10">
                                        <img
                                            src={post.profiles?.avatar_url || 'https://i.pravatar.cc/150'}
                                            alt={post.profiles?.username}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold text-xs text-white">{post.profiles?.username || 'Usuario'}</span>
                                            <span className="text-[9px] text-neutral-500">• 2h</span>
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
                                <MediaCarousel media={post.media} postId={post.id} />
                            ) : (
                                <div className="bg-black w-full relative">
                                    {post.type === 'video' ? (
                                        <div className="aspect-square relative max-h-[280px]">
                                            <video
                                                ref={el => { if (el) videoRefs.current[post.id] = el }}
                                                src={post.media_url}
                                                className="w-full h-full object-cover"
                                                playsInline
                                                loop
                                                muted
                                                onClick={(e) => {
                                                    const v = e.target as HTMLVideoElement;
                                                    v.muted = !v.muted;
                                                }}
                                            />
                                            <div className="absolute bottom-4 right-4 bg-black/50 p-2 rounded-full backdrop-blur-sm">
                                                <Music2 size={16} className="text-white animate-pulse" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="aspect-square max-h-[280px]">
                                            <img src={post.media_url} alt="Post" className="w-full h-full object-cover" />
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
                                        <span className="font-bold mr-1.5">{post.profiles?.username}</span>
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
        </div>
    );
};
