/// <reference types="google.maps" />
import { Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { InteractiveOverlay } from '../onboarding/InteractiveOverlay';
import { userService } from '../../services/UserService';
import { notificationService } from '../../services/NotificationService';
import { haversineDistance, isAccuracyUsable } from '../../utils/geolocationUtils';
import type { UserPrimaryGym } from '../../services/UserService';
import { useNavigate } from 'react-router-dom';
import { Lock, Star, Search, Loader, MapPin, Heart, Crosshair, Dumbbell, X, Navigation } from 'lucide-react';
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
    const { location: userLocation, loading: gpsLoading, error: gpsError } = useGeolocation();
    const [hasCenteredOnce, setHasCenteredOnce] = useState(false);

    useEffect(() => {
        // Only center on FRESH positions (not stale cache from previous sessions)
        if (userLocation?.isFresh && map && !hasCenteredOnce) {
            map.panTo({ lat: userLocation.lat, lng: userLocation.lng });
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
            alert('⛔ Activa tu ubicación GPS para desbloquear un gimnasio.');
            return;
        }

        if (!userLocation.isFresh) {
            alert('⏳ Esperando señal GPS fresca. Espera unos segundos e intenta de nuevo.');
            return;
        }

        const distMeters = haversineDistance(userLocation.lat, userLocation.lng, selectedGym.lat, selectedGym.lng);

        // 90m base + small GPS accuracy margin for indoor drift (max 150m total)
        const accuracyMargin = userLocation.accuracy > 30 ? Math.min(60, userLocation.accuracy * 0.5) : 0;
        const threshold = Math.min(150, 90 + accuracyMargin);

        if (distMeters > threshold) {
            const distDisplay = distMeters >= 1000
                ? `${(distMeters / 1000).toFixed(1)}km`
                : `${Math.round(distMeters)}m`;
            alert(`⛔ Debes estar a ≤90m del gimnasio para desbloquearlo.\nDistancia actual: ${distDisplay}`);
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

        // Regla de unicidad: el predeterminado es permanente — para cambiarlo,
        // el usuario debe primero quitar el actual (no se permite "saltar" directo a otro).
        const currentDefault = userGyms.find(g => g.is_home_base && g.gym_id !== selectedGym!.id);
        if (currentDefault) {
            alert(`Ya tienes "${currentDefault.gym_name}" como Sede Principal. Quítala primero desde tu perfil para poder elegir otra.`);
            return;
        }

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
            const userName = user.user_metadata?.full_name || user.user_metadata?.username || 'Un Guerrero';
            await notificationService.notifyGymMembers(selectedGym.id, user.id, userName, selectedGym.name);
        } else {
            alert('Error al establecer sede: ' + result.error);
        }
    };

    const handleToggleFavorite = async () => {
        // spec §1.5: el "me gusta" solo aplica a gimnasios ya visitados (Mis Gimnasios)
        if (!selectedGym || !user || !selectedGym.id || !selectedGym.is_unlocked) return;

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
            if (selectedGym && selectedGym.id && selectedGym.is_unlocked && user) {
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



    // Fly back to the user's position with a smooth zoom
    const recenterOnUser = () => {
        if (!map || !userLocation) return;
        map.panTo({ lat: userLocation.lat, lng: userLocation.lng });
        map.setZoom(16);
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

    if (gpsError && !userLocation) {
        return (
            <div className="w-full h-[calc(100vh-100px)] flex flex-col items-center justify-center bg-neutral-950 text-white p-8 gap-6">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                    <MapPin size={28} className="text-red-400" />
                </div>
                <div className="text-center flex flex-col gap-2">
                    <h2 className="text-lg font-black uppercase italic tracking-tight">Ubicación desactivada</h2>
                    <p className="text-neutral-400 text-sm leading-relaxed max-w-xs">
                        Para ver tu gimnasio y los que están cerca, GINX necesita acceso a tu ubicación.
                    </p>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 w-full max-w-xs flex flex-col gap-2 text-sm text-neutral-300">
                    <p className="font-black text-white text-xs uppercase tracking-wide mb-1">Cómo activarlo:</p>
                    <p>1. Ve a <span className="text-gym-primary font-bold">Ajustes</span> de tu teléfono</p>
                    <p>2. Busca <span className="text-gym-primary font-bold">Aplicaciones → GINX</span></p>
                    <p>3. Activa el permiso de <span className="text-gym-primary font-bold">Ubicación</span></p>
                    <p>4. Regresa a la app</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-[calc(100vh-100px)] md:h-[calc(100vh-120px)] rounded-none md:rounded-3xl overflow-hidden shadow-2xl border-0 md:border border-neutral-800 relative bg-neutral-900 group">

            {/* ── HUD: floating search capsule ─────────────────────────── */}
            <div className="absolute top-0 left-0 w-full p-4 z-20 pointer-events-none flex flex-col items-center justify-start">
                <div className="mt-1.5 w-full max-w-sm mx-auto pointer-events-auto relative gmap-rise" style={{ animationDelay: '80ms' }}>
                    <div className="relative group/search">
                        {/* glow aura on focus */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400/0 via-yellow-400/25 to-yellow-400/0 rounded-full blur-md opacity-0 group-focus-within/search:opacity-100 transition-opacity duration-500 pointer-events-none" />
                        <div className="relative flex items-center bg-neutral-950/85 backdrop-blur-2xl border border-white/10 group-focus-within/search:border-yellow-400/60 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-300 overflow-hidden" id="tut-map-search-input">
                            <Search size={15} className="absolute left-4 text-neutral-500 group-focus-within/search:text-yellow-400 transition-colors duration-300" />
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
                                    if (e.key === 'Escape') setShowSuggestions(false);
                                }}
                                onFocus={() => {
                                    if (suggestions.length > 0) setShowSuggestions(true);
                                }}
                                className="flex-1 bg-transparent pl-11 pr-2 py-2.5 text-white placeholder-neutral-500 focus:outline-none text-[16px] min-w-0"
                            />
                            <button
                                onClick={() => handleSearch()}
                                disabled={isSearching || !searchQuery.trim()}
                                className="m-1 shrink-0 bg-gradient-to-r from-yellow-400 to-amber-500 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-600 text-black font-black w-9 h-9 rounded-full transition-all duration-300 flex items-center justify-center shadow-[0_0_14px_rgba(250,204,21,0.4)] disabled:shadow-none hover:scale-105 active:scale-90"
                            >
                                {isSearching ? <Loader size={14} className="animate-spin" /> : <Navigation size={14} strokeWidth={2.5} />}
                            </button>
                        </div>

                        {/* Autocomplete Suggestions Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.85)] z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                                {suggestions.map((suggestion, sIdx) => (
                                    <button
                                        key={suggestion.place_id}
                                        onClick={() => {
                                            setSearchQuery(suggestion.structured_formatting.main_text);
                                            handleSearch(suggestion.structured_formatting.main_text);
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-yellow-400/5 active:bg-yellow-400/10 transition-colors border-b border-white/5 last:border-b-0 group gmap-rise"
                                        style={{ animationDelay: `${sIdx * 50}ms` }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center shrink-0 group-hover:bg-yellow-400/25 group-hover:scale-110 transition-all duration-300">
                                                <MapPin size={13} className="text-yellow-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-bold text-xs truncate group-hover:text-yellow-400 transition-colors">
                                                    {suggestion.structured_formatting.main_text}
                                                </div>
                                                <div className="text-[10px] text-neutral-500 truncate">
                                                    {suggestion.structured_formatting.secondary_text}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>



            {/* PROFILE DRAWER */}
            {showProfile && user && (
                <PlayerProfileModal
                    player={{
                        id: user.id,
                        username: user.user_metadata.full_name || 'Guerrero',
                        avatar_url: user.user_metadata.avatar_url || 'https://i.pravatar.cc/150',
                        xp: 0, // Will be fetched by modal
                        rank: 0, // Will be fetched by modal
                        banner_url: undefined
                    }}
                    onClose={() => setShowProfile(false)}
                />
            )}

            {/* ── Map FX keyframes ─────────────────────────────────────── */}
            <style>{`
                @keyframes gmapRing {
                    0%   { transform: scale(0.5); opacity: 0.65; }
                    100% { transform: scale(3.2); opacity: 0; }
                }
                @keyframes gmapDrop {
                    0%   { transform: translateY(-26px) scale(0.4); opacity: 0; }
                    60%  { transform: translateY(3px) scale(1.08); opacity: 1; }
                    100% { transform: translateY(0) scale(1); opacity: 1; }
                }
                @keyframes gmapFloat {
                    0%, 100% { transform: translateY(0); }
                    50%      { transform: translateY(-4px); }
                }
                @keyframes gmapSpin {
                    to { transform: rotate(360deg); }
                }
                @keyframes gmapGlow {
                    0%, 100% { box-shadow: 0 0 10px rgba(250,204,21,0.45); }
                    50%      { box-shadow: 0 0 26px rgba(250,204,21,0.85); }
                }
                @keyframes gmapRise {
                    from { transform: translateY(-12px); opacity: 0; }
                    to   { transform: translateY(0); opacity: 1; }
                }
                @keyframes gmapSheet {
                    from { transform: translateY(70px); opacity: 0; }
                    to   { transform: translateY(0); opacity: 1; }
                }
                @keyframes gmapShimmer {
                    0%   { background-position: 140% 0; }
                    60%  { background-position: -60% 0; }
                    100% { background-position: -60% 0; }
                }
                @keyframes gmapKen {
                    from { transform: scale(1); }
                    to   { transform: scale(1.12); }
                }
                .gmap-rise  { animation: gmapRise 0.5s cubic-bezier(0.22,1,0.36,1) both; }
                .gmap-drop  { animation: gmapDrop 0.55s cubic-bezier(0.34,1.56,0.64,1) both; }
                .gmap-sheet { animation: gmapSheet 0.45s cubic-bezier(0.22,1,0.36,1) both; }
                .gmap-shimmer {
                    background: linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.25) 50%, transparent 58%);
                    background-size: 220% 100%;
                    animation: gmapShimmer 2.6s ease-in-out infinite;
                }
            `}</style>

            <Map
                defaultCenter={defaultPosition}
                defaultZoom={13}
                className="w-full h-full"
                disableDefaultUI={true}
                zoomControl={false} // Clean immersive view
                mapId="4504f8b37365c3d0"
                // With a mapId, inline `styles` are IGNORED by Google Maps — the
                // dark look must come from colorScheme (or cloud style config).
                colorScheme={'DARK' as any}
            >
                {/* ── User location: living radar ─────────────────────── */}
                {userLocation && (
                    <AdvancedMarker position={{ lat: userLocation.lat, lng: userLocation.lng }}>
                        <div className="relative flex items-center justify-center w-6 h-6">
                            {/* triple staggered radar rings */}
                            <div className="absolute inset-0 rounded-full bg-sky-400/40" style={{ animation: 'gmapRing 2.4s cubic-bezier(0.215,0.61,0.355,1) infinite' }} />
                            <div className="absolute inset-0 rounded-full bg-sky-400/30" style={{ animation: 'gmapRing 2.4s cubic-bezier(0.215,0.61,0.355,1) 0.8s infinite' }} />
                            <div className="absolute inset-0 rounded-full bg-sky-400/20" style={{ animation: 'gmapRing 2.4s cubic-bezier(0.215,0.61,0.355,1) 1.6s infinite' }} />
                            {/* gradient core */}
                            <div className="relative w-5 h-5 rounded-full bg-gradient-to-br from-sky-300 to-blue-600 border-[2.5px] border-white shadow-[0_0_18px_rgba(56,189,248,0.9)] z-10 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-white/90" />
                            </div>
                        </div>
                    </AdvancedMarker>
                )}

                {/* ── Gym markers ───────────────────────────────────────── */}
                {displayGyms.map((gym, index) => (
                    <AdvancedMarker
                        key={gym.id}
                        position={{ lat: gym.lat, lng: gym.lng }}
                        onClick={() => setSelectedGym(gym)}
                    >
                        <div className="gmap-drop" style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}>
                            {gym.is_unlocked ? (
                                <div className="relative flex flex-col items-center cursor-pointer group" style={gym.is_home_base ? { animation: 'gmapFloat 3s ease-in-out infinite' } : undefined}>
                                    {/* SEDE crown tag */}
                                    {gym.is_home_base && (
                                        <div className="absolute -top-7 bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-[0_2px_12px_rgba(250,204,21,0.6)] uppercase tracking-widest z-30 flex items-center gap-1">
                                            <Star size={8} fill="currentColor" /> SEDE
                                        </div>
                                    )}
                                    <div className="relative">
                                        {/* rotating conic ring for home base */}
                                        {gym.is_home_base && (
                                            <div className="absolute -inset-1.5 rounded-full opacity-80" style={{
                                                background: 'conic-gradient(from 0deg, transparent 0%, rgba(250,204,21,0.9) 18%, transparent 40%)',
                                                animation: 'gmapSpin 3.2s linear infinite'
                                            }} />
                                        )}
                                        <div
                                            className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-transform duration-300 group-hover:scale-125 group-active:scale-95 ${gym.is_home_base
                                                ? 'bg-gradient-to-br from-yellow-300 to-amber-500 border-yellow-200 text-black'
                                                : 'bg-gradient-to-br from-sky-400 to-blue-700 border-sky-300 text-white shadow-[0_0_16px_rgba(59,130,246,0.65)]'
                                            }`}
                                            style={gym.is_home_base ? { animation: 'gmapGlow 2.4s ease-in-out infinite' } : undefined}
                                        >
                                            <Dumbbell size={17} strokeWidth={2.5} />
                                        </div>
                                        {(gym.favorites_count && gym.favorites_count > 0) ? (
                                            <div className="absolute -top-1.5 -right-2.5 bg-neutral-950/95 border border-red-500/60 text-red-400 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-[0_2px_10px_rgba(239,68,68,0.4)] flex items-center gap-0.5 z-20">
                                                <Heart size={8} fill="currentColor" className="shrink-0" />
                                                <span>{gym.favorites_count}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                    {/* stem */}
                                    <div className={`w-2 h-2 rotate-45 -mt-1 ${gym.is_home_base ? 'bg-amber-500' : 'bg-blue-600'}`} />
                                    <div className="w-4 h-1 rounded-full bg-black/50 blur-[2px] mt-0.5" />
                                </div>
                            ) : (
                                <div className="relative flex flex-col items-center cursor-pointer group">
                                    <div className="relative">
                                        <div className={`relative w-9 h-9 rounded-full border-2 flex items-center justify-center overflow-hidden backdrop-blur-md transition-transform duration-300 group-hover:scale-125 group-active:scale-95 ${tutorialStep === 5
                                            ? 'bg-neutral-950/95 border-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.6)]'
                                            : 'bg-neutral-950/90 border-neutral-700 shadow-[0_4px_14px_rgba(0,0,0,0.7)]'
                                        }`}>
                                            <div className="absolute inset-0 gmap-shimmer opacity-30" />
                                            <Lock size={14} className={tutorialStep === 5 ? 'text-yellow-400 animate-pulse' : 'text-neutral-400'} />
                                        </div>
                                        {(gym.favorites_count && gym.favorites_count > 0) ? (
                                            <div className="absolute -top-1.5 -right-2.5 bg-neutral-950/95 border border-red-500/60 text-red-400 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-[0_2px_10px_rgba(239,68,68,0.4)] flex items-center gap-0.5 z-20">
                                                <Heart size={8} fill="currentColor" className="shrink-0" />
                                                <span>{gym.favorites_count}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className={`w-2 h-2 rotate-45 -mt-1 ${tutorialStep === 5 ? 'bg-yellow-400' : 'bg-neutral-700'}`} />
                                    <div className="w-4 h-1 rounded-full bg-black/50 blur-[2px] mt-0.5" />
                                </div>
                            )}
                        </div>
                    </AdvancedMarker>
                ))}
            </Map>

            {/* ── Locate-me FAB ─────────────────────────────────────────── */}
            {userLocation && (
                <button
                    onClick={recenterOnUser}
                    className="absolute bottom-24 right-4 z-20 w-12 h-12 rounded-2xl bg-neutral-950/85 backdrop-blur-xl border border-white/10 text-sky-400 flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.6)] hover:border-sky-400/60 hover:text-sky-300 hover:scale-110 active:scale-90 transition-all duration-300 gmap-rise"
                    style={{ animationDelay: '200ms' }}
                    aria-label="Centrar en mi ubicación"
                >
                    <Crosshair size={20} strokeWidth={2.5} />
                </button>
            )}

            {/* ── Gym bottom sheet ──────────────────────────────────────── */}
            {selectedGym && (
                <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-0 pb-28 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedGym(null)}>
                    <div className="gmap-sheet bg-neutral-950 border-t sm:border border-white/10 w-full max-w-sm sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-[0_-20px_80px_rgba(0,0,0,0.9)] relative" onClick={e => e.stopPropagation()}>

                        {/* Drag handle */}
                        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/25 rounded-full sm:hidden z-20"></div>

                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedGym(null)}
                            className="absolute top-3.5 right-3.5 z-20 bg-black/60 backdrop-blur-xl p-2 rounded-full text-white/70 hover:text-white border border-white/10 hover:scale-110 active:scale-90 transition-all"
                        >
                            <X size={16} />
                        </button>

                        {/* Header: photo with ken-burns, or gradient */}
                        {selectedGym.photoUrl ? (
                            <div className="h-44 w-full relative overflow-hidden">
                                <img src={selectedGym.photoUrl} alt={selectedGym.name} className="w-full h-full object-cover" style={{ animation: 'gmapKen 9s ease-out forwards' }} />
                                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent"></div>
                                <div className="absolute bottom-3 left-5 right-5 gmap-rise" style={{ animationDelay: '120ms' }}>
                                    <h3 className="text-2xl font-black text-white leading-none tracking-tight uppercase italic drop-shadow-lg line-clamp-2">{selectedGym.name}</h3>
                                    {selectedGym.rating && (
                                        <div className="flex items-center gap-1 text-yellow-400 text-xs font-bold mt-1.5">
                                            <Star size={11} fill="currentColor" />
                                            <span>{selectedGym.rating} / 5.0</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-28 w-full relative flex items-end p-5 overflow-hidden bg-gradient-to-br from-neutral-900 to-black">
                                <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl ${selectedGym.is_unlocked ? 'bg-blue-600/20' : 'bg-yellow-500/10'}`} />
                                <div className="gmap-rise" style={{ animationDelay: '120ms' }}>
                                    <h3 className="text-2xl font-black text-white leading-none tracking-tight uppercase italic line-clamp-2">{selectedGym.name}</h3>
                                </div>
                            </div>
                        )}

                        <div className="p-5 pt-3 relative space-y-4">
                            {/* Status + address + distance chips */}
                            <div className="flex flex-wrap items-center gap-1.5 gmap-rise" style={{ animationDelay: '180ms' }}>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${selectedGym.is_unlocked
                                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                                    : 'bg-neutral-900 border-neutral-700 text-neutral-400'
                                }`}>
                                    {selectedGym.is_unlocked
                                        ? <><span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> Conquistado</>
                                        : <><Lock size={9} /> Bloqueado</>}
                                </span>
                                {selectedGym.lat && userLocation && (() => {
                                    const dist = haversineDistance(userLocation.lat, userLocation.lng, selectedGym.lat, selectedGym.lng);
                                    const distDisplay = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
                                    return (
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${!selectedGym.is_unlocked && dist > 90
                                            ? 'bg-red-500/10 border-red-500/40 text-red-400'
                                            : 'bg-white/5 border-white/10 text-neutral-300'
                                        }`}>
                                            <MapPin size={9} /> {distDisplay}
                                        </span>
                                    );
                                })()}
                                {selectedGym.id && selectedGym.is_unlocked && favoriteCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-500/10 border border-red-500/30 text-red-400">
                                        <Heart size={9} fill="currentColor" /> {favoriteCount}
                                    </span>
                                )}
                            </div>

                            {selectedGym.address && (
                                <p className="text-neutral-500 text-xs leading-relaxed gmap-rise" style={{ animationDelay: '220ms' }}>{selectedGym.address}</p>
                            )}

                            <div className="space-y-2.5 gmap-rise" style={{ animationDelay: '260ms' }}>
                                {selectedGym.is_unlocked ? (
                                    <>
                                        <button
                                            onClick={() => navigate(`/territory/${selectedGym.id}`)}
                                            className="relative w-full bg-gradient-to-r from-blue-600 to-sky-500 text-white font-black text-base italic py-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.97] flex items-center justify-center gap-2 shadow-[0_8px_28px_rgba(37,99,235,0.45)] overflow-hidden"
                                        >
                                            <div className="absolute inset-0 gmap-shimmer" />
                                            <Dumbbell size={18} strokeWidth={2.5} />
                                            ENTRAR AL TERRITORIO
                                        </button>

                                        <div className="flex gap-2">
                                            {selectedGym.is_home_base ? (
                                                <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-yellow-400 font-black text-[10px] uppercase tracking-widest bg-yellow-500/10 rounded-xl border border-yellow-500/25">
                                                    <Star size={11} fill="currentColor" />
                                                    Sede Principal
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleSetHomeBase}
                                                    className="flex-1 py-2.5 text-neutral-400 font-black text-[10px] uppercase tracking-widest hover:text-yellow-400 bg-white/[0.03] hover:bg-yellow-500/5 rounded-xl border border-white/10 hover:border-yellow-500/30 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                                >
                                                    <Star size={11} />
                                                    Hacer Sede
                                                </button>
                                            )}
                                            {/* FAVORITE — spec §1.5: only for already-visited gyms */}
                                            {selectedGym.id && (
                                                <button
                                                    onClick={handleToggleFavorite}
                                                    className={`w-11 flex items-center justify-center rounded-xl border transition-all active:scale-90 ${isFavorite
                                                        ? 'bg-red-500/15 border-red-500/50 text-red-400'
                                                        : 'bg-white/[0.03] border-white/10 text-neutral-400 hover:text-red-400 hover:border-red-500/30'
                                                    }`}
                                                    title={isFavorite ? 'Quitar de Favoritos' : 'Añadir a Favoritos'}
                                                >
                                                    <Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'animate-in zoom-in-50 duration-300' : ''} />
                                                </button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <button
                                        onClick={handleUnlock}
                                        className="relative w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-base italic py-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.97] flex items-center justify-center gap-2 shadow-[0_8px_28px_rgba(250,204,21,0.4)] overflow-hidden"
                                        id="tut-add-gym-btn"
                                    >
                                        <div className="absolute inset-0 gmap-shimmer" />
                                        <Lock size={18} strokeWidth={2.5} />
                                        AÑADIR A MI MAPA
                                    </button>
                                )}

                                {selectedGym.lat && userLocation && (() => {
                                    const dist = haversineDistance(userLocation.lat, userLocation.lng, selectedGym.lat, selectedGym.lng);
                                    const accuracyTag = !userLocation.isFresh
                                        ? ' · GPS en caché'
                                        : !isAccuracyUsable(userLocation.accuracy)
                                        ? ` · GPS débil (±${Math.round(userLocation.accuracy)}m)`
                                        : '';
                                    if (!selectedGym.is_unlocked && dist > 90) {
                                        return (
                                            <p className="text-red-400/90 text-[10px] text-center font-bold">
                                                Acércate a menos de 90 m para desbloquearlo{accuracyTag}
                                            </p>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Legend: glass chip card ───────────────────────────────── */}
            <div className="absolute top-[64px] right-3 z-20 select-none pointer-events-none gmap-rise" style={{ animationDelay: '160ms' }}>
                <div className="bg-neutral-950/70 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2.5 flex flex-col gap-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-2 justify-end">
                        <span className="text-[8px] font-black text-yellow-400 uppercase tracking-widest">Sede</span>
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-[0_0_8px_rgba(250,204,21,0.9)] animate-pulse"></div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        <span className="text-[8px] font-black text-sky-300 uppercase tracking-widest">Conquistado</span>
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.9)]"></div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Bloqueado</span>
                        <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-600 flex items-center justify-center">
                            <Lock size={6} className="text-neutral-500" />
                        </div>
                    </div>
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
