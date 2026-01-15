import { useState, useEffect, useRef } from 'react';
import { radarService, type RadarUser } from '../services/RadarService';
import { notificationService } from '../services/NotificationService';
import { Radar as RadarIcon, Dumbbell, X, UserPlus } from 'lucide-react';

export const Radar = () => {
    const [nearbyUsers, setNearbyUsers] = useState<RadarUser[]>([]);
    const [loading, setLoading] = useState(true); // Start loading immediately
    const [locationError, setLocationError] = useState<string | null>(null);
    const [radius] = useState(100);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [scanComplete, setScanComplete] = useState(false);
    const initialized = useRef(false);
    const [direction, setDirection] = useState<'left' | 'right' | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

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
        if (nearbyUsers.length === 0 || isAnimating) return;
        setCurrentIndex((prev) => (prev + 1) % nearbyUsers.length);
    };

    const handleAction = async (action: 'skip' | 'train') => {
        if (isAnimating) return;

        // Set animation direction
        setDirection(action === 'skip' ? 'left' : 'right');
        setIsAnimating(true);

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 300));

        // Here we could add logic to save the "Like/Pass"
        if (action === 'train') {
            console.log(`Reclutando a ${nearbyUsers[currentIndex].username}`);

            if (nearbyUsers[currentIndex].user_id) {
                const success = await notificationService.sendInvitation(nearbyUsers[currentIndex].user_id, "Un Aliado");
                if (success) {
                    alert("¡Invitación enviada!");
                }
            }
        }

        handleNext();
        setDirection(null);
        setIsAnimating(false);
    };

    const currentUser = nearbyUsers.length > 0 ? nearbyUsers[currentIndex] : null;


    return (
        <div className="h-full flex flex-col relative overflow-hidden bg-black">



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
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 p-8">
                        {/* Skeleton Card */}
                        <div className="w-full max-w-sm bg-neutral-900 rounded-2xl overflow-hidden animate-pulse">
                            <div className="h-48 bg-neutral-800"></div>
                            <div className="p-6 space-y-4">
                                <div className="w-24 h-24 bg-neutral-800 rounded-full mx-auto -mt-16"></div>
                                <div className="h-6 bg-neutral-800 rounded w-3/4 mx-auto"></div>
                                <div className="h-4 bg-neutral-800 rounded w-1/2 mx-auto"></div>
                                <div className="h-12 bg-neutral-800 rounded"></div>
                            </div>
                        </div>
                        <p className="text-gym-primary font-bold animate-pulse tracking-widest text-xs uppercase">Escaneando sector...</p>
                    </div>
                )}

                {/* ACTIVE CARD CONTAINER - FLEX STRETCH */}
                {scanComplete && nearbyUsers.length > 0 && currentUser && !loading && (
                    <div
                        className={`flex-1 flex flex-col relative bg-neutral-900 w-full mb-0 rounded-b-none transition-all duration-300 ${direction === 'left' ? 'animate-[slideOutLeft_0.3s_ease-out_forwards]' :
                                direction === 'right' ? 'animate-[slideOutRight_0.3s_ease-out_forwards]' :
                                    'animate-in fade-in slide-in-from-bottom-8 duration-500'
                            }`}
                        style={{
                            transform: direction === 'left' ? 'translateX(-100%) rotate(-10deg)' :
                                direction === 'right' ? 'translateX(100%) rotate(10deg)' :
                                    'translateX(0) rotate(0)',
                            opacity: direction ? 0 : 1,
                        }}
                    >

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

                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black"></div>
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
                                <p className="text-neutral-300 text-sm font-medium leading-relaxed px-6 max-w-md text-center mt-3 min-h-[60px]">
                                    {currentUser.description || "✨ Sin descripción aún"}
                                </p>

                                {/* Card Counter */}
                                <div className="mt-2 px-3 py-1 bg-neutral-800/50 rounded-full border border-neutral-700/50">
                                    <span className="text-xs font-bold text-neutral-400">
                                        {currentIndex + 1} de {nearbyUsers.length}
                                    </span>
                                </div>
                            </div>

                            {/* Middle Stats Group */}
                            <div className="flex-1 flex items-center justify-center w-full py-2">
                                <div className="grid grid-cols-2 gap-3 w-full max-w-[200px]">
                                    <div className="flex flex-col items-center p-2 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
                                        <span className={`text-xl font-black ${currentUser.tier.color}`}>{currentUser.checkins_count}</span>
                                        <span className="text-[8px] text-neutral-500 uppercase font-bold tracking-widest">Entrenos</span>
                                    </div>
                                    <div className="flex flex-col items-center p-2 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
                                        <span className="text-xl font-black text-white">{currentUser.followers_count || 0}</span>
                                        <span className="text-[8px] text-neutral-500 uppercase font-bold tracking-widest">Seguidores</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- SAFE FOOTER (Dedicated Area) --- */}
                        <div className="shrink-0 w-full flex justify-center items-center gap-6 pb-20 pt-4 relative z-30 bg-gradient-to-t from-black via-black/80 to-transparent">

                            {/* REJECT BUTTON - Minimalist Outline */}
                            <button
                                onClick={() => handleAction('skip')}
                                disabled={isAnimating}
                                className="w-14 h-14 rounded-full border-2 border-neutral-700 bg-neutral-900/80 backdrop-blur-sm text-neutral-400 flex items-center justify-center hover:bg-neutral-800 hover:text-white hover:border-neutral-600 hover:scale-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                            >
                                <X size={24} strokeWidth={2.5} />
                            </button>

                            {/* ACCEPT BUTTON - Solid Capsule "Pro" Style */}
                            <button
                                onClick={() => handleAction('train')}
                                disabled={isAnimating}
                                className="h-14 px-8 rounded-full bg-gradient-to-r from-gym-primary to-yellow-400 text-black flex items-center gap-3 shadow-xl shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-105 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <UserPlus size={20} strokeWidth={2.5} />
                                <span className="text-sm font-black uppercase tracking-widest">Invitar</span>
                            </button>
                        </div>

                    </div>
                )}
            </div>
        </div >
    );
};
