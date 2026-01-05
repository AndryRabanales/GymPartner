import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';

interface InteractiveOverlayProps {
    targetId: string;
    title: string;
    message: string;
    step: number;
    totalSteps: number;
    onNext?: () => void;
    onClose: () => void;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    disableNext?: boolean;
    nextLabel?: string;
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
    disableNext = false,
    nextLabel = "ENTENDIDO"
}: InteractiveOverlayProps) => {
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);

    // Find and track target element
    useEffect(() => {
        const updateRect = () => {
            const element = document.getElementById(targetId);
            if (element) {
                const rect = element.getBoundingClientRect();

                // VALIDATION: Only show if actually visible (non-zero dimensions)
                if (rect.width > 0 && rect.height > 0) {
                    setTargetRect(rect);
                }
            }
        };

        // Initial scroll and update
        const element = document.getElementById(targetId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            updateRect();
        } else {
            // If not found immediately, wait a bit then try scrolling once it appears
            const attemptScroll = setInterval(() => {
                const el = document.getElementById(targetId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    clearInterval(attemptScroll);
                }
            }, 500);

            // Clear interval after 5 seconds to stop trying
            setTimeout(() => clearInterval(attemptScroll), 5000);
        }

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

    // Calcs for Clamping
    const windowWidth = window.innerWidth;
    const tooltipWidth = Math.min(384, windowWidth * 0.9); // max-w-sm approx 384px, or 90% screen
    const halfTooltip = tooltipWidth / 2;
    const targetCenter = targetRect.left + (targetRect.width / 2);

    // Clamp Left Position
    let tooltipLeft = targetCenter - halfTooltip;
    if (tooltipLeft < 16) tooltipLeft = 16;
    if (tooltipLeft + tooltipWidth > windowWidth - 16) tooltipLeft = windowWidth - 16 - tooltipWidth;

    // Arrow Position relative to Tooltip
    // targetCenter = tooltipLeft + arrowOffset
    const arrowOffset = targetCenter - tooltipLeft;

    let tooltipStyle: React.CSSProperties = {
        left: tooltipLeft,
        width: tooltipWidth
    };

    const offset = 16;

    if (placement === 'bottom') {
        tooltipStyle.top = targetRect.bottom + offset;
    } else if (placement === 'top') {
        tooltipStyle.bottom = window.innerHeight - targetRect.top + offset;
    } else if (placement === 'right') {
        // Fallback simpler logic for side placements or improve later
        // For now, let's keep vertical consistent and horizontal pushed
        tooltipStyle = {
            top: targetRect.top,
            left: targetRect.right + offset,
            width: tooltipWidth
        };
        // Note: side placement logic might need more work if requested, 
        // but user compliant was about Left edge overflow which implies Top/Bottom placement usually.
    }

    const { top, left, width, height, bottom, right } = targetRect;

    return createPortal(
        <div className="fixed inset-0 z-[100] overflow-hidden pointer-events-none">
            {/* 4 BLOCKING DIVS - Click to Dismiss */}
            <div onClick={onClose} className="absolute bg-black/80 backdrop-blur-[1px] transition-all duration-300 pointer-events-auto cursor-pointer" style={{ top: 0, left: 0, right: 0, height: top - 8 }} />
            <div onClick={onClose} className="absolute bg-black/80 backdrop-blur-[1px] transition-all duration-300 pointer-events-auto cursor-pointer" style={{ top: bottom + 8, left: 0, right: 0, bottom: 0 }} />
            <div onClick={onClose} className="absolute bg-black/80 backdrop-blur-[1px] transition-all duration-300 pointer-events-auto cursor-pointer" style={{ top: top - 8, left: 0, width: left - 8, height: height + 16 }} />
            <div onClick={onClose} className="absolute bg-black/80 backdrop-blur-[1px] transition-all duration-300 pointer-events-auto cursor-pointer" style={{ top: top - 8, left: right + 8, right: 0, height: height + 16 }} />

            {/* HIGHLIGHT */}
            <div
                className="absolute pointer-events-none z-[110]"
                style={{ top: top - 4, left: left - 4, width: width + 8, height: height + 8, borderRadius: 12 }}
            >
                <div className="absolute inset-0 border-2 border-yellow-500 rounded-xl animate-ping opacity-75" />
                <div className="absolute inset-0 border-2 border-yellow-500 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.5)]" />
            </div>

            {/* Tooltip Card */}
            <div
                className="absolute bg-neutral-900 border border-yellow-500/50 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-300 z-[120] pointer-events-auto"
                style={tooltipStyle}
            >
                {/* Close X - Hidden if enforced */}
                {/* Close X - Always Allow Escape */}
                <button onClick={onClose} className="absolute top-2 right-2 text-neutral-500 hover:text-white p-1 z-50">
                    <X size={16} />
                </button>

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="bg-yellow-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">PASO {step}/{totalSteps}</span>
                        <h3 className="text-white font-bold italic uppercase tracking-tight text-lg">{title}</h3>
                    </div>
                    <p className="text-neutral-300 text-sm leading-relaxed">{message}</p>

                    {!disableNext && (
                        <div className="flex justify-end pt-2">
                            <button onClick={onNext} className="bg-gym-primary text-black font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1 hover:bg-yellow-400 transition-colors">
                                <span>{nextLabel}</span>
                                <ChevronRight size={14} strokeWidth={3} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Arrow Pointer - Dynamic Position */}
                {placement !== 'right' && (
                    <div
                        className={`absolute w-3 h-3 bg-neutral-900 border-l border-t border-yellow-500/50 transform rotate-45 ${placement === 'bottom' ? '-top-1.5' : '-bottom-1.5 rotate-[225deg]'}`}
                        style={{ left: arrowOffset, transform: `translateX(-50%) rotate(${placement === 'top' ? '225deg' : '45deg'})` }}
                    ></div>
                )}
            </div>
        </div>,
        document.body
    );
};
