import React, { useEffect, useState } from 'react';
import { Delete, Check } from 'lucide-react';

interface SmartNumpadProps {
    isOpen: boolean;
    onClose: () => void;
    onInput: (value: string | number) => void;
    onDelete: () => void;
    onSubmit: () => void;
    value: string | number; // Current value being edited
    label?: string; // e.g. "Peso (KG)" or "Reps"
    suggestion?: number; // Previous log value for "chip"
}

export const SmartNumpad: React.FC<SmartNumpadProps> = ({
    isOpen,
    onClose,
    onInput,
    onDelete,
    onSubmit,
    value,
    label = "Valor",
    suggestion
}) => {
    const [render, setRender] = useState(isOpen);

    useEffect(() => {
        if (isOpen) setRender(true);
        else setTimeout(() => setRender(false), 300); // Wait for animation
    }, [isOpen]);

    if (!render) return null;

    const handleNumberClick = (num: number) => {
        onInput(num);
    };

    const handleDecimalClick = () => {
        if (String(value).includes('.')) return;
        onInput('.');
    };

    return (
        <div
            className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        >
            {/* Backdrop to close checks */}
            {isOpen && (
                <div
                    className="fixed inset-0 -top-full bg-black/50 backdrop-blur-sm -z-10"
                    onClick={onClose}
                />
            )}

            <div className="bg-[#111] border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] pb-8 pt-2">

                {/* Drag Handle */}
                <div className="w-full flex justify-center py-2" onClick={onClose}>
                    <div className="w-12 h-1.5 bg-neutral-700/50 rounded-full" />
                </div>

                {/* Header / Display */}
                <div className="px-6 pb-4 flex justify-between items-end border-b border-white/5 mb-2">
                    <div>
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{label}</span>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-black text-white tracking-tight">
                                {value === 0 || value === '' ? <span className="text-neutral-700">0</span> : value}
                            </h2>
                            <span className="animate-pulse w-0.5 h-8 bg-gym-primary block" />
                        </div>
                    </div>

                    {/* Smart Chips (Contextual) */}
                    <div className="flex gap-2">
                        {suggestion && suggestion > 0 && (
                            <button
                                onClick={() => { onInput(suggestion); }} // Replace with suggestion
                                className="bg-neutral-800 text-gym-primary border border-gym-primary/30 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-neutral-700"
                            >
                                Último: {suggestion}
                            </button>
                        )}
                    </div>
                </div>

                {/* Keypad Grid */}
                <div className="grid grid-cols-4 gap-1 px-2">
                    {[1, 2, 3].map(n => (
                        <NumberKey key={n} number={n} onClick={() => handleNumberClick(n)} />
                    ))}
                    <ActionKey onClick={() => onInput('+2.5')} className="bg-neutral-900 text-white text-xs font-bold text-yellow-500">+2.5</ActionKey>

                    {[4, 5, 6].map(n => (
                        <NumberKey key={n} number={n} onClick={() => handleNumberClick(n)} />
                    ))}
                    <ActionKey onClick={() => onInput('+1.25')} className="bg-neutral-900 text-white text-xs font-bold text-yellow-500">+1.25</ActionKey>

                    {[7, 8, 9].map(n => (
                        <NumberKey key={n} number={n} onClick={() => handleNumberClick(n)} />
                    ))}
                    <ActionKey onClick={onDelete} className="bg-neutral-900 text-red-500">
                        <Delete size={24} />
                    </ActionKey>

                    {/* Bottom Row */}
                    <NumberKey number="." onClick={handleDecimalClick} />
                    <NumberKey number={0} onClick={() => handleNumberClick(0)} />

                    {/* Submit / Close */}
                    <button
                        onClick={onSubmit}
                        className="col-span-2 bg-gym-primary text-black font-black text-xl rounded-xl flex items-center justify-center active:scale-95 transition-transform shadow-[0_0_20px_rgba(250,204,21,0.2)]"
                    >
                        LISTO <Check size={20} className="ml-2" strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const NumberKey = ({ number, onClick }: { number: number | string, onClick: () => void }) => (
    <button
        onClick={onClick}
        className="h-16 rounded-xl bg-neutral-900/50 hover:bg-neutral-800 text-white font-bold text-2xl active:scale-95 transition-all outline-none focus:ring-1 ring-white/10"
    >
        {number}
    </button>
);

const ActionKey = ({ children, onClick, className = "" }: { children: React.ReactNode, onClick: () => void, className?: string }) => (
    <button
        onClick={onClick}
        className={`h-16 rounded-xl flex items-center justify-center active:scale-95 transition-all outline-none ${className}`}
    >
        {children}
    </button>
);
