import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Play, Trash2, Clock, MapPin, Loader2, Users, DoorOpen } from 'lucide-react';
import { workoutService } from '../../services/WorkoutService';
import { supabase } from '../../lib/supabase';

// "Posponer" only grants a TEMPORARY reprieve — never a silent permanent dismissal.
// Long enough to let the user finish whatever briefly pulled them away, short enough
// that the system keeps "obligando" them to return and make a final call
// (continuar, cerrar/finalizar, o volver a posponer).
const RESCUE_SNOOZE_MS = 15 * 60 * 1000; // 15 minutes

interface ActiveSessionRescueModalProps {
  isOpen: boolean;
  sessionId: string;
  gymId: string | null;
  startedAt: string;
  onResolve: () => void;
  // True when this rescue was detected purely from local storage because the
  // database was unreachable (offline). There is no real DB session id to
  // query in this case — skip every DB call (room detection, gym name,
  // deletion) and only offer resume/dismiss against local storage.
  offlineMode?: boolean;
}

export const ActiveSessionRescueModal: React.FC<ActiveSessionRescueModalProps> = ({
  isOpen,
  sessionId,
  gymId,
  startedAt,
  onResolve,
  offlineMode = false
}) => {
  // NOTE: all hooks must run unconditionally — early return is at the bottom of the render
  const navigate = useNavigate();
  const [gymName, setGymName] = useState<string>('Entrenamiento Personal');
  const [elapsedTime, setElapsedTime] = useState<string>('00:00');
  const [loadingAction, setLoadingAction] = useState<boolean>(false);

  // ─── Session type detection ────────────────────────────────────────────────
  type RoomStatus = 'checking' | 'room_open' | 'room_closed' | 'solo';
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('checking');
  const [hostName, setHostName] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [isHost, setIsHost] = useState<boolean>(false);

  useEffect(() => {
    if (offlineMode) return; // No DB access offline — keep the default gym name.
    if (!gymId || gymId === 'virtual' || gymId === 'personal') {
      setGymName('Entrenamiento Personal');
      return;
    }
    let active = true;
    supabase.from('gyms').select('name').eq('id', gymId).maybeSingle().then(({ data }) => {
      if (active && data?.name) setGymName(data.name);
    });
    return () => { active = false; };
  }, [gymId, offlineMode]);

  useEffect(() => {
    if (offlineMode) {
      // Can't reach the DB to detect room/coop state — treat as a resumable
      // solo session restored purely from local storage.
      setRoomStatus('solo');
      return;
    }
    if (!sessionId) return;
    let active = true;

    const detectRoom = async () => {
      const { data: mySess } = await supabase
        .from('workout_sessions')
        .select('is_multiplayer, partner_session_id, partner_id, user_id')
        .eq('id', sessionId)
        .maybeSingle();

      if (!active || !mySess) return;

      if (!mySess.is_multiplayer) {
        setRoomStatus('solo');
        return;
      }

      // ── Am I the HOST? ────────────────────────────────────────────────────
      // Host's session has partner_session_id = null (or pointing to a guest, not to another host)
      // We detect "I am host" when NO session references MY session as its partner_session_id
      // Simplest heuristic: if partner_session_id is null → I'm the host
      const amHost = !mySess.partner_session_id;
      setIsHost(amHost);

      const resolvedRoomId = amHost ? sessionId : mySess.partner_session_id;
      setRoomId(resolvedRoomId);

      // ── Is room still open? ───────────────────────────────────────────────
      const open = await workoutService.isRoomOpen(resolvedRoomId!);

      if (!active) return;

      if (open) {
        setRoomStatus('room_open');
        // Fetch active member count
        const members = await workoutService.getRoomActiveMembers(resolvedRoomId!);
        if (active) setMemberCount(members.length);
      } else {
        setRoomStatus('room_closed');
      }

      // ── Fetch host info (for guests) ─────────────────────────────────────
      if (!amHost && mySess.partner_id) {
        setHostId(mySess.partner_id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', mySess.partner_id)
          .maybeSingle();
        if (active && profile) setHostName(profile.username);
      }
    };

    detectRoom();
    return () => { active = false; };
  }, [sessionId, offlineMode]);

  // Elapsed timer
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsedTime(h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [startedAt]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  // Clears any pending snooze the moment the user makes a FINAL call (continue or
  // cancel/finish) — keeps localStorage from accumulating one stale
  // `ginx_rescue_snooze_*` entry per past session over a user's lifetime.
  const clearSnooze = () => {
    try { localStorage.removeItem(`ginx_rescue_snooze_${sessionId}`); } catch { /* ignore */ }
  };

  const handleRejoinRoom = () => {
    clearSnooze();
    onResolve();
    sessionStorage.removeItem('ginx_temp_exit_active');

    if (isHost) {
      // Host returns to their own session — no extra state needed
      navigate('/workout', { state: { sessionId, isMultiplayer: true, multiplayerMode: 'conjunto', isInviter: true, forceNewSession: false } });
    } else {
      // Guest restores room context from localStorage or reconstructs from DB
      const cachedStr = localStorage.getItem('ginx_coop_state');
      const cached = cachedStr ? JSON.parse(cachedStr) : {};

      const partnerSessionIdToUse = cached.partnerSessionId || cached.chatId || roomId;
      const partnerIdToUse = cached.partnerId || hostId;

      // Ensure coop state is persisted for recovery
      localStorage.setItem('ginx_coop_state', JSON.stringify({
        isMultiplayer: true,
        multiplayerMode: 'conjunto',
        partnerId: partnerIdToUse,
        chatId: partnerSessionIdToUse,
        partnerSessionId: partnerSessionIdToUse,
        isInviter: false
      }));

      navigate('/workout', {
        state: {
          sessionId,
          isMultiplayer: true,
          multiplayerMode: 'conjunto',
          partnerId: partnerIdToUse,
          chatId: partnerSessionIdToUse,
          partnerSessionId: partnerSessionIdToUse,
          isInviter: false,
          forceNewSession: false
        }
      });
    }
  };

  const handleLeaveRoom = async () => {
    const confirmMsg = isHost
      ? '¿Cerrar la sala para todos? Cada participante conservará su progreso en su historial.'
      : '¿Salir de la sala? Tu progreso quedará guardado en tu historial.';

    if (!window.confirm(confirmMsg)) return;

    setLoadingAction(true);
    try {
      if (isHost && roomId) {
        // Host closes the whole room
        await workoutService.closeRoom(roomId);
      } else {
        // Guest leaves: finalize only their session
        await workoutService.finishSession(sessionId, 'Salida manual de la sala', undefined, true);
      }
      localStorage.removeItem('ginx_coop_state');
      localStorage.removeItem('ginx_active_session');
      localStorage.removeItem(`workout_draft_${sessionId}`);
      sessionStorage.removeItem('ginx_temp_exit_active');
      clearSnooze();
      onResolve();
    } catch (err) {
      console.error('Error leaving room:', err);
      alert('Error al salir de la sala. Por favor intenta de nuevo.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleResumeSolo = () => {
    clearSnooze();
    onResolve();
    sessionStorage.removeItem('ginx_temp_exit_active');
    if (offlineMode) {
      // No real DB session id to hand off — WorkoutSession's own init already
      // falls back to the local STORAGE_KEY draft when no active DB session
      // is found, so just route there without a (fake) sessionId.
      navigate(`/workout/${gymId || 'personal'}`, { state: { forceNewSession: false } });
      return;
    }
    navigate(`/workout/${gymId || 'personal'}`, { state: { sessionId, forceNewSession: false } });
  };

  // ─── Postpone ──────────────────────────────────────────────────────────────
  // Defers the decision WITHOUT resolving the unfinished session/room. This is
  // intentionally NOT a permanent dismissal: AppLayout's rescue-check effect
  // re-arms this modal automatically once RESCUE_SNOOZE_MS elapses (checked both
  // on navigation and via a periodic interval), so the user is always forced to
  // eventually choose: continuar, cerrar/finalizar, o volver a posponer.
  const handlePostpone = () => {
    try {
      localStorage.setItem(`ginx_rescue_snooze_${sessionId}`, String(Date.now() + RESCUE_SNOOZE_MS));
    } catch {
      // Storage unavailable — worst case the modal simply re-shows sooner, which is safe.
    }
    onResolve();
  };

  const handleDeleteSolo = async () => {
    if (!window.confirm('¿Eliminar este entrenamiento? Todo el progreso se perderá.')) return;
    setLoadingAction(true);
    try {
      if (!offlineMode) {
        await workoutService.deleteSession(sessionId);
      }
      localStorage.removeItem(`workout_draft_${sessionId}`);
      localStorage.removeItem('ginx_active_session');
      sessionStorage.removeItem('ginx_temp_exit_active');
      clearSnooze();
      onResolve();
    } catch (err) {
      console.error('Error deleting session:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  const isRoom = roomStatus === 'room_open' || roomStatus === 'room_closed';
  const isLoading = roomStatus === 'checking';

  const title = isLoading
    ? 'Verificando...'
    : roomStatus === 'room_open'
      ? isHost ? '¡Tu Sala está Activa!' : `¡Sala de ${hostName || 'tu compañero'}!`
      : roomStatus === 'room_closed'
        ? 'Sala Cerrada'
        : '¡Entrenamiento Pendiente!';

  const subtitle = isLoading
    ? ''
    : roomStatus === 'room_open'
      ? isHost ? 'ANFITRIÓN DE LA SALA' : 'SALA EN PROGRESO'
      : roomStatus === 'room_closed'
        ? 'EL ANFITRIÓN CERRÓ LA SALA'
        : 'SESIÓN EN EJECUCIÓN DETECTADA';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-md bg-neutral-900 border border-yellow-500/30 rounded-3xl shadow-[0_0_50px_rgba(250,204,21,0.25)] overflow-hidden animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="pt-8 pb-4 flex flex-col items-center bg-gradient-to-b from-yellow-500/10 to-transparent border-b border-white/5">
          <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(250,204,21,0.4)] animate-pulse">
            {isRoom ? <Users size={32} className="text-yellow-500" /> : <AlertTriangle size={32} className="text-yellow-500" />}
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider text-center px-6 italic">{title}</h2>
          {subtitle ? (
            <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mt-1">{subtitle}</p>
          ) : null}
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="animate-spin text-yellow-500" size={24} />
            </div>
          ) : (
            <>
              <p className="text-neutral-400 text-xs text-center font-semibold leading-relaxed">
                {roomStatus === 'room_open' && isHost && 'Tu sala está activa. Otros participantes pueden estar entrenando. Puedes volver cuando quieras.'}
                {roomStatus === 'room_open' && !isHost && `La sala de ${hostName || 'tu compañero'} sigue activa. Puedes reintegrarte y seguir entrenando.`}
                {roomStatus === 'room_closed' && 'El anfitrión cerró la sala. Tu progreso fue guardado automáticamente en tu historial.'}
                {roomStatus === 'solo' && 'Tienes un entrenamiento activo que no fue finalizado. Puedes retomarlo o eliminarlo.'}
              </p>

              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <MapPin className="text-yellow-500 shrink-0" size={18} />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-neutral-500 uppercase tracking-wider">Ubicación</span>
                    <span className="text-xs font-black text-white uppercase italic">{gymName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="text-yellow-500 shrink-0" size={18} />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-neutral-500 uppercase tracking-wider">Tiempo Transcurrido</span>
                    <span className="text-sm font-mono font-black text-white tracking-widest">{elapsedTime}</span>
                  </div>
                </div>

                {isRoom && roomStatus === 'room_open' && memberCount > 0 && (
                  <div className="flex items-center gap-3">
                    <Users className="text-yellow-500 shrink-0" size={18} />
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-neutral-500 uppercase tracking-wider">En la Sala Ahora</span>
                      <span className="text-xs font-black text-white">{memberCount} participante{memberCount !== 1 ? 's' : ''} activo{memberCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        {!isLoading && (
          <div className="p-6 pt-0 space-y-3">
            {/* Room open: rejoin button */}
            {roomStatus === 'room_open' && (
              <button
                onClick={handleRejoinRoom}
                disabled={loadingAction}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-br from-yellow-400 to-orange-500 text-black font-black uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-yellow-500/20 hover:scale-[1.01] transition-all active:scale-95 disabled:opacity-50"
              >
                <Play size={18} fill="currentColor" />
                {isHost ? 'VOLVER A MI SALA' : 'VOLVER A LA SALA'}
              </button>
            )}

            {/* Room closed: finalize guest session + clear */}
            {roomStatus === 'room_closed' && (
              <button
                onClick={async () => {
                  setLoadingAction(true);
                  try {
                    // Finalize the guest's own session so it no longer appears as active
                    await workoutService.finishSession(sessionId, 'Sala cerrada por el anfitrión', undefined, true);
                  } catch (e) {
                    console.warn('room_closed dismiss: could not finalize session', e);
                  } finally {
                    setLoadingAction(false);
                  }
                  localStorage.removeItem('ginx_coop_state');
                  localStorage.removeItem('ginx_active_session');
                  localStorage.removeItem(`workout_draft_${sessionId}`);
                  sessionStorage.removeItem('ginx_temp_exit_active');
                  clearSnooze();
                  onResolve();
                }}
                disabled={loadingAction}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-br from-neutral-700 to-neutral-800 text-white font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-50"
              >
                {loadingAction ? <Loader2 className="animate-spin" size={18} /> : <DoorOpen size={18} />}
                ENTENDIDO — VER MI HISTORIAL
              </button>
            )}

            {/* Solo: resume */}
            {roomStatus === 'solo' && (
              <button
                onClick={handleResumeSolo}
                disabled={loadingAction}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-br from-yellow-400 to-orange-500 text-black font-black uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-yellow-500/20 hover:scale-[1.01] transition-all active:scale-95 disabled:opacity-50"
              >
                <Play size={18} fill="currentColor" />
                RETOMAR ENTRENAMIENTO
              </button>
            )}

            {/* Postpone: defer the call WITHOUT making it disappear for good —
                the system re-arms this prompt automatically (see RESCUE_SNOOZE_MS),
                forcing the user back to a real decision later: continuar, cerrar/
                finalizar, o volver a posponer. */}
            {(roomStatus === 'room_open' || roomStatus === 'solo') && (
              <button
                onClick={handlePostpone}
                disabled={loadingAction}
                className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-800/60 border border-white/5 text-neutral-300 hover:bg-neutral-800 hover:text-white font-black uppercase tracking-wider text-[11px] rounded-2xl transition-all active:scale-95 disabled:opacity-50"
              >
                <Clock size={16} />
                RECORDAR MÁS TARDE
              </button>
            )}

            {/* Destructive: leave room (open) or delete session (solo) */}
            {roomStatus === 'room_open' && (
              <button
                onClick={handleLeaveRoom}
                disabled={loadingAction}
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-950/20 border border-red-500/30 text-red-500 hover:bg-red-950/40 font-black uppercase tracking-wider rounded-2xl transition-all active:scale-95 disabled:opacity-50"
              >
                {loadingAction ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                {isHost ? 'CERRAR SALA PARA TODOS' : 'SALIR DE LA SALA'}
              </button>
            )}

            {roomStatus === 'solo' && (
              <button
                onClick={handleDeleteSolo}
                disabled={loadingAction}
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-950/20 border border-red-500/30 text-red-500 hover:bg-red-950/40 font-black uppercase tracking-wider rounded-2xl transition-all active:scale-95 disabled:opacity-50"
              >
                {loadingAction ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                ELIMINAR ENTRENAMIENTO
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
