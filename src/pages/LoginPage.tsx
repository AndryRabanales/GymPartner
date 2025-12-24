import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';
import { useState } from 'react';

export const LoginPage = () => {
    const { signInWithGoogle } = useAuth();
    const [error, setError] = useState<string | null>(null);

    const handleGoogleLogin = async () => {
        try {
            setError(null);
            await signInWithGoogle();
        } catch (err: any) {
            setError(err.message || 'Error al conectar con Google.');
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
                {/* Background Glow REMOVED */}

                <div className="relative z-10 mb-8">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-white/20">
                        <img
                            src="https://www.google.com/favicon.ico"
                            alt="Google"
                            className="w-10 h-10"
                        />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Acceso GymPartner</h1>
                    <p className="text-neutral-400">Identifícate con tu cuenta de Google para continuar.</p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleGoogleLogin}
                    className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-neutral-200 transition-all flex items-center justify-center gap-3 group shadow-lg shadow-white/10"
                >
                    <LogIn size={24} />
                    <span className="text-lg">Entrar con Google</span>
                </button>

                <p className="mt-6 text-xs text-neutral-600">
                    Al continuar, aceptas nuestros términos de servicio.
                </p>
            </div>
        </div>
    );
};
