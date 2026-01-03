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
                <Link to="/" className="flex flex-col items-center justify-center gap-0.5 w-14 h-full">
                    <Home
                        size={22}
                        className={isActive('/') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/') ? 2.5 : 2}
                    />
                    <span className={`text-[10px] font-bold ${isActive('/') ? 'text-white' : 'text-neutral-500'}`}>Inicio</span>
                </Link>

                {/* 2. REELS */}
                <Link to="/reels" className="flex flex-col items-center justify-center gap-0.5 w-14 h-full">
                    <Film
                        size={22}
                        className={isActive('/reels') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/reels') ? 2.5 : 2}
                    />
                    <span className={`text-[10px] font-bold ${isActive('/reels') ? 'text-white' : 'text-neutral-500'}`}>Reels</span>
                </Link>

                {/* 3. CREAR POST (Center) */}
                <button
                    onClick={onUploadClick}
                    className="flex flex-col items-center justify-center w-14 sm:w-16 h-full group active:scale-95 transition-transform"
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-gym-primary to-yellow-300 flex items-center justify-center shadow-lg shadow-yellow-500/20 text-black border border-yellow-200 mb-0.5">
                        <PlusSquare size={22} strokeWidth={2.5} />
                    </div>
                </button>

                {/* 4. COMUNIDAD */}
                <Link to="/community" className="flex flex-col items-center justify-center gap-0.5 w-14 h-full">
                    <Users
                        size={22}
                        className={isActive('/community') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/community') ? 2.5 : 2}
                    />
                    <span className={`text-[10px] font-bold ${isActive('/community') ? 'text-white' : 'text-neutral-500'}`}>Comunidad</span>
                </Link>

                {/* 5. RADAR (GymRats) */}
                <Link to="/radar" className="flex flex-col items-center justify-center gap-0.5 w-14 h-full">
                    <Radar
                        size={22}
                        className={isActive('/radar') ? "text-gym-primary fill-gym-primary/20" : "text-neutral-500"}
                        strokeWidth={isActive('/radar') ? 2.5 : 2}
                    />
                    <span className={`text-[10px] font-bold ${isActive('/radar') ? 'text-gym-primary' : 'text-neutral-500'}`}>Radar</span>
                </Link>
            </div>
        </div>
    );
};
