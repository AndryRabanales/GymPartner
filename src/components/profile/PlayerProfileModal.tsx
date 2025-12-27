import React, { useEffect, useState } from 'react';
import { X, Trophy, Shield, MapPin, Loader, Swords } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/UserService';

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
    const [selectedRoutine, setSelectedRoutine] = useState<any | null>(null);
    const [publicRoutines, setPublicRoutines] = useState<any[]>([]);
    const [loadingRoutine, setLoadingRoutine] = useState(false);
    const { user } = useAuth();
    const [copying, setCopying] = useState(false);

    // Initial Load: Public Routines & Featured Logic
    useEffect(() => {
        const init = async () => {
            console.log("PlayerProfileModal INIT for:", player.username, "ID:", player.id); // DEBUG
            console.log("Featured Routine ID from Props:", player.featured_routine_id); // DEBUG

            // 1. Get List of Public Routines
            const decks = await userService.getUserPublicRoutines(player.id || '');
            console.log("Public Decks Found:", decks); // DEBUG
            setPublicRoutines(decks);

            // 2. Decide which one to show first
            let initialId = player.featured_routine_id;
            if (!initialId && decks.length > 0) {
                initialId = decks[0].id; // Show most recent if no featured
            }

            if (initialId) {
                loadRoutineDetails(initialId);
            }
        };
        init();
    }, [player]);

    const loadRoutineDetails = async (routineId: string) => {
        setLoadingRoutine(true);
        const data = await userService.getRoutineDetails(routineId);
        setSelectedRoutine(data);
        setLoadingRoutine(false);
    };

    const handleCopyRoutine = async () => {
        if (!user || !selectedRoutine) return;
        setCopying(true);
        const result = await userService.copyRoutine(selectedRoutine.id, user.id);
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

                        {/* BATTLE DECKS COLLECTION */}
                        <div className="bg-black/40 rounded-2xl p-4 border border-white/5">

                            {/* Deck Selector Tabs */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
                                {publicRoutines.map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => loadRoutineDetails(r.id)}
                                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedRoutine?.id === r.id
                                                ? 'bg-gym-primary text-black border-gym-primary shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                                                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'
                                            }`}
                                    >
                                        {r.name}
                                    </button>
                                ))}
                                {publicRoutines.length === 0 && (
                                    <span className="text-xs text-neutral-600 italic px-2">Sin estrategias públicas</span>
                                )}
                            </div>

                            {/* Active Deck Header */}
                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                                <div className="flex flex-col">
                                    <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                                        <Swords size={16} className="text-gym-primary" />
                                        {selectedRoutine ? selectedRoutine.name : 'Selecciona Estrategia'}
                                    </h3>
                                    {(selectedRoutine && selectedRoutine.exercises) && (
                                        <span className="text-[9px] text-neutral-500 font-bold tracking-wider">
                                            COSTO ELIXIR: PROM. {selectedRoutine.exercises.length * 20} min
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Deck Content */}
                            {loadingRoutine ? (
                                <div className="flex justify-center py-8">
                                    <Loader className="animate-spin text-gym-primary" />
                                </div>
                            ) : selectedRoutine ? (
                                <>
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        {selectedRoutine.exercises && selectedRoutine.exercises.length > 0 ? (
                                            selectedRoutine.exercises.map((ex: any, idx: number) => (
                                                <div key={idx} className="relative group h-full bg-neutral-900 border border-white/5 rounded-2xl overflow-hidden flex flex-col hover:border-white/20 transition-all">
                                                    {/* Selection Indicator (Fake/Static to match screenshot style) */}
                                                    <div className="absolute top-2 left-2 z-20 flex gap-1 flex-row-reverse">
                                                        <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 text-transparent">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-neutral-600"></div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col h-full relative group aspect-[3/4] min-h-[110px] p-1.5 overflow-hidden bg-neutral-900 border border-white/5 rounded-lg">
                                                        {/* Icon - Centered */}
                                                        <div className="flex-1 flex items-center justify-center w-full z-10 pb-2 pt-2">
                                                            {ex.image_url ? (
                                                                <img src={ex.image_url} alt={ex.name} className="w-16 h-16 object-contain drop-shadow-md" />
                                                            ) : (
                                                                <span className="text-4xl leading-none drop-shadow-md filter brightness-110 grayscale-[0.2]">⚡</span>
                                                            )}
                                                        </div>

                                                        {/* Title */}
                                                        <div className="text-center w-full px-1.5 leading-none z-20 pb-1.5 min-h-0 flex-shrink-0">
                                                            <h4 className="text-[8px] font-black italic uppercase tracking-wider line-clamp-3 text-wrap leading-tight text-neutral-200 drop-shadow-sm">
                                                                {ex.name}
                                                            </h4>
                                                        </div>

                                                        {/* Footer / Stats */}
                                                        <div className="border-t border-white/5 w-full bg-black/40 backdrop-blur-sm mt-auto">
                                                            <div className="flex flex-wrap gap-1 justify-center w-full py-1">
                                                                <span className="text-[6px] font-bold px-1 py-0.5 rounded-[2px] flex items-center gap-0.5 leading-none text-neutral-400">
                                                                    <span>🔄</span>
                                                                    <span className="tracking-wide uppercase">REPS</span>
                                                                </span>
                                                                <span className="text-[6px] font-bold px-1 py-0.5 rounded-[2px] flex items-center gap-0.5 leading-none text-neutral-400">
                                                                    <span>⚖️</span>
                                                                    <span className="tracking-wide uppercase">PESO</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-3 text-center py-4 text-xs text-neutral-600 italic">
                                                Estrategia vacía
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        onClick={handleCopyRoutine}
                                        disabled={copying}
                                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase text-xs py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(234,179,8,0.3)] disabled:opacity-50"
                                    >
                                        {copying ? <Loader size={14} className="animate-spin" /> : <Swords size={14} strokeWidth={2.5} />}
                                        COPIAR ESTRATEGIA
                                    </button>
                                </>
                            ) : (
                                <div className="text-center py-6">
                                    <div className="inline-block p-3 rounded-full bg-neutral-800 mb-2">
                                        <Shield size={24} className="text-neutral-600" />
                                    </div>
                                    <p className="text-xs text-neutral-500">Selecciona una estrategia para analizar.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
