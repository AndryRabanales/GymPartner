import { MapPin, LogIn, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { UploadModal } from '../components/social/UploadModal';
import { BottomNav } from '../components/navigation/BottomNav';
import { useBottomNav } from '../context/BottomNavContext';
import { NotificationBell } from '../components/ui/NotificationBell';
import { RescueModal } from '../components/gamification/RescueModal';
import { GPointsDisplay } from '../components/gamification/GPointsDisplay';

import { ActiveWorkoutBubble } from '../components/workout/ActiveWorkoutBubble';
import { useAutoCheckin } from '../hooks/useAutoCheckin';
import { GlobalGPSGuard } from '../components/GlobalGPSGuard';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

export const AppLayout = () => {
    useAutoCheckin();
    const { user, signOut } = useAuth();
    const { isBottomNavVisible } = useBottomNav();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const location = useLocation();

    // Subscribe to real-time live workout notifications
    useEffect(() => {
        if (!user) return;

        console.log("🔔 Subscribing to real-time notifications for live workouts...");
        const channel = supabase
            .channel(`user-notifications:${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, async (payload) => {
                const newNotification = payload.new;
                console.log("🔔 Real-time notification received:", newNotification);
                
                if (newNotification.type === 'system' && (newNotification.title?.includes('EN VIVO') || newNotification.title?.includes('FINALIZADO'))) {
                    const isLive = newNotification.title?.includes('EN VIVO');
                    const senderId = newNotification.data?.sender_id;
                    let avatarUrl = null;
                    let displayName = newNotification.data?.sender_name || 'Tu amigo';

                    if (senderId) {
                        try {
                            const { data: profile } = await supabase
                                .from('profiles')
                                .select('username, full_name, avatar_url')
                                .eq('id', senderId)
                                .maybeSingle();
                            if (profile) {
                                avatarUrl = profile.avatar_url;
                                displayName = profile.full_name || profile.username || displayName;
                            }
                        } catch (err) {
                            console.error("Error retrieving sender profile for toast:", err);
                        }
                    }

                    toast.custom((t) => (
                        <div 
                            className={`${t.visible ? 'gp-toast-enter' : 'gp-toast-leave'} max-w-sm w-full bg-neutral-950/95 backdrop-blur-2xl border ${isLive ? 'border-red-500/40 shadow-[0_20px_50px_rgba(239,68,68,0.25)]' : 'border-green-500/40 shadow-[0_20px_50px_rgba(34,197,94,0.25)]'} rounded-3xl pointer-events-auto flex p-4 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-300`}
                            onClick={() => {
                                toast.dismiss(t.id);
                                if (newNotification.data?.session_id) {
                                    window.location.href = `/history/${newNotification.data.session_id}`;
                                }
                            }}
                        >
                            <div className="flex-1 w-0">
                                <div className="flex items-center gap-3">
                                    <div className="shrink-0 relative">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt={displayName} className="w-11 h-11 rounded-full object-cover border border-white/10" />
                                        ) : (
                                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center border border-white/10">
                                                <span className="text-sm font-black text-gym-primary italic">
                                                    {displayName?.[0]?.toUpperCase() || 'G'}
                                                </span>
                                            </div>
                                        )}
                                        <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border border-black ${isLive ? 'bg-red-500 text-white animate-pulse' : 'bg-green-500 text-black'}`}>
                                            <div className="w-2 h-2 rounded-full bg-current" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">
                                            {isLive ? '🔴 EN VIVO' : '✅ COMPLETADO'}
                                        </p>
                                        <p className="text-xs font-bold text-white leading-tight truncate">
                                            @{displayName}
                                        </p>
                                        <p className="text-[10px] text-neutral-300 font-medium leading-tight mt-0.5 truncate">
                                            {isLive 
                                                ? `Empezó a entrenar en ${newNotification.data?.gym_name || 'un Gimnasio'}` 
                                                : `Terminó su entrenamiento en ${newNotification.data?.gym_name || 'un Gimnasio'}`
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="ml-4 shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => toast.dismiss(t.id)}
                                    className="border border-white/10 hover:bg-white/5 rounded-xl px-3 py-1.5 text-[9px] font-black text-neutral-400 hover:text-white transition-colors uppercase tracking-widest"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    ), { duration: 5000, position: 'top-right' });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);
    
    // Pages where the global header should be hidden
    const isRadarPage = location.pathname === '/radar';
    const isRankingPage = location.pathname === '/ranking';
    const isChatPage = location.pathname === '/inbox' || location.pathname.startsWith('/chat/');
    const isReelsPage = location.pathname === '/reels';
    
    const shouldHideHeader = isRadarPage || isRankingPage || isChatPage || isReelsPage;

    // Hide BottomNav during workout sessions, gym territory pages, arsenal, stats, and history
    const isWorkoutPage = location.pathname === '/workout' || location.pathname.includes('/territory/');
    const isContentPage = location.pathname === '/arsenal' || location.pathname === '/stats' || location.pathname === '/history' || location.pathname.startsWith('/history/');
    const shouldShowBottomNav = user && !isWorkoutPage && !isContentPage && isBottomNavVisible;

    return (
        <div className="h-[100dvh] text-white flex flex-col overflow-hidden relative">
            <style>{`
                @keyframes gpSlideInRight {
                    from { transform: translateX(120%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes gpSlideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(120%); opacity: 0; }
                }
                .gp-toast-enter {
                    animation: gpSlideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .gp-toast-leave {
                    animation: gpSlideOutRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
            {/* Texture overlay for more depth */}
            <div className="fixed inset-0 bg-black/20 pointer-events-none z-0"></div>
            
            {/* Top Navigation - Floating Dock Style (Hidden on specific pages) */}
            {!shouldHideHeader && (
                <header className="fixed top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-7xl z-50 animate-in slide-in-from-top-8 duration-700">
                    <nav className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        <div className="px-3 sm:px-6">
                            <div className="flex items-center justify-between h-14 sm:h-16">
                                <Link to="/" className="flex items-center gap-2 no-underline group">
                                    <div className="relative group flex items-center gap-1.5">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-white/5 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                            <img
                                                src="/logo-gp.png"
                                                alt="GymPartner"
                                                className="h-9 w-auto sm:h-11 relative z-10 transition-all duration-500 group-hover:scale-110 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] animate-in zoom-in-50 duration-700"
                                            />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-black text-lg sm:text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-500 italic leading-none group-hover:from-gym-primary group-hover:to-yellow-600 transition-all duration-500 uppercase" style={{ fontFamily: 'Impact, sans-serif' }} translate="no">
                                                GYMPARTNER
                                            </span>
                                            <span className="hidden sm:block text-[8px] font-black tracking-[0.3em] text-neutral-500 uppercase leading-none mt-0.5 group-hover:text-white transition-colors" translate="no">
                                                Intelligence
                                            </span>
                                        </div>
                                    </div>
                                </Link>

                                <nav className="hidden md:flex items-center bg-white/5 rounded-full p-1 border border-white/5 backdrop-blur-md">
                                    {[
                                        { to: "/", label: "Inicio" },
                                        { to: "/map", label: "Mapa" },
                                        { to: "/ranking", label: "Rankings" },
                                    ].map((link) => (
                                        <Link
                                            key={link.to}
                                            to={link.to}
                                            className="px-5 py-2 text-sm font-bold text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200 no-underline"
                                        >
                                            {link.label}
                                        </Link>
                                    ))}
                                </nav>

                                <div className="flex items-center gap-4 sm:gap-8">
                                    {user && <GPointsDisplay />}
                                    
                                    <div className="flex items-center gap-3">
                                        {user && <NotificationBell />}
                                        {user ? (
                                            <div className="relative z-50">
                                                <button
                                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                                    className="flex items-center gap-1.5 bg-neutral-900/50 hover:bg-neutral-800 pl-0.5 pr-3 py-1 rounded-2xl border border-white/5 hover:border-gym-primary/30 transition-all shadow-lg group/avatar"
                                                >
                                                    <div className="relative w-7 h-7 sm:w-8 sm:h-8">
                                                        <div className="absolute inset-0 bg-gym-primary blur-md rounded-full opacity-0 group-hover/avatar:opacity-40 transition-opacity"></div>
                                                        <img
                                                            src={user.user_metadata.avatar_url}
                                                            alt="Avatar"
                                                            className="relative w-full h-full rounded-full object-cover border border-white/10"
                                                        />
                                                    </div>
                                                    <span className="hidden sm:block text-[10px] font-black text-neutral-400 group-hover/avatar:text-white transition-colors uppercase tracking-widest">
                                                        {user.user_metadata.full_name?.split(' ')[0]}
                                                    </span>
                                                </button>

                                                {isUserMenuOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-[90]" onClick={() => setIsUserMenuOpen(false)}></div>
                                                        <div className="absolute right-0 mt-4 w-60 bg-neutral-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-[100]">
                                                            <div className="px-4 py-3 border-b border-white/5 mb-2 bg-white/2">
                                                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Cuenta</p>
                                                                <p className="text-sm font-bold text-white truncate">{user.user_metadata.full_name}</p>
                                                            </div>
                                                            <div className="border-t border-white/5 mt-2 pt-2 mx-2">
                                                                <button
                                                                    onClick={() => {
                                                                        signOut();
                                                                        setIsUserMenuOpen(false);
                                                                    }}
                                                                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-bold flex items-center gap-3 rounded-xl"
                                                                >
                                                                    <LogOut size={16} /> Cerrar Sesión
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <Link
                                                to="/login"
                                                className="hidden md:flex items-center gap-2 bg-gym-primary text-black hover:bg-yellow-400 px-6 py-2.5 rounded-full text-sm font-black tracking-wide transition-all shadow-[0_0_20px_rgba(250,204,21,0.15)] hover:shadow-[0_0_30px_rgba(250,204,21,0.3)] hover:-translate-y-0.5 no-underline"
                                            >
                                                <LogIn size={18} strokeWidth={2.5} />
                                                <span>ENTRAR</span>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </nav>
                </header>
            )}

            <GlobalGPSGuard />

            <main 
                key={location.pathname} 
                className={`flex-1 overflow-y-auto custom-scrollbar relative flex flex-col animate-in fade-in duration-500 ${shouldHideHeader ? 'pt-0 pb-16' : 'pt-28 pb-32'}`}
            >
                <Outlet />
            </main>

            <RescueModal />
            {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onSuccess={() => setIsUploadModalOpen(false)} />}
            <ActiveWorkoutBubble />
            {shouldShowBottomNav && <BottomNav onUploadClick={() => setIsUploadModalOpen(true)} />}
            <Toaster position="top-center" reverseOrder={false} />

        </div>
    );
};
