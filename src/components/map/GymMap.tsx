/// <reference types="google.maps" />
import { Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { InteractiveOverlay } from '../onboarding/InteractiveOverlay';
import { userService } from '../../services/UserService';
import { notificationService } from '../../services/NotificationService';
import { getDistance } from '../../utils/distance';
import type { UserPrimaryGym } from '../../services/UserService';
import { useNavigate } from 'react-router-dom';
import { Lock, Star, Search, Loader, MapPin, Heart } from 'lucide-react';
import { PlayerProfileModal } from '../profile/PlayerProfileModal';

interface GymMarker {
    id: string; // database id if exists, else place_id
    place_id: string;
    name: string;
    lat: number;
    lng: number;
    is_database: boolean; // true if it exists in our gyms table
    is_unlocked: boolean; // true if user has this gym in passport
    is_home_base: boolean;
    favorites_count?: number;
    rating?: number;
    address?: string;
    photoUrl?: string;
}

export const GymMap = () => {
    // API KEY placeholder - will come from env
    const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const { user } = useAuth();
    const navigate = useNavigate();

    const map = useMap();
    const placesLib = useMapsLibrary('places');
    const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);
    const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);

    const [userGyms, setUserGyms] = useState<UserPrimaryGym[]>([]);
    const [dbGyms, setDbGyms] = useState<any[]>([]); // Gyms already in our DB
    const [displayGyms, setDisplayGyms] = useState<GymMarker[]>([]);
    const [selectedGym, setSelectedGym] = useState<GymMarker | null>(null);
    const [showProfile, setShowProfile] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Favorites State
    const [isFavorite, setIsFavorite] = useState(false);
    const [favoriteCount, setFavoriteCount] = useState(0);

    // TUTORIAL STATE
    const [tutorialStep, setTutorialStep] = useState(0);

    useEffect(() => {
        const step = parseInt(localStorage.getItem('tutorial_step') || '0');
        setTutorialStep(step);
    }, []);

    // Default position: Mexico City (fallback)
    const defaultPosition = { lat: 19.4326, lng: -99.1332 };

    useEffect(() => {
        loadInternalData();
    }, [user]);

    // Initialize Places Service
    useEffect(() => {
        if (!placesLib || !map) return;
        setPlacesService(new placesLib.PlacesService(map));
        setAutocompleteService(new placesLib.AutocompleteService());
    }, [placesLib, map]);

    // Geolocation Effect
    const { location: userLocation } = useGeolocation();
    const [hasCenteredOnce, setHasCenteredOnce] = useState(false);

    useEffect(() => {
        if (userLocation && map && !hasCenteredOnce) {
            // Use Real User Location
            const pos = {
                lat: userLocation.lat,
                lng: userLocation.lng,
            };
            map.panTo(pos);
            map.setZoom(15);
            setHasCenteredOnce(true);
        }
    }, [userLocation, map, hasCenteredOnce]);

    // Search Nearby Gyms when map moves or loads
    const searchNearbyGyms = useCallback(() => {
        if (!placesService || !map) return;

        const center = map.getCenter();
        if (!center) return;

        const request: google.maps.places.PlaceSearchRequest = {
            location: center,
            radius: 5000, // 5km search radius
            type: 'gym'
        };

        placesService.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                mergeAndDisplayGyms(results);
            }
        });
    }, [placesService, map, userGyms, dbGyms]);

    // Trigger search when map stops moving (idle)
    useEffect(() => {
        if (!map) return;
        const listener = map.addListener('idle', searchNearbyGyms);
        return () => google.maps.event.removeListener(listener);
    }, [map, searchNearbyGyms]);

    // Re-trigger search when internal DB data loads or changes
    useEffect(() => {
        if (placesService && dbGyms.length > 0) {
            searchNearbyGyms();
        }
    }, [placesService, dbGyms, userGyms, searchNearbyGyms]);

    const loadInternalData = async () => {
        // 1. Load All Known DB Gyms
        const worldGyms = await userService.getAllGyms();
        setDbGyms(worldGyms);

        let myGyms: UserPrimaryGym[] = [];
        if (user) {
            // 2. Load My Conquests
            myGyms = await userService.getUserGyms(user.id);
            setUserGyms(myGyms);
        }

        // 3. Pre-populate displayGyms instantly from DB data!
        const initialMarkers: GymMarker[] = worldGyms.map(gym => {
            const existingUserGym = myGyms.find(ug => ug.gym_id === gym.id);
            return {
                id: gym.id,
                place_id: gym.place_id || '',
                name: gym.name,
                lat: gym.lat,
                lng: gym.lng,
                is_database: true,
                is_unlocked: !!existingUserGym,
                is_home_base: existingUserGym?.is_home_base || false,
                favorites_count: gym.gym_favorites?.[0]?.count || 0,
                rating: gym.rating || 4.5,
                address: gym.address,
                photoUrl: undefined
            };
        });
        setDisplayGyms(initialMarkers);
    };

    const mergeAndDisplayGyms = (googleResults: google.maps.places.PlaceResult[]) => {
        const markers: GymMarker[] = [];

        // 1. Process Google Results (Wild Gyms + Potential DB Matches)
        googleResults.forEach(place => {
            if (!place.geometry?.location || !place.place_id) return;

            // Check if this google place exists in our DB
            const existingDbGym = dbGyms.find(g => g.place_id === place.place_id);
            // Check if user has conquered it
            const existingUserGym = userGyms.find(ug => ug.google_place_id === place.place_id);

            // Get photo URL if available
            let photoUrl = undefined;
            if (place.photos && place.photos.length > 0) {
                photoUrl = place.photos[0].getUrl({ maxWidth: 400 });
            }

            markers.push({
                id: existingDbGym?.id || place.place_id, // Prefer UUID if exists
                place_id: place.place_id,
                name: place.name || 'Gimnasio Desconocido',
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                is_database: !!existingDbGym,
                is_unlocked: !!existingUserGym,
                is_home_base: existingUserGym?.is_home_base || false,
                favorites_count: existingDbGym?.gym_favorites?.[0]?.count || 0,
                rating: place.rating,
                address: place.vicinity,
                photoUrl: photoUrl
            });
        });

        // 2. Keep all dbGyms that are NOT in the googleResults so they don't disappear
        const googlePlaceIds = new Set(markers.map(m => m.place_id));
        dbGyms.forEach(gym => {
            if (gym.place_id && googlePlaceIds.has(gym.place_id)) return;

            // Check if user has conquered it
            const existingUserGym = userGyms.find(ug => ug.gym_id === gym.id);

            markers.push({
                id: gym.id,
                place_id: gym.place_id || '',
                name: gym.name,
                lat: gym.lat,
                lng: gym.lng,
                is_database: true,
                is_unlocked: !!existingUserGym,
                is_home_base: existingUserGym?.is_home_base || false,
                favorites_count: gym.gym_favorites?.[0]?.count || 0,
                rating: gym.rating || 4.5,
                address: gym.address,
                photoUrl: undefined
            });
        });

        setDisplayGyms(markers);
    };

    const handleUnlock = async () => {
        if (!selectedGym || !user) return;

        if (!userLocation) {
            alert('⛔ Debes activar tu ubicación GPS para poder desbloquear un gimnasio.');
            return;
        }

        // Distance Check: Enforce strict 0.16km (160m) maximum distance (Pokemon GO style)
        const distance = getDistance(userLocation.lat, userLocation.lng, selectedGym.lat, selectedGym.lng);
        if (distance > 0.16) {
            alert(`⛔ Estás muy lejos para interactuar. Acércate más al gimnasio (Max 160m). Distancia actual: ${distance.toFixed(2)}km.`);
            return;
        }

        const result = await userService.addGymToPassport(user.id, {
            place_id: selectedGym.place_id,
            name: selectedGym.name,
            address: selectedGym.address || '',
            location: { lat: selectedGym.lat, lng: selectedGym.lng },
            rating: selectedGym.rating
        });

        if (result.success && result.gym_id) {
            // Updated: Navigate to the new territory
            // We update the local state to reflect the change immediately without reload
            const newGym: UserPrimaryGym = {
                gym_id: result.gym_id!,
                gym_name: selectedGym.name, // Optimistic update
                since: new Date().toISOString(),
                is_home_base: false, // Default for new conquest
                google_place_id: selectedGym.place_id,
                lat: selectedGym.lat,
                lng: selectedGym.lng
            };

            setUserGyms([...userGyms, newGym]);

            // Re-merge to update markers colors
            setDisplayGyms(prev => prev.map(g =>
                g.place_id === selectedGym.place_id
                    ? { ...g, is_unlocked: true, id: result.gym_id! }
                    : g
            ));

            // TUTORIAL: Advance from step 5 to 6 when gym is added
            const currentStep = localStorage.getItem('tutorial_step');
            if (currentStep === '5') {
                console.log('[TUTORIAL] Gym added, transitioning from step 5 to 6');
                localStorage.setItem('tutorial_step', '6');
                setTutorialStep(6);
            }

            setSelectedGym(null);
            // navigate(`/territory/${result.gym_id}`);
            navigate('/');
        } else {
            alert('Error al desbloquear: ' + result.error);
        }
    };

    const handleSetHomeBase = async () => {
        if (!selectedGym || !user || !selectedGym.id) return;

        const result = await userService.toggleHomeBase(user.id, selectedGym.id, true);

        if (result.success) {
            // Update local state
            setUserGyms(prev => prev.map(g => ({
                ...g,
                is_home_base: g.gym_id === selectedGym.id ? true : g.is_home_base
            })));

            // Update markers
            setDisplayGyms(prev => prev.map(g => ({
                ...g,
                is_home_base: g.id === selectedGym.id ? true : g.is_home_base
            })));

            // Update current selection to reflect change immediately
            setSelectedGym(prev => prev ? { ...prev, is_home_base: true } : null);

            // Notify other members of this gym
            const userName = user.user_metadata?.full_name || user.user_metadata?.username || 'Un Agente';
            await notificationService.notifyGymMembers(selectedGym.id, user.id, userName, selectedGym.name);
        } else {
            alert('Error al establecer sede: ' + result.error);
        }
    };

    const handleToggleFavorite = async () => {
        if (!selectedGym || !user || !selectedGym.id) return;

        const newFavState = !isFavorite;
        setIsFavorite(newFavState);
        setFavoriteCount(prev => newFavState ? prev + 1 : Math.max(0, prev - 1));

        const result = await userService.toggleFavoriteGym(user.id, selectedGym.id, newFavState);
        if (!result.success) {
            // Revert on failure
            setIsFavorite(!newFavState);
            setFavoriteCount(prev => !newFavState ? prev + 1 : Math.max(0, prev - 1));
            console.error('Error al actualizar favorito:', result.error);
        }
    };

    useEffect(() => {
        const fetchFavoriteData = async () => {
            if (selectedGym && selectedGym.id && user) {
                const count = await userService.getGymFavoritesCount(selectedGym.id);
                const isFav = await userService.checkIsFavorite(user.id, selectedGym.id);
                setFavoriteCount(count);
                setIsFavorite(isFav);
            } else {
                setFavoriteCount(0);
                setIsFavorite(false);
            }
        };
        fetchFavoriteData();
    }, [selectedGym, user]);

    // Handle autocomplete suggestions
    const handleAutocomplete = (query: string) => {
        console.log('[AUTOCOMPLETE] Query:', query);

        if (!query.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        if (!autocompleteService) {
            console.error('[AUTOCOMPLETE] Service not initialized');
            return;
        }

        const searchLocationObj = userLocation
            ? new google.maps.LatLng(userLocation.lat, userLocation.lng)
            : map?.getCenter();

        if (!searchLocationObj) {
            console.error('[AUTOCOMPLETE] No location available');
            return;
        }

        console.log('[AUTOCOMPLETE] Searching near:', searchLocationObj.lat(), searchLocationObj.lng());

        // Get country code from user location using Geocoder
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: searchLocationObj }, (results, status) => {
            let countryCode = '';

            if (status === 'OK' && results && results[0]) {
                const addressComponents = results[0].address_components;
                const countryComponent = addressComponents.find(component =>
                    component.types.includes('country')
                );
                if (countryComponent) {
                    countryCode = countryComponent.short_name;
                    console.log('[AUTOCOMPLETE] Country detected:', countryCode);
                }
            }

            const request: google.maps.places.AutocompletionRequest = {
                input: query,
                location: searchLocationObj,
                radius: 300000, // 300km radius
                componentRestrictions: countryCode ? { country: countryCode } : undefined
            };

            autocompleteService.getPlacePredictions(request, (predictions, status) => {
                console.log('[AUTOCOMPLETE] Status:', status);
                console.log('[AUTOCOMPLETE] Predictions:', predictions?.length || 0);

                if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                    // Limit to 3 suggestions
                    setSuggestions(predictions.slice(0, 3));
                    setShowSuggestions(true);
                } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            });
        });
    };

    // Search gyms by name near user location
    const handleSearch = (query?: string) => {
        const searchTerm = query || searchQuery;
        if (!searchTerm.trim() || !placesService || !map) return;

        setShowSuggestions(false);

        setIsSearching(true);

        // Use user location if available, otherwise use map center
        const searchLocationObj = userLocation
            ? new google.maps.LatLng(userLocation.lat, userLocation.lng)
            : map.getCenter();

        if (!searchLocationObj) {
            setIsSearching(false);
            return;
        }

        const request: google.maps.places.TextSearchRequest = {
            query: `${searchTerm} gym`,
            location: searchLocationObj,
            radius: 300000, // 300km radius to keep results within same state
            type: 'gym'
        };

        placesService.textSearch(request, (results, status) => {
            setIsSearching(false);
            if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                mergeAndDisplayGyms(results);
                // Center map on first result
                const firstResult = results[0];
                if (firstResult.geometry?.location) {
                    map.panTo(firstResult.geometry.location);
                    map.setZoom(15);
                }
            } else {
                alert('No se encontraron gimnasios cerca con ese nombre. Intenta con otro término.');
            }
        });
    };



    if (!API_KEY) {
        return (
            <div className="w-full h-[500px] flex flex-col items-center justify-center bg-neutral-900 text-white p-6 rounded-xl border border-neutral-800">
                <h2 className="text-xl font-bold mb-2">Falta la Llave Maestra 🔑</h2>
                <p className="text-neutral-400 text-center mb-4">
                    El mapa está listo, pero necesita combustible.
                    <br />
                    Configura <code>VITE_GOOGLE_MAPS_API_KEY</code> en tu archivo <code>.env</code>.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full h-[calc(100vh-100px)] md:h-[calc(100vh-120px)] rounded-none md:rounded-3xl overflow-hidden shadow-2xl border-0 md:border border-neutral-800 relative bg-neutral-900 group">

            {/* CEO Upgrade: Animated HUD Header (CLEANED UP) */}
            <div className="absolute top-0 left-0 w-full p-4 z-20 pointer-events-none flex flex-col items-center justify-start">

                {/* SEARCH BAR */}
                <div className="mt-4 w-full max-w-md mx-auto pointer-events-auto relative">
                    <div className="flex gap-2">
                        <div className="relative flex-1" id="tut-map-search-input">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 z-10" />
                            <input
                                type="text"
                                placeholder="Busca tu gimnasio..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    handleAutocomplete(e.target.value);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSearch();
                                    if (e.key === 'Escape') {
                                        setShowSuggestions(false);
                                    }
                                }}
                                onFocus={() => {
                                    if (suggestions.length > 0) setShowSuggestions(true);
                                }}
                                className="w-full bg-black/60 backdrop-blur-md border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-neutral-400 focus:outline-none focus:border-gym-primary/50 transition-all text-sm relative z-10"
                            />

                            {/* Autocomplete Suggestions Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {suggestions.map((suggestion) => (
                                        <button
                                            key={suggestion.place_id}
                                            onClick={() => {
                                                setSearchQuery(suggestion.structured_formatting.main_text);
                                                handleSearch(suggestion.structured_formatting.main_text);
                                            }}
                                            className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0 group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gym-primary/10 flex items-center justify-center shrink-0 group-hover:bg-gym-primary/20 transition-colors">
                                                    <MapPin size={16} className="text-gym-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white font-bold text-sm truncate">
                                                        {suggestion.structured_formatting.main_text}
                                                    </div>
                                                    <div className="text-neutral-400 text-xs truncate">
                                                        {suggestion.structured_formatting.secondary_text}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => handleSearch()}
                            disabled={isSearching || !searchQuery.trim()}
                            className="bg-gym-primary hover:bg-yellow-400 disabled:bg-neutral-700 disabled:cursor-not-allowed text-black font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.3)] disabled:shadow-none"
                        >
                            {isSearching ? (
                                <Loader size={18} className="animate-spin" />
                            ) : (
                                <Search size={18} />
                            )}
                            <span className="hidden md:inline">BUSCAR</span>
                        </button>
                    </div>
                </div>
            </div>



            {/* PROFILE DRAWER */}
            {showProfile && user && (
                <PlayerProfileModal
                    player={{
                        id: user.id,
                        username: user.user_metadata.full_name || 'Agente',
                        avatar_url: user.user_metadata.avatar_url || 'https://i.pravatar.cc/150',
                        xp: 0, // Will be fetched by modal
                        rank: 0, // Will be fetched by modal
                        banner_url: undefined
                    }}
                    onClose={() => setShowProfile(false)}
                />
            )}

            {/* Radar Pulse CSS Style */}
            <style>{`
                @keyframes scan {
                    0% { left: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { left: 100%; opacity: 0; }
                }
                @keyframes pulse-ring {
                    0% { transform: scale(0.8); opacity: 0.5; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
            `}</style>

            <Map
                defaultCenter={defaultPosition}
                defaultZoom={13}
                className="w-full h-full"
                disableDefaultUI={true}
                zoomControl={false} // Clean immersive view
                mapId="4504f8b37365c3d0"
                styles={[
                    {
                        "featureType": "all",
                        "elementType": "labels.text.fill",
                        "stylers": [{ "saturation": 36 }, { "color": "#000000" }, { "lightness": 40 }]
                    },
                    {
                        "featureType": "all",
                        "elementType": "labels.text.stroke",
                        "stylers": [{ "visibility": "on" }, { "color": "#000000" }, { "lightness": 16 }]
                    },
                    {
                        "featureType": "all",
                        "elementType": "labels.icon",
                        "stylers": [{ "visibility": "off" }]
                    },
                    {
                        "featureType": "administrative",
                        "elementType": "geometry.fill",
                        "stylers": [{ "color": "#000000" }, { "lightness": 20 }]
                    },
                    {
                        "featureType": "administrative",
                        "elementType": "geometry.stroke",
                        "stylers": [{ "color": "#000000" }, { "lightness": 17 }, { "weight": 1.2 }]
                    },
                    {
                        "featureType": "landscape",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#000000" }, { "lightness": 20 }]
                    },
                    {
                        "featureType": "poi",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#000000" }, { "lightness": 21 }]
                    },
                    {
                        "featureType": "road.highway",
                        "elementType": "geometry.fill",
                        "stylers": [{ "color": "#000000" }, { "lightness": 17 }]
                    },
                    {
                        "featureType": "road.highway",
                        "elementType": "geometry.stroke",
                        "stylers": [{ "color": "#000000" }, { "lightness": 29 }, { "weight": 0.2 }]
                    },
                    {
                        "featureType": "road.arterial",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#000000" }, { "lightness": 18 }]
                    },
                    {
                        "featureType": "road.local",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#000000" }, { "lightness": 16 }]
                    },
                    {
                        "featureType": "transit",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#000000" }, { "lightness": 19 }]
                    },
                    {
                        "featureType": "water",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#0f172a" }, { "lightness": 17 }]
                    }
                ]}
            >
                {/* User Current Location Radar */}
                {userLocation && (
                    <AdvancedMarker position={{ lat: userLocation.lat, lng: userLocation.lng }}>
                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 w-4 h-4 bg-blue-500 rounded-full animate-ping opacity-75"></div>
                            <div className="relative w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-[0_0_15px_rgba(37,99,235,0.8)] z-10"></div>
                            <div className="absolute inset-0 w-full h-full border border-blue-500/50 rounded-full animate-[pulse-ring_2s_cubic-bezier(0.215,0.61,0.355,1)_infinite]"></div>
                        </div>
                    </AdvancedMarker>
                )}

                {displayGyms.map((gym, index) => (
                    <AdvancedMarker
                        key={gym.id}
                        position={{ lat: gym.lat, lng: gym.lng }}
                        className={`transition-all duration-500 hover:scale-110 z-10`}
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => setSelectedGym(gym)}
                    >
                        {gym.is_unlocked ? (
                            <div className="relative group flex flex-col items-center">
                                <div className={`w-9 h-9 ${gym.is_home_base ? 'bg-yellow-500 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)] text-black' : 'bg-blue-600 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.6)] text-white'} rounded-full border-2 flex items-center justify-center transition-all duration-300 hover:scale-110 cursor-pointer`}>
                                    <MapPin size={16} strokeWidth={2.5} />
                                </div>
                                <div className={`w-2 h-2 ${gym.is_home_base ? 'bg-yellow-400' : 'bg-blue-400'} rotate-45 -mt-1`}></div>

                                {gym.is_home_base && <div className="absolute -top-7 bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-wider animate-bounce">SEDE</div>}
                                {(gym.favorites_count && gym.favorites_count > 0) ? (
                                    <div className={`absolute ${gym.is_home_base ? '-top-12' : '-top-7'} bg-neutral-900 border border-red-500 text-red-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-20 transition-all group-hover:scale-110`}>
                                        <Heart size={10} fill="currentColor" /> {gym.favorites_count}
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="relative group flex flex-col items-center">
                                <div className={`w-9 h-9 bg-neutral-950/95 backdrop-blur-md rounded-full border-2 ${tutorialStep === 5 ? 'border-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.6)]' : 'border-neutral-700 shadow-[0_0_12px_rgba(0,0,0,0.6)]'} flex items-center justify-center transition-all duration-300 hover:scale-110 cursor-pointer`}>
                                    <Lock size={14} className={tutorialStep === 5 ? 'text-yellow-500 animate-pulse' : 'text-neutral-400'} />
                                </div>
                                <div className={`w-2 h-2 ${tutorialStep === 5 ? 'bg-yellow-500' : 'bg-neutral-700'} rotate-45 -mt-1`}></div>
                                
                                {(gym.favorites_count && gym.favorites_count > 0) ? (
                                    <div className="absolute -top-7 bg-neutral-900 border border-red-500 text-red-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-20 transition-all group-hover:scale-110">
                                        <Heart size={10} fill="currentColor" /> {gym.favorites_count}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </AdvancedMarker>
                ))}
            </Map>

            {/* Unlock/Enter Modal - CEO Glassmorphism Upgrade */}
            {selectedGym && (
                <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-0 pb-32 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-neutral-900/90 border-t sm:border border-white/10 w-full max-w-sm sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-10 duration-300 relative">

                        {/* Decorative Top Line */}
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full sm:hidden"></div>

                        {selectedGym.photoUrl ? (
                            <div className="h-48 w-full relative">
                                <img src={selectedGym.photoUrl} alt={selectedGym.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/50 to-transparent"></div>
                                <div className="absolute bottom-4 left-6">
                                    <h3 className="text-2xl font-black text-white leading-none tracking-tight uppercase italic dropshadow-lg line-clamp-2">{selectedGym.name}</h3>
                                    {selectedGym.rating && (
                                        <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold mt-1">
                                            <Star size={12} fill="currentColor" />
                                            <span>{selectedGym.rating} / 5.0</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-32 w-full bg-gradient-to-br from-neutral-800 to-black relative flex items-end p-6">
                                <div>
                                    <h3 className="text-2xl font-black text-white leading-none tracking-tight uppercase italic line-clamp-2">{selectedGym.name}</h3>
                                    <p className="text-neutral-500 text-xs font-bold mt-1">Gimnasio Desconocido</p>
                                </div>
                            </div>
                        )}

                        <div className="p-6 pt-2 relative space-y-6">
                            {/* Close Button */}
                            <button
                                onClick={() => setSelectedGym(null)}
                                className="absolute top-4 right-4 z-10 bg-black/40 backdrop-blur p-2 rounded-full text-white/70 hover:text-white border border-white/5 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg shrink-0 ${selectedGym.is_unlocked ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-800/50 text-gym-primary'}`}>
                                        {selectedGym.is_unlocked ? <div className="w-5 h-5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_#3b82f6]"></div> : <Lock size={20} />}
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold text-sm">{selectedGym.is_unlocked ? 'Territorio Conquistado' : 'Territorio Bloqueado'}</h4>
                                        <p className="text-neutral-400 text-xs leading-relaxed mt-1">
                                            {selectedGym.address || 'Ubicación remota.'}
                                        </p>
                                    </div>
                                </div>

                                {selectedGym.is_unlocked ? (
                                    <>
                                        <button
                                            onClick={() => navigate(`/territory/${selectedGym.id}`)}
                                            className="w-full bg-blue-600 text-white font-black text-lg italic py-4 rounded-2xl hover:bg-blue-500 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                                        >
                                            ENTRAR AL TERRITORIO
                                        </button>

                                        {/* Set Home Base Option */}
                                        {selectedGym.is_home_base ? (
                                            <div className="flex items-center justify-center gap-2 py-2 text-yellow-500 font-bold text-xs uppercase tracking-widest bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                                                <Star size={12} fill="currentColor" />
                                                Actualmente Sede Principal
                                            </div>
                                        ) : (
                                            <button
                                                onClick={handleSetHomeBase}
                                                className="w-full py-3 text-neutral-400 font-bold text-xs uppercase tracking-widest hover:text-white hover:bg-white/5 rounded-xl transition-all flex items-center justify-center gap-2"
                                            >
                                                <Star size={12} />
                                                Establecer como Principal
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <button
                                        onClick={handleUnlock}
                                        className="w-full bg-gym-primary text-black font-black text-lg italic py-4 rounded-2xl hover:bg-yellow-400 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.3)] bg-neutral-800"
                                        id="tut-add-gym-btn"
                                    >
                                        <Lock size={20} strokeWidth={2.5} />
                                        AÑADIR A MI MAPA
                                    </button>
                                )}

                                {/* FAVORITE SECTION (Always Visible) */}
                                {selectedGym.id && (
                                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs text-neutral-400">
                                            <Heart size={14} className={isFavorite ? "text-red-500 fill-red-500" : ""} />
                                            <span>{favoriteCount} {favoriteCount === 1 ? 'persona lo prefiere' : 'personas lo prefieren'}</span>
                                        </div>
                                        <button 
                                            onClick={handleToggleFavorite}
                                            className={`p-2 rounded-full border transition-all ${isFavorite ? 'bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                                            title={isFavorite ? "Quitar de Favoritos" : "Añadir a Favoritos"}
                                        >
                                            <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
                                        </button>
                                    </div>
                                )}

                                {selectedGym.lat && userLocation && getDistance(userLocation.lat, userLocation.lng, selectedGym.lat, selectedGym.lng) > 0.16 && !selectedGym.is_unlocked && (
                                    <p className="text-red-500 text-xs text-center font-bold mt-2">
                                        ⛔ A {getDistance(userLocation.lat, userLocation.lng, selectedGym.lat, selectedGym.lng).toFixed(2)}km (Max 0.16km)
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend Overlay - Tactical Footer (Moved to bottom to avoid HUD overlap) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 sm:left-6 sm:translate-x-0 bg-black/60 backdrop-blur-xl px-6 py-2.5 rounded-2xl border border-white/10 z-20 flex items-center justify-center gap-6 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-2 group cursor-help transition-all hover:scale-105">
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)] animate-pulse"></div>
                    <span className="text-[10px] md:text-xs font-bold text-neutral-200 uppercase tracking-widest group-hover:text-yellow-400 transition-colors">GYM PRINCIPAL</span>
                </div>
                <div className="w-px h-4 bg-white/10"></div>
                <div className="flex items-center gap-2 group cursor-help transition-all hover:scale-105">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                    <span className="text-[10px] md:text-xs font-bold text-neutral-200 uppercase tracking-widest group-hover:text-blue-400 transition-colors">DESBLOQUEADOS</span>
                </div>
                <div className="w-px h-4 bg-white/10"></div>
                <div className="flex items-center gap-2 group cursor-help transition-all hover:scale-105">
                    <Lock size={12} className="text-neutral-500 group-hover:text-white transition-colors" />
                    <span className="text-[10px] md:text-xs font-bold text-neutral-500 uppercase tracking-widest group-hover:text-white transition-colors">BLOQUEADOS</span>
                </div>
            </div>
            {tutorialStep === 5 && !selectedGym && (
                <InteractiveOverlay
                    targetId="tut-map-search-input"
                    title="PASO 5: BÚSQUEDA TÁCTICA"
                    message="Usa el radar para localizar tu gimnasio. Escribe el nombre (Ej: Spartanos)."
                    step={5}
                    totalSteps={7}
                    onClose={() => { }}
                    disableNext={true}
                    placement="top"
                    nonBlocking={true}
                />
            )}

            {tutorialStep === 5 && selectedGym && !selectedGym.is_unlocked && (
                <InteractiveOverlay
                    targetId="tut-add-gym-btn"
                    title="CONQUISTA EL TERRITORIO"
                    message="¡Excelente hallazgo! Añádelo a tu mapa para comenzar tu entrenamiento."
                    step={5}
                    totalSteps={7}
                    onClose={() => { }}
                    disableNext={true}
                    placement="top"
                    nonBlocking={true}
                />
            )}
        </div >
    );
};
