export interface GymEquipment {
    id: string;
    name: string;
    category: 'Cardio' | 'Fuerza' | 'Peso Libre' | 'Funcional';
    quantity: number;
    description?: string; // e.g., "Mancuernas hasta 60kg"
    condition: 'Nuevo' | 'Bueno' | 'Desgastado' | 'Malo';
}

export interface Gym {
    id: string;
    name: string;
    rating: number; // 0-5
    priceLevel: 'Low' | 'Medium' | 'High' | 'Luxury';
    address: string;
    coords: { lat: number, lng: number };
    mainImage: string;
    gallery: string[];
    equipment: GymEquipment[];
    amenities: string[];
    crowdLevel: 'Bajo' | 'Medio' | 'Alto' | 'Muy Alto';
    vibe: 'Hardcore' | 'Comercial' | 'Posh' | 'CrossFit' | 'Familiar';
    openNow: boolean;
    leaderboard: {
        userId: string;
        checkinsMismatch: number; // Checkins en este gym este mes
    }[];
}

export const mockGyms: Gym[] = [
    {
        id: '1',
        name: "Iron Paradise Gym",
        rating: 4.8,
        priceLevel: "Medium",
        address: "Av. Siempre Viva 123",
        coords: { lat: 0, lng: 0 },
        mainImage: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop",
        gallery: [],
        amenities: ["Duchas", "Parking", "Agua Potable", "Aire Acondicionado"],
        crowdLevel: "Medio",
        vibe: "Hardcore",
        openNow: true,
        leaderboard: [
            { userId: 'user_1', checkinsMismatch: 24 },
            { userId: 'user_2', checkinsMismatch: 18 }
        ],
        equipment: [
            { id: '101', name: "Jaula de Potencia (Power Rack)", category: "Fuerza", quantity: 3, condition: "Bueno" },
            { id: '102', name: "Mancuernas (kg)", category: "Peso Libre", quantity: 1, description: "Pares de 2kg a 60kg", condition: "Bueno" },
            { id: '103', name: "Plataforma de Peso Muerto", category: "Fuerza", quantity: 2, condition: "Desgastado" },
            { id: '104', name: "Hack Squat", category: "Fuerza", quantity: 1, condition: "Nuevo" }
        ]
    },
    {
        id: '2',
        name: "Fitness First Commercial",
        rating: 3.9,
        priceLevel: "Low",
        address: "Calle Falsa 123",
        coords: { lat: 0, lng: 0 },
        mainImage: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1000&auto=format&fit=crop",
        gallery: [],
        amenities: ["Sauna", "Duchas", "Taquillas", "Clases Grupales"],
        crowdLevel: "Muy Alto",
        vibe: "Comercial",
        openNow: true,
        leaderboard: [
            { userId: 'user_3', checkinsMismatch: 5 }
        ],
        equipment: [
            { id: '201', name: "Cintas de Correr", category: "Cardio", quantity: 20, condition: "Nuevo" },
            { id: '202', name: "Máquinas Smith", category: "Fuerza", quantity: 3, condition: "Bueno" },
            { id: '203', name: "Mancuernas (kg)", category: "Peso Libre", quantity: 1, description: "Pares de 2kg a 30kg", condition: "Bueno" }
        ]
    },
    {
        id: '3',
        name: "MetroFlex Tribute",
        rating: 5.0,
        priceLevel: "Low",
        address: "Zona Industrial Nave 4",
        coords: { lat: 0, lng: 0 },
        mainImage: "https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?q=80&w=1000&auto=format&fit=crop",
        gallery: [],
        amenities: ["Parking", "Magnesio Permitido"],
        crowdLevel: "Bajo",
        vibe: "Hardcore",
        openNow: false,
        leaderboard: [],
        equipment: [
            { id: '301', name: "Monolift", category: "Fuerza", quantity: 1, condition: "Desgastado" },
            { id: '302', name: "Banco Plano Competición", category: "Fuerza", quantity: 2, condition: "Bueno" },
            { id: '303', name: "Cadenas y Bandas", category: "Peso Libre", quantity: 10, condition: "Bueno" }
        ]
    }
];
