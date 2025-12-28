import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { socialService } from '../../services/SocialService';
import { useAuth } from '../../context/AuthContext';

interface CommentsSheetProps {
    postId: string;
    onClose: () => void;
}

export const CommentsSheet: React.FC<CommentsSheetProps> = ({ postId, onClose }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadComments();
    }, [postId]);

    const loadComments = async () => {
        setLoading(true);
        const data = await socialService.getComments(postId);
        setComments(data);
        setLoading(false);
        scrollToBottom();
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !user) return;

        const tempId = Date.now();
        const optimisticComment = {
            id: tempId,
            content: newComment,
            created_at: new Date().toISOString(),
            profiles: {
                username: user.user_metadata?.full_name || 'Tú',
                avatar_url: user.user_metadata?.avatar_url || 'https://i.pravatar.cc/150'
            }
        };

        setComments(prev => [...prev, optimisticComment]);
        setNewComment('');
        scrollToBottom();

        const { data, error } = await socialService.addComment(user.id, postId, optimisticComment.content);

        if (error) {
            alert('Error al enviar mensaje');
            // Revert optimistic update? For MVP, we pass.
        } else if (data) {
            // Replace optimistic with real
            setComments(prev => prev.map(c => c.id === tempId ? data : c));
        }
    };

    return (
        <div className="absolute inset-x-0 bottom-0 h-[75vh] bg-neutral-900 rounded-t-3xl z-50 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom border-t border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <MessageCircle size={18} className="text-white" />
                    <h3 className="font-bold text-white text-sm">Comentarios ({comments.length})</h3>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                    <X size={20} />
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {loading && (
                    <div className="text-center py-10">
                        <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-xs text-neutral-500">Cargando debate...</p>
                    </div>
                )}

                {!loading && comments.length === 0 && (
                    <div className="text-center py-20 opacity-50">
                        <MessageCircle size={40} className="mx-auto text-neutral-600 mb-2" />
                        <p className="text-sm text-neutral-400">Sé el primero en comentar.</p>
                    </div>
                )}

                {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden shrink-0 border border-white/10">
                            <img src={comment.profiles?.avatar_url || 'https://i.pravatar.cc/150'} alt="User" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                            <div className="bg-white/5 rounded-2xl rounded-tl-none p-3 border border-white/5">
                                <p className="text-[10px] text-neutral-400 font-bold mb-0.5 flex justify-between">
                                    {comment.profiles?.username}
                                    <span className="font-normal opacity-50">{new Date(comment.created_at).toLocaleDateString()}</span>
                                </p>
                                <p className="text-sm text-white leading-snug">{comment.content}</p>
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-neutral-900 pb-8 md:pb-4">
                <div className="relative flex items-center gap-2">
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escribe un comentario..."
                        className="w-full bg-black/40 border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={!newComment.trim()}
                        className="absolute right-1 top-1 p-2 bg-yellow-500 rounded-full text-black disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 transition-all hover:scale-105 active:scale-95"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </form>
        </div>
    );
};
