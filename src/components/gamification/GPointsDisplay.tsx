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
            <div className="relative">
                <img 
                    src="/Gemini_Generated_Image_qyk7sjqyk7sjqyk7-removebg-preview.png"
                    alt="G-Points"
                    className={`
                        h-10 w-auto relative z-10 object-contain
                        ${isAnimating ? 'scale-110 transition-transform duration-700' : 'group-hover:scale-105 transition-transform'}
                    `} 
                />
            </div>
            
            <div className="flex flex-col">
                <span className="text-white font-black text-base tracking-tighter leading-none italic uppercase">
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
