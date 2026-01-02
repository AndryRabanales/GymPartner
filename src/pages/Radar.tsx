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


    return (
        <div className="h-full flex flex-col relative overflow-hidden bg-black">

            {/* FLOATING STATUS BADGE */}
            {scanComplete && nearbyUsers.length > 0 && (
                <div className="absolute top-4 right-4 z-40 pointer-events-none">
                    <div className="text-[10px] font-black text-white/50 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
                        {currentIndex + 1} / {nearbyUsers.length}
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col w-full h-full overflow-hidden">

                {/* IDLE/ERROR STATE */}
                {!loading && scanComplete && nearbyUsers.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-500 p-8">
                        <div className="relative bg-neutral-900 border-2 border-dashed border-neutral-700 text-neutral-500 w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2">
                            <RadarIcon size={40} className="opacity-50" />
                            <span className="font-bold text-xs tracking-widest uppercase mt-2">Zona Muerta</span>
                        </div>
                        <p className="text-neutral-400 max-w-[200px] text-xs font-medium">
                            {locationError || `No se encontraron GymRats en ${radius}km.`}
                        </p>
                        <button
                            onClick={handleScan}
                            className="text-gym-primary font-bold uppercase tracking-widest text-[10px] border border-gym-primary px-5 py-2.5 rounded-lg hover:bg-gym-primary hover:text-black transition-colors"
                        >
                            Reintentar Escaneo
                        </button>
                    </div>
                )}

                {/* LOADING */}
                {loading && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 border-3 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gym-primary font-bold animate-pulse tracking-widest text-[10px] uppercase">Escanenado sector...</p>
                    </div>
                )}

                {/* ACTIVE CARD CONTAINER - FLEX STRETCH */}
                {scanComplete && nearbyUsers.length > 0 && currentUser && !loading && (
                    <div className="flex-1 flex flex-col relative bg-neutral-900 animate-in fade-in slide-in-from-bottom-8 duration-500 w-full mb-0 rounded-b-none">

                        {/* --- BANNER SECTION (Compact 38%) --- */}
                        <div className="basis-[38%] shrink-0 relative w-full bg-neutral-800 overflow-hidden">
                            {currentUser.banner_url ? (
                                <img
                                    src={currentUser.banner_url}
                                    alt="Banner"
                                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                                />
                            ) : (
                                <div className={`w-full h-full bg-gradient-to-br ${currentUser.tier.gradient} opacity-20 relative`}>
                                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black"></div>

                            {/* Distance Badge */}
                            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-lg z-10">
                                <MapPin size={10} className="text-gym-primary" />
                                <span className="text-[9px] font-black text-white uppercase tracking-wider">
                                    {currentUser.distance_km < 1 ? '< 1 km' : `${Math.round(currentUser.distance_km)} km`}
                                </span>
                            </div>
                        </div>

                        {/* --- CONTENT SECTION (Spread to Fill) --- */}
                        <div className="flex-1 flex flex-col items-center justify-between relative z-20 -mt-14 px-4 w-full">

                            {/* Top Info Group */}
                            <div className="flex flex-col items-center w-full">
                                {/* AVATAR */}
                                <div className="relative w-28 h-28 shrink-0 mb-3">
                                    <div className={`absolute inset-0 rounded-full blur-2xl transform scale-100 pointer-events-none ${currentUser.tier.color.replace('text-', 'bg-')}/40`}></div>
                                    <div className={`w-full h-full rounded-full overflow-hidden border-4 bg-neutral-900 shadow-2xl relative z-10 ${currentUser.tier.borderColor}`}>
                                        <img
                                            src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}&background=random`}
                                            alt={currentUser.username}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className={`absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border shadow-lg z-20 bg-black ${currentUser.tier.borderColor} ${currentUser.tier.color}`}>
                                        {currentUser.tier.name}
                                    </div>
                                </div>

                                {/* TEXT INFO */}
                                <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase drop-shadow-lg mb-1 truncate max-w-full">
                                    {currentUser.username}
                                </h1>
                                <div className="flex items-center justify-center gap-1.5 text-neutral-400 mb-2">
                                    <Dumbbell size={10} className={currentUser.tier.color} />
                                    <span className="text-[10px] font-bold uppercase tracking-wide truncate max-w-[200px]">
                                        {currentUser.gym_name}
                                    </span>
                                </div>
                                <p className="text-neutral-400 text-[10px] font-medium leading-relaxed line-clamp-2 px-2 max-w-xs text-opacity-80 text-center">
                                    {currentUser.description || "Sin descripción."}
                                </p>
                            </div>

                            {/* Middle Stats Group */}
                            <div className="flex-1 flex items-center justify-center w-full py-2">
                                <div className="grid grid-cols-2 gap-3 w-full max-w-[200px]">
                                    <div className="flex flex-col items-center p-2 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
                                        <span className={`text-xl font-black ${currentUser.tier.color}`}>{currentUser.checkins_count}</span>
                                        <span className="text-[8px] text-neutral-500 uppercase font-bold tracking-widest">Entrenos</span>
                                    </div>
                                    <div className="flex flex-col items-center p-2 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
                                        <span className="text-xl font-black text-white">{Math.floor(Math.random() * 100) + 1}</span>
                                        <span className="text-[8px] text-neutral-500 uppercase font-bold tracking-widest">Nivel</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- SAFE FOOTER (Dedicated Area) --- */}
                        <div className="shrink-0 w-full flex justify-center items-center gap-6 pb-20 pt-4 relative z-30 bg-gradient-to-t from-black via-black/80 to-transparent">

                            {/* REJECT BUTTON - Glassmorphism */}
                            <button
                                onClick={() => handleAction('skip')}
                                className="w-16 h-16 rounded-full bg-neutral-900/80 backdrop-blur-md border border-white/10 text-neutral-500 flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-all active:scale-90 group shadow-lg"
                            >
                                <X size={28} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
                            </button>

                            {/* ACCEPT BUTTON - Gradient & Glow "Invitation" Style */}
                            <button
                                onClick={() => handleAction('train')}
                                className="w-24 h-24 rounded-full bg-gradient-to-br from-gym-primary via-yellow-400 to-orange-500 text-black flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.4)] hover:shadow-[0_0_60px_rgba(234,179,8,0.6)] hover:scale-105 transition-all duration-300 active:scale-95 border-4 border-black/20 relative group overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-full blur-xl"></div>
                                <div className="flex flex-col items-center relative z-10">
                                    <div className="flex items-center gap-0.5">
                                        <Dumbbell size={32} strokeWidth={3} className="fill-black/10" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest mt-1">Invitar</span>
                                </div>
                            </button>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};
