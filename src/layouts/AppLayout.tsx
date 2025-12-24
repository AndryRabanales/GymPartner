import { Dumbbell, MapPin, Menu, LogIn, Trophy, Users, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, Outlet } from 'react-router-dom';

export const AppLayout = () => {
    const { user, signOut } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
            {/* Navbar - Premium Glassmorphism */}
            <nav className="border-b border-white/5 bg-neutral-950/80 backdrop-blur-xl sticky top-0 z-50 transition-all duration-300">
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
                                    <span className="font-black text-xl sm:text-2xl tracking-widest text-white italic leading-none group-hover:text-gym-primary transition-colors uppercase drop-shadow-md" style={{ fontFamily: 'Impact, sans-serif', WebkitTextStroke: '1px black' }}>
                                        GYMPARTNER
                                    </span>
                                    <span className="text-[10px] font-bold tracking-[0.2em] text-neutral-500 uppercase leading-none group-hover:text-white transition-colors">
                                        Intelligence
                                    </span>
                                </div>
                            </div>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center bg-white/5 rounded-full p-1 border border-white/5 backdrop-blur-md">
                            {[
                                { to: "/", label: "Inicio" },
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
                            {/* Map Quick Action */}
                            <Link to="/map" className="hidden sm:flex w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 items-center justify-center text-neutral-400 hover:text-gym-primary hover:border-gym-primary/50 transition-all hover:shadow-[0_0_15px_rgba(234,179,8,0.15)] group">
                                <MapPin size={18} className="group-hover:scale-110 transition-transform" />
                            </Link>

                            {user ? (
                                <div className="relative group z-50">
                                    <button
                                        className="flex items-center gap-3 bg-neutral-900/50 hover:bg-neutral-800 pl-1 pr-4 py-1 rounded-full border border-white/5 hover:border-white/20 transition-all group-hover:shadow-lg group-hover:shadow-black/50"
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

                                    {/* Dropdown Menu */}
                                    <div className="absolute right-0 mt-4 w-60 bg-neutral-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl py-2 opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 transform origin-top-right translate-y-2 group-focus-within:translate-y-0 z-[100]">
                                        <div className="px-4 py-3 border-b border-white/5 mb-2 bg-white/2">
                                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Cuenta</p>
                                            <p className="text-sm font-bold text-white truncate">{user.user_metadata.full_name}</p>
                                        </div>



                                        <div className="border-t border-white/5 mt-2 pt-2 mx-2">
                                            <button
                                                onClick={() => signOut()}
                                                className="w-full text-left px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-bold flex items-center gap-3 rounded-xl"
                                            >
                                                <LogOut size={16} /> Cerrar Sesión
                                            </button>
                                        </div>
                                    </div>
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

                            {/* Mobile Menu Button - Glassy */}
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="md:hidden w-10 h-10 rounded-xl bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:border-gym-primary/50 transition-all active:scale-95"
                            >
                                <Menu size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Overlay */}
                {isMobileMenuOpen && (
                    <div className="md:hidden absolute top-[calc(100%+1px)] left-0 w-full bg-neutral-950/95 backdrop-blur-2xl border-b border-white/10 shadow-2xl animate-in slide-in-from-top-2 duration-200">
                        <div className="flex flex-col p-4 space-y-2">
                            {[
                                { to: "/", label: "INICIO", icon: <Dumbbell size={18} className="text-gym-primary" /> },
                                { to: "/map", label: "MAPA", icon: <MapPin size={18} className="text-blue-400" /> },
                                { to: "/ranking", label: "RANKINGS", icon: <Trophy size={18} className="text-yellow-400" /> },
                                { to: "/community", label: "COMUNIDAD", icon: <Users size={18} className="text-green-400" /> }
                            ].map((item) => (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="px-4 py-4 rounded-2xl bg-neutral-900/50 border border-white/5 hover:bg-white/10 text-neutral-300 hover:text-white font-bold text-sm flex items-center gap-4 transition-all no-underline"
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </Link>
                            ))}

                            {/* Mobile User Actions */}
                            {user && (
                                <>
                                    <div className="h-px bg-white/5 my-2"></div>
                                    <div className="h-px bg-white/5 my-2"></div>
                                    <button
                                        onClick={() => { signOut(); setIsMobileMenuOpen(false); }}
                                        className="mt-2 w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-2xl py-4 font-black tracking-wide text-sm transition-all"
                                    >
                                        <span>CERRAR SESIÓN</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            {/* Main Content */}
            <main className="flex-1 flex flex-col">
                <Outlet />
            </main>

            {/* Simple Footer */}
            <footer className="border-t border-neutral-800 py-8 bg-neutral-900 mt-auto">
                <div className="max-w-7xl mx-auto px-4 text-center text-neutral-500 text-sm">
                    <p>© 2024 GymIntelligence. Built for the dedicated.</p>
                </div>
            </footer>
        </div>
    );
};
