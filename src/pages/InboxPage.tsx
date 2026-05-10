import { useState, useEffect } from 'react';
import { MessageCircle, X, Check, Search, ChevronLeft, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { chatService } from '../services/ChatService';
import type { ChatPreview } from '../services/ChatService';
import { notificationService } from '../services/NotificationService';
import type { Notification } from '../services/NotificationService';
import { FadeInImage } from '../components/ui/FadeInImage';

type Tab = 'matches' | 'messages';

interface ExtendedNotification extends Notification {
    sender?: {
        username: string;
        avatar_url: string | null;
    };
}

export const InboxPage = () => {
    const [activeTab, setActiveTab] = useState<Tab>('matches');
    const [chats, setChats] = useState<ChatPreview[]>([]);
    const [invitations, setInvitations] = useState<ExtendedNotification[]>([]);
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
        let subs: any[] = [];

        const setupSubs = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const notifySub = supabase
                .channel('inbox-notifications')
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                    (payload) => {
                        const newNote = payload.new as Notification;
                        if (newNote.type === 'invitation') {
                            // When a new invite comes in, we reload to get sender info too
                            loadInvitations();
                        }
                    }
                )
                .subscribe();
            subs.push(notifySub);

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

    const loadInvitations = async () => {
        setLoading(true);
        try {
            const all = await notificationService.getNotifications(50);
            const invites = all.filter(n => n.type === 'invitation');
            
            // Fetch sender profiles for each invite
            const senderIds = Array.from(new Set(invites.map(i => i.data?.sender_id).filter(Boolean)));
            
            if (senderIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', senderIds);
                
                const profileMap = (profiles || []).reduce((acc: any, p) => {
                    acc[p.id] = p;
                    return acc;
                }, {});

                const extendedInvites = invites.map(i => ({
                    ...i,
                    sender: profileMap[i.data?.sender_id]
                }));
                setInvitations(extendedInvites);
            } else {
                setInvitations(invites);
            }
        } catch (error) {
            console.error("Error loading invitations:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleChatClick = (chatId: string) => {
        navigate(`/chat/${chatId}`);
    };

    const handleAccept = async (notification: Notification) => {
        const senderId = notification.data?.sender_id;
        if (!senderId) return;

        setInvitations(prev => prev.map(n =>
            n.id === notification.id
                ? { ...n, data: { ...n.data, status: 'accepted' }, is_read: true }
                : n
        ));

        try {
            await notificationService.updateInvitationStatus(notification, 'accepted');
            const chatId = await notificationService.acceptInvitation(senderId);
            if (chatId) {
                navigate(`/chat/${chatId}`);
            }
        } catch (error) {
            console.error("Error accepting invite:", error);
        }
    };

    const handleReject = async (notification: Notification) => {
        setInvitations(prev => prev.map(n =>
            n.id === notification.id
                ? { ...n, data: { ...n.data, status: 'rejected' }, is_read: true }
                : n
        ));

        try {
            await notificationService.updateInvitationStatus(notification, 'rejected');
        } catch (error) {
            console.error("Error rejecting invite:", error);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-transparent pb-20">
            {/* FLOATING COMPACT TABS */}
            <div className="sticky top-2 z-40 px-4 pt-1 animate-in slide-in-from-top-4 duration-700">
                <div className="max-w-sm mx-auto bg-black/40 backdrop-blur-3xl border border-white/10 rounded-full p-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-1">
                    <button
                        onClick={() => setActiveTab('matches')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                            activeTab === 'matches' 
                            ? 'bg-gym-primary text-black shadow-lg scale-100' 
                            : 'text-neutral-500 hover:text-neutral-300 scale-95 opacity-70'
                        }`}
                    >
                        <Zap size={14} fill={activeTab === 'matches' ? "currentColor" : "none"} />
                        Matches
                        {invitations.filter(i => !i.is_read || !i.data?.status).length > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ml-1 ${activeTab === 'matches' ? 'bg-black/20' : 'bg-gym-primary/20 text-gym-primary'}`}>
                                {invitations.filter(i => !i.is_read || !i.data?.status).length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('messages')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                            activeTab === 'messages' 
                            ? 'bg-gym-primary text-black shadow-lg scale-100' 
                            : 'text-neutral-500 hover:text-neutral-300 scale-95 opacity-70'
                        }`}
                    >
                        <MessageCircle size={14} fill={activeTab === 'messages' ? "currentColor" : "none"} />
                        Mensajes
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-6">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-neutral-500 gap-3">
                        <div className="w-8 h-8 border-2 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando...</span>
                    </div>
                ) : activeTab === 'matches' ? (
                    // MATCHES VIEW
                    <div className="space-y-4 max-w-2xl mx-auto w-full">
                        {invitations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-500">
                                <div className="w-20 h-20 bg-neutral-900 rounded-[2.5rem] flex items-center justify-center mb-6 text-neutral-700">
                                    <Zap size={40} />
                                </div>
                                <h3 className="text-xl font-black text-white italic mb-2 uppercase tracking-tighter">SIN DESAFÍOS</h3>
                                <p className="text-xs text-neutral-500 max-w-xs font-medium">No tienes invitaciones de entrenamiento por ahora. ¡Ve al Radar y desafía a alguien!</p>
                                <button onClick={() => navigate('/radar')} className="mt-8 bg-white text-black px-8 py-3 rounded-2xl font-black text-sm tracking-tighter hover:bg-gym-primary transition-all active:scale-95 shadow-xl">
                                    IR AL RADAR
                                </button>
                            </div>
                        ) : (
                            invitations.map(invite => {
                                const status = invite.data?.status;

                                return (
                                    <div 
                                        key={invite.id} 
                                        className={`bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-5 shadow-[0_15px_40px_rgba(0,0,0,0.4)] animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all group ${status ? 'opacity-60 grayscale-[0.5]' : 'hover:border-gym-primary/30'}`}
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* SENDER AVATAR */}
                                            <div className="relative shrink-0">
                                                <div className="absolute -inset-1 bg-gym-primary rounded-full blur-md opacity-0 group-hover:opacity-20 transition-opacity"></div>
                                                <div className={`w-16 h-16 rounded-full p-0.5 ${status ? 'bg-neutral-800' : 'bg-gradient-to-tr from-neutral-800 to-neutral-600'}`}>
                                                    <div className="w-full h-full rounded-full bg-neutral-900 overflow-hidden flex items-center justify-center border border-white/10 relative">
                                                        {invite.sender?.avatar_url ? (
                                                            <FadeInImage 
                                                                src={invite.sender.avatar_url} 
                                                                alt="Avatar" 
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center">
                                                                <span className="text-xl font-black text-gym-primary italic">
                                                                    {invite.sender?.username?.[0].toUpperCase() || 'G'}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {!status && (
                                                    <div className="absolute -bottom-1 -right-1 bg-gym-primary text-black p-1 rounded-full border-2 border-black shadow-lg">
                                                        <Zap size={10} fill="currentColor" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <h3 className={`text-xs font-black italic uppercase tracking-tight truncate ${status ? 'text-neutral-500' : 'text-white'}`}>
                                                        DESAFÍO DE ENTRENAMIENTO
                                                    </h3>
                                                    <span className="text-[9px] font-bold text-neutral-600 shrink-0">
                                                        {new Date(invite.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className={`text-xs font-medium leading-relaxed ${status ? 'text-neutral-600' : 'text-neutral-400'}`}>
                                                    <span className={`${status ? 'text-neutral-500' : 'text-gym-primary'} font-black uppercase italic mr-1`}>
                                                        @{invite.sender?.username || 'guerrero'}
                                                    </span> 
                                                    te ha enviado un reto de gimnasio. ¿Entrenamos?
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-6">
                                            {status === 'accepted' ? (
                                                <div className="w-full py-3 bg-gym-primary/10 border border-gym-primary/20 rounded-2xl flex items-center justify-center gap-2 text-gym-primary font-black text-[10px] uppercase tracking-widest">
                                                    <Check size={14} strokeWidth={3} /> RETO ACEPTADO
                                                </div>
                                            ) : status === 'rejected' ? (
                                                <div className="w-full py-3 bg-neutral-900/50 border border-neutral-800 rounded-2xl flex items-center justify-center gap-2 text-neutral-600 font-black text-[10px] uppercase tracking-widest">
                                                    <X size={14} strokeWidth={3} /> RETO IGNORADO
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleReject(invite)}
                                                        className="flex-1 py-3 px-4 rounded-2xl bg-neutral-900 text-neutral-500 font-black text-[10px] uppercase tracking-widest border border-white/5 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        <X size={14} />
                                                        IGNORAR
                                                    </button>
                                                    <button
                                                        onClick={() => handleAccept(invite)}
                                                        className="flex-[1.5] py-3 px-4 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-gym-primary transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
                                                    >
                                                        <Zap size={14} fill="currentColor" />
                                                        ACEPTAR RETO
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
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
