import type { User } from '../types/user';

export const mockUsers: User[] = [
    {
        id: 'user_1',
        username: 'IronAddict99',
        description: 'Living for the pump. Bench PR: 140kg',
        avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=200&auto=format&fit=crop',
        homeGymId: '1',
        xp: 12500,
        rank: 'Gym God',
        stats: { totalCheckins: 142, gymsVisited: 5, reviewsWritten: 12, photosUploaded: 45 },
        badges: ['early_adopter', 'heavy_lifter', 'gym_owner_virtual']
    },
    {
        id: 'user_2',
        username: 'SarahLifts',
        description: 'Powerlifting & Coffee',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop',
        homeGymId: '1',
        xp: 6200,
        rank: 'Legend',
        stats: { totalCheckins: 89, gymsVisited: 8, reviewsWritten: 24, photosUploaded: 10 },
        badges: ['reporter_elite']
    },
    {
        id: 'user_3',
        username: 'NewbieNate',
        description: 'Just starting my journey.',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
        homeGymId: '2',
        xp: 150,
        rank: 'Novato',
        stats: { totalCheckins: 3, gymsVisited: 1, reviewsWritten: 0, photosUploaded: 1 },
        badges: []
    },
    {
        id: 'me',
        username: 'You (Alpha Tester)',
        description: 'Building the GymIntel empire.',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop',
        xp: 350,
        rank: 'Novato',
        stats: { totalCheckins: 5, gymsVisited: 2, reviewsWritten: 1, photosUploaded: 0 },
        badges: ['founder']
    }
];
