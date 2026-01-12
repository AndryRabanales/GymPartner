import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BrainCircuit, Calendar, Save, Terminal, Flame, Snowflake, Skull, Minus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { journalService, type JournalEntry } from '../services/JournalService';

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
            // 1. Get History
            const { data: entries } = await journalService.getEntries(user!.id);
            if (entries) {
                setHistory(entries);

                // 2. Check Today
                const today = new Date().toISOString().split('T')[0];
                const todayRecord = entries.find(e => e.date === today);

                if (todayRecord) {
                    setTodayEntry(todayRecord);
                    setUserNote(todayRecord.user_note || '');
                } else {
                    // Auto-generate if missing
                    generateReport();
                }
            }
        } catch (error) {
            console.error("Error loading journal:", error);
        } finally {
            setLoading(false);
        }
    };

    const generateReport = async () => {
        setGenerating(true);
        try {
            // Artificial delay for "Thinking" effect
            await new Promise(r => setTimeout(r, 1500));
            const entry = await journalService.generateEntry(user!.id);
            if (entry) {
                setTodayEntry(entry);
                setUserNote(entry.user_note || '');
                // Reload history to include new entry
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
            // Update local state
            setTodayEntry({ ...todayEntry, user_note: userNote });
        } catch (error) {
            console.error("Failed to save note", error);
        } finally {
            setSavingNote(false);
        }
    };

    const getMoodIcon = (mood: string) => {
        switch (mood) {
            case 'fire': return <Flame className="text-orange-500" size={20} />;
            case 'ice': return <Snowflake className="text-blue-400" size={20} />;
            case 'skull': return <Skull className="text-red-500" size={20} />;
            default: return <Minus className="text-neutral-500" size={20} />;
        }
    };

    const getMoodColor = (mood: string) => {
        switch (mood) {
            case 'fire': return 'border-orange-500/50 bg-orange-500/5 text-orange-500';
            case 'ice': return 'border-blue-500/50 bg-blue-500/5 text-blue-400';
            case 'skull': return 'border-red-500/50 bg-red-500/5 text-red-500';
            default: return 'border-neutral-700 bg-neutral-900 text-neutral-400';
        }
    };

    if (loading && !todayEntry && !generating) {
        return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 animate-pulse">Cargando Sistema...</div>;
    }

    return (
        <div className="min-h-screen bg-black text-white pb-24">
            {/* HERADER */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 p-4">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 bg-neutral-900 rounded-full text-neutral-400 hover:text-white">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                        <BrainCircuit className="text-purple-500" />
                        Diario Táctico
                    </h1>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-4 space-y-8">

                {/* TODAY'S REPORT */}
                <section>
                    <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Terminal size={16} />
                        Informe del Día
                    </h2>

                    {generating ? (
                        <div className="bg-neutral-900/50 border border-purple-500/30 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 animate-pulse">
                            <BrainCircuit size={48} className="text-purple-500" />
                            <div className="text-purple-400 font-mono text-sm">ANALIZANDO CONSTANCIA... CALCULANDO VOLUMEN...</div>
                        </div>
                    ) : todayEntry ? (
                        <div className={`rounded-2xl border-2 p-1 relative overflow-hidden ${getMoodColor(todayEntry.mood).split(' ')[0]} ${todayEntry.mood === 'skull' ? 'shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'shadow-lg'}`}>
                            {/* TERMINAL CONTENT */}
                            <div className="bg-black/90 p-6 rounded-xl font-mono relative z-10">
                                <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-4">
                                    <div className="text-xs text-neutral-500">Target: {user?.user_metadata?.full_name || 'Agente'}</div>
                                    <div className={`text-xs font-bold uppercase flex items-center gap-1 ${getMoodColor(todayEntry.mood).split(' ')[2]}`}>
                                        {getMoodIcon(todayEntry.mood)}
                                        STATUS: {todayEntry.mood.toUpperCase()}
                                    </div>
                                </div>

                                <p className="text-sm md:text-base leading-relaxed text-neutral-200">
                                    {todayEntry.content}
                                </p>

                                {/* METRICS SNAPSHOT */}
                                <div className="mt-6 grid grid-cols-2 gap-2 text-xs text-neutral-500 border-t border-white/10 pt-4">
                                    <div>Volumen: <span className="text-white">{todayEntry.metrics_snapshot.total_volume.toLocaleString()}kg</span></div>
                                    <div>Sesiones: <span className="text-white">{todayEntry.metrics_snapshot.workouts_count}</span></div>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* USER NOTE */}
                    <div className="mt-4 bg-neutral-900/30 rounded-xl p-4 border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-neutral-500 uppercase">Nota Personal</label>
                            {todayEntry && (
                                <button
                                    onClick={handleSaveNote}
                                    disabled={savingNote || userNote === todayEntry.user_note}
                                    className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 transition-colors ${userNote !== todayEntry.user_note ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-neutral-500'}`}
                                >
                                    <Save size={12} />
                                    {savingNote ? 'Guardando...' : 'Guardar'}
                                </button>
                            )}
                        </div>
                        <textarea
                            value={userNote}
                            onChange={(e) => setUserNote(e.target.value)}
                            placeholder="Añade contexto táctico (lesiones, estado mental, etc)..."
                            className="w-full bg-transparent text-sm text-white placeholder-neutral-600 outline-none resize-none min-h-[80px]"
                        />
                    </div>
                </section>

                {/* TIMELINE */}
                <section>
                    <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Calendar size={16} />
                        Historial de Comportamiento
                    </h2>

                    <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-neutral-800 before:to-transparent">
                        {history.filter(h => h.id !== todayEntry?.id).map((entry) => (
                            <div key={entry.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                {/* ICON */}
                                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 bg-black shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow z-10 ${getMoodColor(entry.mood).split(' ')[0]}`}>
                                    {getMoodIcon(entry.mood)}
                                </div>

                                {/* CARD */}
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-neutral-900 p-4 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-center mb-1">
                                        <time className="font-mono text-xs text-neutral-500">{new Date(entry.date).toLocaleDateString()}</time>
                                    </div>
                                    <p className="text-sm text-neutral-300 line-clamp-2 italic">"{entry.content}"</p>
                                    {entry.user_note && (
                                        <div className="mt-2 pt-2 border-t border-white/5 text-xs text-neutral-500">
                                            Nota: {entry.user_note}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {history.length <= 1 && (
                            <div className="text-center text-neutral-600 text-sm py-8">
                                No hay más registros en la bitácora.
                            </div>
                        )}
                    </div>
                </section>

            </div>
        </div>
    );
};
