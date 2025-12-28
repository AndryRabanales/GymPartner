import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader, Trophy, Activity, Dumbbell, Calendar, Zap, TrendingUp, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { MuscleRadarChart } from '../components/stats/MuscleRadarChart';
import { OneRepMaxCard } from '../components/stats/OneRepMaxCard';
import { WorkoutHeatmap } from '../components/stats/WorkoutHeatmap';
import { StatsAnalyzer } from '../utils/StatsAnalyzer';
import { ShareOverlay } from '../components/stats/ShareOverlay';
import { PublicTeaser } from '../components/common/PublicTeaser';
import { socialService } from '../services/SocialService';

interface Stats {
    totalWorkouts: number;
    totalVolume: number;
    totalTimeMinutes: number;
    muscleBalanceData: any[];
    oneRepMaxes: any[];
    volumeTrendData: any[]; // New field
    consistencyData: any[]; // New field
    social: {             // New field
        followers: number;
        following: number;
        likes: number;
    };
}

export const StatsPage = () => {
    const { user } = useAuth();

    if (!user) {
        return (
            <PublicTeaser
                icon={TrendingUp}
                title="Centro de Análisis Biomecánico"
                description="Convierte tus entrenamientos en telemetría pura. Analiza cada músculo, cada repetición y cada gota de sudor."
                benefitTitle="Intel Táctico"
                benefitDescription="Gráficos de radar, tendencias de volumen por grupo muscular y cálculo de 1RM estimado."
                iconColor="text-green-500"
                bgAccent="bg-green-500/10"
            />
        );
    }

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats | null>(null);
    const [showShare, setShowShare] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        const loadStats = async () => {
            if (!user) return;

            try {
                // Fetch Profile Image
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('avatar_url')
                    .eq('id', user.id)
                    .single();

                if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);

                // Fetch workout sessions
                const { data: sessions, error } = await supabase
                    .from('workout_sessions')
                    .select(`
                        *,
                        workout_logs (
                            weight_kg,
                            reps,
                            sets,
                            time,
                            distance,
                            metrics_data,
                            exercise_id,
                            equipment:exercises ( name, target_muscle_group )
                        )
                    `)
                    .eq('user_id', user.id)
                    .not('end_time', 'is', null);

                if (error) throw error;

                if (!sessions || sessions.length === 0) {
                    setStats({ totalWorkouts: 0, totalVolume: 0, totalTimeMinutes: 0, muscleBalanceData: [], oneRepMaxes: [], volumeTrendData: [], consistencyData: [], social: { followers: 0, following: 0, likes: 0 } });
                    setLoading(false);
                    return;
                }

                // Fetch Social Stats
                const socialStats = await socialService.getProfileStats(user.id);

                // Calculate stats
                let totalVolume = 0;
                let totalTime = 0;

                sessions.forEach((session: any) => {
                    if (session.started_at && session.end_time) {
                        const start = new Date(session.started_at).getTime();
                        const end = new Date(session.end_time).getTime();
                        totalTime += (end - start) / (1000 * 60);
                    }

                    session.workout_logs?.forEach((log: any) => {
                        const sets = log.sets || 1;
                        let vol = 0;

                        // Normalization Logic (Synced with StatsAnalyzer)
                        if (log.weight_kg > 0) {
                            vol = (log.weight_kg * log.reps * sets);
                        }
                        else if ((log.time || log.metrics_data?.time) > 0) {
                            vol = (log.time || log.metrics_data?.time) * 1.5;
                        }
                        else if ((log.distance || log.metrics_data?.distance) > 0) {
                            vol = (log.distance || log.metrics_data?.distance) * 0.5;
                        }
                        else if (log.reps > 0) {
                            vol = (log.reps * 60 * sets * 0.5);
                        }
                        else if (log.metrics_data) {
                            // Generic Fallback
                            const customSum = Object.values(log.metrics_data).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);
                            vol = customSum * 0.5;
                        }

                        totalVolume += vol;
                    });
                });

                // ADVANCED ANALYTICS (GymPartner Intelligence)
                const muscleBalanceData = StatsAnalyzer.processMuscleBalance(sessions as any);
                const volumeTrendData = StatsAnalyzer.processVolumeTrends(sessions as any);
                const consistencyData = StatsAnalyzer.processConsistency(sessions as any);

                // Better approach for 1RM:
                const liftsByName: Record<string, { max: number, best: any }> = {};

                sessions.forEach((s: any) => {
                    s.workout_logs?.forEach((log: any) => {
                        if (!log.equipment?.name) return;
                        const name = log.equipment.name;
                        const est1RM = StatsAnalyzer.calculate1RM(log.weight_kg || 0, log.reps || 0);

                        if (!liftsByName[name] || est1RM > liftsByName[name].max) {
                            liftsByName[name] = {
                                max: est1RM,
                                best: { weight: log.weight_kg, reps: log.reps, date: s.started_at }
                            };
                        }
                    });
                });

                // Convert to array and sort
                const topLifts = Object.entries(liftsByName)
                    .map(([name, data]) => ({ name, ...data }))
                    .sort((a, b) => b.max - a.max)
                    .slice(0, 10); // Top 10 strongest lifts

                setStats({
                    totalWorkouts: sessions.length,
                    totalVolume: Math.round(totalVolume),
                    totalTimeMinutes: Math.round(totalTime),
                    muscleBalanceData,
                    oneRepMaxes: topLifts,
                    volumeTrendData,
                    consistencyData,
                    social: {
                        followers: socialStats.followersCount,
                        following: socialStats.followingCount,
                        likes: socialStats.totalLikes
                    }
                });
                setLoading(false);
            } catch (error) {
                console.error('Error loading stats:', error);
                setStats({
                    totalWorkouts: 0,
                    totalVolume: 0,
                    totalTimeMinutes: 0,
                    muscleBalanceData: [],
                    oneRepMaxes: [],
                    volumeTrendData: [],
                    consistencyData: [],
                    social: { followers: 0, following: 0, likes: 0 }
                });
                setLoading(false);
            }
        };

        loadStats();
    }, [user]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-gym-primary"><Loader className="animate-spin" size={32} /></div>;
    }

    if (!stats || stats.totalWorkouts === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-black">
                {/* Visual Glitch Background */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.2)_0%,transparent_70%)] animate-pulse"></div>
                    <div className="h-full w-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
                </div>

                <div className="bg-neutral-900/80 backdrop-blur-2xl p-12 rounded-[3rem] border border-white/10 max-w-xl w-full relative z-10 shadow-[0_0_50px_rgba(0,0,0,1)]">
                    <div className="w-24 h-24 bg-neutral-800 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/5 relative group overflow-hidden">
                        <TrendingUp className="w-12 h-12 text-neutral-600 group-hover:text-gym-primary transition-colors duration-500" />
                        <div className="absolute inset-0 bg-gym-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>

                    <h2 className="text-4xl font-black text-white mb-4 italic uppercase tracking-tighter">
                        CENTRO DE INTELIGENCIA <br />
                        <span className="text-gym-primary">SISTEMA BLOQUEADO</span>
                    </h2>

                    <p className="text-neutral-400 mb-10 font-medium text-lg leading-relaxed">
                        No hay datos de batalla suficientes para generar un perfil biomecánico.
                        Completa tu primer entrenamiento para desbloquear el análisis táctico.
                    </p>

                    <div className="flex flex-col gap-4">
                        <Link to="/map" className="bg-gym-primary text-black font-black py-4 px-8 rounded-2xl hover:bg-yellow-400 transition-all transform hover:scale-[1.02] shadow-xl shadow-gym-primary/20 no-underline italic">
                            DESPLEGAR EN EL MAPA
                        </Link>
                        <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-[0.3em]">Status: Esperando telemetría de combate...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 pb-24">
            {/* Header */}
            <div className="text-center mb-8 relative">
                <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight uppercase italic">
                    Centro de Análisis
                </h1>
                <p className="text-neutral-400 text-sm mb-4">Métricas y estadísticas de tu progreso</p>

                <button
                    onClick={() => setShowShare(true)}
                    className="absolute top-0 right-0 p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 text-gym-primary transition-colors"
                    title="Compartir Historia"
                >
                    <Share2 size={20} />
                </button>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <MetricCard
                    // ... existing props
                    label="Volumen Total"
                    value={`${(stats.totalVolume / 1000).toFixed(1)}k`}
                    unit="kg"
                    icon={Dumbbell}
                    color="text-blue-500"
                    bg="bg-blue-500/10"
                    border="border-blue-500/20"
                />
                {/* ... other cards unchanged ... */}
                <MetricCard
                    label="Sesiones"
                    value={stats.totalWorkouts.toString()}
                    unit="Totales"
                    icon={Trophy}
                    color="text-yellow-500"
                    bg="bg-yellow-500/10"
                    border="border-yellow-500/20"
                />
                <MetricCard
                    label="Tiempo Total"
                    value={Math.round(stats.totalTimeMinutes / 60).toString()}
                    unit="Horas"
                    icon={Activity}
                    color="text-orange-500"
                    bg="bg-orange-500/10"
                    border="border-orange-500/20"
                />
                <MetricCard
                    label="Promedio/Sesión"
                    value={Math.round(stats.totalTimeMinutes / stats.totalWorkouts).toString()}
                    unit="Min"
                    icon={Zap}
                    color="text-purple-500"
                    bg="bg-purple-500/10"
                    border="border-purple-500/20"
                />
            </div>

            {/* MAIN ANALYTICS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* SOCIAL INTELLIGENCE CARD (New) */}
                <div className="lg:col-span-3 bg-gradient-to-r from-neutral-900 via-neutral-900 to-yellow-900/10 border border-neutral-800 rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Share2 size={100} className="text-yellow-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                        <Share2 size={18} className="text-yellow-500" />
                        Influencia Social
                    </h3>

                    <div className="grid grid-cols-3 gap-4 relative z-10">
                        <div className="bg-black/30 p-4 rounded-2xl border border-white/5 text-center">
                            <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider mb-1">Seguidores</p>
                            <span className="text-3xl font-black text-white">{stats.social.followers}</span>
                        </div>
                        <div className="bg-black/30 p-4 rounded-2xl border border-white/5 text-center">
                            <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider mb-1">Likes</p>
                            <span className="text-3xl font-black text-white">{stats.social.likes}</span>
                        </div>
                        <div className="bg-black/30 p-4 rounded-2xl border border-white/5 text-center">
                            <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider mb-1">Siguiendo</p>
                            <span className="text-3xl font-black text-neutral-400">{stats.social.following}</span>
                        </div>
                    </div>
                </div>

                {/* 1. Radar Chart */}
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5">
                        <Activity size={120} className="text-gym-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                        <Activity size={18} className="text-gym-primary" />
                        Radar de Equilibrio Muscular
                    </h3>
                    <div className="relative z-10 min-h-[300px] w-full">
                        {stats.muscleBalanceData.length > 0 ? (
                            <MuscleRadarChart data={stats.muscleBalanceData} />
                        ) : (
                            <div className="h-[300px] flex items-center justify-center">
                                <p className="text-neutral-500 text-sm">Registra ejercicios para ver tu Radar.</p>
                            </div>
                        )}
                    </div>
                    <p className="text-center text-xs text-neutral-500 mt-2">Distribución de volumen (Series) por grupo muscular</p>
                </div>

                {/* 2. Top Lifts List (Side Panel) */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Trophy size={18} className="text-yellow-500" />
                        Récords Teóricos (1RM)
                    </h3>
                    <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-2 custom-scrollbar">
                        {stats.oneRepMaxes.length > 0 ? stats.oneRepMaxes.map(lift => (
                            <OneRepMaxCard
                                key={lift.name}
                                exerciseName={lift.name}
                                estimatedMax={lift.max}
                                bestLift={lift.best}
                            />
                        )) : (
                            <p className="text-neutral-500 text-sm">Registra pesos para ver tus récords.</p>
                        )}
                    </div>
                </div>

                {/* 3. Consistency Heatmap (Full Width) */}
                <div className="lg:col-span-3 bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Calendar size={18} className="text-green-500" />
                        Consistencia (Últimos 90 días)
                    </h3>
                    <WorkoutHeatmap data={stats.consistencyData} />
                </div>



            </div>

            <div className="text-center pt-8 opacity-50 text-xs text-neutral-500 font-mono">
                GYM PARTNER ANALYTICS ENGINE™
            </div>

            {/* Share Overlay */}
            {showShare && (
                <ShareOverlay
                    stats={stats}
                    onClose={() => setShowShare(false)}
                    username={user?.user_metadata?.full_name || 'Atleta'}
                    avatarUrl={avatarUrl || undefined}
                />
            )}
        </div>
    );
};

const MetricCard = ({ label, value, unit, icon: Icon, color, bg, border }: any) => (
    <div className={`bg-neutral-900 border ${border} p-4 rounded-3xl relative overflow-hidden group hover:scale-[1.02] transition-transform`}>
        <div className={`absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity`}>
            <Icon size={48} className={color} />
        </div>
        <div className="relative z-10">
            <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center mb-3`}>
                <Icon size={16} className={color} />
            </div>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
            <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-black ${color}`}>{value}</span>
                <span className="text-[10px] text-neutral-500 font-bold">{unit}</span>
            </div>
        </div>
    </div>
);
