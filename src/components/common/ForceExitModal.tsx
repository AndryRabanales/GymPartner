import React from 'react';
import { X, Check, AlertTriangle, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface ForceExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinalize: () => void;
  onTemporaryExit: () => void;
  onCancelSession?: () => void;
}

export const ForceExitModal: React.FC<ForceExitModalProps> = ({ 
  isOpen, 
  onClose, 
  onFinalize, 
  onTemporaryExit,
  onCancelSession 
}) => {
  if (!isOpen) return null;

  const navigate = useNavigate();

  const handleFinalize = async () => {
    await onFinalize();
    onClose();
  };

  const handleTemporaryExit = () => {
    onTemporaryExit();
    onClose();
    navigate('/inicio');
  };

  const handleCancelSession = () => {
    if (onCancelSession) {
      onCancelSession();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-neutral-900 border border-gym-primary/30 rounded-3xl shadow-[0_0_50px_rgba(250,204,21,0.3)] animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="pt-8 pb-4 flex flex-col items-center bg-gradient-to-b from-gym-primary/10 to-transparent">
          <div className="w-16 h-16 rounded-full bg-gym-primary/20 flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(250,204,21,0.5)]">
            <AlertTriangle size={28} className="text-black" />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider text-center px-4">
            ¿Salir del entrenamiento?
          </h2>
          <p className="text-sm text-neutral-400 mt-1 text-center max-w-xs">
            Selecciona una opción para finalizar, pausar temporalmente o eliminar el entrenamiento actual.
          </p>
        </div>
        {/* Buttons */}
        <div className="p-4 space-y-3">
          <button
            onClick={handleFinalize}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-br from-yellow-400 to-orange-500 text-black font-black uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <Check size={18} className="text-black" /> Finalizar Entrenamiento
          </button>
          <button
            onClick={handleTemporaryExit}
            className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-800 text-white font-black uppercase tracking-wider rounded-xl hover:bg-neutral-700 transition-all"
          >
            <X size={18} /> Salir Temporalmente
          </button>
          {onCancelSession && (
            <button
              onClick={handleCancelSession}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-950/40 border border-red-500/20 text-red-500 hover:bg-red-950/60 font-black uppercase tracking-wider rounded-xl transition-all"
            >
              <Trash2 size={18} /> Eliminar Entrenamiento
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-3 text-neutral-400 hover:text-white font-black uppercase tracking-wider rounded-xl transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
