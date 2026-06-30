import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface WorkoutCarouselProps {
    children: React.ReactNode[];
    currentIndex: number;
    onIndexChange: (index: number) => void;
}

export const WorkoutCarousel: React.FC<WorkoutCarouselProps> = ({ children, currentIndex, onIndexChange }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchStartTime = useRef(0);
    const dragOffset = useRef(0);
    const isDragging = useRef(false);
    const isHorizontal = useRef<boolean | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const goTo = useCallback((index: number) => {
        const clamped = Math.max(0, Math.min(children.length - 1, index));
        if (clamped !== currentIndex) {
            setIsAnimating(true);
            onIndexChange(clamped);
        }
    }, [currentIndex, children.length, onIndexChange]);

    // Apply drag transform without transition
    const applyDrag = useCallback((offset: number) => {
        if (!trackRef.current) return;
        const pct = (currentIndex * 100) - (offset / trackRef.current.offsetWidth * 100);
        trackRef.current.style.transition = 'none';
        trackRef.current.style.transform = `translateX(-${pct}%)`;
    }, [currentIndex]);

    // Snap back or advance with transition
    const snapTo = useCallback((index: number) => {
        if (!trackRef.current) return;
        trackRef.current.style.transition = 'transform 320ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        trackRef.current.style.transform = `translateX(-${index * 100}%)`;
    }, []);

    // Sync track position when currentIndex changes (from external nav)
    useEffect(() => {
        if (!isDragging.current) {
            snapTo(currentIndex);
            const t = setTimeout(() => setIsAnimating(false), 350);
            return () => clearTimeout(t);
        }
    }, [currentIndex, snapTo]);

    const onTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
        dragOffset.current = 0;
        isDragging.current = true;
        isHorizontal.current = null;
        if (trackRef.current) {
            trackRef.current.style.transition = 'none';
        }
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current) return;
        const dx = e.touches[0].clientX - touchStartX.current;
        const dy = e.touches[0].clientY - touchStartY.current;

        // Determine scroll direction on first significant move
        if (isHorizontal.current === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
            isHorizontal.current = Math.abs(dx) > Math.abs(dy);
        }

        if (!isHorizontal.current) return; // vertical scroll — let it pass through
        e.preventDefault();

        // Resist at edges
        let offset = dx;
        if ((currentIndex === 0 && dx > 0) || (currentIndex === children.length - 1 && dx < 0)) {
            offset = dx * 0.2; // rubber band
        }
        dragOffset.current = offset;
        applyDrag(offset);
    };

    const onTouchEnd = () => {
        if (!isDragging.current || !isHorizontal.current) {
            isDragging.current = false;
            isHorizontal.current = null;
            return;
        }
        isDragging.current = false;
        isHorizontal.current = null;

        const elapsed = Date.now() - touchStartTime.current;
        const velocity = Math.abs(dragOffset.current) / elapsed; // px/ms
        const containerWidth = trackRef.current?.offsetWidth || 1;
        const threshold = containerWidth * 0.25; // 25% of width

        let nextIndex = currentIndex;
        if (dragOffset.current < -threshold || (velocity > 0.4 && dragOffset.current < -10)) {
            nextIndex = Math.min(children.length - 1, currentIndex + 1);
        } else if (dragOffset.current > threshold || (velocity > 0.4 && dragOffset.current > 10)) {
            nextIndex = Math.max(0, currentIndex - 1);
        }

        snapTo(nextIndex);
        if (nextIndex !== currentIndex) {
            setIsAnimating(true);
            onIndexChange(nextIndex);
        }
        dragOffset.current = 0;
    };

    return (
        <div className="relative w-full h-full flex flex-col overflow-hidden">
            {/* Slide track */}
            <div
                ref={trackRef}
                className="flex-1 flex will-change-transform"
                style={{
                    transform: `translateX(-${currentIndex * 100}%)`,
                    transition: 'transform 320ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    touchAction: 'pan-y',
                }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {children.map((child, index) => (
                    <div
                        key={index}
                        className="w-full flex-shrink-0 h-full overflow-y-auto pb-20"
                        style={{ minWidth: '100%' }}
                    >
                        {child}
                    </div>
                ))}
            </div>

            {/* Navigation */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4 pointer-events-none">
                {/* Prev */}
                <div className={`transition-opacity duration-200 ${currentIndex > 0 ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        className="bg-black/50 backdrop-blur-md p-2 rounded-full border border-white/10 pointer-events-auto"
                        onClick={() => !isAnimating && goTo(currentIndex - 1)}
                    >
                        <ChevronLeft className="text-white" size={24} />
                    </button>
                </div>

                {/* Dots */}
                <div className="flex gap-2 items-center">
                    {children.map((_, idx) => (
                        <div
                            key={idx}
                            className={`rounded-full transition-all duration-250 ${
                                idx === currentIndex
                                    ? 'w-6 h-2 bg-gym-primary'
                                    : 'w-2 h-2 bg-white/20'
                            }`}
                        />
                    ))}
                </div>

                {/* Next */}
                <div className={`transition-opacity duration-200 ${currentIndex < children.length - 1 ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        className="bg-gym-primary/90 text-black p-2 rounded-full shadow-[0_0_12px_rgba(250,204,21,0.4)] pointer-events-auto"
                        onClick={() => !isAnimating && goTo(currentIndex + 1)}
                    >
                        <ChevronRight size={24} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
    );
};
