import { mockGyms, type Gym } from '../data/mockGyms';
import { MapPin, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const GymCard = ({ gym }: { gym: Gym }) => {
    return (
        <Link to={`/gym/${gym.id}`} className="block group">
            <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 hover:border-gym-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-gym-primary/10 h-full flex flex-col">
                <div className="relative h-48 overflow-hidden">
                    <img
                        src={gym.mainImage}
                        alt={gym.name}
                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1 text-xs font-bold text-yellow-400 border border-yellow-500/30">
                        <Star size={12} fill="currentColor" />
                        {gym.rating}
                    </div>
                    {gym.vibe === 'Hardcore' && (
                        <div className="absolute top-2 left-2 bg-red-600/90 backdrop-blur-md px-2 py-1 rounded-md text-xs font-bold text-white border border-red-500/30 uppercase tracking-wider">
                            Hardcore
                        </div>
                    )}
                </div>

                <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-gym-primary transition-colors">{gym.name}</h3>
                            <div className="flex items-center gap-1 text-neutral-400 text-sm mt-1">
                                <MapPin size={14} />
                                <span className="truncate">{gym.address}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4 mb-4">
                        {gym.amenities.slice(0, 3).map((amenity, idx) => (
                            <span key={idx} className="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded-md border border-neutral-700">
                                {amenity}
                            </span>
                        ))}
                        {gym.amenities.length > 3 && (
                            <span className="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded-md border border-neutral-700">
                                +{gym.amenities.length - 3}
                            </span>
                        )}
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-2 pt-4 border-t border-neutral-800 lg:flex lg:justify-between lg:items-center">
                        <div className="text-xs text-neutral-500 flex flex-col">
                            <span className="uppercase text-[10px] tracking-wider font-semibold">Crowd Level</span>
                            <span className={`font-medium ${gym.crowdLevel === 'Muy Alto' ? 'text-red-400' : 'text-green-400'}`}>
                                {gym.crowdLevel}
                            </span>
                        </div>
                        <div className="text-xs text-neutral-500 flex flex-col text-right lg:text-left">
                            <span className="uppercase text-[10px] tracking-wider font-semibold">Price</span>
                            <span className="font-medium text-white">{gym.priceLevel}</span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
};

export const GymSearch = () => {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Hero Header */}
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
                    Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">Iron Paradise</span>
                </h1>
                <p className="text-neutral-400 max-w-2xl mx-auto text-lg">
                    No more guessing. Find gyms with the exact equipment you need. Verified by users, for users.
                </p>
            </div>

            {/* Filters (Mock) */}
            <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 mb-8 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    {['Has Deadlift Platform', 'Dumbbells > 50kg', 'Open 24h', 'Sauna'].map((filter) => (
                        <button key={filter} className="whitespace-nowrap px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-full text-sm font-medium text-neutral-300 transition-colors border border-neutral-700">
                            {filter}
                        </button>
                    ))}
                </div>
                <button className="text-gym-primary font-medium text-sm hover:underline">
                    Advanced Filters
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockGyms.map(gym => (
                    <GymCard key={gym.id} gym={gym} />
                ))}
            </div>
        </div>
    );
};
