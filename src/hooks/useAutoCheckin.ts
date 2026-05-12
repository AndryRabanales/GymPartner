import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from './useGeolocation';
import { userService } from '../services/UserService';
import { getDistance } from '../utils/distance';

export const useAutoCheckin = () => {
    const { user } = useAuth();
    const { location } = useGeolocation();
    const lastScanTime = useRef<number>(0);

    useEffect(() => {
        const performAutoCheckin = async () => {
            const now = Date.now();
            // Throttle: Only scan if 10 minutes have passed since last scan
            if (now - lastScanTime.current < 10 * 60 * 1000) return;
            
            lastScanTime.current = now;

            // Wait for Google Maps to be ready
            if (!window.google || !window.google.maps || !window.google.maps.places) return;
            if (!user || !location) return;

            console.log('🛰️ [AUTO-CHECKIN] Escaneo táctico en curso...');
            
            try {
                const dummyDiv = document.createElement('div');
                const service = new google.maps.places.PlacesService(dummyDiv);
                const center = new google.maps.LatLng(location.lat, location.lng);
                
                const request: google.maps.places.PlaceSearchRequest = {
                    location: center,
                    radius: 120,
                    type: 'gym'
                };

                service.nearbySearch(request, async (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                        const nearestGym = results[0];
                        if (nearestGym.geometry?.location) {
                            const dist = getDistance(
                                location.lat, 
                                location.lng, 
                                nearestGym.geometry.location.lat(), 
                                nearestGym.geometry.location.lng()
                            );

                            if (dist <= 0.12) {
                                const result = await userService.addGymToPassport(user.id, {
                                    place_id: nearestGym.place_id!,
                                    name: nearestGym.name || 'Gimnasio Detectado',
                                    address: nearestGym.vicinity || '',
                                    location: { 
                                        lat: nearestGym.geometry.location.lat(), 
                                        lng: nearestGym.geometry.location.lng() 
                                    },
                                    rating: nearestGym.rating
                                });

                                if (result.success) {
                                    console.log(`✅ [AUTO-CHECKIN] Registrado en: ${nearestGym.name}`);
                                    hasCheckedIn.current = true;
                                }
                            }
                        }
                    }
                });
            } catch (err) {
                console.error('🚨 [AUTO-CHECKIN] Error:', err);
            }
        };

        performAutoCheckin();

        // Refresh scan every 10 minutes
        const interval = setInterval(performAutoCheckin, 10 * 60 * 1000);
        return () => clearInterval(interval);

    }, [user?.id, location?.lat, location?.lng]);

    return null;
};
