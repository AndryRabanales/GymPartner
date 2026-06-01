import { useState, useEffect } from 'react';
import { X, Search, Check, Swords, Loader2, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { workoutService } from '../../services/WorkoutService';
import { notificationService } from '../../services/NotificationService';

interface ShareRoutinesToUserModalProps {
    userId: string;
    requesterId: string;
    requesterUsername: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const ShareRoutinesToUserModal = ({
    userId,
    requesterId,
    requesterUsername,
    onClose,
    onSuccess
}: ShareRoutinesToUserModalProps) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Routines Lists
    const [myRoutines, setMyRoutines] = useState<any[]>([]);
    const [selectedRoutineIds, setSelectedRoutineIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const loadRoutinesAndShares = async () => {
            setLoading(true);
            try {
                // 1. Fetch all of my routines
                const { data: routinesData, error: routinesError } = await supabase
                    .from('routines')
                    .select('id, name, routine_exercises(id)')
                    .eq('user_id', userId);

                if (routinesError) throw routinesError;

                const sortedRoutines = (routinesData || []).sort((a, b) => a.name.localeCompare(b.name));
                setMyRoutines(sortedRoutines);

                // 2. Fetch which of my routines are already shared with this requester
                const { data: sharedData, error: sharedError } = await supabase
                    .from('routine_shares')
                    .select('routine_id')
                    .eq('shared_with', requesterId)
                    .eq('shared_by', userId);

                if (sharedError && sharedError.code !== '42P01') throw sharedError;

                const sharedSet = new Set<string>((sharedData || []).map(d => d.routine_id));
                setSelectedRoutineIds(sharedSet);
            } catch (err) {
                console.error("Error loading routines for sharing:", err);
            } finally {
                setLoading(false);
            }
        };

        loadRoutinesAndShares();
    }, [userId, requesterId]);

    const toggleRoutine = (routineId: string) => {
        setSelectedRoutineIds(prev => {
            const next = new Set(prev);
            if (next.has(routineId)) {
                next.delete(routineId);
            } else {
                next.add(routineId);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedRoutineIds.size === myRoutines.length) {
            setSelectedRoutineIds(new Set());
        } else {
            setSelectedRoutineIds(new Set(myRoutines.map(r => r.id)));
        }
    };

    const filteredRoutines = myRoutines.filter(r => 
        r.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleConfirm = async () => {
        setSaving(true);
        try {
            // Fetch sender profile details to get current username
            const { data: myProfile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', userId)
                .single();

            const myUsername = myProfile?.username || 'guerrero';

            // For each of my routines, we determine the final shared state for this specific user
            for (const r of myRoutines) {
                const isSelected = selectedRoutineIds.has(r.id);
                
                // Fetch the list of users currently having access to this routine
                const currentShares = await workoutService.getRoutineShares(r.id);
                const hasAccess = currentShares.includes(requesterId);

                if (isSelected && !hasAccess) {
                    // Grant access (Union)
                    await workoutService.shareRoutine(r.id, userId, [...currentShares, requesterId]);

                    // Send Notification to recipient!
                    await notificationService.createNotification(requesterId, {
                        type: 'system',
                        title: '⚔️ MAZO DE ENTRENAMIENTO RECIBIDO',
                        content: `@${myUsername} te ha compartido su mazo: ${r.name}`,
                        data: {
                            type: 'routine_shared',
                            routine_id: r.id,
                            routine_name: r.name,
                            sender_id: userId,
                            sender_username: myUsername
                        }
                    });
                } else if (!isSelected && hasAccess) {
                    // Revoke access
                    await workoutService.shareRoutine(r.id, userId, currentShares.filter(uid => uid !== requesterId));
                }
            }

            alert(`¡Rutinas compartidas con @${requesterUsername} actualizadas exitosamente!`);
            onSuccess();
        } catch (err) {
            console.error("Error saving routine shares:", err);
            alert("Error al compartir las rutinas.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[999] flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col gap-6">
                
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gym-primary/10 rounded-full flex items-center justify-center text-gym-primary shrink-0 animate-pulse">
                            <Swords size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black italic text-white uppercase tracking-tight">Compartir Rutinas</h2>
                            <p className="text-gym-primary text-xs md:text-sm font-bold">
                                Selecciona qué estrategias compartir con @{requesterUsername}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-gym-primary gap-4">
                        <Loader2 className="animate-spin" size={32} />
                        <span className="text-neutral-400 font-bold">Cargando tus estrategias...</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-450 text-neutral-450 flex items-center gap-2">
                                <Shield size={14} className="text-gym-primary" />
                                Tus Mazos Disponibles ({myRoutines.length})
                            </h3>
                            {myRoutines.length > 0 && (
                                <button 
                                    onClick={toggleSelectAll}
                                    className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-black uppercase px-2.5 py-1.5 rounded-lg border border-white/5 transition-all"
                                >
                                    {selectedRoutineIds.size === myRoutines.length ? "Deseleccionar Todo" : "Seleccionar Todo"}
                                </button>
                            )}
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                            <input
                                type="text"
                                placeholder="Buscar rutina..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-black border border-neutral-800 rounded-xl py-3.5 pl-11 pr-4 text-[16px] text-white placeholder-neutral-500 focus:outline-none focus:border-gym-primary transition-colors"
                            />
                        </div>

                        {/* List */}
                        <div className="max-h-[35vh] overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
                            {filteredRoutines.map(routine => {
                                const isChecked = selectedRoutineIds.has(routine.id);
                                return (
                                    <button
                                        key={routine.id}
                                        onClick={() => toggleRoutine(routine.id)}
                                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                                            isChecked
                                                ? 'bg-gym-primary/10 border-gym-primary'
                                                : 'bg-black/50 border-neutral-800 hover:border-neutral-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 truncate">
                                            <div className="w-9 h-9 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center shrink-0">
                                                <Swords size={16} className={isChecked ? 'text-gym-primary' : 'text-neutral-400'} />
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span className="font-bold text-sm text-white truncate uppercase italic">{routine.name}</span>
                                                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">{routine.routine_exercises?.length || 0} cartas</span>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                            isChecked ? 'bg-gym-primary border-transparent text-black' : 'border-neutral-700'
                                        }`}>
                                            {isChecked && <Check size={12} strokeWidth={3} />}
                                        </div>
                                    </button>
                                );
                            })}
                            {filteredRoutines.length === 0 && (
                                <div className="text-center py-12 text-neutral-500 text-sm">
                                    {searchTerm ? "No se encontraron rutinas." : "No tienes rutinas creadas en tu arsenal aún."}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer Buttons */}
                {!loading && (
                    <div className="flex gap-3 mt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3.5 rounded-xl transition-all border border-neutral-700 uppercase tracking-wide text-xs"
                            disabled={saving}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-1 bg-gym-primary hover:bg-yellow-400 text-black font-black py-3.5 rounded-xl transition-all uppercase italic tracking-wider text-xs flex items-center justify-center gap-2"
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    GUARDANDO...
                                </>
                            ) : (
                                <>
                                    <Swords size={16} strokeWidth={3} />
                                    Confirmar ({selectedRoutineIds.size})
                                 </>
                            )}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};
