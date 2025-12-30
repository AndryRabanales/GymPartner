import { Bell } from 'lucide-react';

export const NotificationsPage = () => {
    return (
        <div className="min-h-screen bg-neutral-950 text-white p-4 pb-24">
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center border border-neutral-800">
                    <Bell size={32} className="text-gym-primary" />
                </div>
                <h2 className="text-xl font-black italic uppercase">Tus Notificaciones</h2>
                <p className="text-neutral-500 max-w-xs">
                    Estamos trabajando en un sistema de alertas en tiempo real.
                    <br />
                    ¡Pronto verás aquí tus likes, comentarios y desafíos!
                </p>
            </div>
        </div>
    );
};
