import React, { useState, useEffect } from 'react';


interface BattleTimerProps {
    isActive?: boolean;
    onTick?: (seconds: number) => void;
}

export const BattleTimer: React.FC<BattleTimerProps> = ({ isActive = true, onTick }) => {
    const [seconds, setSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(!isActive);

    useEffect(() => {
        setIsPaused(!isActive);
    }, [isActive]);

    useEffect(() => {
        let interval: any;
        if (!isPaused) {
            interval = setInterval(() => {
                setSeconds(s => {
                    const newValue = s + 1;
                    if (onTick) onTick(newValue);
                    return newValue;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPaused, onTick]);

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;

        if (h > 0) {
            return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        }
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="flex items-center gap-4 bg-black/40 border border-white/5 backdrop-blur-sm px-4 py-2 rounded-xl">
            {/* Visual Beat */}
            <div className={`w-3 h-3 rounded-full ${!isPaused ? 'bg-red-500 animate-pulse' : 'bg-neutral-600'}`} />

            {/* Digital Display */}
            <div className="font-mono text-2xl font-black tracking-widest text-white tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                {formatTime(seconds)}
            </div>

            {/* Controls */}
            {/* <button 
                onClick={() => setIsPaused(!isPaused)}
                className="text-neutral-400 hover:text-white transition-colors"
            >
                {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
            </button> */}
        </div>
    );
};
