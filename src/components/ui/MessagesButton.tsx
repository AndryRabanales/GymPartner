
import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { chatService } from '../../services/ChatService';
import type { ChatPreview } from '../../services/ChatService';

export const MessagesButton = () => {
    const [chats, setChats] = useState<ChatPreview[]>([]);
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

    // Load chats on open
    useEffect(() => {
        if (isOpen) {
            loadChats();
        }
    }, [isOpen]);

    const loadChats = async () => {
        setLoading(true);
        const data = await chatService.getMyChats();
        setChats(data);
        setLoading(false);
    };

    const handleChatClick = (chatId: string) => {
        navigate(`/chat/${chatId}`);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 transition-colors rounded-full hover:bg-white/10 ${isOpen ? 'text-white bg-white/10' : 'text-neutral-400 hover:text-white'}`}
            >
                <MessageCircle size={24} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    <div className="p-3 border-b border-neutral-800 flex justify-between items-center bg-neutral-950">
                        <h3 className="font-bold text-sm text-white">Mensajes</h3>
                        <button onClick={() => setIsOpen(false)} className="text-neutral-400 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-neutral-500 text-sm">
                                Cargando...
                            </div>
                        ) : chats.length === 0 ? (
                            <div className="p-8 text-center text-neutral-500 text-sm flex flex-col items-center gap-2">
                                <MessageCircle size={24} className="opacity-20" />
                                No tienes mensajes
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {chats.map(chat => (
                                    <button
                                        key={chat.id}
                                        onClick={() => handleChatClick(chat.id)}
                                        className="flex items-center gap-3 p-3 text-left w-full hover:bg-neutral-800 transition-colors border-b border-neutral-800/50 last:border-0"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden shrink-0 border border-neutral-700">
                                            {chat.other_user?.avatar_url ? (
                                                <img src={chat.other_user.avatar_url} alt={chat.other_user.username} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-neutral-500">
                                                    {chat.other_user?.username?.[0] || '?'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-sm font-bold text-white truncate">
                                                    {chat.other_user?.username || 'Usuario'}
                                                </span>
                                                <span className="text-[10px] text-neutral-600 shrink-0 ml-2">
                                                    {chat.last_message_at ? new Date(chat.last_message_at).toLocaleDateString() : ''}
                                                </span>
                                            </div>
                                            <p className="text-xs text-neutral-400 truncate mt-0.5">
                                                {chat.last_message}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
