import { useAuth } from '../context/AuthContext';
import { LogIn, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export const LoginPage = () => {
    const { signInWithGoogle, signInWithMeta, signInAsDev } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [isAutoRedirecting, setIsAutoRedirecting] = useState(false);

    // 🛑 CAMBIA ESTO A 'true' UNA VEZ QUE HABILITES META EN TU CONSOLA DE SUPABASE
    const ENABLE_AUTO_META_REDIRECT = false;

    useEffect(() => {
        if (!ENABLE_AUTO_META_REDIRECT) return;

        // Detect if the user is loading the app inside Meta's In-App Browser (Instagram or Facebook)
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
        const isMetaBrowser = ua.includes('Instagram') || ua.includes('FBAN') || ua.includes('FBAV');

        if (isMetaBrowser) {
            console.log("🛰️ [IN-APP BROWSER DETECTED] Instagram/Meta sandbox identified. Launching auto-redirect...");
            setIsAutoRedirecting(true);
            
            // Short delay to let the UI render and show the tactical loading screen
            const timer = setTimeout(async () => {
                try {
                    await signInWithMeta();
                } catch (err: any) {
                    console.error("Auto-redirect Meta Auth failed:", err);
                    setIsAutoRedirecting(false);
                    setError("No se pudo iniciar el inicio de sesión automático de Meta.");
                }
            }, 800);

            return () => clearTimeout(timer);
        }
    }, [signInWithMeta]);

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

    if (isAutoRedirecting) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-gym-primary/20 blur-3xl rounded-full animate-pulse"></div>
                    <div className="w-20 h-20 rounded-[2rem] bg-neutral-900 border border-white/10 flex items-center justify-center shadow-2xl relative">
                        <Loader2 className="text-gym-primary animate-spin" size={32} />
                    </div>
                </div>
                <h1 className="text-2xl font-black italic text-white uppercase tracking-wider mb-2">
                    CONECTANDO CON META
                </h1>
                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-widest max-w-xs leading-relaxed animate-pulse">
                    Accediendo mediante Instagram... Sincronizando identidad sin fricción.
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
                {/* Background Glow REMOVED */}

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
                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-neutral-200 transition-all flex items-center justify-center gap-3 group shadow-md"
                    >
                        <img
                            src="https://www.google.com/favicon.ico"
                            alt="Google"
                            className="w-5 h-5"
                        />
                        <span className="text-sm font-black uppercase tracking-wider">Entrar con Google</span>
                    </button>

                    {/* Meta/Facebook Login Button */}
                    <button
                        onClick={handleMetaLogin}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-3.5 rounded-xl hover:from-blue-500 hover:to-blue-600 transition-all flex items-center justify-center gap-3 group shadow-md"
                    >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                            <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/>
                        </svg>
                        <span className="text-sm font-black uppercase tracking-wider">Entrar con Meta</span>
                    </button>
                </div>

                {/* DEV BYPASS BUTTON */}
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
