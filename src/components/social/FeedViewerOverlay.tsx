import React, { useRef, useEffect, useState } from 'react';
import { X, Heart, MessageCircle, Share2, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { Post } from '../../services/SocialService';
import { useAuth } from '../../context/AuthContext';
import { socialService } from '../../services/SocialService';

interface FeedViewerOverlayProps {
    initialPostId: string;
    posts: Post[];
    onClose: () => void;
}

export const FeedViewerOverlay: React.FC<FeedViewerOverlayProps> = ({ initialPostId, posts, onClose }) => {
    const { user } = useAuth();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [muted, setMuted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});

    // Find initial index
    useEffect(() => {
        const index = posts.findIndex(p => p.id === initialPostId);
        if (index !== -1) {
            setCurrentIndex(index);
            // Scroll to initial post
            setTimeout(() => {
                containerRef.current?.scrollTo({
                    top: index * window.innerHeight,
                    behavior: 'instant'
                });
            }, 100);
        }
    }, [initialPostId, posts]);

    // Handle Scroll for Auto-Play
    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current) return;
            const index = Math.round(containerRef.current.scrollTop / window.innerHeight);
            if (index !== currentIndex) {
                setCurrentIndex(index);
            }
        };

        const container = containerRef.current;
        container?.addEventListener('scroll', handleScroll);
        return () => container?.removeEventListener('scroll', handleScroll);
    }, [currentIndex]);

    // Play/Pause based on Active Index
    useEffect(() => {
        posts.forEach((post, index) => {
            const video = videoRefs.current[post.id];
            if (video) {
                if (index === currentIndex) {
                    video.currentTime = 0;
                    video.play().catch(err => console.log("Autoplay blocked:", err));
                } else {
                    video.pause();
                }
            }
        });
    }, [currentIndex, posts]);

    const handleLike = async (post: Post, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return;

        // Optimistic update (This relies on parent state updates if valid, but here local only for visual)
        // Ideally we update parent too, but for now visual feedback:
        // Note: Real state sync requires a callback or context, simplified here.
        await socialService.toggleLike(user.id, post.id);
    };

    return (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 bg-black/50 p-2 rounded-full text-white hover:bg-white/20 transition-colors"
            >
                <X size={24} />
            </button>

            {/* Vertical Scroll Container */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
                style={{ height: '100dvh' }}
            >
                {posts.map((post, index) => {
                    const isActive = index === currentIndex;
                    return (
                        <div
                            key={post.id}
                            className="w-full h-[100dvh] snap-start relative bg-neutral-900 flex items-center justify-center"
                        >
                            {post.type === 'video' ? (
                                <video
                                    ref={el => { if (el) videoRefs.current[post.id] = el }}
                                    src={post.media_url}
                                    className="w-full h-full object-cover"
                                    loop
                                    muted={muted}
                                    playsInline
                                    onError={(e) => {
                                        console.error("Video Error:", post.id, e);
                                        // Hide broken video or show badge
                                    }}
                                />
                            ) : (
                                <img
                                    src={post.media_url}
                                    alt="Post"
                                    className="w-full h-full object-contain bg-black"
                                />
                            )}

                            {/* Post Overlay Info */}
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pt-20">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden">
                                            {/* Avatar fallback if not available in post object, assume passed or generic */}
                                            <div className="w-full h-full bg-gym-primary flex items-center justify-center font-bold text-black text-xs">
                                                {post.username?.[0]}
                                            </div>
                                        </div>
                                        <span className="font-bold text-white text-sm">{post.username}</span>
                                    </div>
                                    <button onClick={() => setMuted(!muted)} className="p-2 text-white/80">
                                        {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                    </button>
                                </div>

                                <p className="text-white text-sm mb-4 line-clamp-2">{post.caption}</p>

                                {/* Actions Bar */}
                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={(e) => handleLike(post, e)}
                                        className={`flex flex-col items-center gap-1 ${post.user_has_liked ? 'text-red-500' : 'text-white'}`}
                                    >
                                        <Heart size={24} fill={post.user_has_liked ? "currentColor" : "none"} />
                                        <span className="text-xs font-bold">{post.likes_count}</span>
                                    </button>

                                    <button className="flex flex-col items-center gap-1 text-white">
                                        <MessageCircle size={24} />
                                        <span className="text-xs font-bold">{post.comments_count || 0}</span>
                                    </button>

                                    <button className="flex flex-col items-center gap-1 text-white">
                                        <Share2 size={24} />
                                        <span className="text-xs font-bold">Share</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
