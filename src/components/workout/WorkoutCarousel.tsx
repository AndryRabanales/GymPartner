import React, { useRef, useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface WorkoutCarouselProps {
    children: React.ReactNode[];
    currentIndex: number;
    onIndexChange: (index: number) => void;
}

type AnimState = 'idle' | 'dragging' | 'flying-left' | 'flying-right' | 'snapping';

export const WorkoutCarousel: React.FC<WorkoutCarouselProps> = ({ children, currentIndex, onIndexChange }) => {
    const [dragX, setDragX]       = useState(0);
    const [animState, setAnimState] = useState<AnimState>('idle');
    const [flyDuration, setFlyDuration] = useState(180);

    const containerRef      = useRef<HTMLDivElement>(null);
    const touchStartX       = useRef(0);
    const touchStartY       = useRef(0);
    const dragXRef          = useRef(0);
    const isHorizontal      = useRef<boolean | null>(null);
    // Last N pointer samples for real instantaneous velocity
    const recentMoves       = useRef<{ x: number; t: number }[]>([]);

    const peekIndex = dragXRef.current < 0
        ? Math.min(children.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);

    const flyOff = useCallback((direction: 'left' | 'right', durationMs = 180) => {
        const nextIndex = direction === 'left'
            ? Math.min(children.length - 1, currentIndex + 1)
            : Math.max(0, currentIndex - 1);

        if (nextIndex === currentIndex) {
            // Edge of deck — quick elastic return, no bounce
            setAnimState('snapping');
            setDragX(0);
            dragXRef.current = 0;
            setTimeout(() => setAnimState('idle'), 220);
            return;
        }

        setFlyDuration(durationMs);
        setAnimState(direction === 'left' ? 'flying-left' : 'flying-right');
        setTimeout(() => {
            setAnimState('idle');
            setDragX(0);
            dragXRef.current = 0;
            onIndexChange(nextIndex);
        }, durationMs + 20); // tiny buffer so transition finishes before re-render
    }, [currentIndex, children.length, onIndexChange]);

    const onTouchStart = (e: React.TouchEvent) => {
        if (animState !== 'idle') return;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        isHorizontal.current = null;
        recentMoves.current = [];
        setAnimState('dragging');
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (animState !== 'dragging') return;
        const dx = e.touches[0].clientX - touchStartX.current;
        const dy = e.touches[0].clientY - touchStartY.current;

        if (isHorizontal.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
            isHorizontal.current = Math.abs(dx) > Math.abs(dy);
        }
        if (!isHorizontal.current) return;
        e.preventDefault();

        // Rubber-band at edges
        let offset = dx;
        const atLeft  = currentIndex === 0 && dx > 0;
        const atRight = currentIndex === children.length - 1 && dx < 0;
        if (atLeft || atRight) offset = dx * 0.10;

        dragXRef.current = offset;
        setDragX(offset);

        // Keep last 6 frames for velocity calculation
        const now = Date.now();
        recentMoves.current.push({ x: offset, t: now });
        if (recentMoves.current.length > 6) recentMoves.current.shift();
    };

    const onTouchEnd = () => {
        if (animState !== 'dragging') { setAnimState('idle'); return; }
        if (!isHorizontal.current)   { setAnimState('idle'); return; }

        const width = containerRef.current?.offsetWidth || 375;

        // Real instantaneous velocity from last 2 samples (px/ms)
        const moves = recentMoves.current;
        let velocity = 0;
        if (moves.length >= 2) {
            const a = moves[moves.length - 2];
            const b = moves[moves.length - 1];
            const dt = Math.max(b.t - a.t, 1);
            velocity = Math.abs(b.x - a.x) / dt;
        }

        const threshold = width * 0.20; // 20% of card width

        // Fly duration: faster swipe → shorter exit. Clamp 80–200ms.
        const duration = Math.max(80, Math.min(200, Math.round(120 / Math.max(velocity, 0.4))));

        if (dragXRef.current < -threshold || (velocity > 0.25 && dragXRef.current < 0)) {
            flyOff('left', duration);
        } else if (dragXRef.current > threshold || (velocity > 0.25 && dragXRef.current > 0)) {
            flyOff('right', duration);
        } else {
            // No momentum — snap straight back, no animation
            setAnimState('idle');
            setDragX(0);
            dragXRef.current = 0;
        }
    };

    /* ── Styles ── */
    const width      = containerRef.current?.offsetWidth || 375;
    const rot        = (dragX / width) * 20; // up to ±20° while dragging
    const dragProgress = Math.min(Math.abs(dragX) / (width * 0.35), 1);

    // linear timing = card exits at the same speed it was being dragged
    const flyTransition = `transform ${flyDuration}ms linear, opacity ${Math.round(flyDuration * 0.7)}ms linear`;

    const topCardStyle = (): React.CSSProperties => {
        switch (animState) {
            case 'dragging':
                return { transform: `translateX(${dragX}px) rotate(${rot}deg)`, transition: 'none', zIndex: 10 };
            case 'flying-left':
                return { transform: 'translateX(-170%) rotate(-28deg) translateY(-10px)', opacity: 0, transition: flyTransition, zIndex: 10 };
            case 'flying-right':
                return { transform: 'translateX(170%) rotate(28deg) translateY(-10px)', opacity: 0, transition: flyTransition, zIndex: 10 };
            case 'snapping':
                return { transform: 'translateX(0) rotate(0deg)', transition: 'transform 200ms cubic-bezier(0.25,0.46,0.45,0.94)', zIndex: 10 };
            default:
                return { transform: 'translateX(0) rotate(0deg)', transition: 'none', zIndex: 10 };
        }
    };

    const peekCardStyle = (): React.CSSProperties => {
        const base  = 0.92;
        const baseY = 10;
        const flying = animState === 'flying-left' || animState === 'flying-right';
        const active = flying || (animState === 'dragging' && Math.abs(dragX) > 6);

        const scale = active ? base + (1 - base) * (flying ? 1 : dragProgress) : base;
        const ty    = active ? baseY * (1 - (flying ? 1 : dragProgress)) : baseY;

        return {
            transform: `scale(${scale}) translateY(${ty}px)`,
            transition: animState === 'dragging' ? 'none' : `transform ${flyDuration}ms linear`,
            zIndex: 9,
            opacity: active ? 1 : 0.55,
        };
    };

    const flying = animState === 'flying-left' || animState === 'flying-right';
    const showPeek = animState === 'dragging' || flying;
    const flyingPeekIndex = animState === 'flying-left'
        ? Math.min(children.length - 1, currentIndex + 1)
        : animState === 'flying-right'
        ? Math.max(0, currentIndex - 1)
        : peekIndex;
    const peekVisible = showPeek && flyingPeekIndex !== currentIndex;

    return (
        <div ref={containerRef} className="relative w-full h-full flex flex-col select-none">
            <div
                className="flex-1 relative"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* Card behind */}
                {peekVisible && (
                    <div className="absolute inset-0 rounded-2xl overflow-hidden" style={peekCardStyle()}>
                        <div className="h-full overflow-y-auto pb-20">{children[flyingPeekIndex]}</div>
                    </div>
                )}

                {/* Top card */}
                <div
                    className="absolute inset-0 rounded-2xl overflow-hidden will-change-transform"
                    style={topCardStyle()}
                >
                    {/* Tint while dragging */}
                    {animState === 'dragging' && Math.abs(dragX) > 8 && (
                        <div
                            className="absolute inset-0 pointer-events-none z-20 rounded-2xl"
                            style={{
                                background: dragX < 0
                                    ? 'linear-gradient(to left, rgba(239,68,68,0.15), transparent)'
                                    : 'linear-gradient(to right, rgba(250,204,21,0.12), transparent)',
                                opacity: dragProgress,
                            }}
                        />
                    )}
                    <div className="h-full overflow-y-auto pb-20">{children[currentIndex]}</div>
                </div>
            </div>

            {/* Nav */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4 pointer-events-none">
                <div className={`transition-opacity duration-200 ${currentIndex > 0 ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        className="bg-black/50 backdrop-blur-md p-2 rounded-full border border-white/10 pointer-events-auto active:scale-90 transition-transform"
                        onClick={() => animState === 'idle' && flyOff('right', 160)}
                    >
                        <ChevronLeft className="text-white" size={24} />
                    </button>
                </div>

                <div className="flex gap-2 items-center">
                    {children.map((_, idx) => (
                        <div
                            key={idx}
                            className={`rounded-full transition-all duration-200 ${
                                idx === currentIndex ? 'w-6 h-2 bg-gym-primary' : 'w-2 h-2 bg-white/20'
                            }`}
                        />
                    ))}
                </div>

                <div className={`transition-opacity duration-200 ${currentIndex < children.length - 1 ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        className="bg-gym-primary/90 text-black p-2 rounded-full shadow-[0_0_12px_rgba(250,204,21,0.4)] pointer-events-auto active:scale-90 transition-transform"
                        onClick={() => animState === 'idle' && flyOff('left', 160)}
                    >
                        <ChevronRight size={24} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
    );
};
