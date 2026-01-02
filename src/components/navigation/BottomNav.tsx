import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Film, PlusSquare, Users, Radar } from 'lucide-react';


interface BottomNavProps {
    onUploadClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onUploadClick }) => {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="md:hidden w-full bg-black/95 backdrop-blur-3xl border-t border-white/10 pb-safe-area-inset-bottom shrink-0 relative z-50">
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

                {/* 3. CREAR POST (Center) */}
                <button
                    onClick={onUploadClick}
                    className="flex flex-col items-center justify-center w-14 sm:w-16 h-full group active:scale-95 transition-transform"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-gym-primary to-yellow-300 flex items-center justify-center shadow-lg shadow-yellow-500/20 text-black border border-yellow-200">
                        <PlusSquare size={26} strokeWidth={2.5} />
                    </div>
                </button>

                {/* 4. COMUNIDAD */}
                <Link to="/community" className="flex flex-col items-center justify-center gap-1 w-14 h-full">
                    <Users
                        size={24}
                        className={isActive('/community') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/community') ? 2.5 : 2}
                    />
                </Link>

                {/* 5. RADAR (GymRats) */}
                <Link to="/radar" className="flex flex-col items-center justify-center gap-1 w-14 h-full">
                    <Radar
                        size={24}
                        className={isActive('/radar') ? "text-gym-primary fill-gym-primary/20" : "text-neutral-500"}
                        strokeWidth={isActive('/radar') ? 2.5 : 2}
                    />
                </Link>
            </div>
        </div>
    );
};
