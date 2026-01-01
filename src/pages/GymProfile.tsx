import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MapPin, Dumbbell, Swords, ArrowLeft, Loader, Lock } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { getDistance } from '../utils/distance';
import { AlphaBadge } from '../components/gamification/AlphaBadge';

interface GymDetails {
    id: string;
    name: string;
    address: string;
    place_id: string;
    lat?: number;
    lng?: number;
}

export const GymProfile = () => {
    const { gymId } = useParams<{ gymId: string }>();
    const [gym, setGym] = useState<GymDetails | null>(null);
    const [loading, setLoading] = useState(true);

    // Location Logic
    const { location: userLocation, loading: locationLoading } = useGeolocation();
    const [distance, setDistance] = useState<number | null>(null);
    const MAX_DISTANCE_KM = 100.0; // DEV MODE: 100km (Was 0.01km)

    useEffect(() => {
        if (gymId) {
            loadGymDetails();
        }
    }, [gymId]);

    const loadGymDetails = async () => {
        try {
            if (!supabase) return;
            const { data, error } = await supabase
                .from('gyms')
                .select('*')
                .eq('id', gymId)
                .single();

            if (error) throw error;
            setGym(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (gym && userLocation && gym.lat && gym.lng) {
            const dist = getDistance(userLocation.lat, userLocation.lng, gym.lat, gym.lng);
            setDistance(dist);
        }
    }, [gym, userLocation]);

    if (loading || locationLoading) return <div className="min-h-screen flex items-center justify-center bg-black text-gym-primary"><Loader className="animate-spin" /></div>;

    if (!gym) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Gym not found.</div>;

    const isNear = distance !== null && distance <= MAX_DISTANCE_KM;

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-6 pb-24">
            {/* Header */}
            <div className="mb-8">
                <Link to="/" className="text-neutral-500 hover:text-white flex items-center gap-2 mb-4">
                    <ArrowLeft size={20} /> Volver al Mapa Global
                </Link>
                <div className="flex items-start gap-4">
                    <div className="bg-gym-primary/10 p-4 rounded-2xl">
                        <MapPin size={32} className="text-gym-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black uppercase italic">{gym.name}</h1>
                        <p className="text-neutral-400 text-sm">{gym.address}</p>
                    </div>
                </div>

                {/* Alpha Badge */}
                {gymId && (
                    <div className="mt-4">
                        <AlphaBadge gymId={gymId} size="lg" showStats={true} />
                    </div>
                )}
            </div>

            {/* Quick Actions Grid */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 relative ${!isNear ? 'opacity-50 pointer-events-none grayscale' : ''}`}>

                {/* Lock Overlay if far */}
                {!isNear && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-4">
                        <div className="bg-black/80 backdrop-blur-md p-6 rounded-3xl border border-red-500/30 shadow-2xl transform scale-100 hover:scale-105 transition-transform">
                            <Lock size={48} className="text-red-500 mx-auto mb-4" />
                            <h3 className="text-xl font-black text-white uppercase italic mb-2">Fuera de Rango</h3>
                            <p className="text-neutral-400 text-sm mb-4">
                                Debes estar a menos de <strong>{MAX_DISTANCE_KM}km</strong> para interactuar.<br />
                                {distance ? `Distancia actual: ${distance.toFixed(2)}km` : 'Calculando ubicación...'}
                            </p>
                        </div>
                    </div>
                )}

                <Link
                    to={`/territory/${gymId}/arsenal`}
                    className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex items-center gap-4 hover:border-blue-500/50 transition-all group"
                >
                    <div className="bg-blue-500/10 p-3 rounded-full group-hover:bg-blue-500/20 text-blue-500">
                        <Dumbbell size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg group-hover:text-blue-400 transition-colors">Arsenal Local</h3>
                        <p className="text-neutral-500 text-sm">Gestionar máquinas de esta sede.</p>
                    </div>
                </Link>

                <Link
                    to={`/territory/${gymId}/workout`}
                    className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex items-center gap-4 hover:border-red-500/50 transition-all group"
                >
                    <div className="bg-red-500/10 p-3 rounded-full group-hover:bg-red-500/20 text-red-500">
                        <Swords size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg group-hover:text-red-400 transition-colors">Iniciar Entrenamiento</h3>
                        <p className="text-neutral-500 text-sm">Entrenar en este territorio.</p>
                    </div>
                </Link>
            </div>

            {/* Distance Indicator (Always Visible) */}
            {distance !== null && (
                <div className={`mt-4 text-center text-sm font-bold uppercase tracking-widest ${isNear ? 'text-green-500' : 'text-red-500'}`}>
                    {isNear ? '🟢 En rango de operación' : `🔴 A ${(distance).toFixed(2)}km del objetivo`}
                </div>
            )}

            {/* Stats / Placeholder */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-center">
                <p className="text-neutral-500 text-sm">Estadísticas de territorio próximamente...</p>
            </div>
        </div>
    );
};
