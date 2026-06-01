import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from './useGeolocation';
import { userService } from '../services/UserService';
import { haversineDistance } from '../utils/geolocationUtils';

export const useAutoCheckin = () => {
    const { user } = useAuth();
    const { location } = useGeolocation();
    const lastScanTime = useRef<number>(0);

    useEffect(() => {
        const performAutoCheckin = async () => {
            const now = Date.now();
            if (now - lastScanTime.current < 10 * 60 * 1000) return;

            // Only use fresh GPS for auto-checkin — stale cache leads to false positives
            if (!location?.isFresh) return;
            if (!window.google?.maps?.places) return;
            if (!user) return;

            lastScanTime.current = now;
            console.log('🛰️ [AUTO-CHECKIN] Escaneo táctico en curso...');

            try {
                const dummyDiv = document.createElement('div');
                const service = new google.maps.places.PlacesService(dummyDiv);
                const center = new google.maps.LatLng(location.lat, location.lng);

                const request: google.maps.places.PlaceSearchRequest = {
                    location: center,
                    radius: 200, // search radius for Places API (meters)
                    type: 'gym',
                };

                service.nearbySearch(request, async (results, status) => {
                    if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) return;

                    const nearestGym = results[0];
                    if (!nearestGym.geometry?.location) return;

                    const distMeters = haversineDistance(
                        location.lat,
                        location.lng,
                        nearestGym.geometry.location.lat(),
                        nearestGym.geometry.location.lng()
                    );

                    // 200m threshold — generous enough for GPS drift inside buildings
                    if (distMeters <= 200) {
                        const result = await userService.addGymToPassport(user.id, {
                            place_id: nearestGym.place_id!,
                            name: nearestGym.name || 'Gimnasio Detectado',
                            address: nearestGym.vicinity || '',
                            location: {
                                lat: nearestGym.geometry.location.lat(),
                                lng: nearestGym.geometry.location.lng(),
                            },
                            rating: nearestGym.rating,
                        });

                        if (result.success) {
                            console.log(`✅ [AUTO-CHECKIN] Registrado en: ${nearestGym.name}`);
                        }
                    }
                });
            } catch (err) {
                console.error('🚨 [AUTO-CHECKIN] Error:', err);
            }
        };

        performAutoCheckin();
        const interval = setInterval(performAutoCheckin, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user?.id, location?.lat, location?.lng, location?.isFresh]);

    return null;
};
