import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/NotificationService';
import type { Notification } from '../services/NotificationService';
import { FadeInImage } from '../components/ui/FadeInImage';
import { Zap, UserPlus, MapPin, Check, X, Bell } from 'lucide-react';

interface ExtendedNotification extends Notification {
    sender?: {
        username: string;
        avatar_url: string | null;
    };
}

const groupNotifications = (notifs: ExtendedNotification[]) => {
    const today: ExtendedNotification[] = [];
    const thisWeek: ExtendedNotification[] = [];
    const earlier: ExtendedNotification[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    notifs.forEach(n => {
        const date = new Date(n.created_at);
        if (date >= todayStart) {
            today.push(n);
        } else if (date >= weekStart) {
            thisWeek.push(n);
        } else {
            earlier.push(n);
        }
    });

    return { today, thisWeek, earlier };
};

export const NotificationsPage = () => {
    const [notifications, setNotifications] = useState<ExtendedNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadNotifications();

        const setupSub = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const notifySub = supabase
                .channel('notifications-page')
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                    () => {
                        loadNotifications();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(notifySub);
            };
        };

        const cleanup = setupSub();
        return () => {
            cleanup.then(fn => fn && fn());
        };
    }, []);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const all = await notificationService.getNotifications(50);
            
            const senderIds = Array.from(new Set(all.map(n => n.data?.sender_id || n.data?.new_member_id).filter(Boolean)));
            
            if (senderIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', senderIds);
                
                const profileMap = (profiles || []).reduce((acc: Record<string, any>, p) => {
                    acc[p.id] = p;
                    return acc;
                }, {});

                const extended = all.map(n => ({
                    ...n,
                    sender: profileMap[n.data?.sender_id || n.data?.new_member_id]
                }));
                setNotifications(extended);
            } else {
                setNotifications(all);
            }

            // Mark all as read when opening page
            if (all.some(n => !n.is_read)) {
                await notificationService.markAllAsRead();
            }

        } catch (error) {
            console.error("Error loading notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (notification: Notification) => {
        const senderId = notification.data?.sender_id;
        if (!senderId) return;

        setNotifications(prev => prev.map(n =>
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
        setNotifications(prev => prev.map(n =>
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

    const renderNotification = (n: ExtendedNotification) => {
        const status = n.data?.status;
        
        // Base layout for standard notifications (follower, gym_join, system)
        if (n.type !== 'invitation') {
            return (
                <div key={n.id} className="flex items-center gap-4 py-3 group">
                    <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-neutral-800 to-neutral-600">
                            <div className="w-full h-full rounded-full bg-neutral-900 overflow-hidden flex items-center justify-center border border-white/10 relative cursor-pointer" onClick={() => navigate(`/user/${n.data?.sender_id || n.data?.new_member_id || ''}`)}>
                                {n.sender?.avatar_url ? (
                                    <FadeInImage src={n.sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center">
                                        <span className="text-lg font-black text-gym-primary italic">
                                            {n.sender?.username?.[0].toUpperCase() || 'G'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {n.type === 'follower' && (
                            <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1 rounded-full border-2 border-black shadow-lg">
                                <UserPlus size={10} strokeWidth={3} />
                            </div>
                        )}
                        {n.type === 'gym_join' && (
                            <div className="absolute -bottom-1 -right-1 bg-red-500 text-white p-1 rounded-full border-2 border-black shadow-lg">
                                <MapPin size={10} strokeWidth={3} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs text-neutral-300 font-medium leading-tight">
                            <span className="font-bold text-white mr-1 cursor-pointer hover:text-gym-primary" onClick={() => navigate(`/user/${n.data?.sender_id || n.data?.new_member_id || ''}`)}>
                                {n.sender?.username || n.data?.sender_name || 'Alguien'}
                            </span>
                            {n.type === 'follower' && 'ha comenzado a seguirte.'}
                            {n.type === 'gym_join' && `se ha unido a tu sede.`}
                            {n.type === 'system' && n.message}
                        </p>
                        <span className="text-[10px] text-neutral-600 font-bold mt-0.5 block">{new Date(n.created_at).toLocaleDateString()}</span>
                    </div>
                    {n.type === 'follower' && (
                        <button onClick={() => navigate(`/user/${n.data?.sender_id}`)} className="shrink-0 bg-neutral-900 border border-white/10 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl hover:bg-white/10 transition-colors">
                            Ver Perfil
                        </button>
                    )}
                    {n.type === 'gym_join' && (
                        <button onClick={() => navigate(`/territory/${n.data?.gym_id}`)} className="shrink-0 bg-gym-primary/20 text-gym-primary border border-gym-primary/30 text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl hover:bg-gym-primary hover:text-black transition-colors">
                            Ranking
                        </button>
                    )}
                </div>
            );
        }

        // Render for invitations (matches)
        return (
            <div 
                key={n.id} 
                className={`bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-5 shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition-all group my-2 ${status ? 'opacity-60 grayscale-[0.5]' : 'hover:border-gym-primary/30'}`}
            >
                <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                        <div className="absolute -inset-1 bg-gym-primary rounded-full blur-md opacity-0 group-hover:opacity-20 transition-opacity"></div>
                        <div className={`w-16 h-16 rounded-full p-0.5 ${status ? 'bg-neutral-800' : 'bg-gradient-to-tr from-neutral-800 to-neutral-600'}`}>
                            <div className="w-full h-full rounded-full bg-neutral-900 overflow-hidden flex items-center justify-center border border-white/10 relative cursor-pointer" onClick={() => navigate(`/user/${n.data?.sender_id}`)}>
                                {n.sender?.avatar_url ? (
                                    <FadeInImage src={n.sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center">
                                        <span className="text-xl font-black text-gym-primary italic">
                                            {n.sender?.username?.[0].toUpperCase() || 'G'}
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
                                {new Date(n.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <p className={`text-xs font-medium leading-relaxed ${status ? 'text-neutral-600' : 'text-neutral-400'}`}>
                            <span className={`${status ? 'text-neutral-500' : 'text-gym-primary'} font-black uppercase italic mr-1 cursor-pointer`} onClick={() => navigate(`/user/${n.data?.sender_id}`)}>
                                @{n.sender?.username || 'guerrero'}
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
                                onClick={() => handleReject(n)}
                                className="flex-1 py-3 px-4 rounded-2xl bg-neutral-900 text-neutral-500 font-black text-[10px] uppercase tracking-widest border border-white/5 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <X size={14} />
                                IGNORAR
                            </button>
                            <button
                                onClick={() => handleAccept(n)}
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
    };

    const { today, thisWeek, earlier } = groupNotifications(notifications);

    return (
        <div className="flex-1 flex flex-col bg-transparent pb-20">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-xl border-b border-white/5 px-4 py-4 flex items-center gap-3">
                <h1 className="text-xl font-black italic uppercase text-white tracking-widest flex items-center gap-2">
                    <Bell size={20} className="text-gym-primary" />
                    Notificaciones
                </h1>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-neutral-500 gap-3">
                        <div className="w-8 h-8 border-2 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Cargando...</span>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-20 h-20 bg-neutral-900 rounded-[2.5rem] flex items-center justify-center mb-6 text-neutral-700">
                            <Bell size={40} />
                        </div>
                        <h3 className="text-xl font-black text-white italic mb-2 uppercase tracking-tighter">SIN ACTIVIDAD</h3>
                        <p className="text-xs text-neutral-500 max-w-xs font-medium">Cuando interactúes con otros guerreros, tus notificaciones aparecerán aquí.</p>
                        <button onClick={() => navigate('/radar')} className="mt-8 bg-white text-black px-8 py-3 rounded-2xl font-black text-sm tracking-tighter hover:bg-gym-primary transition-all active:scale-95 shadow-xl">
                            IR AL RADAR
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 max-w-2xl mx-auto w-full">
                        {today.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-sm font-black text-white px-2 mb-4">Hoy</h2>
                                <div className="flex flex-col gap-2">
                                    {today.map(renderNotification)}
                                </div>
                            </div>
                        )}
                        {thisWeek.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-sm font-black text-white px-2 mb-4">Esta semana</h2>
                                <div className="flex flex-col gap-2">
                                    {thisWeek.map(renderNotification)}
                                </div>
                            </div>
                        )}
                        {earlier.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-sm font-black text-white px-2 mb-4">Anteriores</h2>
                                <div className="flex flex-col gap-2">
                                    {earlier.map(renderNotification)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
