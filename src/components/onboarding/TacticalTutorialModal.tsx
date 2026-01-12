import { useState } from 'react';
import { Dumbbell, LineChart, History, ChevronRight, Check, X, MapPin, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TutorialProps {
    onClose: () => void;
    showMapMission?: boolean;
}

export const TacticalTutorialModal = ({ onClose, showMapMission = false }: TutorialProps) => {
    const [step, setStep] = useState(0);
    const navigate = useNavigate();

    const baseSteps = [
        {
            icon: <Dumbbell size={48} className="text-blue-500" />,
            title: "CATÁLOGO",
            description: "Tu inventario de pesas y máquinas. Configura aquí el equipo disponible en tu gimnasio para obtener recomendaciones precisas.",
            color: "border-blue-500/30 bg-blue-500/10"
        },
        {
            icon: <LineChart size={48} className="text-green-500" />,
            title: "STATS (INTELIGENCIA)",
            description: "Analíticas avanzadas. Visualiza tu volumen de carga, equilibrio muscular y rachas de entrenamiento.",
            color: "border-green-500/30 bg-green-500/10"
        },
        {
            icon: <History size={48} className="text-orange-500" />,
            title: "HISTORIAL",
            description: "Tu historial de entrenamiento. Revisa sesiones pasadas, records personales y la consistencia de tu disciplina.",
            color: "border-orange-500/30 bg-orange-500/10"
        },
        {
            icon: <Trophy size={48} className="text-yellow-500" />,
            title: "GANA XP & RECOMPENSAS",
            description: (
                <div className="text-left space-y-2 text-sm md:text-base">
                    <p className="font-bold text-center mb-4">Acumula experiencia para futuros premios:</p>
                    <ul className="space-y-3">
                        <li className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/10">
                            <span className="text-2xl">🗺️</span>
                            <div>
                                <strong className="text-yellow-400 block">+500 XP</strong>
                                <span className="text-xs text-neutral-400">Desbloquear nuevo Gym</span>
                            </div>
                        </li>
                        <li className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/10">
                            <span className="text-2xl">🔥</span>
                            <div>
                                <strong className="text-orange-400 block">+100 XP</strong>
                                <span className="text-xs text-neutral-400">Entrenamiento Diario Completado</span>
                            </div>
                        </li>
                        <li className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/10">
                            <span className="text-2xl">🤝</span>
                            <div>
                                <strong className="text-blue-400 block">+250 XP</strong>
                                <span className="text-xs text-neutral-400">Reclutar (Compartir App)</span>
                            </div>
                        </li>
                    </ul>
                </div>
            ),
            color: "border-yellow-500/30 bg-yellow-500/10"
        }
    ];

    const missionStep = {
        icon: <MapPin size={48} className="text-red-500" />,
        title: "PRIMEROS PASOS",
        description: "El sistema no detecta ningún gimnasio. Debes dirigirte al MAPA y registrar tu gimnasio usando GPS en tiempo real para desbloquear el resto de la app.",
        color: "border-red-500/50 bg-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.2)]",
        isMission: true
    };

    const steps = showMapMission ? [...baseSteps, missionStep] : baseSteps;

    const isLastStep = step === steps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            onClose();
            // If it's the mission step, we can also navigate, but the user might want to read first.
            // Let's make the button explicit.
            if ((steps[step] as any).isMission) {
                navigate('/map');
            }
        } else {
            setStep(prev => prev + 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl relative">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors z-10"
                >
                    <X size={20} />
                </button>

                {/* Progress Bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-neutral-800">
                    <div
                        className="h-full bg-gym-primary transition-all duration-300 ease-out"
                        style={{ width: `${((step + 1) / steps.length) * 100}%` }}
                    />
                </div>

                <div className="p-8 pt-12 flex flex-col items-center text-center min-h-[400px]">

                    {/* Dynamic Content */}
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in slide-in-from-right-8 duration-300 key={step}">
                        <div className={`p-6 rounded-full border-2 ${steps[step].color} mb-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] transform scale-110`}>
                            {steps[step].icon}
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                                {steps[step].title}
                            </h2>
                            <p className="text-neutral-400 text-lg leading-relaxed font-medium">
                                {steps[step].description}
                            </p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="w-full mt-8 pt-6 border-t border-neutral-800">
                        <button
                            onClick={handleNext}
                            className={`w-full font-black text-lg py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 uppercase italic tracking-wide ${(steps[step] as any).isMission
                                ? 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/40'
                                : 'bg-white text-black hover:bg-gym-primary'
                                }`}
                        >
                            {isLastStep ? (
                                (steps[step] as any).isMission ? (
                                    <>
                                        <MapPin size={20} strokeWidth={3} />
                                        <span>IR AL MAPA</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={20} strokeWidth={3} />
                                        <span>Entendido</span>
                                    </>
                                )
                            ) : (
                                <>
                                    <span>Siguiente</span>
                                    <ChevronRight size={20} strokeWidth={3} />
                                </>
                            )}
                        </button>
                    </div>

                    {/* Pagination Dots */}
                    <div className="flex gap-2 mt-6">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${i === step ? 'bg-gym-primary w-6' : 'bg-neutral-700'}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
