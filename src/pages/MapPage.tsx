import { GymMap } from "../components/map/GymMap";
import { useAuth } from "../context/AuthContext";
import { PublicTeaser } from "../components/common/PublicTeaser";
import { MapPin, Search, Filter, Star, ChevronRight } from "lucide-react";

export const MapPage = () => {
    const { user } = useAuth();

    if (!user) {
        return (
            <PublicTeaser
                icon={MapPin}
                title="Visualiza el Campo de Batalla"
                description="Descubre los gimnasios más equipados de tu zona y domina cualquier territorio."
                benefitTitle="Radar de Inteligencia"
                benefitDescription="Localiza máquinas específicas, reportes de comunidad y disponibilidad en tiempo real."
                iconColor="text-blue-500"
                bgAccent="bg-blue-500/10"
            >
                <div className="bg-neutral-900 border border-white/5 rounded-2xl p-4 text-left space-y-3 opacity-80 pointer-events-none">
                    <div className="flex gap-2">
                        <div className="flex-1 bg-neutral-800 rounded-lg p-2.5 flex items-center gap-2">
                            <Search size={14} className="text-neutral-500" />
                            <div className="h-2 w-24 bg-neutral-700 rounded-sm" />
                        </div>
                        <div className="bg-neutral-800 rounded-lg p-2.5">
                            <Filter size={14} className="text-neutral-500" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        {[1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-3 p-2 bg-neutral-800/50 rounded-xl border border-white/5">
                                <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
                                    <MapPin size={18} className="text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="h-3 w-32 bg-neutral-700 rounded mb-1.5" />
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-0.5">
                                            {[...Array(5)].map((_, j) => (
                                                <Star key={j} size={8} fill={j < 4 ? "currentColor" : "none"} className="text-yellow-500" />
                                            ))}
                                        </div>
                                        <div className="h-2 w-16 bg-neutral-700/50 rounded" />
                                    </div>
                                </div>
                                <ChevronRight size={14} className="text-neutral-600" />
                            </div>
                        ))}
                    </div>
                </div>
            </PublicTeaser>
        );
    }

    return (
        <div className="w-full h-full relative">
            <GymMap />
        </div>
    );
};
