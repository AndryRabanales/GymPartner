import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';

interface InteractiveOverlayProps {
    targetId: string;
    title: string;
    message: string;
    step: number;
    totalSteps: number;
    onNext: () => void;
    onClose: () => void;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    disableNext?: boolean;
}

export const InteractiveOverlay = ({
    targetId,
    title,
    message,
    step,
    totalSteps,
    onNext,
    onClose,
    placement = 'bottom',
    disableNext = false
}: InteractiveOverlayProps) => {
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);

    // Find and track target element
    useEffect(() => {
        const updateRect = () => {
            const element = document.getElementById(targetId);
            if (element) {
                const rect = element.getBoundingClientRect();
                setTargetRect(rect);
            }
        };

        // Initial check
        updateRect();

        // Poll for element in case it's rendering
        const interval = setInterval(updateRect, 500);

        // Resize observer for responsiveness
        observerRef.current = new ResizeObserver(updateRect);
        observerRef.current.observe(document.body);

        window.addEventListener('scroll', updateRect, true);
        window.addEventListener('resize', updateRect);

        return () => {
            clearInterval(interval);
            window.removeEventListener('scroll', updateRect, true);
            window.removeEventListener('resize', updateRect);
            if (observerRef.current) observerRef.current.disconnect();
        };
    }, [targetId]);

    if (!targetRect) return null;

    // Calculate position for tooltip
    // Default 12px offset
    let tooltipStyle: React.CSSProperties = {};
    const offset = 16;

    // Simplistic positioning logic
    if (placement === 'bottom') {
        tooltipStyle = {
            top: targetRect.bottom + offset,
            left: targetRect.left + (targetRect.width / 2),
            transform: 'translateX(-50%)'
        };
    } else if (placement === 'top') {
        tooltipStyle = {
            bottom: window.innerHeight - targetRect.top + offset,
            left: targetRect.left + (targetRect.width / 2),
            transform: 'translateX(-50%)'
        };
    }

    // Calculate dimensions for the 4 blocking divs
    // We cover the entire screen EXCEPT the target rect
    const { top, left, width, height, bottom, right } = targetRect;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    return createPortal(
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* 4 BLOCKING DIVS - These block clicks outside the target */}
            {/* TOP */}
            <div
                className="absolute bg-black/80 backdrop-blur-[1px] transition-all duration-300"
                style={{ top: 0, left: 0, right: 0, height: top - 4 }}
            />
            {/* BOTTOM */}
            <div
                className="absolute bg-black/80 backdrop-blur-[1px] transition-all duration-300"
                style={{ top: bottom + 4, left: 0, right: 0, bottom: 0 }}
            />
            {/* LEFT */}
            <div
                className="absolute bg-black/80 backdrop-blur-[1px] transition-all duration-300"
                style={{ top: top - 4, left: 0, width: left - 4, height: height + 8 }}
            />
            {/* RIGHT */}
            <div
                className="absolute bg-black/80 backdrop-blur-[1px] transition-all duration-300"
                style={{ top: top - 4, left: right + 4, right: 0, height: height + 8 }}
            />

            {/* HIGHLIGHT BORDER + ANIMATION */}
            <div
                className="absolute pointer-events-none z-[110]"
                style={{
                    top: top - 4,
                    left: left - 4,
                    width: width + 8,
                    height: height + 8,
                    borderRadius: 12
                }}
            >
                {/* Ping Animation Ring */}
                <div className="absolute inset-0 border-2 border-yellow-500 rounded-xl animate-ping opacity-75" />
                {/* Solid Border */}
                <div className="absolute inset-0 border-2 border-yellow-500 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.5)]" />
            </div>

            {/* Tooltip Card */}
            <div
                className="absolute w-[90vw] max-w-sm bg-neutral-900 border border-yellow-500/50 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-300 z-[120]"
                style={tooltipStyle}
            >
                {/* Close X */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-neutral-500 hover:text-white p-1"
                >
                    <X size={16} />
                </button>

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="bg-yellow-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">
                            PASO {step}/{totalSteps}
                        </span>
                        <h3 className="text-white font-bold italic uppercase tracking-tight text-lg">
                            {title}
                        </h3>
                    </div>

                    <p className="text-neutral-300 text-sm leading-relaxed">
                        {message}
                    </p>

                    {!disableNext && (
                        <div className="flex justify-end pt-2">
                            <button
                                onClick={onNext}
                                className="bg-gym-primary text-black font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1 hover:bg-yellow-400 transition-colors"
                            >
                                <span>ENTENDIDO</span>
                                <ChevronRight size={14} strokeWidth={3} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Arrow Pointer */}
                <div
                    className={`absolute w-3 h-3 bg-neutral-900 border-l border-t border-yellow-500/50 transform rotate-45 ${placement === 'bottom' ? '-top-1.5 left-1/2 -translate-x-1/2' : '-bottom-1.5 left-1/2 -translate-x-1/2 rotate-[225deg]'}`}
                ></div>
            </div>
        </div>,
        document.body
    );
};
