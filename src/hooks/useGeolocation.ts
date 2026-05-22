import { useState, useEffect } from 'react';
import { Geolocation, PositionOptions } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

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
        const startWatching = async () => {
            if (Capacitor.isNativePlatform()) {
                // NATIVE CAPACITOR IMPLEMENTATION (Using highly accurate device APIs)
                try {
                    const permission = await Geolocation.checkPermissions();
                    if (permission.location !== 'granted') {
                        const request = await Geolocation.requestPermissions();
                        if (request.location !== 'granted') {
                            setState(prev => ({ ...prev, error: 'Permiso de ubicación denegado.', loading: false }));
                            return;
                        }
                    }

                    const capWatchId = await Geolocation.watchPosition(
                        { enableHighAccuracy: enableHighAccuracy, timeout: 10000, maximumAge: 0 },
                        (position, err) => {
                            if (err) {
                                console.warn(`[NATIVE GEOLOCATION] Error: ${err.message}`);
                                errorHandler(err as any);
                                return;
                            }
                            if (position) {
                                // Simulate GeolocationPosition shape for our handler
                                const mockPos: any = {
                                    coords: {
                                        latitude: position.coords.latitude,
                                        longitude: position.coords.longitude,
                                        accuracy: position.coords.accuracy,
                                        heading: position.coords.heading,
                                        speed: position.coords.speed
                                    },
                                    timestamp: position.timestamp
                                };
                                successHandler(mockPos);
                            }
                        }
                    );
                    
                    // Cleanup function specifically for Capacitor
                    return () => {
                        Geolocation.clearWatch({ id: capWatchId });
                    };
                } catch (e: any) {
                    errorHandler(e);
                    return () => {};
                }
            } else {
                // WEB BROWSER FALLBACK IMPLEMENTATION
                if (!navigator.geolocation) {
                    setState(prev => ({ ...prev, error: 'Geolocation not supported', loading: false }));
                    return () => {};
                }

                const options = {
                    enableHighAccuracy,
                    timeout: 10000,
                    maximumAge: 0,
                };

                if ('permissions' in navigator) {
                    navigator.permissions.query({ name: 'geolocation' as any }).then((result) => {
                        if (result.state === 'denied') {
                            setState(prev => ({ ...prev, error: 'Permiso de ubicación denegado.', loading: false }));
                            return;
                        }
                        watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);
                    }).catch(() => {
                        watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);
                    });
                } else {
                    watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);
                }

                return () => {
                    if (watchId !== null) {
                        navigator.geolocation.clearWatch(watchId);
                    }
                };
            }
        };

        let cleanupFn = () => {};
        startWatching().then(fn => {
            if (fn) cleanupFn = fn;
        });

        // Return proper React cleanup to clear active GPS watchers and prevent memory leaks
        return () => {
            cleanupFn();
        };
    }, [enableHighAccuracy]);


    return state;
};
