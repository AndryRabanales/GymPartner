import React, { useRef, useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface WorkoutCarouselProps {
    children: React.ReactNode[];
    currentIndex: number;
    onIndexChange: (index: number) => void;
}

type AnimState = 'idle' | 'dragging' | 'flying-left' | 'flying-right' | 'snapping';

export const WorkoutCarousel: React.FC<WorkoutCarouselProps> = ({ children, currentIndex, onIndexChange }) => {
    const [dragX, setDragX] = useState(0);
    const [animState, setAnimState] = useState<AnimState>('idle');

    const containerRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchStartTime = useRef(0);
    const dragXRef = useRef(0);
    const isHorizontal = useRef<boolean | null>(null);

    // Which card to show peeking behind during drag / fly
    const peekIndex = dragXRef.current < 0
        ? Math.min(children.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);

    const flyOff = useCallback((direction: 'left' | 'right') => {
        const nextIndex = direction === 'left'
            ? Math.min(children.length - 1, currentIndex + 1)
            : Math.max(0, currentIndex - 1);

        if (nextIndex === currentIndex) {
            setAnimState('snapping');
            setDragX(0);
            dragXRef.current = 0;
            setTimeout(() => setAnimState('idle'), 380);
            return;
        }

        setAnimState(direction === 'left' ? 'flying-left' : 'flying-right');
        setTimeout(() => {
            setAnimState('idle');
            setDragX(0);
            dragXRef.current = 0;
            onIndexChange(nextIndex);
        }, 290);
    }, [currentIndex, children.length, onIndexChange]);

    const onTouchStart = (e: React.TouchEvent) => {
        if (animState !== 'idle') return;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
        isHorizontal.current = null;
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
        if (atLeft || atRight) offset = dx * 0.12;

        dragXRef.current = offset;
        setDragX(offset);
    };

    const onTouchEnd = () => {
        if (animState !== 'dragging') {
            setAnimState('idle');
            return;
        }
        if (!isHorizontal.current) {
            setAnimState('idle');
            return;
        }

        const elapsed    = Math.max(Date.now() - touchStartTime.current, 1);
        const velocity   = Math.abs(dragXRef.current) / elapsed; // px/ms
        const width      = containerRef.current?.offsetWidth || 375;
        const threshold  = width * 0.28;

        if (dragXRef.current < -threshold || (velocity > 0.45 && dragXRef.current < -15)) {
            flyOff('left');
        } else if (dragXRef.current > threshold || (velocity > 0.45 && dragXRef.current > 15)) {
            flyOff('right');
        } else {
            setAnimState('snapping');
            setDragX(0);
            dragXRef.current = 0;
            setTimeout(() => setAnimState('idle'), 380);
        }
    };

    /* ── Card style helpers ── */
    const width = containerRef.current?.offsetWidth || 375;
    const rot   = (dragX / width) * 18; // max ±18deg tilt while dragging

    const topCardStyle = (): React.CSSProperties => {
        switch (animState) {
            case 'dragging':
                return { transform: `translateX(${dragX}px) rotate(${rot}deg)`, transition: 'none', zIndex: 10, opacity: 1 };
            case 'flying-left':
                // Throw: starts from drag position, accelerates off screen (easeIn). No deceleration.
                return { transform: 'translateX(-160%) rotate(-22deg)', opacity: 0, transition: 'transform 220ms cubic-bezier(0.4,0,1,1), opacity 180ms ease-in', zIndex: 10 };
            case 'flying-right':
                return { transform: 'translateX(160%) rotate(22deg)', opacity: 0, transition: 'transform 220ms cubic-bezier(0.4,0,1,1), opacity 180ms ease-in', zIndex: 10 };
            case 'snapping':
                // Smooth slide back — no bounce/spring
                return { transform: 'translateX(0) rotate(0deg)', transition: 'transform 300ms cubic-bezier(0.25,0.46,0.45,0.94)', zIndex: 10 };
            default: // idle
                return { transform: 'translateX(0) rotate(0deg)', transition: 'transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)', zIndex: 10 };
        }
    };

    // Progress 0→1 as drag approaches threshold
    const dragProgress = Math.min(Math.abs(dragX) / (width * 0.4), 1);

    const peekCardStyle = (): React.CSSProperties => {
        const baseScale = 0.91;
        const baseY     = 12;
        const isFlyingOrDragging = animState === 'flying-left' || animState === 'flying-right'
                                || (animState === 'dragging' && Math.abs(dragX) > 6);

        const scale = isFlyingOrDragging
            ? baseScale + (1 - baseScale) * (animState === 'dragging' ? dragProgress : 1)
            : baseScale;
        const ty = isFlyingOrDragging
            ? baseY * (1 - (animState === 'dragging' ? dragProgress : 1))
            : baseY;

        return {
            transform: `scale(${scale}) translateY(${ty}px)`,
            transition: animState === 'dragging' ? 'none' : 'transform 290ms cubic-bezier(0.25,0.46,0.45,0.94)',
            zIndex: 9,
            opacity: isFlyingOrDragging ? 1 : 0.6,
        };
    };

    const showPeek = animState === 'dragging' || animState === 'flying-left' || animState === 'flying-right';
    const flyingPeekIndex = animState === 'flying-left'
        ? Math.min(children.length - 1, currentIndex + 1)
        : animState === 'flying-right'
        ? Math.max(0, currentIndex - 1)
        : peekIndex;
    const peekVisible = showPeek && flyingPeekIndex !== currentIndex;

    return (
        <div ref={containerRef} className="relative w-full h-full flex flex-col select-none">
            {/* Card stack area */}
            <div
                className="flex-1 relative"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* Peek card — sits behind */}
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
                    {/* Directional tint overlay while dragging */}
                    {animState === 'dragging' && Math.abs(dragX) > 10 && (
                        <div
                            className="absolute inset-0 pointer-events-none z-20 rounded-2xl transition-opacity"
                            style={{
                                background: dragX < 0
                                    ? 'linear-gradient(to left, rgba(239,68,68,0.12), transparent)'
                                    : 'linear-gradient(to right, rgba(250,204,21,0.10), transparent)',
                                opacity: dragProgress,
                            }}
                        />
                    )}
                    <div className="h-full overflow-y-auto pb-20">{children[currentIndex]}</div>
                </div>
            </div>

            {/* Navigation */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4 pointer-events-none">
                <div className={`transition-opacity duration-200 ${currentIndex > 0 ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        className="bg-black/50 backdrop-blur-md p-2 rounded-full border border-white/10 pointer-events-auto active:scale-90 transition-transform"
                        onClick={() => animState === 'idle' && flyOff('right')}
                    >
                        <ChevronLeft className="text-white" size={24} />
                    </button>
                </div>

                <div className="flex gap-2 items-center">
                    {children.map((_, idx) => (
                        <div
                            key={idx}
                            className={`rounded-full transition-all duration-250 ${
                                idx === currentIndex ? 'w-6 h-2 bg-gym-primary' : 'w-2 h-2 bg-white/20'
                            }`}
                        />
                    ))}
                </div>

                <div className={`transition-opacity duration-200 ${currentIndex < children.length - 1 ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        className="bg-gym-primary/90 text-black p-2 rounded-full shadow-[0_0_12px_rgba(250,204,21,0.4)] pointer-events-auto active:scale-90 transition-transform"
                        onClick={() => animState === 'idle' && flyOff('left')}
                    >
                        <ChevronRight size={24} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
    );
};
