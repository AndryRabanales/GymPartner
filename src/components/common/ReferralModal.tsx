import React, { useState } from 'react';
import { Share2, Copy, Check, Users, Trophy, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface ReferralModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ isOpen, onClose, user }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;
    if (!user) return null; // Safety Guard

    const referralLink = `${window.location.origin}/login?ref=${user.id}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(referralLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            // Fallback for older browsers or restricted contexts if needed, 
            // but for now logging error prevents crash.
            alert('No se pudo copiar el enlace automáticamente. Por favor selecciónalo y cópialo manualmente.');
        }
    };

    const handleShareWhatsapp = () => {
        const text = `¡Únete a GymPartner! 🏋️‍♂️\n\nEntrena, registra tu progreso y sube de rango.\n\nRegístrate aquí: ${referralLink}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-neutral-900 border border-yellow-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[0_0_50px_rgba(234,179,8,0.15)] animate-in zoom-in-95 duration-300 overflow-hidden">

                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-[50px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-[40px] pointer-events-none"></div>

                <div className="relative z-10 flex flex-col items-center text-center space-y-6">

                    {/* Header Icon */}
                    <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 relative group">
                        <div className="absolute inset-0 rounded-full border border-yellow-500/30 animate-[ping_3s_linear_infinite]"></div>
                        <Users className="text-yellow-500 w-10 h-10 group-hover:scale-110 transition-transform" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                            PROGRAMA DE <span className="text-yellow-500">REFERIDOS</span>
                        </h2>
                        <p className="text-neutral-400 text-sm">
                            Invita a tus amigos. Gana recompensas.
                        </p>
                    </div>

                    {/* Reward Card */}
                    <div className="w-full bg-neutral-950/50 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                        <div className="p-3 bg-yellow-500/10 rounded-xl">
                            <Trophy className="text-yellow-500 w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <div className="text-white font-bold text-lg leading-none">+250 XP</div>
                            <div className="text-neutral-500 text-xs mt-1">Por cada amigo registrado</div>
                        </div>
                    </div>

                    {/* Link Section */}
                    <div className="w-full space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block text-left pl-1">
                            Tu Enlace de Invitación
                        </label>
                        <div
                            onClick={handleCopy}
                            className="bg-black/50 border border-neutral-700 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:border-yellow-500/50 transition-colors group"
                        >
                            <code className="text-neutral-300 text-xs md:text-sm truncate mr-2 font-mono">
                                {referralLink}
                            </code>
                            <div className="flex items-center gap-2">
                                {copied ? (
                                    <span className="text-green-500 text-xs font-bold animate-in fade-in">COPIADO</span>
                                ) : (
                                    <Copy size={16} className="text-neutral-500 group-hover:text-white transition-colors" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 w-full">
                        <button
                            onClick={handleCopy}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${copied ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700'}`}
                        >
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                            <span>{copied ? 'Copiado' : 'Copiar'}</span>
                        </button>

                        <button
                            onClick={handleShareWhatsapp}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 transition-all"
                        >
                            <Share2 size={18} />
                            <span>WhatsApp</span>
                        </button>
                    </div>

                </div>

                {/* Close X */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};
