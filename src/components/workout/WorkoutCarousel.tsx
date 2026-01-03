import React, { useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface WorkoutCarouselProps {
    children: React.ReactNode[];
    currentIndex: number;
    onIndexChange: (index: number) => void;
}

export const WorkoutCarousel: React.FC<WorkoutCarouselProps> = ({ children, currentIndex, onIndexChange }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to the current index when it changes
    useEffect(() => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const target = container.children[currentIndex] as HTMLElement;
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
            }
        }
    }, [currentIndex]);

    // Handle manual scroll (snap)
    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollLeft = container.scrollLeft;
            const width = container.offsetWidth;
            const newIndex = Math.round(scrollLeft / width);

            if (newIndex !== currentIndex) {
                onIndexChange(newIndex);
            }
        }
    };

    return (
        <div className="relative w-full h-full flex flex-col">
            {/* Carousel Container */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 px-1"
                style={{ scrollSnapType: 'x mandatory' }}
            >
                {children.map((child, index) => (
                    <div
                        key={index}
                        className="w-full flex-shrink-0 snap-center snap-always h-full overflow-y-auto pb-20"
                    >
                        {child}
                    </div>
                ))}
            </div>

            {/* Navigation / Progress Indicator */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4 pointer-events-none sticky-bottom-safe">
                {/* Previous Hint */}
                <div className={`transition-opacity duration-300 ${currentIndex > 0 ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="bg-black/50 backdrop-blur-md p-2 rounded-full border border-white/10 pointer-events-auto cursor-pointer" onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}>
                        <ChevronLeft className="text-white" size={24} />
                    </div>
                </div>

                {/* Pagination Dots */}
                <div className="flex gap-2">
                    {children.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-2 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-8 bg-gym-primary' : 'w-2 bg-white/20'
                                }`}
                        />
                    ))}
                </div>

                {/* Next Hint / Action */}
                <div className={`transition-opacity duration-300 ${currentIndex < children.length - 1 ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="bg-gym-primary/90 text-black p-2 rounded-full shadow-[0_0_15px_rgba(250,204,21,0.5)] pointer-events-auto cursor-pointer animate-pulse" onClick={() => onIndexChange(Math.min(children.length - 1, currentIndex + 1))}>
                        <ChevronRight size={24} strokeWidth={3} />
                    </div>
                </div>
            </div>

            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
};
