import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MapPin, ArrowLeft, Loader } from 'lucide-react';
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

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-gym-primary"><Loader className="animate-spin" /></div>;

    if (!gym) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Gym not found.</div>;

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
        </div>
    );
};
