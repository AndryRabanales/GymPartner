import { useState, useEffect } from 'react';
import { Search, MapPin, Loader } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { GymPlace } from '../../services/MapsService';

interface GymSelectorProps {
    onSelect: (gym: GymPlace) => void;
}

export const GymSelector = ({ onSelect }: GymSelectorProps) => {
    const placesLibrary = useMapsLibrary('places');
    const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
    const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Initialize Services when Library is loaded
    useEffect(() => {
        if (!placesLibrary) return;
        setAutocompleteService(new placesLibrary.AutocompleteService());

        // We need a dummy div to init PlacesService, or use the map instance if available.
        // For simple data fetching without map, we can create a phantom div.
        const phantomDiv = document.createElement('div');
        setPlacesService(new placesLibrary.PlacesService(phantomDiv));
    }, [placesLibrary]);

    useEffect(() => {
        if (!autocompleteService || query.length < 3) {
            setResults([]);
            return;
        }

        const timer = setTimeout(() => {
            setLoading(true);
            autocompleteService.getPlacePredictions({
                input: query,
                types: ['establishment'],
            }, (predictions, status) => {
                setLoading(false);
                if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                    setResults(predictions);
                } else {
                    setResults([]);
                }
            });
        }, 500);

        return () => clearTimeout(timer);
    }, [query, autocompleteService]);

    const handleSelect = (prediction: any) => {
        if (!placesService) return;

        setLoading(true);
        // We need details to get Lat/Lng, as autocomplete only gives ID and Text
        placesService.getDetails({
            placeId: prediction.place_id,
            fields: ['place_id', 'name', 'formatted_address', 'geometry', 'rating', 'user_ratings_total']
        }, (place, status) => {
            setLoading(false);
            if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {

                const gymPayload: GymPlace = {
                    place_id: place.place_id!,
                    name: place.name!,
                    address: place.formatted_address!,
                    location: {
                        lat: place.geometry.location.lat(),
                        lng: place.geometry.location.lng()
                    },
                    rating: place.rating,
                    user_ratings_total: place.user_ratings_total
                };

                onSelect(gymPayload);
            }
        });
    };

    return (
        <div className="w-full max-w-xl mx-auto space-y-4">
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {loading ? (
                        <Loader className="animate-spin text-gym-primary" size={20} />
                    ) : (
                        <Search className="text-neutral-500 group-focus-within:text-gym-primary transition-colors" size={20} />
                    )}
                </div>
                <input
                    type="text"
                    className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-gym-primary/50 focus:border-transparent outline-none transition-all placeholder:text-neutral-600 font-medium"
                    placeholder="Busca tu gimnasio (Real Google Search)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            {/* Results Dropdown */}
            {results.length > 0 && (
                <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 max-h-[300px] overflow-y-auto">
                    <div className="divide-y divide-neutral-800">
                        {results.map((prediction) => (
                            <button
                                key={prediction.place_id}
                                onClick={() => handleSelect(prediction)}
                                className="w-full text-left p-4 hover:bg-neutral-800 transition-colors flex items-start gap-3 group"
                            >
                                <div className="bg-neutral-800 group-hover:bg-neutral-700 p-2.5 rounded-lg transition-colors">
                                    <MapPin className="text-neutral-400 group-hover:text-gym-primary" size={20} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-white font-bold group-hover:text-gym-primary transition-colors">
                                        {prediction.structured_formatting?.main_text || prediction.description}
                                    </h4>
                                    <p className="text-sm text-neutral-400 truncate">
                                        {prediction.structured_formatting?.secondary_text}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {!placesLibrary && (
                <p className="text-center text-xs text-red-500">
                    ⚠️ Google Maps API no detectada. Revisa tu .env
                </p>
            )}
        </div>
    );
};
