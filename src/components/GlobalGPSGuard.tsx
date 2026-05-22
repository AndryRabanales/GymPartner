import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { getCurrentPosition } from '../utils/geolocationUtils';
import { userService } from '../services/UserService';
import { MapPin, Check } from 'lucide-react';

export const GlobalGPSGuard = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [ambiguousGyms, setAmbiguousGyms] = useState<any[]>([]);

    const checkLocationAndResolveGym = async () => {
        if (!user) return;
        try {
            const gpsPosition = await getCurrentPosition({ enableHighAccuracy: true, timeout: 3500 })
                .catch(async () => {
                    return await getCurrentPosition({ enableHighAccuracy: false, timeout: 2000 });
                });

            if (gpsPosition) {
                const userLat = gpsPosition.lat;
                const userLng = gpsPosition.lng;
                
                const [myGyms, allGyms] = await Promise.all([
                    userService.getUserGyms(user.id),
                    userService.getAllGyms()
                ]);

                const gymsWithDistance = allGyms
                    .filter(g => g.lat && g.lng)
                    .map(g => {
                        const R = 6371;
                        const dLat = (g.lat - userLat) * (Math.PI / 180);
                        const dLon = (g.lng - userLng) * (Math.PI / 180);
                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(userLat * (Math.PI / 180)) * Math.cos(g.lat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                        const dist = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
                        return { ...g, dist };
                    })
                    .filter(g => g.dist <= 0.5)
                    .sort((a, b) => a.dist - b.dist);

                if (gymsWithDistance.length > 0) {
                    // Find which of these nearby gyms are predeterminados
                    const nearbyPredeterminados = gymsWithDistance.filter(g => myGyms.some(ug => ug.gym_id === g.id && ug.is_home_base));
                    
                    if (nearbyPredeterminados.length === 1) {
                        // User is near exactly one predeterminado. Do nothing (invisible, fluid).
                        return;
                    } else if (nearbyPredeterminados.length > 1) {
                        // User is near MULTIPLE predeterminados. Ask them to choose between these.
                        setAmbiguousGyms(nearbyPredeterminados);
                    } else {
                        // User is near 0 predeterminados. Ask them to choose from all nearby gyms.
                        setAmbiguousGyms(gymsWithDistance);
                    }
                }
            }
        } catch (e) {
            console.error("GPS Guard Error:", e);
        }
    };

    useEffect(() => {
        // Trigger on app load, map entry, profile entry (which covers registration redirect)
        if (user && (location.pathname === '/' || location.pathname === '/profile' || location.pathname === '/map')) {
            checkLocationAndResolveGym();
        }
    }, [user, location.pathname]);

    const handleSelectAmbiguousGym = async (gym: any) => {
        try {
            await userService.toggleHomeBase(user!.id, gym.id, true);
            const myGyms = await userService.getUserGyms(user!.id);
            if (!myGyms.some(g => g.gym_id === gym.id)) {
                await userService.addGymToPassport(user!.id, {
                    place_id: gym.place_id,
                    name: gym.name,
                    address: gym.address || '',
                    location: { lat: gym.lat, lng: gym.lng }
                });
            }
            setAmbiguousGyms([]);
            // Could optionally force a reload if needed, but the state will update naturally next fetch
            if (location.pathname === '/' || location.pathname === '/profile') {
                window.dispatchEvent(new Event('gympartner_reload_profile')); // Custom event to reload profile if needed
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (ambiguousGyms.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
            <div className="bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-[2rem] w-full max-w-sm text-center shadow-2xl relative overflow-hidden">
                <div className="w-16 h-16 bg-gym-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-gym-primary/20">
                    <MapPin className="text-gym-primary w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Sede Detectada</h2>
                <p className="text-neutral-400 text-sm mb-6">
                    Hemos detectado que estás cerca de {ambiguousGyms.length > 1 ? 'estos gimnasios' : 'este gimnasio'}. Selecciona tu sede principal.
                </p>
                
                <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                    {ambiguousGyms.map(gym => (
                        <button
                            key={gym.id}
                            onClick={() => handleSelectAmbiguousGym(gym)}
                            className="w-full bg-black hover:bg-neutral-800 border border-white/10 hover:border-gym-primary/50 rounded-xl p-4 flex items-center justify-between group transition-all text-left"
                        >
                            <div>
                                <div className="text-white font-bold text-sm group-hover:text-gym-primary transition-colors">{gym.name}</div>
                                <div className="text-neutral-500 text-xs">A {Math.round(gym.dist * 1000)}m de ti</div>
                            </div>
                            <Check className="text-gym-primary opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
