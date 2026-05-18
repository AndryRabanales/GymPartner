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
            loading: saved ? false : true, // INSTANT LOAD: If we have a cache, don't show loading
        };
    });

    useEffect(() => {
        if (!navigator.geolocation) {
            setState(prev => ({ ...prev, error: 'Geolocation not supported', loading: false }));
            return;
        }

        let watchId: number | null = null;

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
            setState(prev => {
                // Keep the cached/last known location on timeout
                if (error.code === error.TIMEOUT && prev.location) {
                    return { ...prev, loading: false };
                }
                return { ...prev, error: error.message, loading: false };
            });
        };

        const options = {
            enableHighAccuracy,
            timeout: 10000, // Increased to 10s to ensure reliable locks indoors and on slower devices
            maximumAge: 30000, // Accept cached location up to 30s old to speed up loading
        };

        // Start watching position
        if ('permissions' in navigator) {
            navigator.permissions.query({ name: 'geolocation' as any }).then((result) => {
                if (result.state === 'denied') {
                    setState(prev => ({ ...prev, error: 'Permiso de ubicación denegado.', loading: false }));
                    return;
                }
                
                // If granted or prompt, start watching
                watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);
            }).catch(() => {
                // If query fails, fall back to direct watch
                watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);
            });
        } else {
            // Fallback for older browsers
            watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);
        }

        // Return proper React cleanup to clear active GPS watchers and prevent memory leaks
        return () => {
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, [enableHighAccuracy]);


    return state;
};
