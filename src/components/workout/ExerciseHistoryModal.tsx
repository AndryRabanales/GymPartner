import React from 'react';
import { X, History, Loader, Trophy, WifiOff } from 'lucide-react';

export interface ExerciseHistoryEntry {
    date: string;
    sessionId: string;
    sets: { set_number: number; weight_kg: number; reps: number; time: number; distance: number; rpe: number; is_pr: boolean }[];
}

interface ExerciseHistoryModalProps {
    exerciseName: string;
    metrics?: { weight?: boolean; reps?: boolean; time?: boolean; distance?: boolean; rpe?: boolean };
    history: ExerciseHistoryEntry[];
    loading: boolean;
    offline?: boolean;
    onClose: () => void;
}

const formatTime = (secs: number) => {
    if (secs >= 60) {
        const m = Math.floor(secs / 60);
        const s = Math.round(secs % 60);
        return s > 0 ? `${m}m ${s}s` : `${m}m`;
    }
    return `${secs}s`;
};

export const ExerciseHistoryModal: React.FC<ExerciseHistoryModalProps> = ({
    exerciseName,
    metrics,
    history,
    loading,
    offline,
    onClose,
}) => {
    // Which columns to show — follow the exercise's tracked metrics, falling
    // back to weight+reps when unknown. Hide columns with no data at all.
    const anyData = (key: 'weight_kg' | 'reps' | 'time' | 'distance' | 'rpe') =>
        history.some(h => h.sets.some(s => Number((s as any)[key]) > 0));

    const showWeight = (metrics?.weight ?? true) || anyData('weight_kg');
    const showReps = (metrics?.reps ?? true) || anyData('reps');
    const showTime = (metrics?.time ?? false) || anyData('time');
    const showDistance = (metrics?.distance ?? false) || anyData('distance');
    const showRpe = (metrics?.rpe ?? false) || anyData('rpe');

    const columns = [
        showWeight && 'PESO',
        showReps && 'REPS',
        showTime && 'TIEMPO',
        showDistance && 'DIST',
        showRpe && 'RPE',
    ].filter(Boolean) as string[];

    return (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-4 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 pt-4 pb-3 border-b border-white/5 flex items-start justify-between shrink-0">
                    <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 text-gym-primary mb-0.5">
                            <History size={13} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Historial</span>
                        </div>
                        <h3 className="text-lg font-black italic uppercase text-white leading-tight truncate">{exerciseName}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-full transition-all shrink-0">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader className="animate-spin text-gym-primary" size={28} />
                            <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Cargando historial…</p>
                        </div>
                    ) : offline ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                            <WifiOff className="text-neutral-600" size={32} />
                            <p className="text-neutral-400 text-sm font-bold">Sin conexión</p>
                            <p className="text-neutral-600 text-xs max-w-[240px]">El historial de este ejercicio necesita internet. Tus series de hoy se guardan igual.</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                            <History className="text-neutral-700" size={32} />
                            <p className="text-neutral-400 text-sm font-bold">Sin registros todavía</p>
                            <p className="text-neutral-600 text-xs max-w-[240px]">Cuando completes series de este ejercicio, aparecerán aquí para que te compares.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {history.map(entry => (
                                <div key={entry.sessionId} className="bg-neutral-950/60 border border-neutral-800/60 rounded-2xl overflow-hidden">
                                    {/* Session date */}
                                    <div className="px-3.5 py-2 bg-white/[0.03] border-b border-neutral-800/60 flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-gym-primary">
                                            {entry.date
                                                ? new Date(entry.date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                                                : 'Fecha desconocida'}
                                        </span>
                                        <span className="text-[9px] font-bold text-neutral-600 uppercase">{entry.sets.length} serie{entry.sets.length !== 1 ? 's' : ''}</span>
                                    </div>

                                    {/* Column headers */}
                                    <div className="grid px-3.5 pt-2 pb-1 text-[8px] font-black text-neutral-500 uppercase tracking-widest" style={{ gridTemplateColumns: `28px repeat(${columns.length}, 1fr) 20px` }}>
                                        <span>#</span>
                                        {columns.map(c => <span key={c} className="text-center">{c}</span>)}
                                        <span></span>
                                    </div>

                                    {/* Sets */}
                                    <div className="px-3.5 pb-2.5 space-y-0.5">
                                        {entry.sets.map((s, i) => (
                                            <div key={i} className="grid items-center py-1 rounded-lg text-[12px] font-bold" style={{ gridTemplateColumns: `28px repeat(${columns.length}, 1fr) 20px` }}>
                                                <span className="text-neutral-600 text-[10px] font-black">{s.set_number || i + 1}</span>
                                                {showWeight && <span className="text-center text-white">{s.weight_kg > 0 ? <>{s.weight_kg}<span className="text-[9px] text-neutral-500 ml-0.5">kg</span></> : <span className="text-neutral-700">—</span>}</span>}
                                                {showReps && <span className="text-center text-white">{s.reps > 0 ? s.reps : <span className="text-neutral-700">—</span>}</span>}
                                                {showTime && <span className="text-center text-white">{s.time > 0 ? formatTime(s.time) : <span className="text-neutral-700">—</span>}</span>}
                                                {showDistance && <span className="text-center text-white">{s.distance > 0 ? <>{s.distance}<span className="text-[9px] text-neutral-500 ml-0.5">m</span></> : <span className="text-neutral-700">—</span>}</span>}
                                                {showRpe && <span className="text-center text-white">{s.rpe > 0 ? s.rpe : <span className="text-neutral-700">—</span>}</span>}
                                                <span className="flex justify-center">
                                                    {s.is_pr && <Trophy size={11} className="text-gym-primary" />}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
