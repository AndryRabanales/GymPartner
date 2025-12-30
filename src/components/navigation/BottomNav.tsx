import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Film, PlusSquare, MapPin, Users } from 'lucide-react';


interface BottomNavProps {
    onUploadClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onUploadClick }) => {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-3xl border-t border-white/10 z-50 pb-safe-area-inset-bottom">
            <div className="flex items-center justify-around h-16 px-2">
                {/* 1. INICIO */}
                <Link to="/" className="flex flex-col items-center justify-center gap-1 w-14 h-full">
                    <Home
                        size={24}
                        className={isActive('/') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/') ? 2.5 : 2}
                    />
                </Link>

                {/* 2. REELS */}
                <Link to="/reels" className="flex flex-col items-center justify-center gap-1 w-14 h-full">
                    <Film
                        size={24}
                        className={isActive('/reels') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/reels') ? 2.5 : 2}
                    />
                </Link>

                {/* 3. CENTER: CREAR POST (Highlighted) */}
                <button
                    onClick={onUploadClick}
                    className="flex flex-col items-center justify-center w-14 h-full group active:scale-95 transition-transform"
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-gym-primary to-yellow-300 flex items-center justify-center shadow-lg shadow-yellow-500/20 text-black">
                        <PlusSquare size={22} strokeWidth={2.5} />
                    </div>
                </button>

                {/* 4. MAPA (Includes Ranking implication) */}
                <Link to="/map" className="flex flex-col items-center justify-center gap-1 w-14 h-full">
                    <MapPin
                        size={24}
                        className={isActive('/map') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/map') ? 2.5 : 2}
                    />
                </Link>

                {/* 5. COMUNIDAD */}
                <Link to="/community" className="flex flex-col items-center justify-center gap-1 w-14 h-full">
                    <Users
                        size={24}
                        className={isActive('/community') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/community') ? 2.5 : 2}
                    />
                </Link>
            </div>
        </div>
    );
};
