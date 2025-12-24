import React, { useState } from 'react';
import { X, Search, Camera, AlertTriangle, ThumbsUp } from 'lucide-react';

interface AddIntelModalProps {
    isOpen: boolean;
    onClose: () => void;
    gymName: string;
}

export const AddIntelModal = ({ isOpen, onClose, gymName }: AddIntelModalProps) => {
    const [step, setStep] = useState<'type' | 'form'>('type');
    const [intelType, setIntelType] = useState<string>('');

    if (!isOpen) return null;

    const handleTypeSelect = (type: string) => {
        setIntelType(type);
        setStep('form');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Here we would send data to backend using 'intelType'
        console.log("Submitting intel report:", intelType);
        alert("¡Recibido! Has ganado +75 XP. Gracias por mejorar la inteligencia de este gym.");
        onClose();
        setStep('type');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900">
                    <h3 className="font-bold text-white">Add Intel: <span className="text-gym-primary">{gymName}</span></h3>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {step === 'type' ? (
                        <div className="space-y-4">
                            <p className="text-neutral-400 text-sm mb-4">¿Qué información quieres reportar?</p>

                            <button
                                onClick={() => handleTypeSelect('equipment')}
                                className="w-full bg-neutral-800 hover:bg-neutral-700 p-4 rounded-xl flex items-center gap-4 transition-colors border border-neutral-700 group"
                            >
                                <div className="bg-blue-500/10 p-3 rounded-lg text-blue-500 group-hover:scale-110 transition-transform">
                                    <Search size={24} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-white">Equipamiento</div>
                                    <div className="text-xs text-neutral-400">Corrige inventario o añade máquinas</div>
                                </div>
                            </button>

                            <button
                                onClick={() => handleTypeSelect('issue')}
                                className="w-full bg-neutral-800 hover:bg-neutral-700 p-4 rounded-xl flex items-center gap-4 transition-colors border border-neutral-700 group"
                            >
                                <div className="bg-red-500/10 p-3 rounded-lg text-red-500 group-hover:scale-110 transition-transform">
                                    <AlertTriangle size={24} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-white">Reportar Problema</div>
                                    <div className="text-xs text-neutral-400">Máquina rota, suciedad, etc.</div>
                                </div>
                            </button>

                            <button
                                onClick={() => handleTypeSelect('vibe')}
                                className="w-full bg-neutral-800 hover:bg-neutral-700 p-4 rounded-xl flex items-center gap-4 transition-colors border border-neutral-700 group"
                            >
                                <div className="bg-green-500/10 p-3 rounded-lg text-green-500 group-hover:scale-110 transition-transform">
                                    <ThumbsUp size={24} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-white">Vibe Check</div>
                                    <div className="text-xs text-neutral-400">¿Está lleno? ¿Hay buena música?</div>
                                </div>
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-1">Detalles</label>
                                <textarea
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-white focus:outline-none focus:border-gym-primary min-h-[100px]"
                                    placeholder="Ej: La máquina de cables número 3 tiene la polea atascada..."
                                    required
                                ></textarea>
                            </div>

                            <div className="dashed-border border-2 border-neutral-700 border-dashed rounded-lg p-6 text-center hover:bg-neutral-800/50 cursor-pointer transition-colors">
                                <Camera className="mx-auto text-neutral-500 mb-2" />
                                <span className="text-xs text-neutral-400">Añadir foto (Opcional, +20 XP)</span>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gym-primary text-black font-bold py-3 rounded-lg hover:bg-yellow-400 transition-colors"
                            >
                                Enviar Reporte
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep('type')}
                                className="w-full text-neutral-400 text-sm py-2 hover:text-white"
                            >
                                Volver
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
