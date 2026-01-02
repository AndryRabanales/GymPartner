
import { useState, useEffect } from 'react';
// import { useAuth } from '../context/AuthContext'; // Unused
import { radarService } from '../services/RadarService';
import type { RadarUser } from '../services/RadarService'; // Type import
import { MapPin, Radar as RadarIcon, UserPlus, Dumbbell, ScanLine } from 'lucide-react';
// import { Link } from 'react-router-dom'; // Unused

export const Radar = () => {
    // const { user } = useAuth(); // Unused
    const [nearbyUsers, setNearbyUsers] = useState<RadarUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [radius] = useState(100); // Fixed radius for now, no setter used

    // Initial Scan specific logic
    const handleScan = () => {
        setLoading(true);
        setLocationError(null);

        if (!navigator.geolocation) {
            setLocationError("Tu dispositivo no soporta geolocalización.");
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    console.log("📍 Scanning from:", latitude, longitude);

                    const users = await radarService.getNearbyGymRats(latitude, longitude, radius);
                    setNearbyUsers(users);

                    if (users.length === 0) {
                        setLocationError("No detectamos señales de vida GymRat en 100km. Probablemente estás en territorio inexplorado.");
                    }
                } catch (err) {
                    console.error(err);
                    setLocationError("Error al calibrar el radar. Reintenta.");
                } finally {
                    setLoading(false);
                }
            },
            (err) => {
                console.error(err);
                if (err.code === 1) setLocationError("Permiso de ubicación denegado. Actívalo para usar el Radar.");
                else setLocationError("Se perdió la señal del satélite GPS. Muévete a un área despejada.");
                setLoading(false);
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    };

    // Auto-scan on mount if possible, or show button
    useEffect(() => {
        // Optional: Auto-scan could be too aggressive. Let's let user click "SCAN".
    }, []);

    return (
        <div className="min-h-screen bg-black pb-24">
            {/* Header */}
            <div className="bg-neutral-900 border-b border-warning-500/20 p-6 sticky top-0 z-30 backdrop-blur-md bg-neutral-900/80">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                            <RadarIcon className={`text-gym-primary ${loading ? 'animate-spin' : ''}`} size={32} />
                            GYM<span className="text-gym-primary">RADAR</span>
                        </h1>
                        <p className="text-neutral-500 text-xs font-bold tracking-[0.2em] uppercase">
                            RANGO DE DETECCIÓN: {radius}KM
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 md:p-6">

                {/* SCAN ACTION */}
                {nearbyUsers.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 animate-in fade-in slide-in-from-bottom-10">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gym-primary/20 rounded-full animate-ping delay-75"></div>
                            <div className="absolute inset-0 bg-gym-primary/10 rounded-full animate-ping delay-300"></div>
                            <button
                                onClick={handleScan}
                                className="relative bg-neutral-900 border-2 border-gym-primary/50 text-white w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 hover:scale-110 hover:border-gym-primary hover:shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-all group z-10"
                            >
                                <ScanLine size={32} className="text-gym-primary group-hover:animate-pulse" />
                                <span className="font-bold text-xs tracking-widest uppercase">ESCANEAR</span>
                            </button>
                        </div>
                        <p className="text-neutral-400 max-w-md mx-auto">
                            Activa el radar para localizar otros operadores en tu zona. <br />
                            <span className="text-xs text-neutral-600">Requiere acceso GPS.</span>
                        </p>
                        {locationError && (
                            <div className="text-red-500 bg-red-500/10 p-4 rounded-xl border border-red-500/20 max-w-md">
                                {locationError}
                            </div>
                        )}
                    </div>
                )}

                {/* LOADING STATE */}
                {loading && nearbyUsers.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-40">
                        <div className="w-16 h-16 border-4 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-gym-primary font-bold animate-pulse tracking-widest text-sm">TRIANGULANDO SEÑALES...</p>
                    </div>
                )}

                {/* GRID RESULTS */}
                {nearbyUsers.length > 0 && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center text-sm text-neutral-400 font-bold uppercase tracking-widest px-2">
                            <span>{nearbyUsers.length} Agentes Detectados</span>
                            <button onClick={handleScan} className="flex items-center gap-2 hover:text-white transition-colors">
                                <RadarIcon size={14} /> Re-escanear
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                            {nearbyUsers.map(user => (
                                <div key={user.user_id} className="group relative bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 hover:border-gym-primary/40 transition-all hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col">
                                    {/* Image Section */}
                                    <div className="relative aspect-[4/5] bg-neutral-800">
                                        <img
                                            src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                                            alt={user.username}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 filter grayscale group-hover:grayscale-0"
                                        />

                                        {/* Tier Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>

                                        {/* Status Badge */}
                                        <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-md ${user.tier.borderColor} ${user.tier.color} bg-black/40`}>
                                            {user.tier.name}
                                        </div>

                                        {/* Distance Badge */}
                                        <div className="absolute top-3 left-3 flex items-center gap-1 text-[10px] font-bold text-white bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                                            <MapPin size={10} className="text-gym-primary" />
                                            <span>{user.distance_km < 1 ? '< 1km' : `${Math.round(user.distance_km)}km`}</span>
                                        </div>

                                        {/* Name & Info */}
                                        <div className="absolute bottom-0 left-0 w-full p-4">
                                            <h3 className="text-white font-black text-xl italic uppercase tracking-tighter leading-none mb-1 group-hover:text-gym-primary transition-colors truncate">
                                                {user.username}
                                            </h3>
                                            <div className="flex items-center gap-2 text-neutral-400 text-xs">
                                                <Dumbbell size={12} className={user.tier.color} />
                                                <span className="truncate max-w-[150px]">{user.gym_name}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <button className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3 uppercase tracking-widest text-xs border-t border-white/5 flex items-center justify-center gap-2 transition-colors">
                                        <UserPlus size={14} className="text-gym-primary" />
                                        <span>Reclutar</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
