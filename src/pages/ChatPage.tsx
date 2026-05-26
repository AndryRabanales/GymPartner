import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Send, MoreVertical, Loader, ShieldAlert, Trash2, UserX, Ban } from 'lucide-react';
import { chatService } from '../services/ChatService';

interface Message {
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
    is_read: boolean;
}

export const ChatPage = () => {
    const { chatId } = useParams<{ chatId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [otherUser, setOtherUser] = useState<{ id: string, username: string, avatar_url: string } | null>(null);
    const [sending, setSending] = useState(false);

    // Dynamic Menu & Modal States
    const [showMenu, setShowMenu] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'clear' | 'delete' | 'block' | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Auto-scroll ref
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const markAsRead = async () => {
        if (!chatId || !user) return;
        try {
            await supabase
                .from('chat_messages')
                .update({ is_read: true })
                .eq('chat_id', chatId)
                .neq('sender_id', user.id)
                .eq('is_read', false);
        } catch (err) {
            console.error("Error marking messages as read:", err);
        }
    };

    const handleClearChat = async () => {
        if (!chatId) return;
        setActionLoading(true);
        const success = await chatService.clearChatMessages(chatId);
        if (success) {
            setMessages([]);
            setConfirmAction(null);
            setShowMenu(false);
        }
        setActionLoading(false);
    };

    const handleDeleteChat = async () => {
        if (!chatId) return;
        setActionLoading(true);
        const success = await chatService.deleteChat(chatId);
        if (success) {
            navigate('/inbox');
        }
        setActionLoading(false);
    };

    const handleBlockUser = async () => {
        if (!otherUser?.id) return;
        setActionLoading(true);
        const success = await chatService.blockUser(otherUser.id);
        if (success) {
            navigate('/inbox');
        }
        setActionLoading(false);
    };

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        if (chatId && user?.id) {
            loadChatDetails();
            unsubscribe = subscribeToMessages();
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [chatId, user?.id]);

    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom();
        }
    }, [messages]);

    const loadChatDetails = async () => {
        if (!chatId || !user) return;

        const isFirstLoad = messages.length === 0;
        if (isFirstLoad) {
            setLoading(true);
        }

        // 1. Fetch chat metadata and message history in parallel
        const [chatRes, historyRes] = await Promise.all([
            supabase.from('chats').select('*').eq('id', chatId).single(),
            supabase.from('chat_messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true })
        ]);

        if (chatRes.error || !chatRes.data) {
            console.error("Error loading chat metadata:", chatRes.error);
            navigate('/inbox');
            setLoading(false);
            return;
        }

        const chat = chatRes.data;

        // 2. Identify the other participant
        const otherId = chat.user_a === user.id ? chat.user_b : chat.user_a;

        // 3. Fetch profile details of the other user
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .eq('id', otherId)
            .single();

        if (profile) {
            setOtherUser(profile);
        }

        if (historyRes.data) {
            setMessages(historyRes.data);
            // Mark messages as read
            markAsRead();
        }
        setLoading(false);
    };

    const subscribeToMessages = () => {
        if (!chatId || !user) return;

        const subscription = supabase
            .channel(`chat:${chatId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` },
                (payload) => {
                    const newMsg = payload.new as Message;
                    setMessages(prev => [...prev, newMsg]);
                    
                    // If message is from the other user, mark as read
                    if (newMsg.sender_id !== user.id) {
                        markAsRead();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !user || !chatId || sending) return;

        setSending(true);
        const content = newMessage.trim();
        setNewMessage(""); // Optimistic clear

        const { error } = await supabase
            .from('chat_messages')
            .insert({
                chat_id: chatId,
                sender_id: user.id,
                content: content
            });

        if (error) {
            console.error("Error sending message:", error);
            setNewMessage(content); // Restore if failed
        } else {
            // Update last_message_at
            await supabase
                .from('chats')
                .update({ last_message_at: new Date().toISOString() })
                .eq('id', chatId);
        }
        setSending(false);
    };

    if (loading) return (
        <div className="h-screen bg-black flex flex-col items-center justify-center gap-3">
            <Loader className="text-gym-primary animate-spin" size={32} />
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Cargando Canal...</span>
        </div>
    );

    return (
        <div className="h-[100dvh] flex flex-col bg-neutral-950 text-white relative overflow-hidden">
            {/* CYBER BACKGROUND GRIDS */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,215,0,0.02),transparent_70%)] pointer-events-none z-0"></div>
            <div className="absolute inset-0 opacity-[0.015] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0"></div>

            {/* HEADER */}
            <div className="p-4 flex items-center gap-3 bg-neutral-950/80 backdrop-blur-xl border-b border-white/5 shrink-0 relative z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-neutral-400 hover:text-white transition-colors rounded-full hover:bg-white/5 active:scale-90"
                >
                    <ArrowLeft size={20} />
                </button>

                <div className="w-10 h-10 rounded-full bg-neutral-900 overflow-hidden border border-white/10 ring-2 ring-gym-primary/10 shadow-[0_0_15px_rgba(255,215,0,0.05)] relative shrink-0">
                    {otherUser?.avatar_url ? (
                        <img src={otherUser.avatar_url} alt={otherUser.username} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-black text-gym-primary italic bg-gradient-to-br from-neutral-800 to-black">
                            {otherUser?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-neutral-950 rounded-full animate-pulse"></span>
                </div>

                <div className="flex-1 min-w-0">
                    <h2 className="font-black text-sm uppercase tracking-tight text-white italic truncate flex items-center gap-1.5">
                        {otherUser?.username || 'Usuario'}
                    </h2>
                    <p className="text-[9px] font-bold text-gym-primary/70 tracking-widest uppercase italic animate-pulse">Conexión Segura</p>
                </div>

                <div className="relative">
                    <button 
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 text-neutral-400 hover:text-white transition-colors rounded-full hover:bg-white/5 active:scale-95"
                    >
                        <MoreVertical size={18} />
                    </button>

                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                            
                            <div className="absolute right-0 mt-2 w-48 bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                <button
                                    onClick={() => {
                                        setConfirmAction('clear');
                                        setShowMenu(false);
                                    }}
                                    className="w-full px-4 py-3 text-left text-xs font-bold text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-colors"
                                >
                                    <Trash2 size={14} className="text-yellow-500" />
                                    Borrar Mensajes
                                </button>
                                <button
                                    onClick={() => {
                                        setConfirmAction('delete');
                                        setShowMenu(false);
                                    }}
                                    className="w-full px-4 py-3 text-left text-xs font-bold text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-colors border-t border-white/5"
                                >
                                    <UserX size={14} className="text-gym-primary" />
                                    Eliminar Chat / Match
                                </button>
                                <button
                                    onClick={() => {
                                        setConfirmAction('block');
                                        setShowMenu(false);
                                    }}
                                    className="w-full px-4 py-3 text-left text-xs font-black text-red-500 hover:bg-red-500/10 flex items-center gap-2.5 transition-colors border-t border-white/5"
                                >
                                    <Ban size={14} />
                                    BLOQUEAR PERSONA
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gym-primary/20 to-transparent"></div>
            </div>

            {/* MESSAGES AREA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-transparent z-10 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="text-center max-w-sm mx-auto mt-16 p-6 bg-neutral-900/40 backdrop-blur-md border border-white/5 rounded-3xl animate-in fade-in zoom-in-95 duration-500">
                        <ShieldAlert size={36} className="mx-auto text-gym-primary opacity-60 mb-3 animate-bounce" />
                        <h4 className="text-xs font-black text-white uppercase italic tracking-wider">CANAL TÁCTICO INICIADO</h4>
                        <p className="text-[10px] text-neutral-400 mt-2 font-medium leading-relaxed">
                            Inicio de la comunicación encriptada. Saluda a tu nuevo GymPartner y acuerden el próximo entrenamiento en el gimnasio.
                        </p>
                    </div>
                )}

                {messages.map(msg => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`
                                max-w-[80%] rounded-2xl px-4 py-3 text-sm relative shadow-md transition-all hover:scale-[1.005] group
                                ${isMe
                                    ? 'bg-gradient-to-br from-gym-primary to-yellow-500 text-neutral-950 rounded-tr-none font-bold shadow-[0_4px_15px_rgba(255,215,0,0.15)]'
                                    : 'bg-neutral-900/90 text-white rounded-tl-none border border-white/5 shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:border-white/10'
                                }
                            `}>
                                <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                                <span className={`
                                    text-[8px] font-black block text-right mt-1.5 opacity-60 tracking-wider font-mono
                                    ${isMe ? 'text-black/80' : 'text-neutral-500'}
                                `}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA */}
            <form onSubmit={handleSendMessage} className="p-3 bg-neutral-950/80 backdrop-blur-xl border-t border-white/5 shrink-0 flex gap-2 items-center z-10 relative">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje táctico..."
                    className="flex-1 bg-neutral-900/60 border border-white/5 rounded-full px-5 py-3 text-[16px] text-white focus:outline-none focus:border-gym-primary/50 focus:ring-1 focus:ring-gym-primary/30 focus:shadow-[0_0_15px_rgba(255,215,0,0.08)] transition-all placeholder-neutral-500 font-medium"
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="w-11 h-11 rounded-full bg-gradient-to-br from-gym-primary to-yellow-500 text-neutral-950 flex items-center justify-center hover:shadow-[0_0_15px_rgba(255,215,0,0.35)] disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-90 shrink-0"
                >
                    <Send size={16} className={sending ? 'animate-pulse' : ''} fill="currentColor" />
                </button>
            </form>

            {/* TACTICAL CONFIRMATION OVERLAY */}
            {confirmAction && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-neutral-900/90 border border-white/10 max-w-sm w-full rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gym-primary to-transparent"></div>
                        
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-neutral-950 flex items-center justify-center border border-white/10 ring-4 ring-white/5 animate-pulse">
                                {confirmAction === 'clear' && <Trash2 className="text-yellow-500" size={20} />}
                                {confirmAction === 'delete' && <UserX className="text-gym-primary" size={20} />}
                                {confirmAction === 'block' && <Ban className="text-red-500" size={20} />}
                            </div>

                            <h3 className="text-base font-black uppercase italic tracking-widest text-white">
                                {confirmAction === 'clear' && '¿Borrar Mensajes?'}
                                {confirmAction === 'delete' && '¿Eliminar Conexión?'}
                                {confirmAction === 'block' && '¿Bloquear Guerrero?'}
                            </h3>

                            <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                                {confirmAction === 'clear' && 'Se eliminará todo el historial de conversación en este chat localmente, pero mantendrás tu match activo.'}
                                {confirmAction === 'delete' && 'Esta acción cancelará tu match, eliminará permanentemente esta sala de chat y todo su historial.'}
                                {confirmAction === 'block' && `Bloquearás permanentemente a @${otherUser?.username || 'este usuario'}. Se cancelará el match y no podrán interactuar de nuevo.`}
                            </p>

                            <div className="mt-4 flex items-center gap-3 w-full">
                                <button
                                    disabled={actionLoading}
                                    onClick={() => setConfirmAction(null)}
                                    className="flex-1 py-3 px-4 rounded-xl bg-neutral-950 text-neutral-400 border border-white/5 hover:bg-white/5 hover:text-white font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={actionLoading}
                                    onClick={() => {
                                        if (confirmAction === 'clear') handleClearChat();
                                        if (confirmAction === 'delete') handleDeleteChat();
                                        if (confirmAction === 'block') handleBlockUser();
                                    }}
                                    className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                                        confirmAction === 'block' 
                                            ? 'bg-red-600 text-white hover:bg-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                                            : confirmAction === 'clear'
                                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-neutral-950 hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]'
                                            : 'bg-gradient-to-r from-gym-primary to-yellow-500 text-neutral-950 hover:shadow-[0_0_15px_rgba(255,215,0,0.4)]'
                                    }`}
                                >
                                    {actionLoading ? (
                                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        'Confirmar'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
