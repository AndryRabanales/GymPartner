import { Geolocation, PositionOptions as CapPositionOptions } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export const getCurrentPosition = async (options?: CapPositionOptions): Promise<{ lat: number, lng: number } | null> => {
    try {
        if (Capacitor.isNativePlatform()) {
            const permission = await Geolocation.checkPermissions();
            if (permission.location !== 'granted') {
                const request = await Geolocation.requestPermissions();
                if (request.location !== 'granted') {
                    throw new Error("Permission denied");
                }
            }

            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: options?.enableHighAccuracy ?? true,
                timeout: options?.timeout ?? 10000,
                maximumAge: options?.maximumAge ?? 0
            });

            return {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
        } else {
            // Web fallback
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error("Geolocation not supported"));
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    (err) => reject(err),
                    {
                        enableHighAccuracy: options?.enableHighAccuracy ?? true,
                        timeout: options?.timeout ?? 10000,
                        maximumAge: options?.maximumAge ?? 0
                    }
                );
            });
        }
    } catch (e) {
        console.warn("Geolocation Error:", e);
        return null;
    }
};
