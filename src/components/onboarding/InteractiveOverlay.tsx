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
}

export const InteractiveOverlay = ({
    targetId,
    title,
    message,
    step,
    totalSteps,
    onNext,
    onClose,
    placement = 'bottom'
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

    // Portal to root to ensure z-index dominance
    return createPortal(
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* SVG MASK to create the "hole" effect */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                    <mask id="hole-mask">
                        <rect width="100%" height="100%" fill="white" />
                        <rect
                            x={targetRect.left - 4} // Padding
                            y={targetRect.top - 4}
                            width={targetRect.width + 8}
                            height={targetRect.height + 8}
                            rx="8" // Rounded corners
                            fill="black"
                        />
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.75)"
                    mask="url(#hole-mask)"
                />

                {/* Glowing Border around Target */}
                <rect
                    x={targetRect.left - 4}
                    y={targetRect.top - 4}
                    width={targetRect.width + 8}
                    height={targetRect.height + 8}
                    rx="8"
                    fill="transparent"
                    stroke="#EAB308" // yellow-500
                    strokeWidth="2"
                    className="animate-pulse"
                />
            </svg>

            {/* CLICK BLOCKER (Except on target) */}
            {/* We can't actually click "through" easily without pointer-events: none on the overlay.
                BUT we want to BLOCK clicks elsewhere.
                Strategy: The SVG mask handles visuals.
                We place distinct divs to block clicks outside the target area?
                OR we accept that clicks go through if we set pointer-events: none on the root?
                
                BETTER UX: Let the user click the BUTTON itself to proceed if that's the natural action.
                For this tutorial, "Next" might be implicit by clicking the target.
            */}

            {/* Tooltip Card */}
            <div
                className="absolute w-[90vw] max-w-sm bg-neutral-900 border border-yellow-500/50 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-300"
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

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={onNext}
                            className="bg-gym-primary text-black font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1 hover:bg-yellow-400 transition-colors"
                        >
                            <span>ENTENDIDO</span>
                            <ChevronRight size={14} strokeWidth={3} />
                        </button>
                    </div>
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
