import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Check, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { chatService } from '../../services/ChatService';
import type { ChatPreview } from '../../services/ChatService';
import { notificationService } from '../../services/NotificationService';
import type { Notification } from '../../services/NotificationService';

type Tab = 'matches' | 'messages';

export const MessagesButton = () => {
    const [activeTab, setActiveTab] = useState<Tab>('matches');
    const [chats, setChats] = useState<ChatPreview[]>([]);
    const [invitations, setInvitations] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Close on click outside
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

    // Load data on open/tab change
    useEffect(() => {
        if (isOpen) {
            if (activeTab === 'messages') {
                loadChats();
            } else {
                loadInvitations();
            }
        }
    }, [isOpen, activeTab]);

    const loadChats = async () => {
        setLoading(true);
        const data = await chatService.getMyChats();
        setChats(data);
        setLoading(false);
    };

    const loadInvitations = async () => {
        setLoading(true);
        // We fetch all and filter client side for now as NotificationService doesn't have specific filter
        const all = await notificationService.getNotifications(50);
        const invites = all.filter(n => n.type === 'invitation' && !n.is_read);
        setInvitations(invites);
        setLoading(false);
    };

    const handleChatClick = (chatId: string) => {
        navigate(`/chat/${chatId}`);
        setIsOpen(false);
    };

    const handleAccept = async (notification: Notification) => {
        const senderId = notification.data?.sender_id;
        if (!senderId) return;

        try {
            await notificationService.markAsRead(notification.id); // Mark read first
            const chatId = await notificationService.acceptInvitation(senderId);
            if (chatId) {
                // Switch to messages tab or open chat directly? User requested explicit workflow.
                // Let's open the chat.
                navigate(`/chat/${chatId}`);
                setIsOpen(false);
            }
        } catch (error) {
            console.error("Error accepting invite:", error);
        }
    };

    const handleReject = async (notification: Notification) => {
        try {
            await notificationService.markAsRead(notification.id);
            setInvitations(prev => prev.filter(n => n.id !== notification.id));
        } catch (error) {
            console.error("Error rejecting invite:", error);
        }
    };

    const unreadInvitationsCount = invitations.length;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 transition-colors rounded-full hover:bg-white/10 ${isOpen ? 'text-white bg-white/10' : 'text-neutral-400 hover:text-white'}`}
            >
                <MessageCircle size={24} />
                {unreadInvitationsCount > 0 && !isOpen && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-gym-primary rounded-full border-2 border-black animate-pulse"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-black border border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right ring-1 ring-white/10">

                    {/* Header Tabs */}
                    <div className="flex border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md">
                        <button
                            onClick={() => setActiveTab('matches')}
                            className={`flex-1 py-4 text-sm font-bold transition-all relative ${activeTab === 'matches' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            Matches
                            {invitations.length > 0 && (
                                <span className="ml-1.5 text-[10px] bg-gym-primary text-black px-1.5 py-0.5 rounded-full">{invitations.length}</span>
                            )}
                            {activeTab === 'matches' && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gym-primary shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('messages')}
                            className={`flex-1 py-4 text-sm font-bold transition-all relative ${activeTab === 'messages' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            Mensajes
                            {activeTab === 'messages' && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gym-primary shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
                            )}
                        </button>
                        <button onClick={() => setIsOpen(false)} className="absolute right-4 top-4 text-neutral-500 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="h-96 overflow-y-auto custom-scrollbar bg-black/95">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-3">
                                <div className="w-6 h-6 border-2 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-medium">Cargando...</span>
                            </div>
                        ) : activeTab === 'matches' ? (
                            // MATCHES (INVITATIONS) VIEW
                            <div className="p-2 space-y-1">
                                {invitations.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-neutral-500 mt-10">
                                        <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mb-4 text-neutral-700">
                                            <Search size={32} />
                                        </div>
                                        <p className="text-sm font-bold text-neutral-400">Sin invitaciones</p>
                                        <p className="text-xs mt-1 max-w-[200px]">Usa el Radar para encontrar nuevos compañeros de gimnasio.</p>
                                    </div>
                                ) : (
                                    invitations.map(invite => (
                                        <div key={invite.id} className="group relative overflow-hidden bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-800 rounded-xl p-3 transition-all duration-200">
                                            <div className="flex items-center gap-3">
                                                {/* Fake Avatar until we have sender avatar in metadata */}
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 p-[2px]">
                                                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                                                        <span className="font-bold text-white text-lg">{invite.data.sender_name?.[0] || '?'}</span>
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline justify-between">
                                                        <h4 className="text-sm font-bold text-white truncate">{invite.title.replace('🔥 ', '')}</h4>
                                                        <span className="text-[10px] text-neutral-500">{new Date(invite.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">
                                                        {invite.message}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Action Overlay (Always visible or on hover? Let's make button row) */}
                                            <div className="flex gap-2 mt-3 pl-[3.75rem]">
                                                <button
                                                    onClick={() => handleReject(invite)}
                                                    className="p-2 rounded-full bg-neutral-800 text-neutral-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                                    title="Rechazar"
                                                >
                                                    <X size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleAccept(invite)}
                                                    className="flex-1 bg-white text-black text-xs font-black py-2 rounded-full hover:bg-gym-primary transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(250,204,21,0.4)]"
                                                >
                                                    <Check size={14} /> ACEPTAR
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            // MESSAGES (CHATS) VIEW
                            <div className="flex flex-col">
                                {chats.length === 0 ? (
                                    <div className="p-12 text-center text-neutral-500 text-sm flex flex-col items-center gap-3 mt-4">
                                        <MessageCircle size={32} className="opacity-20" />
                                        <p>No tienes mensajes activos</p>
                                    </div>
                                ) : (
                                    chats.map(chat => (
                                        <button
                                            key={chat.id}
                                            onClick={() => handleChatClick(chat.id)}
                                            className="flex items-center gap-4 p-4 text-left w-full hover:bg-neutral-900/80 transition-all border-b border-neutral-800/50 last:border-0 group"
                                        >
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-full bg-neutral-800 overflow-hidden shrink-0 border border-neutral-700 group-hover:border-gym-primary/50 transition-colors">
                                                    {chat.other_user?.avatar_url ? (
                                                        <img src={chat.other_user.avatar_url} alt={chat.other_user.username} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-sm font-bold text-neutral-500">
                                                            {chat.other_user?.username?.[0] || '?'}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Online Status (Mock) */}
                                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full"></div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <span className="text-sm font-bold text-white truncate group-hover:text-gym-primary transition-colors">
                                                        {chat.other_user?.username || 'Usuario'}
                                                    </span>
                                                    <span className="text-[10px] text-neutral-600 shrink-0 ml-2 font-mono">
                                                        {chat.last_message_at ? new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-neutral-400 truncate font-medium">
                                                    {chat.last_message}
                                                </p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
