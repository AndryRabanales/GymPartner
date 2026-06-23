/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Equipment, CustomSettings } from '../services/GymEquipmentService';
import { equipmentService, COMMON_EQUIPMENT_SEEDS } from '../services/GymEquipmentService';
import { userService } from '../services/UserService';
import { workoutService } from '../services/WorkoutService';
import { WorkoutCarousel } from '../components/workout/WorkoutCarousel';
import { WorkoutCatalog } from '../components/workout/WorkoutCatalog';
import { getExtrasForMuscle } from '../data/exerciseCatalog';
import { IMAGE_MANIFEST } from '../data/imageManifest';
import { useUnlockedExercises } from '../hooks/useUnlockedExercises';
import { ArsenalGrid } from '../components/arsenal/ArsenalGrid';
import { EquipmentForm } from '../components/arsenal/EquipmentForm';
import { normalizeText, getMuscleGroup } from '../utils/inventoryUtils';
// SmartNumpad removed

// Interface NumpadTarget removed
// BattleTimer removed
import { Loader2, ArrowLeft, ChevronLeft, Image as ImageIcon, MapPin, Search, Plus, Save, Activity, Layers, Tag, Battery, MapIcon, Check, Settings as SettingsIcon, Swords, Trash2, X, RotateCcw, Lock, Play, Loader, MoreVertical, Pause, LockOpen, LogOut, Award } from 'lucide-react';
import { getCurrentPosition, haversineDistance } from '../utils/geolocationUtils';
import type { GymPlace, Database } from '../types/database';
import { InteractiveOverlay } from '../components/onboarding/InteractiveOverlay';
import { ForceExitModal } from '../components/common/ForceExitModal';
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';

interface WorkoutSet {
    id: string; // Temporary ID for UI
    weight: number;
    reps: number;
    time?: number;     // Seconds
    distance?: number; // Meters
    rpe?: number;      // 1-10
    custom?: Record<string, number>; // Dynamic metrics (jumps, cadence, etc.)
    completed: boolean;
    completedAt?: number; // Snapshot time
    locked?: boolean;
    // Enhanced Timer Props
    restStatus?: 'running' | 'paused' | 'completed';
    restAccumulated?: number; // ms stored
    restLastStartTime?: number; // ms timestamp of current run start
    // CRDT Conflict Resolution
    lastUpdatedAt?: number;

    // dynamic player performance maps
    playerWeights?: Record<string, number>;
    playerReps?: Record<string, number>;
    playerTimes?: Record<string, number>;
    playerDistances?: Record<string, number>;
    playerRpes?: Record<string, number>;
    playerCompleted?: Record<string, boolean>;
    playerLocked?: Record<string, boolean>;
    playerCompletedAt?: Record<string, string>;
    playerRestStatus?: Record<string, 'running' | 'paused' | 'completed'>;
    playerRestAccumulated?: Record<string, number>;
    playerRestLastStartTime?: Record<string, number>;

    // P2 companion fields
    p2_weight?: number;
    p2_reps?: number;
    p2_time?: number;
    p2_distance?: number;
    p2_rpe?: number;
    p2_completed?: boolean;
    p2_locked?: boolean;
    p2_completedAt?: string;
    p2_restStatus?: 'running' | 'paused' | 'completed';
    p2_restAccumulated?: number;
    p2_restLastStartTime?: number;
}

const STORAGE_KEY = 'ginx_active_session';

interface WorkoutExercise {
    id: string; // Temp UI ID
    equipmentId: string;
    equipmentName: string;
    metrics: {
        weight: boolean;
        reps: boolean;
        time: boolean;
        distance: boolean;
        rpe: boolean;
        [key: string]: boolean; // Allow custom metrics (cadencia, altura, watts, etc.)
    };
    sets: WorkoutSet[];
    // NEW: Per-exercise Weight Unit
    weightUnit?: 'kg' | 'lb';
    category?: string; // SNAPSHOT: For history persistence
}

// Smart timestamp parser that safely resolves ISO strings, Unix strings, and numbers
const parseTimestamp = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const num = Number(val);
    if (!isNaN(num) && num > 0) return num;
    const dt = new Date(val).getTime();
    if (!isNaN(dt) && dt > 0) return dt;
    return 0;
};

const safeNum = (val: any, fallback = 0): number => {
    if (val === undefined || val === null) return fallback;
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) || !isFinite(num) ? fallback : num;
};

// ─── Sanitize ghost rest timers from localStorage/DB ───────────────────────
// If a set was completed in a previous session that was never properly closed,
// its restLastStartTime is a stale timestamp from hours ago. This function
// detects those and freezes the timer at the accumulated value, preventing
// the display from showing "66 minutes" on a brand-new session.
const sanitizeRestTimers = (exercises: any[]): any[] => {
    const MAX_REST_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours — if older, it's a ghost
    const now = Date.now();
    return exercises.map(ex => ({
        ...ex,
        sets: ex.sets.map((s: any) => {
            const clean = { ...s };

            // ── Legacy scalar fields ──────────────────────────────────────────
            if (clean.restStatus === 'running' && clean.restLastStartTime) {
                const parsedTime = parseTimestamp(clean.restLastStartTime);
                const age = parsedTime > 0 ? now - parsedTime : MAX_REST_AGE_MS + 100;
                if (isNaN(age) || age > MAX_REST_AGE_MS) {
                    const safeAge = isNaN(age) ? MAX_REST_AGE_MS : age;
                    clean.restAccumulated = (Number(clean.restAccumulated) || 0) + Math.min(safeAge, MAX_REST_AGE_MS);
                    clean.restStatus = 'completed';
                    clean.restLastStartTime = undefined;
                }
            }

            // ── P2 scalar fields ─────────────────────────────────────────────
            if (clean.p2_restStatus === 'running' && clean.p2_restLastStartTime) {
                const parsedTime = parseTimestamp(clean.p2_restLastStartTime);
                const age = parsedTime > 0 ? now - parsedTime : MAX_REST_AGE_MS + 100;
                if (isNaN(age) || age > MAX_REST_AGE_MS) {
                    const safeAge = isNaN(age) ? MAX_REST_AGE_MS : age;
                    clean.p2_restAccumulated = (Number(clean.p2_restAccumulated) || 0) + Math.min(safeAge, MAX_REST_AGE_MS);
                    clean.p2_restStatus = 'completed';
                    clean.p2_restLastStartTime = undefined;
                }
            }

            // ── Per-player maps ───────────────────────────────────────────────
            if (clean.playerRestStatus && clean.playerRestLastStartTime) {
                const newStatus = { ...(clean.playerRestStatus || {}) };
                const newAcc = { ...(clean.playerRestAccumulated || {}) };
                const newLst = { ...(clean.playerRestLastStartTime || {}) };

                Object.keys(newLst).forEach(pid => {
                    const parsedTime = parseTimestamp(newLst[pid]);
                    if (newStatus[pid] === 'running') {
                        const age = parsedTime > 0 ? now - parsedTime : MAX_REST_AGE_MS + 100;
                        if (isNaN(age) || age > MAX_REST_AGE_MS) {
                            const safeAge = isNaN(age) ? MAX_REST_AGE_MS : age;
                            newAcc[pid] = (Number(newAcc[pid]) || 0) + Math.min(safeAge, MAX_REST_AGE_MS);
                            newStatus[pid] = 'completed';
                            delete newLst[pid];
                        }
                    }
                });

                clean.playerRestStatus = newStatus;
                clean.playerRestAccumulated = newAcc;
                clean.playerRestLastStartTime = newLst;
            }

            return clean;
        })
    }));
};

// Detect and stamp is_pr=true on the single best set per exercise that beats
// the user's all-time estimated 1RM (Epley: weight × (1 + reps/30)).
// Non-critical: errors are silently swallowed.
const detectAndMarkPRs = async (sessionId: string, userId: string): Promise<void> => {
    try {
        const { data: currentSets } = await supabase
            .from('workout_logs')
            .select('id, exercise_id, weight_kg, reps')
            .eq('session_id', sessionId)
            .eq('owner_id', userId)
            .gt('weight_kg', 0);

        if (!currentSets || currentSets.length === 0) return;

        const exerciseIds = [...new Set(currentSets.map((s: any) => s.exercise_id as string))];

        const { data: hist } = await supabase
            .from('workout_logs')
            .select('exercise_id, weight_kg, reps')
            .in('exercise_id', exerciseIds)
            .eq('owner_id', userId)
            .neq('session_id', sessionId)
            .gt('weight_kg', 0);

        const histMax = new Map<string, number>();
        for (const s of (hist || [])) {
            const e1rm = (s.weight_kg || 0) * (1 + ((s.reps || 1) / 30));
            if (e1rm > (histMax.get(s.exercise_id) ?? 0)) histMax.set(s.exercise_id, e1rm);
        }

        const bestSet = new Map<string, { id: string; e1rm: number }>();
        for (const s of currentSets as any[]) {
            const e1rm = (s.weight_kg || 0) * (1 + ((s.reps || 1) / 30));
            const prev = bestSet.get(s.exercise_id);
            if (!prev || e1rm > prev.e1rm) bestSet.set(s.exercise_id, { id: s.id, e1rm });
        }

        const prIds: string[] = [];
        for (const [exId, { id, e1rm }] of bestSet) {
            if (e1rm > (histMax.get(exId) ?? 0)) prIds.push(id);
        }

        if (prIds.length > 0) {
            await supabase.from('workout_logs').update({ is_pr: true }).in('id', prIds);
        }
    } catch { /* non-critical */ }
};

