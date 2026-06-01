import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Play, Trash2, Clock, MapPin, Loader2 } from 'lucide-react';
import { workoutService } from '../../services/WorkoutService';
import { supabase } from '../../lib/supabase';

interface ActiveSessionRescueModalProps {
  isOpen: boolean;
  sessionId: string;
  gymId: string | null;
  startedAt: string;
  onResolve: () => void; // Called when session is successfully resumed or deleted
}

export const ActiveSessionRescueModal: React.FC<ActiveSessionRescueModalProps> = ({
  isOpen,
  sessionId,
  gymId,
  startedAt,
  onResolve
}) => {
  if (!isOpen) return null;

  const navigate = useNavigate();
  const [gymName, setGymName] = useState<string>('Entrenamiento Personal');
  const [elapsedTime, setElapsedTime] = useState<string>('00:00');
  const [loadingDelete, setLoadingDelete] = useState<boolean>(false);

  // Fetch gym name if gymId is present
  useEffect(() => {
    let active = true;
    const fetchGym = async () => {
      if (!gymId || gymId === 'virtual' || gymId === 'personal') {
        if (active) setGymName('Entrenamiento Personal');
        return;
      }
      try {
        const { data } = await supabase
          .from('gyms')
          .select('name')
          .eq('id', gymId)
          .maybeSingle();
        if (active && data?.name) {
          setGymName(data.name);
        }
      } catch (err) {
        console.warn('Error fetching gym name for rescue modal:', err);
      }
    };
    fetchGym();
    return () => { active = false; };
  }, [gymId]);

  const [partnerStatus, setPartnerStatus] = useState<'active' | 'dead' | 'checking'>('checking');
  const [hostName, setHostName] = useState<string | null>(null);

  // Verify if partner's co-op session is still active
  useEffect(() => {
    let active = true;
    const verifyPartnerSession = async () => {
      if (!sessionId) return;
      try {
        const { data: mySess } = await supabase
          .from('workout_sessions')
          .select('is_multiplayer, partner_session_id, partner_id')
          .eq('id', sessionId)
          .maybeSingle();

        if (!active) return;

        if (mySess?.is_multiplayer) {
          // If multiplayer guest, let's fetch the Host's profile name
          if (mySess.partner_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, full_name')
              .eq('id', mySess.partner_id)
              .maybeSingle();
              
            if (active && profile) {
              setHostName(profile.full_name || profile.username || 'Tu compañero');
            }
          }

          if (mySess.partner_session_id) {
            // If we are the guest, validate if the host session still exists and is unfinished
            const { data: partnerSess } = await supabase
              .from('workout_sessions')
              .select('id, finished_at')
              .eq('id', mySess.partner_session_id)
              .maybeSingle();

            if (!active) return;

            if (!partnerSess || partnerSess.finished_at !== null) {
              setPartnerStatus('dead');
            } else {
              setPartnerStatus('active');
            }
          } else {
            // We are the Host/Inviter
            setPartnerStatus('active');
          }
        } else {
          // We are an individual training session
          setPartnerStatus('active');
        }
      } catch (err) {
        console.warn('Error checking partner session active status:', err);
        if (active) setPartnerStatus('active');
      }
    };
    verifyPartnerSession();
    return () => { active = false; };
  }, [sessionId]);

  // Premium Timer Logic
  useEffect(() => {
    if (!startedAt) return;

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, now - new Date(startedAt).getTime());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setElapsedTime(`${hours}h ${minutes.toString().padStart(2, '0')}m`);
      } else {
        setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    const interval = setInterval(tick, 1000);
    tick();
    return () => clearInterval(interval);
  }, [startedAt]);

  const handleResume = async () => {
    if (partnerStatus === 'dead') {
      if (window.confirm('El entrenamiento cooperativo conjunto ya fue finalizado o cancelado por tu compañero. ¿Deseas finalizar este entrenamiento y archivarlo síncronamente de forma limpia en tu historial?')) {
        setLoadingDelete(true);
        try {
          await workoutService.finishSession(sessionId, "Sesión cooperativa huérfana archivada por desconexión", undefined, false);
          localStorage.removeItem(`workout_draft_${sessionId}`);
          localStorage.removeItem('ginx_active_session');
          localStorage.removeItem('ginx_coop_state');
          onResolve();
        } catch (err) {
          console.error('Error auto-finalizing dead coop session:', err);
          alert('Error al intentar archivar la sesión.');
        } finally {
          setLoadingDelete(false);
        }
      }
      return;
    }
    onResolve();
    navigate(`/workout/${gymId || 'personal'}`, { state: { sessionId } });
  };

  const handleDelete = async () => {
    if (window.confirm('¿Seguro que deseas eliminar por completo este entrenamiento pendiente? Todo el progreso de hoy se perderá.')) {
      setLoadingDelete(true);
      try {
        await workoutService.deleteSession(sessionId);
        localStorage.removeItem(`workout_draft_${sessionId}`);
        localStorage.removeItem('ginx_active_session');
        localStorage.removeItem('ginx_coop_state');
        onResolve();
      } catch (err) {
        console.error('Error deleting rescued session:', err);
        alert('Error al intentar eliminar el entrenamiento.');
      } finally {
        setLoadingDelete(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Premium blur backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
      
      {/* Card container */}
      <div className="relative z-10 w-full max-w-md bg-neutral-900 border border-yellow-500/30 rounded-3xl shadow-[0_0_50px_rgba(250,204,21,0.25)] overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Animated Gold Header */}
        <div className="pt-8 pb-4 flex flex-col items-center bg-gradient-to-b from-yellow-500/10 to-transparent border-b border-white/5">
          <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(250,204,21,0.4)] animate-pulse">
            <AlertTriangle size={32} className="text-yellow-500" />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider text-center px-6 italic">
            {hostName ? '¡Entrenamiento Conjunto!' : '¡Entrenamiento Pendiente!'}
          </h2>
          <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mt-1">
            {hostName ? `SALA DE ${hostName.toUpperCase()}` : 'SESIÓN EN EJECUCIÓN DETECTADA'}
          </p>
        </div>

        {/* Details Panel */}
        <div className="p-6 space-y-4">
          <p className="text-neutral-400 text-xs text-center font-semibold leading-relaxed">
            {hostName 
              ? `Hemos detectado que tienes una sesión cooperativa activa en la sala de ${hostName}. Puedes volver a unirte para seguir entrenando juntos o cerrarla de forma permanente.`
              : 'Hemos detectado que tienes un entrenamiento activo que no fue finalizado o cerrado correctamente. Rescata tu entrenamiento ahora o elimínalo.'
            }
          </p>

          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <MapPin className="text-yellow-500 shrink-0" size={18} />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-neutral-500 uppercase tracking-wider">Ubicación / Tipo</span>
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
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-0 space-y-3">
          <button
            onClick={handleResume}
            disabled={loadingDelete}
            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-br from-yellow-400 to-orange-500 text-black font-black uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-yellow-500/20 hover:scale-[1.01] transition-all active:scale-95 disabled:opacity-50"
          >
            <Play size={18} fill="currentColor" className="text-black" />
            {hostName ? 'VOLVER AL ENTRENAMIENTO CONJUNTO' : 'VOLVER AL ENTRENAMIENTO'}
          </button>
          
          <button
            onClick={handleDelete}
            disabled={loadingDelete}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-950/20 border border-red-500/30 text-red-500 hover:bg-red-950/40 font-black uppercase tracking-wider rounded-2xl transition-all active:scale-95 disabled:opacity-50"
          >
            {loadingDelete ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Trash2 size={16} />
            )}
            {hostName ? 'CERRAR PARTICIPACIÓN' : 'ELIMINAR ENTRENAMIENTO'}
          </button>
        </div>
      </div>
    </div>
  );
};
