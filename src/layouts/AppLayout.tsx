import { MapPin, LogIn, LogOut, Trophy } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { UploadModal } from '../components/social/UploadModal';
import { BottomNav } from '../components/navigation/BottomNav';
import { useBottomNav } from '../context/BottomNavContext';
import { NotificationBell } from '../components/ui/NotificationBell';
import { RescueModal } from '../components/gamification/RescueModal';

import { ActiveWorkoutBubble } from '../components/workout/ActiveWorkoutBubble';

export const AppLayout = () => {
    // ... (keep existing hook calls)
    const { user, signOut } = useAuth();
    const { isBottomNavVisible } = useBottomNav();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const location = useLocation();
    const isReelsPage = location.pathname === '/reels';

    // Hide BottomNav during workout sessions, gym territory pages, arsenal, stats, and history
    const isWorkoutPage = location.pathname === '/workout' || location.pathname.includes('/territory/');
    const isContentPage = location.pathname === '/arsenal' || location.pathname === '/stats' || location.pathname === '/history' || location.pathname.startsWith('/history/');
    const isRadarPage = location.pathname === '/radar';
    const shouldShowBottomNav = user && !isWorkoutPage && !isContentPage && isBottomNavVisible;

    return (
        <div className="h-[100dvh] bg-neutral-950 text-white flex flex-col overflow-hidden">
            {/* Top Navigation - Hidden only on Reels */}
            {!isReelsPage && (
                <nav className="border-b border-white/5 bg-neutral-950/80 backdrop-blur-xl sticky top-0 z-50 transition-all duration-300 shrink-0">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16 sm:h-20">
                            <Link to="/" className="flex items-center gap-3 no-underline group">
                                {/* Desktop/Mobile Logo - Custom GP Brand */}
                                <div className="relative group flex items-center gap-3">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-white/5 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                        <img
                                            src="/logo-gp.png"
                                            alt="GymPartner"
                                            className="h-12 w-auto sm:h-14 relative z-10 transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                        />
                                    </div>

                                    {/* Brand Text - GYMRAT STYLE */}
                                    <div className="flex flex-col">
                                        <span className="font-black text-xl sm:text-2xl tracking-widest text-white italic leading-none group-hover:text-gym-primary transition-colors uppercase drop-shadow-md" style={{ fontFamily: 'Impact, sans-serif', WebkitTextStroke: '1px black' }} translate="no">
                                            GYMPARTNER
                                        </span>
                                        <span className="text-[10px] font-bold tracking-[0.2em] text-neutral-500 uppercase leading-none group-hover:text-white transition-colors" translate="no">
                                            Intelligence
                                        </span>
                                    </div>
                                </div>
                            </Link>

                            {/* Desktop Navigation */}
                            <nav className="hidden md:flex items-center bg-white/5 rounded-full p-1 border border-white/5 backdrop-blur-md">
                                {[
                                    { to: "/", label: "Inicio" },
                                    { to: "/reels", label: "Reels" },
                                    { to: "/map", label: "Mapa" },
                                    { to: "/ranking", label: "Rankings" },
                                    { to: "/community", label: "Comunidad" }
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

                            {/* Actions Area */}
                            <div className="flex items-center gap-3">
                                {/* HEADER ACTIONS: MAP & RANKING (Moved from Bottom) */}
                                <Link to="/map" className="flex w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 items-center justify-center text-neutral-400 hover:text-gym-primary hover:border-gym-primary/50 transition-all hover:shadow-[0_0_15px_rgba(234,179,8,0.15)] group">
                                    <MapPin size={20} className="group-hover:scale-110 transition-transform" />
                                </Link>

                                <Link to="/ranking" className="flex w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 items-center justify-center text-neutral-400 hover:text-yellow-400 hover:border-yellow-400/50 transition-all hover:shadow-[0_0_15px_rgba(250,204,21,0.15)] group">
                                    <Trophy size={20} className="group-hover:scale-110 transition-transform" />
                                </Link>

                                {user && <NotificationBell />}

                                {user ? (
                                    <div className="relative z-50">
                                        <button
                                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                            className="flex items-center gap-3 bg-neutral-900/50 hover:bg-neutral-800 pl-1 pr-4 py-1 rounded-full border border-white/5 hover:border-white/20 transition-all shadow-lg shadow-black/50"
                                        >
                                            <div className="relative w-8 h-8">
                                                <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-full animate-pulse opacity-20"></div>
                                                <img
                                                    src={user.user_metadata.avatar_url}
                                                    alt="Avatar"
                                                    className="relative w-full h-full rounded-full object-cover border-2 border-neutral-950 ring-1 ring-white/10"
                                                />
                                            </div>
                                            <span className="hidden sm:block text-sm font-bold text-neutral-300 group-hover:text-white transition-colors">
                                                {user.user_metadata.full_name?.split(' ')[0]}
                                            </span>
                                        </button>

                                        {/* Dropdown Menu - CONTROLLED STATE */}
                                        {isUserMenuOpen && (
                                            <>
                                                {/* Backdrop to close on click outside */}
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
                                ) : null}

                                {/* Desktop/Mobile Login Link if not logged in */}
                                {!user && (
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

                    {/* Mobile Menu Overlay - REMOVED (Replaced by Bottom Nav) */}

                </nav>
            )}

            {/* Main Content (Scrollable Area) */}
            <main className="flex-1 overflow-y-auto custom-scrollbar relative flex flex-col">
                <Outlet />
                {/* Spacer to prevent BottomNav overlap (Only when BottomNav is visible AND NOT on Reels/Radar) */}
                {shouldShowBottomNav && !isReelsPage && !isRadarPage && <div className="h-24 shrink-0" />}
            </main>

            {/* Global Modals */}
            <RescueModal />
            {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onSuccess={() => setIsUploadModalOpen(false)} />}

            {/* Active Session Bubble Check */}
            <ActiveWorkoutBubble />

            {/* MOBILE BOTTOM NAVIGATION (Static Block at Bottom) */}
            {/* Hidden when: logged out, in workout session, or in gym territory pages */}
            {shouldShowBottomNav && <BottomNav onUploadClick={() => setIsUploadModalOpen(true)} />}

            {/* Premium GymRat Footer */}

        </div>
    );
};
