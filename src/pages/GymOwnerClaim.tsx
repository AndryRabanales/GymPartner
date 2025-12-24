import { ShieldCheck, TrendingUp, Users, Lock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const GymOwnerClaim = () => {
    return (
        <div className="min-h-screen bg-black text-white pb-20">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-neutral-900 border-b border-neutral-800">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10"></div>
                <div className="relative max-w-4xl mx-auto px-6 py-24 text-center">
                    <div className="inline-flex items-center gap-2 bg-gym-primary/10 text-gym-primary px-4 py-1.5 rounded-full border border-gym-primary/20 mb-6 font-bold text-sm tracking-wider uppercase">
                        GymIntel Business
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                        Toma el Control de tu <span className="text-gym-primary">Reputación</span>
                    </h1>
                    <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-10">
                        Miles de atletas buscan gimnasios en GymIntel. Reclama tu perfil hoy, gestiona tus reviews y llena tus horas muertas.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button className="bg-gym-primary text-black px-8 py-4 rounded-xl font-bold text-lg hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2">
                            <ShieldCheck size={24} />
                            Reclamar este Gimnasio
                        </button>
                        <Link to="/" className="bg-neutral-800 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-neutral-700 transition-colors border border-neutral-700">
                            Volver al Mapa
                        </Link>
                    </div>
                </div>
            </div>

            {/* Value Props */}
            <div className="max-w-6xl mx-auto px-6 py-20">
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl relative group hover:bg-neutral-900 transition-colors">
                        <div className="bg-blue-500/10 w-14 h-14 rounded-xl flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform">
                            <Lock size={28} />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Verificación Oficial</h3>
                        <p className="text-neutral-400">
                            Obtén la insignia de "Verificado". Nadie más podrá editar tu equipamiento o fotos. Tú tienes el control total.
                        </p>
                    </div>

                    <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl relative group hover:bg-neutral-900 transition-colors">
                        <div className="bg-green-500/10 w-14 h-14 rounded-xl flex items-center justify-center text-green-500 mb-6 group-hover:scale-110 transition-transform">
                            <TrendingUp size={28} />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Analytics de Mercado</h3>
                        <p className="text-neutral-400">
                            Descubre qué equipamiento busca la gente en tu zona. Espía las quejas de tu competencia y captúralos.
                        </p>
                    </div>

                    <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl relative group hover:bg-neutral-900 transition-colors">
                        <div className="bg-yellow-500/10 w-14 h-14 rounded-xl flex items-center justify-center text-yellow-500 mb-6 group-hover:scale-110 transition-transform">
                            <Users size={28} />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Llenado de Horas Muertas</h3>
                        <p className="text-neutral-400">
                            Activa "Flash Sales" cuando el gym esté vacío. Notificamos a los usuarios cercanos instantáneamente.
                        </p>
                    </div>
                </div>
            </div>

            {/* Sticky Pricing / CTA */}
            <div className="max-w-4xl mx-auto px-6">
                <div className="bg-gradient-to-br from-gym-primary/20 to-neutral-900 border border-gym-primary/30 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold mb-4">Plan Business Alpha</h2>
                        <p className="text-neutral-300 mb-8 max-w-xl mx-auto">
                            Durante la fase Alpha, el verificador de propiedad es **GRATUITO** para los primeros 50 gimnasios.
                        </p>
                        <button className="bg-white text-black px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors inline-flex items-center gap-2">
                            Verificar Gratis Ahora <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
