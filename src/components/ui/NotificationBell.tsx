import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { notificationService } from '../../services/NotificationService';
import { useNavigate } from 'react-router-dom';

export const NotificationBell = () => {
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();

    // Cargar conteo inicial
    useEffect(() => {
        loadUnreadCount();

        // Polling inteligente cada 60s
        const interval = setInterval(() => {
            // Solo pedir datos si la pestaña está activa para evitar ERR_NETWORK_IO_SUSPENDED
            if (document.visibilityState === 'visible') {
                loadUnreadCount();
            }
        }, 60000);
        
        return () => clearInterval(interval);
    }, []);

    const loadUnreadCount = async () => {
        const allUnread = await notificationService.getUnreadCount();
        setUnreadCount(allUnread);
    };

    const handleClick = () => {
        navigate('/notifications');
    };

    return (
        <div className="relative">
            <button
                onClick={handleClick}
                className={`
                    relative p-2 text-neutral-400 hover:text-white transition-all rounded-xl hover:bg-white/5 group
                    ${unreadCount > 0 ? 'animate-in fade-in zoom-in' : ''}
                `}
            >
                <Bell size={22} className={`${unreadCount > 0 ? 'animate-[swing_2s_ease-in-out_infinite]' : ''}`} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-red-600 text-[9px] flex items-center justify-center text-white rounded-full font-black border border-neutral-950 shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
        </div>
    );
};
