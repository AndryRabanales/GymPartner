import React, { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export const GPointsDisplay: React.FC = () => {
    const { user } = useAuth();
    const [points, setPoints] = useState<number | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchPoints = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('g_points')
                .eq('id', user.id)
                .maybeSingle();

            if (!error && data) {
                setPoints(data.g_points || 0);
            }
        };

        fetchPoints();

        // Real-time subscription to points changes
        const channel = supabase
            .channel(`public:profiles:id=eq.${user.id}`)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'profiles',
                filter: `id=eq.${user.id}`
            }, (payload) => {
                if (payload.new && payload.new.g_points !== undefined) {
                    setPoints(payload.new.g_points);
                    setIsAnimating(true);
                    setTimeout(() => setIsAnimating(false), 1000);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    if (points === null) return null;

    return (
        <div className={`
            flex items-center gap-2 bg-neutral-900/50 backdrop-blur-xl px-4 py-1.5 rounded-full border border-yellow-500/30 
            shadow-[0_0_15px_rgba(250,204,21,0.1)] hover:shadow-[0_0_25px_rgba(250,204,21,0.2)] 
            transition-all duration-500 group cursor-pointer active:scale-95
            ${isAnimating ? 'ring-2 ring-yellow-400 scale-105' : ''}
        `}>
            <div className="relative">
                <div className={`
                    absolute inset-0 bg-yellow-400/20 rounded-full blur-md 
                    ${isAnimating ? 'animate-ping' : 'group-hover:animate-pulse'}
                `}></div>
                <Coins 
                    size={20} 
                    className={`
                        text-yellow-400 relative z-10 
                        ${isAnimating ? 'rotate-[360deg] transition-transform duration-700' : 'group-hover:rotate-12 transition-transform'}
                    `} 
                    strokeWidth={2.5}
                />
            </div>
            
            <div className="flex flex-col">
                <span className="text-white font-black text-sm tracking-tighter leading-none italic uppercase">
                    {points.toLocaleString()}
                </span>
                <span className="text-[8px] text-yellow-500/80 font-bold tracking-[0.2em] uppercase leading-none">
                    G-POINTS
                </span>
            </div>
            
            {/* Particle Effect for Animation */}
            {isAnimating && (
                <div className="absolute -top-2 -right-2 text-yellow-400 font-bold text-xs animate-bounce pointer-events-none">
                    +XP
                </div>
            )}
        </div>
    );
};
