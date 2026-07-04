import React, { useMemo, useState } from 'react';
import { X, History, Loader, Trophy, WifiOff, Minus, Plus } from 'lucide-react';

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

type SortKey = 'recent' | 'weight' | 'reps' | 'time' | 'distance';
type RangeKey = 'week' | 'month' | 'year' | 'all';

const RANGE_LABELS: Record<RangeKey, string> = { week: 'Semana', month: 'Mes', year: 'Año', all: 'Todo' };
const RANGE_MS: Record<Exclude<RangeKey, 'all'>, number> = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
};
const BEST_LABEL: Record<RangeKey, string> = {
    week: 'de la semana',
    month: 'del mes',
    year: 'del año',
    all: 'histórico',
};

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

    // Cardio exercises sort by time/distance; strength by weight/reps
    const isCardio = (showTime || showDistance) && !showWeight;
    const sortOptions: { key: SortKey; label: string }[] = [
        { key: 'recent', label: 'Reciente' },
        ...(isCardio
            ? ([
                ...(showTime ? [{ key: 'time' as SortKey, label: 'Tiempo' }] : []),
                ...(showDistance ? [{ key: 'distance' as SortKey, label: 'Distancia' }] : []),
            ])
            : ([
                ...(showWeight ? [{ key: 'weight' as SortKey, label: 'Peso' }] : []),
                ...(showReps ? [{ key: 'reps' as SortKey, label: 'Reps' }] : []),
            ])),
    ];

    const [sortBy, setSortBy] = useState<SortKey>('recent');
    const [range, setRange] = useState<RangeKey>('all');
    // Rep-max PR: when active, best mark + medals only consider sets with
    // reps >= target ("my best weight doing at least N reps"). Strength only.
    const [repTarget, setRepTarget] = useState<number | null>(null);
    const canUseRepTarget = !isCardio && showWeight && showReps;

    const qualifies = (s: ExerciseHistoryEntry['sets'][0]) =>
        !repTarget || !canUseRepTarget || s.reps >= repTarget;

    // Best value of a metric within one session (sessions are ranked by their best set)
    const sessionBest = (entry: ExerciseHistoryEntry, key: 'weight_kg' | 'reps' | 'time' | 'distance') =>
        entry.sets.reduce((max, s) => Math.max(max, Number((s as any)[key]) || 0), 0);

    const visibleHistory = useMemo(() => {
        let filtered = history;
        if (range !== 'all') {
            const cutoff = Date.now() - RANGE_MS[range];
            filtered = history.filter(h => h.date && new Date(h.date).getTime() >= cutoff);
        }
        const sorted = filtered.slice();
        switch (sortBy) {
            case 'weight':
                sorted.sort((a, b) => sessionBest(b, 'weight_kg') - sessionBest(a, 'weight_kg'));
                break;
            case 'reps':
                sorted.sort((a, b) => sessionBest(b, 'reps') - sessionBest(a, 'reps'));
                break;
            case 'time':
                sorted.sort((a, b) => sessionBest(b, 'time') - sessionBest(a, 'time'));
                break;
            case 'distance':
                sorted.sort((a, b) => sessionBest(b, 'distance') - sessionBest(a, 'distance'));
                break;
            default: // recent
                sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        return sorted;
    }, [history, sortBy, range]);

    // Best mark WITHIN the selected range (self-comparison anchor), respecting
    // the rep target when active. Also ranks the podium: top-3 sets 🥇🥈🥉.
    const { bestMark, medalBySet } = useMemo(() => {
        const primaryKey = isCardio ? (showTime ? 'time' : 'distance') : 'weight_kg';
        const ranked: { entry: ExerciseHistoryEntry; set: ExerciseHistoryEntry['sets'][0]; val: number }[] = [];
        for (const entry of visibleHistory) {
            for (const s of entry.sets) {
                if (!qualifies(s)) continue;
                const val = Number((s as any)[primaryKey]) || 0;
                if (val <= 0) continue;
                ranked.push({ entry, set: s, val });
            }
        }
        ranked.sort((a, b) => b.val - a.val || (isCardio ? 0 : b.set.reps - a.set.reps));
        const medals = new Map<ExerciseHistoryEntry['sets'][0], string>();
        const MEDAL_ICONS = ['🥇', '🥈', '🥉'];
        ranked.slice(0, 3).forEach((r, i) => medals.set(r.set, MEDAL_ICONS[i]));
        return {
            bestMark: ranked.length > 0 ? { entry: ranked[0].entry, set: ranked[0].set } : null,
            medalBySet: medals,
        };
    }, [visibleHistory, isCardio, showTime, repTarget, canUseRepTarget]);

    const bestMarkText = bestMark
        ? isCardio
            ? (showTime && bestMark.set.time > 0
                ? `${formatTime(bestMark.set.time)}${bestMark.set.distance > 0 ? ` · ${bestMark.set.distance} m` : ''}`
                : `${bestMark.set.distance} m`)
            : `${bestMark.set.weight_kg} kg${bestMark.set.reps > 0 ? ` × ${bestMark.set.reps}` : ''}`
        : null;

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
                <div className="px-5 pt-4 pb-3 border-b border-white/5 shrink-0">
                    <div className="flex items-start justify-between">
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

                    {/* Best mark within the selected range (+ rep target when active) */}
                    {!loading && !offline && (bestMarkText || (repTarget && canUseRepTarget)) && (
                        <div className="mt-2 flex items-center gap-1.5 bg-gym-primary/10 border border-gym-primary/25 rounded-xl px-3 py-1.5 w-fit">
                            <Trophy size={12} className="text-gym-primary shrink-0" />
                            <span className="text-[11px] font-black text-white">
                                {bestMarkText ? (
                                    <>
                                        Tu mejor {BEST_LABEL[range]}{repTarget && canUseRepTarget ? ` a ${repTarget}+ reps` : ''}: <span className="text-gym-primary">{bestMarkText}</span>
                                        {bestMark?.entry.date && (
                                            <span className="text-neutral-500 font-bold"> — {new Date(bestMark.entry.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-neutral-400">Sin series de {repTarget}+ reps en este período</span>
                                )}
                            </span>
                        </div>
                    )}

                    {/* Sort + Range controls */}
                    {!loading && !offline && history.length > 0 && (
                        <div className="mt-2.5 space-y-1.5">
                            <div className="flex gap-1.5">
                                {sortOptions.map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setSortBy(opt.key)}
                                        className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${sortBy === opt.key
                                            ? 'bg-gym-primary text-black border-gym-primary'
                                            : 'bg-transparent text-neutral-400 border-neutral-800 hover:border-neutral-600 hover:text-white'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-1.5">
                                {(Object.keys(RANGE_LABELS) as RangeKey[]).map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRange(r)}
                                        className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${range === r
                                            ? 'bg-white/10 text-white border-white/30'
                                            : 'bg-transparent text-neutral-500 border-neutral-800 hover:border-neutral-600 hover:text-white'
                                        }`}
                                    >
                                        {RANGE_LABELS[r]}
                                    </button>
                                ))}
                            </div>

                            {/* Rep-max target: "my best weight doing at least N reps" */}
                            {canUseRepTarget && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setRepTarget(repTarget ? null : 8)}
                                        className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${repTarget
                                            ? 'bg-gym-primary/20 text-gym-primary border-gym-primary/50'
                                            : 'bg-transparent text-neutral-500 border-neutral-800 hover:border-neutral-600 hover:text-white'
                                        }`}
                                    >
                                        PR a reps
                                    </button>
                                    {repTarget && (
                                        <div className="flex items-center gap-0.5 bg-neutral-950/80 border border-neutral-800 rounded-full px-1 py-0.5">
                                            <button
                                                onClick={() => setRepTarget(Math.max(1, repTarget - 1))}
                                                className="p-1 text-neutral-400 hover:text-white active:scale-90 transition-all"
                                            >
                                                <Minus size={11} strokeWidth={3} />
                                            </button>
                                            <span className="text-[11px] font-black text-white min-w-[34px] text-center">{repTarget}+ <span className="text-[8px] text-neutral-500">REPS</span></span>
                                            <button
                                                onClick={() => setRepTarget(Math.min(30, repTarget + 1))}
                                                className="p-1 text-neutral-400 hover:text-white active:scale-90 transition-all"
                                            >
                                                <Plus size={11} strokeWidth={3} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
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
                    ) : visibleHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                            <History className="text-neutral-700" size={32} />
                            <p className="text-neutral-400 text-sm font-bold">Nada en este período</p>
                            <p className="text-neutral-600 text-xs max-w-[240px]">No entrenaste este ejercicio en {RANGE_LABELS[range].toLowerCase() === 'todo' ? 'este rango' : `la última ${RANGE_LABELS[range].toLowerCase()}`}. Prueba con otro rango.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {visibleHistory.map(entry => (
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
                                    <div className="grid px-3.5 pt-2 pb-1 text-[8px] font-black text-neutral-500 uppercase tracking-widest" style={{ gridTemplateColumns: `28px repeat(${columns.length}, 1fr) 24px` }}>
                                        <span>#</span>
                                        {columns.map(c => <span key={c} className="text-center">{c}</span>)}
                                        <span></span>
                                    </div>

                                    {/* Sets */}
                                    <div className="px-3.5 pb-2.5 space-y-0.5">
                                        {entry.sets.map((s, i) => {
                                            const medal = medalBySet.get(s);
                                            const dimmed = repTarget && canUseRepTarget && !qualifies(s);
                                            return (
                                                <div key={i} className={`grid items-center py-1 rounded-lg text-[12px] font-bold transition-opacity ${medal ? 'bg-gym-primary/5' : ''} ${dimmed ? 'opacity-30' : ''}`} style={{ gridTemplateColumns: `28px repeat(${columns.length}, 1fr) 24px` }}>
                                                    <span className="text-neutral-600 text-[10px] font-black">{s.set_number || i + 1}</span>
                                                    {showWeight && <span className="text-center text-white">{s.weight_kg > 0 ? <>{s.weight_kg}<span className="text-[9px] text-neutral-500 ml-0.5">kg</span></> : <span className="text-neutral-700">—</span>}</span>}
                                                    {showReps && <span className="text-center text-white">{s.reps > 0 ? s.reps : <span className="text-neutral-700">—</span>}</span>}
                                                    {showTime && <span className="text-center text-white">{s.time > 0 ? formatTime(s.time) : <span className="text-neutral-700">—</span>}</span>}
                                                    {showDistance && <span className="text-center text-white">{s.distance > 0 ? <>{s.distance}<span className="text-[9px] text-neutral-500 ml-0.5">m</span></> : <span className="text-neutral-700">—</span>}</span>}
                                                    {showRpe && <span className="text-center text-white">{s.rpe > 0 ? s.rpe : <span className="text-neutral-700">—</span>}</span>}
                                                    <span className="flex justify-center items-center text-[11px] leading-none">
                                                        {medal ? medal : (s.is_pr && <Trophy size={11} className="text-gym-primary" />)}
                                                    </span>
                                                </div>
                                            );
                                        })}
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
