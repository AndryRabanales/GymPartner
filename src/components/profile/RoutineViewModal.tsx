import React from 'react';
import { X, Swords, Loader, Trophy } from 'lucide-react';

interface RoutineViewModalProps {
    routine: any;
    onClose: () => void;
    onCopy: () => void;
    isCopying: boolean;
}

export const RoutineViewModal: React.FC<RoutineViewModalProps> = ({ routine, onClose, onCopy, isCopying }) => {
    if (!routine) return null;

    return (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-neutral-800/50">
                    <div>
                        <h2 className="text-xl font-black italic text-white uppercase tracking-tighter flex items-center gap-2">
                            <Swords size={20} className="text-gym-primary" />
                            {routine.name}
                        </h2>
                        <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                            MAZO BÉLICO • {routine.exercises?.length || 0} CARTAS
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Deck Content (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 bg-neutral-950/50">
                    <div className="grid grid-cols-3 gap-2">
                        {routine.exercises && routine.exercises.length > 0 ? (
                            routine.exercises.map((ex: any, idx: number) => {
                                // Default stats if missing
                                const activeMetrics = [
                                    { label: 'PESO', icon: '⚖️' },
                                    { label: 'REPS', icon: '🔄' }
                                ];

                                return (
                                    <div key={idx} className="relative group h-full bg-neutral-900 border border-white/5 rounded-2xl overflow-hidden flex flex-col hover:border-white/20 transition-all">

                                        {/* Selection Indicator (Visual Only - Matches ArsenalCard) */}
                                        <div className="absolute top-2 left-2 z-20 flex gap-1 flex-row-reverse">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 text-transparent">
                                                <div className="w-2.5 h-2.5 rounded-full bg-neutral-600"></div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col h-full relative group aspect-[3/4] min-h-[130px] p-1.5 overflow-hidden bg-neutral-900 border border-white/5 rounded-lg">

                                            {/* Icon / Image - Centered */}
                                            <div className="flex-1 flex items-center justify-center w-full z-10 pb-2 pt-2">
                                                {ex.image_url ? (
                                                    /* Image Handling */
                                                    <img
                                                        src={ex.image_url}
                                                        alt={ex.name}
                                                        className="w-16 h-16 object-contain drop-shadow-md filter brightness-110"
                                                    />
                                                ) : (
                                                    /* Fallback Icon handling (emojis) */
                                                    <span className="text-5xl leading-none drop-shadow-md filter brightness-110 grayscale-[0.2] select-none">
                                                        {ex.icon || '⚡'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Title - Anchored Bottom */}
                                            <div className="text-center w-full px-1.5 leading-none z-20 pb-1.5 min-h-0 flex-shrink-0">
                                                <h4 className="text-[9px] font-black italic uppercase tracking-wider line-clamp-3 text-wrap leading-tight text-neutral-200 drop-shadow-sm">
                                                    {ex.name}
                                                </h4>
                                            </div>

                                            {/* Footer / Stats */}
                                            <div className="border-t border-white/5 w-full bg-black/40 backdrop-blur-sm mt-auto">
                                                <div className="flex flex-wrap gap-1 justify-center w-full py-1">
                                                    {activeMetrics.map((m, i) => (
                                                        <span key={i} className="text-[6px] font-bold px-1 py-0.5 rounded-[2px] flex items-center gap-0.5 leading-none text-neutral-400">
                                                            <span>{m.icon}</span>
                                                            <span className="tracking-wide uppercase">{m.label}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-3 text-center py-12 text-neutral-500 italic flex flex-col items-center">
                                <Swords className="mb-2 opacity-20" size={32} />
                                <p className="text-xs">Mazo vacío</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-white/5 bg-neutral-900">
                    <button
                        onClick={onCopy}
                        disabled={isCopying}
                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase text-sm py-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(234,179,8,0.2)] disabled:opacity-50"
                    >
                        {isCopying ? <Loader size={18} className="animate-spin" /> : <Trophy size={18} strokeWidth={2.5} />}
                        ROBAR ESTRATEGIA
                    </button>
                    <p className="text-[10px] text-center text-neutral-500 mt-2">
                        Se añadirá a tu colección de rutinas locales.
                    </p>
                </div>

            </div>
        </div>
    );
};
