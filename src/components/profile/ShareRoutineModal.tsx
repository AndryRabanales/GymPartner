import { useState, useEffect } from 'react';
import { X, Search, Check, Users, Swords, Loader, Share2 } from 'lucide-react';
import { socialService } from '../../services/SocialService';
import { workoutService } from '../../services/WorkoutService';

interface ShareRoutineModalProps {
    userId: string;
    routineIds: string[];
    routineNames: string[];
    onClose: () => void;
}

export const ShareRoutineModal = ({ userId, routineIds, routineNames, onClose }: ShareRoutineModalProps) => {
    const [loading, setLoading] = useState(true);
    const [sharing, setSharing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Followers & Following List
    const [followersAndFollowing, setFollowersAndFollowing] = useState<any[]>([]);

    // Selection States
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [initialUserRoutineShares, setInitialUserRoutineShares] = useState<Map<string, Set<string>>>(new Map());
    const [initialAllSharedWith, setInitialAllSharedWith] = useState<Set<string>>(new Set());

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

                // Fetch existing sharing permissions for all selected routines in parallel
                const sharesPromises = routineIds.map(rid => workoutService.getRoutineShares(rid));
                const sharesResults = await Promise.all(sharesPromises);
                
                const userShares = new Map<string, Set<string>>();
                
                routineIds.forEach((rid, index) => {
                    const sharedWithUsers = sharesResults[index] || [];
                    sharedWithUsers.forEach((uid: string) => {
                        if (!userShares.has(uid)) {
                            userShares.set(uid, new Set());
                        }
                        userShares.get(uid)!.add(rid);
                    });
                });

                setInitialUserRoutineShares(userShares);

                // Intersection: users who have access to ALL selected routines
                const allSharedWith = new Set<string>();
                userShares.forEach((routineSet, uid) => {
                    if (routineSet.size === routineIds.length) {
                        allSharedWith.add(uid);
                    }
                });

                setSelectedUsers(new Set(allSharedWith));
                setInitialAllSharedWith(allSharedWith);
            } catch (err) {
                console.error("Error loading share relations:", err);
            } finally {
                setLoading(false);
            }
        };

        loadRelations();
    }, [userId, routineIds]);

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

    // Save/Share (Union and Revoke Logic)
    const handleShare = async () => {
        setSharing(true);
        try {
            // For each selected routine, we calculate the complete new list of user IDs who have access to it
            for (const rid of routineIds) {
                // Fetch the list of users currently having access to this routine
                const currentShares = await workoutService.getRoutineShares(rid);
                const followersSet = new Set(followersAndFollowing.map(u => u.id));
                
                // Preserve shared users outside of our followers/following list
                const preservedUsers = currentShares.filter(uid => !followersSet.has(uid));
                
                // Calculate the new status for each of our followers:
                const updatedFollowers: string[] = [];
                
                followersAndFollowing.forEach(user => {
                    const targetUserId = user.id;
                    const isCurrentlySelected = selectedUsers.has(targetUserId);
                    const originallyHadAll = initialAllSharedWith.has(targetUserId);
                    const currentRoutineShares = initialUserRoutineShares.get(targetUserId) || new Set<string>();
                    
                    if (isCurrentlySelected) {
                        // Union: selected users get access to ALL selected routines
                        updatedFollowers.push(targetUserId);
                    } else {
                        // Unselected users:
                        if (originallyHadAll) {
                            // If they originally had ALL and were unchecked, revoke access to this routine
                        } else {
                            // If they only had partial or no access, keep their existing access for this specific routine
                            if (currentRoutineShares.has(rid)) {
                                updatedFollowers.push(targetUserId);
                            }
                        }
                    }
                });
                
                const finalSharedUsers = [...preservedUsers, ...updatedFollowers];
                
                // Save to DB
                await workoutService.shareRoutine(rid, userId, finalSharedUsers);
            }

            alert(routineIds.length > 1 
                ? `¡Las ${routineIds.length} rutinas han sido compartidas/actualizadas exitosamente!` 
                : "¡Rutina compartida exitosamente!"
            );
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
            <div className="bg-neutral-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col gap-6">
                
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gym-primary/10 rounded-full flex items-center justify-center text-gym-primary shrink-0 animate-pulse">
                            <Share2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black italic text-white uppercase tracking-tight">Compartir Rutinas</h2>
                            <p className="text-gym-primary text-xs md:text-sm font-bold truncate max-w-[280px] md:max-w-xs">
                                {routineNames.length > 1 
                                    ? `${routineNames.length} seleccionadas (${routineNames.slice(0, 2).join(', ')}${routineNames.length > 2 ? '...' : ''})`
                                    : `Rutina: ${routineNames[0]}`
                                }
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
                                className="w-full bg-black border border-neutral-800 rounded-xl py-3.5 pl-11 pr-4 text-[16px] text-white placeholder-neutral-500 focus:outline-none focus:border-gym-primary transition-colors"
                            />
                        </div>

                        {/* List */}
                        <div className="max-h-[40vh] overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
                            {filteredUsers.map(user => {
                                const isChecked = selectedUsers.has(user.id);
                                const hasSomeButNotAll = initialUserRoutineShares.has(user.id) && !isChecked;
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
                                            <div className="flex flex-col truncate">
                                                <span className="font-bold text-sm text-white truncate">@{user.username}</span>
                                                {hasSomeButNotAll && (
                                                    <span className="text-[10px] text-gym-primary/80 font-bold uppercase italic mt-0.5">
                                                        Tiene {initialUserRoutineShares.get(user.id)?.size} de las {routineIds.length} seleccionadas 🤝
                                                    </span>
                                                )}
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
