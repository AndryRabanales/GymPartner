import { useEffect, useState, useRef } from 'react';
import { Heart, MessageCircle, Share2, Music2, Swords, Volume2, VolumeX } from 'lucide-react';
import { socialService, type Post } from '../services/SocialService';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { CommentsSheet } from '../components/social/CommentsSheet';
import { PlayerProfileModal } from '../components/profile/PlayerProfileModal';
import { supabase } from '../lib/supabase';

const getRoutineName = (routines: any) => {
    if (Array.isArray(routines)) {
        return routines[0]?.name;
    }
    return routines?.name;
};

export const ReelsPage = () => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [muted, setMuted] = useState(true);
    const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

    const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});

    useEffect(() => {
        loadReels();
    }, []);

    const loadReels = async () => {
        setLoading(true);
        // Fetch ONLY videos. Enable 'flatten' to show multi-video posts as separate Items.
        const feed = await socialService.getGlobalFeed(user?.id, 'video', true);

        // Check follow status for each creator in the feed
        if (user) {
            const feedWithFollow = await Promise.all(feed.map(async (post) => {
                const isFollowing = await socialService.getFollowStatus(user.id, post.user_id);
                return { ...post, is_following: isFollowing };
            }));
            setPosts(feedWithFollow as any);
        } else {
            setPosts(feed);
        }

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

    const handleFollow = async (post: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return alert("Inicia sesión para seguir a este atleta.");
        if (post.user_id === user.id) return; // Can't follow self

        const isFollowing = post.is_following;

        // Optimistic Update
        setPosts(prev => prev.map(p => p.user_id === post.user_id ? { ...p, is_following: !isFollowing } : p));

        if (isFollowing) {
            await socialService.unfollowUser(user.id, post.user_id);
        } else {
            await socialService.followUser(user.id, post.user_id);
        }
    };

    const handleShare = async (post: Post) => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: `GymPartner: ${post.profiles?.username}`,
                    text: post.caption || 'Mira este entrenamiento épico en GymPartner 💪',
                    url: window.location.href // Ideally, deep link to specific post
                });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                alert('Enlace copiado al portapapeles 📋');
            }
        } catch (error) {
            console.log('Error sharing:', error);
        }
    };

    const handleDoubleTap = (post: Post, e: React.MouseEvent) => {
        e.stopPropagation();

        // Show Heart Animation logic would go here (requires new state tracking coordinates)
        // For MVP Speed: trigger like immediately and maybe a visual feedback container
        handleLike(post, e);

        // Visual Feedback (Temporary)
        const heart = document.createElement('div');
        heart.innerHTML = '❤️';
        heart.style.position = 'absolute';
        heart.style.left = `${e.clientX}px`;
        heart.style.top = `${e.clientY}px`;
        heart.style.fontSize = '100px';
        heart.style.transform = 'translate(-50%, -50%) scale(0)';
        heart.style.transition = 'all 0.5s ease-out';
        heart.style.pointerEvents = 'none';
        heart.style.zIndex = '100';
        document.body.appendChild(heart);

        requestAnimationFrame(() => {
            heart.style.transform = 'translate(-50%, -50%) scale(1.5) rotate(-15deg)';
            heart.style.opacity = '0';
        });

        setTimeout(() => heart.remove(), 1000);
    };

    const handleOpenProfile = async (userId: string) => {
        try {
            // 1. Fetch exact profile details
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, xp, custom_settings, featured_routine_id, home_gym:gyms(name)')
                .eq('id', userId)
                .single();

            if (!profile) return;

            // 2. Calculate Rank (Heavy-ish but necessary for consistent UI)
            const { count } = await supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .gt('xp', profile.xp || 0);

            const rank = (count || 0) + 1;

            const player = {
                id: profile.id,
                username: profile.username || 'Usuario',
                avatar_url: profile.avatar_url,
                xp: profile.xp || 0,
                rank: rank,
                gym_name: Array.isArray(profile.home_gym) ? profile.home_gym[0]?.name : (profile.home_gym as any)?.name,
                banner_url: profile.custom_settings?.banner_url,
                featured_routine_id: profile.featured_routine_id
            };

            setSelectedPlayer(player);

        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    return (
        <div className="h-full bg-black overflow-y-scroll snap-y snap-mandatory custom-scrollbar relative">

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
                <div key={(post as any).virtual_id || post.id} className="h-full w-full max-w-md mx-auto relative snap-center flex items-center justify-center bg-black border-b border-neutral-800 md:border-none">

                    {/* VIDEO CONTAINER */}
                    <div
                        className="relative w-[98%] h-[92%] mb-14 md:w-full md:h-full md:max-h-[85vh] md:mb-0 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-black"
                        onDoubleClick={(e) => handleDoubleTap(post, e)}
                    >
                        <video
                            ref={el => { if (el) (videoRefs.current as any)[(post as any).virtual_id || post.id] = el }}
                            src={post.media_url}
                            className="w-full h-full object-cover"
                            playsInline
                            loop
                            muted={muted}
                            poster={post.media_url.includes('cloudinary') ? post.media_url.replace(/\.(mp4|mov|webm)$/i, '.jpg') : undefined}
                            onClick={() => setMuted(!muted)}
                        />

                        {/* MUTE INDICATOR */}
                        <div className="absolute top-3 right-3 bg-black/50 p-1.5 rounded-full backdrop-blur-sm pointer-events-none">
                            {muted ? <VolumeX size={14} className="text-white" /> : <Volume2 size={14} className="text-white" />}
                        </div>

                        {/* OVERLAY CONTENT (Gradient) */}
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                        {/* RIGHT ACTIONS BAR */}
                        <div className="absolute bottom-4 right-1.5 flex flex-col items-center gap-4 z-20">

                            <div className="flex flex-col items-center gap-px">
                                <button onClick={(e) => { e.stopPropagation(); handleLike(post, e); }} className="p-1.5 transition-transform active:scale-75">
                                    <Heart size={28} className={post.user_has_liked ? "text-red-500 fill-red-500" : "text-white drop-shadow-lg"} strokeWidth={1.5} />
                                </button>
                                <span className="text-white text-[10px] font-bold drop-shadow-md">{post.likes_count}</span>
                            </div>

                            <button onClick={(e) => { e.stopPropagation(); setActiveCommentPostId(post.id); }} className="flex flex-col items-center gap-px p-1.5 transition-transform active:scale-75">
                                <MessageCircle size={26} className="text-white drop-shadow-lg" strokeWidth={1.5} />
                                <span className="text-white text-[10px] font-bold drop-shadow-md">Chat</span>
                            </button>

                            <button onClick={(e) => { e.stopPropagation(); handleShare(post); }} className="flex flex-col items-center gap-px p-1.5 transition-transform active:scale-75">
                                <Share2 size={24} className="text-white drop-shadow-lg" strokeWidth={1.5} />
                                <span className="text-white text-[10px] font-bold drop-shadow-md">Share</span>
                            </button>

                            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/20 flex items-center justify-center animate-spin-slow mt-2">
                                <Music2 size={12} className="text-white" />
                            </div>
                        </div>

                        {/* BOTTOM INFO (Instagram Style) */}
                        <div className="absolute bottom-2 left-2 right-14 z-20 text-white text-left pb-1">

                            {/* User Row */}
                            <div className="flex items-center gap-2 mb-2">
                                <button
                                    onClick={() => handleOpenProfile(post.user_id)}
                                    className="w-8 h-8 rounded-full bg-neutral-800 border border-white overflow-hidden relative"
                                >
                                    <img src={post.profiles?.avatar_url || 'https://i.pravatar.cc/150'} alt="User" className="w-full h-full object-cover" />
                                </button>

                                <div className="flex flex-col justify-center">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleOpenProfile(post.user_id)} className="font-bold text-sm hover:underline shadow-black drop-shadow-md">
                                            {post.profiles?.username}
                                        </button>
                                        {user?.id !== post.user_id && (
                                            <button
                                                onClick={(e) => handleFollow(post, e)}
                                                className={`text-[10px] px-2 py-0.5 rounded border transition-colors font-semibold uppercase tracking-wide ${(post as any).is_following
                                                    ? 'bg-transparent border-white/50 text-white/70'
                                                    : 'bg-white/20 border-white text-white hover:bg-white hover:text-black'
                                                    }`}
                                            >
                                                {(post as any).is_following ? 'Siguiendo' : 'Seguir'}
                                            </button>
                                        )}
                                    </div>
                                    {/* Audio Line (under name like Insta) */}
                                    <div className="flex items-center gap-1 opacity-90">
                                        <Music2 size={10} />
                                        <span className="text-[10px] marquee line-clamp-1">{post.caption ? 'Sonido Original' : 'Audio Original'} - {post.profiles?.username}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Caption */}
                            <p className="text-xs opacity-95 mb-2 line-clamp-2 leading-tight pr-2 drop-shadow-sm font-light">
                                <span className="font-semibold mr-1">{post.profiles?.username}</span>
                                {post.caption}
                            </p>

                            {/* Routine Link */}
                            {post.linked_routine_id && post.routines && (
                                <Link to="/arsenal" className="inline-flex items-center gap-1.5 bg-neutral-800/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 mb-1">
                                    <Swords size={10} className="text-yellow-500" />
                                    <span className="text-[10px]">
                                        {getRoutineName(post.routines) || 'Rutina Linkeada'}
                                    </span>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {
                activeCommentPostId && (
                    <CommentsSheet
                        postId={activeCommentPostId}
                        onClose={() => setActiveCommentPostId(null)}
                    />
                )
            }

            {
                selectedPlayer && (
                    <PlayerProfileModal
                        player={selectedPlayer}
                        onClose={() => setSelectedPlayer(null)}
                    />
                )
            }

        </div >
    );
};
