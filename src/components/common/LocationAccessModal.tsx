import React from 'react';
import { ShieldAlert, MapPin, X, Navigation } from 'lucide-react';

interface LocationAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    gymName: string;
    distanceMeters: number | null;
    maxDistance: number;
    errorType: 'DISTANCE' | 'NO_COORDS' | 'GPS_ERROR';
}

export const LocationAccessModal: React.FC<LocationAccessModalProps> = ({
    isOpen,
    onClose,
    gymName,
    distanceMeters,
    maxDistance,
    errorType
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-neutral-900 border border-red-500/30 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-in zoom-in-95 duration-300 overflow-hidden">

                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[50px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-500/5 rounded-full blur-[40px] pointer-events-none"></div>

                <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                    {/* Icon Halo */}
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-2 relative">
                        <div className="absolute inset-0 rounded-full border border-red-500/30 animate-[ping_3s_linear_infinite]"></div>
                        <ShieldAlert className="text-red-500 w-10 h-10" />
                    </div>

                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                        UBICACIÓN <span className="text-red-500">INCORRECTA</span>
                    </h2>

                    {/* Error Content */}
                    <div className="space-y-4 w-full">
                        {errorType === 'DISTANCE' && distanceMeters !== null && (
                            <>
                                <p className="text-neutral-400 text-sm">
                                    El sistema GPS confirma que <strong>NO estás en el gimnasio.</strong>
                                    <br />
                                    Debes estar dentro del rango para iniciar.
                                </p>
                                <div className="bg-neutral-950/50 p-3 rounded-xl border border-white/5 flex flex-col gap-1">
                                    <span className="text-white font-bold text-sm flex items-center justify-center gap-2">
                                        <MapPin size={14} className="text-red-500" />
                                        {gymName}
                                    </span>
                                    <div className="flex items-center justify-center gap-4 text-xs font-mono mt-1">
                                        <div className="text-red-400">
                                            Distancia: {(distanceMeters / 1000).toFixed(2)}km
                                        </div>
                                        <div className="text-neutral-500">
                                            Max: {maxDistance}m
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {errorType === 'NO_COORDS' && (
                            <p className="text-neutral-400 text-sm">
                                ⚠️ <strong>Error de Configuración:</strong><br />
                                Este gimnasio ("{gymName}") no tiene coordenadas GPS registradas.
                                <br /><br />
                                No es posible validar tu ubicación.
                            </p>
                        )}

                        {errorType === 'GPS_ERROR' && (
                            <p className="text-neutral-400 text-sm">
                                📡 <strong>Fallo de Satélite:</strong><br />
                                No pudimos obtener tu ubicación. Verifica que el GPS esté activo y tengas permisos permitidos.
                            </p>
                        )}
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={onClose}
                        className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl shadow-lg shadow-red-900/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2 mt-2"
                    >
                        <Navigation size={18} />
                        <span>ENTENDIDO</span>
                    </button>

                </div>

                {/* Close X */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};
