import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from './useGeolocation';
import { userService } from '../services/UserService';
import { getDistance } from '../utils/distance';

export const useAutoCheckin = () => {
    const { user } = useAuth();
    const { location } = useGeolocation();
    const hasCheckedIn = useRef(false);

    useEffect(() => {
        const performAutoCheckin = async () => {
            // Wait for Google Maps to be ready
            if (!window.google || !window.google.maps || !window.google.maps.places) {
                return;
            }

            // Only run if user is logged in and we have a location
            if (!user || !location) return;

            console.log('🛰️ [AUTO-CHECKIN] Escaneo táctico en curso...');
            
            try {
                const dummyDiv = document.createElement('div');
                const service = new google.maps.places.PlacesService(dummyDiv);
                const center = new google.maps.LatLng(location.lat, location.lng);
                
                const request: google.maps.places.PlaceSearchRequest = {
                    location: center,
                    radius: 120, // Slightly wider detection
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

                            if (dist <= 0.12) { // 120 meters
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

        // 1. Initial Instant Check (No delay)
        if (!hasCheckedIn.current) {
            performAutoCheckin();
        }

        // 2. Continuous Monitoring: Every 20 minutes
        const interval = setInterval(() => {
            console.log('🔄 [AUTO-CHECKIN] Re-escaneando ubicación (Ciclo 20min)...');
            performAutoCheckin();
        }, 20 * 60 * 1000); 

        return () => clearInterval(interval);

    }, [user, location?.lat, location?.lng]);

    return null;
};
