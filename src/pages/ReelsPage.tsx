import { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { socialService, type Post } from '../services/SocialService';
import { useAuth } from '../context/AuthContext';
import { CommentsSheet } from '../components/social/CommentsSheet';
import { PlayerProfileModal } from '../components/profile/PlayerProfileModal';
import { supabase } from '../lib/supabase';
import { ReelItem } from '../components/social/ReelItem';

export const ReelsPage = () => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [muted, setMuted] = useState(true);
    const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

    // Stable references for video elements
    const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});

    // Stable callback to register videos without re-rendering parent often
    const registerVideoRef = useCallback((id: string, el: HTMLVideoElement | null) => {
        if (el) {
            videoRefs.current[id] = el;
            // Observe video dynamically when it registers
            if (observerRef.current) {
                observerRef.current.observe(el);
            }
        } else {
            // Unobserve and clean up when video unmounts
            if (videoRefs.current[id] && observerRef.current) {
                observerRef.current.unobserve(videoRefs.current[id]);
            }
            delete videoRefs.current[id];
        }
    }, []);

    useEffect(() => {
        loadReels();
    }, []);

    const loadReels = async () => {
        setLoading(true);
        // [FIX] Read Client-Side Blacklist to prevent "Ghost Posts" on refresh
        const localBlacklist = JSON.parse(localStorage.getItem('seen_posts_blacklist') || '[]');

        const feed = await socialService.getGlobalFeed(user?.id, 'video', true);

        // Filter out locally seen posts immediately
        const filteredFeed = feed.filter(p => !localBlacklist.includes(p.id));

        // [NEW] Auto-Reset: If no videos left after filtering, clear blacklist and reload
        if (filteredFeed.length === 0 && feed.length > 0) {
            console.log('[Reels] All videos seen - Resetting feed with best content...');
            localStorage.removeItem('seen_posts_blacklist');
            // Reload without blacklist
            const freshFeed = feed;
            if (user) {
                const feedWithFollow = await Promise.all(freshFeed.map(async (post) => {
                    const isFollowing = await socialService.getFollowStatus(user.id, post.user_id);
                    return { ...post, is_following: isFollowing };
                }));
                setPosts(feedWithFollow as any);
            } else {
                setPosts(freshFeed);
            }
            setLoading(false);
            return;
        }

        if (user) {
            const feedWithFollow = await Promise.all(filteredFeed.map(async (post) => {
                const isFollowing = await socialService.getFollowStatus(user.id, post.user_id);
                return { ...post, is_following: isFollowing };
            }));
            setPosts(feedWithFollow as any);
        } else {
            setPosts(filteredFeed);
        }

        setLoading(false);
    };

    const viewStartTimes = useRef<{ [key: string]: number }>({});
    const loopCounters = useRef<{ [key: string]: number }>({});

    // Helper to log view (flushes pending session)
    const flushAnalytics = (id: string, video: HTMLVideoElement) => {
        const startTime = viewStartTimes.current[id];
        if (!startTime) return;

        const durationSeconds = (Date.now() - startTime) / 1000;

        // Strict "Instant Seen" Logic (> 0.1s)
        if (durationSeconds > 0.1) {
            const vidDuration = video.duration || 10;
            const percentage = Math.min(1.0, durationSeconds / vidDuration);
            const loops = loopCounters.current[id] || 0;
            const cleanId = id.split('_')[0]; // internal ID has suffix sometimes?

            // [FIX] Update Client-Side Blacklist IMMEDIATELY
            try {
                const currentBlacklist = JSON.parse(localStorage.getItem('seen_posts_blacklist') || '[]');
                if (!currentBlacklist.includes(cleanId)) {
                    currentBlacklist.push(cleanId);
                    // Keep list manageable (last 500)
                    if (currentBlacklist.length > 500) currentBlacklist.shift();
                    localStorage.setItem('seen_posts_blacklist', JSON.stringify(currentBlacklist));
                }
            } catch (e) { }

            console.log(`[Analytics] ${cleanId}: ${durationSeconds.toFixed(1)}s, ${loops} loops`);
            // Use keepalive if supported by service, otherwise standard intent
            socialService.logView(cleanId, user?.id || null, durationSeconds, percentage, loops);
        }

        delete viewStartTimes.current[id];
        delete loopCounters.current[id];
    };

    // Intersection Observer
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const video = entry.target as HTMLVideoElement;
                    const isVisible = entry.intersectionRatio >= 0.7;

                    // Find Post ID by reference equality
                    const currentId = Object.keys(videoRefs.current).find(key => videoRefs.current[key] === video);
                    if (!currentId) return;

                    if (isVisible) {
                        video.currentTime = 0;
                        video.play().catch(() => { });
                        video.preload = 'auto';

                        // Start tracking if not already tracking
                        if (!viewStartTimes.current[currentId]) {
                            viewStartTimes.current[currentId] = Date.now();
                            loopCounters.current[currentId] = 0;
                        }

                    } else {
                        video.pause();
                        flushAnalytics(currentId, video);
                    }
                });
            },
            { threshold: 0.7 }
        );

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
            // FLUSH ALL PENDING VIEWS ON UNMOUNT / REFRESH
            Object.keys(viewStartTimes.current).forEach((id) => {
                const video = videoRefs.current[id];
                if (video) flushAnalytics(id, video);
            });
        };
    }, []); // Observer created once on mount

    /* --- Handlers --- */

    const handleLike = useCallback(async (post: Post) => { // Removed 'e' as ReelItem handles stopPropagation
        if (!user) return alert("Inicia sesión para dar like ❤️");

        const isLiked = post.user_has_liked;
        const newCount = (post.likes_count || 0) + (isLiked ? -1 : 1);

        // Optimistic Update
        setPosts(prev => prev.map(p => p.id === post.id ? {
            ...p,
            user_has_liked: !isLiked,
            likes_count: newCount
        } : p));

        try {
            await socialService.toggleLike(user.id, post.id);
        } catch (error) {
            // Revert
            setPosts(prev => prev.map(p => p.id === post.id ? {
                ...p,
                user_has_liked: isLiked,
                likes_count: post.likes_count || 0
            } : p));
        }
    }, [user]);

    const handleFollow = useCallback(async (post: Post) => {
        if (!user) return alert("Inicia sesión para seguir.");
        if (post.user_id === user.id) return;

        const isFollowing = (post as any).is_following;
        setPosts(prev => prev.map(p => p.user_id === post.user_id ? { ...p, is_following: !isFollowing } : p));

        if (isFollowing) {
            await socialService.unfollowUser(user.id, post.user_id);
        } else {
            await socialService.followUser(user.id, post.user_id);
        }
    }, [user]);

    const handleOpenProfile = useCallback(async (userId: string) => {
        try {
            // 1. Fetch exact profile details
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, xp, custom_settings, featured_routine_id, home_gym:gyms(name)')
                .eq('id', userId)
                .single();

            if (!profile) return;

            // 2. Calculate Rank
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
            console.error(error);
        }
    }, []);

    const handleShare = useCallback(async (post: Post) => {
        try {
            await socialService.trackShare(user?.id || 'anon', post.id); // [NEW] Track algorithm metric

            if (navigator.share) {
                await navigator.share({
                    title: `GymPartner: ${post.profiles?.username}`,
                    text: post.caption,
                    url: window.location.href
                });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                alert('¡Link copiado!');
            }
        } catch (e) { console.log(e); }
    }, [user]);

    const handleSave = useCallback(async (post: Post) => {
        if (!user) return alert("Inicia sesión para guardar 🔖");

        // Optimistic Update
        const isSaved = post.user_has_saved;
        setPosts(prev => prev.map(p => p.id === post.id ? {
            ...p,
            user_has_saved: !isSaved,
            saves_count: (post.saves_count || 0) + (isSaved ? -1 : 1)
        } : p));

        await socialService.toggleSave(user.id, post.id);
    }, [user]);

    return (
        <div className="flex flex-col h-full bg-black relative">
            {/* Header / Top Bar (Optional, usually Reels are full screen) */}

            <div className="flex-1 h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide bg-black" id="reels-container">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-white space-y-4">
                        <Loader2 className="animate-spin text-blue-500" size={40} />
                        <p className="text-sm font-medium animate-pulse">Curating your customized feed...</p>
                    </div>
                ) : (
                    posts.map((post) => (
                        <ReelItem
                            key={(post as any).virtual_id || post.id}
                            post={post}
                            muted={muted}
                            currentUserId={user?.id}
                            onToggleMute={() => setMuted(!muted)}
                            onLike={handleLike}
                            onComment={(p) => setActiveCommentPostId(p.id)}
                            onShare={handleShare}
                            onSave={handleSave} // [NEW]
                            onFollow={handleFollow}
                            onProfileClick={handleOpenProfile}
                            onVideoRef={registerVideoRef}
                            onLoop={(id) => {
                                loopCounters.current[id] = (loopCounters.current[id] || 0) + 1;
                            }}
                        />
                    ))
                )}

                {/* Empty State */}
                {!loading && posts.length === 0 && (
                    <div className="h-full w-full flex flex-col items-center justify-center snap-center text-white">
                        <p className="font-bold text-xl mb-2">Sin Reels aún 🎬</p>
                        <p className="text-neutral-500 text-sm">Sé el primero en subir uno.</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {activeCommentPostId && (
                <CommentsSheet
                    postId={activeCommentPostId}
                    onClose={() => setActiveCommentPostId(null)}
                />
            )}

            {selectedPlayer && (
                <PlayerProfileModal
                    player={selectedPlayer}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}
        </div>
    );
};

export default ReelsPage;
