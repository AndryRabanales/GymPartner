import { LogIn } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PublicTeaserProps {
    icon: LucideIcon;
    title: string;
    description: string;
    benefitTitle: string;
    benefitDescription: string;
    iconColor?: string;
    bgAccent?: string;
    children?: React.ReactNode;
}

export const PublicTeaser = ({
    icon: Icon,
    title,
    description,
    benefitTitle,
    benefitDescription,
    iconColor = "text-gym-primary",
    bgAccent = "bg-gym-primary/10",
    children
}: PublicTeaserProps) => {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            {/* Background Effects */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] ${bgAccent} rounded-full blur-[100px] pointer-events-none`} />

            <div className="relative z-10 max-w-md w-full space-y-8">
                {/* Icon Cluster */}
                <div className="relative mx-auto w-24 h-24 mb-8">
                    <div className="absolute inset-0 bg-neutral-900 rounded-3xl rotate-6 border border-white/5" />
                    <div className="absolute inset-0 bg-neutral-900 rounded-3xl -rotate-6 border border-white/5" />
                    <div className="absolute inset-0 bg-neutral-900 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl">
                        <Icon size={40} className={iconColor} />
                    </div>
                </div>

                {/* Text Content */}
                <div className="space-y-4">
                    <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                        {title}
                    </h1>
                    <p className="text-neutral-400 text-lg leading-relaxed font-medium">
                        {description}
                    </p>
                </div>

                {/* Feature Card Preview */}
                <div className="bg-neutral-900/50 backdrop-blur-sm border border-white/5 rounded-[2rem] p-8 text-left space-y-4 relative overflow-hidden group hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center shadow-inner">
                            <Icon size={24} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white uppercase tracking-tighter italic">{benefitTitle}</h3>
                            <p className="text-neutral-500 text-xs font-medium">{benefitDescription}</p>
                        </div>
                    </div>

                    <div className="h-px bg-white/5 w-full" />

                    {children}

                    <Link
                        to="/login"
                        className="w-full bg-gym-primary text-black font-black py-4 rounded-xl hover:bg-yellow-400 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 no-underline shadow-lg shadow-gym-primary/10 italic shrink-0"
                    >
                        <LogIn size={20} strokeWidth={3} />
                        ACCESO TOTAL
                    </Link>
                </div>

                <div className="pt-8">
                    <p className="text-[10px] text-neutral-600 uppercase tracking-[0.3em] font-black">
                        GymPartner Intel • Status: Esperando Despliegue
                    </p>
                </div>
            </div>
        </div>
    );
};
