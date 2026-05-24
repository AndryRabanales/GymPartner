import { useState, useEffect } from 'react';
import { MessageCircle, Zap, X, Swords, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { chatService } from '../services/ChatService';
import type { ChatPreview } from '../services/ChatService';
import { FadeInImage } from '../components/ui/FadeInImage';
import { notificationService } from '../services/NotificationService';

export const InboxPage = () => {
    const [chats, setChats] = useState<ChatPreview[]>([]);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'chats' | 'matches'>('chats');
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    // REAL-TIME SUBSCRIPTIONS
    useEffect(() => {
        const subs: any[] = [];

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

            // Subscribe to message updates to count unread messages in real-time
            const msgSub = supabase
                .channel('inbox-messages')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'chat_messages' },
                    () => loadChats()
                )
                .subscribe();
            subs.push(msgSub);

            // Subscribe to notifications (to live update invitations/matches)
            const notifySub = supabase
                .channel('inbox-notifications')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                    () => loadInvitations()
                )
                .subscribe();
            subs.push(notifySub);
        };

        setupSubs();

        return () => {
            subs.forEach(s => supabase.removeChannel(s));
        };
    }, []);

    const loadChats = async () => {
        const data = await chatService.getMyChats();
        setChats(data);
    };

    const loadInvitations = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: allInvites } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .eq('type', 'invitation')
            .order('created_at', { ascending: false });

        if (allInvites) {
            const pending = allInvites.filter(invite => !invite.data?.status);
            
            if (pending.length > 0) {
                const senderIds = Array.from(new Set(pending.map(n => n.data?.sender_id).filter(Boolean)));
                if (senderIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, username, avatar_url')
                        .in('id', senderIds);
                    
                    const profileMap = (profiles || []).reduce((acc: Record<string, any>, p) => {
                        acc[p.id] = p;
                        return acc;
                    }, {});

                    const enriched = pending.map(n => ({
                        ...n,
                        sender: profileMap[n.data?.sender_id]
                    }));
                    setInvitations(enriched);
                } else {
                    setInvitations(pending);
                }
            } else {
                setInvitations([]);
            }
        }
    };

    const loadData = async () => {
        setLoading(true);
        await Promise.all([loadChats(), loadInvitations()]);
        setLoading(false);
    };

    const handleAccept = async (notification: any) => {
        const senderId = notification.data?.sender_id;
        if (!senderId) return;

        try {
            await notificationService.updateInvitationStatus(notification, 'accepted');
            const chatId = await notificationService.acceptInvitation(senderId);
            if (chatId) {
                navigate(`/chat/${chatId}`);
            }
            loadData();
        } catch (error) {
            console.error("Error accepting invite:", error);
        }
    };

    const handleReject = async (notification: any) => {
        try {
            await notificationService.updateInvitationStatus(notification, 'rejected');
            loadData();
        } catch (error) {
            console.error("Error rejecting invite:", error);
        }
    };

    const handleChatClick = (chatId: string) => {
        navigate(`/chat/${chatId}`);
    };

    // Calculate sum of all unread messages across all active chats
    const totalUnreadMessages = chats.reduce((acc, c) => acc + (c.unread_count || 0), 0);

    return (
        <div className="flex-1 flex flex-col bg-transparent pb-20 relative overflow-hidden">
            {/* Header & Tabs */}
            <div className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-xl border-b border-white/5 pb-0 flex flex-col relative">
                <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                    <h1 className="text-xl font-black italic uppercase text-white tracking-widest flex items-center gap-2 select-none">
                        <MessageCircle size={20} className="text-gym-primary animate-pulse" />
                        Sala de Guerra
                    </h1>
                </div>

                {/* PREMIUM TABS */}
                <div className="flex px-4 border-t border-white/5 bg-black/40">
                    <button
                        onClick={() => setActiveTab('chats')}
                        className={`flex-1 py-4 text-center font-black uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 relative group ${
                            activeTab === 'chats'
                                ? 'text-white'
                                : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                    >
                        <MessageCircle size={14} className={activeTab === 'chats' ? 'text-gym-primary' : ''} />
                        Mensajes
                        {totalUnreadMessages > 0 && (
                            <span className="bg-gym-primary text-neutral-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(255,215,0,0.5)] animate-pulse">
                                {totalUnreadMessages}
                            </span>
                        )}
                        {activeTab === 'chats' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gym-primary rounded-full shadow-[0_0_12px_#ffd700]"></div>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('matches')}
                        className={`flex-1 py-4 text-center font-black uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 relative group ${
                            activeTab === 'matches'
                                ? 'text-white'
                                : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                    >
                        <Swords size={14} className={activeTab === 'matches' ? 'text-yellow-500 animate-bounce' : ''} />
                        Desafíos
                        {invitations.length > 0 && (
                            <span className="bg-yellow-500 text-neutral-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(234,179,8,0.5)] animate-pulse">
                                {invitations.length}
                            </span>
                        )}
                        {activeTab === 'matches' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full shadow-[0_0_12px_#EAB308]"></div>
                        )}
                    </button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 relative z-10">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-neutral-500 gap-3">
                        <div className="w-8 h-8 border-2 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando...</span>
                    </div>
                ) : (
                    <div className="flex flex-col max-w-xl mx-auto w-full">
                        {activeTab === 'matches' && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-3">
                                {invitations.length === 0 ? (
                                    <div className="p-12 text-center text-neutral-500 flex flex-col items-center gap-4 mt-8 bg-neutral-900/30 backdrop-blur-md border border-white/5 rounded-3xl animate-in fade-in zoom-in-95 duration-500">
                                        <Swords size={48} className="opacity-15 text-neutral-400 mb-2 animate-pulse" />
                                        <h3 className="text-base font-black text-white italic uppercase tracking-wider">SIN RETOS PENDIENTES</h3>
                                        <p className="text-[10px] text-neutral-500 max-w-xs font-medium leading-relaxed">No has recibido invitaciones nuevas por ahora. Busca aliados en el Radar para lanzar un desafío táctico.</p>
                                    </div>
                                ) : (
                                    invitations.map(invite => (
                                        <div 
                                            key={invite.id} 
                                            className="bg-neutral-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 shadow-[0_4px_25px_rgba(0,0,0,0.3)] transition-all hover:border-yellow-500/20 hover:bg-neutral-900/60 relative overflow-hidden group"
                                        >
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-yellow-500/5 to-transparent pointer-events-none rounded-full blur-xl"></div>
                                            
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-full bg-neutral-950 overflow-hidden shrink-0 border border-white/10 ring-2 ring-yellow-500/10 group-hover:ring-yellow-500/30 transition-all relative">
                                                    {invite.sender?.avatar_url ? (
                                                        <FadeInImage src={invite.sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center text-sm font-black text-yellow-500 italic">
                                                            {invite.sender?.username?.[0].toUpperCase() || 'G'}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                                        <span className="text-xs font-black text-white uppercase italic tracking-tight truncate group-hover:text-yellow-400 transition-colors">
                                                            @{invite.sender?.username || invite.data?.sender_name || 'Guerrero'}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-neutral-600 shrink-0 font-mono">
                                                            {new Date(invite.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-neutral-400 font-medium leading-relaxed">
                                                        Te ha enviado un desafío de gimnasio. ¿Aceptas el entrenamiento conjunto?
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex items-center gap-2 relative z-10">
                                                <button
                                                    onClick={() => handleReject(invite)}
                                                    className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-950/80 text-neutral-400 font-bold text-[9px] uppercase tracking-wider border border-white/5 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                >
                                                    <X size={12} />
                                                    IGNORAR
                                                </button>
                                                <button
                                                    onClick={() => handleAccept(invite)}
                                                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-br from-gym-primary to-yellow-500 text-neutral-950 font-black text-[9px] uppercase tracking-wider hover:shadow-[0_0_15px_rgba(255,215,0,0.35)] transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                >
                                                    <Zap size={11} fill="currentColor" />
                                                    ACEPTAR RETO
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'chats' && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-2">
                                {chats.length === 0 ? (
                                    <div className="p-12 text-center text-neutral-500 flex flex-col items-center gap-4 mt-8 bg-neutral-900/30 backdrop-blur-md border border-white/5 rounded-3xl animate-in fade-in zoom-in-95 duration-500">
                                        <ShieldAlert size={48} className="opacity-15 text-neutral-400 mb-2 animate-pulse" />
                                        <h3 className="text-base font-black text-white italic uppercase tracking-wider">SILENCIO TOTAL</h3>
                                        <p className="text-[10px] text-neutral-500 max-w-xs font-medium leading-relaxed">No tienes mensajes activos. Los chats aparecen cuando aceptas un reto de entrenamiento.</p>
                                    </div>
                                ) : (
                                    chats.map(chat => {
                                        const hasUnread = (chat.unread_count || 0) > 0;
                                        return (
                                            <button
                                                key={chat.id}
                                                onClick={() => handleChatClick(chat.id)}
                                                className={`flex items-center gap-4 p-4 text-left w-full backdrop-blur-md border rounded-2xl transition-all duration-300 group active:scale-[0.98] shadow-md relative overflow-hidden ${
                                                    hasUnread
                                                        ? 'bg-neutral-900/60 border-gym-primary/20 shadow-[0_4px_20px_rgba(255,215,0,0.03)]'
                                                        : 'bg-neutral-900/40 border-white/5 hover:border-gym-primary/30 hover:bg-neutral-900/60'
                                                }`}
                                            >
                                                {hasUnread && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gym-primary"></div>
                                                )}

                                                <div className="relative shrink-0">
                                                    <div className={`w-14 h-14 rounded-full bg-neutral-950 overflow-hidden shrink-0 border-2 transition-all duration-300 relative ${
                                                        hasUnread 
                                                            ? 'border-gym-primary shadow-[0_0_12px_rgba(255,215,0,0.25)] ring-2 ring-gym-primary/10' 
                                                            : 'border-white/10 group-hover:border-gym-primary/50'
                                                    }`}>
                                                        {chat.other_user?.avatar_url ? (
                                                            <FadeInImage src={chat.other_user.avatar_url} alt={chat.other_user.username} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-lg font-black text-gym-primary italic bg-gradient-to-br from-neutral-800 to-black">
                                                                {chat.other_user?.username?.[0]?.toUpperCase() || '?'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {hasUnread && (
                                                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-gym-primary border-2 border-neutral-900 rounded-full animate-ping"></span>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <span className={`text-sm font-black truncate group-hover:text-gym-primary transition-colors uppercase italic tracking-tight ${
                                                            hasUnread ? 'text-gym-primary font-black' : 'text-white'
                                                        }`}>
                                                            {chat.other_user?.username || 'Usuario'}
                                                        </span>
                                                        <span className={`text-[8px] shrink-0 ml-2 font-mono ${
                                                            hasUnread ? 'text-gym-primary font-bold' : 'text-neutral-500'
                                                        }`}>
                                                            {chat.last_message_at ? new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    <p className={`text-xs truncate transition-colors ${
                                                        hasUnread 
                                                            ? 'text-white font-bold' 
                                                            : 'text-neutral-400 group-hover:text-white font-medium'
                                                    }`}>
                                                        {chat.last_message || 'Inicia la conversación...'}
                                                    </p>
                                                </div>

                                                {hasUnread && (
                                                    <span className="bg-gym-primary text-neutral-950 text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(255,215,0,0.3)] animate-bounce ml-auto">
                                                        {chat.unread_count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
