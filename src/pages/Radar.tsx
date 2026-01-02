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

            {/* Main Content Area - Full Bleed */}
            <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden">

                {/* IDLE/ERROR STATE */}
                {!loading && scanComplete && nearbyUsers.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-500 p-8">
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
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                        <div className="w-16 h-16 border-4 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gym-primary font-bold animate-pulse tracking-widest text-xs uppercase">Escanenado sector...</p>
                    </div>
                )}

                {/* CARD STACK - PROFILE STYLE */}
                {scanComplete && nearbyUsers.length > 0 && currentUser && !loading && (
                    <div className="relative w-full h-full flex flex-col bg-black">

                        {/* Background Card (Next User) */}
                        {nextUser && (
                            <div className="absolute inset-0 bg-neutral-900 opacity-0 pointer-events-none"></div>
                        )}

                        {/* ACTIVE CARD CONTAINER */}
                        <div className="flex-1 flex flex-col relative animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* --- BANNER SECTION (40% height) --- */}
                            <div className="h-[45%] relative w-full bg-neutral-800 overflow-hidden">
                                {currentUser.banner_url ? (
                                    <img
                                        src={currentUser.banner_url}
                                        alt="Banner"
                                        className="w-full h-full object-cover opacity-80"
                                    />
                                ) : (
                                    <div className={`w-full h-full bg-gradient-to-br ${currentUser.tier.gradient} opacity-20 relative`}>
                                        {/* Fallback pattern if no banner */}
                                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black"></div>

                                {/* Distance Badge */}
                                <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg z-10">
                                    <MapPin size={12} className="text-gym-primary" />
                                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                                        {currentUser.distance_km < 1 ? '< 1 km' : `${Math.round(currentUser.distance_km)} km`}
                                    </span>
                                </div>
                            </div>

                            {/* --- AVATAR LAYOUT (Overlapping) --- */}
                            <div className="px-6 -mt-20 relative z-20 flex flex-col items-center">

                                {/* AVATAR CIRCLE */}
                                <div className="relative w-40 h-40">
                                    {/* Tier Glow */}
                                    <div className={`absolute inset-0 rounded-full blur-2xl transform scale-100 pointer-events-none ${currentUser.tier.color.replace('text-', 'bg-')}/30`}></div>

                                    {/* Avatar Image */}
                                    <div className={`w-full h-full rounded-full overflow-hidden border-4 bg-neutral-900 shadow-2xl relative z-10 ${currentUser.tier.borderColor}`}>
                                        <img
                                            src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}&background=random`}
                                            alt={currentUser.username}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    {/* Tier Badge (Hexagon or Pill) */}
                                    <div className={`absolute -bottom-3 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-lg z-20 bg-black ${currentUser.tier.borderColor} ${currentUser.tier.color}`}>
                                        {currentUser.tier.name}
                                    </div>
                                </div>

                                {/* USER INFO */}
                                <div className="mt-4 text-center w-full max-w-sm">
                                    <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase drop-shadow-lg mb-1 truncate">
                                        {currentUser.username}
                                    </h1>
                                    <div className="flex items-center justify-center gap-2 text-neutral-400 mb-4">
                                        <Dumbbell size={14} className={currentUser.tier.color} />
                                        <span className="text-sm font-bold uppercase tracking-wide truncate max-w-[200px]">
                                            {currentUser.gym_name}
                                        </span>
                                    </div>

                                    {/* Description / Bio */}
                                    <p className="text-neutral-300 text-sm font-medium leading-relaxed line-clamp-2 px-2 h-10 mb-6 font-primary text-opacity-80">
                                        {currentUser.description || "Entrenando para ser el mejor. Sin excusas."}
                                    </p>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-4 border-t border-neutral-800 pt-6 mt-2 w-full">
                                        <div className="flex flex-col items-center p-3 rounded-2xl bg-neutral-900/50 border border-neutral-800">
                                            <span className={`text-2xl font-black ${currentUser.tier.color}`}>{currentUser.checkins_count}</span>
                                            <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest mt-1">Entrenos</span>
                                        </div>
                                        <div className="flex flex-col items-center p-3 rounded-2xl bg-neutral-900/50 border border-neutral-800">
                                            <span className="text-2xl font-black text-white">{Math.floor(Math.random() * 100) + 1}</span>
                                            <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest mt-1">Nivel</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* --- ACTION BUTTONS (Floating Bottom) --- */}
                            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8 z-30 px-6">
                                {/* DISCARD */}
                                <button
                                    onClick={() => handleAction('skip')}
                                    className="w-16 h-16 rounded-full bg-neutral-900 border-2 border-neutral-700 text-neutral-400 flex items-center justify-center shadow-lg hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-95"
                                >
                                    <X size={32} strokeWidth={2.5} />
                                </button>

                                {/* TRAIN (Main Action) */}
                                <button
                                    onClick={() => handleAction('train')}
                                    className="w-24 h-24 rounded-full bg-gym-primary text-black flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.3)] hover:scale-105 hover:shadow-[0_0_60px_rgba(234,179,8,0.5)] transition-all active:scale-95 group"
                                >
                                    <div className="flex flex-col items-center">
                                        <Dumbbell size={36} strokeWidth={3} className="group-hover:animate-bounce" />
                                        <span className="text-[10px] font-black uppercase mt-1 tracking-wider">Entrenar</span>
                                    </div>
                                </button>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
