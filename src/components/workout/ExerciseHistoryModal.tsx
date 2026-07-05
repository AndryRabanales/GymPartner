import React, { useMemo, useState } from 'react';
import { X, History, Loader, Trophy, WifiOff, Minus, Plus, ArrowDownWideNarrow, CalendarRange, Target, ChevronDown } from 'lucide-react';

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

    // The metric the current combination is "searching for": the sort metric,
    // or the exercise's primary metric when sorting by date.
    const headlineKey: 'weight_kg' | 'reps' | 'time' | 'distance' =
        sortBy === 'weight' ? 'weight_kg'
        : sortBy === 'reps' ? 'reps'
        : sortBy === 'time' ? 'time'
        : sortBy === 'distance' ? 'distance'
        : (isCardio ? (showTime ? 'time' : 'distance') : 'weight_kg');

    // The single set a session card shows collapsed: its best QUALIFYING set
    // for the headline metric (tiebreak by the complementary metric).
    const sessionHeadlineSet = (entry: ExerciseHistoryEntry): ExerciseHistoryEntry['sets'][0] | null => {
        let best: ExerciseHistoryEntry['sets'][0] | null = null;
        for (const s of entry.sets) {
            if (!qualifies(s)) continue;
            const val = Number((s as any)[headlineKey]) || 0;
            if (val <= 0) continue;
            if (!best) { best = s; continue; }
            const bestVal = Number((best as any)[headlineKey]) || 0;
            const tie = headlineKey === 'weight_kg' ? s.reps - best.reps
                : headlineKey === 'reps' ? s.weight_kg - best.weight_kg
                : 0;
            if (val > bestVal || (val === bestVal && tie > 0)) best = s;
        }
        return best;
    };

    const visibleHistory = useMemo(() => {
        let filtered = history;
        if (range !== 'all') {
            const cutoff = Date.now() - RANGE_MS[range];
            filtered = history.filter(h => h.date && new Date(h.date).getTime() >= cutoff);
        }
        // Only sessions that actually have the searched data (a qualifying set
        // with a value for the headline metric) are listed.
        filtered = filtered.filter(h => sessionHeadlineSet(h) !== null);

        const bestVal = (entry: ExerciseHistoryEntry) =>
            Number((sessionHeadlineSet(entry) as any)?.[headlineKey]) || 0;

        const sorted = filtered.slice();
        if (sortBy === 'recent') {
            sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else {
            sorted.sort((a, b) => bestVal(b) - bestVal(a));
        }
        return sorted;
    }, [history, sortBy, range, repTarget, canUseRepTarget, headlineKey]);

    // Best mark WITHIN the selected range (self-comparison anchor), respecting
    // the rep target when active. Also ranks the podium: top-3 sets 🥇🥈🥉.
    const { bestMark, medalBySet } = useMemo(() => {
        // Rank by the SAME metric the combination is searching for, so the
        // banner, medals and card headlines always tell one coherent story.
        const ranked: { entry: ExerciseHistoryEntry; set: ExerciseHistoryEntry['sets'][0]; val: number }[] = [];
        for (const entry of visibleHistory) {
            for (const s of entry.sets) {
                if (!qualifies(s)) continue;
                const val = Number((s as any)[headlineKey]) || 0;
                if (val <= 0) continue;
                ranked.push({ entry, set: s, val });
            }
        }
        ranked.sort((a, b) => b.val - a.val ||
            (headlineKey === 'weight_kg' ? b.set.reps - a.set.reps
            : headlineKey === 'reps' ? b.set.weight_kg - a.set.weight_kg
            : 0));
        const medals = new Map<ExerciseHistoryEntry['sets'][0], string>();
        const MEDAL_ICONS = ['🥇', '🥈', '🥉'];
        ranked.slice(0, 3).forEach((r, i) => medals.set(r.set, MEDAL_ICONS[i]));
        return {
            bestMark: ranked.length > 0 ? { entry: ranked[0].entry, set: ranked[0].set } : null,
            medalBySet: medals,
        };
    }, [visibleHistory, headlineKey, repTarget, canUseRepTarget]);

    // Expanded cards (click to reveal the full set breakdown)
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const toggleExpanded = (sessionId: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(sessionId)) next.delete(sessionId);
            else next.add(sessionId);
            return next;
        });
    };

    // Compact one-line summary of a set for the collapsed card, phrased
    // around the searched metric first.
    const headlineText = (s: ExerciseHistoryEntry['sets'][0]) => {
        switch (headlineKey) {
            case 'weight_kg':
                return <>{s.weight_kg} <span className="text-[10px] text-neutral-400">kg</span>{s.reps > 0 && <span className="text-neutral-300"> × {s.reps}</span>}</>;
            case 'reps':
                return <>{s.reps} <span className="text-[10px] text-neutral-400">reps</span>{s.weight_kg > 0 && <span className="text-neutral-300"> · {s.weight_kg} kg</span>}</>;
            case 'time':
                return <>{formatTime(s.time)}{s.distance > 0 && <span className="text-neutral-300"> · {s.distance} m</span>}</>;
            case 'distance':
                return <>{s.distance} <span className="text-[10px] text-neutral-400">m</span>{s.time > 0 && <span className="text-neutral-300"> · {formatTime(s.time)}</span>}</>;
        }
    };

    const bestMarkText = bestMark ? headlineText(bestMark.set) : null;

    const columns = [
        showWeight && 'PESO',
        showReps && 'REPS',
        showTime && 'TIEMPO',
        showDistance && 'DIST',
        showRpe && 'RPE',
    ].filter(Boolean) as string[];

    const hasControls = !loading && !offline && history.length > 0;

    return (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
            <div
                className="exhist-sheet bg-neutral-950 border border-neutral-800/80 w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-[0_-20px_80px_rgba(250,204,21,0.07)] flex flex-col max-h-[88vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header (compact) ───────────────────────────────────── */}
                <div className="relative px-4 pt-3 pb-2 shrink-0 overflow-hidden">
                    {/* ambient glow */}
                    <div className="absolute -top-16 -left-16 w-40 h-40 bg-gym-primary/10 rounded-full blur-3xl pointer-events-none exhist-breathe" />

                    <div className="relative flex items-center justify-between gap-2">
                        <h3 className="text-base font-black italic uppercase text-white leading-tight truncate exhist-rise">{exerciseName}</h3>
                        <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all active:scale-90 shrink-0">
                            <X size={14} />
                        </button>
                    </div>

                    {/* ── Best mark (compact single row) ─────────────────── */}
                    {!loading && !offline && (bestMarkText || (repTarget && canUseRepTarget)) && (
                        <div className="relative mt-1.5 exhist-rise" style={{ animationDelay: '60ms' }}>
                            <div className="relative overflow-hidden rounded-xl border border-gym-primary/30 bg-gradient-to-br from-gym-primary/15 via-neutral-900 to-neutral-950 px-3 py-1.5">
                                <div className="exhist-shimmer absolute inset-0 pointer-events-none" />
                                {bestMarkText ? (
                                    <div className="relative flex items-center gap-2">
                                        <Trophy size={14} className="text-gym-primary shrink-0 exhist-trophy-glow rounded-full" />
                                        <p className="text-base font-black italic text-white leading-tight truncate">
                                            {bestMarkText}
                                            {repTarget && canUseRepTarget && (
                                                <span className="text-[9px] text-gym-primary/80 font-black not-italic ml-1.5">{repTarget}+ REPS</span>
                                            )}
                                            {bestMark?.entry.date && (
                                                <span className="text-[9px] text-neutral-500 font-bold not-italic ml-1.5">
                                                    {new Date(bestMark.entry.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="relative flex items-center gap-2">
                                        <Target size={14} className="text-neutral-500 shrink-0" />
                                        <p className="text-[10px] font-bold text-neutral-400">Sin series de {repTarget}+ reps en este período</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Combinable filters — clearly separated groups ─────── */}
                {hasControls && (
                    <div className="px-4 pb-2 space-y-1.5 shrink-0">
                        {/* Group 1: SORT */}
                        <div className="exhist-rise flex items-center gap-2" style={{ animationDelay: '120ms' }}>
                            <ArrowDownWideNarrow size={11} className="text-gym-primary shrink-0" />
                            <div className="grid flex-1 p-0.5 bg-black/70 border border-neutral-800/80 rounded-xl" style={{ gridTemplateColumns: `repeat(${sortOptions.length}, 1fr)` }}>
                                {sortOptions.map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setSortBy(opt.key)}
                                        className={`py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${sortBy === opt.key
                                            ? 'bg-gradient-to-r from-gym-primary to-yellow-400 text-black shadow-[0_0_12px_rgba(250,204,21,0.3)]'
                                            : 'text-neutral-500 hover:text-white active:scale-95'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Group 2: RANGE */}
                        <div className="exhist-rise flex items-center gap-2" style={{ animationDelay: '160ms' }}>
                            <CalendarRange size={11} className="text-sky-400 shrink-0" />
                            <div className="grid grid-cols-4 flex-1 p-0.5 bg-black/70 border border-neutral-800/80 rounded-xl">
                                {(Object.keys(RANGE_LABELS) as RangeKey[]).map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRange(r)}
                                        className={`py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${range === r
                                            ? 'bg-gradient-to-r from-sky-500 to-cyan-400 text-black shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                                            : 'text-neutral-500 hover:text-white active:scale-95'
                                        }`}
                                    >
                                        {RANGE_LABELS[r]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Group 3: REP TARGET (strength only) */}
                        {canUseRepTarget && (
                            <div className="exhist-rise flex items-center gap-2" style={{ animationDelay: '200ms' }}>
                                <Target size={11} className="text-emerald-400 shrink-0" />
                                <div className="flex flex-1 p-0.5 bg-black/70 border border-neutral-800/80 rounded-xl gap-1">
                                    <button
                                        onClick={() => setRepTarget(repTarget ? null : 8)}
                                        className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${repTarget
                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                            : 'text-neutral-500 hover:text-white active:scale-95'
                                        }`}
                                    >
                                        {repTarget ? `PR a ${repTarget}+ reps` : 'Objetivo de reps: off'}
                                    </button>
                                    {repTarget && (
                                        <div className="flex items-center gap-0.5 animate-in slide-in-from-right-2 fade-in duration-300">
                                            <button
                                                onClick={() => setRepTarget(Math.max(1, repTarget - 1))}
                                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 active:scale-90 transition-all"
                                            >
                                                <Minus size={11} strokeWidth={3} />
                                            </button>
                                            <button
                                                onClick={() => setRepTarget(Math.min(30, repTarget + 1))}
                                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 active:scale-90 transition-all"
                                            >
                                                <Plus size={11} strokeWidth={3} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Body ───────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto px-5 pb-6 pt-1 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-14 gap-3">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gym-primary/20 rounded-full blur-xl exhist-breathe" />
                                <Loader className="relative animate-spin text-gym-primary" size={30} />
                            </div>
                            <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Cargando historial…</p>
                        </div>
                    ) : offline ? (
                        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center exhist-rise">
                            <WifiOff className="text-neutral-600" size={34} />
                            <p className="text-neutral-300 text-sm font-black uppercase">Sin conexión</p>
                            <p className="text-neutral-600 text-xs max-w-[250px] leading-relaxed">Abre el historial de este ejercicio una vez con internet y quedará guardado para verlo sin conexión. Tus series de hoy se guardan igual.</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center exhist-rise">
                            <History className="text-neutral-700" size={34} />
                            <p className="text-neutral-300 text-sm font-black uppercase">Sin registros todavía</p>
                            <p className="text-neutral-600 text-xs max-w-[250px] leading-relaxed">Cuando completes series de este ejercicio, aparecerán aquí para que te compares.</p>
                        </div>
                    ) : visibleHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center exhist-rise">
                            <CalendarRange className="text-neutral-700" size={34} />
                            <p className="text-neutral-300 text-sm font-black uppercase">Nada en este período</p>
                            <p className="text-neutral-600 text-xs max-w-[250px] leading-relaxed">No entrenaste este ejercicio en este rango. Prueba con otro período.</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {visibleHistory.map((entry, entryIdx) => {
                                const headline = sessionHeadlineSet(entry)!;
                                const medal = medalBySet.get(headline);
                                const isExpanded = expandedIds.has(entry.sessionId);
                                return (
                                    <div
                                        key={entry.sessionId}
                                        className={`exhist-card bg-gradient-to-b from-neutral-900/80 to-neutral-950/90 border rounded-2xl overflow-hidden transition-all duration-300 ${medal === '🥇'
                                            ? 'border-gym-primary/40 shadow-[0_0_20px_rgba(250,204,21,0.08)]'
                                            : 'border-neutral-800/70'
                                        }`}
                                        style={{ animationDelay: `${Math.min(entryIdx, 8) * 55}ms` }}
                                    >
                                        {/* Collapsed row: date + THE searched value. Tap to expand. */}
                                        <button
                                            onClick={() => toggleExpanded(entry.sessionId)}
                                            className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left active:bg-white/[0.03] transition-colors"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-black uppercase tracking-wider text-neutral-500 mb-0.5">
                                                    {entry.date
                                                        ? new Date(entry.date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                                                        : 'Fecha desconocida'}
                                                </p>
                                                <p className="text-lg font-black italic text-white leading-tight flex items-center gap-2">
                                                    {medal && <span className="exhist-medal text-[16px] not-italic">{medal}</span>}
                                                    <span>{headlineText(headline)}</span>
                                                    {!medal && headline.is_pr && <Trophy size={12} className="text-gym-primary" />}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-[8px] font-black text-neutral-600 uppercase bg-black/40 px-2 py-0.5 rounded-full border border-neutral-800">
                                                    {entry.sets.length} serie{entry.sets.length !== 1 ? 's' : ''}
                                                </span>
                                                <ChevronDown size={16} className={`text-neutral-500 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-gym-primary' : ''}`} />
                                            </div>
                                        </button>

                                        {/* Expanded breakdown: full sets table */}
                                        {isExpanded && (
                                            <div className="border-t border-neutral-800/70 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="grid px-4 pt-2.5 pb-1 text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em]" style={{ gridTemplateColumns: `26px repeat(${columns.length}, 1fr) 26px` }}>
                                                    <span>#</span>
                                                    {columns.map(c => <span key={c} className="text-center">{c}</span>)}
                                                    <span></span>
                                                </div>
                                                <div className="px-4 pb-3 space-y-1">
                                                    {entry.sets.map((s, i) => {
                                                        const setMedal = medalBySet.get(s);
                                                        const dimmed = repTarget && canUseRepTarget && !qualifies(s);
                                                        return (
                                                            <div
                                                                key={i}
                                                                className={`grid items-center py-1.5 px-1 rounded-xl text-[13px] font-bold transition-all duration-300 ${setMedal
                                                                    ? 'bg-gradient-to-r from-gym-primary/15 to-transparent ring-1 ring-gym-primary/25'
                                                                    : 'hover:bg-white/[0.03]'
                                                                } ${dimmed ? 'opacity-25' : ''}`}
                                                                style={{ gridTemplateColumns: `26px repeat(${columns.length}, 1fr) 26px` }}
                                                            >
                                                                <span className="text-neutral-600 text-[10px] font-black">{s.set_number || i + 1}</span>
                                                                {showWeight && <span className="text-center text-white">{s.weight_kg > 0 ? <>{s.weight_kg}<span className="text-[9px] text-neutral-500 ml-0.5">kg</span></> : <span className="text-neutral-700">—</span>}</span>}
                                                                {showReps && <span className="text-center text-white">{s.reps > 0 ? s.reps : <span className="text-neutral-700">—</span>}</span>}
                                                                {showTime && <span className="text-center text-white">{s.time > 0 ? formatTime(s.time) : <span className="text-neutral-700">—</span>}</span>}
                                                                {showDistance && <span className="text-center text-white">{s.distance > 0 ? <>{s.distance}<span className="text-[9px] text-neutral-500 ml-0.5">m</span></> : <span className="text-neutral-700">—</span>}</span>}
                                                                {showRpe && <span className="text-center text-white">{s.rpe > 0 ? s.rpe : <span className="text-neutral-700">—</span>}</span>}
                                                                <span className={`flex justify-center items-center text-[13px] leading-none ${setMedal ? 'exhist-medal' : ''}`}>
                                                                    {setMedal ? setMedal : (s.is_pr && <Trophy size={11} className="text-gym-primary" />)}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .exhist-sheet {
                    animation: exhistSlideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                @keyframes exhistSlideUp {
                    from { transform: translateY(60px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
                .exhist-rise {
                    animation: exhistRise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                @keyframes exhistRise {
                    from { transform: translateY(14px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
                .exhist-card {
                    animation: exhistRise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                .exhist-shimmer {
                    background: linear-gradient(105deg, transparent 40%, rgba(250,204,21,0.12) 50%, transparent 60%);
                    background-size: 220% 100%;
                    animation: exhistShimmer 2.8s ease-in-out infinite;
                }
                @keyframes exhistShimmer {
                    0%   { background-position: 130% 0; }
                    55%  { background-position: -70% 0; }
                    100% { background-position: -70% 0; }
                }
                .exhist-trophy-glow {
                    animation: exhistGlow 2.2s ease-in-out infinite;
                }
                @keyframes exhistGlow {
                    0%, 100% { box-shadow: 0 0 8px rgba(250,204,21,0.25); }
                    50%      { box-shadow: 0 0 22px rgba(250,204,21,0.55); }
                }
                .exhist-breathe {
                    animation: exhistBreathe 3.5s ease-in-out infinite;
                }
                @keyframes exhistBreathe {
                    0%, 100% { opacity: 0.6; transform: scale(1); }
                    50%      { opacity: 1;   transform: scale(1.15); }
                }
                .exhist-medal {
                    animation: exhistMedalPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
                    filter: drop-shadow(0 0 6px rgba(250,204,21,0.4));
                }
                @keyframes exhistMedalPop {
                    from { transform: scale(0); }
                    to   { transform: scale(1); }
                }
            `}</style>
        </div>
    );
};
