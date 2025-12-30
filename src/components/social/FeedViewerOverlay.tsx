import React, { useRef, useEffect, useState } from 'react';
import { X, Heart, MessageCircle, Share2, MoreHorizontal, Music2, Swords } from 'lucide-react';
import type { Post } from '../../services/SocialService';
import { useAuth } from '../../context/AuthContext';
import { socialService } from '../../services/SocialService';
import { MediaCarousel } from './MediaCarousel';

import { CommentsSheet } from './CommentsSheet';

interface FeedViewerOverlayProps {
    initialPostId: string;
    posts: Post[];
    onClose: () => void;
}

export const FeedViewerOverlay: React.FC<FeedViewerOverlayProps> = ({ initialPostId, posts, onClose }) => {
    const { user } = useAuth();
    const [localPosts, setLocalPosts] = useState<Post[]>(posts);
    const [playingPostId, setPlayingPostId] = useState<string | null>(null);
    const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<{ [key: string]: HTMLDivElement }>({});

    // Update local posts if prop changes (rare in this modal context but good practice)
    useEffect(() => {
        setLocalPosts(posts);
    }, [posts]);

    // Scroll to initial post
    useEffect(() => {
        if (initialPostId && itemRefs.current[initialPostId]) {
            setTimeout(() => {
                itemRefs.current[initialPostId]?.scrollIntoView({ behavior: 'auto', block: 'center' });
            }, 100);
        }
    }, [initialPostId]);

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
            { threshold: [0.5, 0.7], root: containerRef.current }
        );

        Object.values(itemRefs.current).forEach((el) => {
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [localPosts]);

    const handleShare = async (post: Post) => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: `GymPartner: ${post.profiles?.username}`,
                    text: post.caption || 'Checa este post en GymPartner',
                    url: window.location.href
                });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                alert('Link copiado al portapapeles 📋');
            }
        } catch (error) { console.log(error); }
    };

    const handleLike = async (post: Post) => {
        if (!user) return;

        // Optimistic Update
        const isLiked = post.user_has_liked;
        const newCount = (post.likes_count || 0) + (isLiked ? -1 : 1);

        setLocalPosts(prev => prev.map(p => p.id === post.id ? {
            ...p,
            user_has_liked: !isLiked,
            likes_count: newCount
        } : p));

        await socialService.toggleLike(user.id, post.id);
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
        <div className="fixed inset-0 bg-black z-[60] flex flex-col animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-black/90 backdrop-blur z-20 sticky top-0">
                <div className="w-8"></div> {/* Spacer */}
                <span className="text-white font-bold text-sm uppercase tracking-widest">Publicaciones</span>
                <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-800 text-white hover:bg-neutral-700"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Scrollable Feed */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto bg-black pb-20 custom-scrollbar"
            >
                <div className="max-w-md mx-auto pt-4">
                    {localPosts.map((post) => (
                        <div
                            key={post.id}
                            ref={el => { if (el) itemRefs.current[post.id] = el }}
                            data-post-id={post.id}
                            className="border-b border-white/5 pb-6 mb-6 last:border-0"
                        >
                            {/* Post Header */}
                            <div className="flex items-center justify-between px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden border border-white/10">
                                        {post.profiles?.avatar_url ? (
                                            <img
                                                src={post.profiles.avatar_url}
                                                alt={post.profiles.username}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gym-primary flex items-center justify-center font-bold text-black text-xs">
                                                {post.profiles?.username?.[0] || '?'}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold text-sm text-white">
                                                {post.profiles?.username || 'Usuario'}
                                            </span>
                                        </div>
                                        {post.linked_routine_id && (
                                            <div className="flex items-center gap-1 text-[10px] text-yellow-500">
                                                <Swords size={10} />
                                                <span>Rutina vinculada</span>
                                            </div>
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
                            <div className="px-3 py-3">
                                <div className="flex items-center gap-4 mb-3">
                                    <button
                                        onClick={() => handleLike(post)}
                                        className="transition-transform active:scale-95"
                                    >
                                        <Heart
                                            size={24}
                                            className={post.user_has_liked ? "text-red-500 fill-red-500" : "text-white"}
                                        />
                                    </button>
                                    <button
                                        onClick={() => setActiveCommentPostId(post.id)}
                                        className="text-white hover:text-neutral-300 transition-transform active:scale-95"
                                    >
                                        <MessageCircle size={24} />
                                    </button>
                                    <button
                                        onClick={() => handleShare(post)}
                                        className="text-white hover:text-neutral-300 ml-auto transition-transform active:scale-95"
                                    >
                                        <Share2 size={24} />
                                    </button>
                                </div>

                                {/* Likes Count */}
                                <div className="mb-2">
                                    <span className="font-bold text-sm text-white">{post.likes_count} Me gusta</span>
                                </div>

                                {/* Caption */}
                                <div>
                                    <span className="font-bold text-white mr-2 text-sm">{post.profiles?.username}</span>
                                    <span className="text-sm text-white/90">{post.caption}</span>
                                </div>
                                <div className="mt-1">
                                    <button
                                        onClick={() => setActiveCommentPostId(post.id)}
                                        className="text-neutral-500 text-xs hover:text-neutral-300"
                                    >
                                        Ver los comentarios
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* COMMENTS SHEET OVERLAY */}
            {activeCommentPostId && (
                <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setActiveCommentPostId(null)}>
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
