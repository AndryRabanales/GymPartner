import React, { useEffect, useState } from 'react';
import { X, Trophy, MapPin, Swords, Shield, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/UserService';
import { RoutineViewModal } from './RoutineViewModal';

interface PlayerProfileModalProps {
    player: {
        id: string;
        username: string;
        avatar_url: string;
        xp: number;
        rank: number;
        gym_name?: string;
        banner_url?: string;
        featured_routine_id?: string | null;
    };
    onClose: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ player, onClose }) => {
    const [publicRoutines, setPublicRoutines] = useState<any[]>([]);
    const [viewRoutine, setViewRoutine] = useState<any | null>(null);
    // Removed loadingDetails (unused)

    const { user } = useAuth();
    const [copying, setCopying] = useState(false);

    // Initial Load: Public Routines
    useEffect(() => {
        const init = async () => {
            // Get List of Public Routines
            const decks = await userService.getUserPublicRoutines(player.id || '');
            setPublicRoutines(decks);
        };
        init();
    }, [player]);

    const handleOpenRoutine = async (routine: any) => {
        if (routine.exercises) {
            setViewRoutine(routine); // Already loaded
        } else {
            // Fetch details if needed (lazy load)
            const detailed = await userService.getRoutineDetails(routine.id);
            setViewRoutine(detailed);
        }
    };

    const handleCopyRoutine = async () => {
        if (!user || !viewRoutine) return;
        setCopying(true);
        const result = await userService.copyRoutine(viewRoutine.id, user.id);
        if (result.success) {
            alert("¡Estrategia robada con éxito! Ahora está en tu arsenal.");
        } else {
            alert("Error al copiar: " + result.error);
        }
        setCopying(false);
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-3xl overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">

                {/* Header / Banner */}
                <div className="h-32 bg-neutral-800 relative shrink-0">
                    {player.banner_url ? (
                        <img src={player.banner_url} alt="Banner" className="w-full h-full object-cover opacity-60" />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-b from-neutral-800 to-neutral-900" />
                    )}

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-black/50 text-white p-1 rounded-full hover:bg-black/80 transition-colors z-20"
                    >
                        <X size={20} />
                    </button>

                    {/* Rank Badge */}
                    <div className="absolute top-4 left-4 z-20">
                        {player.rank <= 3 ? (
                            <div className={`w-10 h-10 flex items-center justify-center font-black rounded-lg shadow-lg skew-x-[-10deg] border border-white/20 ${player.rank === 1 ? 'bg-yellow-500 text-black' :
                                player.rank === 2 ? 'bg-slate-300 text-black' :
                                    'bg-orange-600 text-white'
                                }`}>
                                {player.rank}
                            </div>
                        ) : (
                            <div className="bg-black/60 backdrop-blur px-3 py-1 rounded-lg border border-white/10 text-xs font-bold text-white">
                                #{player.rank}
                            </div>
                        )}
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1">
                    <div className="relative px-6 pb-6 -mt-12">
                        {/* Avatar & Stats */}
                        <div className="flex justify-between items-end mb-4">
                            <div className="w-24 h-24 rounded-2xl border-4 border-neutral-900 bg-neutral-800 overflow-hidden shadow-lg relative z-10">
                                <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 text-right mb-1">
                                <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full mb-2">
                                    <Trophy size={14} className="text-yellow-500" />
                                    <span className="font-black text-yellow-500 text-sm">{player.xp.toLocaleString()} XP</span>
                                </div>
                                {player.gym_name && (
                                    <div className="flex items-center justify-end gap-1 text-xs text-neutral-400">
                                        <MapPin size={10} />
                                        <span className="truncate max-w-[100px]">{player.gym_name}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-1">{player.username}</h2>
                        <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mb-6">Agente de Alto Rendimiento</p>

                        {/* BATTLE DECKS COLLECTION (Vertical List) */}
                        <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                            <h3 className="text-sm font-black text-white uppercase italic mb-3 flex items-center gap-2">
                                <Swords size={16} className="text-gym-primary" />
                                COLECCIÓN DE MAZOS
                            </h3>

                            <div className="flex flex-col gap-2">
                                {publicRoutines.length > 0 ? (
                                    publicRoutines.map(r => (
                                        <button
                                            key={r.id}
                                            onClick={() => handleOpenRoutine(r)}
                                            className="group relative overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-gym-primary rounded-xl p-3 transition-all hover:bg-neutral-800 text-left flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-gym-primary group-hover:bg-gym-primary/10 transition-colors border border-white/5">
                                                    <Swords size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white text-sm uppercase italic group-hover:text-gym-primary transition-colors">{r.name}</h4>
                                                    <span className="text-[10px] text-neutral-500 font-bold tracking-wider block mt-0.5">
                                                        {(r.routine_exercises?.length || r.exercises?.length || 0)} CARTAS
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="pr-2 text-neutral-600 group-hover:text-gym-primary flex items-center gap-2">
                                                <span className="text-[9px] font-bold uppercase hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">Ver Mazo</span>
                                                <ChevronRight size={16} />
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-center py-8 border-2 border-dashed border-neutral-800 rounded-xl">
                                        <Shield size={24} className="mx-auto text-neutral-700 mb-2" />
                                        <p className="text-xs text-neutral-500 font-medium">Sin estrategias registradas</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* ROUTINE DETAIL MODAL (Nested) */}
            {viewRoutine && (
                <RoutineViewModal
                    routine={viewRoutine}
                    onClose={() => setViewRoutine(null)}
                    onCopy={handleCopyRoutine}
                    isCopying={copying}
                />
            )}
        </div>
    );
};
