import { useState, useEffect } from 'react';
import { X, Search, Check, Users, Swords, Loader, Share2 } from 'lucide-react';
import { socialService } from '../../services/SocialService';
import { workoutService } from '../../services/WorkoutService';

interface ShareRoutineModalProps {
    userId: string;
    routineId: string;
    routineName: string;
    onClose: () => void;
}

export const ShareRoutineModal = ({ userId, routineId, routineName, onClose }: ShareRoutineModalProps) => {
    const [loading, setLoading] = useState(true);
    const [sharing, setSharing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Followers & Following List
    const [followersAndFollowing, setFollowersAndFollowing] = useState<any[]>([]);

    // Selection States
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    useEffect(() => {
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

                // Fetch existing sharing permissions for the pre-selected routine
                const sharedWith = await workoutService.getRoutineShares(routineId);
                if (sharedWith && sharedWith.length > 0) {
                    setSelectedUsers(new Set(sharedWith));
                }
            } catch (err) {
                console.error("Error loading share relations:", err);
            } finally {
                setLoading(false);
            }
        };

        loadRelations();
    }, [userId, routineId]);

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
        setSharing(true);
        try {
            const userIdsArray = Array.from(selectedUsers);

            // Share routine with all selected users
            await workoutService.shareRoutine(routineId, userId, userIdsArray);

            alert("¡Rutina compartida exitosamente!");
            onClose();
        } catch (err) {
            console.error("Error saving shares:", err);
            alert("Error al compartir la rutina.");
        } finally {
            setSharing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[999] flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col gap-6">
                
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gym-primary/10 rounded-full flex items-center justify-center text-gym-primary shrink-0 animate-pulse">
                            <Share2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black italic text-white uppercase tracking-tight">Compartir Estrategia</h2>
                            <p className="text-gym-primary text-xs md:text-sm font-bold truncate max-w-[280px] md:max-w-xs">
                                Rutina: {routineName}
                            </p>
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
                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                            <Users size={16} className="text-gym-primary" />
                            Selecciona tus Aliados o Seguidores
                        </h3>
                        
                        {/* Search */}
                        <div className="relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                            <input
                                type="text"
                                placeholder="Buscar por usuario..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-black border border-neutral-800 rounded-xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-gym-primary transition-colors"
                            />
                        </div>

                        {/* List */}
                        <div className="max-h-[40vh] overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
                            {filteredUsers.map(user => {
                                const isChecked = selectedUsers.has(user.id);
                                return (
                                    <button
                                        key={user.id}
                                        onClick={() => toggleUser(user.id)}
                                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                                            isChecked
                                                ? 'bg-gym-primary/10 border-gym-primary'
                                                : 'bg-black/50 border-neutral-800 hover:border-neutral-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 truncate">
                                            <img
                                                src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'}
                                                alt={user.username}
                                                className="w-9 h-9 rounded-full border border-neutral-800 shrink-0 object-cover"
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
                                <div className="text-center py-12 text-neutral-500 text-sm">
                                    {searchTerm ? "No se encontraron usuarios." : "No tienes seguidores ni seguidos aún."}
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
                            disabled={sharing}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleShare}
                            className="flex-1 bg-gym-primary hover:bg-yellow-400 text-black font-black py-3.5 rounded-xl transition-all uppercase italic tracking-wider text-xs flex items-center justify-center gap-2"
                            disabled={sharing}
                        >
                            {sharing ? (
                                <>
                                    <Loader className="animate-spin" size={16} />
                                    COMPARTIENDO...
                                </>
                            ) : (
                                <>
                                    <Swords size={16} strokeWidth={3} />
                                    Compartir ({selectedUsers.size})
                                </>
                            )}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};
