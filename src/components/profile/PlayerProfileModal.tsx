import React, { useEffect, useState } from 'react';
import { X, Trophy, Shield, MapPin, Loader, Swords, User } from 'lucide-react';
import { userService } from '../../services/UserService';

interface PlayerProfileModalProps {
    player: {
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
    const [routine, setRoutine] = useState<any | null>(null);
    const [loadingRoutine, setLoadingRoutine] = useState(false);

    useEffect(() => {
        const fetchRoutine = async () => {
            if (player.featured_routine_id) {
                setLoadingRoutine(true);
                const data = await userService.getRoutineDetails(player.featured_routine_id);
                setRoutine(data);
                setLoadingRoutine(false);
            }
        };
        fetchRoutine();
    }, [player.featured_routine_id]);

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-3xl overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-300">

                {/* Header / Banner */}
                <div className="h-32 bg-neutral-800 relative">
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

                    {/* Rank Badge Floating */}
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

                {/* Profile Info */}
                <div className="relative px-6 pb-6 -mt-12">
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

                    {/* Featured Routine (Battle Deck) */}
                    <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                            <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                                <Swords size={16} className="text-gym-primary" />
                                Rutina Destacada
                            </h3>
                            {routine && (
                                <span className="text-[10px] text-neutral-500">{routine.name}</span>
                            )}
                        </div>

                        {loadingRoutine ? (
                            <div className="flex justify-center py-8">
                                <Loader className="animate-spin text-gym-primary" />
                            </div>
                        ) : routine ? (
                            <div className="grid grid-cols-4 gap-2">
                                {routine.exercises && routine.exercises.length > 0 ? (
                                    routine.exercises.slice(0, 8).map((ex: any, idx: number) => (
                                        <div key={idx} className="aspect-[3/4] bg-neutral-800 rounded-lg border border-neutral-700 relative overflow-hidden group">
                                            {/* Card Style */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                                            <div className="absolute bottom-1 left-1 right-1 z-20">
                                                <p className="text-[8px] font-bold text-white text-center leading-tight truncate">{ex.name}</p>
                                            </div>
                                            {/* Top Icon */}
                                            <div className="absolute top-1 right-1 z-20 opacity-50">
                                                <User size={8} className="text-white" />
                                            </div>
                                            {/* Fake Image Placeholder based on ID hash or random */}
                                            <div className={`absolute inset-0 opacity-30 ${idx % 2 === 0 ? 'bg-blue-500' : 'bg-red-500'}`} />
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-4 text-center py-4 text-xs text-neutral-600 italic">
                                        Estrategia confidencial (Vacía)
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <div className="inline-block p-3 rounded-full bg-neutral-800 mb-2">
                                    <Shield size={24} className="text-neutral-600" />
                                </div>
                                <p className="text-xs text-neutral-500">Este agente no ha revelado su estrategia aún.</p>
                            </div>
                        )}

                        {routine && (
                            <div className="mt-3 pt-2 border-t border-white/5 text-center">
                                <span className="text-[10px] text-gym-primary font-bold uppercase cursor-pointer hover:underline">
                                    Ver Detalle Completo
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
