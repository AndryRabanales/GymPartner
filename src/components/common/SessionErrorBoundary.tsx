import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class SessionErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error in Session:", error, errorInfo);
    }

    private handleReset = () => {
        // Clear local storage drafts that might be causing the crash
        // We iterate to find any workout draft
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('workout_draft_')) {
                localStorage.removeItem(key);
            }
        });

        // Reload page to clear memory state
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-neutral-900 border border-red-500/30 p-8 rounded-2xl max-w-md shadow-2xl">
                        <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
                        <h2 className="text-2xl font-black uppercase text-red-500 mb-2">Error Crítico</h2>
                        <p className="text-neutral-400 mb-6 font-medium">
                            Ha ocurrido un error inesperado en tu sesión. No te preocupes, tus datos seguros están en el servidor.
                        </p>

                        <div className="bg-black/50 p-4 rounded-lg mb-6 text-left overflow-auto max-h-32 text-xs font-mono text-red-400 border border-red-900/50">
                            {this.state.error?.message || 'Error desconocido'}
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={this.handleReset}
                                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                                <RefreshCw size={20} /> Reiniciar Sesión (Recargar)
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold uppercase rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                                <Home size={20} /> Volver al Inicio
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
