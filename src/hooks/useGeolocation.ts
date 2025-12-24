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

export const useGeolocation = (enableHighAccuracy = true) => {
    const [state, setState] = useState<GeolocationState>({
        location: null,
        error: null,
        loading: true,
    });

    useEffect(() => {
        if (!navigator.geolocation) {
            setState(prev => ({ ...prev, error: 'Geolocation not supported', loading: false }));
            return;
        }

        const successHandler = (position: GeolocationPosition) => {
            setState({
                location: {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    timestamp: position.timestamp
                },
                error: null,
                loading: false,
            });
        };

        const errorHandler = (error: GeolocationPositionError) => {
            setState(prev => ({ ...prev, error: error.message, loading: false }));
        };

        const options = {
            enableHighAccuracy,
            timeout: 10000,
            maximumAge: 0,
        };

        // Get initial position
        navigator.geolocation.getCurrentPosition(successHandler, errorHandler, options);

        // Watch for updates
        const watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);

        return () => navigator.geolocation.clearWatch(watchId);
    }, [enableHighAccuracy]);

    return state;
};
