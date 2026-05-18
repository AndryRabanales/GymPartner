import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { chatService } from '../services/ChatService';
import type { ChatPreview } from '../services/ChatService';
import { FadeInImage } from '../components/ui/FadeInImage';

export const InboxPage = () => {
    const [chats, setChats] = useState<ChatPreview[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadChats();
    }, []);

    // REAL-TIME SUBSCRIPTIONS
    useEffect(() => {
        const subs: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

        const setupSubs = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const chatSubA = supabase
                .channel('inbox-chats-a')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'chats', filter: `user_a=eq.${user.id}` },
                    () => loadChats()
                )
                .subscribe();
            subs.push(chatSubA);

            const chatSubB = supabase
                .channel('inbox-chats-b')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'chats', filter: `user_b=eq.${user.id}` },
                    () => loadChats()
                )
                .subscribe();
            subs.push(chatSubB);
        };

        setupSubs();

        return () => {
            subs.forEach(s => supabase.removeChannel(s));
        };
    }, []);

    const loadChats = async () => {
        setLoading(true);
        const data = await chatService.getMyChats();
        setChats(data);
        setLoading(false);
    };

    const handleChatClick = (chatId: string) => {
        navigate(`/chat/${chatId}`);
    };

    return (
        <div className="flex-1 flex flex-col bg-transparent pb-20">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-xl border-b border-white/5 px-4 py-4 flex items-center gap-3">
                <h1 className="text-xl font-black italic uppercase text-white tracking-widest flex items-center gap-2">
                    <MessageCircle size={20} className="text-gym-primary" />
                    Mensajes
                </h1>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-neutral-500 gap-3">
                        <div className="w-8 h-8 border-2 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Cargando...</span>
                    </div>
                ) : (
                    // MESSAGES VIEW
                    <div className="flex flex-col max-w-2xl mx-auto w-full space-y-2">
                        {chats.length === 0 ? (
                            <div className="p-12 text-center text-neutral-500 text-sm flex flex-col items-center gap-4 mt-8 animate-in fade-in zoom-in-95 duration-500">
                                <MessageCircle size={48} className="opacity-10" />
                                <h3 className="text-xl font-black text-white italic mb-2 uppercase tracking-tighter">SILENCIO TOTAL</h3>
                                <p className="text-xs text-neutral-500 max-w-xs font-medium">No tienes mensajes activos. Los chats aparecen cuando aceptas un reto.</p>
                            </div>
                        ) : (
                            chats.map(chat => (
                                <button
                                    key={chat.id}
                                    onClick={() => handleChatClick(chat.id)}
                                    className="flex items-center gap-4 p-4 text-left w-full bg-black/20 hover:bg-white/5 border border-white/5 rounded-3xl transition-all group active:scale-95 shadow-lg"
                                >
                                    <div className="relative shrink-0">
                                        <div className="w-14 h-14 rounded-full bg-neutral-900 overflow-hidden shrink-0 border border-white/10 group-hover:border-gym-primary/50 transition-colors">
                                            {chat.other_user?.avatar_url ? (
                                                <FadeInImage src={chat.other_user.avatar_url} alt={chat.other_user.username} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-lg font-black text-gym-primary italic bg-gradient-to-br from-neutral-800 to-black">
                                                    {chat.other_user?.username?.[0] || '?'}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="text-sm font-black text-white truncate group-hover:text-gym-primary transition-colors uppercase italic tracking-tight">
                                                {chat.other_user?.username || 'Usuario'}
                                            </span>
                                            <span className="text-[9px] text-neutral-600 shrink-0 ml-2 font-mono">
                                                {chat.last_message_at ? new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-400 truncate font-medium group-hover:text-white transition-colors">
                                            {chat.last_message || 'Inicia la conversación...'}
                                        </p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
