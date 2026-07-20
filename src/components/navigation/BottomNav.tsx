import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Radar, Trophy, MessageCircle, Users } from 'lucide-react';
import { notificationService } from '../../services/NotificationService';

export const BottomNav: React.FC = () => {
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

        const interval = setInterval(check, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, [location.pathname]);

    return (
        <div className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 w-[88%] max-w-sm z-50 animate-in slide-in-from-bottom-8 duration-700">
            <div className="relative bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Active Indicator Background Pill */}
                <div 
                    className="absolute h-9 bg-gym-primary/10 border border-gym-primary/20 rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0"
                    style={{
                        width: 'calc(20% - 6px)',
                        left: isActive('/') ? '4px' : 
                               isActive('/friends') ? 'calc(20% + 2px)' : 
                               isActive('/radar') ? 'calc(40% + 1px)' : 
                               isActive('/inbox') ? 'calc(60% - 1px)' : 'calc(80% - 2px)',
                        top: '4px'
                    }}
                />

                <div className="flex items-center justify-around h-11 relative z-10">
                    {/* 1. INICIO */}
                    <Link to="/" className="flex flex-col items-center justify-center w-full h-full relative group">
                        <Home
                            size={20}
                            className={`transition-all duration-500 ${isActive('/') ? "text-gym-primary scale-110 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]" : "text-neutral-500 group-hover:text-neutral-300"}`}
                            strokeWidth={isActive('/') ? 2.5 : 2}
                        />
                        <span className={`text-[8px] font-black uppercase tracking-tighter mt-0 transition-all duration-500 ${isActive('/') ? 'text-gym-primary opacity-100' : 'text-neutral-500 opacity-0'}`}>Inicio</span>
                    </Link>

                    {/* 2. AMIGOS */}
                    <Link to="/friends" className="flex flex-col items-center justify-center w-full h-full relative group">
                        <Users
                            size={20}
                            className={`transition-all duration-500 ${isActive('/friends') ? "text-gym-primary scale-110 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]" : "text-neutral-500 group-hover:text-neutral-300"}`}
                            strokeWidth={isActive('/friends') ? 2.5 : 2}
                        />
                        <span className={`text-[8px] font-black uppercase tracking-tighter mt-0 transition-all duration-500 ${isActive('/friends') ? 'text-gym-primary opacity-100' : 'text-neutral-500 opacity-0'}`}>Amigos</span>
                    </Link>

                    {/* 3. RADAR */}
                    <Link to="/radar" className="flex flex-col items-center justify-center w-full h-full relative group">
                        <Radar
                            size={20}
                            className={`transition-all duration-500 ${isActive('/radar') ? "text-gym-primary scale-110 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]" : "text-neutral-500 group-hover:text-neutral-300"}`}
                            strokeWidth={isActive('/radar') ? 2.5 : 2}
                        />
                        <span className={`text-[8px] font-black uppercase tracking-tighter mt-0 transition-all duration-500 ${isActive('/radar') ? 'text-gym-primary opacity-100' : 'text-neutral-500 opacity-0'}`}>Radar</span>
                    </Link>

                    {/* 4. CHAT */}
                    <Link to="/inbox" className="flex flex-col items-center justify-center w-full h-full relative group">
                        <div className="relative">
                            <MessageCircle
                                size={20}
                                className={`transition-all duration-500 ${isActive('/inbox') ? "text-gym-primary scale-110 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]" : "text-neutral-500 group-hover:text-neutral-300"}`}
                                strokeWidth={isActive('/inbox') ? 2.5 : 2}
                            />
                            {hasUnread && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-black animate-pulse"></span>
                            )}
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-tighter mt-0 transition-all duration-500 ${isActive('/inbox') ? 'text-gym-primary opacity-100' : 'text-neutral-500 opacity-0'}`}>Chat</span>
                    </Link>

                    {/* 5. RANKING */}
                    <Link to="/ranking" className="flex flex-col items-center justify-center w-full h-full relative group">
                        <Trophy
                            size={20}
                            className={`transition-all duration-500 ${isActive('/ranking') ? "text-gym-primary scale-110 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]" : "text-neutral-500 group-hover:text-neutral-300"}`}
                            strokeWidth={isActive('/ranking') ? 2.5 : 2}
                        />
                        <span className={`text-[8px] font-black uppercase tracking-tighter mt-0 transition-all duration-500 ${isActive('/ranking') ? 'text-gym-primary opacity-100' : 'text-neutral-500 opacity-0'}`}>Ranking</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};
