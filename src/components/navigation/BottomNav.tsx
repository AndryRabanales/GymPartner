import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Film, PlusSquare, MapPin, Users, Trophy, Bell } from 'lucide-react';


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
                <Link to="/" className="flex flex-col items-center justify-center gap-1 w-12 h-full">
                    <Home
                        size={24}
                        className={isActive('/') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/') ? 2.5 : 2}
                    />
                </Link>

                {/* 2. RANKING (Requested: 2nd from Left) */}
                <Link to="/ranking" className="flex flex-col items-center justify-center gap-1 w-12 h-full">
                    <Trophy
                        size={24}
                        className={isActive('/ranking') ? "text-yellow-400 fill-yellow-400" : "text-neutral-500"}
                        strokeWidth={isActive('/ranking') ? 2.5 : 2}
                    />
                </Link>

                {/* 3. REELS */}
                <Link to="/reels" className="flex flex-col items-center justify-center gap-1 w-12 h-full">
                    <Film
                        size={24}
                        className={isActive('/reels') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/reels') ? 2.5 : 2}
                    />
                </Link>

                {/* 4. CREAR POST (Centered & Larger) */}
                <button
                    onClick={onUploadClick}
                    className="flex flex-col items-center justify-center w-14 sm:w-16 h-full group active:scale-95 transition-transform"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-gym-primary to-yellow-300 flex items-center justify-center shadow-lg shadow-yellow-500/20 text-black border border-yellow-200">
                        <PlusSquare size={26} strokeWidth={2.5} />
                    </div>
                </button>

                {/* 5. MAPA */}
                <Link to="/map" className="flex flex-col items-center justify-center gap-1 w-12 h-full">
                    <MapPin
                        size={24}
                        className={isActive('/map') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/map') ? 2.5 : 2}
                    />
                </Link>

                {/* 6. COMUNIDAD */}
                <Link to="/community" className="flex flex-col items-center justify-center gap-1 w-12 h-full">
                    <Users
                        size={24}
                        className={isActive('/community') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/community') ? 2.5 : 2}
                    />
                </Link>

                {/* 7. NOTIFICACIONES (NEW) */}
                <Link to="/notifications" className="flex flex-col items-center justify-center gap-1 w-12 h-full">
                    <Bell
                        size={24}
                        className={isActive('/notifications') ? "text-white fill-white" : "text-neutral-500"}
                        strokeWidth={isActive('/notifications') ? 2.5 : 2}
                    />
                </Link>
            </div>
        </div>
    );
};
