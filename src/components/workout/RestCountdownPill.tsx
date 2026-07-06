import { useEffect, useState } from 'react';
import { Timer, Plus, X, Settings2 } from 'lucide-react';

interface RestCountdownPillProps {
    endsAt: number;           // timestamp ms when rest finishes
    targetSec: number;        // configured global rest duration
    exerciseName?: string;
    onSkip: () => void;
    onAddSeconds: (s: number) => void;
    onChangeTarget: (sec: number) => void;
}

const TARGET_OPTIONS = [30, 60, 90, 120, 180];

const fmt = (totalSec: number) => {
    const s = Math.max(0, totalSec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
};

// Floating global rest countdown. One timer for ALL exercises: completing any
// set (re)starts it with the configured duration; at zero the OS alarm fires
// (scheduled by the parent) and the pill pulses.
export const RestCountdownPill = ({ endsAt, targetSec, exerciseName, onSkip, onAddSeconds, onChangeTarget }: RestCountdownPillProps) => {
    const [now, setNow] = useState(Date.now());
    const [showTargets, setShowTargets] = useState(false);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(t);
    }, []);

    const remainingSec = Math.ceil((endsAt - now) / 1000);
    const done = remainingSec <= 0;
    const progress = Math.max(0, Math.min(1, remainingSec / Math.max(1, targetSec)));

    // Ring geometry
    const R = 16;
    const CIRC = 2 * Math.PI * R;

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 select-none animate-in slide-in-from-bottom-4 fade-in duration-300">
            {/* Target duration chips */}
            {showTargets && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-1 bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-full px-2 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.7)] whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200">
                    {TARGET_OPTIONS.map(sec => (
                        <button
                            key={sec}
                            onClick={() => { onChangeTarget(sec); setShowTargets(false); }}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all active:scale-90 ${targetSec === sec
                                ? 'bg-gym-primary text-black'
                                : 'text-neutral-400 hover:text-white bg-white/5'
                            }`}
                        >
                            {sec < 60 ? `${sec}s` : `${sec / 60}m${sec % 60 ? (sec % 60) : ''}`}
                        </button>
                    ))}
                </div>
            )}

            <div className={`flex items-center gap-2 pl-2 pr-2.5 py-2 rounded-full backdrop-blur-2xl border shadow-[0_12px_36px_rgba(0,0,0,0.7)] transition-colors duration-300 ${done
                ? 'bg-red-950/90 border-red-500/60 animate-pulse'
                : 'bg-neutral-950/90 border-gym-primary/40'
            }`}>
                {/* Progress ring */}
                <div className="relative w-10 h-10 shrink-0">
                    <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
                        <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
                        <circle
                            cx="20" cy="20" r={R} fill="none"
                            stroke={done ? '#ef4444' : '#eab308'}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeDasharray={CIRC}
                            strokeDashoffset={CIRC * (1 - progress)}
                            style={{ transition: 'stroke-dashoffset 0.25s linear' }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Timer size={13} className={done ? 'text-red-400' : 'text-gym-primary'} />
                    </div>
                </div>

                <div className="flex flex-col min-w-[64px]">
                    <span className={`text-lg font-black font-mono leading-none ${done ? 'text-red-400' : 'text-white'}`}>
                        {done ? '0:00' : fmt(remainingSec)}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500 truncate max-w-[90px]">
                        {done ? '¡A entrenar!' : (exerciseName || 'Descanso')}
                    </span>
                </div>

                {/* +15s */}
                {!done && (
                    <button
                        onClick={() => onAddSeconds(15)}
                        className="flex items-center gap-0.5 px-2 py-1.5 rounded-full bg-white/5 border border-white/10 text-neutral-300 hover:text-white text-[10px] font-black active:scale-90 transition-all"
                    >
                        <Plus size={10} strokeWidth={3} />15s
                    </button>
                )}

                {/* Change target */}
                <button
                    onClick={() => setShowTargets(v => !v)}
                    className={`p-1.5 rounded-full border transition-all active:scale-90 ${showTargets ? 'bg-gym-primary text-black border-gym-primary' : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'}`}
                    title="Cambiar duración"
                >
                    <Settings2 size={12} />
                </button>

                {/* Skip / dismiss */}
                <button
                    onClick={onSkip}
                    className="p-1.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 hover:text-red-400 hover:border-red-500/30 active:scale-90 transition-all"
                    title={done ? 'Cerrar' : 'Saltar descanso'}
                >
                    <X size={12} />
                </button>
            </div>
        </div>
    );
};
