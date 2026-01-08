import { useState, useEffect, useRef } from 'react';
import { Bell, Trophy, Info, UserPlus, Check, X } from 'lucide-react';
import { notificationService } from '../../services/NotificationService';
import type { Notification } from '../../services/NotificationService';
import { useNavigate } from 'react-router-dom';

export const NotificationBell = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Cargar conteo inicial
    useEffect(() => {
        loadUnreadCount();

        // Polling simple cada 60s
        const interval = setInterval(loadUnreadCount, 60000);
        return () => clearInterval(interval);
    }, []);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Cargar lista al abrir
    useEffect(() => {
        if (isOpen) {
            loadNotifications();
        }
    }, [isOpen]);

    const loadUnreadCount = async () => {
        const count = await notificationService.getUnreadCount();
        setUnreadCount(count);
    };

    const loadNotifications = async () => {
        setLoading(true);
        const data = await notificationService.getNotifications();
        setNotifications(data);
        setLoading(false);
    };

    const handleRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n =>
            n.id === id ? { ...n, is_read: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));

        await notificationService.markAsRead(id);
    };

    const handleMarkAllRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        await notificationService.markAllAsRead();
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.is_read) {
            handleRead(notification.id);
        }

        // Navegación basada en tipo o data
        if (notification.type === 'ranking_change') {
            navigate('/profile'); // Ir al perfil para ver ranking
        }

        // Chat navigation if it was an accepted invitation or similar (logic mainly in buttons below)
        if (notification.type === 'invitation' && notification.data?.chat_id) {
            navigate(`/chat/${notification.data.chat_id}`);
            setIsOpen(false);
        }
    };

    const handleAcceptInvitation = async (e: React.MouseEvent, notification: Notification) => {
        e.stopPropagation();
        const senderId = notification.data?.sender_id;
        if (!senderId) return;

        try {
            const chatId = await notificationService.acceptInvitation(senderId);
            if (chatId) {
                // Mark as read
                handleRead(notification.id);
                // Close dropdown
                setIsOpen(false);
                // Navigate
                navigate(`/chat/${chatId}`);
            }
        } catch (error) {
            console.error("Failed to accept invitation", error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'ranking_change':
                return <Trophy size={16} className="text-yellow-500" />;
            case 'reward':
                return <div className="text-purple-500 text-lg">🎁</div>;
            case 'invitation':
                return <UserPlus size={16} className="text-gym-primary" />;
            default:
                return <Info size={16} className="text-blue-500" />;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-neutral-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-[10px] flex items-center justify-center text-white rounded-full font-bold border-2 border-black">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    <div className="p-3 border-b border-neutral-800 flex justify-between items-center bg-neutral-950">
                        <h3 className="font-bold text-sm text-white">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Marcar leídas
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-neutral-500 text-sm">
                                Cargando...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-neutral-500 text-sm flex flex-col items-center gap-2">
                                <Bell size={24} className="opacity-20" />
                                Sin notificaciones
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`
                                            flex flex-col border-b border-neutral-800/50 last:border-0
                                            hover:bg-neutral-800 transition-colors
                                            ${!notification.is_read ? 'bg-blue-500/5' : ''}
                                        `}
                                    >
                                        <button
                                            onClick={() => handleNotificationClick(notification)}
                                            className="flex items-start gap-3 p-3 text-left w-full"
                                        >
                                            <div className={`
                                                mt-1 p-1.5 rounded-full flex-shrink-0
                                                ${!notification.is_read ? 'bg-neutral-800' : 'bg-transparent'}
                                            `}>
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <span className={`text-sm ${!notification.is_read ? 'text-white font-semibold' : 'text-neutral-400'}`}>
                                                        {notification.title}
                                                    </span>
                                                    {!notification.is_read && (
                                                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-neutral-500 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <span className="text-[10px] text-neutral-600 mt-1 block">
                                                    {new Date(notification.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </button>

                                        {/* Action Buttons for Invitations */}
                                        {notification.type === 'invitation' && !notification.is_read && (
                                            <div className="flex gap-2 px-3 pb-3 pl-12">
                                                <button
                                                    onClick={(e) => handleAcceptInvitation(e, notification)}
                                                    className="flex-1 bg-gym-primary text-black text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-yellow-400 transition-colors"
                                                >
                                                    <Check size={12} /> ACEPTAR
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRead(notification.id); }}
                                                    className="flex-1 bg-neutral-800 text-neutral-400 text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-neutral-700 hover:text-white transition-colors"
                                                >
                                                    <X size={12} /> RECHAZAR
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
