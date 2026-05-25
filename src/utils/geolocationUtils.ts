import { Geolocation } from '@capacitor/geolocation';
import type { PositionOptions as CapPositionOptions } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export const getCurrentPosition = async (options?: CapPositionOptions): Promise<{ lat: number, lng: number } | null> => {
    try {
        const timeout = options?.timeout ?? 10000;
        const enableHighAccuracy = options?.enableHighAccuracy ?? true;
        
        if (Capacitor.isNativePlatform()) {
            const permission = await Geolocation.checkPermissions();
            if (permission.location !== 'granted') {
                const request = await Geolocation.requestPermissions();
                if (request.location !== 'granted') {
                    console.warn("[GPS] Permiso nativo denegado.");
                    return null;
                }
            }

            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: enableHighAccuracy,
                timeout: timeout,
                maximumAge: options?.maximumAge ?? 0
            });

            return {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
        } else {
            // Web fallback with Promise.race for strictly enforced timeouts
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    console.warn("[GPS] Geolocation API no soportada en este navegador.");
                    resolve(null);
                    return;
                }

                let isResolved = false;

                const timer = setTimeout(() => {
                    if (!isResolved) {
                        isResolved = true;
                        console.warn(`[GPS] Web timeout superado (${timeout}ms).`);
                        reject(new Error("Timeout"));
                    }
                }, timeout);

                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        if (!isResolved) {
                            isResolved = true;
                            clearTimeout(timer);
                            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                        }
                    },
                    (err) => {
                        if (!isResolved) {
                            isResolved = true;
                            clearTimeout(timer);
                            console.warn(`[GPS] Web error: ${err.message}`);
                            reject(err);
                        }
                    },
                    {
                        enableHighAccuracy: enableHighAccuracy,
                        timeout: timeout, // Also pass to API
                        maximumAge: options?.maximumAge ?? 0
                    }
                );
            });
        }
    } catch (e) {
        console.warn("[GPS] Error crítico de ubicación:", e);
        return null;
    }
};
