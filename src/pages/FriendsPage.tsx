import { useState, useEffect } from 'react';
import { Users, Swords, Dumbbell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { chatService, ChatPreview } from '../services/ChatService';
import { FadeInImage } from '../components/ui/FadeInImage';
import { BottomNav } from '../components/navigation/BottomNav';
import { notificationService } from '../services/NotificationService';

export const FriendsPage = () => {
    const [friends, setFriends] = useState<ChatPreview[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFriends();
    }, []);

    const loadFriends = async () => {
        setLoading(true);
        try {
            const data = await chatService.getMyChats();
            // We consider "friends/matches" as users you have an active chat with
            setFriends(data);
        } catch (e) {
            console.error("Error loading friends:", e);
        }
        setLoading(false);
    };

    const handleInviteToWorkout = async (friend: ChatPreview) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !friend.other_user) return;

        // Obtain user name for notification
        const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
            
        const displayName = profile?.username || 'Un amigo';

        // Send a custom notification to start a Co-op Workout
        await notificationService.createNotification(friend.other_user.id, {
            type: 'coop_invite',
            title: '🔥 Invitación de Entrenamiento',
            content: `¡${displayName} te ha invitado a entrenar juntos!`,
            data: {
                sender_id: user.id,
                sender_name: displayName,
                chat_id: friend.id
            }
        });

        alert(`Invitación enviada a ${friend.other_user.username}. ¡Preparando los fierros!`);
    };

    return (
        <div className="min-h-screen bg-black text-white pb-24">
            {/* HEADER */}
            <div className="pt-20 px-4 pb-6 relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-gym-primary/10 border border-gym-primary/30 flex items-center justify-center mb-4">
                    <Users className="text-gym-primary" size={32} />
                </div>
                <h1 className="text-3xl font-black italic tracking-tighter uppercase text-center text-gym-primary drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]">
                    Mis Matches
                </h1>
                <p className="text-neutral-400 text-sm text-center font-medium mt-2 max-w-xs">
                    Entrena en conjunto o separado con tus compañeros de batalla.
                </p>
            </div>

            <div className="px-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Dumbbell className="text-gym-primary animate-spin" size={32} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Buscando aliados...</span>
                    </div>
                ) : friends.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-20 opacity-50">
                        <Swords size={48} className="mb-4 text-neutral-600" />
                        <p className="text-sm font-bold uppercase tracking-widest">No hay matches activos</p>
                        <p className="text-xs text-neutral-500 mt-2">Ve al Radar para encontrar compañeros.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {friends.map((friend) => {
                            const other = friend.other_user;
                            if (!other) return null;
                            
                            return (
                                <div key={friend.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden group">
                                    {/* Avatar */}
                                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-neutral-700 flex-shrink-0 relative">
                                        <FadeInImage src={other.avatar_url || `https://ui-avatars.com/api/?name=${other.username}&background=2A2A2A&color=fff`} />
                                    </div>
                                    
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-lg uppercase truncate tracking-tight leading-none mb-1">
                                            {other.username}
                                        </h3>
                                        <p className="text-[10px] text-neutral-400 font-bold tracking-widest uppercase">
                                            Activo
                                        </p>
                                    </div>
                                    
                                    {/* Action Button */}
                                    <button 
                                        onClick={() => handleInviteToWorkout(friend)}
                                        className="h-10 px-4 rounded-xl bg-gym-primary text-black font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-transform active:scale-95 shadow-[0_0_15px_rgba(250,204,21,0.2)]"
                                    >
                                        <Dumbbell size={14} />
                                        <span>Invitar</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <BottomNav onUploadClick={() => {}} />
        </div>
    );
};
