import { useEffect, useState } from 'react';
import { Flame, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { streakService } from '../../services/StreakService';
import type { UserStreak } from '../../services/StreakService';
import { useAuth } from '../../context/AuthContext';

export const RescueModal = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [streak, setStreak] = useState<UserStreak | null>(null);
    const [timeLeft, setTimeLeft] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (user) {
            checkRisk();
        }
    }, [user]);

    // Timer Interval
    useEffect(() => {
        if (!streak || !streak.recovery_deadline) return;

        const interval = setInterval(() => {
            const left = streakService.getTimeRemaining(streak.recovery_deadline!);
            if (!left) {
                // Time expired? Technically the cron job will clean this up later,
                // but for UI we might want to close or show "Too Late"
                setIsVisible(false); // Hide if expired to rely on backend sync
            } else {
                setTimeLeft(left);
            }
        }, 60000); // Update every minute

        // Initial set
        const initialLeft = streakService.getTimeRemaining(streak.recovery_deadline);
        setTimeLeft(initialLeft);

        return () => clearInterval(interval);
    }, [streak]);

    const checkRisk = async () => {
        const data = await streakService.getUserStreak(user!.id);
        if (data && streakService.isAtRisk(data)) {
            setStreak(data);
            setIsVisible(true);
        }
    };

    const handleRescue = () => {
        // Redirect to map to find a gym or workout
        setIsVisible(false);
        navigate('/map');
    };

    if (!isVisible || !timeLeft) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
            {/* Pulsing Red Background Effect */}
            <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none"></div>

            <div className="relative bg-neutral-900 border border-red-500/50 rounded-3xl p-6 md:p-10 max-w-md w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.4)]">

                {/* Header Icon */}
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce border border-red-500/30">
                    <Flame size={40} className="text-red-500 fill-red-500" />
                </div>

                <h2 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter mb-2">
                    ¡RACHA EN PELIGRO!
                </h2>

                <p className="text-neutral-400 font-medium mb-6">
                    No has entrenado ayer. Tu racha de <span className="text-red-400 font-bold text-lg">{streak?.current_streak} días</span> morirá si no actúas ahora.
                </p>

                {/* Countdown Timer */}
                <div className="bg-red-950/50 border border-red-500/30 rounded-xl p-4 mb-8 flex items-center justify-center gap-3">
                    <Clock className="text-red-400 animate-pulse" />
                    <span className="text-2xl font-mono font-bold text-red-500 tracking-widest">
                        {timeLeft}
                    </span>
                    <span className="text-xs text-red-400/70 font-bold uppercase">Restantes</span>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <button
                        onClick={handleRescue}
                        className="w-full bg-red-600 hover:bg-red-500 text-white font-black text-xl py-4 rounded-xl shadow-lg shadow-red-600/30 transition-all transform hover:scale-105 flex items-center justify-center gap-2 uppercase italic tracking-tighter"
                    >
                        <span>🚑 IR A RESCATARLA</span>
                        <ArrowRight size={20} strokeWidth={3} />
                    </button>

                    <button
                        onClick={() => setIsVisible(false)}
                        className="text-neutral-500 text-sm font-bold hover:text-white transition-colors uppercase tracking-widest"
                    >
                        Arriesgar y cerrar
                    </button>
                </div>

                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-500">
                    <AlertTriangle size={12} />
                    <span>Si expira, se publicará tu pérdida en el feed.</span>
                </div>
            </div>
        </div>
    );
};
