import { useState, useEffect, useRef } from 'react';
import { radarService, type RadarUser } from '../services/RadarService';
import { MapPin, Radar as RadarIcon, Dumbbell, X } from 'lucide-react';

export const Radar = () => {
    const [nearbyUsers, setNearbyUsers] = useState<RadarUser[]>([]);
    const [loading, setLoading] = useState(true); // Start loading immediately
    const [locationError, setLocationError] = useState<string | null>(null);
    const [radius] = useState(100);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [scanComplete, setScanComplete] = useState(false);
    const initialized = useRef(false);

    // Initial Scan specific logic
    const handleScan = () => {
        setLoading(true);
        setLocationError(null);
        setScanComplete(false);

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

                    // Shuffle for randomness if desired, or keep distance sort
                    // users.sort(() => Math.random() - 0.5); 

                    setNearbyUsers(users);
                    setCurrentIndex(0);
                    setScanComplete(true);

                    if (users.length === 0) {
                        setLocationError("No detectamos señales de vida GymRat en 100km.");
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

    // Auto-scan on mount
    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true;
            handleScan();
        }
    }, []);

    // Card Actions
    const handleNext = () => {
        // Infinite Loop Logic
        if (nearbyUsers.length === 0) return;
        setCurrentIndex((prev) => (prev + 1) % nearbyUsers.length);
    };

    const handleAction = (action: 'skip' | 'train') => {
        // Here we could add logic to save the "Like/Pass"
        if (action === 'train') {
            console.log(`Reclutando a ${nearbyUsers[currentIndex].username}`);
            // Future: Call API to send request
        }
        handleNext();
    };

    const currentUser = nearbyUsers.length > 0 ? nearbyUsers[currentIndex] : null;
    const nextUser = nearbyUsers.length > 1 ? nearbyUsers[(currentIndex + 1) % nearbyUsers.length] : null;

    return (
        <div className="h-full bg-black flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="bg-neutral-900 border-b border-warning-500/20 p-4 shrink-0 z-30 flex justify-between items-center backdrop-blur-md bg-neutral-900/80">
                <div>
                    <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
                        <RadarIcon className={`text-gym-primary ${loading ? 'animate-spin' : ''}`} size={24} />
                        GYM<span className="text-gym-primary">RADAR</span>
                    </h1>
                </div>
                {scanComplete && nearbyUsers.length > 0 && (
                    <div className="text-xs font-bold text-neutral-500 bg-neutral-800 px-3 py-1 rounded-full border border-neutral-700">
                        {currentIndex + 1} / {nearbyUsers.length}
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col justify-center items-center p-4 relative w-full max-w-md h-full">

                {/* IDLE/ERROR STATE */}
                {!loading && scanComplete && nearbyUsers.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-500">
                        <div className="relative bg-neutral-900 border-2 border-dashed border-neutral-700 text-neutral-500 w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2">
                            <RadarIcon size={48} className="opacity-50" />
                            <span className="font-bold text-sm tracking-widest uppercase mt-2">Zona Muerta</span>
                        </div>
                        <p className="text-neutral-400 max-w-xs text-sm font-medium">
                            {locationError || `No se encontraron GymRats en ${radius}km.`}
                        </p>
                        <button
                            onClick={handleScan}
                            className="text-gym-primary font-bold uppercase tracking-widest text-xs border border-gym-primary px-6 py-3 rounded-lg hover:bg-gym-primary hover:text-black transition-colors"
                        >
                            Reintentar Escaneo
                        </button>
                    </div>
                )}

                {/* LOADING */}
                {loading && (
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="w-16 h-16 border-4 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gym-primary font-bold animate-pulse tracking-widest text-xs uppercase">Escanenado sector...</p>
                    </div>
                )}

                {/* CARD STACK - Full Height Flex */}
                {scanComplete && nearbyUsers.length > 0 && currentUser && !loading && (
                    <div className="relative w-full max-w-md h-full max-h-[calc(100vh-180px)] perspective-1000 flex flex-col">

                        {/* Background Card (Next User) */}
                        {nextUser && (
                            <div className="absolute top-4 left-0 right-0 bottom-[-10px] bg-neutral-800 rounded-3xl opacity-40 scale-95 transform translate-y-2 pointer-events-none"></div>
                        )}

                        {/* ACTIVE CARD */}
                        <div className="flex-1 bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl flex flex-col z-20 animate-in fade-in slide-in-from-bottom-4 duration-300 relative">

                            {/* Image Section - Flex Grow */}
                            <div className="relative flex-1 bg-neutral-800 overflow-hidden">
                                <img
                                    src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}&background=random`}
                                    alt={currentUser.username}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>

                                {/* Distance Badge */}
                                <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                                    <MapPin size={12} className="text-gym-primary" />
                                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                                        {currentUser.distance_km < 1 ? '< 1 km' : `${Math.round(currentUser.distance_km)} km`}
                                    </span>
                                </div>

                                {/* Tier Badge */}
                                <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border backdrop-blur-md shadow-lg ${currentUser.tier.borderColor} ${currentUser.tier.color} bg-black/80`}>
                                    {currentUser.tier.name}
                                </div>
                            </div>

                            {/* Info & Actions Section - Fixed Bottom */}
                            <div className="relative bg-black pt-4 pb-6 px-5 border-t border-neutral-800">

                                <div className="flex flex-col gap-1 mb-8">
                                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase truncate">
                                        {currentUser.username}
                                    </h2>
                                    <div className="flex items-center gap-2 text-neutral-400">
                                        <Dumbbell size={14} className={currentUser.tier.color} />
                                        <span className="text-xs font-bold uppercase tracking-wide truncate">
                                            {currentUser.gym_name}
                                        </span>
                                    </div>

                                    {/* Stats Row */}
                                    <div className="flex gap-4 mt-3">
                                        <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 flex flex-col items-center min-w-[60px]">
                                            <span className="text-base font-black text-white leading-none">{currentUser.checkins_count}</span>
                                            <span className="text-[8px] text-neutral-500 uppercase font-bold">Entrenos</span>
                                        </div>
                                        <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 flex flex-col items-center min-w-[60px]">
                                            <span className="text-base font-black text-white leading-none">{Math.floor(Math.random() * 100) + 1}</span>
                                            <span className="text-[8px] text-neutral-500 uppercase font-bold">Nivel</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ACTION BUTTONS LAYOUT - ABSOLUTE OVERLAP */}
                                <div className="absolute -top-10 right-4 flex items-center gap-4">
                                    {/* DISCARD */}
                                    <button
                                        onClick={() => handleAction('skip')}
                                        className="w-14 h-14 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-400 flex items-center justify-center shadow-lg hover:text-red-500 hover:border-red-500 transition-all active:scale-95"
                                    >
                                        <X size={24} />
                                    </button>

                                    {/* TRAIN (Main Action) */}
                                    <button
                                        onClick={() => handleAction('train')}
                                        className="w-20 h-20 rounded-full bg-gym-primary text-black flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.4)] hover:scale-105 hover:bg-white transition-all active:scale-95 animate-in zoom-in duration-300"
                                    >
                                        <div className="flex flex-col items-center">
                                            <Dumbbell size={32} strokeWidth={3} />
                                            <span className="text-[9px] font-black uppercase mt-0.5">Entrenar</span>
                                        </div>
                                    </button>
                                </div>

                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
