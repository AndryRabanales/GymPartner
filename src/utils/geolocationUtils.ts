import { Geolocation } from '@capacitor/geolocation';
import type { PositionOptions as CapPositionOptions } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface GeoPosition {
    lat: number;
    lng: number;
    accuracy: number; // meters — how precise the fix is
}

/**
 * One-shot position fetch with accuracy metadata.
 * Returns null if permission denied or timeout exceeded.
 * On native: uses Capacitor GPS (3-15m accuracy).
 * On web mobile: uses browser GPS (10-50m accuracy).
 * On web desktop: uses WiFi/IP (unreliable for geofencing, accuracy often >200m).
 */
export const getCurrentPosition = async (options?: CapPositionOptions): Promise<GeoPosition | null> => {
    try {
        const timeout = options?.timeout ?? 10000;
        const enableHighAccuracy = options?.enableHighAccuracy ?? true;

        if (Capacitor.isNativePlatform()) {
            const permission = await Geolocation.checkPermissions();
            if (permission.location !== 'granted') {
                const request = await Geolocation.requestPermissions();
                if (request.location !== 'granted') {
                    console.warn('[GPS] Permiso nativo denegado.');
                    return null;
                }
            }

            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy,
                timeout,
                maximumAge: options?.maximumAge ?? 0,
            });

            return {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy ?? 999,
            };
        } else {
            return new Promise((resolve) => {
                if (!navigator.geolocation) {
                    console.warn('[GPS] Geolocation API no soportada.');
                    resolve(null);
                    return;
                }

                let settled = false;

                const timer = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        console.warn(`[GPS] Web timeout (${timeout}ms).`);
                        resolve(null);
                    }
                }, timeout);

                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        if (!settled) {
                            settled = true;
                            clearTimeout(timer);
                            resolve({
                                lat: pos.coords.latitude,
                                lng: pos.coords.longitude,
                                accuracy: pos.coords.accuracy ?? 999,
                            });
                        }
                    },
                    (err) => {
                        if (!settled) {
                            settled = true;
                            clearTimeout(timer);
                            console.warn(`[GPS] Web error: ${err.message}`);
                            resolve(null); // resolve null instead of rejecting
                        }
                    },
                    { enableHighAccuracy, timeout, maximumAge: options?.maximumAge ?? 0 }
                );
            });
        }
    } catch (e) {
        console.warn('[GPS] Error crítico:', e);
        return null;
    }
};

/**
 * Haversine distance between two coordinates.
 * Returns distance in METERS.
 */
export const haversineDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Whether a GPS fix is reliable enough for geofencing.
 * accuracy < 150m = usable on mobile web
 * accuracy < 50m  = good (native GPS)
 */
export const isAccuracyUsable = (accuracy: number): boolean => accuracy < 150;
