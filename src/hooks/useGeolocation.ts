import { useState, useEffect } from 'react';

export interface Location {
    lat: number;
    lng: number;
    accuracy?: number;
    heading?: number | null;
    speed?: number | null;
    timestamp: number;
}

interface GeolocationState {
    location: Location | null;
    error: string | null;
    loading: boolean;
}

const STORAGE_KEY = 'gympartner_last_known_location';

export const useGeolocation = (enableHighAccuracy = true) => {
    const [state, setState] = useState<GeolocationState>(() => {
        // Initialize from localStorage if available (Last Known Position)
        const saved = localStorage.getItem(STORAGE_KEY);
        return {
            location: saved ? JSON.parse(saved) : null,
            error: null,
            loading: true,
        };
    });

    useEffect(() => {
        if (!navigator.geolocation) {
            setState(prev => ({ ...prev, error: 'Geolocation not supported', loading: false }));
            return;
        }

        const successHandler = (position: GeolocationPosition) => {
            const newLocation: Location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
                timestamp: position.timestamp
            };
            
            setState({
                location: newLocation,
                error: null,
                loading: false,
            });

            // Persist for future sessions (Remembering the user's choice/location)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocation));
        };

        const errorHandler = (error: GeolocationPositionError) => {
            console.warn(`[GEOLOCATION] Error: ${error.message}`);
            setState(prev => ({ ...prev, error: error.message, loading: false }));
        };

        const options = {
            enableHighAccuracy,
            timeout: 10000,
            maximumAge: 5000, // Accept cached location up to 5s old
        };

        // Check if we already have permissions (modern browsers)
        if ('permissions' in navigator) {
            navigator.permissions.query({ name: 'geolocation' as any }).then((result) => {
                if (result.state === 'denied') {
                    setState(prev => ({ ...prev, error: 'Permiso de ubicación denegado.', loading: false }));
                    return;
                }
                
                // If granted or prompt, start watching
                const watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);
                return () => navigator.geolocation.clearWatch(watchId);
            });
        } else {
            // Fallback for older browsers
            const watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);
            return () => navigator.geolocation.clearWatch(watchId);
        }
    }, [enableHighAccuracy]);

    return state;
};
