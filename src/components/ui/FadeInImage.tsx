import { useState } from 'react';

interface FadeInImageProps {
    src: string;
    alt: string;
    className?: string;
}

export const FadeInImage = ({ src, alt, className = "" }: FadeInImageProps) => {
    const [loaded, setLoaded] = useState(false);

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {!loaded && (
                <div className="absolute inset-0 bg-neutral-900 animate-pulse" />
            )}
            <img
                src={src}
                alt={alt}
                onLoad={() => setLoaded(true)}
                className={`w-full h-full object-cover transition-opacity duration-1000 ${
                    loaded ? 'opacity-100' : 'opacity-0'
                }`}
            />
        </div>
    );
};
