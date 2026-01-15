import { useRef, useState } from 'react';

interface SwipeHandlers {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    threshold?: number; // Minimum distance in pixels to trigger swipe
}

interface SwipeState {
    isDragging: boolean;
    deltaX: number;
    deltaY: number;
}

export const useSwipe = (handlers: SwipeHandlers) => {
    const { onSwipeLeft, onSwipeRight, threshold = 50 } = handlers;

    const [swipeState, setSwipeState] = useState<SwipeState>({
        isDragging: false,
        deltaX: 0,
        deltaY: 0
    });

    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchCurrentX = useRef(0);
    const touchCurrentY = useRef(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchCurrentX.current = e.touches[0].clientX;
        touchCurrentY.current = e.touches[0].clientY;

        setSwipeState({
            isDragging: true,
            deltaX: 0,
            deltaY: 0
        });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!swipeState.isDragging) return;

        touchCurrentX.current = e.touches[0].clientX;
        touchCurrentY.current = e.touches[0].clientY;

        const deltaX = touchCurrentX.current - touchStartX.current;
        const deltaY = touchCurrentY.current - touchStartY.current;

        setSwipeState({
            isDragging: true,
            deltaX,
            deltaY
        });
    };

    const handleTouchEnd = () => {
        if (!swipeState.isDragging) return;

        const deltaX = touchCurrentX.current - touchStartX.current;
        const deltaY = touchCurrentY.current - touchStartY.current;

        // Only trigger if horizontal swipe is dominant (prevent conflict with vertical scroll)
        const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);

        if (isHorizontalSwipe && Math.abs(deltaX) > threshold) {
            if (deltaX > 0 && onSwipeRight) {
                onSwipeRight();
            } else if (deltaX < 0 && onSwipeLeft) {
                onSwipeLeft();
            }
        }

        // Reset state
        setSwipeState({
            isDragging: false,
            deltaX: 0,
            deltaY: 0
        });
    };

    return {
        swipeState,
        handlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd
        }
    };
};
