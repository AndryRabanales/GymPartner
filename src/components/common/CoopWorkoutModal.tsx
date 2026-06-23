import React from 'react';
import { Swords, X, Users } from 'lucide-react';
import { FadeInImage } from '../ui/FadeInImage';

interface CoopWorkoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: (mode: 'conjunto') => void;
    inviterUsername: string;
    inviterAvatarUrl?: string;
}

export const CoopWorkoutModal: React.FC<CoopWorkoutModalProps> = ({ 
    isOpen, 
    onClose, 
    onAccept,
    inviterUsername,
    inviterAvatarUrl
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
            
            <div className="bg-neutral-900 border border-gym-primary/30 rounded-3xl w-full max-w-sm relative z-10 overflow-hidden shadow-[0_0_50px_rgba(250,204,21,0.2)] animate-in zoom-in-95 duration-300">
                
                {/* Header Profile */}
                <div className="pt-8 pb-4 flex flex-col items-center bg-gradient-to-b from-gym-primary/10 to-transparent">
                    <div className="w-20 h-20 rounded-full border-2 border-gym-primary overflow-hidden shadow-[0_0_15px_rgba(250,204,21,0.5)] mb-3 relative">
                        <FadeInImage src={inviterAvatarUrl || `https://ui-avatars.com/api/?name=${inviterUsername}&background=000&color=FACC15`} />
                        <div className="absolute bottom-0 right-0 bg-gym-primary p-1 rounded-full">
                            <Swords size={12} className="text-black" />
                        </div>
                    </div>
                    <h2 className="text-xl font-black text-white italic uppercase tracking-wider text-center px-4">
                        {inviterUsername} te invita a entrenar
                    </h2>
                    <p className="text-xs text-neutral-400 mt-1 uppercase tracking-widest font-bold">
                        Elige tu modalidad de batalla
                    </p>
                </div>

                {/* Accept */}
                <div className="p-4">
                    <button
                        onClick={() => onAccept('conjunto')}
                        className="w-full bg-neutral-950 border border-gym-primary/50 hover:border-gym-primary rounded-2xl p-4 flex items-center gap-4 transition-all hover:bg-gym-primary/5 group text-left active:scale-95"
                    >
                        <div className="w-12 h-12 rounded-xl bg-gym-primary/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <Users size={24} className="text-gym-primary" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Aceptar Invitación</h3>
                            <p className="text-[10px] text-neutral-400 mt-0.5 leading-tight">
                                Comparten la misma rutina en la misma pantalla. Sus series se intercalan.
                            </p>
                        </div>
                    </button>
                </div>

                {/* Footer Cancel */}
                <div className="p-4 pt-2">
                    <button 
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-transparent text-neutral-500 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                    >
                        <X size={14} /> RECHAZAR
                    </button>
                </div>
            </div>
        </div>
    );
};
