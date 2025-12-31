import React, { useRef, useEffect, useState } from 'react';
import { X, Heart, MessageCircle, Share2, MoreHorizontal, Music2, Swords, Volume2, VolumeX } from 'lucide-react';
import type { Post } from '../../services/SocialService';
import { useAuth } from '../../context/AuthContext';
import { socialService } from '../../services/SocialService';
import { MediaCarousel } from './MediaCarousel';

import { CommentsSheet } from './CommentsSheet';

interface FeedViewerOverlayProps {
    initialPostId: string;
    posts: Post[];
    onClose: () => void;
    variant?: 'feed' | 'reel';
}

const SmartVideo: React.FC<{
    src: string;
    poster?: string;
    isActive: boolean;
    muted: boolean;
    onTogglePlay: (e: React.MouseEvent<HTMLVideoElement> | any) => void;
    contain?: boolean;
}> = ({ src, poster, isActive, muted, onTogglePlay, contain = false }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!videoRef.current) return;
        if (isActive) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => { });
        } else {
            videoRef.current.pause();
        }
    }, [isActive]);

    return (
        <div className="relative w-full h-full bg-neutral-900">
            {/* 1. Optimized Poster (Visible until video loads) */}
            <div
                className={`absolute inset-0 z-10 transition-opacity duration-500 ${isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
                {poster ? (
                    <img
                        src={poster}
                        className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}`}
                        alt="Loading..."
                    />
                ) : (
                    // Fallback skeleton if no poster
                    <div className="w-full h-full bg-neutral-800 animate-pulse flex items-center justify-center">
                        <Music2 className="text-neutral-700 w-12 h-12" />
                    </div>
                )}
            </div>

            {/* 2. Video Element */}
            <video
                ref={videoRef}
                src={src}
                className={`w-full h-full cursor-pointer ${contain ? 'object-contain' : 'object-cover'} relative z-0`}
                playsInline
                loop
                muted={muted}
                onLoadedData={() => setIsLoaded(true)}
                onClick={onTogglePlay}
            />
        </div>
    );
};

export const FeedViewerOverlay: React.FC<FeedViewerOverlayProps> = ({ initialPostId, posts, onClose, variant = 'feed' }) => {
    const { user } = useAuth();
    const [localPosts, setLocalPosts] = useState<Post[]>(posts);
    const [playingPostId, setPlayingPostId] = useState<string | null>(null);
    const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
    const [muted, setMuted] = useState(false);

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

    const handleLike = async (post: Post, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
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

    // --- REEL VARIANT RENDER ---
    if (variant === 'reel') {
        return (
            <div className="fixed inset-0 bg-black z-[60] flex flex-col animate-in slide-in-from-bottom duration-200">
                {/* Close Button (Floating) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md"
                >
                    <X size={24} />
                </button>

                {/* Vertical Snap Container */}
                <div
                    ref={containerRef}
                    className="h-full w-full bg-black overflow-y-scroll snap-y snap-mandatory custom-scrollbar"
                >
                    {localPosts.map((post) => (
                        <div
                            key={post.id}
                            ref={el => { if (el) itemRefs.current[post.id] = el }}
                            data-post-id={post.id}
                            className="h-full w-full relative snap-center flex items-center justify-center bg-black"
                        >
                            <div className="relative w-full h-full md:max-w-md md:h-[95vh] md:rounded-xl overflow-hidden bg-neutral-900">
                                {/* Video / Media */}
                                {post.media && post.media.length > 0 ? (
                                    <MediaCarousel media={post.media} isPlaying={playingPostId === post.id} />
                                ) : (
                                    <SmartVideo
                                        src={post.media_url}
                                        poster={post.thumbnail_url}
                                        isActive={playingPostId === post.id}
                                        muted={muted}
                                        onTogglePlay={togglePlayPause}
                                    />
                                )}

                                {/* Mute Toggle */}
                                <button
                                    className="absolute top-4 left-4 bg-black/50 p-2 rounded-full backdrop-blur-sm text-white z-30"
                                    onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
                                >
                                    {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                </button>

                                {/* Gradient Overlay */}
                                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

                                {/* RIGHT ACTIONS BAR */}
                                <div className="absolute bottom-6 right-2 flex flex-col items-center gap-5 z-40">
                                    <div className="flex flex-col items-center gap-1">
                                        <button
                                            onClick={(e) => handleLike(post, e)}
                                            onTouchEnd={(e) => e.stopPropagation()}
                                            className="p-2 transition-transform active:scale-75 cursor-pointer z-50"
                                        >
                                            <Heart size={30} className={post.user_has_liked ? "text-red-500 fill-red-500" : "text-white drop-shadow-lg"} strokeWidth={1.5} />
                                        </button>
                                        <span className="text-white text-xs font-bold drop-shadow-md">{post.likes_count}</span>
                                    </div>

                                    <button onClick={(e) => { e.stopPropagation(); setActiveCommentPostId(post.id); }} className="flex flex-col items-center gap-1 p-2 transition-transform active:scale-75">
                                        <MessageCircle size={28} className="text-white drop-shadow-lg" strokeWidth={1.5} />
                                        <span className="text-white text-xs font-bold drop-shadow-md">Chat</span>
                                    </button>

                                    <button onClick={(e) => { e.stopPropagation(); handleShare(post); }} className="flex flex-col items-center gap-1 p-2 transition-transform active:scale-75">
                                        <Share2 size={26} className="text-white drop-shadow-lg" strokeWidth={1.5} />
                                        <span className="text-white text-xs font-bold drop-shadow-md">Share</span>
                                    </button>

                                    <div className="w-9 h-9 rounded-full bg-neutral-800 border border-white/20 flex items-center justify-center animate-spin-slow mt-2">
                                        <Music2 size={14} className="text-white" />
                                    </div>
                                </div>

                                {/* BOTTOM INFO */}
                                <div className="absolute bottom-4 left-4 right-16 z-40 text-white text-left">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-9 h-9 rounded-full bg-neutral-800 border border-white overflow-hidden">
                                            {post.profiles?.avatar_url ? (
                                                <img src={post.profiles.avatar_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gym-primary flex items-center justify-center font-bold text-black text-xs">
                                                    {post.profiles?.username?.[0] || '?'}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <span className="font-bold text-sm shadow-black drop-shadow-md block">
                                                {post.profiles?.username}
                                            </span>
                                            {post.linked_routine_id && (
                                                <div className="flex items-center gap-1 text-[10px] text-yellow-400 font-bold">
                                                    <Swords size={10} />
                                                    <span>Rutina vinculada</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Caption */}
                                    <p className="text-sm opacity-95 mb-2 line-clamp-2 leading-snug drop-shadow-sm font-light">
                                        {post.caption}
                                    </p>

                                    {/* Audio Line */}
                                    <div className="flex items-center gap-2 opacity-80">
                                        <Music2 size={12} />
                                        <span className="text-xs marquee line-clamp-1">Sonido Original - {post.profiles?.username}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
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
    }

    // --- DEFAULT (FEED/CARD) VARIANT RENDER ---
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
                                        <div className="w-full h-full flex items-center justify-center bg-black">
                                            <SmartVideo
                                                src={post.media_url}
                                                poster={post.thumbnail_url}
                                                isActive={playingPostId === post.id}
                                                muted={true}
                                                onTogglePlay={togglePlayPause}
                                                contain={true}
                                            />
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
                                        onClick={(e) => handleLike(post, e)}
                                        onTouchEnd={(e) => e.stopPropagation()}
                                        className="transition-transform active:scale-95 cursor-pointer"
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
