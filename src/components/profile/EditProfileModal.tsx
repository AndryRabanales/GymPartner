import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Save, Loader, Swords, Trophy, Eye, EyeOff } from 'lucide-react';

// ... imports

// Update in Render
// ...
<div className="space-y-2 pt-2 border-t border-white/5">
    <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-yellow-500 uppercase tracking-widest ml-1 flex items-center gap-2">
            <Swords size={14} /> GESTIONAR ARSENAL (Público/Privado)
        </label>
        <Link to="/builder" onClick={onClose} className="text-[10px] font-bold text-neutral-500 hover:text-white uppercase flex items-center gap-1">
            <Trophy size={10} /> Crear Nueva
        </Link>
    </div>

    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
        {routines.map(routine => (
            <div key={routine.id} className="flex gap-2">
                {/* Selection Button (Featured) */}
                <button
                    onClick={() => setSelectedRoutineId(routine.id === selectedRoutineId ? null : routine.id)}
                    className={`flex-1 text-left p-3 rounded-lg border transition-all flex items-center justify-between group ${selectedRoutineId === routine.id
                        ? 'bg-yellow-500/10 border-yellow-500 text-white'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600'
                        }`}
                >
                    <div className="flex flex-col">
                        <span className="font-bold text-sm truncate">{routine.name}</span>
                        <span className="text-[10px] opacity-50 uppercase">
                            {selectedRoutineId === routine.id ? 'DESTACADA (MAIN)' : 'Normal'}
                        </span>
                    </div>
                    {selectedRoutineId === routine.id && <div className="w-2 h-2 rounded-full bg-yellow-500"></div>}
                </button>

                {/* Visibility Toggle */}
                <button
                    onClick={async (e) => {
                        e.stopPropagation();
                        const newStatus = !routine.is_public;

                        // Optimistic Update
                        setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, is_public: newStatus } : r));

                        await userService.updateRoutineVisibility(routine.id, newStatus);
                    }}
                    className={`w-12 flex items-center justify-center rounded-lg border transition-all ${routine.is_public
                        ? 'bg-green-500/10 border-green-500 text-green-500'
                        : 'bg-red-500/10 border-red-500/50 text-red-500'
                        }`}
                    title={routine.is_public ? "Pública (Visible en Ranking)" : "Privada (Solo tú)"}
                >
                    {routine.is_public ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
            </div>
        ))}
        {routines.length === 0 && (
            <div className="text-center p-4 border border-dashed border-neutral-800 rounded-lg">
                <p className="text-xs text-neutral-600">No tienes rutinas creadas.</p>
            </div>
        )}
    </div>
    <p className="text-[10px] text-neutral-500 leading-tight">
        <span className="text-green-500 font-bold">OJO:</span> Solo las rutinas "Públicas" se verán en tu perfil cuando otros te inspeccionen.
    </p>
</div>

{/* Action Buttons */ }
<div className="flex gap-3 pt-2">
    <button
        onClick={onClose}
        className="flex-1 py-3 rounded-xl font-bold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent"
    >
        Cancelar
    </button>
    <button
        onClick={handleSave}
        disabled={loading}
        className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-wider py-3 rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
    >
        {loading ? <Loader className="animate-spin" size={20} /> : <Save size={20} />}
        <span>Guardar</span>
    </button>
</div>
                </div >
            </div >
        </div >
    );
};
