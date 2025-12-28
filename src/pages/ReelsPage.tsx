import { useEffect, useState, useRef } from 'react';
import { Heart, MessageCircle, Share2, Music2, Swords, UserPlus, Volume2, VolumeX } from 'lucide-react';
import { socialService, type Post } from '../services/SocialService';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const ReelsPage = () => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [muted, setMuted] = useState(true);

    const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});

    useEffect(() => {
        loadReels();
    }, []);

    const loadReels = async () => {
        setLoading(true);
        // Fetch ONLY videos
        const feed = await socialService.getGlobalFeed(user?.id, 'video');
        setPosts(feed);
        setLoading(false);
    };

    // Intersection Observer for Auto-Play & Pause
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const video = entry.target as HTMLVideoElement;
                    if (entry.isIntersecting) {
                        // Play when fully visible
                        video.currentTime = 0; // Restart
                        video.play().catch(() => { });
                    } else {
                        video.pause();
                    }
                });
            },
            { threshold: 0.7 } // Needs 70% visibility
        );

        Object.values(videoRefs.current).forEach((video) => {
            if (video) observer.observe(video);
        });

        return () => observer.disconnect();
    }, [posts]);

    const handleLike = async (post: Post, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent toggling mute
        if (!user) return alert("Inicia sesión para dar like ❤️");

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
        <div className="h-[calc(100vh-theme(spacing.16))] md:h-[calc(100vh-theme(spacing.20))] bg-black overflow-y-scroll snap-y snap-mandatory custom-scrollbar">

            {loading && (
                <div className="h-full w-full flex items-center justify-center snap-center">
                    <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {!loading && posts.length === 0 && (
                <div className="h-full w-full flex flex-col items-center justify-center snap-center text-white">
                    <p className="font-bold text-xl mb-2">Sin Reels aún 🎬</p>
                    <p className="text-neutral-500 text-sm">Sé el primero en subir uno.</p>
                </div>
            )}

            {posts.map((post) => (
                <div key={post.id} className="h-full w-full max-w-md mx-auto relative snap-center flex items-center justify-center bg-neutral-900 border-b border-neutral-800 md:border-none">

                    {/* VIDEO CONTAINER */}
                    <div className="relative w-full h-full md:max-h-[85vh] md:rounded-2xl overflow-hidden shadow-2xl">
                        <video
                            ref={el => { if (el) videoRefs.current[post.id] = el }}
                            src={post.media_url}
                            className="w-full h-full object-cover"
                            playsInline
                            loop
                            muted={muted}
                            onClick={() => setMuted(!muted)}
                        />

                        {/* MUTE INDICATOR */}
                        <div className="absolute top-4 right-4 bg-black/50 p-2 rounded-full backdrop-blur-sm pointer-events-none">
                            {muted ? <VolumeX size={20} className="text-white" /> : <Volume2 size={20} className="text-white" />}
                        </div>

                        {/* OVERLAY CONTENT (Gradient) */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 pointer-events-none" />

                        {/* RIGHT ACTIONS BAR */}
                        <div className="absolute bottom-6 right-2 flex flex-col items-center gap-6 z-20">
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-10 h-10 rounded-full bg-neutral-800 border-2 border-white overflow-hidden mb-2 relative">
                                    <img src={post.profiles?.avatar_url} alt="User" className="w-full h-full object-cover" />
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 rounded-full p-0.5">
                                        <UserPlus size={10} className="text-white" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-1">
                                <button onClick={(e) => handleLike(post, e)} className="p-2 transition-transform active:scale-75">
                                    <Heart size={32} className={post.user_has_liked ? "text-red-500 fill-red-500" : "text-white drop-shadow-lg"} strokeWidth={1.5} />
                                </button>
                                <span className="text-white text-xs font-bold drop-shadow-md">{post.likes_count}</span>
                            </div>

                            <button className="flex flex-col items-center gap-1">
                                <MessageCircle size={30} className="text-white drop-shadow-lg" strokeWidth={1.5} />
                                <span className="text-white text-xs font-bold drop-shadow-md">0</span>
                            </button>

                            <button className="flex flex-col items-center gap-1">
                                <Share2 size={28} className="text-white drop-shadow-lg" strokeWidth={1.5} />
                                <span className="text-white text-xs font-bold drop-shadow-md">Share</span>
                            </button>

                            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/20 flex items-center justify-center animate-spin-slow mt-4">
                                <Music2 size={14} className="text-white" />
                            </div>
                        </div>

                        {/* BOTTOM INFO */}
                        <div className="absolute bottom-6 left-4 right-16 z-20 text-white text-left">
                            <h3 className="font-bold text-shadow-sm mb-2 flex items-center gap-2">
                                @{post.profiles?.username}
                                <span className="text-[10px] bg-white/20 px-1.5 rounded font-medium">Seguir</span>
                            </h3>

                            <p className="text-sm opacity-90 mb-3 line-clamp-2 leading-snug">
                                {post.caption}
                            </p>

                            {post.linked_routine_id && post.routines && (
                                <Link to="/arsenal" className="inline-flex items-center gap-2 bg-neutral-800/60 backdrop-blur-md px-3 py-1.5 rounded-lg border-l-2 border-yellow-500">
                                    <Swords size={12} className="text-yellow-500" />
                                    <span className="text-xs font-bold">{post.routines.name}</span>
                                </Link>
                            )}

                            <div className="flex items-center gap-2 mt-3 opacity-70">
                                <Music2 size={12} />
                                <span className="text-xs marquee">Sonido Original - {post.profiles?.username}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
