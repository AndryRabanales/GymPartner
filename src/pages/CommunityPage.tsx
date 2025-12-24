import { Users, MapPin, Lock } from 'lucide-react';

export const CommunityPage = () => {
    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gym-primary/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 max-w-md w-full space-y-8">
                {/* Icon Cluster */}
                <div className="relative mx-auto w-24 h-24 mb-8">
                    <div className="absolute inset-0 bg-neutral-900 rounded-3xl rotate-6 border border-white/5" />
                    <div className="absolute inset-0 bg-neutral-900 rounded-3xl -rotate-6 border border-white/5" />
                    <div className="absolute inset-0 bg-neutral-900 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl">
                        <Users size={40} className="text-gym-primary" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-neutral-950 p-2 rounded-xl border border-white/10 shadow-lg">
                        <Lock size={16} className="text-neutral-400" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="space-y-4">
                    <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                        Comunidad <span className="text-gym-primary">Local</span>
                    </h1>
                    <p className="text-neutral-400 text-lg leading-relaxed font-medium">
                        Estamos construyendo un espacio exclusivo para ti y los miembros de tu gimnasio.
                    </p>
                </div>

                {/* Feature Card Preview */}
                <div className="bg-neutral-900/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 text-left space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 px-3 py-1 bg-yellow-500/10 border-b border-l border-yellow-500/20 rounded-bl-xl text-[10px] font-bold text-yellow-500 uppercase">
                        Próximamente
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center">
                            <MapPin size={20} className="text-white" />
                        </div>
                        <div>
                            <div className="h-3 w-24 bg-neutral-800 rounded mb-1.5" />
                            <div className="h-2 w-16 bg-neutral-800/50 rounded" />
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <div className="flex gap-2">
                            <div className="w-8 h-8 rounded-full bg-neutral-800 shrink-0" />
                            <div className="flex-1 bg-neutral-800/50 rounded-r-xl rounded-bl-xl p-3 text-xs text-neutral-500">
                                ¿Alguien para entrenar pierna hoy a las 6?
                            </div>
                        </div>
                        <div className="flex gap-2 flex-row-reverse">
                            <div className="w-8 h-8 rounded-full bg-neutral-800 shrink-0" />
                            <div className="flex-1 bg-gym-primary/10 rounded-l-xl rounded-br-xl p-3 text-xs text-gym-primary/70">
                                ¡Yo me apunto! Nos vemos en la zona de peso libre.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-8">
                    <p className="text-xs text-neutral-600 uppercase tracking-widest font-bold">
                        GymPartner Community
                    </p>
                </div>
            </div>
        </div>
    );
};
