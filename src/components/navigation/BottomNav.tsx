import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Radar, Trophy, MessageCircle } from 'lucide-react';
import { notificationService } from '../../services/NotificationService';

interface BottomNavProps {
    onUploadClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onUploadClick: _ }) => {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;
    const [hasUnread, setHasUnread] = useState(false);

    // Check for unread invites
    useEffect(() => {
        const check = async () => {
            try {
                const count = await notificationService.getUnreadCount();
                setHasUnread(count > 0);
            } catch (e) {
                console.error("Error fetching notification count", e);
            }
        };
        check();

        // Optional: Interval or event listener could be added here for realtime updates
        const interval = setInterval(check, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, [location.pathname]);

    return (
        <div className="md:hidden w-full bg-black/95 backdrop-blur-3xl border-t border-white/10 pb-[env(safe-area-inset-bottom)] shrink-0 relative z-50">
            <div className="flex items-center justify-around h-16 px-2">
                {/* 1. INICIO */}
                <Link to="/" className="flex flex-col items-center justify-center gap-0.5 w-14 h-full relative group">
                    <Home
                        size={22}
                        className={`transition-colors duration-300 ${isActive('/') ? "text-white fill-white" : "text-neutral-500 group-hover:text-neutral-300"}`}
                        strokeWidth={isActive('/') ? 2.5 : 2}
                    />
                    <span className={`text-[10px] font-bold transition-colors duration-300 ${isActive('/') ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'}`}>Inicio</span>
                </Link>

                {/* 2. RANKING (Moved from Header) */}
                <Link to="/ranking" className="flex flex-col items-center justify-center gap-0.5 w-14 h-full relative group">
                    <Trophy
                        size={22}
                        className={`transition-colors duration-300 ${isActive('/ranking') ? "text-yellow-500 fill-yellow-500/20" : "text-neutral-500 group-hover:text-neutral-300"}`}
                        strokeWidth={isActive('/ranking') ? 2.5 : 2}
                    />
                    <span className={`text-[10px] font-bold transition-colors duration-300 ${isActive('/ranking') ? 'text-yellow-500' : 'text-neutral-500 group-hover:text-neutral-300'}`}>Ranking</span>
                </Link>

                {/* 3. RADAR (GymRats) */}
                <Link to="/radar" className="flex flex-col items-center justify-center gap-0.5 w-14 h-full relative group">
                    <Radar
                        size={22}
                        className={`transition-colors duration-300 ${isActive('/radar') ? "text-gym-primary fill-gym-primary/20" : "text-neutral-500 group-hover:text-neutral-300"}`}
                        strokeWidth={isActive('/radar') ? 2.5 : 2}
                    />
                    <span className={`text-[10px] font-bold transition-colors duration-300 ${isActive('/radar') ? 'text-gym-primary' : 'text-neutral-500 group-hover:text-neutral-300'}`}>Radar</span>
                </Link>

                {/* 4. MENSAJES (Moved from Header) */}
                <Link to="/inbox" className="flex flex-col items-center justify-center gap-0.5 w-14 h-full relative group">
                    <div className="relative">
                        <MessageCircle
                            size={22}
                            className={`transition-colors duration-300 ${isActive('/inbox') ? "text-white fill-white/20" : "text-neutral-500 group-hover:text-neutral-300"}`}
                            strokeWidth={isActive('/inbox') ? 2.5 : 2}
                        />
                        {hasUnread && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gym-primary rounded-full border-2 border-black animate-pulse"></span>
                        )}
                    </div>
                    <span className={`text-[10px] font-bold transition-colors duration-300 ${isActive('/inbox') ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'}`}>Chat</span>
                </Link>
            </div>
        </div>
    );
};