// Helper Component for Rest Timer
const RestTimerDisplay = ({ status, accumulated, lastStartTime, isGold }: { status: 'running' | 'paused' | 'completed', accumulated: number, lastStartTime?: number | string, isGold?: boolean }) => {
    const [elapsed, setElapsed] = useState(0);
    const receivedAtRef = useRef<number>(Date.now());

    // Reset receivedAtRef whenever status or lastStartTime changes
    useEffect(() => {
        receivedAtRef.current = Date.now();
    }, [status, lastStartTime]);

    useEffect(() => {
        const safeAccumulated = Number(accumulated) || 0;
        const getInitial = () => {
            if (status === 'running' && lastStartTime) {
                const parsedTime = parseTimestamp(lastStartTime);
                if (parsedTime <= 0) return Math.floor(safeAccumulated / 1000);
                const diff = Date.now() - parsedTime;
                
                // If diff is negative or invalid, fall back to relative elapsed time since received
                if (diff < 0 || diff > 86400000) {
                    const localDiff = Date.now() - receivedAtRef.current;
                    return Math.floor((safeAccumulated + localDiff) / 1000);
                }
                return Math.floor((safeAccumulated + diff) / 1000);
            }
            return Math.floor(safeAccumulated / 1000);
        };

        // Set immediately (no 1-sec lag) then tick locally every second
        setElapsed(getInitial());

        if (status === 'running') {
            const interval = setInterval(() => {
                const safeAcc = Number(accumulated) || 0;
                if (lastStartTime) {
                    const parsedTime = parseTimestamp(lastStartTime);
                    if (parsedTime > 0) {
                        const diff = Date.now() - parsedTime;
                        if (diff < 0 || diff > 86400000) {
                            const localDiff = Date.now() - receivedAtRef.current;
                            setElapsed(Math.max(0, Math.floor((safeAcc + localDiff) / 1000)));
                        } else {
                            setElapsed(Math.max(0, Math.floor((safeAcc + diff) / 1000)));
                        }
                    } else {
                        const localDiff = Date.now() - receivedAtRef.current;
                        setElapsed(Math.max(0, Math.floor((safeAcc + localDiff) / 1000)));
                    }
                } else {
                    const localDiff = Date.now() - receivedAtRef.current;
                    setElapsed(Math.max(0, Math.floor((safeAcc + localDiff) / 1000)));
                }
            }, 200);
            return () => clearInterval(interval);
        }
    }, [status, accumulated, lastStartTime]);

    const formatTime = (secs: number) => {
        const safeSecs = isNaN(secs) || !isFinite(secs) ? 0 : Math.max(0, secs);
        const m = Math.floor(safeSecs / 60);
        const sec = safeSecs % 60;
        return String(m) + ':' + String(sec).padStart(2, '0');
    };

    return (
        <span className={`text-sm font-black tabular-nums transition-colors ${isGold ? 'text-gym-primary shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'text-neutral-500'}`}>
            {formatTime(elapsed)}
        </span>
    );
};
export const WorkoutSession = () => {
    const { user } = useAuth();
    const { unlock: unlockExercise, isUnlocked } = useUnlockedExercises();
    const isLeavingPageRef = useRef(false);
    const navigate = useNavigate();
    const { gymId: routeGymId } = useParams<{ gymId: string }>();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    
    // Multiplayer State
        const navState = location.state as any || {};
    const cachedCoopStr = localStorage.getItem('ginx_coop_state');
    const cachedCoop = cachedCoopStr ? JSON.parse(cachedCoopStr) : {};

    const [isMultiplayer, setIsMultiplayer] = useState<boolean>(navState.isMultiplayer ?? cachedCoop.isMultiplayer ?? false);
    const isMultiplayerRef = useRef<boolean>(navState.isMultiplayer ?? cachedCoop.isMultiplayer ?? false);
    const [multiplayerMode, setMultiplayerMode] = useState<'conjunto' | 'separado' | null>(navState.multiplayerMode ?? cachedCoop.multiplayerMode ?? null);
    const [partnerId, setPartnerId] = useState<string | null>(navState.partnerId ?? cachedCoop.partnerId ?? null);
    const [chatId, setChatId] = useState<string | null>(navState.chatId ?? cachedCoop.chatId ?? null);
    const [partnerSessionId, setPartnerSessionId] = useState<string | null>(navState.partnerSessionId ?? cachedCoop.partnerSessionId ?? null);
    const [isInviter, setIsInviter] = useState<boolean>(navState.isInviter ?? cachedCoop.isInviter ?? true);
    
    useEffect(() => {
        isMultiplayerRef.current = isMultiplayer;
        if (isMultiplayer) {
            isInviterRef.current = isInviter; // keep ref in sync
            localStorage.setItem('ginx_coop_state', JSON.stringify({ isMultiplayer, multiplayerMode, partnerId, chatId, partnerSessionId, isInviter }));
        } else {
            localStorage.removeItem('ginx_coop_state');
        }
    }, [isMultiplayer, multiplayerMode, partnerId, chatId, partnerSessionId, isInviter]);

    // State
    const [loading, setLoading] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [activeExercises, setActiveExercises] = useState<WorkoutExercise[]>([]);
    const activeExercisesRef = useRef<WorkoutExercise[]>([]);
    // Snapshot of the last non-empty exercises state — used by session_finished handler so
    // guests can save sets even if activeExercisesRef is cleared before the event arrives.
    const lastNonEmptyExercisesRef = useRef<WorkoutExercise[]>([]);
    // Tracks exercises deliberately removed during this session so incoming sync_state
    // cannot re-add them (race condition fix for multiplayer).
    const deletedExerciseIdsRef = useRef<Set<string>>(new Set());
    // Tracks set IDs deliberately removed so incoming sync_state cannot re-add them.
    const deletedSetIdsRef = useRef<Set<string>>(new Set());
    const startTimeRef = useRef<Date | null>(null);
    useEffect(() => {
        // Clear temporary exit active flag when entering/returning to the workout session screen
        sessionStorage.removeItem('ginx_temp_exit_active');
    }, []);

    useEffect(() => {
        activeExercisesRef.current = activeExercises;
        if (activeExercises.length > 0) {
            lastNonEmptyExercisesRef.current = activeExercises;
        }
    }, [activeExercises]);
    useEffect(() => {
        startTimeRef.current = startTime;
    }, [startTime]);

    useEffect(() => {
        if (!user) return;
        const state = location.state as any;
        if (state && state.isMultiplayer) {
            console.log('🔄 Sincronizando nuevo estado multijugador desde location.state:', state);
            
            // Clean local exercise state ONLY if forceNewSession is explicitly requested (fresh start)
            if (state.forceNewSession === true) {
                console.log('🧹 [Force New Session] Cleaning exercises from state');
                setActiveExercises([]);
                setCurrentRoutineName('');
                setOriginalExerciseIds([]);
                setIsRoutineModified(false);
            } else {
                console.log('🚀 [Preserve Session] Preserving existing exercises to invite partner to current room');
            }
            setIsMultiplayer(true);
            if (state.multiplayerMode) setMultiplayerMode(state.multiplayerMode);
            if (state.partnerId) setPartnerId(state.partnerId);
            if (state.chatId) setChatId(state.chatId);
            if (state.partnerSessionId) setPartnerSessionId(state.partnerSessionId);
            if (state.isInviter !== undefined) {
                setIsInviter(state.isInviter);
                isInviterRef.current = state.isInviter;
            }

            // Dynamically update the sync room ID when new location state is explicitly pushed!
            const nextIsInv = state.isInviter !== undefined ? state.isInviter : isInviter;
            if (!nextIsInv) {
                const nextRoomId = state.partnerSessionId || state.chatId;
                if (nextRoomId) {
                    console.log('🔑 Sincronizando syncRoomId para el invitado:', nextRoomId);
                    setSyncRoomId(nextRoomId);
                }
            }

            // Enrich host's exercises for multiplayer maps!
            setActiveExercises(prev => {
                if (!prev || prev.length === 0) return prev;
                return prev.map(ex => ({
                    ...ex,
                    sets: (ex.sets || []).map(set => {
                        const newWeights = { ...(set.playerWeights || {}), [user.id]: set.playerWeights?.[user.id] ?? set.weight };
                        const newReps = { ...(set.playerReps || {}), [user.id]: set.playerReps?.[user.id] ?? set.reps };
                        const newCompleted = { ...(set.playerCompleted || {}), [user.id]: set.playerCompleted?.[user.id] ?? set.completed };
                        const newLocked = { ...(set.playerLocked || {}), [user.id]: set.playerLocked?.[user.id] ?? set.locked };
                        return {
                            ...set,
                            playerWeights: newWeights,
                            playerReps: newReps,
                            playerCompleted: newCompleted,
                            playerLocked: newLocked
                        };
                    })
                }));
            });
        }
    }, [location.state, user?.id]);
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [arsenal, setArsenal] = useState<Equipment[]>([]);
    const [routines, setRoutines] = useState<any[]>([]); // NEW: Local Routines
    const [showAddModal, setShowAddModal] = useState(false);
    // Section name (e.g. "PECHO") of the "+" extras panel currently open
    const [extrasSection, setExtrasSection] = useState<string | null>(null);
    const [resolvedGymId, setResolvedGymId] = useState<string | null>(null);
    const [showExitMenu, setShowExitMenu] = useState(false);
    const [showCoopExitModal, setShowCoopExitModal] = useState(false);
    const [showForceExitModal, setShowForceExitModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    // ── PAUSAR SESIÓN COMPLETA (spec §1.2, líneas 45/49) ─────────────────────
    // "...pausar la sesión completa... Pausar y reanudar conserva exactamente
    // los datos y el tiempo transcurrido — no se pierde ni se duplica
    // información al reanudar." Implementado de forma puramente aditiva: NO
    // toca el cronómetro base (startTime, sigue siendo la fuente de verdad
    // para sync multijugador / geo-validación / persistencia); solo resta el
    // tiempo acumulado en pausa al calcular lo que se MUESTRA y congela el
    // display + bloquea el registro de series mientras está pausada.
    const [isSessionPaused, setIsSessionPaused] = useState(false);
    const pausedAtRef = useRef<number | null>(null);
    const accumulatedPauseMsRef = useRef<number>(0);
    const [showSummary, setShowSummary] = useState(false);
    const [summaryTab, setSummaryTab] = useState<'grupal' | 'individual'>('grupal');
    const [exerciseFillFlow, setExerciseFillFlow] = useState<{ exerciseName: string; timestamp: number }[]>([]);
    // DB-fetched summary data for multiplayer: authoritative participant list + per-player set data.
    // Fixes cases where in-memory sync missed a participant or their playerWeights were never received.
    const [coopSummaryData, setCoopSummaryData] = useState<{
        players: { id: string; username: string; avatarUrl: string }[];
        exerciseSets: {
            exerciseId: string;
            exerciseName: string;
            sets: { setNumber: number; playerData: Record<string, { weight: number; reps: number; time: number; distance: number }> }[];
        }[];
    } | null>(null);

    const recordExerciseInteraction = (exerciseName: string) => {
        setExerciseFillFlow(prev => {
            const now = Date.now();
            if (prev.length > 0 && prev[prev.length - 1].exerciseName === exerciseName) {
                return prev.map((item, idx) => idx === prev.length - 1 ? { ...item, timestamp: now } : item);
            }
            return [...prev, { exerciseName, timestamp: now }];
        });
    };
    // NEW: Track Routine Name for AI Diagnosis
    const [currentRoutineName, setCurrentRoutineName] = useState<string | undefined>(undefined);
    const [originalExerciseIds, setOriginalExerciseIds] = useState<string[]>([]); // To detect changes
    const [originalMetricsSnapshot, setOriginalMetricsSnapshot] = useState<string | null>(null); // To detect changes in routine targets
    const [isRoutineModified, setIsRoutineModified] = useState(false); // Tracks if routine structure changed during session

    // [NEW] Multiplayer references to avoid stale closures
    const currentRoutineNameRef = useRef<string | undefined>(currentRoutineName);
    const isRoutineModifiedRef = useRef<boolean>(isRoutineModified);

    useEffect(() => {
        currentRoutineNameRef.current = currentRoutineName;
    }, [currentRoutineName]);

    useEffect(() => {
        isRoutineModifiedRef.current = isRoutineModified;
    }, [isRoutineModified]);

    // --- Multiplayer Sync Hooks ---
    // Accumulates every participant who ever joined the room — never removes entries.
    // Used by the summary so we can show all players' data even after some have left.
    const allTimeParticipantsRef = useRef<any[]>([]);
    // Tracks participants who have FINISHED and left. Their playerWeights/Reps/etc.
    // data is frozen in the CRDT merge — no incoming sync can overwrite their final values.
    // IMPORTANT: BOTH the ref and the state are needed:
    //   • ref  → used in non-render code (mergeMap, addSet) where state is stale
    //   • state → triggers a re-render so the UI immediately shows "-" cells on finalization
    const finalizedParticipantsRef = useRef<Set<string>>(new Set());
    const [finalizedParticipantsState, setFinalizedParticipantsState] = useState<Set<string>>(new Set());
    // Tracks participants who hit "Cancelar Entrenamiento". Their data is
    // stripped from shared state and they no longer count toward "soy el
    // último en finalizar" (Phase 5 — historial isolation on cancel).
    const cancelledParticipantsRef = useRef<Set<string>>(new Set());
    // Guards against double-processing the `room_all_finished` broadcast
    // (Phase 5 — delayed historial visibility).
    const roomFullyFinishedRef = useRef<boolean>(false);
    const [partnerName, setPartnerName] = useState<string>('Compañero');
    const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [firstGuestId, setFirstGuestId] = useState<string | null>(null);
    const participantsRef = useRef<any[]>([]);
    useEffect(() => {
        participantsRef.current = participants;
        // Accumulate all-time participants (never remove — needed for summary display)
        participants.forEach(p => {
            if (p.id && !allTimeParticipantsRef.current.some(x => x.id === p.id)) {
                allTimeParticipantsRef.current.push({ ...p });
            } else if (p.id) {
                // Keep username/avatar up to date
                const idx = allTimeParticipantsRef.current.findIndex(x => x.id === p.id);
                if (idx >= 0) allTimeParticipantsRef.current[idx] = { ...allTimeParticipantsRef.current[idx], ...p };
            }
        });
    }, [participants]);

    const firstGuestIdRef = useRef<string | null>(null);
    useEffect(() => { firstGuestIdRef.current = firstGuestId; }, [firstGuestId]);

    // Track users who have deliberately temp-exited so their metric inputs get locked for others
    const [tempExitedUsers, setTempExitedUsers] = useState<Set<string>>(new Set());
    const tempExitedUsersRef = useRef<Set<string>>(new Set());
    useEffect(() => { tempExitedUsersRef.current = tempExitedUsers; }, [tempExitedUsers]);

    // Unify firstGuestId deterministically across all devices (Guest 1 is the first participant who is not the Host)
    useEffect(() => {
        const hostId = isInviter ? user?.id : partnerId;
        const fgId = participants.find(p => p.id !== hostId)?.id || partnerId || null;
        if (fgId !== firstGuestId) {
            console.log('🎯 Updating firstGuestId deterministically to:', fgId);
            setFirstGuestId(fgId);
        }
    }, [participants, isInviter, user?.id, partnerId, firstGuestId]);

    useEffect(() => {
        if (!isMultiplayer || multiplayerMode !== 'conjunto' || !user) {
            setParticipants([
                {
                    id: user?.id || 'single-user',
                    username: user?.user_metadata?.username || user?.user_metadata?.full_name || 'Yo',
                    avatarUrl: user?.user_metadata?.avatar_url || ''
                }
            ]);
        } else if (partnerId) {
            const myName = user.user_metadata?.username || user.user_metadata?.full_name || 'Yo';
            const myAvatar = user.user_metadata?.avatar_url || '';
            const pName = partnerName || 'Compañero';
            const pAvatar = partnerAvatar || '';

            const list = [
                { id: user.id, username: myName, avatarUrl: myAvatar, isOnline: true },
                { id: partnerId, username: pName, avatarUrl: pAvatar, isOnline: true }
            ];

            const ordered = isInviter
                ? [list[0], list[1]]
                : [list[1], list[0]];

            setParticipants(prev => {
                // Once the room already has 2+ participants (e.g. presence sync
                // already populated [host, guest1]), DO NOT overwrite the array —
                // that would happen every time the host accepts ANOTHER guest
                // (partnerId gets reassigned to the newest joiner's id), wiping
                // out previously-joined guests and corrupting firstGuestId/CRDT
                // mapping. Instead, just make sure the (possibly new) partner is
                // present — append them if missing, otherwise leave as-is.
                if (prev.length >= 2) {
                    if (prev.some(p => p.id === partnerId)) return prev;
                    const newcomer = isInviter ? list[1] : list[0];
                    return [...prev, newcomer];
                }
                return ordered.length > 0 ? ordered : prev;
            });
        }
    }, [isMultiplayer, multiplayerMode, user, partnerId, partnerName, partnerAvatar, isInviter]);

     const [partnerExercises, setPartnerExercises] = useState<WorkoutExercise[]>([]);
    const [viewingMode, setViewingMode] = useState<'mine' | 'partner'>('mine');
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const isInviterRef = useRef<boolean>(true); // tracks isInviter without stale closure
    const lastIncomingState = useRef<string>('');
    const isStartingSessionRef = useRef<boolean>(false);
    // Geo-validación CONTINUA (spec §3): true si en algún momento de la sesión
    // el GPS detectó que el usuario salió del radio de su gym. Una vez en true,
    // el GX/racha de entrenamiento de hoy NO se otorgan, sin importar que el
    // chequeo final al cerrar la sesión vuelva a pasar.
    const geoLeftRadiusRef = useRef<boolean>(false);
    const isAddingExercisesRef = useRef<boolean>(false); // guard against concurrent handleBatchAdd calls
    // True while a guest is waiting for the host's first sync_state broadcast.
    // Keeps `loading` pinned to true so the empty state never flashes before exercises arrive.
    const waitingForGuestSyncRef = useRef<boolean>(false);
    const guestSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // True while this user has already finalized their session but is still waiting for
    // remaining room participants to finish before the summary screen is shown.
    // waitingForPartners removed: users go directly to summary on finalize
    const partnerSessionIdRef = useRef<string | null>(partnerSessionId);
    useEffect(() => {
        partnerSessionIdRef.current = partnerSessionId;
    }, [partnerSessionId]);
    const sessionIdRef = useRef<string | null>(null);
    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);
    // Cleanup empty sessions upon unmounting the page
    // If the user leaves the page and has no exercises (e.g. clicked back, closed, went to another tab)
    // we delete the session from the DB to prevent stale session deadlocks!
    useEffect(() => {
        return () => {
            const sessId = sessionIdRef.current;
            const exercisesCount = activeExercisesRef.current.length;
            // Never delete a guest's session on unmount: guests start with 0 exercises and
            // wait for sync_state from the host. Deleting here would break the room.
            const isGuest = isMultiplayerRef.current && !isInviterRef.current;
            if (sessId && exercisesCount === 0 && !isGuest) {
                console.log("🧹 Unmount: Deleting empty/unstarted workout session:", sessId);
                supabase.from('workout_sessions').delete().eq('id', sessId).then(() => {
                    localStorage.removeItem(`workout_draft_${sessId}`);
                });
            }
        };
    }, []);

    // Lock the room ID for guests on mount to prevent dynamic channel-hopping when receiving other players' session IDs
    const [initialGuestRoomId] = useState(() => !isInviter ? (navState.partnerSessionId || cachedCoop.partnerSessionId || navState.chatId || cachedCoop.chatId) : null);
    const [syncRoomId, setSyncRoomId] = useState<string | null>(() => {
        return isInviter ? sessionId : (initialGuestRoomId || partnerSessionId || chatId);
    });

    useEffect(() => {
        if (isInviter && sessionId) {
            setSyncRoomId(sessionId);
        }
    }, [isInviter, sessionId]);

    const [joinTimestamp] = useState<number>(() => {
        const room = isInviter ? sessionId : (initialGuestRoomId || partnerSessionId || chatId);
        const key = `ginx_join_time_${room || 'default'}`;
        const cached = localStorage.getItem(key);
        if (cached) return parseInt(cached, 10);
        const now = Date.now();
        localStorage.setItem(key, now.toString());
        return now;
    });

    useEffect(() => {
        if (!isMultiplayer || !partnerId || !syncRoomId || !user || showSummary) return;

        // Fetch partner info
        const fetchPartner = async () => {
            const { data } = await supabase.from('profiles').select('username, avatar_url').eq('id', partnerId).single();
            if (data?.username) setPartnerName(data.username);
            if (data?.avatar_url) setPartnerAvatar(data.avatar_url);
        };
        fetchPartner();

        const chId = `coop-workout-${syncRoomId}`;
        const channel = supabase.channel(chId, {
            config: {
                presence: {
                    key: user.id
                }
            }
        });
        channelRef.current = channel;

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const list = Object.values(state)
                    .flat()
                    .map((p: any) => ({
                        id: p.user_id,
                        username: p.username,
                        avatarUrl: p.avatar_url,
                        joined_at: p.joined_at ? Number(p.joined_at) : undefined,
                        isOnline: true
                    }));
                
                setParticipants(prev => {
                    const uniqueList: any[] = [...prev.map(p => ({ ...p, isOnline: false }))]; 
                    
                    // Update with online users or push new ones
                    list.forEach((p: any) => {
                        if (p.id) {
                            const existingIdx = uniqueList.findIndex(x => x.id === p.id);
                            if (existingIdx >= 0) {
                                // Preserve local joined_at if incoming is missing
                                const existingTime = uniqueList[existingIdx].joined_at;
                                uniqueList[existingIdx] = {
                                    ...p,
                                    joined_at: p.joined_at !== undefined ? p.joined_at : existingTime
                                };
                            } else {
                                uniqueList.push(p);
                            }
                        }
                    });

                    // Ensure current user
                    if (!uniqueList.some(p => p.id === user.id)) {
                        uniqueList.push({
                            id: user.id,
                            username: user.user_metadata?.username || user.user_metadata?.full_name || 'Yo',
                            avatarUrl: user.user_metadata?.avatar_url || '',
                            joined_at: joinTimestamp,
                            isOnline: true
                        });
                    } else {
                        // Ensure current user's local timestamp is set
                        const myIdx = uniqueList.findIndex(p => p.id === user.id);
                        if (myIdx >= 0 && uniqueList[myIdx].joined_at === undefined) {
                            uniqueList[myIdx].joined_at = joinTimestamp;
                        }
                    }

                    // Ensure partner fallback — keep finalized partners visible as locked rows.
                    if (partnerId && !uniqueList.some(p => p.id === partnerId)) {
                        uniqueList.push({
                            id: partnerId,
                            username: partnerName !== 'Compañero' ? partnerName : 'Compañero',
                            avatarUrl: partnerAvatar || '',
                            joined_at: isInviter ? undefined : 0, // Make host 0 to sort first
                            isOnline: false
                        });
                    }

                    // Deterministic ordering: Host first, then other guests sorted chronologically by stable arrival timestamp (joined_at)
                    const hostId = isInviter ? user.id : partnerId;

                    const orderedList: any[] = [];
                    const addedIds = new Set<string>();

                    const hostItem = uniqueList.find(p => p.id === hostId);
                    if (hostItem) {
                        orderedList.push(hostItem);
                        addedIds.add(hostId);
                    }

                    // Assign a stable chronological fallback if joined_at is undefined, using local discovery time
                    const now = Date.now();
                    uniqueList.forEach(p => {
                        if (p.id !== hostId && p.joined_at === undefined) {
                            const prevItem = prev.find(x => x.id === p.id);
                            p.joined_at = prevItem?.joined_at ?? now;
                        }
                    });

                    // Sort other guests chronologically by their stable arrival time (joined_at)
                    const sortedGuests = uniqueList
                        .filter(p => p.id && !addedIds.has(p.id))
                        .sort((a, b) => {
                            const aTime = a.joined_at !== undefined ? Number(a.joined_at) : 9999999999999;
                            const bTime = b.joined_at !== undefined ? Number(b.joined_at) : 9999999999999;
                            if (aTime !== bTime) {
                                return aTime - bTime;
                            }
                            return a.id.localeCompare(b.id);
                        });

                    sortedGuests.forEach(p => {
                        orderedList.push(p);
                        addedIds.add(p.id);
                    });

                    return orderedList.slice(0, 8); // Limit to maximum 8 players!
                });
            })
            .on('presence', { event: 'join' }, ({ newPresences }) => {
                // Unlock inputs for any user who rejoins after a temp-exit
                if (newPresences && newPresences.length > 0) {
                    newPresences.forEach((p: any) => {
                        const joinedId = p.user_id || p.id;
                        if (joinedId && tempExitedUsersRef.current.has(joinedId)) {
                            setTempExitedUsers(prev => {
                                const next = new Set(prev);
                                next.delete(joinedId);
                                return next;
                            });
                        }
                    });
                }
                if (newPresences && newPresences.length > 0 && activeExercisesRef.current.length > 0) {
                    console.log('👥 New user joined presence. Hydrating them with active exercises...');
                    channel.send({
                        type: 'broadcast',
                        event: 'sync_state',
                        payload: { 
                            exercises: activeExercisesRef.current, 
                            sender: user.id,
                            knownParticipants: participantsRef.current
                        }
                    }).catch(e => console.error(e));
                    
                    if (sessionIdRef.current) {
                        channel.send({
                            type: 'broadcast',
                            event: 'sync_session_id',
                            payload: { 
                                sessionId: sessionIdRef.current, 
                                startTime: startTimeRef.current?.toISOString(), 
                                sender: user.id 
                            }
                        }).catch(e => console.error(e));
                    }
                }
            })
            .on('broadcast', { event: 'sync_state' }, (payload) => {
                const { exercises, sender, knownParticipants, routineName, isRoutineModified: incomingRoutineModified, finalizedParticipants: incomingFinalized, cancelledParticipants: incomingCancelled } = payload.payload;
                if (sender === user.id) return; // Ignore echoes

                // Absorb finalized-participant list from every incoming sync_state.
                // This is the primary redundant signal: even if participant_left was lost,
                // the next sync_state carrying finalizedParticipants will lock the cells.
                if (incomingFinalized && Array.isArray(incomingFinalized) && incomingFinalized.length > 0) {
                    let hasNew = false;
                    (incomingFinalized as string[]).forEach((id) => {
                        if (id !== user.id && !finalizedParticipantsRef.current.has(id)) {
                            finalizedParticipantsRef.current.add(id);
                            hasNew = true;
                        }
                    });
                    if (hasNew) {
                        setFinalizedParticipantsState(new Set([...finalizedParticipantsRef.current]));
                    }
                }

                // Same redundant-signal pattern for cancelled participants — covers the
                // case where the dedicated participant_cancelled broadcast was missed.
                if (incomingCancelled && Array.isArray(incomingCancelled) && incomingCancelled.length > 0) {
                    (incomingCancelled as string[]).forEach((id) => {
                        if (id !== user.id && !cancelledParticipantsRef.current.has(id)) {
                            cancelledParticipantsRef.current.add(id);
                            setParticipants(prev => prev.filter(p => p.id !== id));
                        }
                    });
                }

                if (routineName !== undefined && routineName !== null) {
                    console.log('🔄 Synchronized routine name via broadcast:', routineName);
                    setCurrentRoutineName(routineName);
                }

                if (incomingRoutineModified !== undefined && incomingRoutineModified !== null) {
                    console.log('🔄 Synchronized isRoutineModified via broadcast:', incomingRoutineModified);
                    setIsRoutineModified(incomingRoutineModified);
                }

                if (knownParticipants && Array.isArray(knownParticipants)) {
                    setParticipants(prev => {
                        if (!isInviter) {
                            // Guests exactly mirror the Host's sorted participant list to stay aligned on the exact same row slots!
                            return knownParticipants.map(kp => {
                                const local = prev.find(p => p.id === kp.id);
                                return {
                                    ...kp,
                                    isOnline: local ? local.isOnline : (kp.isOnline ?? false)
                                };
                            });
                        } else {
                            // Host dynamically discovers and appends new guests
                            let updated = false;
                            const next = [...prev];
                            for (const kp of knownParticipants) {
                                if (!next.find(p => p.id === kp.id)) {
                                    console.log('🎉 [Dynamic Discovery] Nuevo jugador detectado en la sala:', kp.username);
                                    next.push(kp);
                                    updated = true;
                                }
                            }
                            return updated ? next : prev;
                        }
                    });
                }

                if (exercises && exercises.length > 0) {
                    const incomingStr = JSON.stringify(exercises);
                    lastIncomingState.current = incomingStr;

                    // Filter out exercises deleted locally — prevent sync from re-adding them
                    const safeExercises = deletedExerciseIdsRef.current.size > 0
                        ? exercises.filter((ex: any) => !deletedExerciseIdsRef.current.has(ex.id))
                        : exercises;

                    // If we were waiting for the first host→guest sync, release loading now.
                    if (waitingForGuestSyncRef.current) {
                        waitingForGuestSyncRef.current = false;
                        setLoading(false);
                    }

                    if (multiplayerMode === 'conjunto') {
                        setActiveExercises(prev => {
                            if (!prev || prev.length === 0) return safeExercises;

                            // ID-based merge: match exercises by their stable ID, not by array index.
                            // Index-based matching corrupts data when users add exercises in different orders.
                            const mergedExercises = safeExercises.map((inEx: any) => {
                                // Match by exercise UI id first, then by equipmentId as fallback
                                const localEx = prev.find(e => e.id === inEx.id) ||
                                                prev.find(e => e.equipmentId === inEx.equipmentId);
                                if (!localEx) return inEx;

                                // Filter out sets that were explicitly deleted locally —
                                // prevents CRDT merge from re-adding them when a stale
                                // sync_state arrives before (or races with) remove_set.
                                const filteredLocalSets = localEx.sets.filter((s: any) =>
                                    !deletedSetIdsRef.current.has(s.id)
                                );
                                const filteredInSets = inEx.sets.filter((s: any) =>
                                    !deletedSetIdsRef.current.has(s.id)
                                );

                                const maxSets = Math.max(filteredLocalSets.length, filteredInSets.length);
                                const mergedSets = [];

                                for (let sIdx = 0; sIdx < maxSets; sIdx++) {
                                    const inSet = filteredInSets[sIdx];
                                    const loc = filteredLocalSets[sIdx];
                                    
                                    if (!loc) {
                                        mergedSets.push(inSet);
                                        continue;
                                    }
                                    if (!inSet) {
                                        mergedSets.push(loc);
                                        continue;
                                    }

                                    const locTime = loc.lastUpdatedAt || 0;
                                     const inTime = inSet.lastUpdatedAt || 0;

                                     // Deterministic LWW resolver shared by every timestamp comparison below.
                                     // A strictly-newer timestamp always wins (normal case). The bug this fixes:
                                     // on a genuine TIE (both devices stamped the same millisecond — quite
                                     // possible with concurrent edits, e.g. both partners tap "complete" at once),
                                     // the old code (`locTime >= inTime`) made BOTH sides resolve to "local wins",
                                     // so each device kept ITS OWN value forever — a permanent disagreement
                                     // ("split-brain") that looks exactly like "a veces no sincroniza". Here we
                                     // break ties with a stable, symmetric rule (smaller user id wins) so every
                                     // participant's device computes the SAME winner and converges.
                                     // `zeroTieFavorsLocal` preserves the original per-call-site behavior for the
                                     // legacy edge case where neither side ever stamped a timestamp (old sessions).
                                     const resolveLww = (lT: number, iT: number, zeroTieFavorsLocal: boolean) => {
                                         if (lT !== iT) return lT > iT;
                                         if (lT === 0) return zeroTieFavorsLocal;
                                         return user.id < sender;
                                     };

                                     const useLoc = resolveLww(locTime, inTime, false);

                                     const lastUpd = { ...(loc.playerLastUpdated || {}) };
                                     for (const pid of Object.keys(inSet.playerLastUpdated || {})) {
                                         const locT = loc.playerLastUpdated?.[pid] || 0;
                                         const inT = inSet.playerLastUpdated?.[pid] || 0;
                                         lastUpd[pid] = Math.max(locT, inT);
                                     }

                                     const mergeMap = (locMap: Record<string, any> = {}, inMap: Record<string, any> = {}) => {
                                         const res = { ...locMap };
                                         for (const key of Object.keys(inMap || {})) {
                                             // Never overwrite a finalized participant's data with incoming sync values.
                                             // Their values were locked when they called finishSession and left the room.
                                             if (finalizedParticipantsRef.current.has(key)) continue;
                                             // A participant who hit "Cancelar Entrenamiento" is fully removed —
                                             // never re-merge their data even if a stale sync_state arrives late.
                                             if (cancelledParticipantsRef.current.has(key)) continue;
                                             const inVal = inMap[key];
                                             const locVal = locMap[key];

                                             const hasLoc = locVal !== undefined;
                                             const hasIn = inVal !== undefined;

                                             if (hasLoc && hasIn) {
                                                 const locPTime = loc.playerLastUpdated?.[key] || 0;
                                                 const inPTime = inSet.playerLastUpdated?.[key] || 0;
                                                 res[key] = resolveLww(locPTime, inPTime, true) ? locVal : inVal;
                                             } else if (hasIn) {
                                                 res[key] = inVal;
                                             }
                                         }
                                         return res;
                                     };

                                     const w = mergeMap(loc.playerWeights, inSet.playerWeights);
                                     const r = mergeMap(loc.playerReps, inSet.playerReps);
                                     const t = mergeMap(loc.playerTimes, inSet.playerTimes);
                                     const d = mergeMap(loc.playerDistances, inSet.playerDistances);
                                     const rpe = mergeMap(loc.playerRpes, inSet.playerRpes);
                                     const comp = mergeMap(loc.playerCompleted, inSet.playerCompleted);
                                     const lock = mergeMap(loc.playerLocked, inSet.playerLocked);
                                     const compAt = mergeMap(loc.playerCompletedAt, inSet.playerCompletedAt);

                                     const rStatus = mergeMap(loc.playerRestStatus, inSet.playerRestStatus);
                                     const rAcc = mergeMap(loc.playerRestAccumulated, inSet.playerRestAccumulated);
                                     const rLst = mergeMap(loc.playerRestLastStartTime, inSet.playerRestLastStartTime);

                                     // Sync legacy properties to their dictionary counterparts for Host & First Guest.
                                     // Use refs (not state) to avoid stale closures in the channel effect.
                                     const hostId = isInviter ? user?.id : partnerId;
                                     const fgId = firstGuestIdRef.current;

                                     const hostWeight = hostId && w[hostId] !== undefined ? w[hostId] : (useLoc ? loc.weight : inSet.weight);
                                     const hostReps = hostId && r[hostId] !== undefined ? r[hostId] : (useLoc ? loc.reps : inSet.reps);
                                     const hostCompleted = hostId && comp[hostId] !== undefined ? comp[hostId] : (useLoc ? loc.completed : inSet.completed);
                                     const hostLocked = hostId && lock[hostId] !== undefined ? lock[hostId] : (useLoc ? loc.locked : inSet.locked);
                                     const hostCompletedAt = hostId && compAt[hostId] !== undefined ? compAt[hostId] : (useLoc ? loc.completedAt : inSet.completedAt);
                                     const hostRestStatus = hostId && rStatus[hostId] !== undefined ? rStatus[hostId] : (useLoc ? loc.restStatus : inSet.restStatus);
                                     const hostRestAccumulated = hostId && rAcc[hostId] !== undefined ? rAcc[hostId] : (useLoc ? loc.restAccumulated : inSet.restAccumulated);
                                     const hostRestLastStartTime = hostId && rLst[hostId] !== undefined ? rLst[hostId] : (useLoc ? loc.restLastStartTime : inSet.restLastStartTime);

                                     const p2Weight = fgId && w[fgId] !== undefined ? w[fgId] : (useLoc ? loc.p2_weight : inSet.p2_weight);
                                     const p2Reps = fgId && r[fgId] !== undefined ? r[fgId] : (useLoc ? loc.p2_reps : inSet.p2_reps);
                                     const p2Completed = fgId && comp[fgId] !== undefined ? comp[fgId] : (useLoc ? loc.p2_completed : inSet.p2_completed);
                                     const p2Locked = fgId && lock[fgId] !== undefined ? lock[fgId] : (useLoc ? loc.p2_locked : inSet.p2_locked);
                                     const p2CompletedAt = fgId && compAt[fgId] !== undefined ? compAt[fgId] : (useLoc ? loc.p2_completedAt : inSet.p2_completedAt);
                                     const p2RestStatus = fgId && rStatus[fgId] !== undefined ? rStatus[fgId] : (useLoc ? loc.p2_restStatus : inSet.p2_restStatus);
                                     const p2RestAccumulated = fgId && rAcc[fgId] !== undefined ? rAcc[fgId] : (useLoc ? loc.p2_restAccumulated : inSet.p2_restAccumulated);
                                     const p2RestLastStartTime = fgId && rLst[fgId] !== undefined ? rLst[fgId] : (useLoc ? loc.p2_restLastStartTime : inSet.p2_restLastStartTime);

                                     mergedSets.push({
                                         ...inSet,
                                         lastUpdatedAt: useLoc ? locTime : inTime,
                                         playerLastUpdated: lastUpd,
                                         playerWeights: w,
                                         playerReps: r,
                                         playerTimes: t,
                                         playerDistances: d,
                                         playerRpes: rpe,
                                         playerCompleted: comp,
                                         playerLocked: lock,
                                         playerCompletedAt: compAt,
                                         playerRestStatus: rStatus,
                                         playerRestAccumulated: rAcc,
                                         playerRestLastStartTime: rLst,

                                         weight: hostWeight,
                                         reps: hostReps,
                                         completed: hostCompleted,
                                         locked: hostLocked,
                                         completedAt: hostCompletedAt,
                                         restStatus: hostRestStatus,
                                         restAccumulated: hostRestAccumulated,
                                         restLastStartTime: hostRestLastStartTime,

                                         p2_weight: p2Weight,
                                         p2_reps: p2Reps,
                                         p2_completed: p2Completed,
                                         p2_locked: p2Locked,
                                         p2_completedAt: p2CompletedAt,
                                         p2_restStatus: p2RestStatus,
                                         p2_restAccumulated: p2RestAccumulated,
                                         p2_restLastStartTime: p2RestLastStartTime
                                     });
                                }
                                
                                return {
                                    ...inEx,
                                    // Preserve the local user's unit preference.
                                    // The partner's weightUnit must not overwrite it —
                                    // each user independently chooses kg or lb.
                                    weightUnit: localEx.weightUnit || inEx.weightUnit,
                                    sets: mergedSets
                                };
                            });

                            // Preserve local-only exercises (added after the sender's last broadcast).
                            // Without this, exercises added locally would disappear on next incoming sync.
                            const incomingIds = new Set(safeExercises.map((e: any) => e.id));
                            const localOnly = prev.filter(e =>
                                !incomingIds.has(e.id) &&
                                !deletedExerciseIdsRef.current.has(e.id)
                            );

                            return [...mergedExercises, ...localOnly];
                        });
                    } else if (multiplayerMode === 'separado') {
                        setPartnerExercises(safeExercises);
                    }
                }
            })
            .on('broadcast', { event: 'remove_exercise' }, (payload) => {
                const { exerciseId, sender } = payload.payload;
                if (sender === user.id) return;
                deletedExerciseIdsRef.current.add(exerciseId);
                setActiveExercises(prev => prev.filter(e => e.id !== exerciseId));
                setIsRoutineModified(true);
            })
            .on('broadcast', { event: 'remove_set' }, (payload) => {
                const { exerciseId, setId, sender } = payload.payload;
                if (sender === user.id) return; // Ignore echoes
                // Track locally so CRDT merge cannot re-add this set from a stale sync_state
                deletedSetIdsRef.current.add(setId);
                setActiveExercises(prev => prev.map(ex => {
                    if (ex.id !== exerciseId) return ex;
                    return { ...ex, sets: ex.sets.filter((s: any) => s.id !== setId) };
                }));
            })
            .on('broadcast', { event: 'request_hydration' }, (payload) => {
                const { sender } = payload.payload;
                if (sender === user.id) return; // Ignore echoes

                if (activeExercisesRef.current && activeExercisesRef.current.length > 0) {
                    console.log('🔄 Host/Partner received hydration request. Broadcasting active exercises...', activeExercisesRef.current);
                    channelRef.current?.send({
                        type: 'broadcast',
                        event: 'sync_state',
                        payload: { 
                            exercises: activeExercisesRef.current, 
                            sender: user.id,
                            knownParticipants: participantsRef.current,
                            routineName: currentRoutineNameRef.current,
                            isRoutineModified: isRoutineModifiedRef.current
                        }
                    }).catch(e => console.error('Error broadcasting hydration state:', e));
                }
                
                // Also broadcast the session ID and startTime to sync the timer!
                const currentSessionId = sessionIdRef.current;
                const currentStartTime = startTimeRef.current;
                if (currentSessionId) {
                    console.log('🔄 Broadcasting session ID and start time for hydration...', currentSessionId);
                    channelRef.current?.send({
                        type: 'broadcast',
                        event: 'sync_session_id',
                        payload: { 
                            sessionId: currentSessionId, 
                            startTime: currentStartTime?.toISOString(), 
                            sender: user.id 
                        }
                    }).catch(e => console.error('Error broadcasting session sync for hydration:', e));
                }
            })
            .on('broadcast', { event: 'session_terminated' }, async (payload) => {
                const { sender } = payload.payload;
                if (sender === user.id) return; // Ignore echoes
                
                console.warn('⚠️ [Destruction Protocol] Received session_terminated signal from host');
                import('react-hot-toast').then(({ default: t }) => t.error("Misión abortada por el anfitrión."));
                
                // Clear local cache immediately
                localStorage.removeItem(`workout_draft_${sessionIdRef.current}`);
                localStorage.removeItem('workout_session_state');
                localStorage.removeItem('ginx_coop_state');
                
                // Delete the orphaned linked session from the database
                if (sessionIdRef.current) {
                    await workoutService.deleteSession(sessionIdRef.current);
                }
                
                isLeavingPageRef.current = true;
                // Eject user
                navigate('/');
            })
            .on('broadcast', { event: 'host_cancelled_continue_solo' }, async (payload) => {
                const { sender } = payload.payload;
                if (sender === user.id) return; // Ignore echoes

                // spec §1.3-B/F: si el host CANCELA (no finaliza), el grupo "continúa sin
                // interrupciones ni pérdida de datos". La reasignación completa de host es
                // un cambio de arquitectura mayor (requiere migrar el canal/sala en vivo);
                // como aproximación segura y fiel al espíritu del requisito, cada participante
                // restante conserva TODOS sus datos y su sesión sigue activa, convertida a
                // modo individual — nadie es expulsado ni pierde su progreso.
                console.warn('⚠️ [Host Cancelled] El host canceló su entrenamiento — continuamos en modo individual sin perder datos.');
                import('react-hot-toast').then(({ default: t }) => t.success('El anfitrión canceló su sesión. Tu progreso se mantiene — continúas de forma individual.', { duration: 6000 }));

                try {
                    if (sessionIdRef.current) {
                        await supabase
                            .from('workout_sessions')
                            .update({
                                is_multiplayer: false,
                                multiplayer_mode: null,
                                partner_id: null,
                                partner_session_id: null
                            })
                            .eq('id', sessionIdRef.current);
                    }
                } catch (e) {
                    console.error('Error converting orphaned coop session to individual mode:', e);
                }

                localStorage.removeItem('ginx_coop_state');
                sessionStorage.removeItem('ginx_temp_exit_active');

                // Drop multiplayer state — the channel effect tears itself down automatically
                // (cleanup runs on [isMultiplayer, partnerId, syncRoomId] change) and the
                // session keeps running locally exactly where it was, with all data intact.
                setIsMultiplayer(false);
                setMultiplayerMode(null);
                setPartnerId(null);
                setChatId(null);
                setSyncRoomId(null);
                setIsInviter(true);
                isInviterRef.current = true;
                setParticipants([]);
            })
            .on('broadcast', { event: 'session_finished' }, async (payload) => {
                const { sender } = payload.payload;
                if (sender === user.id) return; // Ignore own echo (host side)
                // Guard: run once per room close
                if (isLeavingPageRef.current) return;

                console.log('🏁 [Guest] Host closed the room — saving sets now, guest presses Finalizar when ready.');

                // ── Save sets immediately while exercises are in memory ──────────────
                // We save NOW (before the guest presses Finalizar) because closeRoom()
                // already set finished_at on the guest's session in DB — if we wait,
                // there's a risk the user navigates away and data is lost.
                // We do NOT show summary automatically: the guest stays on the workout
                // screen, sees a toast, and presses Finalizar when they're ready.
                // handleFinalizeSession's guest branch already handles already-closed
                // sessions gracefully (returns success even if finished_at is set).
                try {
                    const guestSessionId = sessionIdRef.current;
                    const exercisesToSave = activeExercisesRef.current.length > 0
                        ? activeExercisesRef.current
                        : lastNonEmptyExercisesRef.current;

                    if (guestSessionId && exercisesToSave.length > 0) {
                        const myId = user.id;
                        const savePromises: Promise<any>[] = [];

                        for (const exercise of exercisesToSave) {
                            let resolvedExId: string | null = null;

                            for (let j = 0; j < exercise.sets.length; j++) {
                                const set = exercise.sets[j];
                                const guestIsFirstGuest = myId === firstGuestIdRef.current;
                                const weightToSave    = Number(set.playerWeights?.[myId]   ?? (guestIsFirstGuest ? (set.p2_weight   || 0) : 0)) || 0;
                                const repsToSave      = Number(set.playerReps?.[myId]      ?? (guestIsFirstGuest ? (set.p2_reps     || 0) : 0)) || 0;
                                const timeToSave      = Number(set.playerTimes?.[myId]     ?? (guestIsFirstGuest ? (set.p2_time     || 0) : 0)) || 0;
                                const distanceToSave  = Number(set.playerDistances?.[myId] ?? (guestIsFirstGuest ? (set.p2_distance || 0) : 0)) || 0;
                                const rpeToSave       = Number(set.playerRpes?.[myId]      ?? (guestIsFirstGuest ? (set.p2_rpe      || 0) : 0)) || undefined;
                                const isCompleted     = set.playerCompleted?.[myId]        ?? (guestIsFirstGuest ? (set.p2_completed || false) : false);

                                if (set.db_id) continue;
                                if (!isCompleted && weightToSave === 0 && repsToSave === 0 && timeToSave === 0) continue;

                                if (!resolvedExId) {
                                    resolvedExId = await (async () => {
                                        try {
                                            const { data } = await supabase
                                                .from('exercises').select('id')
                                                .ilike('name', exercise.equipmentName).limit(1).single();
                                            if (data?.id) return data.id;
                                            const { data: created } = await supabase
                                                .from('exercises').insert({ name: exercise.equipmentName })
                                                .select().single();
                                            return created?.id ?? null;
                                        } catch { return null; }
                                    })();
                                }
                                if (!resolvedExId) continue;

                                let restDuration = Number(set.playerRestAccumulated?.[myId]) || 0;
                                const restStatus = set.playerRestStatus?.[myId];
                                const restStart  = set.playerRestLastStartTime?.[myId];
                                if (restStatus === 'running' && restStart) restDuration += Date.now() - restStart;

                                const guestSetPayload = {
                                    session_id: guestSessionId, exercise_id: resolvedExId,
                                    set_number: j + 1, sets: 1,
                                    weight_kg: weightToSave, reps: repsToSave,
                                    time: timeToSave, distance: distanceToSave, rpe: rpeToSave,
                                    metrics_data: {
                                        ...(set.custom || {}),
                                        ...(isCompleted ? { _checklist_timestamp: set.playerCompletedAt?.[myId] || Date.now() } : {}),
                                        ...(exercise.weightUnit === 'lb' ? { _weight_unit: 'lb' } : {}),
                                        _rest_duration_ms: restDuration,
                                        _rest_status: restStatus === 'running' ? 'completed' : restStatus
                                    } as any,
                                    category_snapshot: exercise.category || 'Custom',
                                    is_pr: false, owner_id: myId
                                };

                                savePromises.push(
                                    workoutService.logSet(guestSetPayload)
                                        .then(res => {
                                            if (res.error && !res.data) {
                                                workoutService.queuePendingSet(guestSessionId, guestSetPayload);
                                            }
                                        })
                                        .catch(() => workoutService.queuePendingSet(guestSessionId, guestSetPayload))
                                );
                            }
                        }
                        if (savePromises.length > 0) {
                            await Promise.all(savePromises);
                            const guestUserId = user?.id;
                            if (guestSessionId && guestUserId) {
                                await detectAndMarkPRs(guestSessionId, guestUserId);
                            }
                        }
                    }
                } catch (err) {
                    console.error('❌ [Guest session_finished] Error pre-saving sets:', err);
                }

                // ── Notify guest — they press Finalizar when ready ───────────────────
                // Sets are already saved above. handleFinalizeSession handles the
                // already-closed session gracefully and shows the summary.
                import('react-hot-toast').then(({ default: t }) =>
                    t.custom((tt) => (
                        <div className={`${tt.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-neutral-950/95 backdrop-blur-2xl border border-yellow-500/40 rounded-2xl p-4 flex items-center gap-3`}>
                            <span className="text-2xl">🏁</span>
                            <div className="flex-1">
                                <p className="text-sm font-black text-white uppercase tracking-wide">El host finalizó la sala</p>
                                <p className="text-[11px] text-neutral-400 mt-0.5">Tus series están guardadas. Presiona <strong className="text-yellow-500">Finalizar</strong> para ver tu resumen.</p>
                            </div>
                        </div>
                    ), { duration: 12000 })
                );
            })
            .on('broadcast', { event: 'participant_left' }, (payload) => {
                const { sender } = payload.payload;
                if (sender === user.id) return;
                // Find participant name for the toast
                const leavingParticipant = participantsRef.current.find(p => p.id === sender);
                const leavingName = leavingParticipant?.username || 'Un participante';
                import('react-hot-toast').then(({ default: t }) => t(`${leavingName} finalizó su entrenamiento.`, { icon: '🏁' }));
                // Mark this participant as finalized so:
                // • CRDT merge never overwrites their data
                // • rowLocked becomes true for all their rows in the UI
                // • addSet skips them → new sets show "-" for their column
                finalizedParticipantsRef.current.add(sender);
                // Sync to state so React re-renders immediately and the UI switches
                // User 1's cells to "-" divs (ref mutation alone does not trigger renders).
                setFinalizedParticipantsState(prev => new Set([...prev, sender]));
                // Intentionally do NOT remove from participants: keep them visible
                // as locked/read-only rows so remaining users can see their records.
                // In separado mode, clear stale partner exercises so the spy view doesn't show ghost data
                if (multiplayerMode === 'separado' && sender === partnerId) {
                    setPartnerExercises([]);
                }
                // Stop rest timers for the leaving participant so their timer freezes (BUG-03)
                setActiveExercises(prev => prev.map(ex => ({
                    ...ex,
                    sets: ex.sets.map((s: any) => {
                        let updated = { ...s };
                        // Per-participant map (group mode)
                        if (s.playerRestStatus?.[sender] === 'running') {
                            updated = {
                                ...updated,
                                playerRestStatus: { ...s.playerRestStatus, [sender]: 'completed' },
                                playerRestLastStartTime: { ...(s.playerRestLastStartTime || {}), [sender]: undefined }
                            };
                        }
                        // Legacy p1 (host) fields — only reset if the leaving user IS the host partner
                        if (sender === partnerId && s.restStatus === 'running') {
                            updated = { ...updated, restStatus: 'completed', restLastStartTime: undefined };
                        }
                        // Legacy p2 (first guest) fields — only reset if the leaving user IS the first guest
                        if (sender === firstGuestIdRef.current && s.p2_restStatus === 'running') {
                            updated = { ...updated, p2_restStatus: 'completed', p2_restLastStartTime: undefined };
                        }
                        return updated;
                    })
                })));
            })
            .on('broadcast', { event: 'participant_cancelled' }, (payload) => {
                const { sender } = payload.payload;
                if (sender === user.id) return;

                const cancellingParticipant = participantsRef.current.find(p => p.id === sender);
                const cancellingName = cancellingParticipant?.username || 'Un participante';
                import('react-hot-toast').then(({ default: t }) => t(`${cancellingName} canceló su entrenamiento.`, { icon: '🚫' }));

                // Cancelled participants get ZERO history and are fully removed from
                // the shared room: never re-merge their data, never count them toward
                // "soy el último en finalizar", and hide their column entirely.
                cancelledParticipantsRef.current.add(sender);
                finalizedParticipantsRef.current.delete(sender);
                setFinalizedParticipantsState(prev => {
                    if (!prev.has(sender)) return prev;
                    const next = new Set(prev);
                    next.delete(sender);
                    return next;
                });

                // Removing from `participants` automatically hides their column in the
                // table render loop (which iterates participants.map(...)) and causes
                // firstGuestId to be recomputed without them.
                setParticipants(prev => prev.filter(p => p.id !== sender));

                const PLAYER_MAP_KEYS = [
                    'playerWeights', 'playerReps', 'playerTimes', 'playerDistances', 'playerRpes',
                    'playerCompleted', 'playerLocked', 'playerCompletedAt', 'playerLastUpdated',
                    'playerRestStatus', 'playerRestAccumulated', 'playerRestLastStartTime'
                ];

                setActiveExercises(prev => prev.map(ex => ({
                    ...ex,
                    sets: ex.sets.map((s: any) => {
                        const updated: any = { ...s };
                        for (const mapKey of PLAYER_MAP_KEYS) {
                            if (updated[mapKey] && Object.prototype.hasOwnProperty.call(updated[mapKey], sender)) {
                                const cleanedMap = { ...updated[mapKey] };
                                delete cleanedMap[sender];
                                updated[mapKey] = cleanedMap;
                            }
                        }
                        // Reset legacy p1 (host) fields if the canceller was the host
                        if (sender === partnerId) {
                            updated.weight = 0; updated.reps = 0; updated.time = 0; updated.distance = 0;
                            updated.rpe = undefined; updated.completed = false; updated.locked = false;
                            updated.completedAt = undefined; updated.restStatus = 'idle'; updated.restLastStartTime = undefined;
                        }
                        // Reset legacy p2 (first guest) fields if the canceller was the first guest
                        if (sender === firstGuestIdRef.current) {
                            updated.p2_weight = 0; updated.p2_reps = 0; updated.p2_time = 0; updated.p2_distance = 0;
                            updated.p2_rpe = undefined; updated.p2_completed = false; updated.p2_locked = false;
                            updated.p2_completedAt = undefined; updated.p2_restStatus = 'idle'; updated.p2_restLastStartTime = undefined;
                        }
                        return updated;
                    })
                })));
            })
            .on('broadcast', { event: 'room_all_finished' }, (payload) => {
                const { sender, finishedAt } = payload.payload;
                if (sender === user.id) return;
                if (roomFullyFinishedRef.current) return;
                roomFullyFinishedRef.current = true;

                // The LAST participant in the room finalized — stamp MY OWN session's
                // finished_at/end_time now (RLS-safe self-update) so it appears in
                // "Historial" alongside everyone else's, all at the same moment.
                const mySessionId = sessionIdRef.current;
                if (mySessionId) {
                    workoutService.markSessionFinished(mySessionId, finishedAt).then(() => {
                        // end_time now set → session appears in Historial
                    }).catch((e) => {
                        console.warn('room_all_finished: failed to self-stamp finished_at:', e);
                    });
                }
            })
            .on('broadcast', { event: 'participant_temp_exit' }, (payload) => {
                const { sender } = payload.payload;
                if (sender === user.id) return;
                // Lock this user's metric inputs for everyone else
                setTempExitedUsers(prev => new Set([...prev, sender]));
            })
            .on('broadcast', { event: 'sync_session_id' }, (payload) => {
                const { sessionId: partnerSessionId, startTime: partnerStartTime, sender } = payload.payload;
                if (sender === user.id) return; // Ignore echoes

                if (partnerSessionId) {
                    console.log('🔗 Received partner session ID via broadcast:', partnerSessionId);
                    partnerSessionIdRef.current = partnerSessionId;
                    setPartnerSessionId(partnerSessionId);

                    const currentSessionId = sessionIdRef.current;
                    if (currentSessionId) {
                        // Only guests link their partner_session_id via this broadcast.
                        // The HOST must never have partner_session_id set — it is always null
                        // on the host session (DB invariant). Setting it on the host would
                        // make FriendsPage Case C misidentify the first guest as the new host,
                        // routing join requests to the wrong person.
                        if (!isInviterRef.current) {
                        supabase
                            .from('workout_sessions')
                            .select('partner_session_id')
                            .eq('id', currentSessionId)
                            .maybeSingle()
                            .then(({ data }) => {
                                if (!data?.partner_session_id) {
                                    supabase
                                        .from('workout_sessions')
                                        .update({ partner_session_id: partnerSessionId })
                                        .eq('id', currentSessionId)
                                        .then(({ error }) => {
                                            if (error) console.error('Error linking partner session:', error);
                                            else console.log('✅ Linked partner session successfully!');
                                        });
                                } else {
                                    console.log('ℹ️ partner_session_id already set — skipping overwrite to preserve room topology.');
                                }
                            });
                        }
                    } else if (!isInviterRef.current && !sessionIdRef.current && !isStartingSessionRef.current) {
                        // Guest auto-starts their own session to activate their timer and enable logging
                        console.log('🚀 Guest auto-starting session on partner session ID sync...');
                        startNewSession(undefined, partnerSessionId, true, multiplayerMode || 'conjunto', partnerId || sender).then(() => {
                            if (partnerStartTime) {
                                setStartTime(new Date(partnerStartTime));
                            }
                        });
                    }
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Conectado al canal multijugador');
                    
                    // Track local presence state
                    await channel.track({
                        user_id: user.id,
                        username: user.user_metadata?.username || user.user_metadata?.full_name || 'Yo',
                        avatar_url: user.user_metadata?.avatar_url || '',
                        joined_at: joinTimestamp
                    });

                    // Send initial state immediately
                    channel.send({
                        type: 'broadcast',
                        event: 'sync_state',
                        payload: { 
                            exercises: activeExercises, 
                            sender: user.id,
                            knownParticipants: participantsRef.current,
                            routineName: currentRoutineName,
                            isRoutineModified: isRoutineModified
                        }
                    }).catch(e => console.error(e));

                    // ANY participant requests hydration explicitly upon reconnecting to guarantee no missed events
                    if (isMultiplayer) {
                        console.log('🔄 Requesting hydration from partner to catch up on missed events...');
                        channel.send({
                            type: 'broadcast',
                            event: 'request_hydration',
                            payload: { sender: user.id }
                        }).catch(e => console.error(e));
                    }

                    // Send session ID if we already have it
                    if (sessionId) {
                        channel.send({
                            type: 'broadcast',
                            event: 'sync_session_id',
                            payload: { sessionId: sessionId, sender: user.id }
                        }).catch(e => console.error(e));
                    }
                }
            });

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [isMultiplayer, partnerId, syncRoomId, user, multiplayerMode, showSummary]);

    // ─── Guest discovery polling ──────────────────────────────────────────────
    // When a guest accepts a coop_invite, the host hasn't created their session yet.
    // We poll the DB until the host's session appears, then set syncRoomId to open
    // the correct Realtime channel. Max 40 attempts × 3 s = 2 minutes.
    useEffect(() => {
        if (!isMultiplayer || isInviter || syncRoomId || !partnerId || !user || showSummary) return;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        let attempts = 0;
        const MAX_ATTEMPTS = 40;
        const hostId = partnerId; // capture narrowed string for closure

        const poll = async () => {
            if (cancelled) return;
            if (attempts >= MAX_ATTEMPTS) {
                // Don't fail silently: a guest stuck here would otherwise stare at an
                // endless loading screen with zero feedback ("me llegó la solicitud
                // pero no cargó el coop"). Tell them plainly what's happening — the
                // host simply hasn't started their workout yet — so they know it's
                // not broken and can retry once the host actually begins.
                console.warn('⏱️ [Guest Poll] Timed out waiting for host session after', MAX_ATTEMPTS, 'attempts.');
                import('react-hot-toast').then(({ default: t }) =>
                    t('⏳ Tu compañero aún no inició su entrenamiento. Cuando lo haga, vuelve a intentar unirte desde la invitación.', {
                        duration: 7000,
                        icon: '⏳',
                        style: { background: '#171717', color: '#fff', border: '1px solid rgba(234,179,8,0.3)', fontSize: '11px', fontWeight: 'bold' }
                    })
                );
                return;
            }
            attempts++;
            try {
                const { data } = await workoutService.getActiveSession(hostId);
                if (data && !cancelled) {
                    console.log('🔗 [Guest Poll] Host session found:', data.id);
                    setPartnerSessionId(data.id);
                    setSyncRoomId(data.id);
                    return; // channel effect re-runs when syncRoomId changes
                }
            } catch (_) { /* non-fatal */ }

            // ── TD-02: host ya terminó antes de que el guest se uniera ────────────
            // Cada 4 intentos (~12 s) verificamos si el host tiene una sesión
            // TERMINADA recientemente. Si es así, no tiene sentido seguir esperando
            // — convertimos la sesión del guest a solo (mismo patrón que el handler
            // host_cancelled_continue_solo, ya probado en producción).
            if (attempts % 4 === 0 && !cancelled) {
                try {
                    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
                    const { data: finishedSess } = await supabase
                        .from('workout_sessions')
                        .select('id, finished_at')
                        .eq('user_id', hostId)
                        .not('finished_at', 'is', null)
                        .gt('finished_at', fifteenMinAgo)
                        .order('finished_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (finishedSess && !cancelled) {
                        cancelled = true; // detener el polling antes de tocar estado
                        console.warn('⚠️ [TD-02] El host ya finalizó su sesión — convirtiendo al guest a modo individual.');

                        // Convertir sesión del guest a solo si ya fue creada
                        try {
                            if (sessionIdRef.current) {
                                await supabase
                                    .from('workout_sessions')
                                    .update({
                                        is_multiplayer: false,
                                        multiplayer_mode: null,
                                        partner_id: null,
                                        partner_session_id: null
                                    })
                                    .eq('id', sessionIdRef.current);
                            }
                        } catch (e) {
                            console.error('TD-02: error al convertir sesión a individual:', e);
                        }

                        localStorage.removeItem('ginx_coop_state');
                        sessionStorage.removeItem('ginx_temp_exit_active');
                        setIsMultiplayer(false);
                        setMultiplayerMode(null);
                        setPartnerId(null);
                        setChatId(null);
                        setSyncRoomId(null);
                        setIsInviter(true);
                        isInviterRef.current = true;
                        setParticipants([]);

                        import('react-hot-toast').then(({ default: t }) =>
                            t('⚠️ Tu compañero ya terminó su sesión antes de que pudieras unirte. Continuarás de forma individual.', {
                                duration: 8000,
                                icon: '⚠️',
                                style: { background: '#171717', color: '#fff', border: '1px solid rgba(234,179,8,0.3)', fontSize: '11px', fontWeight: 'bold' }
                            })
                        );
                        return;
                    }
                } catch (_) { /* non-fatal — no bloquear el polling */ }
            }

            if (!cancelled) timer = setTimeout(poll, 3000);
        };

        // Brief delay to let both sides navigate before first DB check
        timer = setTimeout(poll, 1500);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [isMultiplayer, isInviter, syncRoomId, partnerId, user?.id, showSummary]);

    // ─── Guest safety-net polling ─────────────────────────────────────────────
    // If the Realtime channel was never connected (polling timed out, network
    // blip) the guest never receives session_finished and is left staring at a
    // blank workout screen. Every 20 s we verify the room is still open in DB.
    // When it's not — the host finished without us knowing — we trigger the same
    // cleanup + summary flow that session_finished would have triggered.
    useEffect(() => {
        if (!isMultiplayer || isInviter || !syncRoomId || !user || showSummary) return;

        let cancelled = false;
        const checkRoom = async () => {
            if (cancelled || isLeavingPageRef.current || showSummary) return;
            try {
                const open = await workoutService.isRoomOpen(syncRoomId);
                if (!open && !isLeavingPageRef.current) {
                    console.warn('⚠️ [Guest Poll] Room closed — host finished. Notifying guest to press Finalizar.');
                    // Do NOT force showSummary here — guest may still be logging sets.
                    // A persistent toast prompts them; handleFinalizeSession handles
                    // already-closed sessions gracefully (returns success).
                    import('react-hot-toast').then(({ default: t }) =>
                        t('🏁 El host finalizó la sala. Presiona Finalizar para ver tu resumen.', {
                            duration: 15000,
                            style: {
                                background: '#0a0a0a',
                                color: '#fff',
                                border: '1px solid rgba(234,179,8,0.4)',
                                borderRadius: '16px',
                            },
                            icon: '⚠️'
                        })
                    );
                }
            } catch { /* non-fatal */ }
        };

        // First check after 20 s (give the broadcast channel time to deliver the event first)
        const interval = setInterval(checkRoom, 20000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [isMultiplayer, isInviter, syncRoomId, user?.id, showSummary]);

    // Send local updates (Debounced to prevent network spam and echo loops while typing)
    useEffect(() => {
        // Skip when session is finishing or summary is showing — the channel may be torn
        // down at any moment and a pending 500ms timer could fire after it's gone.
        if (!isMultiplayer || !channelRef.current || !user || activeExercises.length === 0 || showSummary || isFinished) return;
        const currentStr = JSON.stringify(activeExercises);
        
        // Prevent echo loops
        if (currentStr === lastIncomingState.current) return;

        const handler = setTimeout(() => {
            if (channelRef.current) {
                const stateStr = JSON.stringify(activeExercises);
                lastIncomingState.current = stateStr; // Mark as sent to prevent incoming echo loops
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'sync_state',
                    payload: {
                        exercises: activeExercises,
                        sender: user.id,
                        routineName: currentRoutineName,
                        isRoutineModified: isRoutineModified,
                        // Carry known-finalized list so recipients can lock cells
                        // even if they missed participant_left
                        finalizedParticipants: [...finalizedParticipantsRef.current],
                        // Carry known-cancelled list so recipients hide that participant's
                        // column even if they missed participant_cancelled
                        cancelledParticipants: [...cancelledParticipantsRef.current]
                    }
                }).catch(e => console.error(e));
            }
        }, 500); // 500ms debounce to allow fluent typing without focus loss

        return () => clearTimeout(handler);
    }, [activeExercises, isMultiplayer, user, currentRoutineName, isRoutineModified]);

    // When the summary screen opens for a coop session, fetch the authoritative participant
    // list and per-player set data from DB. This fixes cases where in-memory sync didn't
    // deliver a participant's data (3rd+ person, late joiner, brief network gap, etc.).
    useEffect(() => {
        if (!showSummary || !isMultiplayer || multiplayerMode !== 'conjunto') return;
        const roomId = isInviter ? (sessionId || '') : (syncRoomId || '');
        if (!roomId) return;

        const load = async () => {
            // All sessions in the room: the host row (id = roomId) + guest rows
            const { data: sessions } = await supabase
                .from('workout_sessions')
                .select('id, user_id')
                .or(`id.eq.${roomId},partner_session_id.eq.${roomId}`);
            if (!sessions?.length) return;

            const userIds = sessions.map((s: any) => s.user_id);
            const { data: profiles } = await supabase
                .from('profiles').select('id, username, avatar_url').in('id', userIds);

            // Host first (session.id === roomId), then guests sorted by id for determinism
            const sorted = [...sessions].sort((a: any, b: any) => {
                if (a.id === roomId) return -1;
                if (b.id === roomId) return 1;
                return a.id.localeCompare(b.id);
            });
            const players = sorted.map((s: any) => {
                const p = (profiles || []).find((pr: any) => pr.id === s.user_id);
                return { id: s.user_id, username: p?.username || 'Participante', avatarUrl: p?.avatar_url || '' };
            });

            // Fetch logs for every session in parallel
            const exerciseMap: Record<string, {
                exerciseId: string; exerciseName: string;
                setMap: Record<number, Record<string, { weight: number; reps: number; time: number; distance: number }>>;
            }> = {};

            await Promise.all(sessions.map(async (sess: any) => {
                const { data: logs } = await supabase
                    .from('workout_logs')
                    .select('exercise_id, set_number, weight_kg, reps, time, distance, exercise:exercises(id, name)')
                    .eq('session_id', sess.id)
                    .order('set_number', { ascending: true });
                for (const log of (logs || [])) {
                    const exId = log.exercise_id;
                    const exName = (log.exercise as any)?.name || 'Ejercicio';
                    if (!exerciseMap[exId]) exerciseMap[exId] = { exerciseId: exId, exerciseName: exName, setMap: {} };
                    const sn = log.set_number || 1;
                    if (!exerciseMap[exId].setMap[sn]) exerciseMap[exId].setMap[sn] = {};
                    exerciseMap[exId].setMap[sn][sess.user_id] = {
                        weight: log.weight_kg || 0,
                        reps: log.reps || 0,
                        time: log.time || 0,
                        distance: log.distance || 0
                    };
                }
            }));

            const exerciseSets = Object.values(exerciseMap).map(ex => ({
                exerciseId: ex.exerciseId,
                exerciseName: ex.exerciseName,
                sets: Object.entries(ex.setMap)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([sn, playerData]) => ({ setNumber: Number(sn), playerData }))
            }));

            setCoopSummaryData({ players, exerciseSets });
        };

        load().catch(e => console.warn('[CoopSummary] DB fetch failed, falling back to in-memory:', e));
    }, [showSummary, isMultiplayer, multiplayerMode, sessionId, syncRoomId, isInviter]);

    // Broadcast updated participant list whenever it changes on the Host's device to keep row slot alignment
    // Guard: never broadcast with empty exercises — that would wipe guests' active sessions.
    useEffect(() => {
        if (isMultiplayer && isInviter && channelRef.current && user && participants.length > 0
            && activeExercisesRef.current.length > 0) {
            console.log('📢 Host broadcasting updated participant list to all devices:', participants.map(p => p.username));
            channelRef.current.send({
                type: 'broadcast',
                event: 'sync_state',
                payload: {
                    exercises: activeExercisesRef.current,
                    sender: user.id,
                    knownParticipants: participants,
                    routineName: currentRoutineNameRef.current,
                    isRoutineModified: isRoutineModifiedRef.current
                }
            }).catch(e => console.error(e));
        }
    }, [participants, isMultiplayer, isInviter, user]);

    // Delay link of partner session ID if it arrived before our sessionId was created
    useEffect(() => {
        if (sessionId && partnerSessionIdRef.current) {
            console.log('🔗 Delayed linking of partner session:', partnerSessionIdRef.current);
            supabase
                .from('workout_sessions')
                .update({ partner_session_id: partnerSessionIdRef.current })
                .eq('id', sessionId)
                .then(({ error }) => {
                    if (error) console.error('Error linking partner session delayed:', error);
                    else console.log('✅ Delayed linking successful!');
                });
        }
    }, [sessionId]);

    // Send session ID broadcast as soon as sessionId is created
    useEffect(() => {
        if (!isMultiplayer || !channelRef.current || !user || !sessionId) return;
        channelRef.current.send({
            type: 'broadcast',
            event: 'sync_session_id',
            payload: { sessionId: sessionId, startTime: startTime?.toISOString(), sender: user.id }
        }).catch(e => console.error('Error sending sessionId broadcast:', e));
    }, [sessionId, startTime, isMultiplayer, user]);
    // Ensure absolute consistency when waking from background/sleep
    // When the phone is locked/unlocked, Supabase Realtime WebSocket can drop.
    // We re-track presence and request hydration after a short delay to let the channel reconnect.
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!isMultiplayer || !user) return;

            if (document.visibilityState === 'visible') {
                console.log('📱 [Wakeup] App became visible. Re-tracking presence and requesting hydration...');

                // Wait for the Supabase Realtime WebSocket to fully reconnect after background/sleep.
                // The channel may have been silently dropped by the OS — 1.5s is sufficient to reconnect.
                setTimeout(() => {
                    if (!channelRef.current || !user) return;

                    // Re-announce our presence so the partner sees us as online again.
                    channelRef.current.track({
                        user_id: user.id,
                        username: user.user_metadata?.username || user.user_metadata?.full_name || 'Yo',
                        avatar_url: user.user_metadata?.avatar_url || '',
                        joined_at: joinTimestamp
                    }).then(() => {
                        console.log('✅ [Wakeup] Presence re-tracked successfully.');
                    }).catch(e => console.warn('⚠️ [Wakeup] Failed to re-track presence:', e));

                    // Request full state hydration from the partner to recover any missed events.
                    channelRef.current.send({
                        type: 'broadcast',
                        event: 'request_hydration',
                        payload: { sender: user.id }
                    }).catch(e => console.warn('⚠️ [Wakeup] Failed to send hydration request:', e));
                }, 1500);
            }
            // NOTE: On 'hidden' (phone locked), we intentionally do NOT clear any session state.
            // The Realtime channel may drop temporarily but the workout session in Supabase DB
            // remains untouched. The partner should treat a presence disappearance as a
            // temporary disconnect, not a session termination.
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isMultiplayer, user, joinTimestamp]);
    // --- End Multiplayer Sync Hooks ---

    // NEW: Start Options Modal
    const [showStartOptionsModal, setShowStartOptionsModal] = useState(false);
    const [showIntroAnim, setShowIntroAnim] = useState(true);
    const [detectedGymName, setDetectedGymName] = useState('');
    const CATALOG_ORDER = [
        // PECHO
        'PECHO', 'HOMBRO', 'TRÍCEPS',
        // ESPALDA
        'ESPALDA', 'BÍCEPS', 'ANTEBRAZO',
        // PIERNA
        'CUÁDRICEPS', 'ISQUIOTIBIALES', 'GLÚTEOS', 'PANTORRILLAS', 'ADUCTORES',
        // CORE
        'ABDOMINALES', 'LUMBARES', 'CUELLO',
        // CARDIO
        'CARDIO'
    ];

    const scrollToCategory = (category: string) => {
        setActiveMuscleFilter(category);
        // getBoundingClientRect is reliable across iOS/Android and fixed containers.
        // offsetParent walk can fail when the container is inside position:fixed.
        requestAnimationFrame(() => {
            const container = catalogScrollRef.current;
            const element = document.getElementById(`category-section-${category}`);
            if (container && element) {
                const containerRect = container.getBoundingClientRect();
                const elementRect  = element.getBoundingClientRect();
                const targetTop = container.scrollTop + (elementRect.top - containerRect.top) - 8;
                container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
            } else if (container) {
                container.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    };
    const catalogScrollRef = useRef<HTMLDivElement>(null);

    const [userSettings, setUserSettings] = useState<CustomSettings>({ categories: [], metrics: [] });
    // Arsenal Modal State
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreatingExercise, setIsCreatingExercise] = useState(false);
    const [editingItem, setEditingItem] = useState<Equipment | null>(null);

    // NEW: Batch Selection State
    const [selectedCatalogItems, setSelectedCatalogItems] = useState<Set<string>>(new Set());
    const [activeMuscleFilter, setActiveMuscleFilter] = useState<string | null>(null);

    const handleCatalogToggle = (id: string) => {
        setSelectedCatalogItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // NEW: Rest Timer State
    const [restTimerSetKey, setRestTimerSetKey] = useState<string | null>(null); // "exerciseIdx-setIdx" to show only under specific set

    // NEW: Weight Unit State (Global Default Only)
    // We only use this to initialize new exercises. Exercises themselves hold their state.
    const [defaultWeightUnit, setDefaultWeightUnit] = useState<'kg' | 'lb'>('kg');

    // Load Default Weight Unit on Mount
    useEffect(() => {
        const savedUnit = localStorage.getItem('ginx_weight_unit');
        if (savedUnit === 'lb') setDefaultWeightUnit('lb');
    }, []);

    // Reset Scroll when filters change
    useEffect(() => {
        if (catalogScrollRef.current) {
            catalogScrollRef.current.scrollTop = 0;
        }
    }, [activeMuscleFilter, searchTerm]);

    // Sync Selected Catalog Items reactively with active exercises
    // Reset on close, rebuild fresh on open — prevents count inflation for coop guests (BUG-06)
    useEffect(() => {
        if (!showAddModal) {
            setSelectedCatalogItems(new Set());
            return;
        }
        // Build a fresh set from current active exercises for visual "already in session" state.
        const toMark = new Set<string>();
        activeExercises.forEach(e => {
            // Always keep the exact equipmentId (covers manifest, virtual, and real DB IDs)
            if (e.equipmentId) toMark.add(e.equipmentId);
            if (e.equipmentName) {
                toMark.add(`virtual-${e.equipmentName}`);
                toMark.add(`virtual-${e.equipmentName.trim()}`);
            }
            // Mark the manifest variant-specific ID so the correct per-variant card
            // appears selected. For single-variant exercises use the plain manifest ID.
            // NEVER add the plain manifest ID for multi-variant exercises — doing so
            // creates phantom/ghost exercises in handleBatchAdd.
            // Exact match only — avoid prefix ambiguity (e.g. "Press" matching both
            // "Press Inclinado" and "Press Plano"). Equipment names are always either
            // the exact base name or "BaseName (VariantName)".
            const manifestEntry = IMAGE_MANIFEST.find(entry =>
                e.equipmentName === entry.name ||
                entry.variants.some(v => e.equipmentName === `${entry.name} (${v.name})`)
            );
            if (manifestEntry) {
                if (manifestEntry.variants.length > 1) {
                    const matchedVariant = manifestEntry.variants.find(v =>
                        e.equipmentName === `${manifestEntry.name} (${v.name})`
                    );
                    if (matchedVariant) {
                        toMark.add(`manifest-${manifestEntry.id}__${matchedVariant.id}`);
                    }
                } else {
                    toMark.add(`manifest-${manifestEntry.id}`);
                }
            }
        });
        setSelectedCatalogItems(toMark);
    }, [showAddModal]); // Only re-run when modal opens/closes, not on every exercise change

    // Helpers for Unit Conversion
    const toDisplayWeight = (kgVal: number, unit: 'kg' | 'lb' = 'kg'): string => {
        if (!kgVal) return '';
        if (unit === 'kg') {
            return parseFloat(kgVal.toFixed(1)).toString();
        }
        // lb: always integer — no decimals ever
        return Math.round(kgVal * 2.20462).toString();
    };

    const toInternalWeight = (inputVal: string, unit: 'kg' | 'lb' = 'kg'): number => {
        const num = parseFloat(inputVal.replace(',', '.'));
        if (isNaN(num)) return 0;
        const maxInput = unit === 'lb' ? 1999 : 999;
        const capped = Math.min(num, maxInput);
        if (unit === 'kg') return capped;
        // lb: round to integer first, then store as precise kg
        return Math.round(capped) / 2.20462;
    };

    // Toggle Unit for Specific Exercise
    const toggleExerciseUnit = (exerciseIndex: number) => {
        // Read the current unit from the last rendered state (NOT via mutation)
        const currentUnit = activeExercises[exerciseIndex]?.weightUnit || 'kg';
        const newUnit: 'kg' | 'lb' = currentUnit === 'kg' ? 'lb' : 'kg';

        // Use functional update so React gets a fully immutable new state.
        // Mutating the existing object (shallow copy) caused React to see stale
        // snapshots on concurrent re-renders, reverting the unit immediately.
        setActiveExercises(prev =>
            prev.map((ex, idx) =>
                idx === exerciseIndex ? { ...ex, weightUnit: newUnit } : ex
            )
        );

        // Save as new default for future added exercises
        localStorage.setItem('ginx_weight_unit', newUnit);
        setDefaultWeightUnit(newUnit);
    };


    // NEW: Handle Batch Add
    // --- Local Backup / Restore Logic (Simplified to only cleanup) ---
    // [REMOVED] Redundant loadSavedSession useEffect that caused state pollution.
    // Initialization is now strictly handled by initializeBattle.


    // Save state on change
    useEffect(() => {
        if (activeExercises.length === 0 && !currentRoutineName) return;
        if (!user) return; // Only save if user is logged in

        const saveSession = () => {
            const sessionData = {
                savedAt: Date.now(),
                data: {
                    exercises: activeExercises,
                    startTime: startTime?.toISOString(), // Convert Date to string for storage
                    routineName: currentRoutineName,
                    // locationName: '', // No locationName state
                    gymId: resolvedGymId
                }
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
        };

        const timeoutId = setTimeout(saveSession, 1000); // Debounce 1s
        return () => clearTimeout(timeoutId);
    }, [activeExercises, startTime, currentRoutineName, resolvedGymId, user]);

    // Sync active exercises list to Supabase notes column for real-time allied view
    useEffect(() => {
        if (!sessionId || !user) return;

        const syncToSupabaseLive = async () => {
            try {
                const liveExercisesSummary = activeExercises.map(e => ({
                    id: e.id,
                    equipmentId: e.equipmentId,
                    equipmentName: e.equipmentName,
                    setsCount: e.sets.length,
                    completedSetsCount: e.sets.filter(s => s.completed).length,
                    category: e.category || 'Custom'
                }));
                const livePayload = JSON.stringify({ active_exercises: liveExercisesSummary });

                // Persist the full draft to session_state so a tab close or device
                // switch can restore even exercises that have no completed sets yet.
                const draftState = activeExercises.length > 0 ? {
                    exercises: activeExercises,
                    routineName: currentRoutineName,
                    originalIds: originalExerciseIds,
                    isRoutineModified
                } : null;

                await supabase
                    .from('workout_sessions')
                    .update({ notes: livePayload, session_state: draftState })
                    .eq('id', sessionId);
            } catch (err) {
                console.error("Error syncing live session exercises to Supabase:", err);
            }
        };

        const timer = setTimeout(syncToSupabaseLive, 1000); // Debounce 1.0s
        return () => clearTimeout(timer);
    }, [activeExercises, sessionId, user, currentRoutineName, originalExerciseIds, isRoutineModified]);

    // --- End Local Backup ---

    const handleBatchAdd = async () => {
        if (selectedCatalogItems.size === 0 && activeExercises.length === 0) return;
        // Prevent concurrent calls — double-tapping AGREGAR would create duplicate exercises
        if (isAddingExercisesRef.current) return;
        isAddingExercisesRef.current = true;
        try {

        let activeArsenal = arsenal;

        // 1. Start Session if needed (Delayed Start)
        if (!sessionId) {
            console.log("🚀 Auto-starting session on first exercise add...");
            const result = await startNewSession();
            if (result && result.freshArsenal) {
                activeArsenal = result.freshArsenal;
            }
        }

        const effectiveInv = [...activeArsenal];
        COMMON_EQUIPMENT_SEEDS.forEach(seed => {
            if (!effectiveInv.some(i => normalizeText(i.name) === normalizeText(seed.name))) {
                effectiveInv.push({
                    id: `virtual-${seed.name}`,
                    name: seed.name,
                    category: seed.category,
                    target_muscle_group: seed.category,
                    metrics: seed.metrics
                } as any);
            }
        });

        // Find which selected equipment IDs are new (not already in activeExercises)
        const existingEquipmentIds = new Set<string>();
        activeExercises.forEach(e => {
            if (e.equipmentId) existingEquipmentIds.add(e.equipmentId);
            if (e.equipmentName) existingEquipmentIds.add(`virtual-${e.equipmentName}`);
            const mEntry = IMAGE_MANIFEST.find(entry =>
                e.equipmentName === entry.name ||
                entry.variants.some(v => e.equipmentName === `${entry.name} (${v.name})`)
            );
            if (mEntry) {
                if (mEntry.variants.length > 1) {
                    const mVariant = mEntry.variants.find(v =>
                        e.equipmentName === `${mEntry.name} (${v.name})`
                    );
                    if (mVariant) existingEquipmentIds.add(`manifest-${mEntry.id}__${mVariant.id}`);
                } else {
                    existingEquipmentIds.add(`manifest-${mEntry.id}`);
                }
            }
        });

        const newEquipmentIdsToAdd = Array.from(selectedCatalogItems).filter(id => !existingEquipmentIds.has(id));

        const itemsToAdd: Equipment[] = [];
        newEquipmentIdsToAdd.forEach(id => {
            if (id.startsWith('manifest-')) {
                // ID formats:
                //   "manifest-<entryId>__<variantId>"  → variant-specific (new format)
                //   "manifest-<entryId>"               → single-variant or legacy
                const withoutPrefix = id.slice('manifest-'.length);
                const sepIdx = withoutPrefix.indexOf('__');
                const manifestId = sepIdx >= 0 ? withoutPrefix.slice(0, sepIdx) : withoutPrefix;
                const variantId  = sepIdx >= 0 ? withoutPrefix.slice(sepIdx + 2) : null;

                const entry = IMAGE_MANIFEST.find(e => e.id === manifestId);
                if (entry) {
                    const activeVariant = variantId
                        ? (entry.variants.find(v => v.id === variantId) ?? entry.variants[0])
                        : (entry.variants.find(v => !v.isLocked) ?? entry.variants[0]);

                    const displayName = entry.variants.length > 1 && activeVariant
                        ? `${entry.name} (${activeVariant.name})`
                        : entry.name;

                    itemsToAdd.push({
                        id:                  id,
                        name:                displayName,
                        category:            'ACCESSORY',
                        target_muscle_group: entry.muscle,
                        image_url:           activeVariant?.imagePath ?? entry.imagePath,
                        metrics:             entry.muscle === 'CARDIO'
                                               ? { weight: false, reps: false, time: true, distance: true, rpe: false }
                                               : { weight: true, reps: true, time: false, distance: false, rpe: false },
                        quantity: 1, condition: 'GOOD', gym_id: 'manifest',
                    } as Equipment);
                }
                return;
            }
            const item = effectiveInv.find(i => i.id === id);
            if (item) itemsToAdd.push(item);
        });

        // Map new ones to WorkoutExercise and fetch ghosts
        const newExercisesPromises = itemsToAdd.map(async equipment => {
            const defaultMetrics = { weight: true, reps: true, time: false, distance: false, rpe: false };
            
            // 👻 GHOST SYSTEM: Fetch last session's sets!
            let ghostSets: WorkoutSet[] = [];
            if (user && equipment.id) {
                const logs = await workoutService.getGhostSets(equipment.id, user.id);
                if (logs && logs.length > 0) {
                    ghostSets = logs.map(log => ({
                        id: Math.random().toString(),
                        weight: log.weight_kg || 0,
                        reps: log.reps || 0,
                        time: log.time || 0,
                        distance: log.distance || 0,
                        rpe: log.rpe || 0,
                        custom: log.metrics_data || {},
                        completed: false, // The ghost is NOT completed yet
                    }));
                }
            }

            return {
                id: Math.random().toString(), // UI Key
                equipmentId: equipment.id,
                equipmentName: equipment.name,
                metrics: (equipment.metrics || defaultMetrics) as any,
                sets: ghostSets.length > 0 ? ghostSets : [
                    { id: Math.random().toString(), weight: 0, reps: 0, completed: false }
                ],
                category: equipment.target_muscle_group || equipment.category || 'Custom',
                weightUnit: defaultWeightUnit
            } as WorkoutExercise;
        });

        const newExercises = await Promise.all(newExercisesPromises);

        // Append new exercises without removing any existing ones
        const nextActiveExercises = [...activeExercises, ...newExercises];
        setActiveExercises(nextActiveExercises);
        setIsRoutineModified(true); // Structural change: exercises added

        // 3. Cleanup
        setSelectedCatalogItems(new Set());
        setShowAddModal(false);
        setExtrasSection(null);
        setSearchTerm('');
        } finally {
            isAddingExercisesRef.current = false;
        }
    };



    // Computed: IDs already active in this session — used to show correct AGREGAR count (BUG-06)
    const alreadyActiveIds = useMemo(() => {
        const ids = new Set<string>();
        activeExercises.forEach(e => {
            if (e.equipmentId) ids.add(e.equipmentId);
            if (e.equipmentName) {
                ids.add(`virtual-${e.equipmentName}`);
                ids.add(`virtual-${e.equipmentName.trim()}`);
            }
            // Register manifest variant-specific IDs so the catalog shows correct selection state.
            // For multi-variant exercises: only add the variant-specific ID (manifest-X__variantId).
            // For single-variant: only add the plain manifest ID.
            // Never mix both for the same exercise — plain IDs on multi-variant items would mark
            // phantom exercises as "already active".
            const mEntry = IMAGE_MANIFEST.find(entry =>
                e.equipmentName === entry.name ||
                entry.variants.some(v => e.equipmentName === `${entry.name} (${v.name})`)
            );
            if (mEntry) {
                if (mEntry.variants.length > 1) {
                    const mVariant = mEntry.variants.find(v =>
                        e.equipmentName === `${mEntry.name} (${v.name})`
                    );
                    if (mVariant) ids.add(`manifest-${mEntry.id}__${mVariant.id}`);
                } else {
                    ids.add(`manifest-${mEntry.id}`);
                }
            }
        });
        return ids;
    }, [activeExercises]);
    const newlySelectedCount = useMemo(
        () => Array.from(selectedCatalogItems).filter(id => !alreadyActiveIds.has(id)).length,
        [selectedCatalogItems, alreadyActiveIds]
    );

    // Computed: Merge Seeds (Virtual) only if not already present by NAME in the real/global list
    const effectiveInventory = [...arsenal];
    COMMON_EQUIPMENT_SEEDS.forEach(seed => {
        if (!effectiveInventory.some(i => normalizeText(i.name) === normalizeText(seed.name))) {
            effectiveInventory.push({
                ...seed,
                id: `virtual-${seed.name}`,
                // @ts-expect-error - ignore typing
                gym_id: 'virtual',
                condition: 'GOOD',
                quantity: 1
            } as Equipment);
        }
    });

    // ── Locked exercises from ocultos/ folders (via IMAGE_MANIFEST) ──────────
    // These appear in the catalog with a lock icon. Injected ONLY if not already
    // present by name in effectiveInventory (avoids duplicates with seeds).
    const lockedItemIds = new Set<string>();
    IMAGE_MANIFEST.forEach(entry => {
        if (!entry.isLocked) return; // only inject locked exercises
        const itemId = `manifest-${entry.id}`;
        if (!effectiveInventory.some(i => normalizeText(i.name) === normalizeText(entry.name))) {
            effectiveInventory.push({
                id:   itemId,
                name: entry.name,
                category: 'ACCESSORY',
                target_muscle_group: entry.muscle,
                image_url: entry.imagePath,
                metrics: { weight: true, reps: true, time: false, distance: false, rpe: false },
                quantity: 1, condition: 'GOOD', gym_id: 'manifest',
            } as Equipment);
        }
        if (!isUnlocked(itemId)) lockedItemIds.add(itemId);
    });

    // Map ArsenalGrid section names to catalog muscle keys for getExtrasForMuscle()
    const sectionToCatalogMuscle = (section: string): string => {
        const map: Record<string, string> = {
            'CUÁDRICEPS': 'PIERNA', 'ISQUIOTIBIALES': 'PIERNA', 'PANTORRILLAS': 'PIERNA', 'ADUCTORES': 'PIERNA',
            'LUMBARES': 'ABDOMINALES', 'CUELLO': 'ABDOMINALES',
            'ANTEBRAZO': 'BÍCEPS',
        };
        return map[section] ?? section;
    };

    // Extras inventory for the "+" panel — seeds that are NOT in the curated catalog
    // (neither as a base nor as any variant of a base)
    const extrasSectionInventory: typeof effectiveInventory = extrasSection ? (() => {
        const catalogMuscle = sectionToCatalogMuscle(extrasSection);
        const extraNames = getExtrasForMuscle(catalogMuscle, COMMON_EQUIPMENT_SEEDS as any);
        return extraNames.map(seedName => {
            const existing = effectiveInventory.find(i => normalizeText(i.name) === normalizeText(seedName));
            if (existing) return existing;
            const seed = (COMMON_EQUIPMENT_SEEDS as any[]).find(s => s.name === seedName);
            if (!seed) return null;
            return { ...seed, id: `virtual-${seed.name}`, gym_id: 'virtual', quantity: 1, condition: 'GOOD' } as any;
        }).filter(Boolean);
    })() : [];

    // ── 100% FILESYSTEM-DRIVEN catalog ──────────────────────────────────────────
    // Source of truth: IMAGE_MANIFEST (generated by `npm run catalog` from the
    // folder structure in public/ejercicioimg/ejercicios/).
    // No more hardcoded exercise lists — what's on disk is what shows in the app.
    //
    // Stable IDs ("manifest-<id>") prevent the "cards replacing" bug: the card
    // stays in the same grid slot even when the displayed variant changes.
    // Each unlocked variant of a multi-variant exercise gets its OWN card with its full name.
    // Single-variant exercises keep their base name and stable manifest ID.
    // IDs use the "manifest-<entryId>__<variantId>" format — no plain "manifest-<entryId>"
    // for multi-variant exercises, which was causing ghost/duplicate exercises on add.
    const { curatedCatalogInventory, variantBadgeMap } = (() => {
        const badges = new Map<string, { label: string; total: number; baseId: string; currentId?: string; variants: any[] }>();
        const items: Equipment[] = [];

        for (const entry of IMAGE_MANIFEST) {
            if (entry.isLocked) continue;

            const baseId = `manifest-${entry.id}`;
            const isCardio = entry.muscle === 'CARDIO';
            const metrics = isCardio
                ? { weight: false, reps: false, time: true, distance: true, rpe: false }
                : { weight: true, reps: true, time: false, distance: false, rpe: false };

            if (entry.variants.length > 1) {
                // One card per unlocked variant — full name includes variant label.
                // No cycling badge needed since each variant is already its own card.
                for (const variant of entry.variants) {
                    if (variant.isLocked) continue;
                    items.push({
                        id:                  `${baseId}__${variant.id}`,
                        name:                `${entry.name} (${variant.name})`,
                        category:            'ACCESSORY',
                        target_muscle_group: entry.muscle,
                        image_url:           variant.imagePath,
                        metrics,
                        quantity: 1, condition: 'GOOD', gym_id: 'manifest',
                    } as Equipment);
                }
            } else {
                // Single-variant: keep the stable base ID and the exercise's own name
                items.push({
                    id:                  baseId,
                    name:                entry.name,
                    category:            'ACCESSORY',
                    target_muscle_group: entry.muscle,
                    image_url:           entry.imagePath,
                    metrics,
                    quantity: 1, condition: 'GOOD', gym_id: 'manifest',
                } as Equipment);
            }
        }

        // Also add any non-manifest items from the gym's real arsenal
        const manifestIds = new Set(items.map(i => i.id));
        const arsenalExtras = arsenal.filter(i => !manifestIds.has(i.id) && i.gym_id !== 'virtual' && i.gym_id !== 'manifest');
        arsenalExtras.forEach(i => items.push(i));

        return { curatedCatalogInventory: items, variantBadgeMap: badges };
    })();

    const catalogItems = COMMON_EQUIPMENT_SEEDS.filter(seed => {
        if (activeMuscleFilter) {
            // @ts-expect-error - ignore typing
            return getMuscleGroup({ name: seed.name, category: seed.category }, userSettings) === activeMuscleFilter;
        }
        return true;
    });

    // Timer State (RESTORED)
    const [elapsedTime, setElapsedTime] = useState("00:00");
    const [ambiguousGyms, setAmbiguousGyms] = useState<any[]>([]);
    // 'multiple_defaults' → user has several predeterminados nearby (R7)
    // 'no_default'        → user has NO predeterminado at all; selection will save as one (R4)
    // 'pick_for_today'    → user already HAS a predeterminado (just not nearby) — pick where
    //                       to train today WITHOUT touching the permanent predeterminado
    const [ambiguousReason, setAmbiguousReason] = useState<'multiple_defaults' | 'no_default' | 'pick_for_today' | null>(null);
    const [isFinished, setIsFinished] = useState(false);

    // Timer Effect (RESTORED)
    useEffect(() => {
        if (!startTime || isFinished) return;

        const MAX_SESSION_MS = 5 * 60 * 60 * 1000; // 5 hours hard limit

        const tick = () => {
            const now = new Date();
            const diff = Math.max(0, now.getTime() - new Date(startTime).getTime());

            // ⏱️ AUTO-KILL: Force-end sessions that exceed 5 hours.
            // Uses the RAW elapsed time (never the paused-adjusted display) —
            // pausing the visible clock must never let a session live past the
            // hard limit and become a zombie.
            if (diff >= MAX_SESSION_MS) {
                console.warn('⏰ Sesión superó el límite de 5 horas. Cerrando automáticamente...');
                setIsFinished(true);
                isLeavingPageRef.current = true;
                // Clean up all local state silently
                if (sessionId) {
                    localStorage.removeItem(`workout_draft_${sessionId}`);
                    workoutService.deleteSession(sessionId).catch(() => {});
                }
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem('ginx_coop_state');
                setSessionId(null);
                navigate('/');
                return;
            }

            // 🕐 DISPLAY: subtract all paused time (completed pauses + the one
            // currently in progress, if any) so the shown clock freezes the
            // instant the user pauses and resumes from EXACTLY that value with
            // zero loss/duplication — spec §1.2 línea 49: "Pausar y reanudar
            // conserva exactamente los datos y el tiempo transcurrido". While
            // paused, `diff` and `pausedMs` grow at the same rate, so
            // `displayDiff` stays perfectly constant — no extra branching needed.
            let pausedMs = accumulatedPauseMsRef.current;
            if (pausedAtRef.current) {
                pausedMs += (now.getTime() - pausedAtRef.current);
            }
            const displayDiff = Math.max(0, diff - pausedMs);

            const hours = Math.floor(displayDiff / (1000 * 60 * 60));
            const minutes = Math.floor((displayDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((displayDiff % (1000 * 60)) / 1000);

            if (hours > 0) {
                setElapsedTime(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            } else {
                setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }
        };

        tick(); // Immediate update
        const interval = setInterval(tick, 200); // High-frequency tick (200ms) to ensure perfect cross-device synchronization
        return () => clearInterval(interval);
    }, [startTime, isFinished, sessionId]);

    // Reset the continuous geo-validation flag whenever a (new/restored) session begins
    useEffect(() => {
        geoLeftRadiusRef.current = false;
    }, [sessionId]);

    // Geo-validación CONTINUA (spec §3): el GPS debe confirmar que el usuario
    // permanece dentro del radio de su gym durante TODA la sesión — no solo al
    // finalizar. Si en algún momento se detecta que salió del radio, se marca
    // la sesión como no geo-validada y el GX/racha de hoy no se otorgan,
    // sin importar que un chequeo posterior vuelva a pasar.
    useEffect(() => {
        if (!sessionId || !resolvedGymId || isFinished) return;

        const GEO_RADIUS_M = 1500; // misma tolerancia que la verificación final (margen GPS indoor)
        let cancelled = false;

        const checkContinuousPresence = async () => {
            if (geoLeftRadiusRef.current) return; // ya marcado — no hace falta seguir chequeando
            try {
                const [userPos, gymRow] = await Promise.all([
                    getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 }).catch(() => null),
                    supabase.from('gyms').select('lat, lng').eq('id', resolvedGymId).maybeSingle().then(r => r.data)
                ]);

                if (cancelled || !userPos || !gymRow?.lat || !gymRow?.lng) return;

                const dist = haversineDistance(userPos.lat, userPos.lng, Number(gymRow.lat), Number(gymRow.lng));
                if (dist > GEO_RADIUS_M) {
                    geoLeftRadiusRef.current = true;
                    console.warn(`📍 Geo-validación continua: te alejaste del gym (${Math.round(dist)}m) — hoy no sumarás GX/racha de entrenamiento.`);
                    import('react-hot-toast').then(({ default: t }) =>
                        t('Te alejaste del gym — hoy no sumarás GX/racha de entrenamiento 📍', {
                            duration: 5000,
                            icon: '⚠️',
                            style: { background: '#171717', color: '#fff', border: '1px solid rgba(239,68,68,0.3)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }
                        })
                    );
                }
            } catch {
                // GPS momentáneamente no disponible — no penalizar por fallas transitorias
            }
        };

        checkContinuousPresence(); // chequeo inicial
        const interval = setInterval(checkContinuousPresence, 3 * 60 * 1000); // cada 3 minutos
        return () => { cancelled = true; clearInterval(interval); };
    }, [sessionId, resolvedGymId, isFinished]);

    // Init Logic
    useEffect(() => {
        if (!user) return;
        initializeBattle(user.id);
    }, [user, routeGymId, location.key]);

    const initializeBattle = async (userId: string) => {
        if (!userId) return navigate('/login');
        // Never run init logic while the session is finishing or the summary is showing —
        // doing so can open the catalog or start-options modal over the finish flow.
        if (isFinished || showSummary) return;
        // If the user is actively training in multiplayer and exercises are loaded,
        // skip re-initialization to prevent ghost catalog flashes and multiplayer resets.
        // (This can trigger on location.key changes e.g. when checking notifications.)
        if (isMultiplayerRef.current && activeExercisesRef.current.length > 0 && sessionIdRef.current) return;

        // Extract fresh state variables directly from location to avoid closure staleness on route navigation
        const navState = location.state as any || {};
        const currentIsMultiplayer = navState.isMultiplayer ?? isMultiplayer;
        const currentPartnerId = navState.partnerId ?? partnerId;
        const currentMultiplayerMode = navState.multiplayerMode ?? multiplayerMode;
        const currentIsInviter = navState.isInviter ?? isInviter;

        // Parallelize Initial Data Fetching
        try {
            // Show intro animation only on genuine cold-start (no active exercises, no session).
            // Never show it when the user is already in an active workout or finalizing —
            // that would create a 1.2s black screen that looks like "no exercises."
            const shouldShowIntro = activeExercisesRef.current.length === 0 && !sessionIdRef.current;
            if (shouldShowIntro) {
                setShowIntroAnim(true);
                setTimeout(() => setShowIntroAnim(false), 1200);
            } else {
                setShowIntroAnim(false);
            }

            // 🛡️ PHASE 0: Aggressively clean orphan sessions BEFORE fetching the active session.
            // This ensures getActiveSession never returns a ghost with stale timer data.
            // We also purge the matching localStorage draft keys so they can't be restored.
            try {
                const closedIds = await workoutService.cleanOrphanSessions(userId);
                if (closedIds.length > 0) {
                    console.log(`🧹 Purgando ${closedIds.length} draft(s) de localStorage de sesiones cerradas:`, closedIds);
                    closedIds.forEach(id => {
                        localStorage.removeItem(`workout_draft_${id}`);
                    });
                    // Also purge the generic key in case it maps to one of the closed sessions
                    const genericDraft = localStorage.getItem(STORAGE_KEY);
                    if (genericDraft) {
                        try {
                            const gd = JSON.parse(genericDraft);
                            if (gd?.sessionId && closedIds.includes(gd.sessionId)) {
                                localStorage.removeItem(STORAGE_KEY);
                            }
                        } catch { localStorage.removeItem(STORAGE_KEY); }
                    }
                }
            } catch (cleanupErr) {
                console.warn('⚠️ cleanOrphanSessions falló pero continuamos:', cleanupErr);
            }

            // 1. PHASE 1: Instant Data Fetch (Settings & Gyms)
            const [gyms, settings, allGyms] = await Promise.all([
                userService.getUserGyms(userId),
                equipmentService.getUserSettings(userId),
                userService.getAllGyms()
            ]);

            // Always respect route parameter if explicitly navigated to a gym, otherwise start libre
            // Normalize "personal" string to null to prevent database casting errors
            const targetGymId = (routeGymId && routeGymId !== 'personal') ? routeGymId : null;

            // Phase 1 only pre-selects a gym when the route explicitly specifies one.
            // The homeGym is detected and auto-selected in Phase 3 GPS — that ensures
            // the user is actually nearby before we commit to a gym. Without this guard,
            // homeGyms far away would be loaded as the "current" gym even when the user
            // is at a completely different location.
            const homeGym = gyms.find(g => g.is_home_base);
            const resolvedInitialGymId = targetGymId || null;

            if (resolvedInitialGymId) {
                const routeGym = gyms.find(g => g.gym_id === targetGymId);
                setDetectedGymName(routeGym ? (routeGym.gym_name || '') : 'Mi Gimnasio');
            } else {
                setDetectedGymName('Buscando ubicación...');
            }

            setResolvedGymId(resolvedInitialGymId);
            setUserSettings(settings);

            // 2. PHASE 2: Fetch Inventory and Routines using predicted gym
            const [items, localRoutines, activeResult, personalItems, partnerActiveResult] = await Promise.all([
                equipmentService.getInventory(resolvedInitialGymId || ''),
                workoutService.getUserRoutines(userId, resolvedInitialGymId),
                workoutService.getActiveSession(userId),
                equipmentService.getPersonalInventory(userId),
                (currentIsMultiplayer && currentPartnerId) ? workoutService.getActiveSession(currentPartnerId) : Promise.resolve({ data: null, error: null })
            ]);

            setRoutines(localRoutines);
            const mergedInventory = [...items, ...personalItems.filter(i => !items.some(existing => existing.id === i.id))];
            setArsenal(mergedInventory);

            // ── PHASE 2.5: Guest gym sync from host ──────────────────────────────────
            // When a guest joins a multiplayer room, use the host's gym silently:
            //   • No picker, no GPS prompt — assume all participants are at the same place.
            //   • Auto-register the gym in the guest's passport if they don't have it yet.
            //   • Re-fetch inventory and routines scoped to the host's gym.
            const isGuestInRoom = currentIsMultiplayer && !currentIsInviter;
            if (isGuestInRoom) {
                const hostGymId = partnerActiveResult?.data?.gym_id || null;
                if (hostGymId) {
                    const passportEntry  = gyms.find(g => g.gym_id === hostGymId);
                    const dbGym          = (allGyms as any[]).find(g => g.id === hostGymId);
                    const gymName        = passportEntry?.gym_name || dbGym?.name || 'Gimnasio del Grupo';

                    // Auto-register in passport (background, non-blocking)
                    if (!passportEntry && dbGym) {
                        userService.addGymToPassport(userId, {
                            place_id: dbGym.place_id || hostGymId,
                            name: dbGym.name || gymName,
                            address: dbGym.address || '',
                            location: { lat: dbGym.lat, lng: dbGym.lng }
                        }).catch(e => console.warn('⚠️ Auto-register host gym failed:', e));
                    }

                    // Override the guest's gym with the host's gym.
                    // Also clear any stale ambiguous-gym picker from a previous session.
                    setAmbiguousGyms([]);
                    setAmbiguousReason(null);
                    setResolvedGymId(hostGymId);
                    setDetectedGymName(gymName);

                    // Re-fetch inventory and routines for host's gym if different from Phase 1
                    if (hostGymId !== resolvedInitialGymId) {
                        const [hostItems, hostRoutines] = await Promise.all([
                            equipmentService.getInventory(hostGymId),
                            workoutService.getUserRoutines(userId, hostGymId)
                        ]);
                        setRoutines(hostRoutines);
                        setArsenal(prev => {
                            const merged = [...hostItems, ...prev.filter(i => !hostItems.some((x: any) => x.id === i.id))];
                            return merged;
                        });
                    }
                }
            }

            // 3. PHASE 3: GPS-based gym detection using passport gyms only.
            // Skipped for:
            //   • Guests in multiplayer rooms (gym already resolved from host in Phase 2.5)
            //   • Explicit route parameter navigations
            if (!targetGymId && !isGuestInRoom) {
                (async () => {
                    try {
                        const gpsPosition = await getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 })
                            .catch(async () => getCurrentPosition({ enableHighAccuracy: false, timeout: 3000 }));

                        // Helper: normalize a passport gym to the shape ambiguousGyms picker expects
                        const toPickerShape = (g: typeof gyms[0], distM: number, saveAsDefault?: boolean) => ({
                            id: g.gym_id,
                            name: g.gym_name,
                            place_id: g.google_place_id,
                            lat: g.lat,
                            lng: g.lng,
                            address: '',
                            dist: distM / 1000, // km (JSX shows dist*1000 → meters)
                            saveAsDefault: saveAsDefault ?? false,
                        });

                        if (gpsPosition) {
                            const { lat: uLat, lng: uLng } = gpsPosition;
                            // 60m detection radius — must be physically at the gym
                            const DETECT_M = 60;

                            const nearby = gyms
                                .filter(g => g.lat && g.lng)
                                .map(g => ({ g, distM: haversineDistance(uLat, uLng, g.lat!, g.lng!) }))
                                .filter(({ distM }) => distM <= DETECT_M)
                                .sort((a, b) => a.distM - b.distM);

                            const nearbyDefaults = nearby.filter(({ g }) => g.is_home_base);
                            const nearbyOthers   = nearby.filter(({ g }) => !g.is_home_base);

                            if (nearbyDefaults.length === 1) {
                                // R3, R5: exactly one predeterminado nearby → auto-select silently
                                const { g, distM } = nearbyDefaults[0];
                                if (g.gym_id !== resolvedInitialGymId) {
                                    setDetectedGymName(g.gym_name);
                                    setResolvedGymId(g.gym_id);
                                    const [newItems, newRoutines] = await Promise.all([
                                        equipmentService.getInventory(g.gym_id),
                                        workoutService.getUserRoutines(userId, g.gym_id),
                                    ]);
                                    setRoutines(newRoutines);
                                    setArsenal(prev => {
                                        const merged = [...newItems, ...prev];
                                        return Array.from(new Map(merged.map(i => [i.id, i])).values());
                                    });
                                }
                                console.log(`✅ Predeterminado detectado: ${g.gym_name} (${Math.round(distM)}m)`);

                            } else if (nearbyDefaults.length > 1) {
                                // R7: multiple predeterminados nearby → picker (does NOT auto-save)
                                setAmbiguousReason('multiple_defaults');
                                setAmbiguousGyms(nearbyDefaults.map(({ g, distM }) => toPickerShape(g, distM, false)));

                            } else if (nearbyOthers.length >= 1) {
                                if (homeGym) {
                                    // El usuario YA tiene un predeterminado (aunque no esté cerca hoy).
                                    // Regla de unicidad: jamás se reasigna por proximidad — solo
                                    // se ofrece elegir dónde entrenar HOY, sin tocar el predeterminado.
                                    setAmbiguousReason('pick_for_today');
                                    setAmbiguousGyms(nearbyOthers.map(({ g, distM }) => toPickerShape(g, distM, false)));
                                } else {
                                    // R4: el usuario no tiene NINGÚN predeterminado →
                                    // flujo de "primera vez": el gimnasio elegido se guarda como predeterminado.
                                    setAmbiguousReason('no_default');
                                    setAmbiguousGyms(nearbyOthers.map(({ g, distM }) => toPickerShape(g, distM, true)));
                                }

                            } else {
                                // No passport gym within 60 m — always free workout.
                                // Never fall back to a home gym that is far away; proximity is required.
                                setDetectedGymName('Entrenamiento Libre');
                                setResolvedGymId(null);
                            }
                        } else {
                            // GPS unavailable — cannot verify proximity, default to free workout.
                            setDetectedGymName('Entrenamiento Libre');
                            setResolvedGymId(null);
                        }
                    } catch (err) {
                        console.warn('Phase 3 GPS error:', err);
                        // GPS failed — cannot determine location, use free workout.
                        setDetectedGymName('Entrenamiento Libre');
                        setResolvedGymId(null);
                    }
                })();
            }

            const handleSelectAmbiguousGym = async (gym: any) => {
                try {
                    // Ensure it's in passport (safety guard)
                    if (!gyms.some(g => g.gym_id === gym.id)) {
                        await userService.addGymToPassport(user!.id, {
                            place_id: gym.place_id,
                            name: gym.name,
                            address: gym.address || '',
                            location: { lat: gym.lat, lng: gym.lng }
                        });
                    }

                    // R4: if this picker appeared because there's no default nearby,
                    // save the selected gym as the new predeterminado
                    if (gym.saveAsDefault) {
                        await userService.toggleHomeBase(user!.id, gym.id, true);
                        console.log(`⭐ Guardado como predeterminado: ${gym.name}`);
                    }

                    setDetectedGymName(gym.name || '');
                    setResolvedGymId(gym.id);
                    setAmbiguousGyms([]);
                    setAmbiguousReason(null);

                    // Hot-swap inventory and routines
                    const [newItems, newRoutines] = await Promise.all([
                        equipmentService.getInventory(gym.id),
                        workoutService.getUserRoutines(user!.id, gym.id)
                    ]);

                    setRoutines(newRoutines);
                    setArsenal(prev => {
                        const combined = [...newItems, ...prev];
                        return Array.from(new Map(combined.map(item => [item.id, item])).values());
                    });
                } catch (err) {
                    console.error("Error setting ambiguous gym", err);
                }
            };

            // Attach to window or state for the JSX to access
            (window as any).__handleSelectAmbiguousGym = handleSelectAmbiguousGym;

            // 3. Restore or Start Logic
            const active = activeResult.data;

            // 🛡️ Age guard: never restore a session that is too old.
            // Room sessions expire after 5 hours — this matches the "room active until all leave
            // or 5 hours" rule. Solo sessions get a 4-hour window.
            const isActiveMultiplayer = active?.is_multiplayer === true;
            const SESSION_MAX_RESTORE_MS = isActiveMultiplayer
                ? 5 * 60 * 60 * 1000   // 5 hours for rooms
                : 4 * 60 * 60 * 1000;  // 4 hours for solo
            const activeAge = active ? Date.now() - new Date(active.started_at).getTime() : Infinity;
            const isTooOldToRestore = activeAge > SESSION_MAX_RESTORE_MS;

            if (active && isTooOldToRestore) {
                console.warn(`⚠️ Sesión activa demasiado antigua (${(activeAge / 60000).toFixed(0)} min) — cerrando y descartando.`);
                localStorage.removeItem(`workout_draft_${active.id}`);
                localStorage.removeItem('ginx_coop_state');
                await workoutService.finishSession(active.id, 'Cierre automático: límite de 5 horas');
            }

            const navState = location.state as any || {};
            const forceNewSession = navState.forceNewSession === true;
            // Guests normally don't restore (to avoid re-loading a stale solo session when joining a new room).
            // Exception: when a guest explicitly returns to their OWN active coop session via the rescue modal
            // (navState carries the same sessionId as the active session and forceNewSession is false).
            const isGuestReturning = currentIsMultiplayer && !currentIsInviter
                && navState.sessionId
                && active
                && navState.sessionId === active.id
                && navState.forceNewSession !== true; // false or undefined both mean "restore"
            const shouldRestore = active && !isTooOldToRestore && !forceNewSession && (isGuestReturning || !(currentIsMultiplayer && !currentIsInviter));

            if (shouldRestore) {
                setSessionId(active.id);
                setStartTime(new Date(active.started_at));

                // Upgrade solo session to multiplayer in DB when host accepts invite while training
                if (currentIsMultiplayer && !active.is_multiplayer && currentPartnerId) {
                    supabase.from('workout_sessions').update({
                        is_multiplayer: true,
                        partner_id: currentPartnerId
                    }).eq('id', active.id).catch(e => console.warn('Failed to upgrade session to multiplayer:', e));
                }

                // If active session has a gym_id and it is different from targetGymId, re-fetch items and routines
                let currentItems = items;
                if (active.gym_id && active.gym_id !== targetGymId) {
                    setResolvedGymId(active.gym_id);
                    const activeGym = gyms.find(g => g.gym_id === active.gym_id);
                    if (activeGym) {
                        setDetectedGymName(activeGym.gym_name || '');
                    }
                    
                    try {
                        const [newItems, newRoutines] = await Promise.all([
                            equipmentService.getInventory(active.gym_id),
                            workoutService.getUserRoutines(userId, active.gym_id)
                        ]);
                        setRoutines(newRoutines);
                        currentItems = newItems;
                        const merged = [...newItems, ...personalItems.filter(i => !newItems.some(existing => existing.id === i.id))];
                        setArsenal(merged);
                    } catch (e) {
                        console.error("Error re-fetching active gym data:", e);
                    }
                } else if (!active.gym_id) {
                    setResolvedGymId(null);
                    setDetectedGymName("Entrenamiento Libre");
                }

                // If we are already training in this exact session, DO NOT re-hydrate it
                // to prevent losing unsaved exercises/routines currently active in our React state.
                if (sessionIdRef.current === active.id && activeExercisesRef.current.length > 0) {
                    console.log("🚀 [Preserve State] We are already in this session with exercises loaded. Skipping hydration.");
                    setLoading(false);
                } else {
                    // Hydrate from Draft or DB
                    const savedDraft = localStorage.getItem(`workout_draft_${active.id}`);
                    if (savedDraft) {
                        const parsed = JSON.parse(savedDraft);
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            // 🛡️ Sanitize ghost rest timers BEFORE hydrating state
                            setActiveExercises(sanitizeRestTimers(parsed.exercises || []));
                            if (parsed.routineName) setCurrentRoutineName(parsed.routineName);
                            if (parsed.originalIds) setOriginalExerciseIds(parsed.originalIds);
                            if (parsed.isRoutineModified !== undefined) setIsRoutineModified(parsed.isRoutineModified);
                        } else {
                            setActiveExercises(sanitizeRestTimers(Array.isArray(parsed) ? parsed : []));
                        }
                        setLoading(false);
                    } else {
                        // No localStorage draft — try DB session_state first (browser-independent,
                        // survives tab close on a different device / cleared cache).
                        const { data: stateRow } = await supabase
                            .from('workout_sessions')
                            .select('session_state')
                            .eq('id', active.id)
                            .maybeSingle();
                        const dbDraft = (stateRow as any)?.session_state;
                        if (dbDraft?.exercises?.length > 0) {
                            setActiveExercises(sanitizeRestTimers(dbDraft.exercises));
                            if (dbDraft.routineName) setCurrentRoutineName(dbDraft.routineName);
                            if (dbDraft.originalIds) setOriginalExerciseIds(dbDraft.originalIds);
                            if (dbDraft.isRoutineModified !== undefined) setIsRoutineModified(dbDraft.isRoutineModified);
                            setLoading(false);
                        } else {
                        // Last resort: reconstruct from committed logs (only completed sets survive here)
                        const logs = await workoutService.getSessionLogs(active.id);
                        if (logs && logs.length > 0) {
                            const restoredExercises: WorkoutExercise[] = [];
                            const exerciseMap = new Map<string, WorkoutExercise>();

                            logs.forEach((log: any) => {
                                const exName = log.exercise?.name || 'Unknown Exercise';
                                const exId = log.exercise_id;
                                const equipItem = currentItems.find(i => normalizeText(i.name) === normalizeText(exName));
                                const defaultMetrics = { weight: true, reps: true, time: false, distance: false, rpe: false };

                                let exercise = exerciseMap.get(exId);
                                if (!exercise) {
                                    exercise = {
                                        id: Math.random().toString(),
                                        equipmentId: equipItem?.id || exId,
                                        equipmentName: exName,
                                        metrics: (equipItem?.metrics || defaultMetrics) as any,
                                        sets: [],
                                        category: log.category_snapshot || equipItem?.target_muscle_group || 'Custom'
                                    };
                                    exerciseMap.set(exId, exercise);
                                    restoredExercises.push(exercise);
                                }

                                exercise.sets.push({
                                    id: Math.random().toString(),
                                    weight: log.weight_kg || 0,
                                    reps: log.reps || 0,
                                    time: log.time || 0,
                                    distance: log.distance || 0,
                                    rpe: log.rpe || 0,
                                    custom: log.metrics_data || {},
                                    completed: true,
                                    restStatus: 'completed',
                                    restAccumulated: 0,
                                    restLastStartTime: undefined,
                                    p2_restStatus: 'completed',
                                    p2_restAccumulated: 0,
                                    p2_restLastStartTime: undefined,
                                    playerRestStatus: {},
                                    playerRestAccumulated: {},
                                    playerRestLastStartTime: {}
                                });
                            });
                            setActiveExercises(restoredExercises);
                        } else if (!currentIsMultiplayer && activeExercisesRef.current.length === 0) {
                            // Only open catalog automatically in solo mode AND if exercises are truly absent.
                            // In multiplayer the host's exercises come from the catalog selection flow,
                            // and the guest's come from sync_state — never open the catalog as a side effect.
                            setShowAddModal(true);
                        }
                        } // end: last-resort log reconstruction
                    }
                }
        } else {
                const partnerActive = partnerActiveResult?.data;
                const isJoiningNewCoop = currentIsMultiplayer && !currentIsInviter && partnerActive && (
                    !active || active.partner_session_id !== partnerActive.id
                );

                // If there was a stale active session but we are joining a multiplayer session, finish it first
                if (active && (forceNewSession || isJoiningNewCoop)) {
                    console.log("🧹 Finishing stale active session before joining multiplayer:", active.id);
                    localStorage.removeItem(`workout_draft_${active.id}`);
                    await workoutService.finishSession(active.id, "Stale session auto-closed to join multiplayer");
                }

                // Clear any other global state files preventatively on forced new session or new coop join
                if (forceNewSession || isJoiningNewCoop) {
                    console.log("🧹 [Coop Cleanup] Purging stale local draft keys to prevent ghost data leak on new session");
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem('workout_session_state');
                    localStorage.removeItem('ginx_coop_state');
                    setActiveExercises([]);
                    setCurrentRoutineName('');
                    setOriginalExerciseIds([]);
                    setIsRoutineModified(false);
                }

                // Starting a fresh session: reset any stale cached multiplayer flags.
                // CRITICAL guards — never reset if:
                //   1. navState explicitly carries multiplayer (joining from notification)
                //   2. There are already exercises loaded (user is mid-session)
                //   3. ginx_coop_state is in localStorage (valid coop session still active)
                // Resetting mid-session would make the summary think it's a solo session,
                // hiding all partner data and triggering the exercise catalog (ghost flash).
                const navState = location.state as any || {};
                const hasCachedCoop = !!localStorage.getItem('ginx_coop_state');
                const hasActiveExercises = activeExercisesRef.current.length > 0;
                if (!navState.isMultiplayer && !hasCachedCoop && !hasActiveExercises) {
                    setIsMultiplayer(false);
                    setMultiplayerMode(null);
                    setPartnerId(null);
                    setChatId(null);
                    setIsInviter(true);
                    isInviterRef.current = true;
                    localStorage.removeItem('ginx_coop_state');
                }

                const routineIdParam = searchParams.get('routineId');
                const autoRoutine = routineIdParam ? localRoutines.find(r => r.id === routineIdParam) : null;

                if (autoRoutine) {
                    console.log("⚡ Auto-loading routine from search parameter:", autoRoutine.name);
                    setCurrentRoutineName(autoRoutine.name);
                    const result = await startNewSession(targetGymId || undefined, undefined, currentIsMultiplayer, currentMultiplayerMode, currentPartnerId);
                    await loadRoutine(autoRoutine, result?.freshArsenal || mergedInventory);
                } else {
                    // Check if partner has an active session.
                    // For 3rd+ participants joining a room where the host already finished:
                    // partnerActiveResult might be null (host's session has finished_at set).
                    // In that case, we still need to start a session using the room ID from navState.
                    let partnerActive = partnerActiveResult?.data;

                    // Fallback: if the direct partner session is not found but navState has a room ID
                    // (chatId or partnerSessionId), the host may have already left — query the room session
                    // directly so the guest can still join the room and sync with remaining participants.
                    if (!partnerActive && currentIsMultiplayer && !currentIsInviter) {
                        const roomIdFromNav = navState.partnerSessionId || navState.chatId || chatId;
                        if (roomIdFromNav) {
                            const { data: roomSess } = await supabase
                                .from('workout_sessions')
                                .select('id, user_id, gym_id, started_at, partner_id, is_multiplayer')
                                .eq('id', roomIdFromNav)
                                .maybeSingle();
                            if (roomSess) {
                                console.log('🔗 Host session already finished — using room ID from nav state:', roomIdFromNav);
                                partnerActive = roomSess;
                            }
                        }
                    }

                    if (partnerActive) {
                        console.log("🔗 Found active partner session on init:", partnerActive.id);
                        partnerSessionIdRef.current = partnerActive.id;
                        setPartnerSessionId(partnerActive.id);

                        if (partnerActive.partner_id) {
                            setFirstGuestId(partnerActive.partner_id);
                        }

                        if (currentIsMultiplayer && currentMultiplayerMode === 'conjunto' && !currentIsInviter) {
                            // Flag: keep loading=true until sync_state arrives with exercises
                            waitingForGuestSyncRef.current = true;
                            console.log('🚀 Guest auto-starting session because partner has active session...');
                            await startNewSession(partnerActive.gym_id || undefined, partnerActive.id, currentIsMultiplayer, currentMultiplayerMode, currentPartnerId);
                            setStartTime(new Date(partnerActive.started_at));

                            // ─── RE-REQUEST HYDRATION AFTER SESSION START ────────────────────────────
                            // startNewSession() always resets activeExercises=[] (line ~2789).
                            // If the host had already broadcast sync_state before or during
                            // startNewSession (the common case: channel SUBSCRIBED fires ~100-500ms
                            // after mount, well before the multi-step DB calls in startNewSession
                            // complete), those exercises were silently wiped by the reset.
                            // Re-requesting here guarantees the host re-sends the room's current
                            // exercises now that the guest session is fully initialized and
                            // waitingForGuestSyncRef is still true, so the next arrival correctly
                            // releases loading AND populates activeExercises.
                            if (channelRef.current) {
                                console.log('🔄 [GuestSync] Re-requesting hydration after session start (post-reset safety)...');
                                channelRef.current.send({
                                    type: 'broadcast',
                                    event: 'request_hydration',
                                    payload: { sender: userId }
                                }).catch(e => console.error('Error re-requesting hydration after session start:', e));
                            }

                            // ─── BROADCAST GUEST SESSION ID ─────────────────────────────────────────
                            // startNewSession() set sessionIdRef.current synchronously (line ~2835).
                            // The channel's SUBSCRIBED callback only fires once (at subscribe time),
                            // when sessionId was still null — so it never sent sync_session_id.
                            // Sending it now ensures the host (and everyone else) receives it and
                            // updates their workout_sessions.partner_session_id column, which is what
                            // WorkoutDetailPage uses to load partner logs in the history view.
                            const newGuestSessionId = sessionIdRef.current;
                            if (newGuestSessionId && channelRef.current) {
                                console.log('🔗 [GuestSync] Broadcasting guest session ID to room:', newGuestSessionId);
                                channelRef.current.send({
                                    type: 'broadcast',
                                    event: 'sync_session_id',
                                    payload: {
                                        sessionId: newGuestSessionId,
                                        startTime: new Date(partnerActive.started_at).toISOString(),
                                        sender: userId
                                    }
                                }).catch(e => console.error('Error broadcasting guest session ID:', e));
                            }

                            // Failsafe: release loading after 12 seconds even if sync_state never arrives.
                            // Without this, if the host has no exercises or is disconnected, the guest
                            // is stuck on a blank loading screen indefinitely.
                            if (guestSyncTimeoutRef.current) clearTimeout(guestSyncTimeoutRef.current);
                            guestSyncTimeoutRef.current = setTimeout(() => {
                                if (waitingForGuestSyncRef.current) {
                                    console.warn('⏰ [GuestSync] No sync_state received in 12s — releasing loading.');
                                    waitingForGuestSyncRef.current = false;
                                    setLoading(false);
                                }
                            }, 12000);
                        }
                    // Prompt for exercises/routine in solo mode OR when host has no active session yet.
                    // Guests in multiplayer mode wait for the host's sync_state instead.
                    } else if (activeExercisesRef.current.length === 0 && (!currentIsMultiplayer || currentIsInviter)) {
                        if (localRoutines.length === 0) setShowAddModal(true);
                        else setShowStartOptionsModal(true);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error initializing battle:', error);
            waitingForGuestSyncRef.current = false; // release on error so UI isn't stuck
        } finally {
            // Guest stays in loading=true until host's sync_state arrives (handled above).
            if (!waitingForGuestSyncRef.current) {
                setLoading(false);
            }
        }
    };

    const getClosestGymIdFromGPS = async (userId: string): Promise<{ id: string; name: string } | null> => {
        try {
            console.log("🎯 Adquiriendo GPS en tiempo real para inicio de entrenamiento...");
            const gpsPosition = await getCurrentPosition({ enableHighAccuracy: true, timeout: 1500 })
                .catch(async () => {
                    console.log("⚠️ GPS de alta precisión falló o timeout, intentando rápido...");
                    return await getCurrentPosition({ enableHighAccuracy: false, timeout: 1000 });
                });

            if (!gpsPosition) {
                console.warn("❌ GPS no disponible.");
                return null;
            }

            const userLat = gpsPosition.lat;
            const userLng = gpsPosition.lng;

            // Fetch user gyms and all system gyms
            const [gyms, allGyms] = await Promise.all([
                userService.getUserGyms(userId),
                userService.getAllGyms()
            ]);

            // Calculate distance to all gyms using shared haversineDistance (meters)
            const gymsWithDistance = allGyms
                .filter(g => g.lat && g.lng)
                .map(g => ({
                    ...g,
                    dist: haversineDistance(userLat, userLng, g.lat, g.lng), // meters
                }))
                .filter(g => g.dist <= 500) // 500m radius
                .sort((a, b) => a.dist - b.dist);

            if (gymsWithDistance.length > 0) {
                const closestGym = gymsWithDistance[0];
                console.log(`🎯 Ubicación confirmada en: ${closestGym.name} (${Math.round(closestGym.dist)}m)`);

                // Auto-add to passport if not already registered
                if (!gyms.some(g => g.gym_id === closestGym.id)) {
                    console.log(`✈️ Agregando ${closestGym.name} al pasaporte de forma automática...`);
                    await userService.addGymToPassport(userId, {
                        place_id: closestGym.place_id,
                        name: closestGym.name,
                        address: closestGym.address || '',
                        location: { lat: closestGym.lat, lng: closestGym.lng }
                    });
                }

                return { id: closestGym.id, name: closestGym.name };
            }
        } catch (e) {
            console.error("Error in getClosestGymIdFromGPS:", e);
        }
        return null;
    };

    const startNewSession = async (
        customGymId?: string, 
        forcePartnerSessionId?: string,
        overrideIsMultiplayer?: boolean,
        overrideMultiplayerMode?: string | null,
        overridePartnerId?: string | null
    ): Promise<{ gymId: string | null; freshArsenal?: any[] }> => {
        if (!user) return { gymId: null };
        if (isStartingSessionRef.current) {
            console.log("⚠️ startNewSession already in progress, ignoring duplicate call");
            return { gymId: null };
        }
        isStartingSessionRef.current = true;
        setLoading(true);
        try {
            console.log("🚀 Starting NEW Session explicitly...");

            // Clear the deleted-exercise filter so re-added exercises from a previous
            // session don't get permanently blocked in the new session's CRDT merge.
            deletedExerciseIdsRef.current.clear();

            // Clean active exercise state completely before beginning new session
            setActiveExercises([]);
            setCurrentRoutineName('');
            setOriginalExerciseIds([]);
            setIsRoutineModified(false);
            
            let finalGymId = customGymId || resolvedGymId;
            let freshArsenal: any[] | undefined = undefined;

            const finalIsMultiplayer = overrideIsMultiplayer ?? isMultiplayer;
            const finalMultiplayerMode = overrideMultiplayerMode ?? multiplayerMode;
            const finalPartnerId = overridePartnerId ?? partnerId;

            console.log("📍 GPS already resolved or pre-selected. Using finalGymId:", finalGymId);
            console.log("📡 [startNewSession] Argumentos para startSession:", {
                userId: user.id,
                finalGymId,
                isMultiplayer: finalIsMultiplayer,
                multiplayerMode: finalMultiplayerMode,
                partnerId: finalPartnerId,
                forcePartnerSessionId,
                partnerSessionId,
                finalPartnerSessionId: forcePartnerSessionId || partnerSessionId || undefined
            });

            // 🧹 Automatic prevention: Clean any ghost sessions before starting, then
            // purge their localStorage draft keys so stale data can't leak back in.
            const orphanIds = await workoutService.cleanOrphanSessions(user.id);
            orphanIds.forEach(id => localStorage.removeItem(`workout_draft_${id}`));

            const { data: newSession, error: startError } = await workoutService.startSession(
                user.id, 
                finalGymId || undefined,
                finalIsMultiplayer,
                finalMultiplayerMode || undefined,
                finalPartnerId || undefined,
                forcePartnerSessionId || partnerSessionId || undefined
            );
            
            console.log("📡 [startNewSession] Respuesta de startSession:", { newSession, startError });

            if (startError) throw startError;

            // Clear local backup on success
            localStorage.removeItem(STORAGE_KEY);

            if (newSession) {
                sessionIdRef.current = newSession.id;
                setSessionId(newSession.id);
                setStartTime(new Date());
                setElapsedTime("00:00");
                setIsFinished(false);
                console.log('✅ Session started:', newSession.id);
            }

            return { gymId: finalGymId, freshArsenal };
        } catch (err) {
            console.error("Error starting session:", err);
            alert("Error al iniciar sesión. Intenta nuevamente.");
            return { gymId: null };
        } finally {
            setLoading(false);
            isStartingSessionRef.current = false;
        }
    };

    const loadRoutine = async (routine: any, freshArsenal?: any[]) => {
        if (!routine.equipment_ids || routine.equipment_ids.length === 0) return;

        setLoading(true); // Show loading while preparing routine
        const activeArsenal = freshArsenal || arsenal;

        // Map Routine IDs to Actual Inventory Items
        const exercisesToAdd: WorkoutExercise[] = [];
        const missingExercises: string[] = [];

        const details = routine.routine_exercises || [];

        // Helper to get default metrics
        const defaultMetrics = { weight: true, reps: true, time: false, distance: false, rpe: false };

        // Helper to normalize names for better matching
        const normalizeName = (name: string) => {
            return name
                .toLowerCase()
                .trim()
                .normalize('NFD') // Decompose accented characters
                .replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[^a-z0-9\s]/g, '') // Remove special characters
                .replace(/\s+/g, ' '); // Normalize spaces
        };

        if (details.length > 0) {
            details.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)).forEach((detail: any) => {
                // 1. Try Strict ID Match
                let item = activeArsenal.find(i => i.id === detail.exercise_id);

                // 2. Fallback: Normalized Name Match
                if (!item && detail.equipment?.name) {
                    const targetName = normalizeName(detail.equipment.name);
                    item = activeArsenal.find(i => normalizeName(i.name) === targetName);
                }

                // 3. Fallback: Partial Name Match (fuzzy)
                if (!item && detail.equipment?.name) {
                    const targetName = normalizeName(detail.equipment.name);
                    item = activeArsenal.find(i => {
                        const itemName = normalizeName(i.name);
                        return itemName.includes(targetName) || targetName.includes(itemName);
                    });
                }

                if (item) {
                    // DEBUG: Log the raw detail object from DB
                    console.log(`📋 RAW DETAIL from DB for ${item.name}:`, {
                        track_weight: detail.track_weight,
                        track_reps: detail.track_reps,
                        track_time: detail.track_time,
                        track_distance: detail.track_distance,
                        track_rpe: detail.track_rpe,
                        custom_metric: detail.custom_metric,
                        equipment_metrics: detail.equipment?.metrics
                    });

                    // CRITICAL FIX: equipment.metrics from DB should have HIGHEST priority
                    const baseMetrics = {
                        ...defaultMetrics, // Start with defaults
                        ...(item.metrics || {}), // Local inventory override
                        ...(detail.equipment?.metrics || {}), // DB JSONB has HIGHEST priority (custom metrics here!)
                    };

                    console.log(`🔧 Base Metrics After Merge:`, baseMetrics);

                    // Start with baseMetrics (includes ALL metrics from equipment.metrics)
                    const metrics = {
                        ...baseMetrics, // Preserve ALL metrics including custom ones
                    };

                    // Override ONLY the 5 standard metrics if routine has specific settings
                    if (detail.track_weight !== undefined) metrics.weight = detail.track_weight;
                    if (detail.track_reps !== undefined) metrics.reps = detail.track_reps;
                    if (detail.track_time !== undefined) metrics.time = detail.track_time;
                    if (detail.track_distance !== undefined) metrics.distance = detail.track_distance;
                    if (detail.track_rpe !== undefined) metrics.rpe = detail.track_rpe;

                    // Add custom metric from routine if exists
                    if (detail.custom_metric) {
                        // @ts-expect-error - ignore typing
                        metrics[detail.custom_metric] = true;
                        console.log(`✨ Added Custom Routine Metric: ${detail.custom_metric}`);
                    }

                    console.log(`✅ FINAL METRICS FOR ${item.name}:`, metrics);
                    console.log(`📊 Custom Metrics Count: ${Object.keys(metrics).filter(k => !['weight', 'reps', 'time', 'distance', 'rpe'].includes(k)).length}`);

                    // Initialize custom metrics
                    const customMetrics: Record<string, number> = {};
                    // Type cast metrics to any to iterate safely since it's a flexible object
                    const metricsObj = metrics as any || {};

                    Object.keys(metricsObj).forEach(mid => {
                        if (!['weight', 'reps', 'time', 'distance', 'rpe'].includes(mid) && metricsObj[mid]) {
                            customMetrics[mid] = 0;
                            console.log(`🎯 Initialized custom metric "${mid}" in set.custom object`);
                        }
                    });


                    exercisesToAdd.push({
                        id: Math.random().toString(),
                        equipmentId: item.id,
                        equipmentName: item.name,
                        metrics: metrics as any, // Cast to any to fix TS error
                        sets: [{
                            id: Math.random().toString(),
                            weight: 0,
                            reps: 0,
                            custom: customMetrics,
                            completed: false
                        }],
                        category: item.target_muscle_group || item.category || 'Custom'
                    });
                } else {
                    // FALLBACK: Ghost Exercise (Not in local inventory, but exists in routine)
                    // We allow it to run so the user can workout anywhere.
                    const ghostName = detail.equipment?.name || detail.name || 'Ejercicio Externo';
                    console.log(`👻 Creating Ghost Exercise: ${ghostName}`, detail);
                    console.log(`👻 detail.equipment FULL OBJECT:`, detail.equipment);
                    console.log(`👻 detail.equipment?.metrics:`, detail.equipment?.metrics);
                    console.log(`👻 Is detail.equipment?.metrics truthy?`, !!detail.equipment?.metrics);

                    // FIX: Respect Routine Configuration even for Ghosts
                    const baseMetrics = detail.equipment?.metrics || defaultMetrics;
                    console.log(`👻 baseMetrics selected:`, baseMetrics);

                    // Start with baseMetrics (includes ALL metrics from equipment.metrics)
                    const ghostMetrics = {
                        ...baseMetrics, // Preserve ALL metrics including custom ones
                    };

                    // Override ONLY the 5 standard metrics if routine has specific settings
                    if (detail.track_weight !== undefined) ghostMetrics.weight = detail.track_weight;
                    if (detail.track_reps !== undefined) ghostMetrics.reps = detail.track_reps;
                    if (detail.track_time !== undefined) ghostMetrics.time = detail.track_time;
                    if (detail.track_distance !== undefined) ghostMetrics.distance = detail.track_distance;
                    if (detail.track_rpe !== undefined) ghostMetrics.rpe = detail.track_rpe;

                    // Add custom metric from routine if exists
                    if (detail.custom_metric) {

                        ghostMetrics[detail.custom_metric] = true;
                        console.log(`👻 Added Custom Metric to Ghost Exercise: ${detail.custom_metric}`);
                    }

                    console.log(`👻 FINAL GHOST METRICS FOR ${ghostName}:`, ghostMetrics);

                    // Initialize custom metrics
                    const customMetrics: Record<string, number> = {};
                    // @ts-expect-error - ignore typing
                    const metricsObj = ghostMetrics as any || {};

                    Object.keys(metricsObj).forEach(mid => {
                        if (!['weight', 'reps', 'time', 'distance', 'rpe'].includes(mid) && metricsObj[mid]) {
                            customMetrics[mid] = 0;
                            console.log(`👻 Initialized ghost custom metric "${mid}"`);
                        }
                    });

                    exercisesToAdd.push({
                        id: Math.random().toString(),
                        equipmentId: detail.exercise_id || Math.random().toString(),
                        equipmentName: ghostName,
                        metrics: ghostMetrics as any,
                        sets: [{
                            id: Math.random().toString(),
                            weight: 0,
                            reps: 0,
                            custom: customMetrics,
                            completed: false
                        }],
                        category: detail.equipment?.target_muscle_group || 'General'
                    });
                }
            });
        } else {
            // Fallback IDs only
            routine.equipment_ids.forEach((eqId: string) => {
                const item = activeArsenal.find(i => i.id === eqId);
                if (item) {
                    exercisesToAdd.push({
                        id: Math.random().toString(),
                        equipmentId: item.id,
                        equipmentName: item.name,
                        metrics: (item.metrics || defaultMetrics) as any,
                        sets: [{ id: Math.random().toString(), weight: 0, reps: 0, completed: false }],
                        category: item.target_muscle_group || item.category || 'Custom'
                    });
                } else {
                    missingExercises.push(`Ejercicio ID: ${eqId}`);
                }
            });
        }

        if (exercisesToAdd.length > 0) {
            // 👻 GHOST SYSTEM: Fetch last session's sets for all added routine exercises!
            const hydratedExercises = await Promise.all(exercisesToAdd.map(async (ex) => {
                if (user && ex.equipmentId) {
                    const logs = await workoutService.getGhostSets(ex.equipmentId, user.id);
                    if (logs && logs.length > 0) {
                        const ghostSets = logs.map(log => ({
                            id: Math.random().toString(),
                            weight: log.weight_kg || 0,
                            reps: log.reps || 0,
                            time: log.time || 0,
                            distance: log.distance || 0,
                            rpe: log.rpe || 0,
                            custom: log.metrics_data || {},
                            completed: false
                        }));
                        ex.sets = ghostSets;
                    }
                }
                return ex;
            }));

            setActiveExercises(hydratedExercises);
            setOriginalExerciseIds(hydratedExercises.map(ex => ex.equipmentId)); // Store original IDs for "Smart Skip"
            setOriginalMetricsSnapshot(JSON.stringify(hydratedExercises.map(ex => ex.metrics))); // Snapshot metrics
            setIsRoutineModified(false); // Clean loaded routine from template

            // Show warning if some exercises are missing, but allow continuing
            if (missingExercises.length > 0) {
                const missingList = missingExercises.join(', ');
                alert(`⚠️ Algunos ejercicios no están en este gimnasio:\n\n${missingList}\n\nPuedes continuar con los ${exercisesToAdd.length} ejercicios disponibles o agregar los faltantes a tu Arsenal.`);
            }
        } else {
            console.warn("No matching exercises found in this gym's arsenal.");
            const missingList = missingExercises.length > 0 ? `\n\nEjercicios faltantes:\n${missingExercises.join('\n')}` : '';
            alert(`⚠️ No se encontraron ejercicios de esta rutina en este gimnasio.${missingList}\n\nAgrega estos ejercicios a tu Arsenal Local para poder usar esta rutina.`);
        }

        setLoading(false);
    };

    const removeExercise = (id: string) => {
        deletedExerciseIdsRef.current.add(id);
        setActiveExercises(prev => prev.filter(e => e.id !== id));
        setIsRoutineModified(true);
        // Broadcast immediately (bypass the 500ms debounce) so partners remove it right away
        if (isMultiplayer && channelRef.current && user) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'remove_exercise',
                payload: { exerciseId: id, sender: user.id }
            }).catch(e => console.error('Error broadcasting exercise removal:', e));
        }
    };

    const updateSet = (exerciseIndex: number, setIndex: number, field: string, value: string | number, isCustom: boolean = false) => {
        const updated = [...activeExercises];
        const val = typeof value === 'string' ? parseFloat(value) : value;

        if (isCustom) {
            if (!updated[exerciseIndex].sets[setIndex].custom) {
                updated[exerciseIndex].sets[setIndex].custom = {};
            }
            updated[exerciseIndex].sets[setIndex].custom![field] = isNaN(val) ? 0 : val;
        } else {
            // @ts-expect-error - ignore typing
            updated[exerciseIndex].sets[setIndex][field] = isNaN(val) ? 0 : val;
        }

        // CRDT: Update modification timestamp
        updated[exerciseIndex].sets[setIndex].lastUpdatedAt = Date.now();

        setActiveExercises(updated);
    };

    // [NEW] Auto-complete when leaving input if all data is filled
    const handleInputBlur = (exerciseIndex: number, setIndex: number, isP1: boolean, e: React.FocusEvent<HTMLInputElement>) => {
        // Prevent auto-completion if the user is just clicking another input
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (relatedTarget && relatedTarget.tagName === 'INPUT') {
            return;
        }

        const exercise = activeExercises[exerciseIndex];
        if (!exercise) return;
        const set = exercise.sets[setIndex];
        if (!set) return;

        const isCompleted = isP1 ? set.completed : (set.p2_completed || false);
        if (isCompleted) return;

        let isComplete = true;
        let hasAnyMetric = false;

        if (exercise.metrics.weight) {
            hasAnyMetric = true;
            const weightVal = isP1 ? set.weight : set.p2_weight;
            if (weightVal === undefined || weightVal <= 0) isComplete = false;
        }
        if (exercise.metrics.reps) {
            hasAnyMetric = true;
            const repsVal = isP1 ? set.reps : set.p2_reps;
            if (repsVal === undefined || repsVal <= 0) isComplete = false;
        }
        if (exercise.metrics.time) {
            hasAnyMetric = true;
            const timeVal = isP1 ? set.time : set.p2_time;
            if (timeVal === undefined || timeVal <= 0) isComplete = false;
        }
        if (exercise.metrics.distance) {
            hasAnyMetric = true;
            const distanceVal = isP1 ? set.distance : set.p2_distance;
            if (distanceVal === undefined || distanceVal <= 0) isComplete = false;
        }
        if (exercise.metrics.rpe) {
            hasAnyMetric = true;
            const rpeVal = isP1 ? set.rpe : set.p2_rpe;
            if (rpeVal === undefined || rpeVal <= 0) isComplete = false;
        }

        Object.keys(exercise.metrics).forEach(key => {
            if (['weight', 'reps', 'time', 'distance', 'rpe'].includes(key)) return;
            if (exercise.metrics[key as keyof typeof exercise.metrics]) {
                hasAnyMetric = true;
                if (!set.custom || set.custom[key] === undefined || set.custom[key] <= 0) isComplete = false;
            }
        });

        if (isComplete && hasAnyMetric) {
            toggleComplete(exerciseIndex, setIndex, isP1);
        }
    };

    // [NEW] Handle Enter key to trigger blur
    const handleInputKeyDown = (exerciseIndex: number, setIndex: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    // [NEW] Remove Single Set (Fixed Immutability & Logic)
    const removeSet = (exerciseIndex: number, setIndex: number) => {
        // Deep copy needed for safety
        const updatedExercises = activeExercises.map(ex => ({
            ...ex,
            sets: ex.sets.map(s => ({ ...s }))
        }));

        // 1. Capture set ID and exercise ID before splicing (needed for broadcast & CRDT guard)
        const targetSet = updatedExercises[exerciseIndex].sets[setIndex];
        const setId = targetSet?.id as string | undefined;
        const exerciseId = updatedExercises[exerciseIndex].id;

        // Track the deleted set ID so CRDT merge cannot re-add it from a stale sync_state
        if (setId) {
            deletedSetIdsRef.current.add(setId);
        }

        // 2. Check if we need to resume the PREVIOUS set's timer
        if (setIndex > 0) {
            const prevSet = updatedExercises[exerciseIndex].sets[setIndex - 1];
            // If prev set was blocking (completed state), resume it
            if (prevSet) {
                if (prevSet.completed && prevSet.restStatus === 'completed') {
                    prevSet.restStatus = 'running';
                    prevSet.restLastStartTime = Date.now();
                }
                if (prevSet.p2_completed && prevSet.p2_restStatus === 'completed') {
                    prevSet.p2_restStatus = 'running';
                    prevSet.p2_restLastStartTime = Date.now();
                }
            }
        }

        updatedExercises[exerciseIndex].sets.splice(setIndex, 1);
        setActiveExercises(updatedExercises);

        // Broadcast immediately (bypass the debounce) so partners remove it right away
        if (isMultiplayer && channelRef.current && user && setId) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'remove_set',
                payload: { exerciseId, setId, sender: user.id }
            }).catch(e => console.error('Error broadcasting set removal:', e));
        }
    };

        // [NEW] Toggle Completion with Timestamp & Lock Logic (Deep Copy)
    const toggleComplete = (exerciseIndex: number, setIndex: number, isP1: boolean = true) => {
        // Deep Copy
        const updated = activeExercises.map(ex => ({
            ...ex,
            sets: ex.sets.map(s => ({ ...s }))
        }));

        const set = updated[exerciseIndex].sets[setIndex];

        if (isP1) {
            // 1. If Locked, Block Interaction
            if (set.locked && set.completed) {
                return;
            }

            if (set.completed) {
                // UNMARKING
                set.completed = false;
                // @ts-expect-error - ignore typing
                set.completedAt = undefined;
                // Reset Timer state
                set.restStatus = undefined;
                set.restAccumulated = 0;
                set.restLastStartTime = undefined;

                set.locked = false;

                // Clear legacy global timer
                if (restTimerSetKey === `${exerciseIndex}-${setIndex}`) {
                    setRestTimerSetKey(null);
                }

            } else {
                // MARKING COMPLETE
                set.completed = true;
                set.locked = true; // Auto-lock
                // @ts-expect-error - ignore typing
                set.completedAt = Date.now();

                // Start Rest Timer for THIS set
                set.restStatus = 'running';
                set.restLastStartTime = Date.now();
                set.restAccumulated = 0;

                // Set Legacy Global Timer (Visual backup)
                setRestTimerSetKey(`${exerciseIndex}-${setIndex}`);

                // FREEZE PREVIOUS TIMER
                let prevSetFound = false;
                for (let i = exerciseIndex; i >= 0; i--) {
                    const startJ = i === exerciseIndex ? setIndex - 1 : updated[i].sets.length - 1;
                    for (let j = startJ; j >= 0; j--) {
                        const prevSet = updated[i].sets[j];
                        if (prevSet.completed && prevSet.restStatus === 'running') {
                            // Stop it (Complete it)
                            const now = Date.now();
                            prevSet.restAccumulated = (prevSet.restAccumulated || 0) + (now - (prevSet.restLastStartTime || now));
                            prevSet.restStatus = 'completed';
                            prevSet.restLastStartTime = undefined;

                            prevSetFound = true;
                            break;
                        }
                    }
                    if (prevSetFound) break;
                }
            }
        } else {
            // P2 Logic
            if (set.p2_locked && set.p2_completed) {
                return;
            }

            if (set.p2_completed) {
                // UNMARKING
                set.p2_completed = false;
                set.p2_completedAt = undefined;
                set.p2_locked = false;

                // Reset P2 Timer state
                set.p2_restStatus = undefined;
                set.p2_restAccumulated = 0;
                set.p2_restLastStartTime = undefined;
            } else {
                // MARKING COMPLETE
                set.p2_completed = true;
                set.p2_locked = true;
                set.p2_completedAt = Date.now();

                // Start Rest Timer for P2
                set.p2_restStatus = 'running';
                set.p2_restLastStartTime = Date.now();
                set.p2_restAccumulated = 0;

                // FREEZE PREVIOUS TIMER FOR P2
                let prevSetFoundP2 = false;
                for (let i = exerciseIndex; i >= 0; i--) {
                    const startJ = i === exerciseIndex ? setIndex - 1 : updated[i].sets.length - 1;
                    for (let j = startJ; j >= 0; j--) {
                        const prevSet = updated[i].sets[j];
                        if (prevSet.p2_completed && prevSet.p2_restStatus === 'running') {
                            // Stop it (Complete it)
                            const now = Date.now();
                            prevSet.p2_restAccumulated = (prevSet.p2_restAccumulated || 0) + (now - (prevSet.p2_restLastStartTime || now));
                            prevSet.p2_restStatus = 'completed';
                            prevSet.p2_restLastStartTime = undefined;

                            prevSetFoundP2 = true;
                            break;
                        }
                    }
                    if (prevSetFoundP2) break;
                }
            }
        }
        setActiveExercises(updated);
    };

    const toggleLock = (exerciseIndex: number, setIndex: number, isP1: boolean = true) => {
        const updated = activeExercises.map(ex => ({
            ...ex,
            sets: ex.sets.map(s => ({ ...s }))
        }));

        const set = updated[exerciseIndex].sets[setIndex];

        if (isP1) {
            // Only toggle lock if completed
            if (set.completed) {
                set.locked = !set.locked;
                setActiveExercises(updated);
            }
        } else {
            if (set.p2_completed) {
                set.p2_locked = !set.p2_locked;
                setActiveExercises(updated);
            }
        }
    };

    // [NEW] Toggle Rest Timer Pause (Individual)
    const toggleTimerPause = (exerciseIndex: number, setIndex: number, isP1: boolean = true) => {
        const updated = activeExercises.map(ex => ({
            ...ex,
            sets: ex.sets.map(s => ({ ...s }))
        }));

        const set = updated[exerciseIndex].sets[setIndex];

        if (isP1) {
            if (!set.completed) return;

            if (set.restStatus === 'running') {
                // PAUSE IT
                const now = Date.now();
                set.restAccumulated = (set.restAccumulated || 0) + (now - (set.restLastStartTime || now));
                set.restStatus = 'paused';
                set.restLastStartTime = undefined;
            } else if (set.restStatus === 'paused') {
                // RESUME IT
                set.restStatus = 'running';
                set.restLastStartTime = Date.now();
            }
        } else {
            if (!set.p2_completed) return;

            if (set.p2_restStatus === 'running') {
                // PAUSE IT
                const now = Date.now();
                set.p2_restAccumulated = (set.p2_restAccumulated || 0) + (now - (set.p2_restLastStartTime || now));
                set.p2_restStatus = 'paused';
                set.p2_restLastStartTime = undefined;
            } else if (set.p2_restStatus === 'paused') {
                // RESUME IT
                set.p2_restStatus = 'running';
                set.p2_restLastStartTime = Date.now();
            }
        }
        setActiveExercises(updated);
    };


    // [NEW LOBBY SYSTEM] Scalable 8-Player Helper Methods
    const getPlayerRestTimer = (set: any, targetUserId: string, pIdx: number) => {
        const isHost = targetUserId === (isInviter ? user?.id : partnerId);
        const isFirstGuest = targetUserId === firstGuestId;

        const status = set.playerRestStatus?.[targetUserId] ?? (isHost ? set.restStatus : (isFirstGuest ? set.p2_restStatus : undefined));
        const accumulated = safeNum(set.playerRestAccumulated?.[targetUserId] ?? (isHost ? set.restAccumulated : (isFirstGuest ? set.p2_restAccumulated : 0)), 0);
        const lastStartTime = set.playerRestLastStartTime?.[targetUserId] ?? (isHost ? set.restLastStartTime : (isFirstGuest ? set.p2_restLastStartTime : undefined));

        return { status, accumulated, lastStartTime };
    };

    const stopAllRestTimersForUser = (nextExercises: any[], targetUserId: string, excludeExerciseIdx?: number, excludeSetIdx?: number) => {
        const isHost = targetUserId === (isInviter ? user?.id : partnerId);
        const isFirstGuest = targetUserId === firstGuestId;

        for (let i = 0; i < nextExercises.length; i++) {
            const ex = nextExercises[i];
            for (let j = 0; j < ex.sets.length; j++) {
                if (excludeExerciseIdx !== undefined && excludeSetIdx !== undefined && i === excludeExerciseIdx && j === excludeSetIdx) {
                    continue;
                }
                const s = ex.sets[j];
                const status = s.playerRestStatus?.[targetUserId] ?? (isHost ? s.restStatus : (isFirstGuest ? s.p2_restStatus : undefined));
                
                if (status === 'running' || status === 'paused') {
                    if (!s.playerRestStatus) s.playerRestStatus = {};
                    if (!s.playerRestAccumulated) s.playerRestAccumulated = {};
                    if (!s.playerRestLastStartTime) s.playerRestLastStartTime = {};

                    const accumulated = s.playerRestAccumulated[targetUserId] ?? (isHost ? s.restAccumulated : (isFirstGuest ? s.p2_restAccumulated : 0));
                    const lastStartTime = s.playerRestLastStartTime[targetUserId] ?? (isHost ? s.restLastStartTime : (isFirstGuest ? s.p2_restLastStartTime : undefined));
                    
                    const now = Date.now();
                    const nextAcc = status === 'running'
                        ? (accumulated || 0) + (now - (lastStartTime || now))
                        : (accumulated || 0);

                    s.playerRestStatus[targetUserId] = 'completed';
                    s.playerRestAccumulated[targetUserId] = nextAcc;
                    delete s.playerRestLastStartTime[targetUserId];

                    if (isHost) {
                        s.restStatus = 'completed';
                        s.restAccumulated = nextAcc;
                        s.restLastStartTime = undefined;
                    } else if (isFirstGuest) {
                        s.p2_restStatus = 'completed';
                        s.p2_restAccumulated = nextAcc;
                        s.p2_restLastStartTime = undefined;
                    }

                    if (!s.playerLastUpdated) s.playerLastUpdated = {};
                    s.playerLastUpdated[targetUserId] = Date.now();
                    s.lastUpdatedAt = Date.now();
                }
            }
        }
    };

    const updatePlayerSet = (
        exerciseIndex: number,
        setIndex: number,
        targetUserId: string,
        fieldKey: 'weight' | 'reps' | 'time' | 'distance' | 'rpe' | 'completed' | 'locked',
        value: any
    ) => {
        // Hard guard: never allow writes to a finalized participant's data.
        // This is the last line of defence — the UI already hides inputs for
        // finalized players, but this prevents any race-condition write.
        if (finalizedParticipantsRef.current.has(targetUserId)) return;

        // A participant being offline (phone off, no WiFi) must NEVER block the partner
        // from filling their data. Editing is only restricted after the workout ends
        // or is cancelled — which is enforced by navigation away from this page.
        // No isAbandoned guard here.

        setActiveExercises(prev => {
            const next = prev.map(ex => ({
                ...ex,
                sets: ex.sets.map(s => ({ ...s }))
            }));
            const ex = next[exerciseIndex];
            if (!ex) return prev;
            const set = ex.sets[setIndex];
            if (!set) return prev;

            if (!set.playerWeights) set.playerWeights = {};
            if (!set.playerReps) set.playerReps = {};
            if (!set.playerTimes) set.playerTimes = {};
            if (!set.playerDistances) set.playerDistances = {};
            if (!set.playerRpes) set.playerRpes = {};
            if (!set.playerCompleted) set.playerCompleted = {};
            if (!set.playerLocked) set.playerLocked = {};
            if (!set.playerCompletedAt) set.playerCompletedAt = {};

            const numVal = typeof value === 'string' ? parseFloat(value) : value;

            if (fieldKey === 'weight') set.playerWeights[targetUserId] = isNaN(numVal) ? 0 : numVal;
            if (fieldKey === 'reps') set.playerReps[targetUserId] = isNaN(numVal) ? 0 : numVal;
            if (fieldKey === 'time') set.playerTimes[targetUserId] = isNaN(numVal) ? 0 : numVal;
            if (fieldKey === 'distance') set.playerDistances[targetUserId] = isNaN(numVal) ? 0 : numVal;
            if (fieldKey === 'rpe') set.playerRpes[targetUserId] = isNaN(numVal) ? 0 : numVal;
            if (fieldKey === 'completed') set.playerCompleted[targetUserId] = Boolean(value);
            if (fieldKey === 'locked') set.playerLocked[targetUserId] = Boolean(value);

            if (!set.playerLastUpdated) set.playerLastUpdated = {};
            set.playerLastUpdated[targetUserId] = Date.now();

            // Sincronizar descansos dinámicos LWW por usuario
            if (fieldKey === 'weight' || fieldKey === 'reps' || fieldKey === 'time' || fieldKey === 'distance' || fieldKey === 'rpe') {
                const isHost = targetUserId === (isInviter ? user?.id : partnerId);
                const isFirstGuest = targetUserId === firstGuestId;
                const currentStatus = set.playerRestStatus?.[targetUserId] ?? (isHost ? set.restStatus : (isFirstGuest ? set.p2_restStatus : undefined));

                if (currentStatus !== 'running') {
                    // 1. Detener todos los demás descansos activos de este usuario
                    stopAllRestTimersForUser(next, targetUserId, exerciseIndex, setIndex);

                    // 2. Iniciar el temporizador para la serie actual que acaba de ser llenada
                    if (!set.playerRestStatus) set.playerRestStatus = {};
                    if (!set.playerRestLastStartTime) set.playerRestLastStartTime = {};
                    if (!set.playerRestAccumulated) set.playerRestAccumulated = {};

                    set.playerRestStatus[targetUserId] = 'running';
                    set.playerRestLastStartTime[targetUserId] = Date.now();
                    set.playerRestAccumulated[targetUserId] = 0;

                    if (isHost) {
                        set.restStatus = 'running';
                        set.restLastStartTime = Date.now();
                        set.restAccumulated = 0;
                    } else if (isFirstGuest) {
                        set.p2_restStatus = 'running';
                        set.p2_restLastStartTime = Date.now();
                        set.p2_restAccumulated = 0;
                    }
                }

                // Registrar interacción con el ejercicio para el flujo cronológico
                if (targetUserId === user?.id) {
                    recordExerciseInteraction(ex.equipmentName);
                }
            }

            // CRDT: Update modification timestamp
            set.lastUpdatedAt = Date.now();

            const isHost = targetUserId === (isInviter ? user?.id : partnerId);
            const isFirstGuest = targetUserId === firstGuestId;

            if (isHost) {
                if (fieldKey === 'weight') set.weight = isNaN(numVal) ? 0 : numVal;
                if (fieldKey === 'reps') set.reps = isNaN(numVal) ? 0 : numVal;
                if (fieldKey === 'time') set.time = isNaN(numVal) ? 0 : numVal;
                if (fieldKey === 'distance') set.distance = isNaN(numVal) ? 0 : numVal;
                if (fieldKey === 'rpe') set.rpe = isNaN(numVal) ? 0 : numVal;
                if (fieldKey === 'completed') set.completed = Boolean(value);
                if (fieldKey === 'locked') set.locked = Boolean(value);
            } else if (isFirstGuest) {
                if (fieldKey === 'weight') set.p2_weight = isNaN(numVal) ? 0 : numVal;
                if (fieldKey === 'reps') set.p2_reps = isNaN(numVal) ? 0 : numVal;
                if (fieldKey === 'time') set.p2_time = isNaN(numVal) ? 0 : numVal;
                if (fieldKey === 'distance') set.p2_distance = isNaN(numVal) ? 0 : numVal;
                if (fieldKey === 'rpe') set.p2_rpe = isNaN(numVal) ? 0 : numVal;
                if (fieldKey === 'completed') set.p2_completed = Boolean(value);
                if (fieldKey === 'locked') set.p2_locked = Boolean(value);
            }

            return next;
        });
    };

    const togglePlayerSetComplete = (exerciseIndex: number, setIndex: number, targetUserId: string) => {
        // Same policy as updatePlayerSet: offline ≠ blocked. No isAbandoned guard.

        const ex = activeExercises[exerciseIndex];
        if (!ex) return;
        const set = ex.sets[setIndex];
        if (!set) return;

        const isHost = targetUserId === (isInviter ? user?.id : partnerId);
        const isFirstGuest = targetUserId === firstGuestId;

        const currentCompleted = set.playerCompleted?.[targetUserId] ?? (
            isHost ? set.completed : (isFirstGuest ? (set.p2_completed || false) : false)
        );
        const nextCompleted = !currentCompleted;

        // Legacy global timer sync (visual backup)
        if (isHost) {
            if (nextCompleted) {
                setRestTimerSetKey(`${exerciseIndex}-${setIndex}`);
            } else {
                if (restTimerSetKey === `${exerciseIndex}-${setIndex}`) {
                    setRestTimerSetKey(null);
                }
            }
        }

        setActiveExercises(prev => {
            const next = prev.map(e => ({
                ...e,
                sets: e.sets.map(s => ({ ...s }))
            }));
            const s = next[exerciseIndex]?.sets[setIndex];
            if (!s) return prev;

            // Initialize all maps
            if (!s.playerWeights) s.playerWeights = {};
            if (!s.playerReps) s.playerReps = {};
            if (!s.playerTimes) s.playerTimes = {};
            if (!s.playerDistances) s.playerDistances = {};
            if (!s.playerRpes) s.playerRpes = {};
            if (!s.playerCompleted) s.playerCompleted = {};
            if (!s.playerLocked) s.playerLocked = {};
            if (!s.playerCompletedAt) s.playerCompletedAt = {};
            if (!s.playerRestStatus) s.playerRestStatus = {};
            if (!s.playerRestAccumulated) s.playerRestAccumulated = {};
            if (!s.playerRestLastStartTime) s.playerRestLastStartTime = {};

            // 1. Set completion & lock states
            s.playerCompleted[targetUserId] = nextCompleted;
            s.playerLocked[targetUserId] = nextCompleted;

            if (!s.playerLastUpdated) s.playerLastUpdated = {};
            s.playerLastUpdated[targetUserId] = Date.now();
            s.lastUpdatedAt = Date.now();

            // Snapshot the displayed value into playerWeights/Reps when completing.
            // Needed for ghost-set users (pre-populated sets they didn't edit) and for
            // 3rd+ participants who have no scalar fallback (p2_weight is only for Guest 1).
            if (nextCompleted) {
                const displayedW = s.playerWeights[targetUserId] ??
                    (isHost ? (s.weight || 0) : (isFirstGuest ? (s.p2_weight || 0) : 0));
                const displayedR = s.playerReps[targetUserId] ??
                    (isHost ? (s.reps || 0) : (isFirstGuest ? (s.p2_reps || 0) : 0));
                const displayedT = s.playerTimes[targetUserId] ??
                    (isHost ? (s.time || 0) : (isFirstGuest ? (s.p2_time || 0) : 0));
                if (s.playerWeights[targetUserId] === undefined && displayedW > 0)
                    s.playerWeights[targetUserId] = displayedW;
                if (s.playerReps[targetUserId] === undefined && displayedR > 0)
                    s.playerReps[targetUserId] = displayedR;
                if (s.playerTimes[targetUserId] === undefined && displayedT > 0)
                    s.playerTimes[targetUserId] = displayedT;
            }

            if (isHost) {
                s.completed = nextCompleted;
                s.locked = nextCompleted;
            } else if (isFirstGuest) {
                s.p2_completed = nextCompleted;
                s.p2_locked = nextCompleted;
            }

            // Registrar interacción con el ejercicio para el flujo cronológico
            if (targetUserId === user?.id) {
                recordExerciseInteraction(next[exerciseIndex].equipmentName);
            }

            // 2. Timer transitions
            if (nextCompleted) {
                s.playerCompletedAt[targetUserId] = Date.now().toString();
                s.playerRestStatus[targetUserId] = 'running';
                s.playerRestLastStartTime[targetUserId] = Date.now();
                s.playerRestAccumulated[targetUserId] = 0;

                if (isHost) {
                    s.completedAt = Date.now();
                    s.restStatus = 'running';
                    s.restLastStartTime = Date.now();
                    s.restAccumulated = 0;
                } else if (isFirstGuest) {
                    s.p2_completedAt = Date.now().toString();
                    s.p2_restStatus = 'running';
                    s.p2_restLastStartTime = Date.now();
                    s.p2_restAccumulated = 0;
                }

                // Freeze all other timers for target user in the entire session!
                stopAllRestTimersForUser(next, targetUserId, exerciseIndex, setIndex);
            } else {
                // UNMARKING
                delete s.playerCompletedAt[targetUserId];
                delete s.playerRestStatus[targetUserId];
                delete s.playerRestAccumulated[targetUserId];
                delete s.playerRestLastStartTime[targetUserId];

                if (isHost) {
                    s.completedAt = undefined;
                    s.restStatus = undefined;
                    s.restLastStartTime = undefined;
                    s.restAccumulated = 0;
                } else if (isFirstGuest) {
                    s.p2_completedAt = undefined;
                    s.p2_restStatus = undefined;
                    s.p2_restLastStartTime = undefined;
                    s.p2_restAccumulated = 0;
                }
            }

            // Use activeExercisesRef (latest state after re-render) instead of the
            // stale `next` closure to avoid sending outdated exercise data.
            setTimeout(() => {
                if (isMultiplayer && channelRef.current && user && !showSummary && !isFinished) {
                    const latestExercises = activeExercisesRef.current;
                    if (latestExercises.length > 0) {
                        const stateStr = JSON.stringify(latestExercises);
                        lastIncomingState.current = stateStr;
                        channelRef.current.send({
                            type: 'broadcast',
                            event: 'sync_state',
                            payload: { exercises: latestExercises, sender: user.id }
                        }).catch(e => console.error(e));
                    }
                }
            }, 0);

            return next;
        });
    };

    const togglePlayerTimerPause = (exerciseIndex: number, setIndex: number, targetUserId: string) => {
        setActiveExercises(prev => {
            const next = prev.map(ex => ({
                ...ex,
                sets: ex.sets.map(s => ({ ...s }))
            }));
            const ex = next[exerciseIndex];
            if (!ex) return prev;
            const set = ex.sets[setIndex];
            if (!set) return prev;

            if (!set.playerRestStatus) set.playerRestStatus = {};
            if (!set.playerRestAccumulated) set.playerRestAccumulated = {};
            if (!set.playerRestLastStartTime) set.playerRestLastStartTime = {};

            const isHost = targetUserId === (isInviter ? user?.id : partnerId);
            const isFirstGuest = targetUserId === firstGuestId;

            const currentStatus = set.playerRestStatus[targetUserId] ?? (isHost ? set.restStatus : (isFirstGuest ? set.p2_restStatus : undefined));
            const currentAccumulated = set.playerRestAccumulated[targetUserId] ?? (isHost ? set.restAccumulated : (isFirstGuest ? set.p2_restAccumulated : 0));
            const currentLastStartTime = set.playerRestLastStartTime[targetUserId] ?? (isHost ? set.restLastStartTime : (isFirstGuest ? set.p2_restLastStartTime : undefined));

            if (currentStatus === 'running') {
                const now = Date.now();
                const newAcc = (currentAccumulated || 0) + (now - (currentLastStartTime || now));
                set.playerRestStatus[targetUserId] = 'paused';
                set.playerRestAccumulated[targetUserId] = newAcc;
                delete set.playerRestLastStartTime[targetUserId];

                if (isHost) {
                    set.restStatus = 'paused';
                    set.restAccumulated = newAcc;
                    set.restLastStartTime = undefined;
                } else if (isFirstGuest) {
                    set.p2_restStatus = 'paused';
                    set.p2_restAccumulated = newAcc;
                    set.p2_restLastStartTime = undefined;
                }
            } else if (currentStatus === 'paused') {
                const now = Date.now();
                set.playerRestStatus[targetUserId] = 'running';
                set.playerRestLastStartTime[targetUserId] = now;

                if (isHost) {
                    set.restStatus = 'running';
                    set.restLastStartTime = now;
                } else if (isFirstGuest) {
                    set.p2_restStatus = 'running';
                    set.p2_restLastStartTime = now;
                }
            }

            if (!set.playerLastUpdated) set.playerLastUpdated = {};
            set.playerLastUpdated[targetUserId] = Date.now();
            set.lastUpdatedAt = Date.now();

            // Use activeExercisesRef (latest state after re-render) instead of the
            // stale `next` closure to avoid sending outdated exercise data.
            setTimeout(() => {
                if (isMultiplayer && channelRef.current && user && !showSummary && !isFinished) {
                    const latestExercises = activeExercisesRef.current;
                    if (latestExercises.length > 0) {
                        const stateStr = JSON.stringify(latestExercises);
                        lastIncomingState.current = stateStr;
                        channelRef.current.send({
                            type: 'broadcast',
                            event: 'sync_state',
                            payload: { exercises: latestExercises, sender: user.id }
                        }).catch(e => console.error(e));
                    }
                }
            }, 0);

            return next;
        });
    };

    const togglePlayerLock = (exerciseIndex: number, setIndex: number, targetUserId: string) => {
        setActiveExercises(prev => {
            const next = prev.map(ex => ({
                ...ex,
                sets: ex.sets.map(s => ({ ...s }))
            }));
            const ex = next[exerciseIndex];
            if (!ex) return prev;
            const set = ex.sets[setIndex];
            if (!set) return prev;

            if (!set.playerLocked) set.playerLocked = {};
            
            const isHost = targetUserId === (isInviter ? user?.id : partnerId);
            const isFirstGuest = targetUserId === firstGuestId;

            const currentLocked = set.playerLocked[targetUserId] ?? (
                isHost ? set.locked : (isFirstGuest ? (set.p2_locked || false) : false)
            );
            const nextLocked = !currentLocked;

            set.playerLocked[targetUserId] = nextLocked;

            if (isHost) {
                set.locked = nextLocked;
            } else if (isFirstGuest) {
                set.p2_locked = nextLocked;
            }

            if (!set.playerLastUpdated) set.playerLastUpdated = {};
            set.playerLastUpdated[targetUserId] = Date.now();

            // CRDT: Update modification timestamp
            set.lastUpdatedAt = Date.now();

            // Use activeExercisesRef (latest state after re-render) instead of the
            // stale `next` closure to avoid sending outdated exercise data.
            setTimeout(() => {
                if (isMultiplayer && channelRef.current && user && !showSummary && !isFinished) {
                    const latestExercises = activeExercisesRef.current;
                    if (latestExercises.length > 0) {
                        const stateStr = JSON.stringify(latestExercises);
                        lastIncomingState.current = stateStr;
                        channelRef.current.send({
                            type: 'broadcast',
                            event: 'sync_state',
                            payload: { exercises: latestExercises, sender: user.id }
                        }).catch(e => console.error(e));
                    }
                }
            }, 0);

            return next;
        });
    };

    const handlePlayerInputBlur = (exerciseIndex: number, setIndex: number, targetUserId: string, e: React.FocusEvent<HTMLInputElement>) => {
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (relatedTarget && relatedTarget.tagName === 'INPUT') {
            const nextPlayerId = relatedTarget.getAttribute('data-player-id');
            const nextSetIdx = relatedTarget.getAttribute('data-set-index');
            const nextExIdx = relatedTarget.getAttribute('data-exercise-index');

            // Prevent auto-completion ONLY if the user is clicking another input in the SAME player's row, SAME set, and SAME exercise
            if (nextPlayerId === targetUserId &&
                nextSetIdx !== null && Number(nextSetIdx) === setIndex &&
                nextExIdx !== null && Number(nextExIdx) === exerciseIndex) {
                return;
            }
        }

        setTimeout(() => {
            const exercise = activeExercisesRef.current[exerciseIndex];
            if (!exercise) return;
            const set = exercise.sets[setIndex];
            if (!set) return;

            const isHost = targetUserId === (isInviter ? user?.id : partnerId);
            const isFirstGuest = targetUserId === firstGuestId;

            const isCompleted = set.playerCompleted?.[targetUserId] ?? (isHost ? set.completed : (isFirstGuest ? (set.p2_completed || false) : false));
            if (isCompleted) return;

            let isComplete = true;
            let hasAnyMetric = false;

            if (exercise.metrics.weight) {
                hasAnyMetric = true;
                const weightVal = set.playerWeights?.[targetUserId] ?? (isHost ? set.weight : (isFirstGuest ? (set.p2_weight || 0) : 0));
                if (weightVal === undefined || weightVal <= 0) isComplete = false;
            }
            if (exercise.metrics.reps) {
                hasAnyMetric = true;
                const repsVal = set.playerReps?.[targetUserId] ?? (isHost ? set.reps : (isFirstGuest ? (set.p2_reps || 0) : 0));
                if (repsVal === undefined || repsVal <= 0) isComplete = false;
            }
            if (exercise.metrics.time) {
                hasAnyMetric = true;
                const timeVal = set.playerTimes?.[targetUserId] ?? (isHost ? set.time : (isFirstGuest ? (set.p2_time || 0) : 0));
                if (timeVal === undefined || timeVal <= 0) isComplete = false;
            }
            if (exercise.metrics.distance) {
                hasAnyMetric = true;
                const distanceVal = set.playerDistances?.[targetUserId] ?? (isHost ? set.distance : (isFirstGuest ? (set.p2_distance || 0) : 0));
                if (distanceVal === undefined || distanceVal <= 0) isComplete = false;
            }
            if (exercise.metrics.rpe) {
                hasAnyMetric = true;
                const rpeVal = set.playerRpes?.[targetUserId] ?? (isHost ? set.rpe : (isFirstGuest ? (set.p2_rpe || 0) : 0));
                if (rpeVal === undefined || rpeVal <= 0) isComplete = false;
            }

            if (isComplete && hasAnyMetric) {
                togglePlayerSetComplete(exerciseIndex, setIndex, targetUserId);
            }
        }, 150);
    };

    const addSet = (exerciseIndex: number) => {
        // Deep Copy
        const updated = activeExercises.map(ex => ({
            ...ex,
            sets: ex.sets.map(s => ({ ...s }))
        }));

        const previousSet = updated[exerciseIndex].sets[updated[exerciseIndex].sets.length - 1];

        // Initialize custom metrics based on what's active in the settings
        const customMetrics: Record<string, number> = {};
        const activeIds = Object.keys(updated[exerciseIndex].metrics || {});

        activeIds.forEach(mid => {
            // standard metrics (weight, reps, time, distance, rpe) are handled separately
            if (!['weight', 'reps', 'time', 'distance', 'rpe'].includes(mid)) {
                customMetrics[mid] = previousSet?.custom?.[mid] || 0;
            }
        });

        const prevPWeights: Record<string, number> = {};
        const prevPReps: Record<string, number> = {};
        const prevPTimes: Record<string, number> = {};
        const prevPDistances: Record<string, number> = {};
        const prevPRpes: Record<string, number> = {};

        const originalWeights = previousSet?.playerWeights || {};
        const originalReps = previousSet?.playerReps || {};
        const originalTimes = previousSet?.playerTimes || {};
        const originalDistances = previousSet?.playerDistances || {};
        const originalRpes = previousSet?.playerRpes || {};

        if (isMultiplayer && participantsRef.current.length > 0) {
            // Carry over previous-set data for active (non-finalized) participants only.
            // Finalized participants are intentionally skipped: their data is frozen and
            // their column will show "-" (empty) in any set added after they left.
            participantsRef.current.forEach(p => {
                if (finalizedParticipantsRef.current.has(p.id)) return; // frozen
                prevPWeights[p.id]    = originalWeights[p.id]    !== undefined ? originalWeights[p.id]    : 0;
                prevPReps[p.id]       = originalReps[p.id]       !== undefined ? originalReps[p.id]       : 0;
                prevPTimes[p.id]      = originalTimes[p.id]      !== undefined ? originalTimes[p.id]      : 0;
                prevPDistances[p.id]  = originalDistances[p.id]  !== undefined ? originalDistances[p.id]  : 0;
                prevPRpes[p.id]       = originalRpes[p.id]       !== undefined ? originalRpes[p.id]       : 0;
            });
        } else {
            // Single player fallback
            const myId = user?.id || 'single-user';
            prevPWeights[myId] = originalWeights[myId] !== undefined ? originalWeights[myId] : (previousSet?.weight || 0);
            prevPReps[myId] = originalReps[myId] !== undefined ? originalReps[myId] : (previousSet?.reps || 0);
            prevPTimes[myId] = originalTimes[myId] !== undefined ? originalTimes[myId] : (previousSet?.time || 0);
            prevPDistances[myId] = originalDistances[myId] !== undefined ? originalDistances[myId] : (previousSet?.distance || 0);
            prevPRpes[myId] = originalRpes[myId] !== undefined ? originalRpes[myId] : (previousSet?.rpe || 0);
        }

        updated[exerciseIndex].sets.push({
            id: Math.random().toString(),
            lastUpdatedAt: Date.now(), // CRDT: Initialize timestamp for real-time synchronization
            weight: previousSet ? previousSet.weight : 0,
            reps: previousSet ? previousSet.reps : 0,
            time: previousSet?.time || 0,
            distance: previousSet?.distance || 0,
            rpe: previousSet?.rpe || 0,
            custom: customMetrics,
            completed: false,
            playerWeights: prevPWeights,
            playerReps: prevPReps,
            playerTimes: prevPTimes,
            playerDistances: prevPDistances,
            playerRpes: prevPRpes,
            playerCompleted: {},
            playerLocked: {},
            playerCompletedAt: {},
            playerRestStatus: {},
            playerRestAccumulated: {},
            playerRestLastStartTime: {}
        });
        setActiveExercises(updated);
    };




    // ─── Navigation Lock ────────────────────────────────────────────────
    // 1. Block tab/window close while session is active
    useEffect(() => {
        if (!user || isFinished) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '¿Seguro que quieres salir? Tu entrenamiento sigue en curso y los datos podría perderse.';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [user, isFinished]);

    // 2. Block browser back button (popstate) while session is active.
    // Works with BrowserRouter (no Data Router needed).
    // Strategy: push MULTIPLE sentinel entries so rapid back-taps can't drain
    // the history stack before the handler fires and re-pushes them.
    const guardPushCountRef = useRef(0);
    useEffect(() => {
        if (!user || isFinished) {
            // Session just ended — pop back the sentinel entries we pushed so
            // the user's history stack isn't polluted after finishing.
            if (guardPushCountRef.current > 0) {
                window.history.go(-guardPushCountRef.current);
                guardPushCountRef.current = 0;
            }
            return;
        }

        // Push 2 sentinels on mount (protects against accidental single/double tap)
        const INITIAL = 2;
        for (let i = 0; i < INITIAL; i++) {
            window.history.pushState({ workoutGuard: true }, '');
        }
        guardPushCountRef.current += INITIAL;

        const handlePopState = (e: PopStateEvent) => {
            if (isLeavingPageRef.current || !user || isFinished) return;
            // Broadcast temp-exit so coop partners lock this user's inputs
            if (channelRef.current && isMultiplayer) {
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'participant_temp_exit',
                    payload: { sender: user.id }
                }).catch(() => {});
            }
            sessionStorage.setItem('ginx_temp_exit_active', 'true');
            guardPushCountRef.current = 0;
            isLeavingPageRef.current = true;
            navigate('/');
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [user, isFinished]);

    // NEW: Persist Active Exercises to LocalStorage
    useEffect(() => {
        if (sessionId && activeExercises.length > 0) {
            const draftPayload = {
                exercises: activeExercises,
                routineName: currentRoutineName,
                originalIds: originalExerciseIds,
                isRoutineModified: isRoutineModified
            };
            localStorage.setItem(`workout_draft_${sessionId}`, JSON.stringify(draftPayload));
        }
    }, [sessionId, activeExercises, currentRoutineName, originalExerciseIds, isRoutineModified]);

    // NEW: Handle Cancel
    const handleCancelSession = async () => {
        if (!sessionId) {
            isLeavingPageRef.current = true;
            navigate('/');
            return;
        }

        isLeavingPageRef.current = true;
        // spec §1.3-F: "la cancelación del host nunca debe cerrar la sesión para los
        // demás" — el grupo "continúa sin interrupciones ni pérdida de datos". Por eso,
        // al cancelar, el host avisa a los demás con un evento NO destructivo: cada
        // participante conserva su sesión y su progreso, y continúa en modo individual
        // (en vez del antiguo "Destruction Protocol" que borraba y expulsaba a todos).
        if (isMultiplayer && isInviter && channelRef.current && user) {
            console.log('📢 Host cancelando — avisando a los demás para que continúen en modo individual sin perder datos...');
            channelRef.current.send({
                type: 'broadcast',
                event: 'host_cancelled_continue_solo',
                payload: { sender: user.id }
            }).catch(e => console.error('Error broadcasting host_cancelled_continue_solo:', e));
        }

        // Phase 5: "si da alguno en cancelar entrenamiento ya no recibe nada y los
        // otros ya no pueden ver sus datos" — notify everyone else (host or guest)
        // so they strip this user's data from the shared room/table.
        if (isMultiplayer && channelRef.current && user) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'participant_cancelled',
                payload: { sender: user.id }
            }).catch(e => console.error('Error broadcasting participant_cancelled:', e));
        }

        const oldSessionId = sessionId;
        localStorage.removeItem(`workout_draft_${oldSessionId}`);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('ginx_coop_state');
        sessionStorage.removeItem('ginx_temp_exit_active');
        setActiveExercises([]);
        setIsFinished(true); // Disable history guard before navigating
        setSessionId(null);  // Disable history guard before navigating
        setLoading(true);

        try {
            if (isMultiplayer) {
                // Phase 5: a multiplayer participant who cancels gets ZERO history —
                // unlike deleteSession(), this never "finalizes instead" even if sets
                // were already logged.
                await workoutService.forceDeleteSession(oldSessionId);
            } else {
                await workoutService.deleteSession(oldSessionId);
            }
        } catch (err) {
            console.error("Failed to delete session in DB cleanly:", err);
        } finally {
            setLoading(false);
            navigate('/');
        }
    };

    // NEW: Handle Restart
    // ── PAUSAR / REANUDAR SESIÓN COMPLETA (spec §1.2 líneas 45/49) ────────────
    // Congela el cronómetro mostrado y bloquea el registro de series — sin
    // tocar `startTime` (que sigue siendo la fuente de verdad para sync
    // multijugador, geo-validación y persistencia), por lo que NINGÚN dato
    // existente se pierde ni se duplica al reanudar: solo se "resta" el
    // tiempo pausado del reloj que ve el usuario (ver Timer Effect arriba).
    const handlePauseSession = () => {
        if (isSessionPaused || isFinished) return;
        pausedAtRef.current = Date.now();
        setIsSessionPaused(true);
        setShowExitMenu(false);
        import('react-hot-toast').then(({ default: t }) =>
            t('⏸️ Sesión en pausa — tu progreso y el tiempo transcurrido quedan exactamente como están.', {
                duration: 3500,
                icon: '⏸️',
                style: { background: '#171717', color: '#fff', border: '1px solid rgba(234,179,8,0.3)', fontSize: '11px', fontWeight: 'bold' }
            })
        );
    };

    const handleResumeSession = () => {
        if (!isSessionPaused) return;
        if (pausedAtRef.current) {
            accumulatedPauseMsRef.current += (Date.now() - pausedAtRef.current);
            pausedAtRef.current = null;
        }
        setIsSessionPaused(false);
        import('react-hot-toast').then(({ default: t }) =>
            t.success('▶️ Sesión reanudada — continúas exactamente donde la dejaste.', { duration: 3000 })
        );
    };

    const handleRestartSession = async () => {
        if (!sessionId) return;
        if (window.confirm("¿Reiniciar entrenamiento? Se borrarán todas las series de hoy.")) {
            // Clear Local Storage
            localStorage.removeItem(`workout_draft_${sessionId}`);
            localStorage.removeItem(STORAGE_KEY);

            setLoading(true);
            await workoutService.deleteSession(sessionId);

            setSessionId(null);
            setStartTime(null);
            setElapsedTime("00:00");
            setIsFinished(false);

            setActiveExercises(prev => prev.map(ex => ({
                ...ex,
                sets: ex.sets.map(s => ({
                    ...s,
                    weight: 0,
                    reps: 0,
                    time: 0,
                    distance: 0,
                    rpe: 0,
                    custom: {},
                    completed: false,
                    restStatus: undefined,
                    restAccumulated: undefined,
                    restLastStartTime: undefined,
                    playerRestStatus: {},
                    playerRestAccumulated: {},
                    playerRestLastStartTime: {},
                    playerCompleted: {},
                    playerCompletedAt: {},
                    p2_completed: false,
                    p2_completedAt: undefined,
                    p2_restStatus: undefined,
                    p2_restAccumulated: undefined,
                    p2_restLastStartTime: undefined
                }))
            })));

            await startNewSession();

            setLoading(false);
            setShowExitMenu(false);
            setCurrentExerciseIndex(0);
        }
    };

    // Helper to resolve Exercise ID (Foreign Key for workout_logs)
    const resolveExerciseId = async (equipmentName: string): Promise<string | null> => {
        if (!equipmentName?.trim()) return null;
        try {
            // 1. Exact case-insensitive match (ilike without wildcards = exact icase match)
            const { data: existing } = await supabase
                .from('exercises')
                .select('id')
                .ilike('name', equipmentName.trim())
                .limit(1)
                .maybeSingle(); // maybeSingle avoids throwing on 0 results

            if (existing?.id) return existing.id;

            // 2. Not found — create a new exercises row so sets can be linked via FK
            console.warn(`Creating new exercise entry for: "${equipmentName}"`);
            const { data: newExercise, error } = await supabase
                .from('exercises')
                .insert({ name: equipmentName.trim() })
                .select('id')
                .single();

            if (error) {
                console.error('Error creating exercise entry:', error);
                return null;
            }

            return newExercise?.id ?? null;
        } catch (err) {
            console.error('Exception resolving exercise ID:', err);
            return null;
        }
    };

    // handleStartTraining removed as it is no longer used (auto-start logic in initialization)

    // startSessionInternal removed

    // --- FINISH FLOW STATE ---
    const [showRoutineModal, setShowRoutineModal] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [routineName, setRoutineName] = useState('');
    const [locationName, setLocationName] = useState('');
    const [isSavingFlow, setIsSavingFlow] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);

    /** Cancel finishing: go back to the active workout from the routine modal */
    const handleCancelFinish = () => {
        setShowRoutineModal(false);
        setIsFinished(false);
        isLeavingPageRef.current = false;
        setRoutineName('');
    };

    /**
     * Returns true if the given exercise list (by equipmentId, in order) already exists
     * as a saved routine for the given userId.
     */
    const routineAlreadyExists = async (userId: string, exercises: typeof activeExercises): Promise<boolean> => {
        try {
            const userRoutines = await workoutService.getUserRoutines(userId, resolvedGymId);
            if (!userRoutines || userRoutines.length === 0) return false;

            // Compare by exercise NAME rather than ID.
            // manifest-based exercises use IDs like "manifest-inclinado_pecho__barra" which
            // never match `routine_exercises.exercise_id` (a gym_equipment UUID). Comparing
            // by name is the only reliable way to detect duplicates across both systems.
            const currentNames = exercises.map(e => e.equipmentName.trim().toLowerCase()).sort().join('|');

            for (const routine of userRoutines) {
                const sortedExercises = (routine.routine_exercises || [])
                    .slice()
                    .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
                // Routine exercises have `name` (snapshot) or can be resolved from equipment
                const savedNames = sortedExercises
                    .map((e: any) => (e.name || e.equipment?.name || '').trim().toLowerCase())
                    .filter(Boolean)
                    .sort()
                    .join('|');
                if (savedNames === currentNames && currentNames.length > 0) return true;
            }
            return false;
        } catch {
            return false;
        }
    };

    // 1. Triggered by UI Button
    const handleFinishRequest = async () => {
        if (isFinalizing) return;
        isLeavingPageRef.current = true; // Authorized navigation
        setIsFinished(true); // Stop timer
        // Close any open modals that might visually conflict with the finish flow
        setShowAddModal(false);
        setShowStartOptionsModal(false);

        // SMART SKIP: Skip modal if using a routine and the structure wasn't modified
        const hasChanged = currentRoutineName
            ? isRoutineModified
            : true; // Always ask for Quick Start sessions

        if (currentRoutineName && !hasChanged) {
            console.log('✨ Routine matches original template. Skipping save modal...');
            checkLocationStep();
            return;
        }

        // Smart duplicate check: if the exact exercise list already exists as a saved routine,
        // skip the save prompt for this user
        if (user && activeExercises.length > 0) {
            const exists = await routineAlreadyExists(user.id, activeExercises);
            if (exists) {
                console.log('✨ Identical routine already saved. Skipping save modal...');
                checkLocationStep();
                return;
            }
        }

        setShowRoutineModal(true);
    };

    // 2. Save Routine (Optional)
    // 2. Save Routine (Optional)
    const onSaveRoutine = async (name: string) => {
        if (name.trim()) {
            setIsSavingFlow(true);

            // 0. Resolve all exercise IDs to real gym_equipment UUIDs before saving.
            // routine_exercises.exercise_id is a FK to gym_equipment.id — manifest-* and virtual-*
            // IDs are NOT valid UUIDs and will fail the FK constraint silently.
            const resolvedExercises = await Promise.all(activeExercises.map(async (ex) => {
                let finalId = ex.equipmentId;
                const exerciseName = ex.equipmentName;
                const targetGym = resolvedGymId;

                const needsResolution = finalId.startsWith('virtual-') || finalId.startsWith('manifest-');

                if (needsResolution) {
                    try {
                        // Look for an existing gym_equipment entry with the same name
                        const { data: existing } = await supabase
                            .from('gym_equipment')
                            .select('id')
                            .eq('gym_id', targetGym)
                            .ilike('name', exerciseName)
                            .maybeSingle();

                        if (existing?.id) {
                            finalId = existing.id;
                        } else {
                            // Create a new gym_equipment entry for this exercise
                            const seed = COMMON_EQUIPMENT_SEEDS.find(
                                s => normalizeText(s.name) === normalizeText(exerciseName)
                            );
                            // Determine category from imageManifest for manifest exercises
                            let category = seed?.category || 'FREE_WEIGHT';
                            if (finalId.startsWith('manifest-')) {
                                const withoutPrefix = finalId.slice('manifest-'.length);
                                const entryId = withoutPrefix.split('__')[0];
                                const manifestEntry = IMAGE_MANIFEST.find(e => e.id === entryId);
                                if (manifestEntry?.muscle === 'CARDIO') category = 'CARDIO';
                            }
                            const newEq = await equipmentService.addEquipment({
                                name: exerciseName,
                                category,
                                gym_id: targetGym,
                                quantity: 1,
                                condition: 'GOOD',
                                icon: (seed as any)?.icon
                            }, user!.id);
                            if (newEq) finalId = newEq.id;
                        }
                    } catch (err) {
                        console.error(`Error resolving exercise "${exerciseName}":`, err);
                    }
                }

                return { ...ex, equipmentId: finalId };
            }));

            // Pass FULL activeExercises (resolved) to capture config (metrics, etc.)
            await workoutService.createRoutine(user!.id, name, resolvedExercises, null);
            setIsSavingFlow(false);
        }
        setShowRoutineModal(false);
        checkLocationStep();
    };

    const onSkipRoutine = () => {
        setShowRoutineModal(false);
        checkLocationStep();
    }

    // 3. Skip location prompt, go straight to finalize
    const checkLocationStep = async () => {
        handleFinalizeSession();
    };

    // (onSaveLocation removed as it is no longer needed)

    const onSkipLocation = () => {
        setShowLocationModal(false);
        handleFinalizeSession();
    };


    // 5. Finalize (The original handleFinish)
    const handleFinalizeSession = async () => {
        if (isFinalizing) return;
        setIsFinalizing(true);
        // setIsFinished(true); // Already stopped
        let finalSessionId = sessionId;

        if (!finalSessionId) {
            console.warn('⚠️ No sessionId found at finalize! Intentando crear sesión de emergencia...');
            try {
                const newSession = await workoutService.startSession(
                    user!.id,
                    resolvedGymId,
                    isMultiplayer,
                    multiplayerMode || undefined,
                    partnerId || undefined,
                    partnerSessionId || undefined
                );
                if (newSession && newSession.data) {
                    finalSessionId = newSession.data.id;
                    setSessionId(finalSessionId);
                    console.log('✅ Sesión de emergencia creada:', finalSessionId);
                } else {
                    console.error('❌ Failed to create emergency session!', newSession.error);
                    alert("⚠️ FALLA DE BASE DE DATOS AL INICIAR SESIÓN:\n" + JSON.stringify(newSession.error, null, 2));
                    // Emergency escape: don't trap the user
                    localStorage.removeItem('ginx_coop_state');
                    setIsFinished(true);
                    setLoading(false);
                    setIsFinalizing(false);
                    isLeavingPageRef.current = true;
                    navigate('/');
                    return;
                }
            } catch (err) {
                console.error('❌ Error critico en sesion de emergencia:', err);
                alert("⚠️ ERROR CRÍTICO AL CONTACTAR SERVIDOR:\n" + String(err));
                setIsFinished(true);
                isLeavingPageRef.current = true;
                navigate('/');
                return;
            }
        }

        setLoading(true);
        console.log('🏁 Iniciando proceso de finalización...');

        // 💾 AUTO-SAVE: Save any unsaved sets that have data
        let savedCount = 0;
        // spec §1.2: cuántas series quedaron encoladas para sincronización
        // automática por falta de conexión (ver workoutService.queuePendingSet).
        let pendingSyncCount = 0;
        const savePromises: Promise<any>[] = [];

        for (let i = 0; i < activeExercises.length; i++) {
            const exercise = activeExercises[i];

            // Resolve ID once per exercise if needed
            let exerciseDbId: string | null = null;

            // Function to get ID lazily
            const getExId = async () => {
                if (exerciseDbId) return exerciseDbId;
                exerciseDbId = await resolveExerciseId(exercise.equipmentName);
                return exerciseDbId;
            };

            for (let j = 0; j < exercise.sets.length; j++) {
                const set = exercise.sets[j];

                const myId = user?.id;
                if (!myId) continue;

                // SAVE LOGIC (DYNAMIC N-PLAYER):
                // 1. If it has no DB ID (not saved yet)
                // 2. AND (It is completed OR has some data FOR THIS USER)
                //
                // Fallback: if the playerX map doesn't have an entry for this user (e.g. a
                // ghost set the user completed without touching the inputs), fall back to the
                // scalar field the UI displays — same formula used in the row display.
                const myIsHost = !isMultiplayer || isInviter;
                const myIsFirstGuest = isMultiplayer && !isInviter && myId === firstGuestId;

                const isCompletedToSave = set.playerCompleted?.[myId] ??
                    (myIsHost ? set.completed : (myIsFirstGuest ? (set.p2_completed || false) : false));

                const weightToSave = Number(
                    set.playerWeights?.[myId] ??
                    (myIsHost ? (set.weight || 0) : (myIsFirstGuest ? (set.p2_weight || 0) : 0))
                ) || 0;

                const repsToSave = Number(
                    set.playerReps?.[myId] ??
                    (myIsHost ? (set.reps || 0) : (myIsFirstGuest ? (set.p2_reps || 0) : 0))
                ) || 0;

                const timeToSave = Number(
                    set.playerTimes?.[myId] ??
                    (myIsHost ? (set.time || 0) : (myIsFirstGuest ? (set.p2_time || 0) : 0))
                ) || 0;

                const distanceToSave = Number(
                    set.playerDistances?.[myId] ??
                    (myIsHost ? (set.distance || 0) : (myIsFirstGuest ? (set.p2_distance || 0) : 0))
                ) || 0;

                const rpeToSave = Number(
                    set.playerRpes?.[myId] ??
                    (myIsHost ? (set.rpe || 0) : (myIsFirstGuest ? (set.p2_rpe || 0) : 0))
                ) || undefined;

                if (!set.db_id && (isCompletedToSave || weightToSave > 0 || repsToSave > 0 || timeToSave > 0 || distanceToSave > 0)) {
                    // We need the ID now
                    const targetId = await getExId();

                    if (targetId) {
                        console.log(`💾 Saving set ${j + 1} for ${exercise.equipmentName}...`);
                        
                        let finalRestDuration = (set.playerRestAccumulated?.[myId]) || 0;
                        const activeRestStatus = set.playerRestStatus?.[myId];
                        const activeRestLastStartTime = set.playerRestLastStartTime?.[myId];

                        if (activeRestStatus === 'running' && activeRestLastStartTime) {
                            finalRestDuration += (Date.now() - activeRestLastStartTime);
                        }

                        const extendedMetrics = {
                            ...(set.custom || {}),
                            ...(isCompletedToSave ? { _checklist_timestamp: (set.playerCompletedAt?.[myId]) || Date.now() } : {}),
                            ...(exercise.weightUnit === 'lb' ? { _weight_unit: 'lb' } : {}),
                            _rest_duration_ms: finalRestDuration,
                            _rest_status: activeRestStatus === 'running' ? 'completed' : activeRestStatus
                        } as any;

                        const setPayload = {
                            session_id: finalSessionId,
                            exercise_id: targetId,
                            set_number: j + 1,
                            sets: 1,
                            weight_kg: weightToSave,
                            reps: repsToSave,
                            time: timeToSave,
                            distance: distanceToSave,
                            rpe: rpeToSave,
                            metrics_data: extendedMetrics,
                            category_snapshot: exercise.category || 'Custom',
                            is_pr: false,
                            owner_id: myId
                        };

                        savePromises.push(workoutService.logSet(setPayload).then(res => {
                            if (res.data) {
                                set.db_id = res.data.id;
                            } else if (res.error) {
                                // spec §1.2: "quedarse sin conexión... nunca pierde ningún
                                // dato ya registrado... al recuperar la conexión, todos los
                                // datos se sincronizan automáticamente". En vez de descartar
                                // la serie (pérdida silenciosa de datos), la encolamos para
                                // reintento automático — flushPendingSets() (disparado desde
                                // AppLayout en cada arranque y en cada evento 'online') la
                                // sincroniza sola, sin que el usuario tenga que hacer nada.
                                console.error(`❌ Error saving set for ${exercise.equipmentName}, queued for offline sync:`, res.error);
                                workoutService.queuePendingSet(finalSessionId, setPayload);
                                pendingSyncCount++;
                            }
                        }));
                        savedCount++;
                    } else {
                        console.error(`❌ Failed to resolve exercise ID for "${exercise.equipmentName}", set skipped.`);
                        // Notify user that this exercise's sets were NOT saved
                        import('react-hot-toast').then(({ default: t }) =>
                            t.error(`⚠️ No se encontró "${exercise.equipmentName}" en la base de datos. Sus series no serán guardadas.`, { duration: 6000 })
                        );
                    }
                }
            }
        }

        if (savedCount > 0) {
            console.log(`📦 Guardando ${savedCount} sets pendientes...`);
            await Promise.all(savePromises);
            if (user?.id) await detectAndMarkPRs(finalSessionId, user.id);
        }

        // spec §1.2: una sola notificación clara y tranquilizadora — en vez de un
        // toast de error por cada serie — explicando que NADA se perdió: quedaron
        // guardadas localmente y se sincronizarán solas en cuanto vuelva la conexión.
        if (pendingSyncCount > 0) {
            import('react-hot-toast').then(({ default: t }) =>
                t(`📡 ${pendingSyncCount} serie${pendingSyncCount > 1 ? 's' : ''} sin conexión — se guardaron en tu dispositivo y se sincronizarán solas apenas vuelvas a tener internet. No perdiste nada.`, {
                    duration: 7000,
                    icon: '🔄',
                    style: { background: '#171717', color: '#fff', border: '1px solid rgba(234,179,8,0.3)', fontSize: '11px', fontWeight: 'bold' }
                })
            );
        }

        console.log('🏁 Terminando sesión en DB:', finalSessionId);

        try {
            const flowNotes = `Flujo de Llenado: ${exerciseFillFlow.map(f => f.exerciseName).join(' ➔ ')}`;

            // ── GEO CHECK: verify user remained near their gym for the WHOLE session ──
            // Spec §3: continuous geo-validation — a passing check here can NEVER
            // override evidence (geoLeftRadiusRef) that the user left mid-session.
            let geoVerified: boolean | undefined = undefined;
            if (resolvedGymId) {
                try {
                    const [userPos, gymRow] = await Promise.all([
                        getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 }).catch(() => null),
                        supabase.from('gyms').select('lat, lng').eq('id', resolvedGymId).maybeSingle().then(r => r.data)
                    ]);

                    if (userPos && gymRow?.lat && gymRow?.lng) {
                        const dist = haversineDistance(userPos.lat, userPos.lng, Number(gymRow.lat), Number(gymRow.lng));
                        geoVerified = dist <= 1500; // 1.5 km — margen para GPS indoor
                    }
                    // If GPS unavailable or gym has no coords → final check stays undefined
                    // (the continuous flag below still applies).
                } catch {
                    // geo unavailable at the end → don't punish for transient GPS issues here;
                    // the continuous check below remains authoritative.
                }

                // Continuous validation overrides: leaving the radius at any point during
                // the session disqualifies today's GX/streak, even if the final check passes.
                if (geoLeftRadiusRef.current) {
                    geoVerified = false;
                }

                if (geoVerified === false) {
                    import('react-hot-toast').then(({ default: t }) =>
                        t.error('No permaneciste cerca del gym durante toda la sesión — sin GX/racha por este entrenamiento 📍', {
                            duration: 5000,
                            style: { background: '#171717', color: '#fff', border: '1px solid rgba(239,68,68,0.3)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }
                        })
                    );
                }
            }

            let result: { success: boolean; error?: any };
            let isLastToFinalize = false; // lifted so coop_summary block can read it after the if/else

            if (isMultiplayer && finalSessionId) {
                // ── Phase 5: delay "Historial" visibility until the LAST participant
                // finalizes — determined via DB, not realtime presence.
                // Presence-based checks (p.isOnline) break when a participant navigates
                // to another screen without pressing Finalizar: they appear offline but
                // are still training. The DB is the only reliable source of truth.
                // pendingCount = participants whose finished_at IS NULL (not yet done).
                isLastToFinalize = true;
                let pendingCount = 0;
                if (syncRoomId) {
                    pendingCount = await workoutService.countPendingRoomParticipants(syncRoomId, finalSessionId);
                    isLastToFinalize = pendingCount === 0;
                }

                console.log(`🏁 [${isInviter ? 'Host' : 'Guest'}] Finalizing. isLast=${isLastToFinalize} (pending in DB=${pendingCount})`);

                // Always broadcast our final snapshot so the others freeze our data
                // at exactly what we're about to save.
                if (channelRef.current && user) {
                    const snapshot = activeExercisesRef.current;
                    if (snapshot.length > 0) {
                        await channelRef.current.send({
                            type: 'broadcast',
                            event: 'sync_state',
                            payload: {
                                exercises: snapshot,
                                sender: user.id,
                                knownParticipants: participantsRef.current,
                                routineName: currentRoutineNameRef.current,
                                isRoutineModified: isRoutineModifiedRef.current,
                                finalizedParticipants: [user.id],
                                cancelledParticipants: [...cancelledParticipantsRef.current]
                            }
                        }).catch(e => console.error('Error broadcasting final sync_state:', e));
                    }
                }

                if (isLastToFinalize) {
                    // ── I'm the LAST one — close the room for everyone right now ──────
                    if (isInviter) {
                        console.log('🏁 [Host] Last to finalize — closing room:', finalSessionId);
                        if (channelRef.current && user) {
                            // Notify any straggler guests the room is closing (legacy path —
                            // they pre-save their pending sets on receipt).
                            await channelRef.current.send({
                                type: 'broadcast',
                                event: 'session_finished',
                                payload: { sender: user.id }
                            }).catch(e => console.error('Error broadcasting session_finished:', e));
                        }
                        // skipBroadcast=true: we already sent session_finished above via our live channel.
                        // alreadyFinalizedUserIds: guests who soft-finalized earlier (setFinishedAt=false)
                        // already got their GX/notifications — closeRoom must not double-award them.
                        result = await workoutService.closeRoom(
                            finalSessionId, flowNotes, currentRoutineName, geoVerified, true,
                            [...finalizedParticipantsRef.current]
                        );
                    } else {
                        console.log('🏁 [Guest] Last to finalize — closing room:', finalSessionId);
                        if (channelRef.current && user) {
                            await channelRef.current.send({
                                type: 'broadcast',
                                event: 'participant_left',
                                payload: { sender: user.id }
                            }).catch(e => console.error('Error broadcasting participant_left:', e));
                        }
                        const guestResult = await workoutService.finishSession(finalSessionId, flowNotes, currentRoutineName, true, geoVerified, true);
                        result = guestResult.success ? guestResult : { success: true };

                        // Best-effort: stamp finished_at on the host's + other guests' rows too
                        // (mirrors closeRoom's host→guests bulk update, in reverse). If RLS
                        // blocks cross-user updates this silently no-ops — the room_all_finished
                        // broadcast below is the primary mechanism for connected participants.
                        if (syncRoomId) {
                            await workoutService.finalizeOtherRoomSessions(syncRoomId, finalSessionId).catch(() => {});
                        }
                    }

                    // Tell everyone still on their summary screen (channel still open) to
                    // self-stamp finished_at NOW — this is what makes (c)/(d) work for any
                    // early finisher who hasn't navigated away yet.
                    if (channelRef.current && user) {
                        await channelRef.current.send({
                            type: 'broadcast',
                            event: 'room_all_finished',
                            payload: { sender: user.id, finishedAt: new Date().toISOString() }
                        }).catch(e => console.error('Error broadcasting room_all_finished:', e));
                    }
                } else {
                    // ── NOT the last one — save my data, get my GX now, but keep
                    // finished_at/end_time NULL so I don't show up in "Historial" yet.
                    console.log(`🏃 [${isInviter ? 'Host' : 'Guest'}] Not last — soft-finalizing (waiting for the rest):`, finalSessionId);
                    if (channelRef.current && user) {
                        await channelRef.current.send({
                            type: 'broadcast',
                            event: 'participant_left',
                            payload: { sender: user.id }
                        }).catch(e => console.error('Error broadcasting participant_left:', e));
                    }
                    const softResult = await workoutService.finishSession(finalSessionId, flowNotes, currentRoutineName, true, geoVerified, false);
                    // finishSession(setFinishedAt=false) now sets finished_at immediately,
                    // so getActiveSession() won't find this session → no rescue modal.
                    // end_time stays null until room_all_finished → markSessionFinished.
                    result = softResult.success ? softResult : { success: true };
                }

            } else {
                // ── SOLO: Standard finalization ───────────────────────────────────
                result = await workoutService.finishSession(finalSessionId, flowNotes, currentRoutineName, true, geoVerified);
            }

            localStorage.setItem(`exercise_fill_flow_${finalSessionId}`, JSON.stringify(exerciseFillFlow));

            if (result.success) {
                console.log('✅ Sesión terminada exitosamente');
                localStorage.removeItem(`workout_draft_${finalSessionId}`);
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem('ginx_coop_state');
                sessionStorage.removeItem('ginx_temp_exit_active');

                // ── Persist complete coop summary so History shows all data ──────────
                // This runs only for the LAST participant to finalize — at this point
                // every participant's workout_logs are committed to the DB.
                // We save a snapshot of the full room data to coop_summary on the host
                // session (the room anchor), which all members can read via RLS.
                if (isMultiplayer && multiplayerMode === 'conjunto' && isLastToFinalize) {
                    const coopRoomId = isInviter ? finalSessionId : (syncRoomId || finalSessionId);
                    try {
                        const { data: roomSessions } = await supabase
                            .from('workout_sessions')
                            .select('id, user_id')
                            .or(`id.eq.${coopRoomId},partner_session_id.eq.${coopRoomId}`);

                        if (roomSessions?.length) {
                            const userIds = (roomSessions as any[]).map(s => s.user_id);
                            const { data: profiles } = await supabase
                                .from('profiles')
                                .select('id, username, avatar_url')
                                .in('id', userIds);

                            const participantSummaries = await Promise.all(
                                (roomSessions as any[]).map(async (sess) => {
                                    const { data: logs } = await supabase
                                        .from('workout_logs')
                                        .select(`
                                            exercise_id, set_number, weight_kg, reps, rpe,
                                            time, distance, metrics_data, is_pr, category_snapshot,
                                            exercise:exercises(id, name)
                                        `)
                                        .eq('session_id', sess.id)
                                        .order('exercise_id')
                                        .order('set_number', { ascending: true });

                                    const prof = (profiles || []).find((p: any) => p.id === sess.user_id);
                                    const exMap = new Map<string, any>();
                                    let volume = 0;

                                    for (const log of (logs || []) as any[]) {
                                        const exId = log.exercise_id;
                                        if (!exMap.has(exId)) {
                                            exMap.set(exId, {
                                                exercise_id: exId,
                                                exercise_name: (log.exercise as any)?.name || 'Ejercicio',
                                                muscle_group: log.category_snapshot || 'General',
                                                sets: []
                                            });
                                        }
                                        exMap.get(exId).sets.push({
                                            set_number: log.set_number,
                                            weight_kg: log.weight_kg || 0,
                                            reps: log.reps || 0,
                                            rpe: log.rpe,
                                            time: log.time,
                                            distance: log.distance,
                                            metrics_data: log.metrics_data,
                                            is_pr: log.is_pr || false,
                                            weightUnit: (log.metrics_data as any)?._weight_unit || 'kg'
                                        });
                                        volume += (log.weight_kg || 0) * (log.reps || 0);
                                    }

                                    return {
                                        userId: sess.user_id,
                                        sessionId: sess.id,
                                        username: (prof as any)?.username || 'Participante',
                                        avatarUrl: (prof as any)?.avatar_url || '',
                                        exercises: Array.from(exMap.values()),
                                        volume: Math.round(volume),
                                        status: 'finished'
                                    };
                                })
                            );

                            await supabase
                                .from('workout_sessions')
                                .update({ coop_summary: participantSummaries })
                                .eq('id', coopRoomId);

                            console.log('✅ [CoopSummary] Guardado en DB para', participantSummaries.length, 'participantes');
                        }
                    } catch (e) {
                        console.warn('⚠️ [CoopSummary] Error guardando (no bloquea):', e);
                    }
                }

                // Go directly to summary — no waiting screen.
                setTimeout(() => {
                    setLoading(false);
                    isLeavingPageRef.current = true;
                    setShowSummary(true);
                }, 300);
            } else {
                console.error('❌ Error terminando sesión:', result.error);
                setLoading(false);
                setIsFinished(false);
                setIsFinalizing(false);
            }
        } catch (error) {
            console.error('❌ Exception terminando sesión:', error);
            setLoading(false);
            setIsFinished(false);
            setIsFinalizing(false);
        }
    };

    // Removed redundant loading screen to speed up startup as per user request
    // Intro animation now covers background loading

    return (
        <div className="min-h-screen bg-neutral-950 text-white pb-32 relative overflow-hidden">

            {/* AMBIGUOUS GYMS MODAL */}
            {ambiguousGyms.length > 0 && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-[2rem] w-full max-w-sm text-center shadow-2xl relative overflow-hidden flex flex-col gap-6">
                        <div>
                            <div className="w-16 h-16 bg-gym-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-gym-primary/20">
                                <MapIcon className="text-gym-primary w-8 h-8" />
                            </div>
                            {ambiguousReason === 'multiple_defaults' ? (
                                <>
                                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">¿En cuál entrenas?</h2>
                                    <p className="text-neutral-400 text-sm">Tienes varios gyms predeterminados cerca. Elige uno para esta sesión.</p>
                                    <p className="text-neutral-600 text-xs mt-1">Para no volver a ver esto, deja un único predeterminado desde <span className="text-yellow-500">Mis Gyms</span>.</p>
                                </>
                            ) : ambiguousReason === 'pick_for_today' ? (
                                <>
                                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">¿Dónde entrenas hoy?</h2>
                                    <p className="text-neutral-400 text-sm">Detectamos gyms de tu pasaporte cerca, pero distintos a tu Sede Principal.</p>
                                    <p className="text-neutral-600 text-xs mt-1">Esta elección es solo para hoy — tu predeterminado no cambiará.</p>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Selecciona tu Base</h2>
                                    <p className="text-neutral-400 text-sm">Hemos detectado gymnasios de tu pasaporte cerca. El que elijas se guardará como predeterminado.</p>
                                </>
                            )}
                        </div>

                        <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                            {ambiguousGyms.map(gym => (
                                <button
                                    key={gym.id}
                                    onClick={() => (window as any).__handleSelectAmbiguousGym?.(gym)}
                                    className="w-full bg-black hover:bg-neutral-800 border border-white/10 hover:border-gym-primary/50 rounded-xl p-4 flex items-center justify-between group transition-all text-left"
                                >
                                    <div>
                                        <div className="text-white font-bold text-sm group-hover:text-gym-primary transition-colors">{gym.name}</div>
                                        <div className="text-neutral-500 text-xs">A {Math.round(gym.dist * 1000)}m</div>
                                    </div>
                                    <Check className="text-gym-primary opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => {
                                setAmbiguousGyms([]);
                                setAmbiguousReason(null);
                                setResolvedGymId(null);
                                setDetectedGymName("Entrenamiento Libre");
                            }}
                            className="w-full bg-transparent border border-neutral-800 text-neutral-400 font-bold uppercase py-3 rounded-xl hover:text-white hover:border-white transition-colors"
                        >
                            Entrenar Libre (Sin Gym)
                        </button>
                    </div>
                </div>
            )}

            {/* 0. INTRO ANIMATION — hidden during finish/summary to prevent black-screen flash */}
            {showIntroAnim && !isFinished && !isFinalizing && !showSummary && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-out fade-out duration-300 delay-700">
                    <div className="flex flex-col items-center gap-8 px-6 text-center">
                        {/* Map Icon (Gold) */}
                        <div className="relative">
                            <MapIcon size={100} className="text-gym-primary fill-gym-primary/10 animate-pulse" strokeWidth={1.5} />
                            <div className="absolute inset-0 bg-gym-primary/20 blur-2xl rounded-full" />
                        </div>

                        {/* Text Content */}
                        <div className="space-y-2">
                            <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-[0.15em] text-white animate-in slide-in-from-bottom-2 duration-500">
                                INICIANDO
                            </h2>
                            <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-[0.15em] text-white animate-in slide-in-from-bottom-3 duration-600">
                                ENTRENAMIENTO
                            </h2>
                            <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-wider text-gym-primary animate-in fade-in duration-500">
                                {detectedGymName}
                            </h3>
                        </div>

                        {/* Animated Dots */}
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-gym-primary animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-3 h-3 rounded-full bg-gym-primary animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-3 h-3 rounded-full bg-gym-primary animate-bounce" />
                        </div>
                    </div>
                </div>
            )}
            {/* Background Ambient Effects */}
            <div className="fixed top-0 left-0 w-full h-1/2 bg-gradient-to-b from-red-900/10 to-transparent pointer-events-none" />

            {/* Multiplayer Coop Header */}
            {isMultiplayer && (
                <div className="fixed top-0 left-0 w-full z-[80] bg-neutral-950/80 backdrop-blur-md border-b border-yellow-500/20 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center -space-x-2.5">
                            {participants.map((p, idx) => (
                                <div key={p.id} className="relative group shrink-0" style={{ zIndex: 10 - idx }}>
                                    {p.avatarUrl ? (
                                        <img 
                                            src={p.avatarUrl} 
                                            alt={p.username} 
                                            className="w-9 h-9 rounded-full object-cover border-2 border-yellow-500/50 shadow-[0_0_8px_rgba(250,204,21,0.15)] bg-neutral-950" 
                                        />
                                    ) : (
                                        <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center border-2 border-yellow-500/40 shadow-[0_0_8px_rgba(250,204,21,0.15)] bg-neutral-950">
                                            <span className="text-[10px] font-black text-yellow-500 uppercase">{p.username?.[0] || 'G'}</span>
                                        </div>
                                    )}
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-neutral-950 rounded-full animate-pulse" title="En línea" />
                                    {/* Tooltip on Hover */}
                                    <div className="absolute top-10 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-black/95 border border-white/10 text-white text-[9px] font-bold py-1 px-2 rounded-md shadow-xl transition-all pointer-events-none whitespace-nowrap z-50">
                                        {p.username || 'Guerrero'}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <h3 className="text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <span className="text-yellow-500 font-extrabold">OPEN LOBBY</span> ({participants.length}/8)
                            </h3>
                            <p className="text-neutral-400 text-[8px] font-black uppercase tracking-tight">Gimnasio Multijugador Activo</p>
                        </div>
                    </div>
                    {multiplayerMode === 'separado' && (
                        <button
                            onClick={() => setViewingMode(v => v === 'mine' ? 'partner' : 'mine')}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-colors ${viewingMode === 'partner' ? 'bg-yellow-500 text-black border-yellow-500 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-neutral-900 text-yellow-500 border-yellow-500/30 hover:bg-neutral-800'}`}
                        >
                            {viewingMode === 'mine' ? 'ESPIAR COMPAÑERO' : 'VOLVER A MI RUTINA'}
                        </button>
                    )}
                </div>
            )}

            <div className={`p-4 relative z-10 ${isMultiplayer ? 'pt-16' : ''}`}>
                {/* Empty State / Routine Selection */}
                {/* Empty State / Fallback if Modal is Closed */}
                {/* Guests NEVER see the catalog — they wait for the host's sync_state.
                    Adding !(isMultiplayer && !isInviter) prevents the "flash" where
                    the empty state renders for a moment before exercises arrive. */}
                {activeExercises.length === 0 && !showAddModal && !loading && !showIntroAnim && !(isMultiplayer && !isInviter) && (
                    <div className="h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
                        <div className="bg-neutral-900/50 p-8 rounded-full border border-neutral-800 mb-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                            <Swords size={80} className="text-neutral-600" strokeWidth={1} />
                        </div>
                        <h2 className="text-3xl font-black italic uppercase text-white mb-4 tracking-tighter">¿Listo para entrenar?</h2>
                        <p className="text-neutral-500 font-bold mb-8 max-w-xs mx-auto text-sm">
                            {isMultiplayer ? "Cualquier aliado puede seleccionar los ejercicios o abrir el catálogo para comenzar la batalla." : "Selecciona tus ejercicios para comenzar la batalla."}
                        </p>

                        <button
                            onClick={() => setShowAddModal(true)}
                            className="w-full max-w-xs bg-gym-primary hover:bg-yellow-400 text-black font-black uppercase tracking-widest py-5 rounded-2xl shadow-[0_0_30px_rgba(250,204,21,0.3)] hover:scale-105 transition-all text-xl flex items-center justify-center gap-3"
                        >
                            <Plus size={24} strokeWidth={3} />
                            ABRIR CATÁLOGO
                        </button>
                    </div>
                )}

                {/* Active Exercises List - NOW CAROUSEL */}
                {(() => {
                    const displayedExercises = viewingMode === 'partner' ? partnerExercises : activeExercises;
                    return displayedExercises.length > 0 && (
                    <div className="h-[calc(100vh-140px)] flex flex-col"> {/* Fixed height for carousel */}

                        {/* BATTLE HEADER & TIMER */}
                        <div className="flex items-center justify-between mb-2 px-4 shrink-0 relative">
                            {/* Replaced Title with Menu Options */}
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setShowExitMenu(!showExitMenu)}
                                    className="bg-neutral-900 p-2 rounded-full border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
                                >
                                    {showExitMenu ? <X size={20} /> : <MoreVertical size={20} />}
                                </button>
                                <span className="text-[10px] text-neutral-500 font-bold uppercase leading-tight max-w-[80px]">
                                    Cancelar / Reiniciar
                                </span>

                                {!showExitMenu && (
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">
                                            {currentExerciseIndex + 1} / {displayedExercises.length}
                                        </h2>
                                    </div>
                                )}
                            </div>

                            {/* Timer */}
                            <div className="bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-full flex items-center gap-3 shadow-lg">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="font-mono font-bold text-xl text-white tracking-widest">{elapsedTime}</span>
                            </div>

                            {/* OPTION MENU OVERLAY */}
                            {showExitMenu && (
                                <div className="absolute top-14 left-4 z-50 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-2 w-48 flex flex-col gap-1 animate-in slide-in-from-top-2">
                                    {/* spec §1.2 línea 45: "...pausar la sesión completa..." */}
                                    <button
                                        onClick={isSessionPaused ? handleResumeSession : handlePauseSession}
                                        className="flex items-center gap-3 w-full p-3 text-left text-sm font-bold text-white hover:bg-neutral-800 rounded-lg transition-colors"
                                    >
                                        {isSessionPaused
                                            ? <><Play size={16} fill="currentColor" /> Reanudar sesión</>
                                            : <><Pause size={16} /> Pausar sesión</>}
                                    </button>
                                    <button
                                        onClick={handleRestartSession}
                                        className="flex items-center gap-3 w-full p-3 text-left text-sm font-bold text-white hover:bg-neutral-800 rounded-lg transition-colors"
                                    >
                                        <RotateCcw size={16} /> Reiniciar
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowExitMenu(false);
                                            setShowForceExitModal(true);
                                        }}
                                        className="flex items-center gap-3 w-full p-3 text-left text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <X size={16} /> Cancelar / Salir
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* PAUSE OVERLAY — spec §1.2 líneas 45/49: "pausar la sesión completa...
                            conserva exactamente los datos y el tiempo transcurrido". Bloquea
                            el registro mientras está en pausa; el reloj queda congelado al
                            valor exacto (ver Timer Effect, que resta el tiempo pausado) y
                            continúa sin saltos ni duplicaciones al pulsar "Reanudar". */}
                        {isSessionPaused && (
                            <div className="fixed inset-0 z-[180] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
                                <div className="bg-neutral-900 border border-yellow-500/20 p-8 rounded-[2rem] w-full max-w-sm text-center shadow-2xl flex flex-col items-center gap-6">
                                    <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/30">
                                        <Pause className="text-yellow-500 w-8 h-8" fill="currentColor" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Sesión en pausa</h2>
                                        <p className="text-neutral-400 text-sm">Tu progreso y el tiempo transcurrido quedan exactamente como están — nada se pierde ni se duplica al reanudar.</p>
                                    </div>
                                    <div className="bg-neutral-800/50 border border-neutral-700 rounded-2xl px-6 py-3">
                                        <span className="font-mono font-bold text-2xl text-white tracking-widest">{elapsedTime}</span>
                                    </div>
                                    <button
                                        onClick={handleResumeSession}
                                        className="w-full bg-gym-primary hover:bg-gym-primary/90 text-black font-black uppercase italic tracking-tighter py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Play size={18} fill="currentColor" /> Reanudar entrenamiento
                                    </button>
                                </div>
                            </div>
                        )}

                        <WorkoutCarousel
                            currentIndex={currentExerciseIndex}
                            onIndexChange={setCurrentExerciseIndex}
                        >
                            {displayedExercises.map((exercise, mapIndex) => {
                                const isReadOnly = viewingMode === 'partner';
                                const canModifyStructure = !isReadOnly;
                                return (
                                <div key={exercise.id} className="h-full flex flex-col bg-neutral-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl mx-1 relative">
                                    {/* Header */}
                                    <div className="p-4 flex justify-between items-start bg-white/5 border-b border-white/5 shrink-0">
                                        <div className="flex-1 min-w-0">
                                            {/* Exercise name — full name including variant, no change-variant button.
                                                Variants are selected in the catalog. During training the name is fixed. */}
                                            <h3 className="text-2xl font-black italic uppercase text-white leading-tight truncate">
                                                {exercise.equipmentName}
                                            </h3>
                                            {canModifyStructure && (
                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        onClick={() => removeExercise(exercise.id)}
                                                        className="text-neutral-500 hover:text-red-500 transition-colors bg-neutral-800/50 p-2 rounded-lg"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sets Container - Scrollable part */}
                                    <div className="flex-1 overflow-y-auto p-2 pb-20">
                                        {/* Header Row REMOVED - Using individual input labels now */}

                                        <div className="space-y-2">
                                            {exercise.sets.map((set, setIndex) => {
                                                const isCompleted = set.completed;
                                                return (
                                                    <Fragment key={set.id}>
                                                        <div
                                                            className={`relative flex flex-wrap gap-1 px-1.5 py-2.5 rounded-xl transition-all duration-300 items-center ${isCompleted
                                                                ? 'bg-neutral-900/80 border border-green-500/20'
                                                                : 'bg-black/20 border border-transparent'
                                                                }`}
                                                        >
                                                            {/* [MOVED] Delete Set Button - Top Left */}
                                                            {canModifyStructure && (
                                                            <button
                                                                onClick={() => removeSet(mapIndex, setIndex)}
                                                                className="absolute -top-2 -left-2 bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-red-500 rounded-full p-1.5 shadow-lg z-10 scale-75 hover:scale-100 transition-all"
                                                                title="Eliminar Serie"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                            )}
                                                            {/* Set Number */}
                                                            <div className="w-5 flex justify-center shrink-0 self-center">
                                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] ${isCompleted ? 'bg-green-500/20 text-green-500' : 'bg-neutral-800 text-neutral-400'
                                                                    }`}>
                                                                    {setIndex + 1}
                                                                </div>
                                                            </div>

                                                            {/* Inputs Container */}
                                                            <div className="flex-1 flex flex-col gap-2.5 min-w-0">
                                                                
                                                                {/* Table Header (Rendered once at the top of the set) */}
                                                                <div className="flex items-center gap-1 text-[10px] font-black text-neutral-500 uppercase tracking-wider px-1">
                                                                    {(isMultiplayer && multiplayerMode === 'conjunto') && (
                                                                        <div className="min-w-[65px] max-w-[65px] text-center">ATLETA</div>
                                                                    )}
                                                                    {exercise.metrics.weight && (
                                                                        <div className="min-w-[70px] w-[70px] text-center cursor-pointer hover:text-gym-primary transition-colors" onClick={() => !isReadOnly && toggleExerciseUnit(mapIndex)}>
                                                                            PESO ({(exercise.weightUnit || 'kg').toUpperCase()})
                                                                        </div>
                                                                    )}
                                                                    {exercise.metrics.reps && (
                                                                        <div className="min-w-[70px] w-[70px] text-center">REPS</div>
                                                                    )}
                                                                    {exercise.metrics.time && (
                                                                        <div className="min-w-[70px] w-[70px] text-center">TIEMPO</div>
                                                                    )}
                                                                    {exercise.metrics.distance && (
                                                                        <div className="min-w-[70px] w-[70px] text-center">DIST</div>
                                                                    )}
                                                                                                                                        {exercise.metrics.rpe && (
                                                                        <div className="min-w-[60px] w-[60px] text-center">RPE</div>
                                                                    )}
                                                                    {Object.keys(exercise.metrics).map(key => {
                                                                        if (['weight', 'reps', 'time', 'distance', 'rpe'].includes(key)) return null;
                                                                        if (!exercise.metrics[key as keyof typeof exercise.metrics]) return null;
                                                                        return (
                                                                            <div key={key} className="min-w-[70px] w-[70px] text-center truncate">{key.toUpperCase()}</div>
                                                                        );
                                                                    })}
                                                                    <div className="flex-1 text-right">LISTO</div>
                                                                </div>

                                                                {/* Player Rows */}
                                                                {((isMultiplayer && multiplayerMode === 'conjunto') ? participants : [{ id: user?.id || 'single-user', username: 'Yo' }]).map((p, pIdx) => {
                                                                    const myName = user?.user_metadata?.full_name || user?.user_metadata?.username || user?.user_metadata?.name || 'Yo';
                                                                    const pName = p.id === user?.id ? myName : (p.username || 'Guerrero');
                                                                    const displayName = pName ? pName.split(' ')[0].substring(0, 10) + (pName.split(' ')[0].length > 10 ? '...' : '') : 'Jugador';
                                                                    const isMyRow = p.id === user?.id;
                                                                    const rowReadOnly = isReadOnly;

                                                                    const isHost = p.id === (isInviter ? user?.id : partnerId);
                                                                    const isFirstGuest = p.id === firstGuestId;

                                                                    // NOTE: A participant going offline (isOnline: false) due to screen lock
                                                                    // is a TEMPORARY connection drop — it must NEVER block data entry for other
                                                                    // participants. Only an explicit playerLocked flag or read-only mode can do that.
                                                                    // isAbandoned is intentionally NOT used to disable inputs.

                                                                    // Finalized participants (who left early) have no playerXxx entry in sets
                                                                    // added after they left → show 0 (renders as empty/"−") instead of the
                                                                    // stale scalar fallback value.
                                                                    // Use state (not ref) so React re-renders when a participant finalizes
                                                                    const isFinalizedPlayer = finalizedParticipantsState.has(p.id);
                                                                    // Ghost slot: set was added AFTER this player finalized — no data initialised.
                                                                    // Both cases render a <div> instead of <input> (no editable element at all):
                                                                    //   • ghost  → shows "-"
                                                                    //   • frozen → shows the real value the player recorded before leaving
                                                                    const isGhostSlot = isFinalizedPlayer && (
                                                                        set.playerWeights?.[p.id] === undefined &&
                                                                        set.playerReps?.[p.id] === undefined &&
                                                                        set.playerTimes?.[p.id] === undefined &&
                                                                        set.playerDistances?.[p.id] === undefined &&
                                                                        set.playerRpes?.[p.id] === undefined
                                                                    );
                                                                    const rowWeight = (isFinalizedPlayer && set.playerWeights?.[p.id] === undefined) ? 0 : safeNum(set.playerWeights?.[p.id] ?? (isHost ? set.weight : (isFirstGuest ? (set.p2_weight || 0) : 0)), 0);
                                                                    const rowReps = (isFinalizedPlayer && set.playerReps?.[p.id] === undefined) ? 0 : safeNum(set.playerReps?.[p.id] ?? (isHost ? set.reps : (isFirstGuest ? (set.p2_reps || 0) : 0)), 0);
                                                                    const rowTime = (isFinalizedPlayer && set.playerTimes?.[p.id] === undefined) ? 0 : safeNum(set.playerTimes?.[p.id] ?? (isHost ? set.time : (isFirstGuest ? (set.p2_time || 0) : 0)), 0);
                                                                    const rowDistance = (isFinalizedPlayer && set.playerDistances?.[p.id] === undefined) ? 0 : safeNum(set.playerDistances?.[p.id] ?? (isHost ? set.distance : (isFirstGuest ? (set.p2_distance || 0) : 0)), 0);
                                                                    const rowRpe = (isFinalizedPlayer && set.playerRpes?.[p.id] === undefined) ? 0 : safeNum(set.playerRpes?.[p.id] ?? (isHost ? set.rpe : (isFirstGuest ? (set.p2_rpe || 0) : 0)), 0);
                                                                    const rowCompleted = set.playerCompleted?.[p.id] ?? (isHost ? set.completed : (isFirstGuest ? (set.p2_completed || false) : false));
                                                                    // Finalized participants are always locked, even for sets added after they left
                                                                    const rowLocked = !!(set.playerLocked?.[p.id] ?? (isHost ? set.locked : (isFirstGuest ? (set.p2_locked || false) : false))) || isFinalizedPlayer;
                                                                    const rowCompletedAt = set.playerCompletedAt?.[p.id] ?? (isHost ? set.completedAt : (isFirstGuest ? set.p2_completedAt : undefined));
                                                                    
                                                                    // Disable inputs if: explicitly locked, read-only mode,
                                                                    // OR the participant deliberately temp-exited (not just screen-lock offline).
                                                                    const isTempExited = tempExitedUsers.has(p.id) && p.id !== user?.id;
                                                                    const inputDisabled = rowLocked || rowReadOnly || isTempExited;
                                                                    const lockToggleDisabled = rowReadOnly;

                                                                    return (
                                                                        <div key={p.id} className={`flex items-center gap-1 w-full flex-nowrap ${pIdx > 0 ? 'mt-1 pt-2 border-t border-white/5' : ''}`}>
                                                                            {/* Premium Name Tag column on the left of each row */}
                                                                            {(isMultiplayer && multiplayerMode === 'conjunto') && (
                                                                                <div className={`flex flex-col items-center justify-center min-w-[65px] max-w-[65px] bg-neutral-900/60 py-1.5 px-1.5 rounded-lg shadow-md transition-all ${
                                                                                    isMyRow
                                                                                        ? 'border border-gym-primary/40 bg-gym-primary/10 shadow-gym-primary/5'
                                                                                        : isTempExited
                                                                                            ? 'border border-orange-500/30 bg-orange-500/5'
                                                                                            : 'border border-white/5'
                                                                                }`}>
                                                                                    <span className={`text-[9px] font-black tracking-tight uppercase truncate text-center w-full transition-colors ${
                                                                                        isMyRow ? 'text-gym-primary font-bold' : isTempExited ? 'text-orange-400' : 'text-neutral-400'
                                                                                    }`}>
                                                                                        {displayName}
                                                                                    </span>
                                                                                    {isTempExited && (
                                                                                        <span className="text-[7px] text-orange-400/80 font-bold uppercase tracking-widest">Fuera</span>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {exercise.metrics.weight && (
                                                                                <div className="min-w-[70px] w-[70px]">
                                                                                    {isFinalizedPlayer ? (
                                                                                        <div className="w-full bg-neutral-900/40 text-center font-black text-[16px] rounded-lg py-2 text-neutral-500 select-none">
                                                                                            {isGhostSlot ? '-' : (rowWeight > 0 ? toDisplayWeight(rowWeight, exercise.weightUnit || 'kg') : '0')}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <input
                                                                                            type="number"
                                                                                            inputMode={(exercise.weightUnit || 'kg') === 'lb' ? 'numeric' : 'decimal'}
                                                                                            step={(exercise.weightUnit || 'kg') === 'lb' ? '1' : 'any'}
                                                                                            min={0}
                                                                                            max={(exercise.weightUnit || 'kg') === 'lb' ? 1999 : 999}
                                                                                            disabled={inputDisabled}
                                                                                            data-player-id={p.id}
                                                                                            data-set-index={setIndex}
                                                                                            data-exercise-index={mapIndex}
                                                                                            value={rowWeight === 0 ? '' : toDisplayWeight(rowWeight, exercise.weightUnit || 'kg')}
                                                                                            onChange={(e) => updatePlayerSet(mapIndex, setIndex, p.id, 'weight', toInternalWeight(e.target.value, exercise.weightUnit || 'kg'))}
                                                                                            onBlur={(e) => handlePlayerInputBlur(mapIndex, setIndex, p.id, e)}
                                                                                            onKeyDown={(e) => handleInputKeyDown(mapIndex, setIndex, e)}
                                                                                            className={`w-full bg-neutral-800 text-center font-black text-[16px] rounded-lg py-2 focus:ring-2 focus:ring-gym-primary outline-none transition-all ${rowCompleted ? 'text-neutral-500 bg-neutral-900/40' : 'text-white'} ${rowLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                                            placeholder="0"
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {exercise.metrics.reps && (
                                                                                <div className="min-w-[70px] w-[70px]">
                                                                                    {isFinalizedPlayer ? (
                                                                                        <div className="w-full bg-neutral-900/40 text-center font-black text-[16px] rounded-lg py-2 text-neutral-500 select-none">
                                                                                            {isGhostSlot ? '-' : String(rowReps)}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <input
                                                                                            type="number"
                                                                                            inputMode="numeric"
                                                                                            disabled={inputDisabled}
                                                                                            data-player-id={p.id}
                                                                                            data-set-index={setIndex}
                                                                                            data-exercise-index={mapIndex}
                                                                                            value={rowReps === 0 ? '' : rowReps}
                                                                                            onChange={(e) => updatePlayerSet(mapIndex, setIndex, p.id, 'reps', e.target.value)}
                                                                                            onBlur={(e) => handlePlayerInputBlur(mapIndex, setIndex, p.id, e)}
                                                                                            onKeyDown={(e) => handleInputKeyDown(mapIndex, setIndex, e)}
                                                                                            className={`w-full bg-neutral-800 text-center font-black text-[16px] rounded-lg py-2 focus:ring-2 focus:ring-gym-primary outline-none transition-all ${rowCompleted ? 'text-neutral-500 bg-neutral-900/40' : 'text-white'} ${rowLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                                            placeholder="0"
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {exercise.metrics.time && (
                                                                                <div className="min-w-[70px] w-[70px]">
                                                                                    {isFinalizedPlayer ? (
                                                                                        <div className="w-full bg-neutral-900/40 text-center font-black text-[16px] rounded-lg py-2 text-neutral-500 select-none">
                                                                                            {isGhostSlot ? '-' : String(rowTime)}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <input
                                                                                            type="number"
                                                                                            inputMode="numeric"
                                                                                            disabled={inputDisabled}
                                                                                            data-player-id={p.id}
                                                                                            data-set-index={setIndex}
                                                                                            data-exercise-index={mapIndex}
                                                                                            value={rowTime === 0 ? '' : rowTime}
                                                                                            onChange={(e) => updatePlayerSet(mapIndex, setIndex, p.id, 'time', e.target.value)}
                                                                                            onBlur={(e) => handlePlayerInputBlur(mapIndex, setIndex, p.id, e)}
                                                                                            onKeyDown={(e) => handleInputKeyDown(mapIndex, setIndex, e)}
                                                                                            className="w-full bg-neutral-800 text-center font-black text-[16px] rounded-lg py-2 text-white placeholder-white/20 focus:ring-2 focus:ring-gym-primary outline-none"
                                                                                            placeholder="0s"
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {exercise.metrics.distance && (
                                                                                <div className="min-w-[70px] w-[70px]">
                                                                                    {isFinalizedPlayer ? (
                                                                                        <div className="w-full bg-neutral-900/40 text-center font-black text-[16px] rounded-lg py-2 text-neutral-500 select-none">
                                                                                            {isGhostSlot ? '-' : String(rowDistance)}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <input
                                                                                            type="number"
                                                                                            inputMode="decimal"
                                                                                            disabled={inputDisabled}
                                                                                            data-player-id={p.id}
                                                                                            data-set-index={setIndex}
                                                                                            data-exercise-index={mapIndex}
                                                                                            value={rowDistance === 0 ? '' : rowDistance}
                                                                                            onChange={(e) => updatePlayerSet(mapIndex, setIndex, p.id, 'distance', e.target.value)}
                                                                                            onBlur={(e) => handlePlayerInputBlur(mapIndex, setIndex, p.id, e)}
                                                                                            onKeyDown={(e) => handleInputKeyDown(mapIndex, setIndex, e)}
                                                                                            className="w-full bg-neutral-800 text-center font-black text-[16px] rounded-lg py-2 text-white placeholder-white/20 focus:ring-2 focus:ring-gym-primary outline-none"
                                                                                            placeholder="0m"
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {exercise.metrics.rpe && (
                                                                                <div className="min-w-[60px] w-[60px]">
                                                                                    {isFinalizedPlayer ? (
                                                                                        <div className="w-full bg-neutral-900/40 text-center font-black text-[16px] rounded-lg py-2 text-neutral-500 select-none">
                                                                                            {isGhostSlot ? '-' : (rowRpe > 0 ? String(rowRpe) : '-')}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <input
                                                                                            type="number"
                                                                                            inputMode="numeric"
                                                                                            max={10}
                                                                                            disabled={inputDisabled}
                                                                                            data-player-id={p.id}
                                                                                            data-set-index={setIndex}
                                                                                            data-exercise-index={mapIndex}
                                                                                            value={rowRpe === 0 ? '' : rowRpe}
                                                                                            onChange={(e) => updatePlayerSet(mapIndex, setIndex, p.id, 'rpe', e.target.value)}
                                                                                            onBlur={(e) => handlePlayerInputBlur(mapIndex, setIndex, p.id, e)}
                                                                                            onKeyDown={(e) => handleInputKeyDown(mapIndex, setIndex, e)}
                                                                                            className="w-full bg-neutral-800 text-center font-black text-[16px] rounded-lg py-2 text-white placeholder-white/20 focus:ring-2 focus:ring-gym-primary outline-none"
                                                                                            placeholder="-"
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {Object.keys(exercise.metrics).map(key => {
                                                                                if (['weight', 'reps', 'time', 'distance', 'rpe'].includes(key)) return null;
                                                                                if (!exercise.metrics[key as keyof typeof exercise.metrics]) return null;
                                                                                return (
                                                                                    <div key={key} className="min-w-[75px] w-[75px]">
                                                                                        {isFinalizedPlayer ? (
                                                                                            <div className="w-full bg-neutral-900/40 text-center font-black text-[16px] rounded-lg py-2 text-neutral-500 select-none">-</div>
                                                                                        ) : (
                                                                                            <input
                                                                                                type="number"
                                                                                                inputMode="decimal"
                                                                                                disabled={inputDisabled}
                                                                                                data-player-id={p.id}
                                                                                                data-set-index={setIndex}
                                                                                                data-exercise-index={mapIndex}
                                                                                                value={set.custom?.[key] || ''}
                                                                                                onChange={(e) => updateSet(mapIndex, setIndex, key, e.target.value, true)} // isCustom=true
                                                                                                onBlur={(e) => handlePlayerInputBlur(mapIndex, setIndex, p.id, e)}
                                                                                                onKeyDown={(e) => handleInputKeyDown(mapIndex, setIndex, e)}
                                                                                                className="w-full bg-neutral-800 text-center font-black text-[16px] rounded-lg py-2 text-white focus:ring-2 focus:ring-gym-primary outline-none"
                                                                                            />
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}

                                                                            {/* Actions Column (Palomita/Lock/Time) - Kept tightly aligned */}
                                                                            <div className="flex-1 flex items-center justify-end gap-1.5 min-w-[60px] pl-1">
                                                                                {isGhostSlot ? (
                                                                                    // Ghost slot: player finalized before this set was added — no action available
                                                                                    <span className="text-neutral-700 font-black text-[16px] select-none pr-1">-</span>
                                                                                ) : (
                                                                                    <>
                                                                                        <button
                                                                                            onClick={() => togglePlayerSetComplete(mapIndex, setIndex, p.id)}
                                                                                            disabled={inputDisabled}
                                                                                            className={`p-1.5 rounded-full border-2 transition-all shrink-0 ${rowCompleted
                                                                                                ? rowLocked
                                                                                                    ? 'bg-neutral-800 border-neutral-700 text-neutral-500 cursor-not-allowed opacity-80'
                                                                                                    : 'bg-green-500 border-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                                                                                                : 'bg-transparent border-neutral-700 text-neutral-600 hover:border-neutral-500'
                                                                                                }`}
                                                                                            title={rowLocked ? "Desbloquea primero" : (rowCompleted ? "Marcar incompleto" : "Marcar listo")}
                                                                                        >
                                                                                            <Check size={14} strokeWidth={4} />
                                                                                        </button>

                                                                                        {(rowCompleted && !rowReadOnly) && (
                                                                                            <button
                                                                                                onClick={() => togglePlayerLock(mapIndex, setIndex, p.id)}
                                                                                                disabled={lockToggleDisabled}
                                                                                                className={`p-1 rounded-full transition-colors shrink-0 ${rowLocked ? 'text-red-500 bg-red-500/10' : 'text-neutral-500 hover:text-white'} ${lockToggleDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                                                                title={rowLocked ? "Desbloquear para editar" : "Bloquear"}
                                                                                            >
                                                                                                {rowLocked ? <Lock size={12} /> : <LockOpen size={12} />}
                                                                                            </button>
                                                                                        )}

                                                                                        {rowCompleted && rowCompletedAt && (
                                                                                            <span className="text-[8px] font-black text-green-500 tabular-nums tracking-tighter shrink-0 bg-green-500/10 px-1 py-0.5 rounded">
                                                                                                {(() => {
                                                                                                    const completedTime = parseTimestamp(rowCompletedAt);
                                                                                                    if (completedTime <= 0) return '00:00';
                                                                                                    const start = startTime?.getTime() || Date.now();
                                                                                                    const diff = completedTime - start;
                                                                                                    if (diff < 0) return '00:00';
                                                                                                    const m = Math.floor(diff / 60000);
                                                                                                    const s = Math.floor((diff % 60000) / 1000);
                                                                                                    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                                                                                })()}
                                                                                            </span>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                            {(() => {
                                                                const activeParticipants = (isMultiplayer && multiplayerMode === 'conjunto') ? participants : [{ id: user?.id || 'single-user', username: 'Yo' }];
                                                            const timersCount = activeParticipants.filter(p => {
                                                                const isHost = p.id === (isInviter ? user?.id : partnerId);
                                                                const isFirstGuest = p.id === firstGuestId;
                                                                const pCompleted = set.playerCompleted?.[p.id] ?? (isHost ? set.completed : (isFirstGuest ? (set.p2_completed || false) : false));
                                                                const pRestStatus = set.playerRestStatus?.[p.id] ?? (isHost ? set.restStatus : (isFirstGuest ? (set.p2_restStatus || 'idle') : 'idle'));
                                                                return pCompleted && (pRestStatus === 'running' || pRestStatus === 'paused' || pRestStatus === 'completed');
                                                            }).length;

                                                            if (timersCount === 0) return null;

                                                            if (isMultiplayer && multiplayerMode === 'conjunto') {
                                                                return (
                                                                    <div className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-2 mt-1 animate-in fade-in slide-in-from-top-2">
                                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full items-center">
                                                                            {activeParticipants.map((p, pIdx) => {
                                                                                const isMyTimer = p.id === user?.id;
                                                                                const isHost = p.id === (isInviter ? user?.id : partnerId);
                                                                                const isFirstGuest = p.id === firstGuestId;

                                                                                const pRestStatus = set.playerRestStatus?.[p.id] ?? (isHost ? set.restStatus : (isFirstGuest ? (set.p2_restStatus || 'idle') : 'idle'));
                                                                                const pRestAccumulated = set.playerRestAccumulated?.[p.id] ?? (isHost ? set.restAccumulated : (isFirstGuest ? (set.p2_restAccumulated || 0) : 0));
                                                                                const pRestLastStartTime = set.playerRestLastStartTime?.[p.id] ?? (isHost ? set.restLastStartTime : (isFirstGuest ? set.p2_restLastStartTime : undefined));
                                                                                const pCompleted = set.playerCompleted?.[p.id] ?? (isHost ? set.completed : (isFirstGuest ? (set.p2_completed || false) : false));

                                                                                const hasTimer = pCompleted && (pRestStatus === 'running' || pRestStatus === 'paused' || pRestStatus === 'completed');
                                                                                
                                                                                const myName = user?.user_metadata?.full_name || user?.user_metadata?.username || user?.user_metadata?.name || 'Yo';
                                                                                const pName = p.id === user?.id ? myName : (p.username || 'Guerrero');
                                                                                const displayName = pName ? pName.split(' ')[0].substring(0, 10) + (pName.split(' ')[0].length > 10 ? '...' : '') : 'Jugador';

                                                                                return (
                                                                                    <div key={p.id} className="flex justify-center w-full">
                                                                                        {hasTimer ? (
                                                                                            <div className={`flex items-center justify-center gap-1.5 px-2 py-1 rounded-md w-full ${isMyTimer ? 'bg-gym-primary/5 border border-gym-primary/20' : 'bg-neutral-800/30'}`}>
                                                                                                <span className={`text-[8px] uppercase tracking-wider truncate max-w-[50px] ${
                                                                                                    isMyTimer ? 'text-gym-primary font-black' : 'text-neutral-500 font-bold'
                                                                                                }`}>
                                                                                                    {displayName}
                                                                                                </span>
                                                                                                <RestTimerDisplay
                                                                                                    status={pRestStatus}
                                                                                                    accumulated={pRestAccumulated}
                                                                                                    lastStartTime={pRestLastStartTime}
                                                                                                    isGold={isMyTimer}
                                                                                                />
                                                                                                {(pRestStatus !== 'completed' && !isReadOnly) && (
                                                                                                    <button
                                                                                                        onClick={() => togglePlayerTimerPause(mapIndex, setIndex, p.id)}
                                                                                                        className={`p-1 rounded-full transition-colors ${
                                                                                                            pRestStatus === 'paused'
                                                                                                                ? 'bg-yellow-500/10 text-yellow-500'
                                                                                                                : 'text-gym-primary hover:text-white'
                                                                                                        }`}
                                                                                                        title={pRestStatus === 'paused' ? "Reanudar" : "Pausar"}
                                                                                                    >
                                                                                                        {pRestStatus === 'paused' ? <Play size={10} fill="currentColor" /> : <Pause size={10} fill="currentColor" />}
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="text-[8px] text-neutral-600 font-bold uppercase tracking-wider text-center py-1 truncate">
                                                                                                {displayName}: 🔥
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }

                                                            // Single Player
                                                            return (
                                                                <div className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-2.5 mt-1 flex items-center justify-center animate-in fade-in slide-in-from-top-2">
                                                                    <div className="flex items-center justify-center gap-2 px-2 py-0.5 rounded-md bg-gym-primary/5 border border-gym-primary/20">
                                                                        <span className="text-[10px] text-gym-primary font-black uppercase tracking-wider">
                                                                            Descanso
                                                                        </span>
                                                                        <RestTimerDisplay
                                                                            status={set.restStatus}
                                                                            accumulated={set.restAccumulated || 0}
                                                                            lastStartTime={set.restLastStartTime}
                                                                            isGold={true}
                                                                        />
                                                                        {(set.restStatus !== 'completed' && !isReadOnly) && (
                                                                            <button
                                                                                onClick={() => toggleTimerPause(mapIndex, setIndex, true)}
                                                                                className="p-1 rounded-full transition-colors text-gym-primary hover:text-white"
                                                                                title={set.restStatus === 'paused' ? "Reanudar" : "Pausar"}
                                                                            >
                                                                                {set.restStatus === 'paused' ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                     </div></Fragment>
                                                 );
                                            })}

                                            {/* Add Set Button */}
                                            {!isReadOnly && (
                                                <button
                                                    onClick={() => addSet(mapIndex)}
                                                    className="w-full py-4 mt-4 rounded-xl border-2 border-dashed border-neutral-800 text-neutral-500 hover:text-white hover:border-gym-primary/50 hover:bg-neutral-800/30 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                                                >
                                                    <Plus size={18} /> Añadir Serie
                                                </button>
                                            )}

                                            {/* Finish/Next Actions */}
                                            {(!isReadOnly && mapIndex === displayedExercises.length - 1) && (
                                                <div className="pt-8 pb-4">
                                                    <button
                                                        onClick={handleFinishRequest}
                                                        disabled={isFinalizing}
                                                        className="w-full bg-gradient-to-br from-yellow-400 to-orange-500 text-black font-black uppercase tracking-[0.2em] py-5 rounded-xl shadow-[0_0_30px_rgba(250,204,21,0.5)] hover:shadow-[0_0_50px_rgba(250,204,21,0.7)] text-lg hover:-translate-y-1 active:scale-95 transition-all duration-300 relative overflow-hidden group border border-yellow-300/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isFinalizing ? (
                                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                                <Loader2 className="animate-spin" size={20} />
                                                                Guardando...
                                                            </span>
                                                        ) : (
                                                            <span className="relative z-10">Finalizar Entrenamiento</span>
                                                        )}
                                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-md" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </WorkoutCarousel>
                    </div>
                    );
                })()}

                {/* Legacy Finish Button (Now hidden inside the last card for cleaner UI, or we can keep it?) 
                    The previous code had it outside. I moved it inside the last card for "Focus Mode".
                    But wait, what if they want to finish early?
                    Ideally there should be a global menu. 
                    Let's keep the global one HIDDEN if we have the carousel, to enforce focus, BUT standard UX says users might want to bail out early.
                    Actually, let's keep it simple: "Finish" is on the last card. 
                */}
                {/* REMOVED: Battle Order Ready Overlay - Auto-start logic implemented instead */}
            </div >


            {/* Fab Add Button (Only if exercises exist and not spying) */}
            {
                (activeExercises.length > 0 && viewingMode === 'mine') && (
                    <div className="fixed bottom-24 left-0 w-full px-4 flex justify-center z-50 pointer-events-none">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="pointer-events-auto bg-red-600 text-white font-black py-4 px-10 rounded-2xl shadow-[0_10px_40px_rgba(220,38,38,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 text-lg border border-red-500/50 backdrop-blur-md"
                        >
                            <Plus size={24} strokeWidth={3} /> AÑADIR EJERCICIO
                        </button>
                    </div>
                )
            }

            {/* Exercise Selector Modal — hidden when any other overlay is active */}
            {
                showAddModal && !showSummary && !showRoutineModal && !showStartOptionsModal && !isFinished && (
                    <div className="fixed inset-0 bg-black/95 z-[90] flex flex-col animate-in fade-in duration-200 overflow-hidden">
                        {/* Header */}
                        <div className="flex-none p-2.5 pb-1 border-b border-white/5 bg-neutral-950">
                            <div className="flex justify-between items-center mb-2">
                                <div>
                                    <h2 className="text-lg md:text-2xl font-black text-white italic uppercase tracking-tighter">
                                        {isCreatingExercise ? (editingItem ? 'Editar Ejercicio' : 'Crear Ejercicio') : 'Catálogo'}
                                    </h2>
                                </div>
                                <button onClick={() => {
                                    if (isCreatingExercise) { setIsCreatingExercise(false); setEditingItem(null); }
                                    else {
                                        if (activeExercises.length === 0) { isLeavingPageRef.current = true; navigate('/'); }
                                        else { setShowAddModal(false); }
                                    }
                                }} className="bg-neutral-900 p-1.5 rounded-full text-white hover:bg-neutral-800 transition-colors">
                                    {isCreatingExercise ? <ArrowLeft size={16} /> : <X size={16} />}
                                </button>
                            </div>

                            {/* Search Bar */}
                            {!isCreatingExercise && (
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-neutral-500" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar ejercicio..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2 pl-9 text-[16px] text-white focus:outline-none focus:border-gym-primary transition-all font-bold"
                                        autoFocus
                                    />
                                </div>
                            )}

                            {/* Muscle anchors — tap to jump to section, all exercises stay visible */}
                            {!isCreatingExercise && (
                                <div
                                    className="mt-2 flex gap-1.5 py-1 px-1 no-scrollbar items-center"
                                    style={{ overflowX: 'scroll', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' } as React.CSSProperties}
                                >
                                    {[
                                        'PECHO','HOMBRO','TRÍCEPS',
                                        'ESPALDA','BÍCEPS','ANTEBRAZO',
                                        'CUÁDRICEPS','ISQUIOTIBIALES','GLÚTEOS','PANTORRILLAS',
                                        'ABDOMINALES','CUELLO','CARDIO',
                                    ].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => scrollToCategory(cat)}
                                            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all
                                                ${activeMuscleFilter === cat
                                                    ? 'bg-gym-primary text-black border-gym-primary'
                                                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-gym-primary/40'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Extras panel — exercises not in catalog ── */}
                        {extrasSection && !isCreatingExercise && (
                            <div className="fixed inset-0 z-[95] bg-black flex flex-col animate-in slide-in-from-bottom-4 duration-200 overflow-hidden">
                                {/* Panel header */}
                                <div className="flex-none px-4 py-3 border-b border-white/5 flex items-center gap-3">
                                    <button
                                        onClick={() => setExtrasSection(null)}
                                        className="bg-neutral-900 p-1.5 rounded-full text-white hover:bg-neutral-800 transition-colors"
                                    >
                                        <ArrowLeft size={16} />
                                    </button>
                                    <div>
                                        <h3 className="text-base font-black text-white italic uppercase tracking-tight">
                                            Más ejercicios de {extrasSection}
                                        </h3>
                                        <p className="text-[10px] text-neutral-500 font-bold">
                                            {extrasSectionInventory.length} ejercicio{extrasSectionInventory.length !== 1 ? 's' : ''} adicionale{extrasSectionInventory.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                                {/* Exercises grid */}
                                <div className="flex-1 px-3 pt-4 pb-32"
                                    style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', minHeight: 0, height: 0 } as React.CSSProperties}
                                >
                                    {extrasSectionInventory.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-48 gap-3 text-neutral-600">
                                            <span className="text-4xl">✅</span>
                                            <p className="text-sm font-bold">Tienes todos los ejercicios de este músculo</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {extrasSectionInventory.map(item => {
                                                const isSelected = selectedCatalogItems.has(item.id);
                                                return (
                                                    <div key={item.id} className="cursor-pointer" onClick={() => handleCatalogToggle(item.id)}>
                                                        <ArsenalCard
                                                            item={item}
                                                            isSelected={isSelected}
                                                            userSettings={userSettings}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                {/* Floating AGREGAR inside panel */}
                                {newlySelectedCount > 0 && (
                                    <div className="absolute bottom-6 left-0 w-full px-4 flex justify-center pointer-events-none z-10">
                                        <button
                                            onClick={handleBatchAdd}
                                            className="pointer-events-auto bg-gym-primary text-black font-black uppercase py-4 px-12 rounded-2xl shadow-[0_10px_40px_rgba(250,204,21,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 text-lg border-2 border-yellow-400"
                                        >
                                            <Plus size={24} strokeWidth={3} />
                                            AGREGAR ({newlySelectedCount})
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div
                            ref={catalogScrollRef}
                            className="flex-1 px-2 sm:px-4 pb-32 bg-black"
                            style={{
                                overflowY: 'scroll',
                                overflowX: 'hidden',
                                WebkitOverflowScrolling: 'touch',
                                touchAction: 'pan-y pinch-zoom',
                                // Explicit height-0 base + flex-grow so iOS calculates the height correctly
                                minHeight: 0,
                                height: 0,
                            } as React.CSSProperties}
                        >
                            {!isCreatingExercise ? (
                                <div className="pt-4">
                                    <ArsenalGrid
                                        inventory={curatedCatalogInventory}
                                        selectedItems={selectedCatalogItems}
                                        userSettings={userSettings}
                                        searchTerm={searchTerm}
                                        onToggleSelection={handleCatalogToggle}
                                        onOpenCatalog={(section) => setExtrasSection(section)}
                                        onEditItem={setEditingItem}
                                        sectionOrder={CATALOG_ORDER}
                                        gridClassName="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
                                        variantBadgeMap={variantBadgeMap}
                                        lockedItemIds={lockedItemIds}
                                        onUnlockItem={(itemId) => {
                                            unlockExercise(itemId);
                                            // Remove from lockedItemIds on next render (state update triggers re-render)
                                        }}
                                        // onVariantCycle removed — each variant is now its own card,
                                        // cycling within a single card is no longer used.
                                    />
                                </div>
                            ) : (
                                <EquipmentForm
                                    user={user}
                                    userSettings={userSettings}
                                    onUpdateSettings={setUserSettings}
                                    editingItem={editingItem}
                                    onClose={() => { setIsCreatingExercise(false); setEditingItem(null); }}
                                    onSuccess={(newItem, isEdit) => {
                                        setArsenal(prev => isEdit ? prev.map(i => i.id === newItem.id ? newItem : i) : [...prev, newItem]);
                                        setSelectedCatalogItems(prev => { const s = new Set(prev); s.add(newItem.id); return s; });
                                        setIsCreatingExercise(false); setEditingItem(null); setSearchTerm('');
                                    }}
                                    activeSection={activeMuscleFilter || 'CHEST'}
                                    catalogItems={catalogItems}
                                    onQuickAdd={(seed) => {
                                        const id = `virtual-${seed.name}`;
                                        setSelectedCatalogItems(prev => { const s = new Set(prev); s.add(id); return s; });
                                        setArsenal(prev => [...prev, { ...seed, id, gym_id: 'virtual', quantity: 1, condition: 'GOOD' } as any]);
                                        setIsCreatingExercise(false);
                                    }}
                                />
                            )}

                            {/* Floating "Add" Button */}
                            {!isCreatingExercise && newlySelectedCount > 0 && (
                                <div className="fixed bottom-6 left-0 w-full px-4 z-[100] flex justify-center pointer-events-none">
                                    <button
                                        onClick={handleBatchAdd}
                                        className="pointer-events-auto bg-gym-primary text-black font-black uppercase py-4 px-12 rounded-2xl shadow-[0_10px_40px_rgba(250,204,21,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 text-lg animate-in slide-in-from-bottom-4 border-2 border-yellow-400"
                                    >
                                        <Plus size={24} strokeWidth={3} />
                                        AGREGAR ({newlySelectedCount})
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* SmartNumpad Removed */}



            {/* --- MODALS --- */}

            {/* Force Exit Modal */}
            <ForceExitModal
                isOpen={showForceExitModal}
                onClose={() => setShowForceExitModal(false)}
                onFinalize={handleFinishRequest}
                onTemporaryExit={() => {
                    if (channelRef.current && isMultiplayer) {
                        channelRef.current.send({
                            type: 'broadcast',
                            event: 'participant_temp_exit',
                            payload: { sender: user?.id }
                        }).catch(() => {});
                    }
                    sessionStorage.setItem('ginx_temp_exit_active', 'true');
                    isLeavingPageRef.current = true;
                    navigate('/');
                }}
                onCancelSession={handleCancelSession}
            />

            {/* 1. Save Routine Modal — only when finishing, never alongside catalog or start options */}
            {
                showRoutineModal && !showAddModal && !showStartOptionsModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
                            {/* Back arrow — returns to active workout */}
                            <button
                                onClick={handleCancelFinish}
                                disabled={isSavingFlow || isFinalizing}
                                className="absolute top-4 left-4 p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                                aria-label="Volver al entrenamiento"
                            >
                                <ChevronLeft size={20} strokeWidth={2.5} />
                            </button>

                            <h3 className="text-xl font-black italic uppercase text-white mb-2 pl-8">¿Guardar Rutina?</h3>
                            <p className="text-neutral-400 text-sm mb-6">Puedes guardar esta sesión como una rutina para repetirla en el futuro.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-neutral-500 uppercase block mb-2">Nombre de la Rutina</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Ej. Pecho y Tríceps Destructor"
                                        value={routineName}
                                        onChange={(e) => setRoutineName(e.target.value)}
                                        className="w-full bg-black border border-neutral-700 rounded-lg p-3 text-[16px] text-white font-bold focus:border-gym-primary outline-none transition-colors"
                                    />
                                </div>

                                <button
                                    onClick={() => onSaveRoutine(routineName)}
                                    disabled={isSavingFlow || isFinalizing || !routineName.trim()}
                                    className="w-full bg-gym-primary text-black font-black uppercase py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2"
                                >
                                    {(isSavingFlow || isFinalizing) ? <Loader className="animate-spin" size={20} /> : <Check size={20} strokeWidth={3} />}
                                    GUARDAR RUTINA
                                </button>

                                <button
                                    onClick={onSkipRoutine}
                                    disabled={isSavingFlow || isFinalizing}
                                    className="w-full bg-transparent border border-neutral-800 text-neutral-400 font-bold uppercase py-3 rounded-xl hover:text-white hover:border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    NO GUARDAR
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }




            {/* 3. Start Options Modal — hidden when finish/summary is active */}
            {
                showStartOptionsModal && !showSummary && !showRoutineModal && !isFinished && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300 p-4">
                        <div className="w-full max-w-md bg-neutral-900/50 border border-neutral-800 rounded-3xl p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
                            {/* Background FX */}
                            <div className="absolute -top-20 -right-20 w-64 h-64 bg-gym-primary/5 rounded-full blur-3xl pointer-events-none"></div>

                            {/* Back Button */}
                            <button
                                onClick={handleCancelSession}
                                className="absolute top-6 left-6 text-neutral-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
                            >
                                <ArrowLeft size={20} />
                            </button>

                            <div className="text-center pt-2">
                                <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter mb-1">Estrategia de Hoy</h2>
                                <p className="text-neutral-500 font-bold text-sm">Selecciona una rutina o inicia libre.</p>
                            </div>

                            {/* Routine List (Compact) */}
                            <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                {routines.map((routine) => (
                                    <button
                                        key={routine.id}
                                        onClick={() => {
                                            // 1. Instant UI Feedback
                                            setShowStartOptionsModal(false);
                                            setCurrentRoutineName(routine.name);

                                            // 2. Sequential Async Setup
                                            (async () => {
                                                const result = await startNewSession();
                                                await loadRoutine(routine, result?.freshArsenal);
                                            })();
                                        }}
                                        className="flex items-center justify-between p-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-gym-primary/50 transition-all group"
                                    >
                                        <div className="text-left">
                                            <h3 className="font-bold text-white group-hover:text-gym-primary transition-colors uppercase italic">{routine.name}</h3>
                                            <span className="text-xs text-neutral-500 font-medium">
                                                {(routine.equipment_ids?.length || routine.routine_exercises?.length || 0)} Ejercicios
                                            </span>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-gym-primary group-hover:text-black transition-colors">
                                            <Swords size={16} />
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="relative">
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-neutral-800"></div>
                                <span className="relative z-10 bg-neutral-900 px-2 text-neutral-500 text-[10px] font-black uppercase tracking-widest mx-auto block w-fit">O inicia libre</span>
                            </div>

                            {/* Quick Start Button */}
                            <button
                                onClick={() => {
                                    // startNewSession(); // REMOVED: Delayed Start logic
                                    setShowStartOptionsModal(false);
                                    setShowAddModal(true); // Open the exercise picker directly
                                }}
                                className="w-full bg-white text-black font-black uppercase py-4 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                            >
                                <Plus size={20} strokeWidth={3} />
                                INICIO RÁPIDO
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Waiting screen removed: User goes directly to summary on finalize */}

            {/* 4. SUMMARY SCREEN - Cuphead Videogame Retro Arcade Style */}
            {
                showSummary && (() => {
                    const myId = user?.id || '';
                    const myName = (user?.user_metadata?.full_name || user?.user_metadata?.username || 'Yo').split(' ')[0];

                    // Use allTimeParticipantsRef so we include users who already left the room.
                    // Also fall back to checking if partnerId exists even if participants were reset —
                    // this prevents the isMultiplayer guard from silently dropping partner data if
                    // initializeBattle reset isMultiplayer to false between finish and summary render.
                    const hasPartner = allTimeParticipantsRef.current.length > 1 || !!partnerId;
                    const isCoopSummary = (isMultiplayer || hasPartner) && multiplayerMode === 'conjunto';
                    // DB is authoritative: covers the 3rd+ participant who might not appear
                    // in allTimeParticipantsRef due to in-memory sync gaps or late joins.
                    const allPlayers = (coopSummaryData && coopSummaryData.players.length > 0)
                        ? coopSummaryData.players
                        : (isCoopSummary && allTimeParticipantsRef.current.length > 0)
                            ? allTimeParticipantsRef.current
                            : [{ id: myId, username: myName, avatar_url: user?.user_metadata?.avatar_url }];
                    const isGroupMode = allPlayers.length > 1;

                    // Use lastNonEmptyExercisesRef as safety net — if activeExercises was cleared
                    // by a race condition between finishSession and the summary render, we still
                    // have the last known exercise snapshot to display results from.
                    const rawSummaryExs = activeExercises.length > 0
                        ? activeExercises
                        : lastNonEmptyExercisesRef.current;
                    // Augment in-memory playerWeights with DB logs for any participant
                    // whose data didn't make it through the realtime sync (3rd person, etc.).
                    const summaryExs = (() => {
                        if (!coopSummaryData?.exerciseSets?.length) return rawSummaryExs;
                        return rawSummaryExs.map((ex: any) => {
                            const dbEx = coopSummaryData.exerciseSets.find(d => d.exerciseId === ex.equipmentId);
                            if (!dbEx) return ex;
                            return {
                                ...ex,
                                sets: (ex.sets || []).map((s: any, sIdx: number) => {
                                    const dbSet = dbEx.sets.find(ds => ds.setNumber === sIdx + 1);
                                    if (!dbSet) return s;
                                    const pw: Record<string, number> = { ...(s.playerWeights || {}) };
                                    const pr: Record<string, number> = { ...(s.playerReps || {}) };
                                    const pt: Record<string, number> = { ...(s.playerTimes || {}) };
                                    const pd: Record<string, number> = { ...(s.playerDistances || {}) };
                                    for (const [uid, d] of Object.entries(dbSet.playerData) as [string, { weight: number; reps: number; time: number; distance: number }][]) {
                                        if (!pw[uid] && d.weight > 0) pw[uid] = d.weight;
                                        if (!pr[uid] && d.reps > 0) pr[uid] = d.reps;
                                        if (!pt[uid] && d.time > 0) pt[uid] = d.time;
                                        if (!pd[uid] && d.distance > 0) pd[uid] = d.distance;
                                    }
                                    return { ...s, playerWeights: pw, playerReps: pr, playerTimes: pt, playerDistances: pd };
                                })
                            };
                        });
                    })();

                    // Compaction Formula based on exercise volume
                    const totalSets = summaryExs.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
                    const totalExs = summaryExs.length;
                    
                    let compLevel = 0;
                    if (totalExs > 5 || totalSets > 15) {
                        compLevel = 2; // High Density (Tiny gaps, tiny text)
                    } else if (totalExs > 3 || totalSets > 8) {
                        compLevel = 1; // Medium Compaction
                    }

                    const columnCount = (summaryTab === 'grupal' && isGroupMode) ? allPlayers.length : 1;
                    
                    let gridWidthClass = 'w-[60%] max-w-md';
                    let headerTextSize = 'text-[9px]';
                    let colHeaderTextSize = 'text-[8px]';
                    let rowTextSize = 'text-[8px]';
                    let wTextSize = 'text-[9.5px]';
                    let wUnitSize = 'text-[5.5px]';
                    let detailTextSize = 'text-[8.5px]';

                    if (columnCount === 2) {
                        gridWidthClass = 'w-[65%] max-w-md';
                        headerTextSize = 'text-[8.5px]';
                        colHeaderTextSize = 'text-[7.5px]';
                        rowTextSize = 'text-[7.5px]';
                        wTextSize = 'text-[9px]';
                        wUnitSize = 'text-[5px]';
                        detailTextSize = 'text-[8px]';
                    } else if (columnCount === 3) {
                        gridWidthClass = 'w-[65%] max-w-md';
                        headerTextSize = 'text-[9.5px]';
                        colHeaderTextSize = 'text-[8px]';
                        rowTextSize = 'text-[8px]';
                        wTextSize = 'text-[9.5px]';
                        wUnitSize = 'text-[5.5px]';
                        detailTextSize = 'text-[8.5px]';
                    } else if (columnCount === 4) {
                        gridWidthClass = 'w-[75%] max-w-lg';
                        headerTextSize = 'text-[9px]';
                        colHeaderTextSize = 'text-[7.5px]';
                        rowTextSize = 'text-[7.5px]';
                        wTextSize = 'text-[9px]';
                        wUnitSize = 'text-[5px]';
                        detailTextSize = 'text-[7.5px]';
                    } else if (columnCount > 4) {
                        gridWidthClass = 'w-[90%] max-w-4xl';
                        headerTextSize = 'text-[8.5px]';
                        colHeaderTextSize = 'text-[7px]';
                        rowTextSize = 'text-[7px]';
                        wTextSize = 'text-[8.5px]';
                        wUnitSize = 'text-[4.5px]';
                        detailTextSize = 'text-[7px]';
                    }

                    const cardSpacing = 'gap-1';
                    const cardStyle = 'bg-[#141310] rounded-md overflow-hidden border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]';
                    
                    const headerPadding = 'px-1.5 py-0.5';
                    const colHeaderPadding = 'px-1.5 py-px';
                    const rowPadding = 'px-1.5 py-[1px]';

                    return (
                        <div className="fixed inset-0 z-[180] flex flex-col summary-animated-bg overflow-hidden">
                            
                            {/* Vintage Film Overlay effect */}
                            <div className="absolute inset-0 bg-white/[0.01] pointer-events-none mix-blend-overlay z-10" />

                            {/* SPECTACULAR CELEBRATORY GOLDEN CONFETTI STYLE */}
                            <style dangerouslySetInnerHTML={{__html: `
                                .summary-animated-bg {
                                    background: linear-gradient(-45deg, #000000, #4d4002, #000000, #7a6603, #000000);
                                    background-size: 400% 400%;
                                    animation: premiumGradient 9s ease infinite;
                                }
                                @keyframes premiumGradient {
                                    0% { background-position: 0% 50%; }
                                    50% { background-position: 100% 50%; }
                                    100% { background-position: 0% 50%; }
                                }
                                @keyframes confettiBurstLeft {
                                    0% { transform: translateY(105vh) translateX(0) scale(0.4) rotate(0deg); opacity: 0; }
                                    10% { opacity: 1; }
                                    35% { transform: translateY(48vh) translateX(-50px) scale(1.1) rotate(140deg); opacity: 1; }
                                    80% { transform: translateY(85vh) translateX(-70px) scale(0.85) rotate(280deg); opacity: 0.9; }
                                    100% { transform: translateY(98vh) translateX(-80px) scale(0.4) rotate(360deg); opacity: 0; }
                                }
                                @keyframes confettiBurstCenter {
                                    0% { transform: translateY(105vh) translateX(0) scale(0.4) rotate(0deg); opacity: 0; }
                                    10% { opacity: 1; }
                                    35% { transform: translateY(38vh) translateX(5px) scale(1.2) rotate(120deg); opacity: 1; }
                                    80% { transform: translateY(85vh) translateX(15px) scale(0.85) rotate(260deg); opacity: 0.9; }
                                    100% { transform: translateY(98vh) translateX(20px) scale(0.4) rotate(360deg); opacity: 0; }
                                }
                                @keyframes confettiBurstRight {
                                    0% { transform: translateY(105vh) translateX(0) scale(0.4) rotate(0deg); opacity: 0; }
                                    10% { opacity: 1; }
                                    35% { transform: translateY(50vh) translateX(50px) scale(1.1) rotate(160deg); opacity: 1; }
                                    80% { transform: translateY(85vh) translateX(70px) scale(0.85) rotate(300deg); opacity: 0.9; }
                                    100% { transform: translateY(98vh) translateX(80px) scale(0.4) rotate(360deg); opacity: 0; }
                                }
                                .confetti-gold {
                                    position: absolute;
                                    pointer-events: none;
                                    z-index: 5;
                                    border-radius: 1px;
                                    opacity: 0;
                                }
                            `}} />

                            {/* Spectacular Celebratory Golden Confetti Storm (Starts from below, shoots upwards once) */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                                {/* Left Burst (16 elements) */}
                                <div className="confetti-gold bg-yellow-400 w-1.5 h-3" style={{ left: '10%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0s' }} />
                                <div className="confetti-gold bg-yellow-300 w-2 h-2" style={{ left: '15%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.1s' }} />
                                <div className="confetti-gold bg-amber-400 w-3 h-1.5" style={{ left: '20%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.2s' }} />
                                <div className="confetti-gold bg-yellow-500 w-2 h-3.5" style={{ left: '25%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.3s' }} />
                                <div className="confetti-gold bg-yellow-200 w-1.5 h-2.5" style={{ left: '12%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.15s' }} />
                                <div className="confetti-gold bg-amber-300 w-2.5 h-3" style={{ left: '18%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.25s' }} />
                                <div className="confetti-gold bg-yellow-400 w-2 h-2" style={{ left: '22%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.05s' }} />
                                <div className="confetti-gold bg-yellow-500 w-3 h-2" style={{ left: '28%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.35s' }} />
                                <div className="confetti-gold bg-amber-500 w-1.5 h-3" style={{ left: '14%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.4s' }} />
                                <div className="confetti-gold bg-yellow-300 w-2.5 h-2" style={{ left: '24%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.45s' }} />
                                <div className="confetti-gold bg-yellow-400 w-2 h-3.5" style={{ left: '30%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.5s' }} />
                                <div className="confetti-gold bg-amber-300 w-2 h-2" style={{ left: '16%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.12s' }} />
                                <div className="confetti-gold bg-yellow-500 w-1.5 h-3" style={{ left: '26%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.22s' }} />
                                <div className="confetti-gold bg-yellow-200 w-2 h-2" style={{ left: '32%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.32s' }} />
                                <div className="confetti-gold bg-amber-400 w-3 h-1.5" style={{ left: '35%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.28s' }} />
                                <div className="confetti-gold bg-yellow-400 w-2.5 h-3" style={{ left: '38%', animation: 'confettiBurstLeft 1.8s ease-out both', animationDelay: '0.38s' }} />

                                {/* Center Burst (16 elements) */}
                                <div className="confetti-gold bg-amber-400 w-1.5 h-3.5" style={{ left: '44%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.05s' }} />
                                <div className="confetti-gold bg-yellow-300 w-2.5 h-2" style={{ left: '46%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.15s' }} />
                                <div className="confetti-gold bg-yellow-400 w-2 h-3" style={{ left: '48%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.25s' }} />
                                <div className="confetti-gold bg-amber-500 w-1.5 h-2.5" style={{ left: '50%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.35s' }} />
                                <div className="confetti-gold bg-yellow-300 w-3 h-1.5" style={{ left: '52%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.12s' }} />
                                <div className="confetti-gold bg-yellow-400 w-2 h-3.5" style={{ left: '54%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.22s' }} />
                                <div className="confetti-gold bg-amber-300 w-2 h-2" style={{ left: '45%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.08s' }} />
                                <div className="confetti-gold bg-yellow-500 w-1.5 h-3" style={{ left: '55%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.18s' }} />
                                <div className="confetti-gold bg-yellow-400 w-2 h-2" style={{ left: '47%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.28s' }} />
                                <div className="confetti-gold bg-amber-400 w-3 h-1.5" style={{ left: '53%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.38s' }} />
                                <div className="confetti-gold bg-yellow-200 w-1.5 h-2.5" style={{ left: '49%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.4s' }} />
                                <div className="confetti-gold bg-amber-300 w-2.5 h-3" style={{ left: '51%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.45s' }} />
                                <div className="confetti-gold bg-yellow-500 w-2 h-3.5" style={{ left: '43%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.3s' }} />
                                <div className="confetti-gold bg-yellow-300 w-2.5 h-2" style={{ left: '57%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.5s' }} />
                                <div className="confetti-gold bg-amber-500 w-1.5 h-3" style={{ left: '41%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.2s' }} />
                                <div className="confetti-gold bg-yellow-400 w-2 h-3" style={{ left: '59%', animation: 'confettiBurstCenter 1.8s ease-out both', animationDelay: '0.1s' }} />

                                {/* Right Burst (16 elements) */}
                                <div className="confetti-gold bg-yellow-400 w-2.5 h-2.5" style={{ left: '65%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0s' }} />
                                <div className="confetti-gold bg-amber-400 w-2 h-3" style={{ left: '70%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.1s' }} />
                                <div className="confetti-gold bg-yellow-300 w-3 h-2" style={{ left: '75%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.2s' }} />
                                <div className="confetti-gold bg-yellow-500 w-1.5 h-2.5" style={{ left: '80%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.3s' }} />
                                <div className="confetti-gold bg-amber-300 w-2 h-3.5" style={{ left: '85%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.15s' }} />
                                <div className="confetti-gold bg-yellow-400 w-3 h-1.5" style={{ left: '90%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.25s' }} />
                                <div className="confetti-gold bg-yellow-200 w-2 h-2" style={{ left: '68%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.05s' }} />
                                <div className="confetti-gold bg-amber-500 w-2 h-3" style={{ left: '72%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.35s' }} />
                                <div className="confetti-gold bg-yellow-400 w-1.5 h-3" style={{ left: '78%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.4s' }} />
                                <div className="confetti-gold bg-yellow-300 w-2.5 h-2.5" style={{ left: '83%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.45s' }} />
                                <div className="confetti-gold bg-amber-400 w-2 h-3.5" style={{ left: '88%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.5s' }} />
                                <div className="confetti-gold bg-yellow-500 w-3 h-2" style={{ left: '67%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.12s' }} />
                                <div className="confetti-gold bg-yellow-200 w-2 h-2" style={{ left: '73%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.22s' }} />
                                <div className="confetti-gold bg-amber-300 w-1.5 h-3" style={{ left: '77%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.32s' }} />
                                <div className="confetti-gold bg-yellow-400 w-2.5 h-2.5" style={{ left: '82%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.28s' }} />
                                <div className="confetti-gold bg-yellow-500 w-2 h-3" style={{ left: '87%', animation: 'confettiBurstRight 1.8s ease-out both', animationDelay: '0.38s' }} />
                            </div>

                            {/* STICKY HEADER with Animated Comic Logo (Ultra Compacted) */}
                            <div className="flex-shrink-0 bg-black/40 border-b border-black pt-1.5 px-2 pb-1.5 relative">
                                <div className="text-center flex flex-col items-center mb-1">
                                    <h1 
                                        className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-yellow-400 drop-shadow-[0_1.5px_0_#000] border-y border-yellow-400/20 px-3 py-0 select-none animate-pulse"
                                        style={{ fontFamily: "'Impact', 'Arial Black', sans-serif" }}
                                    >
                                        ¡RESULTADOS!
                                    </h1>
                                    <p className="text-[7.5px] font-black tracking-[0.2em] text-yellow-500/50 uppercase mt-0">
                                        STUDIO GYNX ENTERTAINMENT INC.
                                    </p>
                                </div>

                                <div className="flex gap-1.5 w-[90%] max-w-sm mx-auto">
                                    {isGroupMode && (
                                        <button
                                            onClick={() => setSummaryTab('grupal')}
                                            className={`flex-1 py-1 px-2 rounded-md text-[9.5px] font-black uppercase tracking-wider border-2 transition-all transform hover:scale-[1.03] active:scale-95 duration-100 ${
                                                summaryTab === 'grupal'
                                                    ? 'bg-yellow-400 border-black text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                                            }`}
                                        >
                                            GRUPAL
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSummaryTab('individual')}
                                        className={`flex-1 py-1 px-2 rounded-md text-[9.5px] font-black uppercase tracking-wider border-2 transition-all transform hover:scale-[1.03] active:scale-95 duration-100 ${
                                            summaryTab === 'individual' || !isGroupMode
                                                ? 'bg-yellow-400 border-black text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                                : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                                        }`}
                                    >
                                        INDIVIDUAL
                                    </button>
                                </div>
                            </div>

                            {/* SCROLLABLE VINTAGE CONTENT GRID (Compacted Dynamically by Columns) */}
                            <div className={`flex-1 overflow-y-auto px-1 pt-2 pb-20 mx-auto flex flex-col justify-start ${gridWidthClass}`}>

                                {/* ====== TAB: GRUPAL ====== */}
                                {(summaryTab === 'grupal' && isGroupMode) && (
                                    <div className={`flex flex-col ${cardSpacing}`}>
                                        {summaryExs.map((ex, exIdx) => {
                                            const hasAnyData = ex.sets.some(s =>
                                                allPlayers.some(p =>
                                                    Number(s.playerWeights?.[p.id]) > 0 ||
                                                    Number(s.playerReps?.[p.id]) > 0 ||
                                                    Number(s.playerTimes?.[p.id]) > 0 ||
                                                    Number(s.playerDistances?.[p.id]) > 0
                                                )
                                            );
                                            if (!hasAnyData) return null;

                                            const activePlayers = allPlayers;

                                            return (
                                                <div key={exIdx} className={`${cardStyle} transform hover:-translate-y-0.5 transition-transform duration-200`}>
                                                    {/* Chalkboard header with classic outline separator */}
                                                    <div className={`${headerPadding} bg-gradient-to-r from-yellow-500/15 via-yellow-500/5 to-transparent border-b border-black flex justify-between items-center`}>
                                                        <span className={`${headerTextSize} font-black uppercase tracking-widest text-yellow-400 italic`}>
                                                            ★ {ex.equipmentName}
                                                        </span>
                                                        <span className="text-[7px] font-black text-yellow-500/40 uppercase">EX-{exIdx + 1}</span>
                                                    </div>

                                                    {/* Column headers: Serie + one col per player */}
                                                    <div className={`grid ${colHeaderPadding} bg-black/50 border-b border-black text-[8px] font-bold text-neutral-400 uppercase tracking-wider`} style={{ gridTemplateColumns: `32px repeat(${activePlayers.length}, 1fr)` }}>
                                                        <div className="text-yellow-500/80 font-black">SET</div>
                                                        {activePlayers.map(p => {
                                                            const nm = (p.username || 'U').split(' ')[0].substring(0, 7);
                                                            const isMe = p.id === myId;
                                                            return (
                                                                <div key={p.id} className={`text-center font-black truncate ${colHeaderTextSize} ${isMe ? 'text-yellow-400 italic underline decoration-yellow-400/40' : 'text-neutral-300'}`}>
                                                                    {nm}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Set rows */}
                                                    {ex.sets.map((s, sIdx) => {
                                                        const hasAny = activePlayers.some(p =>
                                                            Number(s.playerWeights?.[p.id]) > 0 ||
                                                            Number(s.playerReps?.[p.id]) > 0 ||
                                                            Number(s.playerTimes?.[p.id]) > 0 ||
                                                            Number(s.playerDistances?.[p.id]) > 0
                                                        );
                                                        if (!hasAny) return null;
                                                        return (
                                                            <div key={s.id} className={`grid ${rowPadding} border-b border-black/20 last:border-0 items-center bg-black/10 hover:bg-black/20 transition-colors`} style={{ gridTemplateColumns: `32px repeat(${activePlayers.length}, 1fr)` }}>
                                                                <div className={`${rowTextSize} text-yellow-500/40 font-black italic`}>#{sIdx + 1}</div>
                                                                {activePlayers.map(p => {
                                                                    const w = Number(s.playerWeights?.[p.id]) || 0;
                                                                    const r = Number(s.playerReps?.[p.id]) || 0;
                                                                    const t = Number(s.playerTimes?.[p.id]) || 0;
                                                                    const d = Number(s.playerDistances?.[p.id]) || 0;
                                                                    const hasVal = w > 0 || r > 0 || t > 0 || d > 0;
                                                                    const isMe = p.id === myId;
                                                                    const unit = ex.weightUnit || 'kg';
                                                                    // Convert stored kg → display value (integer for lb, 1 decimal for kg)
                                                                    const wDisplay = w > 0 ? toDisplayWeight(w, unit) : '';
                                                                    return (
                                                                        <div key={p.id} className="flex flex-col items-center justify-center py-0.5">
                                                                            {hasVal ? (
                                                                                <div className="flex flex-col items-center">
                                                                                    {w > 0 && <span className={`${wTextSize} font-black leading-none tracking-tight ${isMe ? 'text-yellow-400' : 'text-white'}`}>{wDisplay}<span className={`${wUnitSize} font-bold text-neutral-400 ml-0.5`}>{unit}</span></span>}
                                                                                    {r > 0 && <span className={`${detailTextSize} text-neutral-400 leading-none font-bold mt-0.5`}>{r}r</span>}
                                                                                    {t > 0 && <span className={`${detailTextSize} text-neutral-400 leading-none font-bold mt-0.5`}>{t}s</span>}
                                                                                    {d > 0 && <span className={`${detailTextSize} text-neutral-400 leading-none font-bold mt-0.5`}>{d}{ex.distanceUnit || 'm'}</span>}
                                                                                </div>
                                                                            ) : (
                                                                                <span className={`${rowTextSize} text-neutral-700 font-bold`}>—</span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* ====== TAB: INDIVIDUAL ====== */}
                                {(summaryTab === 'individual' || !isGroupMode) && (
                                    <div className={`flex flex-col ${cardSpacing}`}>
                                        {summaryExs.map((ex, exIdx) => {
                                            // Scalar fallback mirrors the display formula used in the input rows:
                                            // playerWeights[myId] → p2_weight (firstGuest) → set.weight (host/solo) → 0
                                            const myIsHost2 = !isMultiplayer || isInviter;
                                            const myIsFirstGuest2 = isMultiplayer && !isInviter && myId === firstGuestId;
                                            const _w = (s: any) => Number(s.playerWeights?.[myId] ?? (myIsHost2 ? (s.weight || 0) : (myIsFirstGuest2 ? (s.p2_weight || 0) : 0))) || 0;
                                            const _r = (s: any) => Number(s.playerReps?.[myId]    ?? (myIsHost2 ? (s.reps   || 0) : (myIsFirstGuest2 ? (s.p2_reps   || 0) : 0))) || 0;
                                            const _t = (s: any) => Number(s.playerTimes?.[myId]   ?? (myIsHost2 ? (s.time   || 0) : (myIsFirstGuest2 ? (s.p2_time   || 0) : 0))) || 0;
                                            const _d = (s: any) => Number(s.playerDistances?.[myId] ?? (myIsHost2 ? (s.distance || 0) : (myIsFirstGuest2 ? (s.p2_distance || 0) : 0))) || 0;

                                            const mySets = ex.sets.map((s, i) => ({ ...s, idx: i })).filter(s =>
                                                _w(s) > 0 || _r(s) > 0 || _t(s) > 0 || _d(s) > 0
                                            );
                                            if (mySets.length === 0) return null;

                                            // Check if this exercise has time or distance data recorded
                                            const hasTimeOrDistance = mySets.some(s =>
                                                Number(s.playerTimes?.[myId]) > 0 ||
                                                Number(s.playerDistances?.[myId]) > 0
                                            );

                                            return (
                                                <div key={exIdx} className={`${cardStyle} transform hover:-translate-y-0.5 transition-transform duration-200`}>
                                                    <div className={`${headerPadding} bg-gradient-to-r from-yellow-500/15 via-yellow-500/5 to-transparent border-b border-black flex justify-between items-center`}>
                                                        <span className={`${headerTextSize} font-black uppercase tracking-widest text-yellow-400 italic`}>
                                                            ★ {ex.equipmentName}
                                                        </span>
                                                        <span className="text-[7px] font-black text-yellow-500/40 uppercase">EX-{exIdx + 1}</span>
                                                    </div>
                                                    
                                                    {/* Header row - dynamically adjusts grid layout */}
                                                    <div className={`grid ${hasTimeOrDistance ? 'grid-cols-4' : 'grid-cols-3'} ${colHeaderPadding} bg-black/50 border-b border-black text-[8px] font-bold text-neutral-400 uppercase tracking-wider`}>
                                                        <div className="text-yellow-500/80 font-black leading-none">SET</div>
                                                        <div className="text-center font-black leading-none">PESO</div>
                                                        <div className="text-center font-black leading-none">REPS</div>
                                                        {hasTimeOrDistance && <div className="text-center font-black leading-none">TIEMPO/DIST</div>}
                                                    </div>
                                                    {mySets.map(s => {
                                                        // Use the same scalar fallback helpers defined above
                                                        const w = _w(s);
                                                        const r = _r(s);
                                                        const t = _t(s);
                                                        const d = _d(s);
                                                        const unit2 = ex.weightUnit || 'kg';
                                                        // Convert stored kg → display value (integer for lb, 1 decimal for kg)
                                                        const wDisplay2 = w > 0 ? toDisplayWeight(w, unit2) : '';
                                                        return (
                                                            <div key={s.id} className={`grid ${hasTimeOrDistance ? 'grid-cols-4' : 'grid-cols-3'} ${rowPadding} border-b border-black/20 last:border-0 items-center bg-black/10 hover:bg-black/20 transition-colors`}>
                                                                <div className={`${rowTextSize} text-yellow-500/40 font-black italic leading-none`}>#{s.idx + 1}</div>
                                                                <div className="text-center leading-none">
                                                                    {w > 0 ? <span className={`${wTextSize} font-black text-yellow-400 leading-none`}>{wDisplay2}<span className={`${wUnitSize} font-bold text-neutral-400 ml-0.5`}>{unit2}</span></span> : <span className={`text-neutral-700 ${rowTextSize} font-bold leading-none`}>—</span>}
                                                                </div>
                                                                <div className="text-center leading-none">
                                                                    {r > 0 ? <span className={`${wTextSize} font-black text-white leading-none`}>{r}</span> : <span className={`text-neutral-700 ${rowTextSize} font-bold leading-none`}>—</span>}
                                                                </div>
                                                                {hasTimeOrDistance && (
                                                                    <div className="text-center leading-none">
                                                                        {t > 0 ? <span className={`${detailTextSize} font-bold text-neutral-300 leading-none`}>{t}s</span> : d > 0 ? <span className={`${detailTextSize} font-bold text-neutral-300 leading-none`}>{d}{ex.distanceUnit || 'm'}</span> : <span className={`text-neutral-700 ${rowTextSize} font-bold leading-none`}>—</span>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* MEGA RETRO ARCADE BUTTON (Highly Compacted Footer) */}
                            <div className="flex-shrink-0 py-2 px-4 bg-gradient-to-t from-[#0c0b09] via-[#0c0b09]/95 to-transparent border-t border-black/25">
                                <div className="w-full max-w-md mx-auto px-2">
                                    <button
                                        onClick={() => {
                                            isLeavingPageRef.current = true;
                                            navigate('/');
                                        }}
                                        className="w-full bg-[#f43f5e] hover:bg-[#e11d48] border-2 border-black text-white font-black uppercase py-2.5 rounded-xl text-[11px] tracking-widest shadow-[0_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] active:translate-y-[3px] active:shadow-none transition-all duration-150"
                                    >
                                        ¡VOLVER AL INICIO!
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }
        </div >
    );
}

// --- HELPER FUNCTIONS ---

// GPS Helpers Removed

