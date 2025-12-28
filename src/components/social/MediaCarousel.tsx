import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaItem {
    url: string;
    type: 'image' | 'video';
}

interface MediaCarouselProps {
    media: MediaItem[];
}

export const MediaCarousel: React.FC<MediaCarouselProps> = ({ media }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);
    const videoRefs = useRef<{ [key: number]: HTMLVideoElement }>({});

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe && currentIndex < media.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
        if (isRightSwipe && currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }

        setTouchStart(0);
        setTouchEnd(0);
    };

    const goToNext = () => {
        if (currentIndex < media.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const goToPrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    if (media.length === 0) return null;

    return (
        <div
            className="relative w-full aspect-square max-h-[280px] bg-black overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Media Container */}
            <div
                className="flex transition-transform duration-300 ease-out h-full"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {media.map((item, index) => (
                    <div key={index} className="min-w-full h-full flex items-center justify-center">
                        {item.type === 'video' ? (
                            <video
                                ref={el => { if (el) videoRefs.current[index] = el }}
                                src={item.url}
                                className="w-full h-full object-cover"
                                playsInline
                                loop
                                muted={index !== currentIndex}
                                autoPlay={index === currentIndex}
                                onClick={(e) => {
                                    const v = e.target as HTMLVideoElement;
                                    v.muted = !v.muted;
                                }}
                            />
                        ) : (
                            <img
                                src={item.url}
                                alt={`Media ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Navigation Arrows (Desktop) */}
            {media.length > 1 && (
                <>
                    {currentIndex > 0 && (
                        <button
                            onClick={goToPrevious}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-white p-1.5 rounded-full hover:bg-black/70 transition-colors hidden sm:block"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    {currentIndex < media.length - 1 && (
                        <button
                            onClick={goToNext}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-white p-1.5 rounded-full hover:bg-black/70 transition-colors hidden sm:block"
                        >
                            <ChevronRight size={20} />
                        </button>
                    )}
                </>
            )}

            {/* Media Counter */}
            {media.length > 1 && (
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                    <span className="text-white text-xs font-bold">
                        {currentIndex + 1}/{media.length}
                    </span>
                </div>
            )}

            {/* Dot Indicators */}
            {media.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {media.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${index === currentIndex
                                ? 'bg-white w-4'
                                : 'bg-white/50'
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
