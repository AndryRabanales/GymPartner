import { useState, useEffect } from 'react';

interface FadeInImageProps {
    src: string;
    alt: string;
    className?: string;
    /** true = load eagerly with high priority (above-the-fold images) */
    priority?: boolean;
}

export const FadeInImage = ({ src, alt, className = "", priority = false }: FadeInImageProps) => {
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setLoaded(false);
    }, [src]);

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {!loaded && (
                <div className="absolute inset-0 bg-neutral-900 animate-pulse" />
            )}
            <img
                src={src}
                alt={alt}
                onLoad={() => setLoaded(true)}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
        </div>
    );
};
