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
            flex items-center gap-1 transition-all duration-500 group cursor-pointer active:scale-95
            ${isAnimating ? 'scale-110' : ''}
        `}>
            <div className="relative group flex items-center justify-center">
                {/* Elegant Ambient Glow */}
                <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <img 
                    src="/Gemini_Generated_Image_qyk7sjqyk7sjqyk7-removebg-preview.png"
                    alt="G-Points"
                    className={`
                        h-9 w-auto relative z-10 object-contain drop-shadow-[0_0_10px_rgba(250,204,21,0.3)]
                        ${isAnimating ? 'scale-125 rotate-[360deg] transition-all duration-1000' : 'group-hover:scale-110 transition-transform duration-500'}
                    `} 
                />
            </div>
            
            <div className="flex flex-col">
                <span className={`
                    font-black text-lg tracking-tighter leading-none italic tabular-nums
                    bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-neutral-400
                    drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]
                `}>
                    {points.toLocaleString()}
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
