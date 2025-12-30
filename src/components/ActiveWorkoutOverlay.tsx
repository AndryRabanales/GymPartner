import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Swords, Play, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { workoutService } from '../services/WorkoutService';

export const ActiveWorkoutOverlay = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [isVisible, setIsVisible] = useState(false);
    const [elapsedTime, setElapsedTime] = useState("00:00");
    const [sessionData, setSessionData] = useState<any>(null);

    const LOCAL_STORAGE_KEY = `gp_workout_session_${user?.id}`;

    const checkActiveness = () => {
        if (!user) {
            setIsVisible(false);
            return;
        }

        // 1. Check Route (Hide if on workout page logic is strictly strictly /workout related urls)
        if (location.pathname.includes('/workout')) {
            setIsVisible(false);
            return;
        }

        // 2. Check Local Storage
        const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed.startTime) {
                    setSessionData(parsed);
                    setIsVisible(true);
                    return;
                }
            } catch (e) {
                console.error("Error parsing stored session for overlay:", e);
            }
        }

        setIsVisible(false);
    };

    // Listen to updates
    useEffect(() => {
        checkActiveness(); // Initial check

        const handleStorage = () => checkActiveness(); // Custom event listener

        // Listen for internal and external storage updates
        window.addEventListener('workout-session-update', handleStorage);
        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('workout-session-update', handleStorage);
            window.removeEventListener('storage', handleStorage);
        };
    }, [user, location.pathname]);

    // Timer Tick
    useEffect(() => {
        if (!isVisible || !sessionData?.startTime) return;

        const tick = () => {
            const now = new Date();
            const start = new Date(sessionData.startTime);
            const diff = Math.max(0, now.getTime() - start.getTime());

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const timeStr = hours > 0
                ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            setElapsedTime(timeStr);
        };

        tick();
        const interval = setInterval(tick, 1000);

        return () => clearInterval(interval);
    }, [isVisible, sessionData]);


    const handleReturn = () => {
        if (sessionData?.resolvedGymId) {
            navigate(`/territory/${sessionData.resolvedGymId}/workout`);
        } else {
            navigate('/workout');
        }
    };

    const handleCancel = async () => {
        if (!window.confirm("⚠️ ¿CANCELAR ENTRENAMIENTO?\n\nSe perderán todos los datos y el progreso actual.")) return;

        if (sessionData?.sessionId) {
            // Optimistic UI hide
            setIsVisible(false);
            await workoutService.discardSession(sessionData.sessionId);
        }

        localStorage.removeItem(LOCAL_STORAGE_KEY);
        window.dispatchEvent(new Event('workout-session-update')); // Force update to inform others
        setIsVisible(false); // Ensure hidden
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-24 right-4 z-[60] animate-in fade-in slide-in-from-bottom-10 pointer-events-auto">
            {/* The Bubble UI */}
            <div className="bg-neutral-900 border border-yellow-500/30 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] p-4 w-48 backdrop-blur-md relative overflow-hidden">

                {/* Background Pulse Effect */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent animate-pulse" />

                {/* Timer Header */}
                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                        <Swords size={16} className="text-yellow-500 animate-bounce" />
                        <span className="text-[10px] font-black uppercase text-yellow-500 tracking-wider">Battle</span>
                    </div>
                </div>

                <div className="text-center mb-4">
                    <span className="font-mono font-black text-2xl text-white tracking-widest">{elapsedTime}</span>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                    <button
                        onClick={handleReturn}
                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black text-[10px] uppercase py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                        <Play size={12} fill="currentColor" /> VOLVER
                    </button>
                    <button
                        onClick={handleCancel}
                        className="w-full bg-neutral-800 hover:bg-red-900/40 text-neutral-400 hover:text-red-500 font-bold text-[10px] uppercase py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <Trash2 size={12} /> CANCELAR
                    </button>
                </div>
            </div>
        </div>
    );
};
