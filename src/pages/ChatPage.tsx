import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Send, MoreVertical, Loader } from 'lucide-react';

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

    // Auto-scroll ref
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (chatId) {
            loadChatDetails();
            loadMessages();
            subscribeToMessages();
        }
    }, [chatId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadChatDetails = async () => {
        if (!chatId || !user) return;

        // Get chat participants to identify "other" user
        const { data: chat } = await supabase
            .from('chats')
            .select('user_a, user_b')
            .eq('id', chatId)
            .single();

        if (chat) {
            const otherId = chat.user_a === user.id ? chat.user_b : chat.user_a;

            // Get Other User Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .eq('id', otherId)
                .single();

            if (profile) setOtherUser(profile);
        }
    };

    const loadMessages = async () => {
        if (!chatId) return;
        setLoading(true);
        const { data } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (data) setMessages(data);
        setLoading(false);
    };

    const subscribeToMessages = () => {
        if (!chatId) return;

        const subscription = supabase
            .channel(`chat:${chatId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` },
                (payload) => {
                    const newMsg = payload.new as Message;
                    setMessages(prev => [...prev, newMsg]);
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
        <div className="h-screen bg-black flex items-center justify-center">
            <Loader className="text-gym-primary animate-spin" />
        </div>
    );

    return (
        <div className="h-[100dvh] flex flex-col bg-black text-white">
            {/* HEADER */}
            <div className="p-4 flex items-center gap-3 bg-neutral-900 border-b border-neutral-800 shrink-0">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-neutral-400 hover:text-white"
                >
                    <ArrowLeft size={24} />
                </button>

                <div className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden border border-neutral-700">
                    {otherUser?.avatar_url ? (
                        <img src={otherUser.avatar_url} alt={otherUser.username} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-neutral-500">
                            {otherUser?.username?.[0] || '?'}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-sm truncate">{otherUser?.username || 'Usuario'}</h2>
                    <p className="text-xs text-green-500 font-medium">En línea</p>
                </div>

                <button className="p-2 text-neutral-400 hover:text-white">
                    <MoreVertical size={20} />
                </button>
            </div>

            {/* MESSAGES AREA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-950/50">
                {messages.length === 0 && (
                    <div className="text-center text-neutral-500 text-sm mt-10 p-4 border border-dashed border-neutral-800 rounded-xl">
                        <p>Inicio de la comunicación cifrada.</p>
                        <p className="text-xs opacity-50 mt-1">Saluda a tu nuevo GymPartner.</p>
                    </div>
                )}

                {messages.map(msg => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`
                                max-w-[80%] rounded-2xl px-4 py-3 text-sm relative group
                                ${isMe
                                    ? 'bg-gym-primary text-black rounded-tr-sm font-medium'
                                    : 'bg-neutral-800 text-white rounded-tl-sm'
                                }
                            `}>
                                <p>{msg.content}</p>
                                <span className={`
                                    text-[9px] block text-right mt-1 opacity-60 font-bold
                                    ${isMe ? 'text-black/70' : 'text-neutral-400'}
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
            <form onSubmit={handleSendMessage} className="p-3 bg-neutral-900 border-t border-neutral-800 shrink-0 flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-full px-4 py-3 text-sm text-white focus:outline-none focus:border-gym-primary/50 transition-colors placeholder-neutral-500"
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="w-12 h-12 rounded-full bg-gym-primary text-black flex items-center justify-center hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    <Send size={20} className={sending ? 'opacity-50' : ''} />
                </button>
            </form>
        </div>
    );
};
