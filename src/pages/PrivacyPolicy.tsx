import { Shield, ArrowLeft, MapPin, MessageSquare, Dumbbell, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PrivacyPolicy = () => {
    return (
        <div className="min-h-screen bg-neutral-950 text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <div className="max-w-2xl mx-auto px-6 py-12">

                {/* Header */}
                <div className="mb-10">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                            <Shield size={16} className="text-yellow-400" />
                        </div>
                        <span className="text-yellow-400 text-[11px] font-black uppercase tracking-widest">GINX</span>
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tight mb-3 text-white">
                        Política de Privacidad
                    </h1>
                    <p className="text-neutral-500 text-sm">
                        Última actualización: junio de 2026
                    </p>
                </div>

                {/* Intro */}
                <div className="bg-white/3 border border-white/8 rounded-2xl p-5 mb-8">
                    <p className="text-neutral-300 text-sm leading-relaxed">
                        GINX (<em>"nosotros"</em>, <em>"la app"</em>) se compromete a proteger tu privacidad.
                        Esta política describe qué datos recopilamos, cómo los usamos y cómo los protegemos.
                        Al usar GINX, aceptas las prácticas descritas en este documento.
                    </p>
                </div>

                <div className="space-y-8">

                    {/* Section 1 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">01</span>
                            Información que recopilamos
                        </h2>
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <UserCheck size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-white text-sm font-bold mb-1">Datos de perfil</p>
                                    <p className="text-neutral-400 text-xs leading-relaxed">
                                        Nombre, foto de perfil y correo electrónico obtenidos a través de tu proveedor
                                        de inicio de sesión (Google o Meta/Facebook). Fecha de nacimiento para
                                        verificación de edad (no se almacena en nuestros servidores).
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <MapPin size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-white text-sm font-bold mb-1">Datos de ubicación</p>
                                    <p className="text-neutral-400 text-xs leading-relaxed">
                                        Coordenadas GPS cuando usas el check-in en gimnasios o el radar de usuarios
                                        cercanos. La ubicación solo se accede cuando la app está en primer plano y
                                        con tu consentimiento explícito.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Dumbbell size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-white text-sm font-bold mb-1">Datos de entrenamiento</p>
                                    <p className="text-neutral-400 text-xs leading-relaxed">
                                        Ejercicios, series, repeticiones, pesos, duración de sesiones e historial
                                        de entrenamientos. Puntos GX, logros y estadísticas de rendimiento.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <MessageSquare size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-white text-sm font-bold mb-1">Mensajes y actividad social</p>
                                    <p className="text-neutral-400 text-xs leading-relaxed">
                                        Contenido de conversaciones con otros usuarios, solicitudes de entrenamiento
                                        cooperativo, notificaciones, seguidores y seguidos.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* Section 2 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">02</span>
                            Cómo usamos tu información
                        </h2>
                        <ul className="space-y-2 text-neutral-400 text-xs leading-relaxed">
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Mostrar tu perfil y el de otros usuarios de la comunidad</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Registrar check-ins en gimnasios y mostrarte en el mapa de usuarios activos</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Sincronizar sesiones de entrenamiento cooperativo en tiempo real</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Enviar notificaciones relevantes (invitaciones, mensajes, logros)</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Calcular y asignar puntos GX, estadísticas y rankings</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Mejorar el rendimiento y la experiencia de la app mediante datos de uso anónimos</li>
                        </ul>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* Section 3 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">03</span>
                            Compartición de datos con terceros
                        </h2>
                        <div className="space-y-3 text-neutral-400 text-xs leading-relaxed">
                            <p>
                                Compartimos datos <strong className="text-white">únicamente</strong> con los siguientes terceros y solo en la medida necesaria:
                            </p>
                            <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-white font-bold text-xs mb-0.5">Google y Meta/Facebook</p>
                                        <p className="text-neutral-500 text-[11px]">Proveedores de autenticación (sign-in)</p>
                                    </div>
                                    <span className="text-yellow-400 text-[10px] font-black uppercase">Auth</span>
                                </div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-white font-bold text-xs mb-0.5">Supabase</p>
                                        <p className="text-neutral-500 text-[11px]">Infraestructura de base de datos y almacenamiento</p>
                                    </div>
                                    <span className="text-yellow-400 text-[10px] font-black uppercase">DB</span>
                                </div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-white font-bold text-xs mb-0.5">Google Maps</p>
                                        <p className="text-neutral-500 text-[11px]">Visualización de mapa y búsqueda de gimnasios</p>
                                    </div>
                                    <span className="text-yellow-400 text-[10px] font-black uppercase">Maps</span>
                                </div>
                            </div>
                            <p className="text-neutral-500">
                                <strong className="text-white">No vendemos</strong> tus datos personales a terceros ni los usamos para publicidad.
                            </p>
                        </div>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* Section 4 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">04</span>
                            Almacenamiento y seguridad
                        </h2>
                        <ul className="space-y-2 text-neutral-400 text-xs leading-relaxed">
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Datos almacenados en servidores seguros de Supabase con cifrado en tránsito (TLS 1.3)</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Acceso restringido mediante autenticación de fila (Row Level Security)</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Los datos se conservan mientras tu cuenta esté activa</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Al eliminar tu cuenta, tus datos personales se borran de nuestros servidores en un plazo de 30 días</li>
                        </ul>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* Section 5 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">05</span>
                            Tus derechos
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed mb-3">
                            De acuerdo con la normativa aplicable, tienes derecho a:
                        </p>
                        <ul className="space-y-2 text-neutral-400 text-xs leading-relaxed">
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> <strong className="text-white">Acceso:</strong> obtener una copia de los datos que tenemos sobre ti</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> <strong className="text-white">Rectificación:</strong> corregir datos inexactos o incompletos</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> <strong className="text-white">Eliminación:</strong> borrar tu cuenta y datos desde Configuración {">"} Eliminar cuenta</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> <strong className="text-white">Portabilidad:</strong> solicitar tus datos en formato legible</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> <strong className="text-white">Oposición:</strong> retirar tu consentimiento en cualquier momento</li>
                        </ul>
                        <div className="mt-4 bg-yellow-400/5 border border-yellow-400/20 rounded-xl px-4 py-3">
                            <p className="text-yellow-400/80 text-xs">
                                Para ejercer estos derechos, escríbenos a{' '}
                                <a href="mailto:ginxapp@gmail.com" className="text-yellow-400 font-bold underline">
                                    ginxapp@gmail.com
                                </a>
                            </p>
                        </div>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* Section 6 — Age */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">06</span>
                            Edad mínima
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed">
                            GINX está diseñado para personas de <strong className="text-white">16 años o más</strong>.
                            Al ser una app que facilita contacto directo entre usuarios, mensajería y encuentros
                            físicos en gimnasios, requerimos esta edad mínima para proteger a los menores.
                        </p>
                        <p className="text-neutral-400 text-xs leading-relaxed mt-2">
                            No recopilamos intencionalmente datos de personas menores de 16 años.
                            Si tienes constancia de que un menor ha creado una cuenta, contáctanos
                            en <a href="mailto:ginxapp@gmail.com" className="text-yellow-400">ginxapp@gmail.com</a> para
                            proceder a su eliminación.
                        </p>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* Section 7 — Location */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">07</span>
                            Datos de ubicación
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                            La app solicita acceso a tu ubicación para:
                        </p>
                        <ul className="space-y-2 text-neutral-400 text-xs leading-relaxed mb-3">
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Detectar automáticamente el gimnasio donde entrenas (check-in)</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Mostrar gimnasios y usuarios cercanos en el mapa</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Verificar la ubicación al finalizar una sesión (bonificación GX)</li>
                        </ul>
                        <p className="text-neutral-500 text-xs">
                            Puedes desactivar el acceso a la ubicación desde la configuración de tu dispositivo.
                            Algunas funciones dejarán de estar disponibles, pero la app seguirá funcionando.
                        </p>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* Section 8 — Changes */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">08</span>
                            Cambios en esta política
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed">
                            Podemos actualizar esta política periódicamente para reflejar cambios en nuestras
                            prácticas o en la legislación aplicable. Te notificaremos dentro de la app sobre
                            cambios significativos. El uso continuado de GINX tras las modificaciones implica
                            la aceptación de la nueva política.
                        </p>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* Section 9 — Contact */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">09</span>
                            Contacto
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed mb-3">
                            Para cualquier consulta, queja o ejercicio de derechos relacionados con tu privacidad:
                        </p>
                        <a
                            href="mailto:ginxapp@gmail.com"
                            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold hover:bg-white/8 transition-colors"
                        >
                            <Shield size={14} className="text-yellow-400" />
                            ginxapp@gmail.com
                        </a>
                    </section>

                </div>

                {/* Back link */}
                <div className="mt-12 pt-8 border-t border-white/5">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-yellow-400 hover:text-yellow-300 text-sm font-bold transition-colors no-underline"
                    >
                        <ArrowLeft size={16} />
                        Volver a GINX
                    </Link>
                </div>

            </div>
        </div>
    );
};
