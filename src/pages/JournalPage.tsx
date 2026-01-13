import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BrainCircuit, Calendar, Save, Terminal, Flame, Snowflake, Skull, Minus, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { journalService, type JournalEntry } from '../services/JournalService';

import { supabase } from '../lib/supabase';

export const JournalPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [todayEntry, setTodayEntry] = useState<JournalEntry | null>(null);
    const [history, setHistory] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [userNote, setUserNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    useEffect(() => {
        if (user) {
            loadJournal();
        }
    }, [user]);

    const loadJournal = async () => {
        try {
            setLoading(true);
            const { data: entries } = await journalService.getEntries(user!.id);
            if (entries) {
                setHistory(entries);
                const today = new Date().toISOString().split('T')[0];
                const todayRecord = entries.find(e => e.date === today);

                if (todayRecord) {
                    setTodayEntry(todayRecord);
                    setUserNote(todayRecord.user_note || '');
                    if (todayRecord.metrics_snapshot.workouts_count === 0) {
                        generateReport(false);
                    }
                } else {
                    generateReport();
                }
            }
        } catch (error) {
            console.error("Error loading journal:", error);
        } finally {
            setLoading(false);
        }
    };

    const generateReport = async (force: boolean = false) => {
        setGenerating(true);
        try {
            await new Promise(r => setTimeout(r, 1500));
            let userName = user?.user_metadata?.full_name || "Usuario";
            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', user!.id)
                    .maybeSingle();
                if (profile?.username) userName = profile.username;
            } catch (e) { console.warn(e); }

            const entry = await journalService.generateEntry(user!.id, userName, force, userNote);
            if (entry) {
                setTodayEntry(entry);
                setUserNote(entry.user_note || '');
                const { data: entries } = await journalService.getEntries(user!.id);
                if (entries) setHistory(entries);
            }
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveNote = async () => {
        if (!todayEntry) return;
        setSavingNote(true);
        try {
            await journalService.updateUserNote(todayEntry.id, userNote);
            setTodayEntry({ ...todayEntry, user_note: userNote });
            if (userNote.trim().length > 0) {
                await generateReport(true);
            }
        } catch (error) {
            console.error("Failed to save note", error);
        } finally {
            setSavingNote(false);
        }
    };

    const getMoodConfig = (mood: string) => {
        switch (mood) {
            case 'fire': return {
                icon: <Flame className="drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" size={24} />,
                color: 'text-orange-500',
                border: 'border-orange-500/30',
                bg: 'bg-orange-500/5',
                glow: 'shadow-[0_0_40px_-10px_rgba(249,115,22,0.3)]',
                label: 'PROGRESO'
            };
            case 'ice': return {
                icon: <Snowflake className="drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]" size={24} />,
                color: 'text-blue-400',
                border: 'border-blue-500/30',
                bg: 'bg-blue-500/5',
                glow: 'shadow-[0_0_40px_-10px_rgba(96,165,250,0.3)]',
                label: 'MANTENIMIENTO'
            };
            case 'skull': return {
                icon: <Skull className="drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" size={24} />,
                color: 'text-red-500',
                border: 'border-red-500/30',
                bg: 'bg-red-500/5',
                glow: 'shadow-[0_0_40px_-10px_rgba(239,68,68,0.3)]',
                label: 'REGRESIÓN'
            };
            default: return {
                icon: <Minus size={24} />,
                color: 'text-neutral-400',
                border: 'border-neutral-700',
                bg: 'bg-neutral-900',
                glow: 'shadow-none',
                label: 'NEUTRAL'
            };
        }
    };

    const moodStyle = todayEntry ? getMoodConfig(todayEntry.mood) : getMoodConfig('neutral');

    if (loading && !todayEntry && !generating) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <BrainCircuit className="text-purple-500 animate-pulse" size={48} />
                    <span className="text-neutral-500 font-mono text-sm tracking-widest uppercase animate-pulse">Cargando Sistema...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white pb-24 font-sans selection:bg-purple-500/30">
            {/* AMBIENT BACKGROUND GLOWS */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full" />
                <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />
            </div>

            {/* HEADER */}
            <div className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 p-4 transition-all duration-300">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition-colors border border-white/5">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                            <Sparkles className="text-purple-500" size={16} />
                            GYMPARTNER <span className="text-neutral-500 font-normal">INTELLIGENCE</span>
                        </h1>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-4 space-y-8 relative z-10">

                {/* DIAGNOSIS CARD (HERO) */}
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Terminal size={14} />
                            Diagnóstico Diario
                        </h2>
                        {todayEntry && (
                            <span className="text-[10px] uppercase font-mono text-neutral-600 bg-white/5 px-2 py-1 rounded border border-white/5">
                                {new Date(todayEntry.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                        )}
                    </div>

                    {generating ? (
                        <div className="bg-black/40 border border-purple-500/20 rounded-3xl p-12 flex flex-col items-center justify-center gap-6 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent animate-[shimmer_2s_infinite]" />
                            <BrainCircuit size={56} className="text-purple-500 animate-pulse relative z-10" />
                            <div className="space-y-1 text-center relative z-10">
                                <div className="text-white font-medium">Analizando Métricas...</div>
                                <div className="text-neutral-500 text-xs font-mono">Conectando con Gemini 2.5 Flash...</div>
                            </div>
                        </div>
                    ) : todayEntry ? (
                        <div className={`group relative rounded-3xl p-[1px] bg-gradient-to-b from-white/10 to-transparent transition-all duration-500 ${moodStyle.glow}`}>
                            {/* DYNAMIC BORDER GRADIENT */}
                            <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${todayEntry.mood === 'fire' ? 'from-orange-500/20' : todayEntry.mood === 'ice' ? 'from-blue-500/20' : todayEntry.mood === 'skull' ? 'from-red-500/20' : 'from-white/5'} to-transparent opacity-50 blur-sm`} />

                            <div className="relative bg-[#0F0F0F] rounded-[23px] overflow-hidden">
                                {/* CARD CONTENT */}
                                <div className="p-6 md:p-8">
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-6">
                                        <div className="flex-1">
                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 border ${moodStyle.border} ${moodStyle.bg} ${moodStyle.color}`}>
                                                {moodStyle.icon}
                                                {moodStyle.label}
                                            </div>
                                            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight">
                                                {todayEntry.content.match(/^\[(.*?)\]/)?.[1] || "Análisis Completado"}
                                            </h3>
                                        </div>

                                        {/* METRICS FLOATING */}
                                        <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
                                            <div className="text-center">
                                                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Volumen</div>
                                                <div className="text-lg font-mono font-bold text-white">{todayEntry.metrics_snapshot.total_volume.toLocaleString()}</div>
                                            </div>
                                            <div className="w-px bg-white/10" />
                                            <div className="text-center">
                                                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Sesiones</div>
                                                <div className="text-lg font-mono font-bold text-white">{todayEntry.metrics_snapshot.workouts_count}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* DIAGNOSIS TEXT */}
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <p className="text-base md:text-lg text-neutral-300 font-light leading-relaxed">
                                            {todayEntry.content.replace(/^\[.*?\]\s*/, '')}
                                        </p>
                                    </div>
                                </div>

                                {/* BOTTOM ACTION BAR */}
                                <div className="bg-black/40 border-t border-white/5 p-4 flex items-center justify-between">
                                    <div className="text-[10px] text-neutral-600 font-mono">AI-MODEL: GEMINI-2.5-FLASH</div>
                                    <button
                                        onClick={() => generateReport(true)}
                                        disabled={generating}
                                        className="text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/10 px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                                    >
                                        <BrainCircuit size={14} />
                                        RE-DIAGNOSTICAR
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </section>

                {/* CONTEXT INPUT (THE ANALYST) */}
                <section className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                        <div className="bg-neutral-900/80 backdrop-blur-md rounded-2xl p-1 border border-white/10 relative">
                            <div className="p-4">
                                <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2 mb-3">
                                    <Save size={12} className="text-purple-400" />
                                    Contexto / Causa
                                </label>
                                <textarea
                                    value={userNote}
                                    onChange={(e) => setUserNote(e.target.value)}
                                    placeholder="¿Algo que añadir? (Ej: 'Dormí mal', 'Me dolía la rodilla')..."
                                    className="w-full bg-transparent text-sm text-white placeholder-neutral-600 outline-none resize-none h-20"
                                />
                                <div className="flex justify-end mt-2 overflow-hidden h-0 group-focus-within:h-10 transition-all duration-300">
                                    {todayEntry && userNote !== todayEntry.user_note && (
                                        <button
                                            onClick={handleSaveNote}
                                            disabled={savingNote}
                                            className="bg-white text-black text-xs font-black px-6 py-2 rounded-full hover:scale-105 transition-transform"
                                        >
                                            {savingNote ? 'GUARDANDO...' : 'GUARDAR'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* TIMELINE */}
                <section className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
                    <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
                        <Calendar size={14} />
                        Historial Reciente
                    </h2>

                    <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-px before:bg-gradient-to-b before:from-white/20 before:to-transparent">
                        {history.filter(h => h.id !== todayEntry?.id).map((entry, index) => {
                            const entryConfig = getMoodConfig(entry.mood);
                            return (
                                <div key={entry.id} className="relative group">
                                    {/* DOT */}
                                    <div className={`absolute -left-[29px] top-1.5 w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${entryConfig.bg.replace('/5', '')} ${entryConfig.color} shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10`} />

                                    <div className="bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all duration-300 backdrop-blur-md">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                {/* Mini Icon */}
                                                <div className={`${entryConfig.color}`}>
                                                    {entryConfig.icon.type && <entryConfig.icon.type {...entryConfig.icon.props} size={16} />}
                                                </div>
                                                <time className="text-xs text-neutral-400 font-mono">
                                                    {new Date(entry.date).toLocaleDateString()}
                                                </time>
                                            </div>
                                            {entry.metric_snapshot?.total_volume > 0 && (
                                                <span className="text-[10px] font-mono text-neutral-600">{entry.metrics_snapshot?.total_volume}kg</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-neutral-300 italic line-clamp-2">
                                            "{entry.content.replace(/^\[.*?\]\s*/, '')}"
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        {history.length <= 1 && (
                            <div className="text-neutral-600 text-xs font-mono py-4">Inicia tu viaje para ver el historial aqui.</div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};
