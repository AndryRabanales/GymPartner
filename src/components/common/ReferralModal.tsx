import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, Users, Trophy, X, PlusCircle, Coins } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { userService } from '../../services/UserService';
import { supabase } from '../../lib/supabase';

interface ReferralModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ isOpen, onClose, user }) => {
    const [copied, setCopied] = useState(false);
    const [isBuying, setIsBuying] = useState(false);
    const [gPoints, setGPoints] = useState<number>(0);
    const [extraInvites, setExtraInvites] = useState<number>(0);

    useEffect(() => {
        if (isOpen && user) {
            fetchUserData();
        }
    }, [isOpen, user]);

    const fetchUserData = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('g_points, extra_invites_today')
            .eq('id', user.id)
            .single();
        
        if (data) {
            setGPoints(data.g_points || 0);
            setExtraInvites(data.extra_invites_today || 0);
        }
    };

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
            alert('No se pudo copiar el enlace automáticamente.');
        }
    };

    const handleShareWhatsapp = () => {
        const text = `¡Únete a Ginx! 🏋️‍♂️\n\nEntrena, gana G-Points y sube de rango.\n\nRegístrate aquí: ${referralLink}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleBuyInvites = async () => {
        if (gPoints < 500) {
            alert("No tienes suficientes G-Points (se requieren 500).");
            return;
        }

        setIsBuying(true);
        try {
            const success = await userService.spendGPoints(user.id, 500, 'extra_invites');
            if (success) {
                // Update profile record
                await supabase.rpc('increment_extra_invites', { 
                    u_id: user.id, 
                    amount: 10 
                });
                
                alert("¡Has comprado 10 invitaciones extra!");
                fetchUserData();
            } else {
                alert("Error al procesar la compra.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsBuying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-neutral-900 border border-yellow-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[0_0_50px_rgba(234,179,8,0.15)] animate-in zoom-in-95 duration-300 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">

                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-[50px] pointer-events-none"></div>

                <div className="relative z-10 flex flex-col items-center text-center space-y-6">

                    {/* Header Icon */}
                    <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 relative group">
                        <Users className="text-yellow-500 w-10 h-10 group-hover:scale-110 transition-transform" />
                    </div>

                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                            PROGRAMA DE <span className="text-yellow-500">REFERIDOS</span>
                        </h2>
                        <p className="text-neutral-400 text-sm">
                            Invita amigos y gana recompensas exclusivas.
                        </p>
                    </div>

                    {/* Reward Cards */}
                    <div className="grid grid-cols-2 gap-3 w-full">
                        <div className="bg-neutral-950/50 p-4 rounded-2xl border border-white/5 flex flex-col items-center text-center group">
                            <Trophy className="text-blue-400 w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                            <div className="text-white font-black text-lg leading-none">+250 XP</div>
                            <div className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest mt-1">Nivel</div>
                        </div>
                        <div className="bg-neutral-950/50 p-4 rounded-2xl border border-yellow-500/10 flex flex-col items-center text-center group">
                            <img 
                                src="/Gemini_Generated_Image_qyk7sjqyk7sjqyk7-removebg-preview.png" 
                                alt="G-Points"
                                className="h-20 w-auto mb-1 group-hover:scale-105 transition-transform object-contain"
                            />
                            <div className="text-yellow-400 font-black text-sm leading-none">+100 G-PTS</div>
                            <div className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest mt-1">Moneda</div>
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
                            <Copy size={16} className="text-neutral-500 group-hover:text-white transition-colors" />
                        </div>
                    </div>

                    {/* WhatsApp Button */}
                    <button
                        onClick={handleShareWhatsapp}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 transition-all uppercase italic tracking-tight"
                    >
                        <Share2 size={18} strokeWidth={2.5} />
                        <span>Compartir en WhatsApp</span>
                    </button>

                    {/* Extra Invites Section */}
                    <div className="w-full border-t border-white/5 pt-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="text-left">
                                <h3 className="text-white font-bold text-sm uppercase tracking-wide">Invitaciones Extra</h3>
                                <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Límite diario: 50 + {extraInvites}</p>
                            </div>
                            <div className="text-yellow-500 font-black text-xs bg-yellow-500/10 px-2 py-1 rounded-full border border-yellow-500/20">
                                {gPoints} G-POINTS
                            </div>
                        </div>

                        <button
                            onClick={handleBuyInvites}
                            disabled={isBuying || gPoints < 500}
                            className={`
                                w-full flex items-center justify-between p-4 rounded-2xl border transition-all group
                                ${gPoints >= 500 
                                    ? 'bg-neutral-800 border-yellow-500/30 hover:border-yellow-500 hover:bg-neutral-750' 
                                    : 'bg-neutral-900 border-white/5 opacity-50 cursor-not-allowed'}
                            `}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                                    <PlusCircle size={20} className="text-yellow-500" />
                                </div>
                                <div className="text-left">
                                    <div className="text-white font-bold text-sm">+10 Invitaciones</div>
                                    <div className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest">Recarga diaria</div>
                                </div>
                            </div>
                            <div className="text-yellow-500 font-black text-sm">500 PTS</div>
                        </button>
                    </div>

                </div>

                {/* Close X */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors p-2"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};
