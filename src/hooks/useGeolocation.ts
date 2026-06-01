import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface Location {
    lat: number;
    lng: number;
    accuracy: number;  // meters
    heading?: number | null;
    speed?: number | null;
    timestamp: number;
    isFresh: boolean;  // true = acquired this session, false = loaded from cache
}

interface GeolocationState {
    location: Location | null;
    error: string | null;
    loading: boolean;
}

const STORAGE_KEY = 'ginx_last_known_location';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — stale after this

const loadCache = (): Location | null => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const loc: Location = JSON.parse(raw);
        // Reject if older than 5 minutes — stale GPS is worse than no GPS
        if (Date.now() - loc.timestamp > CACHE_TTL_MS) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return { ...loc, isFresh: false };
    } catch {
        return null;
    }
};

export const useGeolocation = (enableHighAccuracy = true) => {
    const [state, setState] = useState<GeolocationState>(() => {
        const cached = loadCache();
        return {
            location: cached,
            error: null,
            loading: !cached, // if no valid cache, show loading immediately
        };
    });

    useEffect(() => {
        let watchId: number | null = null;
        let capWatchId: string | null = null;

        const onFix = (coords: {
            latitude: number;
            longitude: number;
            accuracy: number;
            heading?: number | null;
            speed?: number | null;
        }, timestamp: number) => {
            const loc: Location = {
                lat: coords.latitude,
                lng: coords.longitude,
                accuracy: coords.accuracy ?? 999,
                heading: coords.heading,
                speed: coords.speed,
                timestamp,
                isFresh: true,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
            setState({ location: loc, error: null, loading: false });
        };

        const onError = (message: string) => {
            console.warn('[GPS]', message);
            setState(prev => ({ ...prev, error: message, loading: false }));
        };

        const startWatching = async () => {
            if (Capacitor.isNativePlatform()) {
                try {
                    const perm = await Geolocation.checkPermissions();
                    if (perm.location !== 'granted') {
                        const req = await Geolocation.requestPermissions();
                        if (req.location !== 'granted') {
                            onError('Permiso de ubicación denegado.');
                            return;
                        }
                    }

                    // Immediate one-shot read first for fast UX
                    try {
                        const pos = await Geolocation.getCurrentPosition({
                            enableHighAccuracy,
                            timeout: 8000,
                            maximumAge: 0,
                        });
                        onFix(pos.coords, pos.timestamp);
                    } catch (e) {
                        console.warn('[GPS] Lectura inicial nativa falló, usando watch.', e);
                    }

                    capWatchId = await Geolocation.watchPosition(
                        { enableHighAccuracy, timeout: 15000, maximumAge: 0 },
                        (pos, err) => {
                            if (err) { onError(err.message); return; }
                            if (pos) onFix(pos.coords, pos.timestamp);
                        }
                    );
                } catch (e: any) {
                    onError(e.message ?? 'Error GPS nativo');
                }
            } else {
                if (!navigator.geolocation) {
                    onError('Geolocation no soportado en este navegador.');
                    return;
                }

                const opts = {
                    enableHighAccuracy,
                    timeout: 15000,
                    maximumAge: 0,
                };

                const webOnFix = (pos: GeolocationPosition) =>
                    onFix(pos.coords, pos.timestamp);
                const webOnErr = (e: GeolocationPositionError) =>
                    onError(e.message);

                // Check permission state first (avoids silent failures on denied)
                const startWatch = () => {
                    navigator.geolocation.getCurrentPosition(webOnFix, webOnErr, opts);
                    watchId = navigator.geolocation.watchPosition(webOnFix, webOnErr, opts);
                };

                if ('permissions' in navigator) {
                    navigator.permissions
                        .query({ name: 'geolocation' as PermissionName })
                        .then((result) => {
                            if (result.state === 'denied') {
                                onError('Permiso de ubicación denegado. Actívalo en la configuración del navegador.');
                                return;
                            }
                            startWatch();
                        })
                        .catch(startWatch);
                } else {
                    startWatch();
                }
            }
        };

        startWatching();

        return () => {
            if (capWatchId && Capacitor.isNativePlatform()) {
                Geolocation.clearWatch({ id: capWatchId });
            }
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, [enableHighAccuracy]);

    return state;
};
