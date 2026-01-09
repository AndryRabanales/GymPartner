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

    const handleAction = async (action: 'skip' | 'train') => {
        // Here we could add logic to save the "Like/Pass"
        if (action === 'train') {
            console.log(`Reclutando a ${nearbyUsers[currentIndex].username}`);

            // Send Invitation
            // Note: In a real app we might want to show a success toast here
            if (nearbyUsers[currentIndex].user_id) {
                // Get current user name for the notification (Mock or Context)
                // Ideally this comes from AuthContext, but let's assume "Un Aliado" if generic
                // NotificationService handles sender ID internally via Auth.
                const success = await notificationService.sendInvitation(nearbyUsers[currentIndex].user_id, "Un Aliado");
                if (success) {
                    alert("¡Invitación enviada!");
                }
            }
        }
        handleNext();
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
                                className="w-14 h-14 rounded-full border border-neutral-800 bg-neutral-900/50 backdrop-blur-sm text-neutral-500 flex items-center justify-center hover:bg-neutral-800 hover:text-white transition-colors active:scale-95"
                            >
                                <X size={24} strokeWidth={2} />
                            </button>

                            {/* ACCEPT BUTTON - Solid Capsule "Pro" Style */}
                            <button
                                onClick={() => handleAction('train')}
                                className="h-14 px-8 rounded-full bg-gym-primary text-black flex items-center gap-3 shadow-lg shadow-yellow-900/20 hover:bg-yellow-400 hover:scale-105 transition-all active:scale-95"
                            >
                                <UserPlus size={20} strokeWidth={2.5} />
                                <span className="text-sm font-black uppercase tracking-widest">Invitar</span>
                            </button>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};
