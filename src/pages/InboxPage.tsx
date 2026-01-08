import { useState, useEffect } from 'react';
import { MessageCircle, X, Check, Search, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { chatService } from '../services/ChatService';
import type { ChatPreview } from '../services/ChatService';
import { notificationService } from '../services/NotificationService';
import type { Notification } from '../services/NotificationService';

type Tab = 'matches' | 'messages';

export const InboxPage = () => {
    const [activeTab, setActiveTab] = useState<Tab>('matches');
    const [chats, setChats] = useState<ChatPreview[]>([]);
    const [invitations, setInvitations] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Load data on tab change
    useEffect(() => {
        if (activeTab === 'messages') {
            loadChats();
        } else {
            loadInvitations();
        }
    }, [activeTab]);

    // REAL-TIME SUBSCRIPTIONS
    useEffect(() => {
        // We need user ID for filters. Since we don't have useAuth here yet, let's get it or use the service.
        // Ideally we refactor to use useAuth() hook if available in this file scope.
        // Let's assume we can get it from supabase.auth within effect for now, or just listen generally to the table 
        // and filter in callback (less efficient but works for low volume).
        // BETTER: Retrieve user once.

        let subs: any[] = [];

        const setupSubs = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Listen for new INVITATIONS (Matches)
            const notifySub = supabase
                .channel('inbox-notifications')
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                    (payload) => {
                        const newNote = payload.new as Notification;
                        if (newNote.type === 'invitation') {
                            // Add to list if we are in matches tab, or just invalidate
                            // If it's an invite, prepend it
                            setInvitations(prev => [newNote, ...prev]);
                        }
                    }
                )
                .subscribe();
            subs.push(notifySub);

            // 2. Listen for CHAT updates (New messages move chat to top, or new chat accepted)
            // We listen to 'chats' table updates (last_message_at changes)
            // We need to listen where we are user_a OR user_b. Realtime syntax for OR is tricky.
            // We will create two channels or just one channel with two listeners if possible? 
            // Postgres changes filter is simple. We'll make two channels for simplicity.

            const chatSubA = supabase
                .channel('inbox-chats-a')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'chats', filter: `user_a=eq.${user.id}` },
                    () => loadChats() // Simply reload the list to get fresh order/content
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

    const loadInvitations = async () => {
        setLoading(true);
        const all = await notificationService.getNotifications(50);
        const invites = all.filter(n => n.type === 'invitation' && !n.is_read);
        setInvitations(invites);
        setLoading(false);
    };

    const handleChatClick = (chatId: string) => {
        navigate(`/chat/${chatId}`);
    };

    const handleAccept = async (notification: Notification) => {
        const senderId = notification.data?.sender_id;
        if (!senderId) return;

        try {
            await notificationService.markAsRead(notification.id);
            const chatId = await notificationService.acceptInvitation(senderId);
            if (chatId) {
                navigate(`/chat/${chatId}`);
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

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10 flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-lg font-black tracking-wide">Bandeja de Entrada</h1>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-800 bg-black">
                <button
                    onClick={() => setActiveTab('matches')}
                    className={`flex-1 py-4 text-sm font-bold transition-all relative ${activeTab === 'matches' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                    Matches
                    {invitations.length > 0 && (
                        <span className="ml-2 text-[10px] bg-gym-primary text-black px-1.5 py-0.5 rounded-full">{invitations.length}</span>
                    )}
                    {activeTab === 'matches' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gym-primary shadow-[0_0_15px_rgba(250,204,21,0.5)]"></div>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('messages')}
                    className={`flex-1 py-4 text-sm font-bold transition-all relative ${activeTab === 'messages' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                    Mensajes
                    {activeTab === 'messages' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gym-primary shadow-[0_0_15px_rgba(250,204,21,0.5)]"></div>
                    )}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-neutral-500 gap-3">
                        <div className="w-8 h-8 border-2 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-medium">Cargando...</span>
                    </div>
                ) : activeTab === 'matches' ? (
                    // MATCHES VIEW
                    <div className="space-y-4 max-w-2xl mx-auto">
                        {invitations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center text-neutral-500">
                                <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center mb-6 text-neutral-700">
                                    <Search size={40} />
                                </div>
                                <p className="text-lg font-bold text-neutral-300 mb-2">Sin invitaciones</p>
                                <p className="text-sm max-w-xs text-neutral-500">Usa el Radar para encontrar nuevos compañeros de gimnasio y expandir tu red.</p>
                                <button onClick={() => navigate('/radar')} className="mt-6 px-6 py-2 bg-neutral-800 text-white text-sm font-bold rounded-full hover:bg-neutral-700 transition-colors">
                                    Ir al Radar
                                </button>
                            </div>
                        ) : (
                            invitations.map(invite => (
                                <div key={invite.id} className="relative overflow-hidden bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 transition-all duration-200 hover:border-neutral-700">
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 p-[2px] shrink-0">
                                            <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                                                <span className="font-bold text-white text-xl">{invite.data.sender_name?.[0] || '?'}</span>
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between mb-1">
                                                <h4 className="text-base font-bold text-white truncate">{invite.title.replace('🔥 ', '')}</h4>
                                                <span className="text-xs text-neutral-500">{new Date(invite.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm text-neutral-400 leading-relaxed">
                                                {invite.message}
                                            </p>

                                            <div className="flex gap-3 mt-4">
                                                <button
                                                    onClick={() => handleReject(invite)}
                                                    className="flex-1 py-2 rounded-xl bg-neutral-800 text-neutral-400 font-bold text-xs hover:bg-red-500/10 hover:text-red-400 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <X size={16} /> RECHAZAR
                                                </button>
                                                <button
                                                    onClick={() => handleAccept(invite)}
                                                    className="flex-[2] py-2 rounded-xl bg-white text-black font-black text-xs hover:bg-gym-primary transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(250,204,21,0.4)]"
                                                >
                                                    <Check size={16} /> ACEPTAR RETO
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    // MESSAGES VIEW
                    <div className="flex flex-col max-w-2xl mx-auto">
                        {chats.length === 0 ? (
                            <div className="p-12 text-center text-neutral-500 text-sm flex flex-col items-center gap-4 mt-8">
                                <MessageCircle size={48} className="opacity-20" />
                                <p className="text-lg font-medium">No tienes mensajes activos</p>
                            </div>
                        ) : (
                            chats.map(chat => (
                                <button
                                    key={chat.id}
                                    onClick={() => handleChatClick(chat.id)}
                                    className="flex items-center gap-4 p-4 text-left w-full hover:bg-neutral-900 border-b border-neutral-800 last:border-0 first:rounded-t-2xl last:rounded-b-2xl transition-all group"
                                >
                                    <div className="relative">
                                        <div className="w-14 h-14 rounded-full bg-neutral-800 overflow-hidden shrink-0 border border-neutral-700 group-hover:border-gym-primary/50 transition-colors">
                                            {chat.other_user?.avatar_url ? (
                                                <img src={chat.other_user.avatar_url} alt={chat.other_user.username} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-sm font-bold text-neutral-500">
                                                    {chat.other_user?.username?.[0] || '?'}
                                                </div>
                                            )}
                                        </div>
                                        {/* Online Status (Mock) */}
                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-black rounded-full"></div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="text-base font-bold text-white truncate group-hover:text-gym-primary transition-colors">
                                                {chat.other_user?.username || 'Usuario'}
                                            </span>
                                            <span className="text-xs text-neutral-600 shrink-0 ml-2 font-mono">
                                                {chat.last_message_at ? new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <p className="text-sm text-neutral-400 truncate font-medium group-hover:text-white transition-colors">
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
    );
};
