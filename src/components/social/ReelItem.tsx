import React, { useRef, useEffect } from 'react';
import { Heart, MessageCircle, Music2, Share2, Swords, VolumeX } from 'lucide-react';
import type { Post } from '../../services/SocialService';

interface ReelItemProps {
    post: Post;
    muted: boolean;
    currentUserId?: string;
    onToggleMute: () => void;
    onLike: (post: Post) => void;
    onComment: (post: Post) => void;
    onShare: (post: Post) => void;
    onFollow: (post: Post) => void;
    onProfileClick: (userId: string) => void;
    onVideoRef: (id: string, el: HTMLVideoElement | null) => void;
    onLoop?: (id: string) => void;
}

const getRoutineName = (routines: any) => {
    if (Array.isArray(routines)) {
        return routines[0]?.name;
    }
    return routines?.name;
};

export const ReelItem: React.FC<ReelItemProps> = React.memo(({
    post,
    muted,
    currentUserId,
    onToggleMute,
    onLike,
    onComment,
    onShare,
    onFollow,
    onProfileClick,
    onVideoRef,
    onLoop
}) => {
    const internalVideoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Register ref securely
    useEffect(() => {
        if (internalVideoRef.current) {
            onVideoRef(post.virtual_id || post.id, internalVideoRef.current);
        }
    }, [post.id, post.virtual_id, onVideoRef]);

    const handleInternalLoop = () => {
        if (onLoop) onLoop(post.virtual_id || post.id);
    };

    const handleDoubleTap = (e: React.MouseEvent) => {
        e.stopPropagation();
        onLike(post);

        // Simple visual feedback
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

    return (
        <div
            ref={containerRef}
            className="snap-start relative h-full w-full bg-black overflow-hidden flex items-center justify-center border-b border-gray-900"
            id={`post-${post.virtual_id || post.id}`}
        >
            {/* VIDEO CONTAINER */}
            <div
                className="w-full h-full relative"
                onDoubleClick={handleDoubleTap}
            >
                <video
                    ref={internalVideoRef}
                    src={post.media_url}
                    className="w-full h-full object-cover"
                    playsInline
                    loop
                    preload="none"
                    muted={muted}
                    poster={post.media_url.includes('cloudinary') ? post.media_url.replace(/\.(mp4|mov|webm)$/i, '.jpg') : undefined}
                    onClick={onToggleMute}
                    onEnded={handleInternalLoop}
                />

                {/* MUTE INDICATOR */}
                <div className="absolute top-20 left-4 bg-black/50 p-1.5 rounded-full backdrop-blur-sm pointer-events-none opacity-0 transition-opacity duration-300 data-[muted=true]:opacity-100" data-muted={muted}>
                    {muted && <VolumeX size={14} className="text-white" />}
                </div>

                {/* OVERLAY CONTENT (Gradient) */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                {/* RIGHT ACTIONS BAR */}
                <div className="absolute bottom-16 right-1.5 flex flex-col items-center gap-4 z-20">
                    <div className="flex flex-col items-center gap-px">
                        <button onClick={(e) => { e.stopPropagation(); onLike(post); }} className="p-1.5 transition-transform active:scale-75">
                            <Heart size={28} className={post.user_has_liked ? "text-red-500 fill-red-500" : "text-white drop-shadow-lg"} strokeWidth={1.5} />
                        </button>
                        <span className="text-white text-[10px] font-bold drop-shadow-md">{post.likes_count || 0}</span>
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); onComment(post); }} className="flex flex-col items-center gap-px p-1.5 transition-transform active:scale-75">
                        <MessageCircle size={26} className="text-white drop-shadow-lg" strokeWidth={1.5} />
                        <span className="text-white text-[10px] font-bold drop-shadow-md">Chat</span>
                    </button>

                    <button onClick={(e) => { e.stopPropagation(); onShare(post); }} className="flex flex-col items-center gap-px p-1.5 transition-transform active:scale-75">
                        <Share2 size={24} className="text-white drop-shadow-lg" strokeWidth={1.5} />
                        <span className="text-white text-[10px] font-bold drop-shadow-md">Share</span>
                    </button>

                    <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/20 flex items-center justify-center animate-spin-slow mt-2">
                        <Music2 size={12} className="text-white" />
                    </div>
                </div>

                {/* BOTTOM INFO */}
                <div className="absolute bottom-16 left-2 right-14 z-20 text-white text-left pb-1">

                    {/* User Row */}
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onProfileClick(post.user_id) }}
                            className="w-8 h-8 rounded-full bg-neutral-800 border border-white overflow-hidden relative"
                        >
                            <img src={post.profiles?.avatar_url || 'https://i.pravatar.cc/150'} alt="User" className="w-full h-full object-cover" />
                        </button>

                        <div className="flex flex-col justify-center">
                            <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); onProfileClick(post.user_id) }} className="font-bold text-sm hover:underline shadow-black drop-shadow-md">
                                    {post.profiles?.username}
                                </button>
                                {currentUserId && currentUserId !== post.user_id && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onFollow(post) }}
                                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors font-semibold uppercase tracking-wide ${(post as any).is_following
                                            ? 'bg-transparent border-white/50 text-white/70'
                                            : 'bg-white/20 border-white text-white hover:bg-white hover:text-black'
                                            }`}
                                    >
                                        {(post as any).is_following ? 'Siguiendo' : 'Seguir'}
                                    </button>
                                )}
                            </div>
                            {/* Audio Line */}
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
                        <div className="inline-flex items-center gap-1.5 bg-neutral-800/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 mb-1">
                            <Swords size={10} className="text-yellow-500" />
                            <span className="text-[10px]">
                                {getRoutineName(post.routines) || 'Rutina Linkeada'}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}, (prev, next) => {
    return (
        prev.post.id === next.post.id &&
        prev.post.user_has_liked === next.post.user_has_liked &&
        prev.post.likes_count === next.post.likes_count &&
        (prev.post as any).is_following === (next.post as any).is_following &&
        prev.muted === next.muted &&
        prev.post.media_url === next.post.media_url &&
        prev.post.debug_score === next.post.debug_score
    );
});
