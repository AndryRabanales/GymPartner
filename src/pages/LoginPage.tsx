import { useAuth } from '../context/AuthContext';
import { LogIn, Copy, ExternalLink, Chrome, Loader2, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

// ── Detect Meta / Instagram in-app browser ──────────────────────────────────
function detectMetaIAB(): { isIAB: boolean; isAndroid: boolean; isIOS: boolean } {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    const isIAB =
        ua.includes('Instagram') ||
        ua.includes('FBAN') ||
        ua.includes('FBAV') ||
        ua.includes('FBIOS') ||
        ua.includes('FB_IAB') ||
        ua.includes('Messenger');
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    return { isIAB, isAndroid, isIOS };
}

// ── Try to escape Instagram IAB to the real browser ─────────────────────────
function tryOpenInRealBrowser(): boolean {
    const currentUrl = window.location.href;
    const { isAndroid } = detectMetaIAB();

    if (isAndroid) {
        // Android: intent:// forces Chrome to open the URL
        const intentUrl = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        window.location.href = intentUrl;
        return true;
    }

    // iOS / other: try window.open with _system (works in some cases)
    // and also try the x-safari scheme as a last resort
    try {
        const opened = window.open(currentUrl, '_blank');
        if (opened) return true;
    } catch (_) { /* ignore */ }

    // iOS fallback: x-safari-https (works on some iOS versions)
    try {
        window.location.href = currentUrl.replace('https://', 'x-safari-https://');
        return true;
    } catch (_) { /* ignore */ }

    return false;
}

// ── Premium "Open in Browser" overlay for Instagram IAB ─────────────────────
const InstagramBrowserRedirect = () => {
    const [copied, setCopied] = useState(false);
    const [attempted, setAttempted] = useState(false);
    const currentUrl = window.location.href;
    const { isAndroid, isIOS } = detectMetaIAB();

    // Auto-attempt to redirect on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            const ok = tryOpenInRealBrowser();
            setAttempted(true);
            if (!ok) {
                // Copy URL to clipboard as silent fallback
                try { navigator.clipboard.writeText(currentUrl); } catch (_) { /* ignore */ }
            }
        }, 800);
        return () => clearTimeout(timer);
    }, []);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(currentUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch (_) {
            // Fallback: show URL in prompt
            prompt('Copia este enlace:', currentUrl);
        }
    };

    const handleOpenBrowser = () => {
        tryOpenInRealBrowser();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center">
            {/* Animated background glow */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gym-primary/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center max-w-sm w-full">

                {/* Icon */}
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-gym-primary/20 blur-2xl rounded-full animate-pulse" />
                    <div className="relative w-24 h-24 bg-neutral-900 border border-neutral-700 rounded-[2rem] flex items-center justify-center shadow-2xl">
                        <ExternalLink className="text-gym-primary" size={36} />
                    </div>
                </div>

                {/* Headline */}
                <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-2 italic">
                    Abre en tu navegador
                </h1>
                <p className="text-neutral-400 text-sm leading-relaxed mb-8 max-w-xs">
                    Estás usando el navegador de Instagram. Para iniciar sesión correctamente, necesitas abrirlo en{' '}
                    <span className="text-white font-semibold">{isIOS ? 'Safari' : 'Chrome'}</span>.
                </p>

                {/* Step indicator */}
                <div className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-6 text-left space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-gym-primary/20 border border-gym-primary/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-gym-primary text-xs font-black">1</span>
                        </div>
                        <div>
                            <p className="text-white text-sm font-bold">Abre en {isIOS ? 'Safari' : 'Chrome'}</p>
                            <p className="text-neutral-500 text-xs mt-0.5">
                                {isAndroid
                                    ? 'Toca el botón de abajo o el ícono de los tres puntos (⋮) → "Abrir en Chrome"'
                                    : 'Toca el ícono de compartir (□↑) → "Abrir en Safari"'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-gym-primary/20 border border-gym-primary/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-gym-primary text-xs font-black">2</span>
                        </div>
                        <div>
                            <p className="text-white text-sm font-bold">Inicia sesión con Meta</p>
                            <p className="text-neutral-500 text-xs mt-0.5">
                                Con tu sesión de Facebook ya activa, será solo un toque.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Primary CTA — try to open browser */}
                <button
                    onClick={handleOpenBrowser}
                    className="w-full bg-gym-primary text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 text-sm uppercase tracking-wider mb-3 shadow-lg shadow-gym-primary/20 active:scale-95 transition-all"
                >
                    <Chrome size={18} />
                    Abrir en {isIOS ? 'Safari' : 'Chrome'}
                </button>

                {/* Secondary CTA — copy URL */}
                <button
                    onClick={handleCopy}
                    className="w-full bg-neutral-800 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-3 text-sm border border-neutral-700 active:scale-95 transition-all"
                >
                    {copied
                        ? <><CheckCircle size={16} className="text-green-400" /> <span className="text-green-400">¡Enlace copiado!</span></>
                        : <><Copy size={16} /> Copiar enlace manualmente</>
                    }
                </button>

                {/* URL display */}
                <p className="mt-4 text-neutral-600 text-[10px] break-all leading-relaxed px-2">
                    {currentUrl}
                </p>

                {/* Status message */}
                {attempted && (
                    <p className="mt-3 text-neutral-500 text-xs animate-in fade-in">
                        {isAndroid
                            ? 'Si Chrome no se abrió, copia el enlace y pégalo en Chrome.'
                            : 'Si Safari no se abrió, copia el enlace y pégalo en Safari.'}
                    </p>
                )}
            </div>
        </div>
    );
};

// ── Main Login Page ──────────────────────────────────────────────────────────
export const LoginPage = () => {
    const { signInWithGoogle, signInWithMeta, signInAsDev } = useAuth();
    const [error, setError] = useState<string | null>(null);

    // Detect Meta IAB on render — show redirect screen immediately
    const { isIAB } = detectMetaIAB();
    if (isIAB) {
        return <InstagramBrowserRedirect />;
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
