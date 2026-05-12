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
        // Only run if user is logged in, we have a location, and haven't checked in this session
        if (!user || !location || hasCheckedIn.current) return;

        const performAutoCheckin = async () => {
            console.log('🛰️ [AUTO-CHECKIN] Iniciando escaneo de ubicación...');
            
            try {
                // 1. Get Google Places Library (we assume it's loaded by APIProvider in App.tsx)
                if (!window.google || !window.google.maps || !window.google.maps.places) {
                    console.warn('⚠️ [AUTO-CHECKIN] Google Maps API no está cargada aún.');
                    return;
                }

                // Create a dummy div for PlacesService (it requires an element or map)
                const dummyDiv = document.createElement('div');
                const service = new google.maps.places.PlacesService(dummyDiv);

                const center = new google.maps.LatLng(location.lat, location.lng);
                
                const request: google.maps.places.PlaceSearchRequest = {
                    location: center,
                    radius: 100, // 100 meters detection radius
                    type: 'gym'
                };

                service.nearbySearch(request, async (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                        const nearestGym = results[0];
                        
                        // Check distance precisely
                        if (nearestGym.geometry?.location) {
                            const dist = getDistance(
                                location.lat, 
                                location.lng, 
                                nearestGym.geometry.location.lat(), 
                                nearestGym.geometry.location.lng()
                            );

                            if (dist <= 0.1) { // 100 meters
                                console.log(`🎯 [AUTO-CHECKIN] ¡Gimnasio detectado!: ${nearestGym.name}`);
                                
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
                                    console.log('✅ [AUTO-CHECKIN] Pasaporte actualizado automáticamente.');
                                    hasCheckedIn.current = true;
                                    // Optional: Show a subtle toast or notification? 
                                    // For now, silent is better as requested.
                                }
                            }
                        }
                    }
                });
            } catch (err) {
                console.error('🚨 [AUTO-CHECKIN] Error en detección automática:', err);
            }
        };

        // Delay slightly to ensure services are ready
        const timer = setTimeout(performAutoCheckin, 3000);
        return () => clearTimeout(timer);

    }, [user, location]);

    return null;
};
