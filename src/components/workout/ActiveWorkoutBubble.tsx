import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom'; // Changed useNavigate to useLocation for re-checks
import { Play, X } from 'lucide-react';
import { workoutService } from '../../services/WorkoutService';
import { useAuth } from '../../context/AuthContext';

export const ActiveWorkoutBubble = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [elapsedTime, setElapsedTime] = useState("00:00");
    const [isVisible, setIsVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    // Check availability on mount and route change
    useEffect(() => {
        if (!user) return;
        checkSession();
    }, [user, location.pathname]);

    // Timer Logic
    useEffect(() => {
        if (!startTime) return;

        const tick = () => {
            const now = new Date();
            const diff = Math.max(0, now.getTime() - new Date(startTime).getTime());
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            if (hours > 0) {
                setElapsedTime(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            } else {
                setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }
        };

        const interval = setInterval(tick, 1000);
        tick();
        return () => clearInterval(interval);
    }, [startTime]);

    const checkSession = async () => {
        // If we are on the workout page, don't show bubble (or hide it if it was open)
        if (location.pathname.includes('/workout')) {
            setIsVisible(false);
            return;
        }

        const session = await workoutService.getActiveSession(user!.id);
        if (session) {
            setSessionId(session.id);
            setStartTime(new Date(session.started_at));
            setIsVisible(true);
        } else {
            setIsVisible(false);
            setSessionId(null);
        }
    };

    const handleCancel = async () => {
        if (!sessionId) return;
        if (window.confirm("¿Seguro que quieres cancelar el entrenamiento en progreso?")) {
            setLoading(true);
            await workoutService.deleteSession(sessionId);
            setLoading(false);
            setIsVisible(false);
            setSessionId(null);
        }
    };

    if (!isVisible || !sessionId) return null;

    return (
        <div className="fixed bottom-24 right-4 z-50 animate-in slide-in-from-right-5 fade-in duration-300">
            <div className="bg-neutral-900/90 backdrop-blur-md border border-yellow-500/30 rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.2)] p-4 flex flex-col gap-3 min-w-[200px]">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest">En Progreso</span>
                    </div>
                    <button
                        onClick={handleCancel}
                        disabled={loading}
                        className="text-neutral-500 hover:text-red-500 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Timer */}
                <div className="flex items-center justify-center py-1">
                    <span className="font-mono text-2xl font-black text-white tracking-widest">{elapsedTime}</span>
                </div>

                {/* Resume Action */}
                <Link
                    to="/workout"
                    className="flex items-center justify-center gap-2 bg-gym-primary text-black font-black text-sm uppercase py-3 rounded-xl hover:bg-yellow-400 transition-colors shadow-lg"
                >
                    <Play size={16} fill="currentColor" /> Volver
                </Link>
            </div>
        </div>
    );
};
