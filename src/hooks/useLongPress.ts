import { useRef, useCallback } from 'react';

export const useLongPress = (
    onLongPress: (e: any) => void,
    onClick?: (e: any) => void,
    ms = 600
) => {
    const timerRef = useRef<any>(null);
    const isLongPressActive = useRef(false);

    const start = useCallback((e: any) => {
        // Stop default context menu triggers on mobile
        isLongPressActive.current = false;
        
        // Prevent trigger on right-clicks
        if (e.button && e.button !== 0) return;

        timerRef.current = setTimeout(() => {
            isLongPressActive.current = true;
            onLongPress(e);
        }, ms);
    }, [onLongPress, ms]);

    const stop = useCallback((e: any) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        if (!isLongPressActive.current && onClick) {
            onClick(e);
        }
    }, [onClick]);

    return {
        onMouseDown: start,
        onMouseUp: stop,
        onMouseLeave: stop,
        onTouchStart: start,
        onTouchEnd: stop,
    };
};
