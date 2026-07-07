import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    X, 
    UserPlus, 
    Swords, 
    ArrowRight, 
    Zap, 
    Loader2, 
    MapPin, 
    Shield,
    ChevronsLeft,
    ChevronsRight,
    RotateCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/NotificationService';
import { socialService } from '../services/SocialService';
import { pushService } from '../services/PushService';
import { useAuth } from '../context/AuthContext';
import { UserProfileCard } from '../components/ui/UserProfileCard';
import { BoostModal } from '../components/profile/BoostModal';
import { userService } from '../services/UserService';
import toast from 'react-hot-toast';

// Curated collection of high-quality gym/fitness images for fallbacks
const FALLBACK_BANNERS = [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571902258032-783ec5ad6dfc?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?auto=format&fit=crop&q=80'
];

const FALLBACK_GYM_INTERIORS = [
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80'
];

export const Radar = () => {
    const { user: authUser } = useAuth();
    const navigate = useNavigate();
    const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [scanComplete, setScanComplete] = useState(false);
    const [dragX, setDragX] = useState(0);
    const [dragState, setDragState] = useState<'idle' | 'dragging' | 'flying-left' | 'flying-right' | 'snapping' | 'entering'>('idle');
    const touchStartXRef = useRef(0);
    const touchStartYRef = useRef(0);
    const isHorizontalDragRef = useRef<boolean | null>(null);
    const dragXRef = useRef(0);
    const recentPointsRef = useRef<{ x: number; t: number }[]>([]);
    const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);
    const [isBoosting, setIsBoosting] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [isPlayingTutorial, setIsPlayingTutorial] = useState(false);
    // Rewind (1 use per cancelled person): the last skipped card + the set of
    // people already rewound (persisted, so each can be recovered only once).
    const [lastSkipped, setLastSkipped] = useState<{ index: number; id: string } | null>(null);
    const rewoundIdsRef = useRef<Set<string>>(new Set());
    const currentUser = nearbyUsers[currentIndex];

    const DECK_KEY = authUser?.id ? `radar_deck_${authUser.id}` : '';
    const REWOUND_KEY = authUser?.id ? `radar_rewound_${authUser.id}` : '';
    const DECK_TTL_MS = 6 * 60 * 60 * 1000; // rebuild the deck after 6h to surface new people

    // Persist the UNSEEN tail of the deck so leaving/returning resumes exactly
    // where you left off (e.g. back on Juan) instead of re-shuffling.
    const persistDeck = (users: any[], idx: number) => {
        if (!DECK_KEY) return;
        try {
            const ids = users.slice(idx).map(u => u.id);
            if (ids.length === 0) { localStorage.removeItem(DECK_KEY); return; }
            localStorage.setItem(DECK_KEY, JSON.stringify({ ids, builtAt: Date.now() }));
        } catch { /* ignore */ }
    };

    useEffect(() => {
        if (scanComplete && nearbyUsers.length > 0 && authUser?.id) {
            // Play the swipe tutorial (NOPE/MATCH demo) ONCE per user, ever.
            // The key was previously removed on radar restart but never set,
            // so the animation replayed on every single visit.
            const tutorialKey = `radar_swipe_tutorial_seen_${authUser.id}`;
            if (localStorage.getItem(tutorialKey)) return;
            localStorage.setItem(tutorialKey, '1');

            setIsPlayingTutorial(true);
            const timer = setTimeout(() => {
                setIsPlayingTutorial(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [scanComplete, nearbyUsers.length, authUser?.id]);

    useEffect(() => {
        if (currentUser) {
            console.log(`👁️ [RADAR] Usuario activo: ${currentUser.username} | Seguidores actuales: ${currentUser.followers_count} | Stats cargadas: ${currentUser.stats_loaded}`);
        }
    }, [currentIndex, nearbyUsers]);

    useEffect(() => {
        if (!authUser?.id) return;
        // Restore the rewound-people set (each recoverable only once)
        try {
            const raw = localStorage.getItem(`radar_rewound_${authUser.id}`);
            rewoundIdsRef.current = new Set(raw ? JSON.parse(raw) : []);
        } catch { rewoundIdsRef.current = new Set(); }
        loadRadar();
    }, [authUser]);

    // Decide between restoring the saved deck (resume where you left off) and
    // building a fresh one. Restore only when the saved deck is fresh and still
    // has unseen cards — otherwise fall through to a full scan.
    const loadRadar = async () => {
        if (!authUser?.id) return;
        try {
            const raw = DECK_KEY ? localStorage.getItem(DECK_KEY) : null;
            if (raw) {
                const saved = JSON.parse(raw);
                const fresh = saved?.builtAt && (Date.now() - saved.builtAt) < DECK_TTL_MS;
                if (fresh && Array.isArray(saved.ids) && saved.ids.length > 0) {
                    const restored = await restoreDeck(saved.ids);
                    if (restored) return; // resumed exactly where we left off
                }
            }
        } catch (e) {
            console.warn('[RADAR] restore failed, rebuilding deck:', e);
        }
        loadNearbyUsers();
    };

    // ── HARD FILTERS (Tinder step 1) — build the exclusion set ──────────────
    // Removes: already swiped (skip/invite), pending challenge I sent, existing
    // training partners (chats), and blocked users (both directions).
    // Note: this app has no age/gender/birthdate data, so those Tinder hard
    // filters don't apply; "distance" is expressed as gym proximity in scoring.
    const buildExclusionSet = async (): Promise<Set<string>> => {
        const uid = authUser!.id;
        const [swipesRes, chatsRes, sentInvitesRes, blocksRes] = await Promise.all([
            supabase.from('radar_swipes').select('target_id').eq('user_id', uid),
            supabase.from('chats').select('user_a, user_b').or(`user_a.eq.${uid},user_b.eq.${uid}`),
            supabase.from('notifications').select('user_id').eq('type', 'invitation').filter('data->>sender_id', 'eq', uid),
            supabase.from('user_blocks').select('blocked_by, blocked_user').or(`blocked_by.eq.${uid},blocked_user.eq.${uid}`),
        ]);
        const excluded = new Set<string>();
        (swipesRes.data || []).forEach((s: any) => excluded.add(s.target_id));
        (chatsRes.data || []).forEach((c: any) => excluded.add(c.user_a === uid ? c.user_b : c.user_a));
        (sentInvitesRes.data || []).forEach((n: any) => excluded.add(n.user_id));
        (blocksRes.data || []).forEach((b: any) => excluded.add(b.blocked_by === uid ? b.blocked_user : b.blocked_by));
        return excluded;
    };

    // ── ENRICH + SCORE (Tinder step 2) ──────────────────────────────────────
    // Attaches gym passport/favorites/metadata and computes algo_score.
    // Returns cards in INPUT order (caller decides whether to sort by score or
    // preserve a saved deck order).
    const enrichProfiles = async (profiles: any[]): Promise<any[]> => {
        const profileIds = profiles.map(p => p.id);

        const [{ data: passportsData }, { data: favData }] = await Promise.all([
            supabase.from('user_gyms').select('user_id, gym_id, is_home_base, gyms ( id, name )').in('user_id', profileIds),
            supabase.from('gym_favorites').select('user_id, gym_id').in('user_id', profileIds),
        ]);

        const passportMap: Record<string, { id: string; name: string; is_favorite?: boolean; is_home_base?: boolean }[]> = {};
        (passportsData || []).forEach((item: any) => {
            if (!item.gyms) return;
            (passportMap[item.user_id] ||= []).push({ id: item.gyms.id, name: item.gyms.name, is_favorite: false, is_home_base: item.is_home_base });
        });
        const favSet = new Set<string>();
        (favData || []).forEach((f: any) => favSet.add(`${f.user_id}-${f.gym_id}`));
        Object.entries(passportMap).forEach(([uid, gyms]) => gyms.forEach(g => { if (favSet.has(`${uid}-${g.id}`)) g.is_favorite = true; }));

        const gymIds = [...new Set(profiles.map(p => p.home_gym_id).filter(Boolean))];
        let gymMap: any = {};
        if (gymIds.length > 0) {
            const { data: gymsData } = await supabase.from('gyms').select('id, name').in('id', gymIds);
            (gymsData || []).forEach((g: any) => { gymMap[g.id] = { name: g.name }; });
        }

        const [{ data: myProfile }, { data: myPassportData }] = await Promise.all([
            supabase.from('profiles').select('home_gym_id').eq('id', authUser!.id).maybeSingle(),
            supabase.from('user_gyms').select('gym_id').eq('user_id', authUser!.id),
        ]);
        const myHomeGymId = myProfile?.home_gym_id;
        const myGymIds = new Set<string>((myPassportData || []).map((g: any) => g.gym_id));

        const now = new Date();
        const nowMs = now.getTime();

        // ── ALGORITHM V9: Boost · Activity · Desirability · Gym · Freshness ──
        const scoreUser = (p: any): number => {
            const isBoosted = p.boost_until ? new Date(p.boost_until) > now : false;
            const boostPts = isBoosted ? 50000 : 0;

            // Activity recency — strongest organic signal
            let activityPts = 0;
            if (p.last_active_at) {
                const h = (nowMs - new Date(p.last_active_at).getTime()) / 3600000;
                if (h < 3) activityPts = 1000; else if (h < 24) activityPts = 700; else if (h < 168) activityPts = 400; else if (h < 720) activityPts = 100;
            }

            // Desirability (implicit like-rate): matches received + selectivity ratio
            const matches = p.matches_count || 0;
            const skips = p.skips_count || 0;
            const ratio = (matches + skips) > 0 ? matches / (matches + skips) : 0;
            const desirePts = Math.min(matches * 8, 250) + ratio * 250;

            // Gym proximity (this app's "distance")
            let gymPts = 0;
            if (myHomeGymId && p.home_gym_id === myHomeGymId) gymPts += 400;
            const theirGyms: string[] = (passportMap[p.id] || []).map(g => g.id);
            gymPts += Math.min(theirGyms.filter(g => myGymIds.has(g) && g !== myHomeGymId).length * 100, 300);

            // Freshness — new accounts (<48h) get a strong temporary visibility boost
            let freshnessPts = 0;
            if (p.created_at) {
                const days = (nowMs - new Date(p.created_at).getTime()) / 86400000;
                if (days < 2) freshnessPts = 300; else if (days < 7) freshnessPts = 150; else if (days < 30) freshnessPts = 60;
            }

            return boostPts + activityPts + desirePts + gymPts + freshnessPts + Math.random() * 60;
        };

        return profiles.map(p => {
            const settings = (p.custom_settings as any) || {};
            let gymInfo = gymMap[p.home_gym_id || ''] || { name: '' };
            if (gymInfo.name.includes('Arsenal Personal')) gymInfo = { name: '' };
            const isBoosted = p.boost_until ? new Date(p.boost_until) > now : false;
            return {
                ...p,
                gym_name: gymInfo.name,
                gym_image: p.main_base_image || null,
                gym_color: p.main_base_color || '#3A2C00',
                gym_passport: passportMap[p.id] || [],
                banner_url: settings.banner_url || null,
                training_days_count: p.checkins_count || 0,
                followers_count: 0,
                following_count: 0,
                is_following: false,
                stats_loaded: false,
                bio: p.description || settings.description || settings.bio || '¡Entrenando duro para subir de rango! 💪 🔥',
                is_pro: isBoosted,
                algo_score: scoreUser(p),
            };
        });
    };

    // ── RESTORE a saved deck in its exact order (resume where you left off) ──
    const restoreDeck = async (ids: string[]): Promise<boolean> => {
        setLoading(true);
        try {
            const excluded = await buildExclusionSet();
            const wantedIds = ids.filter(id => !excluded.has(id));
            if (wantedIds.length === 0) return false; // nothing left → rebuild fresh

            const { data: profiles } = await supabase
                .from('profiles').select('*').in('id', wantedIds).not('username', 'is', null);
            if (!profiles || profiles.length === 0) return false;

            const enriched = await enrichProfiles(profiles);
            // Preserve the SAVED order (do NOT re-sort) so the current card stays
            const byId = new Map(enriched.map(u => [u.id, u]));
            const ordered = wantedIds.map(id => byId.get(id)).filter(Boolean) as any[];
            if (ordered.length === 0) return false;

            console.log(`♻️ [RADAR] Deck restaurado — ${ordered.length} cartas, resumiendo donde lo dejaste.`);
            setNearbyUsers(ordered);
            setCurrentIndex(0);
            setScanComplete(true);
            return true;
        } catch (e) {
            console.warn('[RADAR] restoreDeck error:', e);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const loadNearbyUsers = async () => {
        if (!authUser?.id) {
            console.log("🛰️ [RADAR] Waiting for authUser session to be fully resolved...");
            return;
        }
        setLoading(true);
        try {
            console.log("🛰️ [RADAR] Escaneando guerreros...");

            // 0. HARD FILTERS: build the exclusion set (swiped / matched / blocked)
            const excludedIds = await buildExclusionSet();
            console.log(`🧠 [RADAR] Filtros duros: ${excludedIds.size} guerreros excluidos (rechazados/invitados/aliados/bloqueados).`);

            // 1. Fetch profiles - PRIORITIZE NEWEST & BOOSTED VIA RPC (with 1.5s resilient timeout fallback!)
            console.log("⚙️ [RADAR] Triggering prioritized scanner...");
            const fetchProfilesPromise = supabase
                .rpc('get_radar_profiles_prioritized', { current_user_id: authUser?.id });

            const fallbackQueryPromise = new Promise<{ data: any[] | null; error: any; isFallback: boolean }>((resolve) => {
                setTimeout(async () => {
                    console.warn("⚠️ [RADAR] RPC get_radar_profiles_prioritized took too long (>1.5s). Falling back to direct select...");
                    try {
                        const { data, error } = await supabase
                            .from('profiles')
                            .select('*')
                            .neq('id', authUser.id)
                            .not('username', 'is', null)
                            .order('last_active_at', { ascending: false, nullsFirst: false })
                            .limit(200);
                        resolve({ data, error, isFallback: true });
                    } catch (err) {
                        resolve({ data: null, error: err, isFallback: true });
                    }
                }, 4000); // Increased timeout to 4 seconds for slow network/cold starts
            });

            const result = await Promise.race([
                fetchProfilesPromise.then(res => ({ data: res.data, error: res.error, isFallback: false })),
                fallbackQueryPromise
            ]);

            const rawProfiles = result.data || [];
            const pError = result.error;

            if (pError) {
                console.error("❌ [RADAR] Failed to load profiles (Error):", pError);
                throw pError;
            }

            // TINDER RULE: filter out everyone already swiped/invited/matched
            const profiles = rawProfiles.filter((p: any) => !excludedIds.has(p.id));
            console.log(`🃏 [RADAR] Deck: ${profiles.length} candidatos (${rawProfiles.length - profiles.length} filtrados por memoria de swipes).`);

            if (result.isFallback) {
                console.log(`ℹ️ [RADAR] Successfully loaded profiles using the resilient direct select fallback! Count: ${profiles.length}. Error (if any):`, pError);
            }

            if (profiles && profiles.length > 0) {
                // Enrich + score, then sort best-first (Tinder step 2 ranking)
                const enriched = await enrichProfiles(profiles);
                const sorted = enriched.sort((a, b) => b.algo_score - a.algo_score);

                console.log("🏆 [RADAR V9] Top 5 (Boost · Activity · Desirability · Gym · Freshness):");
                console.table(sorted.slice(0, 5).map(u => ({
                    username: u.username,
                    score: Math.round(u.algo_score),
                    boosted: u.is_pro,
                    matches: u.matches_count || 0,
                })));

                setNearbyUsers(sorted);
                setCurrentIndex(0);
                persistDeck(sorted, 0);
            }
        } catch (error) {
            console.error("Error loading nearby users:", error);
            toast.error("Error al buscar guerreros cercanos");
        } finally {
            setLoading(false);
            setTimeout(() => setScanComplete(true), 1500);
        }
    };

    // LAZY LOAD STATS: Fetch real stats for the CURRENT card only
    useEffect(() => {
        const loadCurrentStats = async () => {
            const currentUser = nearbyUsers[currentIndex];
            if (!currentUser || currentUser.stats_loaded || !authUser) return;

            try {
                const [stats, { data: followCheck }] = await Promise.all([
                    socialService.getProfileStats(currentUser.id),
                    supabase.from('follows').select('*').eq('follower_id', authUser.id).eq('following_id', currentUser.id).maybeSingle()
                ]);

                setNearbyUsers(prev => {
                    const updated = [...prev];
                    // IMPORTANT: Only update if the user hasn't already followed manually in the meantime
                    const currentInState = updated[currentIndex];
                    if (currentInState && currentInState.id === currentUser.id) {
                        updated[currentIndex] = {
                            ...currentInState,
                            followers_count: currentInState.is_following ? (stats.followersCount + 1) : stats.followersCount,
                            following_count: stats.followingCount,
                            is_following: currentInState.is_following || !!followCheck,
                            stats_loaded: true
                        };
                    }
                    return updated;
                });
            } catch (err) {
                console.error("Error lazy loading stats:", err);
            }
        };

        if (scanComplete && nearbyUsers.length > 0) {
            loadCurrentStats();
        }
    }, [currentIndex, scanComplete, nearbyUsers.length, authUser]);

    useEffect(() => {
        if (authUser) {
            supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle().then(({ data }) => setUserProfile(data));
        }
    }, [authUser]);

    // Persist the deck position on every advance/rewind so leaving and
    // re-entering the Radar resumes on the same card (no re-shuffle).
    useEffect(() => {
        if (scanComplete && nearbyUsers.length > 0) {
            persistDeck(nearbyUsers, currentIndex);
        }
    }, [currentIndex, scanComplete]);

    const handleBoostConfirm = async () => {
        if (!authUser || isBoosting) return;
        setIsBoosting(true);
        try {
            const success = await userService.spendGPoints(authUser.id, 1000, 'profile_boost');
            if (success) {
                toast.success("🚀 ¡PERFIL DESTACADO EN EL RADAR!");
                setIsBoostModalOpen(false);
                // Refresh local profile state
                const { data } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
                setUserProfile(data);
            }
        } catch (err) {
            toast.error("Error al activar Boost");
        } finally {
            setIsBoosting(false);
        }
    };

    const flyOff = (direction: 'left' | 'right') => {
        setDragState(direction === 'left' ? 'flying-left' : 'flying-right');
        setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
            setDragX(0);
            dragXRef.current = 0;
            if (direction === 'left') {
                setDragState('entering');
                setTimeout(() => setDragState('idle'), 300);
            } else {
                setDragState('idle');
            }
        }, 220);
    };

    const cardStyle = (): React.CSSProperties => {
        if (isPlayingTutorial) {
            return { animation: 'tinderTutorialSwipe 3s ease-in-out infinite' };
        }
        const rot = dragX * 0.06;
        switch (dragState) {
            case 'dragging':
                return { transform: `translateX(${dragX}px) rotate(${rot}deg)`, transition: 'none' };
            case 'flying-left':
                return { transform: 'translateX(-150%) rotate(-25deg)', opacity: 0, transition: 'transform 220ms linear, opacity 180ms linear' };
            case 'flying-right':
                return { transform: 'translateX(150%) rotate(25deg)', opacity: 0, transition: 'transform 220ms linear, opacity 180ms linear' };
            case 'snapping':
                return { transform: 'translateX(0) rotate(0deg)', transition: 'transform 200ms ease-out' };
            case 'entering':
                return { animation: 'slideInFromRight 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards' };
            default:
                return {};
        }
    };

    const onCardTouchStart = (e: React.TouchEvent) => {
        if (dragState !== 'idle') return;
        const x = e.touches[0].clientX;
        touchStartXRef.current = x;
        touchStartYRef.current = e.touches[0].clientY;
        isHorizontalDragRef.current = null;
        recentPointsRef.current = [{ x: 0, t: Date.now() }];
        dragXRef.current = 0;
        setDragState('dragging');
    };

    const onCardTouchMove = (e: React.TouchEvent) => {
        if (dragState !== 'dragging') return;
        const dx = e.touches[0].clientX - touchStartXRef.current;
        const dy = e.touches[0].clientY - touchStartYRef.current;

        if (isHorizontalDragRef.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            isHorizontalDragRef.current = Math.abs(dx) > Math.abs(dy);
        }
        if (!isHorizontalDragRef.current) return;
        e.preventDefault();

        const now = Date.now();
        recentPointsRef.current.push({ x: dx, t: now });
        if (recentPointsRef.current.length > 5) recentPointsRef.current.shift();

        dragXRef.current = dx;
        setDragX(dx);
    };

    const onCardTouchEnd = () => {
        if (dragState !== 'dragging') { setDragState('idle'); return; }
        if (!isHorizontalDragRef.current) {
            setDragState('idle');
            setDragX(0);
            dragXRef.current = 0;
            return;
        }

        const dx = dragXRef.current;
        const points = recentPointsRef.current;
        let velocity = 0;
        if (points.length >= 2) {
            const a = points[points.length - 2];
            const b = points[points.length - 1];
            velocity = (b.x - a.x) / Math.max(b.t - a.t, 1);
        }

        const DIST = 80;
        const VEL  = 0.35;

        if (dx < -DIST || (velocity < -VEL && dx < 0)) {
            handleSkip();
        } else if (dx > DIST || (velocity > VEL && dx > 0)) {
            handleInvite();
        } else {
            if (Math.abs(dx) > 15) {
                setDragState('snapping');
                setTimeout(() => { setDragState('idle'); setDragX(0); dragXRef.current = 0; }, 200);
            } else {
                setDragState('idle');
                setDragX(0);
                dragXRef.current = 0;
            }
        }
    };

    // Persist the swipe decision server-side (Tinder memory) so this person
    // never reappears in the deck — survives reloads and other devices.
    const recordSwipe = (targetId: string, action: 'skip' | 'invite') => {
        if (!authUser?.id || !targetId) return;
        supabase
            .from('radar_swipes')
            .upsert(
                { user_id: authUser.id, target_id: targetId, action },
                { onConflict: 'user_id,target_id' }
            )
            .then(({ error }) => {
                if (error) console.error('❌ [RADAR] Error guardando swipe:', error.message);
            });
    };

    const handleSkip = () => {
        const targetId = currentUser?.id;
        if (targetId) {
            recordSwipe(targetId, 'skip');
            supabase.rpc('increment_profile_skips', { u_id: targetId });
            // Remember this skip so it can be undone once (Rewind).
            setLastSkipped({ index: currentIndex, id: targetId });
        }
        flyOff('left');
    };

    // REWIND — recover the last cancelled (skipped) person. Allowed only ONCE
    // per person: after using it on someone, that person can never be rewound
    // again (rewoundIds is persisted).
    const canRewind = !!lastSkipped
        && lastSkipped.index === currentIndex - 1
        && !rewoundIdsRef.current.has(lastSkipped.id);

    const handleRewind = async () => {
        if (!canRewind || !lastSkipped || dragState !== 'idle') return;
        const { id, index } = lastSkipped;

        // Mark as used (persist) so this person is never rewindable again
        rewoundIdsRef.current.add(id);
        if (REWOUND_KEY) {
            try { localStorage.setItem(REWOUND_KEY, JSON.stringify([...rewoundIdsRef.current])); } catch { /* ignore */ }
        }

        // Undo the recorded swipe so they're not excluded on the next scan,
        // and undo the skip counter we bumped.
        if (authUser?.id) {
            supabase.from('radar_swipes').delete().eq('user_id', authUser.id).eq('target_id', id)
                .then(({ error }) => { if (error) console.error('[RADAR] rewind delete swipe failed:', error.message); });
            supabase.rpc('decrement_profile_skips', { u_id: id }).then(() => {}, () => {/* rpc optional */});
        }

        setLastSkipped(null);
        setDragState('entering');
        setCurrentIndex(index); // the skipped card is still at this index in nearbyUsers
        setTimeout(() => setDragState('idle'), 300);
        toast.success('↩️ Recuperaste esta persona (solo una vez).');
    };

    const handleFollow = async () => {
        console.log("🖱️ [CLICK] Botón de seguimiento pulsado para:", currentUser?.username);
        if (!authUser || !currentUser || isBoosting) return;
        
        const targetId = currentUser.id;
        const wasFollowing = currentUser.is_following;

        // Track "Match" in background if following
        if (!wasFollowing) {
            await supabase.rpc('increment_profile_matches', { u_id: targetId });
        }

        // ... existing optimistic update ...
        const updatedUsers = [...nearbyUsers];
        updatedUsers[currentIndex] = { 
            ...currentUser, 
            is_following: !wasFollowing, 
            followers_count: wasFollowing 
                ? Math.max(0, (currentUser.followers_count || 0) - 1) 
                : (currentUser.followers_count || 0) + 1 
        };
        console.log("🚀 [FOLLOW/UNFOLLOW] Acción optimista:", wasFollowing ? "UNFOLLOW" : "FOLLOW");
        setNearbyUsers(updatedUsers);

        try {
            if (wasFollowing) {
                // UNFOLLOW ACTION
                await supabase.from('follows').delete().eq('follower_id', authUser.id).eq('following_id', targetId);
                toast.success(`Dejaste de seguir a ${currentUser.username}`);
            } else {
                // FOLLOW ACTION
                await socialService.followUser(authUser.id, targetId);
                toast.success(`¡Siguiendo a ${currentUser.username}!`);
                
                // NOTIFY (in-app + push, background)
                const followerName = userProfile?.username || authUser.user_metadata?.username || authUser.user_metadata?.full_name || 'Un Guerrero';
                await notificationService.createNotification(targetId, {
                    type: 'follower',
                    title: 'NUEVO SEGUIDOR',
                    content: `${followerName} ha comenzado a seguirte.`,
                    data: {
                        sender_id: authUser.id,
                        sender_name: followerName,
                        follower_id: authUser.id
                    }
                });
                pushService.send(targetId, 'NUEVO SEGUIDOR', `${followerName} ha comenzado a seguirte.`, { sender_id: authUser.id });
            }
        } catch (error: any) {
            console.error("Error in follow toggle:", error);
            // ROLLBACK on error
            const reverted = [...nearbyUsers];
            reverted[currentIndex] = currentUser; // Back to previous state
            setNearbyUsers(reverted);
            toast.error("Error al procesar la acción");
        }
    };

    const handleInvite = async () => {
        if (!currentUser || isInviting) return;
        const targetId = currentUser.id;
        recordSwipe(targetId, 'invite');
        setLastSkipped(null); // inviting clears any pending rewind
        flyOff('right');
        setIsInviting(true);
        try {
            const success = await notificationService.sendInvitation(targetId, currentUser.username);
            if (success) {
                await supabase.rpc('increment_profile_matches', { u_id: targetId });
                toast.success("Desafío enviado!");
            }
        } catch (error) {
            toast.error(!navigator.onLine ? "Sin conexión. Intenta de nuevo cuando tengas internet." : "Error al enviar invitación. Intenta de nuevo.");
        } finally {
            setIsInviting(false);
        }
    };

    return (
        <div className="flex-1 w-full flex flex-col relative overflow-hidden bg-transparent selection:bg-gym-primary selection:text-black">

            {/* Main Content Area - Optimized for Floating Cards */}
            <div className="flex-1 flex flex-col w-full h-full overflow-hidden pt-2 pb-0">

                {/* IDLE/ERROR STATE */}
                {!loading && scanComplete && (nearbyUsers.length === 0 || currentIndex >= nearbyUsers.length) && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-700">
                        <div className="w-24 h-24 bg-neutral-900 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl border border-white/5 relative group">
                            <div className="absolute inset-0 bg-gym-primary/20 rounded-[2.5rem] blur-2xl group-hover:bg-gym-primary/40 transition-all"></div>
                            <MapPin size={48} className="text-gym-primary relative z-10" />
                        </div>
                        <h2 className="text-2xl font-black text-white italic mb-3 uppercase tracking-tighter">Radar Despejado</h2>
                        <p className="text-neutral-500 max-w-xs text-sm font-medium leading-relaxed">No hay más guerreros en tu zona por ahora. ¡Vuelve más tarde para nuevos desafíos!</p>
                        <button
                            onClick={() => {
                                // Force a completely fresh scan: drop the saved deck
                                if (DECK_KEY) localStorage.removeItem(DECK_KEY);
                                setCurrentIndex(0);
                                setScanComplete(false);
                                loadNearbyUsers();
                            }}
                            className="mt-10 bg-white text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gym-primary transition-all active:scale-95 shadow-2xl"
                        >
                            Reiniciar Radar
                        </button>
                    </div>
                )}

                {/* LOADING/SCANNING STATE */}
                {(loading || !scanComplete) && (
                    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="relative w-64 h-64 flex items-center justify-center">
                            {/* Animated Radar Rings */}
                            <div className="absolute inset-0 border-2 border-gym-primary/30 rounded-full animate-[ping_3s_infinite]"></div>
                            <div className="absolute inset-8 border border-gym-primary/20 rounded-full animate-[ping_2s_infinite]"></div>
                            <div className="absolute inset-16 border border-gym-primary/10 rounded-full animate-[ping_4s_infinite]"></div>
                            
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-20 h-20 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center shadow-2xl">
                                    <Loader2 className="text-gym-primary animate-spin" size={32} />
                                </div>
                                <span className="mt-6 text-[10px] font-black text-gym-primary uppercase tracking-[0.3em] animate-pulse italic">Escaneando Perímetros...</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ACTIVE CARD CONTAINER - FLOATING STYLE */}
                {scanComplete && nearbyUsers.length > 0 && currentUser && !loading && (
                    <div
                        className="flex-1 flex flex-col relative w-[94%] mx-auto mb-1 select-none overflow-hidden"
                        onTouchStart={onCardTouchStart}
                        onTouchMove={onCardTouchMove}
                        onTouchEnd={onCardTouchEnd}
                        style={cardStyle()}
                    >
                        <style>{`
                            @keyframes slideInFromRight {
                                from { transform: translateX(100%); opacity: 0.6; }
                                to   { transform: translateX(0);    opacity: 1;   }
                            }
                            @keyframes tinderTutorialSwipe {
                                0% { transform: translate3d(0, 0, 0) rotate(0deg); }
                                /* Swipe Left Demo (NOPE) */
                                10% { transform: translate3d(-100px, 10px, 0) rotate(-10deg); }
                                30% { transform: translate3d(-100px, 10px, 0) rotate(-10deg); }
                                40% { transform: translate3d(0, 0, 0) rotate(0deg); }
                                /* Center Hold */
                                55% { transform: translate3d(0, 0, 0) rotate(0deg); }
                                /* Swipe Right Demo (LIKE) */
                                65% { transform: translate3d(100px, 10px, 0) rotate(10deg); }
                                85% { transform: translate3d(100px, 10px, 0) rotate(10deg); }
                                95% { transform: translate3d(0, 0, 0) rotate(0deg); }
                                100% { transform: translate3d(0, 0, 0) rotate(0deg); }
                            }
                            @keyframes nopeStampFade {
                                0% { opacity: 0; transform: scale(1.3) rotate(-15deg); }
                                10% { opacity: 1; transform: scale(1) rotate(-15deg); }
                                30% { opacity: 1; transform: scale(1) rotate(-15deg); }
                                38% { opacity: 0; transform: scale(0.8) rotate(-15deg); }
                                100% { opacity: 0; }
                            }
                            @keyframes likeStampFade {
                                0% { opacity: 0; transform: scale(1.3) rotate(15deg); }
                                60% { opacity: 0; transform: scale(1.3) rotate(15deg); }
                                65% { opacity: 1; transform: scale(1) rotate(15deg); }
                                85% { opacity: 1; transform: scale(1) rotate(15deg); }
                                93% { opacity: 0; transform: scale(0.8) rotate(15deg); }
                                100% { opacity: 0; }
                            }
                            @keyframes nopeTooltipFade {
                                0% { opacity: 0; transform: translate3d(0, 15px, 0); }
                                10% { opacity: 1; transform: translate3d(0, 0, 0); }
                                30% { opacity: 1; transform: translate3d(0, 0, 0); }
                                38% { opacity: 0; transform: translate3d(0, -10px, 0); }
                                100% { opacity: 0; }
                            }
                            @keyframes likeTooltipFade {
                                0% { opacity: 0; transform: translate3d(0, 15px, 0); }
                                60% { opacity: 0; transform: translate3d(0, 15px, 0); }
                                65% { opacity: 1; transform: translate3d(0, 0, 0); }
                                85% { opacity: 1; transform: translate3d(0, 0, 0); }
                                100% { opacity: 0; }
                            }
                            @keyframes pulseLeft {
                                0%, 100% { transform: translateX(0); opacity: 1; }
                                50% { transform: translateX(-5px); opacity: 0.3; }
                            }
                            @keyframes pulseRight {
                                0%, 100% { transform: translateX(0); opacity: 1; }
                                50% { transform: translateX(5px); opacity: 0.3; }
                            }
                        `}</style>



                        {/* Autoplay Tutorial stamps */}
                        {isPlayingTutorial && (
                            <>
                                {/* NOPE Stamp */}
                                <div className="absolute top-[125px] left-[30%] -translate-x-1/2 z-50 pointer-events-none opacity-0 select-none animate-[nopeStampFade_3s_ease-in-out_infinite]">
                                    <div className="border-4 border-red-500 text-red-500 font-black text-4xl px-5 py-1.5 rounded-2xl uppercase tracking-widest bg-black/70 backdrop-blur-sm shadow-2xl">
                                        NOPE
                                    </div>
                                </div>

                                {/* MATCH Stamp — spec §1.5/línea 277: el Radar nunca debe mostrar
                                    un "me gusta"/"LIKE" hacia personas; el gesto de deslizar a la
                                    derecha envía una invitación de entrenamiento (match), no un like. */}
                                <div className="absolute top-[125px] right-[30%] translate-x-1/2 z-50 pointer-events-none opacity-0 select-none animate-[likeStampFade_3s_ease-in-out_infinite]">
                                    <div className="border-4 border-gym-primary text-gym-primary font-black text-4xl px-5 py-1.5 rounded-2xl uppercase tracking-widest bg-black/70 backdrop-blur-sm shadow-2xl">
                                        MATCH
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Autoplay Tutorial Floating explanations */}
                        {isPlayingTutorial && (
                            <div className="absolute bottom-[190px] left-4 right-4 z-50 pointer-events-none select-none flex flex-col items-center">
                                {/* Left Explanation Card */}
                                <div className="absolute w-full max-w-[250px] bg-black/95 backdrop-blur-md border border-red-500/40 rounded-2xl px-4 py-3 shadow-[0_15px_35px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2 animate-[nopeTooltipFade_3s_ease-in-out_infinite]">
                                    <ChevronsLeft className="text-red-500 animate-[pulseLeft_1.5s_infinite] shrink-0" size={16} />
                                    <span className="text-red-400 text-[10px] font-black uppercase tracking-[0.1em] text-center">Desliza para DESCARTAR</span>
                                </div>

                                {/* Right Explanation Card */}
                                <div className="absolute w-full max-w-[250px] bg-black/95 backdrop-blur-md border border-gym-primary/40 rounded-2xl px-4 py-3 shadow-[0_15px_35px_rgba(229,255,0,0.3)] flex items-center justify-center gap-2 animate-[likeTooltipFade_3s_ease-in-out_infinite]">
                                    <span className="text-gym-primary text-[10px] font-black uppercase tracking-[0.1em] text-center">Desliza para dar MATCH</span>
                                    <ChevronsRight className="text-gym-primary animate-[pulseRight_1.5s_infinite] shrink-0" size={16} />
                                </div>
                            </div>
                        )}

                        <UserProfileCard
                            key={currentUser.id}
                            user={currentUser}
                            hidePermissions={true}
                            isRadar={true}
                            actions={
                                <div className="flex items-center justify-center gap-5 px-2 mt-auto pb-4 relative">
                                    {/* 0. REWIND — recover the last cancelled person (once each).
                                        Floats above the row so it never shifts the main buttons. */}
                                    {canRewind && (
                                        <button
                                            onClick={handleRewind}
                                            className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-amber-500 text-black font-black text-[11px] uppercase tracking-wider px-4 py-2.5 rounded-full shadow-[0_8px_24px_rgba(245,158,11,0.4)] active:scale-90 transition-all animate-in slide-in-from-bottom-2 fade-in"
                                            title="Recuperar (1 vez)"
                                        >
                                            <RotateCcw size={15} strokeWidth={3} />
                                            Regresar
                                        </button>
                                    )}
                                    {/* 1. SEGUIR GUERRERO */}
                                    <button
                                        onClick={handleFollow}
                                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl ${
                                            currentUser.is_following 
                                            ? 'bg-blue-500 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                                            : 'bg-neutral-900 border border-white/5 text-neutral-500 hover:text-blue-500 hover:bg-blue-500/10'
                                        }`}
                                        title={currentUser.is_following ? "Siguiendo" : "Seguir"}
                                    >
                                        <UserPlus size={24} fill={currentUser.is_following ? "currentColor" : "none"} />
                                    </button>

                                    {/* 2. ACCIÓN CENTRAL: DESAFIAR/INVITAR (EL MÁS GRANDE) */}
                                    <button 
                                        onClick={handleInvite}
                                        className="w-20 h-20 rounded-[2rem] bg-white flex items-center justify-center text-black hover:bg-gym-primary hover:scale-110 transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)] group"
                                        title="Invitar a Entrenar"
                                    >
                                        <Swords size={32} className="group-hover:scale-110 transition-transform" fill="currentColor" />
                                    </button>

                                    {/* 3. BOOST PERSONAL (ZAP) */}
                                    <button 
                                        onClick={() => setIsBoostModalOpen(true)}
                                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl ${
                                            userProfile?.boost_until && new Date(userProfile.boost_until) > new Date()
                                            ? 'bg-yellow-500 text-black border-yellow-400 animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.3)]'
                                            : 'bg-neutral-900 border border-white/5 text-neutral-500 hover:text-yellow-500 hover:bg-yellow-500/10'
                                        }`}
                                        title="Boost Perfil"
                                    >
                                        <Zap size={24} fill={userProfile?.boost_until && new Date(userProfile.boost_until) > new Date() ? "currentColor" : "none"} />
                                    </button>
                                </div>
                            }
                        />
                        
                        <BoostModal 
                            isOpen={isBoostModalOpen}
                            onClose={() => setIsBoostModalOpen(false)}
                            onConfirm={handleBoostConfirm}
                            isBoosting={isBoosting}
                            isActive={!!(userProfile?.boost_until && new Date(userProfile.boost_until) > new Date())}
                            expiresAt={userProfile?.boost_until}
                            currentPoints={userProfile?.g_points || 0}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
