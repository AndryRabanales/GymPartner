import { useState, useEffect } from 'react';
import { X, Search, Check, Users, Swords, Loader, Share2 } from 'lucide-react';
import { socialService } from '../../services/SocialService';
import { workoutService } from '../../services/WorkoutService';

interface ShareRoutineModalProps {
    userId: string;
    preSelectedRoutineId: string | null;
    allRoutines: any[];
    onClose: () => void;
}

export const ShareRoutineModal = ({ userId, preSelectedRoutineId, allRoutines, onClose }: ShareRoutineModalProps) => {
    const [loading, setLoading] = useState(true);
    const [sharing, setSharing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Followers & Following List
    const [followersAndFollowing, setFollowersAndFollowing] = useState<any[]>([]);

    // Selection States
    const [selectedRoutines, setSelectedRoutines] = useState<Set<string>>(new Set());
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Pre-select the routine that was long-pressed
        if (preSelectedRoutineId) {
            setSelectedRoutines(new Set([preSelectedRoutineId]));
        } else if (allRoutines.length > 0) {
            setSelectedRoutines(new Set([allRoutines[0].id]));
        }

        const loadRelations = async () => {
            setLoading(true);
            try {
                // Fetch followers and following in parallel
                const [followers, following] = await Promise.all([
                    socialService.getFollowers(userId),
                    socialService.getFollowing(userId)
                ]);

                // Merge and deduplicate by user ID
                const merged = [...followers, ...following];
                const seen = new Set();
                const uniqueRelations = merged.filter(user => {
                    if (!user || seen.has(user.id)) return false;
                    seen.add(user.id);
                    return true;
                });

                setFollowersAndFollowing(uniqueRelations);

                // Fetch existing sharing permissions for the pre-selected routine if only one is selected
                if (preSelectedRoutineId) {
                    const sharedWith = await workoutService.getRoutineShares(preSelectedRoutineId);
                    if (sharedWith && sharedWith.length > 0) {
                        setSelectedUsers(new Set(sharedWith));
                    }
                }
            } catch (err) {
                console.error("Error loading share relations:", err);
            } finally {
                setLoading(false);
            }
        };

        loadRelations();
    }, [userId, preSelectedRoutineId, allRoutines]);

    // Handle routine toggle
    const toggleRoutine = (routineId: string) => {
        setSelectedRoutines(prev => {
            const next = new Set(prev);
            if (next.has(routineId)) {
                next.delete(routineId);
            } else {
                next.add(routineId);
            }
            return next;
        });
    };

    // Handle user toggle
    const toggleUser = (targetUserId: string) => {
        setSelectedUsers(prev => {
            const next = new Set(prev);
            if (next.has(targetUserId)) {
                next.delete(targetUserId);
            } else {
                next.add(targetUserId);
            }
            return next;
        });
    };

    // Filter relations by search term
    const filteredUsers = followersAndFollowing.filter(user => 
        user.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Save/Share
    const handleShare = async () => {
        if (selectedRoutines.size === 0) {
            alert("Selecciona al menos una rutina para compartir.");
            return;
        }

        setSharing(true);
        try {
            const routineIdsArray = Array.from(selectedRoutines);
            const userIdsArray = Array.from(selectedUsers);

            // Share each selected routine with all selected users
            await Promise.all(
                routineIdsArray.map(routineId => 
                    workoutService.shareRoutine(routineId, userId, userIdsArray)
                )
            );

            alert("¡Rutina(s) compartida(s) exitosamente!");
            onClose();
        } catch (err) {
            console.error("Error saving shares:", err);
            alert("Error al compartir las rutinas.");
        } finally {
            setSharing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[999] flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 w-full max-w-2xl rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col gap-6">
                
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gym-primary/10 rounded-full flex items-center justify-center text-gym-primary shrink-0">
                            <Share2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-3xl font-black italic text-white uppercase tracking-tight">Compartir Estrategia</h2>
                            <p className="text-neutral-500 text-xs md:text-sm font-bold">Comparte tu arsenal de rutinas con entrenadores o aliados.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-gym-primary gap-4">
                        <Loader className="animate-spin" size={32} />
                        <span className="text-neutral-400 font-bold">Cargando aliados...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 overflow-hidden">
                        
                        {/* Column 1: Routines Selection (5 cols) */}
                        <div className="md:col-span-5 flex flex-col gap-3 max-h-[45vh] md:max-h-[50vh]">
                            <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                                <Swords size={16} className="text-gym-primary" />
                                1. Selecciona Rutinas
                            </h3>
                            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
                                {allRoutines.map(routine => {
                                    const isChecked = selectedRoutines.has(routine.id);
                                    return (
                                        <button
                                            key={routine.id}
                                            onClick={() => toggleRoutine(routine.id)}
                                            className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                                                isChecked
                                                    ? 'bg-gym-primary/10 border-gym-primary text-gym-primary'
                                                    : 'bg-black/50 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                                            }`}
                                        >
                                            <div className="truncate">
                                                <h4 className="font-bold text-sm uppercase italic truncate">{routine.name}</h4>
                                                <span className="text-[10px] text-neutral-500 font-medium">
                                                    {(routine.equipment_ids?.length || routine.routine_exercises?.length || 0)} Ejercicios
                                                </span>
                                            </div>
                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                                isChecked ? 'bg-gym-primary border-transparent text-black' : 'border-neutral-700'
                                            }`}>
                                                {isChecked && <Check size={12} strokeWidth={3} />}
                                            </div>
                                        </button>
                                    );
                                })}
                                {allRoutines.length === 0 && (
                                    <div className="text-center py-8 text-neutral-500 text-xs">
                                        No tienes rutinas en tu arsenal.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Users Selection (7 cols) */}
                        <div className="md:col-span-7 flex flex-col gap-3 max-h-[45vh] md:max-h-[50vh]">
                            <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                                <Users size={16} className="text-gym-primary" />
                                2. Elige Destinatarios
                            </h3>
                            
                            {/* Search */}
                            <div className="relative">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar por usuario..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black border border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-gym-primary transition-colors"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
                                {filteredUsers.map(user => {
                                    const isChecked = selectedUsers.has(user.id);
                                    return (
                                        <button
                                            key={user.id}
                                            onClick={() => toggleUser(user.id)}
                                            className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                                                isChecked
                                                    ? 'bg-white/5 border-gym-primary'
                                                    : 'bg-black/50 border-neutral-800 hover:border-neutral-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 truncate">
                                                <img
                                                    src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'}
                                                    alt={user.username}
                                                    className="w-8 h-8 rounded-full border border-neutral-800 shrink-0 object-cover"
                                                />
                                                <span className="font-bold text-sm text-white truncate">@{user.username}</span>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                                isChecked ? 'bg-gym-primary border-transparent text-black' : 'border-neutral-700'
                                            }`}>
                                                {isChecked && <Check size={12} strokeWidth={3} />}
                                            </div>
                                        </button>
                                    );
                                })}
                                {filteredUsers.length === 0 && (
                                    <div className="text-center py-8 text-neutral-500 text-xs">
                                        {searchTerm ? "No se encontraron usuarios." : "No tienes seguidores ni seguidos aún."}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {/* Footer Buttons */}
                {!loading && (
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-neutral-800 hover:bg-neutral-750 text-white font-bold py-3.5 rounded-xl transition-all border border-neutral-700 uppercase tracking-wide text-xs"
                            disabled={sharing}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleShare}
                            className="flex-1 bg-gym-primary hover:bg-yellow-400 text-black font-black py-3.5 rounded-xl transition-all uppercase italic tracking-wider text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                            disabled={sharing || selectedRoutines.size === 0}
                        >
                            {sharing ? (
                                <>
                                    <Loader className="animate-spin" size={16} />
                                    COMPARTIENDO...
                                </>
                            ) : (
                                <>
                                    <Swords size={16} strokeWidth={3} />
                                    Compartir ({selectedRoutines.size} con {selectedUsers.size})
                                </>
                            )}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};
