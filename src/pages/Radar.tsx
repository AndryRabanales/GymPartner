
import { useState } from 'react';
import { radarService, type RadarUser } from '../services/RadarService';
import { MapPin, Radar as RadarIcon, Dumbbell, X, Info } from 'lucide-react';

export const Radar = () => {
    const [nearbyUsers, setNearbyUsers] = useState<RadarUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [radius] = useState(100);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [scanComplete, setScanComplete] = useState(false);

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
        <div className="h-full bg-black pb-24 flex flex-col relative overflow-hidden">
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
            <div className="flex-1 flex flex-col justify-center items-center p-4 relative w-full max-w-md mx-auto">

                {/* IDLE STATE: SCAN BUTTON */}
                {!scanComplete && !loading && (
                    <div className="flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-500">
                        <div className="relative group cursor-pointer" onClick={handleScan}>
                            <div className="absolute inset-0 bg-gym-primary/20 rounded-full animate-ping delay-75"></div>
                            <div className="absolute inset-0 bg-gym-primary/10 rounded-full animate-ping delay-300"></div>
                            <div className="relative bg-neutral-900 border-2 border-gym-primary/50 text-white w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2 group-hover:scale-105 group-hover:border-gym-primary group-hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] transition-all z-10">
                                <RadarIcon size={48} className="text-gym-primary group-hover:animate-pulse" />
                                <span className="font-bold text-sm tracking-widest uppercase mt-2">Ver Radar</span>
                            </div>
                        </div>
                        <p className="text-neutral-400 max-w-xs text-sm font-medium">
                            Encuentra compañeros de entrenamiento en un radio de {radius}km.
                        </p>
                        {locationError && (
                            <div className="text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-xs font-bold">
                                {locationError}
                            </div>
                        )}
                    </div>
                )}

                {/* LOADING */}
                {loading && (
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="w-16 h-16 border-4 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gym-primary font-bold animate-pulse tracking-widest text-xs uppercase">Escanenado gimnasios...</p>
                    </div>
                )}

                {/* CARD STACK */}
                {scanComplete && nearbyUsers.length > 0 && currentUser && (
                    <div className="relative w-full h-[65vh] max-h-[600px] perspective-1000">

                        {/* Background Card (Next User) - Visual Hint */}
                        {nextUser && (
                            <div className="absolute top-4 left-0 right-0 bottom-[-16px] bg-neutral-800 rounded-3xl opacity-40 scale-95 transform translate-y-2 pointer-events-none"></div>
                        )}

                        {/* ACTIVE CARD */}
                        <div className="absolute inset-0 bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl flex flex-col z-20 animate-in fade-in slide-in-from-bottom-4 duration-300">

                            {/* Image & Badges */}
                            <div className="relative flex-1 bg-neutral-800">
                                <img
                                    src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}&background=random`}
                                    alt={currentUser.username}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>

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

                            {/* Info Section */}
                            <div className="p-5 pb-24 relative bg-gradient-to-b from-neutral-900 to-black">
                                <div className="flex flex-col gap-1">
                                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase truncate">
                                        {currentUser.username}
                                    </h2>
                                    <div className="flex items-center gap-2 text-neutral-400">
                                        <Dumbbell size={14} className={currentUser.tier.color} />
                                        <span className="text-sm font-bold uppercase tracking-wide truncate">
                                            {currentUser.gym_name}
                                        </span>
                                    </div>

                                    {/* Stats Row (Mock for visuals) */}
                                    <div className="flex gap-4 mt-4">
                                        <div className="bg-white/5 rounded-lg px-3 py-2 flex flex-col items-center min-w-[70px]">
                                            <span className="text-lg font-black text-white leading-none">{currentUser.checkins_count}</span>
                                            <span className="text-[9px] text-neutral-500 uppercase font-bold">Entrenos</span>
                                        </div>
                                        <div className="bg-white/5 rounded-lg px-3 py-2 flex flex-col items-center min-w-[70px]">
                                            <span className="text-lg font-black text-white leading-none">{Math.floor(Math.random() * 100) + 1}</span>
                                            <span className="text-[9px] text-neutral-500 uppercase font-bold">Nivel</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ACTION BUTTONS */}
                                <div className="absolute -bottom-8 left-0 right-0 flex justify-center items-center gap-6 pb-8">
                                    {/* DISCARD BUTTON */}
                                    <button
                                        onClick={() => handleAction('skip')}
                                        className="w-16 h-16 rounded-full bg-neutral-800 border-2 border-neutral-600 text-red-500 flex items-center justify-center shadow-lg hover:scale-110 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all active:scale-95"
                                    >
                                        <X size={32} strokeWidth={3} />
                                    </button>

                                    {/* INFO BUTTON (Small) */}
                                    <button className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-400 flex items-center justify-center hover:bg-white hover:text-black transition-colors">
                                        <Info size={18} />
                                    </button>

                                    {/* TRAIN BUTTON */}
                                    <button
                                        onClick={() => handleAction('train')}
                                        className="w-16 h-16 rounded-full bg-neutral-800 border-2 border-gym-primary text-gym-primary flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:scale-110 hover:bg-gym-primary hover:text-black hover:shadow-[0_0_40px_rgba(234,179,8,0.6)] transition-all active:scale-95 group"
                                    >
                                        <div className="flex flex-col items-center">
                                            <Dumbbell size={28} strokeWidth={3} className="group-hover:animate-bounce" />
                                            <span className="text-[8px] font-black uppercase mt-[-2px]">Entrenar</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* EMPTY STATE AFTER SCAN (Should recycle but just in case) */}
                {scanComplete && nearbyUsers.length === 0 && !loading && (
                    <div className="text-center p-8 bg-neutral-900/50 rounded-2xl border border-dashed border-neutral-800">
                        <p className="text-neutral-500 font-bold mb-4">Zona Muerta</p>
                        <button onClick={handleScan} className="text-gym-primary text-sm font-bold uppercase hover:underline">
                            Escanear de nuevo
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};
