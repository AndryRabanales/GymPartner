import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
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

const STORAGE_KEY = 'ginx_last_known_location';

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
        let watchId: number | null = null;
        let capWatchId: string | null = null;

        const successHandler = (position: GeolocationPosition) => {
            const loc: Location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
                timestamp: position.timestamp,
            };
            
            // Cache latest location for instantaneous loads
            localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
            setState({ location: loc, error: null, loading: false });
        };

        const errorHandler = (error: GeolocationPositionError | Error) => {
            console.error('Error getting location:', error);
            // Don't wipe last known location on error, just show error state
            setState(prev => ({ ...prev, error: error.message, loading: false }));
        };

        const startWatching = async () => {
            if (Capacitor.isNativePlatform()) {
                try {
                    const permission = await Geolocation.checkPermissions();
                    if (permission.location !== 'granted') {
                        const request = await Geolocation.requestPermissions();
                        if (request.location !== 'granted') {
                            setState(prev => ({ ...prev, error: 'Permiso de ubicación denegado.', loading: false }));
                            return;
                        }
                    }

                    // FORCE FRESH IMMEDIATE READ FIRST
                    try {
                        const freshPos = await Geolocation.getCurrentPosition({ enableHighAccuracy, timeout: 5000, maximumAge: 0 });
                        const mockPos: any = {
                            coords: {
                                latitude: freshPos.coords.latitude,
                                longitude: freshPos.coords.longitude,
                                accuracy: freshPos.coords.accuracy,
                                heading: freshPos.coords.heading,
                                speed: freshPos.coords.speed
                            },
                            timestamp: freshPos.timestamp
                        };
                        successHandler(mockPos);
                    } catch(e) {
                        console.warn("[NATIVE GEOLOCATION] Immediate fetch failed, relying on watch.", e);
                    }

                    capWatchId = await Geolocation.watchPosition(
                        { enableHighAccuracy, timeout: 10000, maximumAge: 0 },
                        (position, err) => {
                            if (err) {
                                console.warn(`[NATIVE GEOLOCATION] Error: ${err.message}`);
                                errorHandler(err as any);
                                return;
                            }
                            if (position) {
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
                } catch (e: any) {
                    errorHandler(e);
                }
            } else {
                if (!navigator.geolocation) {
                    setState(prev => ({ ...prev, error: 'Geolocation not supported', loading: false }));
                    return;
                }

                const options = { enableHighAccuracy, timeout: 10000, maximumAge: 0 };

                if ('permissions' in navigator) {
                    navigator.permissions.query({ name: 'geolocation' as any }).then((result) => {
                        if (result.state === 'denied') {
                            setState(prev => ({ ...prev, error: 'Permiso de ubicación denegado.', loading: false }));
                            return;
                        }
                        navigator.geolocation.getCurrentPosition(successHandler, (e) => console.warn("Immediate web fetch failed", e), options);
                        watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);
                    }).catch(() => {
                        navigator.geolocation.getCurrentPosition(successHandler, (e) => console.warn("Immediate web fetch failed", e), options);
                        watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);
                    });
                } else {
                    navigator.geolocation.getCurrentPosition(successHandler, (e) => console.warn("Immediate web fetch failed", e), options);
                    watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);
                }
            }
        };

        startWatching();

        return () => {
            if (capWatchId !== null && Capacitor.isNativePlatform()) {
                Geolocation.clearWatch({ id: capWatchId });
            }
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, [enableHighAccuracy]);

    return state;
};
