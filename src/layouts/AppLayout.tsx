import { MapPin, LogIn, LogOut, PlusSquare } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, Outlet } from 'react-router-dom';
import { UploadModal } from '../components/social/UploadModal';
import { BottomNav } from '../components/navigation/BottomNav';

export const AppLayout = () => {
    const { user, signOut } = useAuth();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

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
                            {/* Map Quick Action */}
                            <Link to="/map" className="hidden sm:flex w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 items-center justify-center text-neutral-400 hover:text-gym-primary hover:border-gym-primary/50 transition-all hover:shadow-[0_0_15px_rgba(234,179,8,0.15)] group">
                                <MapPin size={18} className="group-hover:scale-110 transition-transform" />
                            </Link>

                            {/* Create Post Action (Logged In) */}
                            {user && (
                                <button
                                    onClick={() => setIsUploadModalOpen(true)}
                                    className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-yellow-500 hover:border-yellow-500/50 transition-all hover:shadow-[0_0_15px_rgba(234,179,8,0.15)] group active:scale-95"
                                    title="Nuevo Post"
                                >
                                    <PlusSquare size={20} className="group-hover:scale-110 transition-transform" />
                                </button>
                            )}

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

            {/* Main Content */}
            <main className="flex-1 flex flex-col mb-16 md:mb-0">
                <Outlet />
            </main>

            {/* Global Modals */}
            {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onSuccess={() => setIsUploadModalOpen(false)} />}

            {/* MOBILE BOTTOM NAVIGATION */}
            <BottomNav onUploadClick={() => setIsUploadModalOpen(true)} />

            {/* Premium GymRat Footer */}
            <footer className="border-t border-neutral-900 bg-neutral-950 pt-16 pb-24 md:pb-8 mt-auto relative overflow-hidden">
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16 text-center md:text-left">

                        {/* Column 1: Brand */}
                        <div className="col-span-1 md:col-span-2 space-y-4">
                            <div className="flex items-center justify-center md:justify-start gap-2">
                                <div className="h-8 w-8 bg-yellow-500 rounded flex items-center justify-center font-black text-black text-xl italic">
                                    GP
                                </div>
                                <span className="font-black text-2xl text-white italic tracking-tighter uppercase">GYMPARTNER</span>
                            </div>
                            <p className="text-neutral-500 text-sm font-medium leading-relaxed max-w-sm mx-auto md:mx-0">
                                La plataforma de alto rendimiento para atletas comprometidos con su progreso.
                                Gestiona tu entrenamiento, analiza tus métricas y alcanza tu máximo potencial.
                            </p>
                            <div className="flex gap-4 justify-center md:justify-start pt-2">
                                {/* Fake Socials */}
                                <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-yellow-500 hover:border-yellow-500/50 transition-all cursor-pointer">
                                    <span className="font-bold text-xs">IG</span>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-yellow-500 hover:border-yellow-500/50 transition-all cursor-pointer">
                                    <span className="font-bold text-xs">TW</span>
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Protocolos */}
                        <div className="space-y-4">
                            <h4 className="text-white font-bold uppercase tracking-widest text-xs border-b border-yellow-500/20 pb-2 inline-block">Protocolos</h4>
                            <ul className="space-y-2 text-sm text-neutral-500">
                                <li><Link to="/map" className="hover:text-yellow-500 transition-colors">Mapa Táctico</Link></li>
                                <li><Link to="/ranking" className="hover:text-yellow-500 transition-colors">Leaderboard Global</Link></li>
                                <li><Link to="/arsenal" className="hover:text-yellow-500 transition-colors">Arsenal Personal</Link></li>
                                <li><a href="#" className="hover:text-yellow-500 transition-colors">Reportar Bug</a></li>
                            </ul>
                        </div>

                        {/* Column 3: Legal */}
                        <div className="space-y-4">
                            <h4 className="text-white font-bold uppercase tracking-widest text-xs border-b border-yellow-500/20 pb-2 inline-block">Inteligencia</h4>
                            <ul className="space-y-2 text-sm text-neutral-500">
                                <li><a href="#" className="hover:text-white transition-colors">Términos de Servicio</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Privacidad</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Manifiesto</a></li>
                            </ul>
                        </div>
                    </div>

                    {/* Bottom Bar */}
                    <div className="border-t border-neutral-900 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-neutral-600 text-xs font-mono">
                            SYSTEM STATUS: <span className="text-green-500">ONLINE</span>
                        </p>
                        <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">
                            © 2024 GYMPARTNER OPS
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};
