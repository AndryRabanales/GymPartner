import { useAuth } from '../context/AuthContext';
import { Copy, CheckCircle, ExternalLink } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

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
    const [copied, setCopied] = useState(false);
    const [pulse, setPulse] = useState(true);
    const currentUrl = window.location.href;

    // Keep pulsing the dot indicator forever to draw attention
    useEffect(() => {
        const interval = setInterval(() => setPulse(p => !p), 900);
        return () => clearInterval(interval);
    }, []);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(currentUrl);
        } catch (_) {
            // Fallback for older iOS
            const el = document.createElement('textarea');
            el.value = currentUrl;
            el.style.position = 'fixed';
            el.style.opacity = '0';
            document.body.appendChild(el);
            el.focus();
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
    };

    return (
        <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 9999 }}>

            {/* Simulated browser top bar — mirrors Instagram IAB chrome */}
            <div className="relative flex items-center justify-between px-4 pt-12 pb-3 bg-neutral-950 border-b border-neutral-800">
                <div className="w-8" /> {/* Spacer for X button */}
                <span className="text-neutral-400 text-xs font-medium truncate max-w-[60%]">
                    gympartner-production.up.railway.app
                </span>

                {/* The ⋯ button — highlighted with pulsing ring */}
                <div className="relative flex items-center justify-center w-8 h-8">
                    {/* Pulsing glow ring */}
                    <div
                        className="absolute inset-0 rounded-full border-2 border-gym-primary"
                        style={{
                            transform: pulse ? 'scale(1.5)' : 'scale(1.1)',
                            opacity: pulse ? 0 : 0.9,
                            transition: 'all 0.9s ease-in-out',
                        }}
                    />
                    <div
                        className="absolute inset-0 rounded-full bg-gym-primary/30"
                        style={{
                            transform: pulse ? 'scale(1.3)' : 'scale(1)',
                            opacity: pulse ? 0 : 0.5,
                            transition: 'all 0.9s ease-in-out',
                        }}
                    />
                    <span className="text-white text-lg font-black relative z-10">•••</span>
                </div>
            </div>

            {/* Animated arrow pointing UP to the ⋯ button */}
            <div className="flex justify-end pr-5 pt-2">
                <div
                    className="text-gym-primary"
                    style={{
                        transform: pulse ? 'translateY(-4px)' : 'translateY(4px)',
                        transition: 'transform 0.9s ease-in-out',
                    }}
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 19V5" />
                        <polyline points="5 12 12 5 19 12" />
                    </svg>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">

                {/* App icon */}
                <div className="w-16 h-16 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
                    <span className="text-2xl">🔥</span>
                </div>

                <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-2 text-center italic">
                    Un paso más
                </h1>
                <p className="text-neutral-400 text-sm text-center leading-relaxed mb-10 max-w-xs">
                    Estás en el navegador de Instagram. Para continuar, toca{' '}
                    <span className="text-white font-bold">⋯</span> arriba a la derecha y selecciona:
                </p>

                {/* The option to tap — styled like Instagram's native menu item */}
                <div className="w-full max-w-xs bg-neutral-900 border border-neutral-700 rounded-2xl overflow-hidden mb-8 shadow-2xl">
                    <div className="flex items-center gap-4 px-5 py-4">
                        <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center flex-shrink-0">
                            <ExternalLink size={18} className="text-gym-primary" />
                        </div>
                        <div className="text-left">
                            <p className="text-white font-bold text-sm leading-tight">Abrir en navegador externo</p>
                            <p className="text-neutral-500 text-xs mt-0.5">Safari / Chrome</p>
                        </div>
                        {/* Animated selection dot */}
                        <div className="ml-auto">
                            <div
                                className="w-2 h-2 rounded-full bg-gym-primary"
                                style={{
                                    boxShadow: pulse ? '0 0 8px 3px #E5FF00' : '0 0 2px 0px #E5FF00',
                                    transition: 'box-shadow 0.9s ease-in-out',
                                }}
                            />
                        </div>
                    </div>
                    {/* Divider */}
                    <div className="h-px bg-neutral-800 mx-5" />
                    <div className="flex items-center gap-4 px-5 py-3 opacity-30">
                        <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center flex-shrink-0">
                            <Copy size={16} className="text-neutral-400" />
                        </div>
                        <p className="text-neutral-400 text-sm">Copiar enlace</p>
                    </div>
                </div>

                {/* Fallback: copy URL */}
                <p className="text-neutral-600 text-xs mb-3 text-center">
                    ¿No ves esa opción? Copia el enlace y pégalo en Safari o Chrome.
                </p>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 text-sm font-bold py-3 px-6 rounded-xl transition-all active:scale-95"
                    style={{ color: copied ? '#4ade80' : '#e5e5e5' }}
                >
                    {copied
                        ? <><CheckCircle size={15} style={{ color: '#4ade80' }} /> ¡Enlace copiado al portapapeles!</>
                        : <><Copy size={15} /> Copiar enlace</>
                    }
                </button>
            </div>
        </div>
    );
};

// ── Main Login Page ──────────────────────────────────────────────────────────
export const LoginPage = () => {
    const { signInWithGoogle, signInWithMeta, signInAsDev } = useAuth();
    const [error, setError] = useState<string | null>(null);

    // Show escape screen immediately if inside Instagram/Meta IAB
    if (detectMetaIAB()) {
        return <InstagramEscapeScreen />;
    }

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

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">

                <div className="relative z-10 mb-8">
                    <div className="w-20 h-20 bg-neutral-950 border border-neutral-800 rounded-[1.8rem] flex items-center justify-center mx-auto mb-6 shadow-md">
                        <span className="text-2xl">🔥</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Acceso GymPartner</h1>
                    <p className="text-neutral-400 text-sm">Elige tu método de acceso rápido para continuar.</p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    {/* Google */}
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-neutral-200 transition-all flex items-center justify-center gap-3 shadow-md"
                    >
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                        <span className="text-sm font-black uppercase tracking-wider">Entrar con Google</span>
                    </button>

                    {/* Meta */}
                    <button
                        onClick={handleMetaLogin}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-3.5 rounded-xl hover:from-blue-500 hover:to-blue-600 transition-all flex items-center justify-center gap-3 shadow-md"
                    >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                            <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
                        </svg>
                        <span className="text-sm font-black uppercase tracking-wider">Entrar con Meta</span>
                    </button>
                </div>

                {/* Dev bypass — localhost only */}
                {import.meta.env.DEV && (
                    <div className="mt-6 pt-4 border-t border-white/5">
                        <button
                            onClick={() => signInAsDev && signInAsDev()}
                            className="w-full bg-neutral-800 text-neutral-400 font-bold py-3 rounded-xl hover:bg-neutral-700 hover:text-white transition-all flex items-center justify-center gap-2 text-sm border border-neutral-700 border-dashed"
                        >
                            <span>🛠️ Modo Desarrollo (Localhost Bypass)</span>
                        </button>
                        <p className="text-[10px] text-neutral-500 mt-2">
                            Usa esto si Supabase te redirige a producción.
                        </p>
                    </div>
                )}

                <p className="mt-6 text-xs text-neutral-600">
                    Al continuar, aceptas nuestros términos de servicio.
                </p>
            </div>
        </div>
    );
};
