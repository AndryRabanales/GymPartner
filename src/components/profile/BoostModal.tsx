import React from 'react';
import { X, Zap, CheckCircle2, TrendingUp, Users } from 'lucide-react';

interface BoostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    isBoosting: boolean;
    isActive: boolean;
    expiresAt?: string;
    currentPoints: number;
}

export const BoostModal: React.FC<BoostModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    isBoosting,
    isActive,
    expiresAt,
    currentPoints
}) => {
    if (!isOpen) return null;

    const cost = 1000;
    const canAfford = currentPoints >= cost;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-neutral-900 w-full max-w-md rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl relative">
                
                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-600/20 blur-[100px] pointer-events-none"></div>

                <div className="p-8 flex flex-col items-center text-center relative z-10">
                    
                    {/* Icon Section */}
                    <div className="relative mb-6">
                        <div className={`
                            absolute inset-0 bg-purple-500/20 rounded-full blur-2xl animate-pulse
                            ${isActive ? 'opacity-100' : 'opacity-0'}
                        `}></div>
                        <img 
                            src="/Gemini_Generated_Image_bjc7ltbjc7ltbjc7 (2).png" 
                            alt="Boost Coin"
                            className={`w-32 h-32 object-contain relative z-10 ${isActive ? 'drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]' : ''}`}
                        />
                    </div>

                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">
                        {isActive ? 'Boost Activo' : 'Radar Boost'}
                    </h2>
                    <p className="text-neutral-400 text-sm font-medium leading-relaxed max-w-[280px] mb-8">
                        {isActive 
                            ? `Tu perfil tiene prioridad máxima en el radar de todos los GymRats.`
                            : `Aparece de primero en el radar y aumenta tus posibilidades de encontrar un compañero de entrenamiento.`}
                    </p>

                    {isActive && expiresAt ? (
                        <div className="w-full bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 mb-8">
                            <div className="text-purple-400 text-[10px] uppercase font-black tracking-widest mb-1">Expira el</div>
                            <div className="text-white font-mono text-sm">
                                {new Date(expiresAt).toLocaleString()}
                            </div>
                        </div>
                    ) : (
                        <div className="w-full space-y-4 mb-8">
                            {/* Benefits List */}
                            <div className="grid grid-cols-1 gap-3 text-left">
                                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                    <TrendingUp className="text-purple-400 w-5 h-5" />
                                    <span className="text-xs text-neutral-300 font-bold uppercase tracking-tight">Prioridad #1 en el Radar</span>
                                </div>
                                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                    <Users className="text-blue-400 w-5 h-5" />
                                    <span className="text-xs text-neutral-300 font-bold uppercase tracking-tight">3x Más Visibilidad Social</span>
                                </div>
                                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                    <Zap className="text-yellow-400 w-5 h-5" />
                                    <span className="text-xs text-neutral-300 font-bold uppercase tracking-tight">Duración de 24 Horas</span>
                                </div>
                            </div>

                            {/* Price / Balance */}
                            <div className="flex items-center justify-between px-2 pt-2">
                                <div className="text-left">
                                    <div className="text-neutral-500 text-[10px] uppercase font-black tracking-widest">Costo</div>
                                    <div className="flex items-center gap-1.5">
                                        <img src="/Gemini_Generated_Image_qyk7sjqyk7sjqyk7-removebg-preview.png" alt="Coin" className="w-4 h-4 object-contain" />
                                        <span className="text-white font-black">1,000</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-neutral-500 text-[10px] uppercase font-black tracking-widest">Tu Saldo</div>
                                    <div className="flex items-center gap-1.5 justify-end">
                                        <span className={`font-black ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                                            {currentPoints.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="w-full flex flex-col gap-3">
                        {!isActive ? (
                            <button
                                onClick={onConfirm}
                                disabled={isBoosting || !canAfford}
                                className={`
                                    w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl
                                    ${canAfford 
                                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-purple-900/20 hover:scale-[1.02] active:scale-95' 
                                        : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'}
                                `}
                            >
                                {isBoosting ? 'Activando...' : canAfford ? 'Activar Boost Ahora' : 'G-Points Insuficientes'}
                            </button>
                        ) : (
                            <button
                                onClick={onClose}
                                className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-neutral-800 text-white hover:bg-neutral-700 transition-all"
                            >
                                Entendido
                            </button>
                        )}
                        
                        {!isActive && (
                            <button
                                onClick={onClose}
                                className="text-neutral-500 hover:text-white text-xs font-bold uppercase tracking-widest py-2 transition-colors"
                            >
                                Quizás más tarde
                            </button>
                        )}
                    </div>
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors p-2 z-20"
                >
                    <X size={24} />
                </button>
            </div>
        </div>
    );
};
