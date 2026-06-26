import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const DeleteAccountPage = () => {
    const navigate = useNavigate();
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleDelete = async () => {
        if (confirm !== 'ELIMINAR') {
            setError('Escribe ELIMINAR para confirmar.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const { error } = await supabase.rpc('delete_user_account');
            if (error) throw error;
            await supabase.auth.signOut();
            navigate('/', { replace: true });
        } catch (e: any) {
            setError('Ocurrió un error. Intenta de nuevo o contáctanos en rabanalesandry2@gmail.com');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center px-6">
            <div className="w-full max-w-md">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-neutral-400 hover:text-white mb-8 transition-colors">
                    <ArrowLeft size={18} /> Volver
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                        <Trash2 size={22} className="text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">Eliminar cuenta</h1>
                        <p className="text-neutral-500 text-xs">Esta acción es permanente e irreversible</p>
                    </div>
                </div>

                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-6">
                    <div className="flex gap-2 mb-3">
                        <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                        <p className="text-red-400 text-sm font-bold">Se eliminará permanentemente:</p>
                    </div>
                    <ul className="text-neutral-400 text-xs space-y-1 ml-6 list-disc">
                        <li>Tu perfil y foto</li>
                        <li>Todo tu historial de entrenamientos</li>
                        <li>Tus seguidores y conexiones</li>
                        <li>Tus rutinas y estadísticas</li>
                        <li>Tus puntos GX</li>
                    </ul>
                </div>

                <div className="mb-4">
                    <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider block mb-2">
                        Escribe <span className="text-red-400">ELIMINAR</span> para confirmar
                    </label>
                    <input
                        type="text"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="ELIMINAR"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-red-500 transition-colors"
                    />
                </div>

                {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

                <button
                    onClick={handleDelete}
                    disabled={loading || confirm !== 'ELIMINAR'}
                    className="w-full bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black uppercase py-4 rounded-2xl hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Trash2 size={18} />
                    {loading ? 'Eliminando...' : 'Eliminar mi cuenta'}
                </button>

                <p className="text-center text-neutral-600 text-xs mt-4">
                    ¿Necesitas ayuda? Escríbenos a rabanalesandry2@gmail.com
                </p>
            </div>
        </div>
    );
};
