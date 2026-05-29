import { useState, useEffect } from 'react';
import { Users, Swords, Dumbbell, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { chatService, type ChatPreview } from '../services/ChatService';
import { FadeInImage } from '../components/ui/FadeInImage';
import { BottomNav } from '../components/navigation/BottomNav';
import { notificationService } from '../services/NotificationService';

export const FriendsPage = () => {
    const [friends, setFriends] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFriends();

        // Subscribe to real-time changes to workout_sessions, profiles, and chats tables
        const channel = supabase
            .channel('realtime:workout_sessions_status')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'workout_sessions' },
                () => {
                    console.log('🔄 Workout status changed, reloading matches silently...');
                    loadFriends(true);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles' },
                () => {
                    console.log('🔄 Profiles status updated, reloading matches silently...');
                    loadFriends(true);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'chats' },
                () => {
                    console.log('🔄 Chats changed, reloading matches silently...');
                    loadFriends(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const loadFriends = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const data = await chatService.getMyChats();
            
            // Check active workouts for all friends
            const friendIds = data.map(f => f.other_user?.id).filter(Boolean) as string[];
            let activeSessionsMap = new Map<string, any>();
            
            if (friendIds.length > 0) {
                const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
                const { data: activeSessions } = await supabase
                    .from('workout_sessions')
                    .select('id, user_id, partner_id, started_at, is_multiplayer, multiplayer_mode, partner_session_id')
                    .or(`user_id.in.(${friendIds.join(',')}),partner_id.in.(${friendIds.join(',')})`)
                    .is('finished_at', null)
                    .gt('started_at', twelveHoursAgo);
                
                if (activeSessions) {
                    friendIds.forEach(fId => {
                        const sess = activeSessions.find(s => s.user_id === fId || s.partner_id === fId);
                        if (sess) {
                            activeSessionsMap.set(fId, sess);
                        }
                    });
                }
            }

            // Map and sort friends: active workouts at the top
            const enrichedFriends = data.map(f => {
                const activeSession = f.other_user ? activeSessionsMap.get(f.other_user.id) : null;
                return {
                    ...f,
                    activeSession
                };
            });

            // Sort: Entrenando goes first
            const sorted = enrichedFriends.sort((a, b) => {
                const aActive = !!a.activeSession;
                const bActive = !!b.activeSession;
                if (aActive && !bActive) return -1;
                if (!aActive && bActive) return 1;
                return 0;
            });

            setFriends(sorted);
        } catch (e) {
            console.error("Error loading friends:", e);
        }
        setLoading(false);
    };

    const handleInviteToWorkout = async (friend: any, mode: 'conjunto' | 'separado') => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !friend.other_user) return;

        // Anti-spam 2 minutes cooldown
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: recentInvites } = await supabase
            .from('notifications')
            .select('created_at, data')
            .eq('user_id', friend.other_user.id)
            .eq('type', 'coop_invite')
            .gt('created_at', twoMinutesAgo);

        const hasRecent = recentInvites?.some(invite => invite.data?.sender_id === user.id);
        if (hasRecent) {
            alert(`⚠️ Ya has enviado una invitación recientemente. Debes esperar 2 minutos antes de enviar otra a este guerrero.`);
            return;
        }

        // Obtain user name for notification
        const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
            
        const displayName = profile?.username || 'Un amigo';
        const modeLabel = mode === 'conjunto' ? 'CONJUNTO' : 'SEPARADO';

        // Send a custom notification to start a Co-op Workout
        await notificationService.createNotification(friend.other_user.id, {
            type: 'coop_invite',
            title: `🔥 Invitación de Entrenamiento ${modeLabel}`,
            content: `¡${displayName} te ha invitado a entrenar en modo ${modeLabel}!`,
            data: {
                sender_id: user.id,
                sender_name: displayName,
                chat_id: friend.id,
                mode: mode
            }
        });

        alert(`Invitación de Entrenamiento ${modeLabel} enviada a ${friend.other_user.username}.`);
    };

    const handleJoinWorkout = async (friend: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !friend.other_user || !friend.activeSession) return;

        const roomSessionId = friend.activeSession.partner_session_id || friend.activeSession.id;
        const hostId = friend.activeSession.user_id;

        // Obtain host's username to display to the user
        const { data: hostProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', hostId)
            .single();

        const hostName = hostProfile?.username || friend.other_user.username;

        // Obtain our user name for notification
        const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
            
        const displayName = profile?.username || 'Un amigo';

        // Send a coop_join_request notification ALWAYS to the host of the workout session
        await notificationService.createNotification(hostId, {
            type: 'coop_join_request',
            title: `🔥 Solicitud de Unión`,
            content: `¡${displayName} quiere unirse a tu entrenamiento!`,
            data: {
                sender_id: user.id,
                sender_name: displayName,
                chat_id: friend.id,
                session_id: roomSessionId
            }
        });

        alert(`Solicitud para unirse al entrenamiento enviada a @${hostName}.`);
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
                                  const isTraining = !!friend.activeSession;
                            const isCoop = friend.activeSession?.is_multiplayer && friend.activeSession?.multiplayer_mode === 'conjunto';
                            
                            const statusText = isTraining 
                                ? (isCoop ? "🔥 Entrenando en Conjunto" : "⚡ Entrenando") 
                                : "Inactivo";

                            return (
                                <div key={friend.id} className={`border rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden group transition-all duration-300 ${
                                    isTraining 
                                        ? 'bg-neutral-900/80 border-yellow-500/30 shadow-[0_0_20px_rgba(250,204,21,0.1)]' 
                                        : 'bg-neutral-900 border-neutral-800'
                                }`}>
                                    {/* Pulse Background for training */}
                                    {isTraining && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-transparent pointer-events-none" />
                                    )}

                                    {/* Avatar */}
                                    <div className={`w-14 h-14 rounded-full overflow-hidden border-2 flex-shrink-0 relative ${
                                        isTraining ? 'border-yellow-500 shadow-[0_0_12px_rgba(250,204,21,0.25)]' : 'border-neutral-700'
                                    }`}>
                                        <FadeInImage src={other.avatar_url || `https://ui-avatars.com/api/?name=${other.username}&background=2A2A2A&color=fff`} />
                                        {isTraining && (
                                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-yellow-500 border-2 border-neutral-900 rounded-full animate-ping" />
                                        )}
                                    </div>
                                    
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-black text-lg uppercase truncate tracking-tight leading-none mb-1 group-hover:text-yellow-400 transition-colors ${
                                            isTraining ? 'text-yellow-500 italic' : 'text-white'
                                        }`}>
                                            {other.username}
                                        </h3>
                                        <p className={`text-[10px] font-black tracking-widest uppercase ${
                                            isTraining ? 'text-yellow-500 animate-pulse' : 'text-neutral-500'
                                        }`}>
                                            {statusText}
                                        </p>
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div className="flex flex-col gap-2 shrink-0 relative z-10">
                                        {isTraining && (
                                            <button 
                                                onClick={() => handleJoinWorkout(friend)}
                                                className="h-10 px-4 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(250,204,21,0.4)] active:scale-95 transition-all hover:scale-105 border border-yellow-400"
                                            >
                                                <Zap size={13} fill="currentColor" /> UNIRSE
                                            </button>
                                        )}
                                    </div>
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
