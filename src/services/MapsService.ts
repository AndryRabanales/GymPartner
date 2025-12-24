export interface GymPlace {
    place_id: string; // Google Place ID
    name: string;
    address: string;
    location: { lat: number; lng: number };
    rating?: number;
    user_ratings_total?: number;
    photos?: string[];
    opening_hours?: { open_now: boolean };
}

class MapsService {


    // Mock results for development when no API Key is present
    private mockGyms: GymPlace[] = [
        {
            place_id: "mock_1",
            name: "SmartFit Centro Historico",
            address: "Av. Juárez 12, Centro, CDMX",
            location: { lat: 19.4326, lng: -99.1332 },
            rating: 4.5,
            user_ratings_total: 1200
        },
        {
            place_id: "mock_2",
            name: "World Gym Condesa",
            address: "Amsterdam 55, Condesa, CDMX",
            location: { lat: 19.4100, lng: -99.1700 },
            rating: 4.2,
            user_ratings_total: 800
        },
        {
            place_id: "mock_3",
            name: "Barrio Gym (Hardcore)",
            address: "Calle 10, Tepito, CDMX",
            location: { lat: 19.4440, lng: -99.1200 },
            rating: 4.8,
            user_ratings_total: 150
        }
    ];

    async searchGyms(query: string): Promise<GymPlace[]> {
        if (!query) return [];

        // If we have API Key active (future), we use PlacesService here.
        // For now, filtering mocks to simulate search:

        console.log(`[MapsService] Searching for: ${query}`);

        // Simulating network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return this.mockGyms.filter(gym =>
            gym.name.toLowerCase().includes(query.toLowerCase()) ||
            gym.address.toLowerCase().includes(query.toLowerCase())
        );
    }

    async getGymDetails(placeId: string): Promise<GymPlace | null> {
        // Mock implementation
        return this.mockGyms.find(g => g.place_id === placeId) || null;
    }
}

export const mapsService = new MapsService();
