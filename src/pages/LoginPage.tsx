import { useAuth } from '../context/AuthContext';
import { ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// ── Detect Meta / Instagram in-app browser ──────────────────────────────────
function detectMetaIAB() {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    const isIAB =
        ua.includes('Instagram') ||
        ua.includes('FBAN') ||
        ua.includes('FBAV') ||
        ua.includes('FBIOS') ||
        ua.includes('FB_IAB') ||
        ua.includes('Messenger');
    return isIAB;
}

// ── Premium Instagram escape screen ─────────────────────────────────────────
const InstagramEscapeScreen = () => {
    const [pulse, setPulse] = useState(true);
    const [highlightGuide, setHighlightGuide] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => setPulse(p => !p), 800);
        return () => clearInterval(interval);
    }, []);

    const ua = navigator.userAgent || navigator.vendor || '';
    const isAndroid = /android/i.test(ua);

    const handleEscapeClick = () => {
        if (isAndroid) {
            // Android Chrome Intent escape trigger
            const cleanUrl = window.location.href.replace(/^https?:\/\//, '');
            window.location.href = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
        } else {
            // Trigger interactive highlight pulse for iOS Safari guide
            setHighlightGuide(true);
            setTimeout(() => setHighlightGuide(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center p-6 z-[9999] overflow-hidden">
            {/* Ambient background glows */}
            <div className="absolute w-[300px] h-[300px] bg-gym-primary/10 rounded-full blur-[120px] top-1/4 pointer-events-none animate-pulse"></div>
            <div className="absolute w-[250px] h-[250px] bg-yellow-500/5 rounded-full blur-[100px] bottom-1/4 pointer-events-none"></div>

            {/* Top-right escape indicator: Arrow pointing directly up to Instagram's ⋯ button with explanation text below it */}
            <div className={`absolute top-4 right-4 flex flex-col items-end z-50 pointer-events-none transition-all duration-300 ${highlightGuide ? 'scale-105' : ''}`}>
                {/* Arrow pointing up */}
                <div
                    className="text-gym-primary mr-2 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]"
                    style={{
                        transform: pulse ? 'translateY(1px)' : 'translateY(-5px)',
                        transition: 'transform 0.3s ease-in-out',
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5"></line>
                        <polyline points="5 12 12 5 19 12"></polyline>
                    </svg>
                </div>

                {/* Explanatory instruction box below the arrow */}
                <div className={`bg-neutral-900/95 backdrop-blur-md border ${highlightGuide ? 'border-gym-primary shadow-[0_0_30px_rgba(250,204,21,0.35)] scale-105' : 'border-white/10'} rounded-2xl p-3.5 max-w-[190px] text-right mt-1 shadow-2xl transition-all duration-300`}>
                    <p className="text-[11px] font-black text-gym-primary uppercase tracking-wider leading-tight">
                        Toca los 3 puntos
                    </p>
                    <p className="text-[9px] text-neutral-300 mt-0.5 leading-snug font-bold">
                        y selecciona abrir en tu navegador externo
                    </p>
                </div>
            </div>

            {/* Main content — centered, clean branding */}
            <div className="relative z-10 flex flex-col items-center justify-center max-w-sm w-full text-center px-4">
                
                {/* Ginx Logo Brand */}
                <div className="flex flex-col items-center mb-10">
                    <span className="text-4xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-gym-primary to-yellow-300 uppercase">
                        Ginx
                    </span>
                    <div className="h-[2px] w-12 bg-gym-primary mt-2 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                </div>

                <div className="space-y-3 mb-10">
                    <h1 className="text-2xl font-black text-white uppercase tracking-wider italic leading-none">
                        ¡ABRE LA APP COMPLETA!
                    </h1>
                    <p className="text-neutral-400 text-sm leading-relaxed px-4">
                        Para poder registrar tu sesión con GPS, entrenar con música de fondo y disfrutar de la experiencia premium de GINX.
                    </p>
                </div>

                {/* Action button: direct escape on Android, instruction pulse on iOS */}
                <div className="w-full flex flex-col items-center">
                    <button
                        onClick={handleEscapeClick}
                        className="w-full bg-gradient-to-r from-gym-primary to-yellow-500 hover:from-yellow-300 hover:to-yellow-600 text-neutral-950 font-black py-4 px-6 rounded-2xl shadow-[0_0_30px_rgba(250,204,21,0.3)] hover:shadow-[0_0_40px_rgba(250,204,21,0.5)] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-wider text-sm"
                    >
                        <ExternalLink size={18} strokeWidth={2.5} />
                        <span>Abrir en Navegador</span>
                    </button>
                    
                    <p className="text-neutral-500 text-[10px] text-center mt-3.5 uppercase tracking-widest px-6 font-bold leading-normal">
                        {isAndroid 
                            ? "⚡ Se abrirá Chrome de forma automática" 
                            : "📱 iOS requiere presionar los 3 puntos arriba y 'Abrir en Safari'"}
                    </p>
                </div>
            </div>
        </div>
    );
};


// ── Main Login Page ──────────────────────────────────────────────────────────
export const LoginPage = () => {
    const { signInWithGoogle, signInWithMeta, signInAsDev } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);

    // Show escape screen immediately if inside Instagram/Meta IAB
    if (detectMetaIAB()) {
        return <InstagramEscapeScreen />;
    }

    // Auto-login trigger when coming from Instagram source
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const fromInstagram =
            params.get('utm_source') === 'instagram' ||
            params.get('ref') === 'instagram' ||
            params.get('ref') === 'ig' ||
            document.referrer.includes('instagram.com') ||
            document.referrer.includes('facebook.com');

        if (fromInstagram) {
            console.log("⚡ [Auto-Login] Detected Instagram entry! Triggering direct Meta auth...");
            setIsAutoLoggingIn(true);
            
            // Short delay to let the premium loading screen mount and show smooth transition
            const timer = setTimeout(() => {
                signInWithMeta().catch(err => {
                    console.error("❌ Auto-login failed:", err);
                    setError(err.message || 'Error al iniciar sesión automáticamente con Meta.');
                    setIsAutoLoggingIn(false);
                });
            }, 600);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleGoogleLogin = async () => {
        try {
            setError(null);
            await signInWithGoogle();
        } catch (err: any) {
            setError(err.message || 'Error al conectar con Google.');
        }
    };

    const handleMetaLogin = async () => {
        try {
            setError(null);
            await signInWithMeta();
        } catch (err: any) {
            setError(err.message || 'Error al conectar con Meta.');
        }
    };

    if (isAutoLoggingIn) {
        return (
            <div className="min-h-screen fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center p-6 z-[99999] overflow-hidden">
                {/* Immersive background glow */}
                <div className="absolute w-[350px] h-[350px] bg-gym-primary/10 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>

                <div className="relative z-10 flex flex-col items-center max-w-sm text-center space-y-6 animate-in fade-in zoom-in duration-500">
                    {/* Ginx metallic logo */}
                    <div className="flex flex-col items-center">
                        <span className="text-3xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-gym-primary to-yellow-300 uppercase">
                            Ginx
                        </span>
                        <div className="h-[2px] w-12 bg-gym-primary mt-1.5 rounded-full" />
                    </div>

                    {/* Premium Cyber Loader */}
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <div className="absolute inset-0 border-4 border-neutral-800 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-white text-lg font-black uppercase tracking-wider italic">
                            ACCESO INSTANTÁNEO
                        </h2>
                        <p className="text-neutral-400 text-xs tracking-wider leading-relaxed px-4">
                            Conectando con tu cuenta de Instagram de forma segura. Redirigiendo...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-neutral-950 flex flex-col overflow-hidden">
            {/* Top ambient glow */}
            <div className="absolute w-[400px] h-[400px] bg-gym-primary/6 rounded-full blur-[120px] -top-32 left-1/2 -translate-x-1/2 pointer-events-none" />
            <div className="absolute w-[250px] h-[250px] bg-yellow-500/4 rounded-full blur-[80px] bottom-0 right-0 pointer-events-none" />

            {/* Top branding section */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
                {/* Icon + brand */}
                <div className="w-20 h-20 rounded-3xl overflow-hidden border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] mb-4">
                    <img src="/ginxIcon.png" alt="Ginx" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-3xl font-black italic tracking-tight text-white mb-1">
                    GINX
                </h1>
                <div className="h-px w-12 bg-gym-primary mb-3" />
                <p className="text-neutral-500 text-xs text-center font-bold uppercase tracking-widest">
                    Entrena · Conecta · Compite
                </p>
            </div>

            {/* Bottom actions section */}
            <div className="relative z-10 px-6 pb-8 flex flex-col gap-3">

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs text-center mb-1">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleGoogleLogin}
                    className="w-full bg-white text-black font-black py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg"
                >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                    <span className="text-sm uppercase tracking-wider">Continuar con Google</span>
                </button>

                <button
                    onClick={handleMetaLogin}
                    className="w-full bg-[#1877F2] text-white font-black py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg"
                >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
                    </svg>
                    <span className="text-sm uppercase tracking-wider">Continuar con Meta</span>
                </button>

                {import.meta.env.DEV && (
                    <button
                        onClick={() => signInAsDev && signInAsDev()}
                        className="w-full bg-neutral-800/60 text-neutral-500 font-bold py-3 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 text-xs border border-neutral-700 border-dashed"
                    >
                        🛠️ Dev Bypass
                    </button>
                )}

                <p className="text-[10px] text-neutral-600 leading-relaxed text-center mt-1">
                    Al continuar aceptas nuestros{' '}
                    <Link to="/terms" className="text-neutral-500 underline">Términos</Link>
                    {' '}y{' '}
                    <Link to="/privacy" className="text-neutral-500 underline">Privacidad</Link>.
                </p>
            </div>
        </div>
    );
};
