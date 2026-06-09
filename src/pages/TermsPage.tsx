import { Shield, ArrowLeft, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TermsPage = () => {
    return (
        <div className="min-h-screen bg-neutral-950 text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <div className="max-w-2xl mx-auto px-6 py-12">

                {/* Header */}
                <div className="mb-10">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                            <FileText size={16} className="text-yellow-400" />
                        </div>
                        <span className="text-yellow-400 text-[11px] font-black uppercase tracking-widest">GINX</span>
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tight mb-3 text-white">
                        Términos y Condiciones
                    </h1>
                    <p className="text-neutral-500 text-sm">
                        Última actualización: junio de 2026
                    </p>
                </div>

                {/* Intro */}
                <div className="bg-white/3 border border-white/8 rounded-2xl p-5 mb-8">
                    <p className="text-neutral-300 text-sm leading-relaxed">
                        Bienvenido a <strong className="text-white">GINX</strong>. Al crear una cuenta o usar la aplicación,
                        aceptas estos Términos y Condiciones en su totalidad. Si no estás de acuerdo con alguno
                        de los términos, no uses la app.
                    </p>
                </div>

                <div className="space-y-8">

                    {/* 01 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">01</span>
                            Descripción del servicio
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed">
                            GINX es una aplicación social de fitness que permite a los usuarios registrar
                            entrenamientos, realizar check-ins en gimnasios, entrenar de forma cooperativa
                            con otros usuarios, enviar mensajes, compartir contenido de fitness y participar
                            en un sistema de gamificación (puntos GX, rankings y logros).
                        </p>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* 02 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">02</span>
                            Requisitos de uso
                        </h2>
                        <ul className="space-y-2 text-neutral-400 text-xs leading-relaxed">
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Debes tener al menos <strong className="text-white">16 años</strong> para usar GINX.</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Debes proporcionar información veraz al registrarte.</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Eres responsable de mantener la seguridad de tu cuenta.</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> No puedes crear más de una cuenta personal.</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Debes tener acceso a internet para usar la mayoría de las funciones.</li>
                        </ul>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* 03 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">03</span>
                            Conducta del usuario
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed mb-3">
                            Al usar GINX te comprometes a <strong className="text-white">NO</strong>:
                        </p>
                        <ul className="space-y-2 text-neutral-400 text-xs leading-relaxed">
                            <li className="flex gap-2"><span className="text-red-500/60">•</span> Acosar, amenazar o intimidar a otros usuarios.</li>
                            <li className="flex gap-2"><span className="text-red-500/60">•</span> Publicar contenido ofensivo, discriminatorio, pornográfico o ilegal.</li>
                            <li className="flex gap-2"><span className="text-red-500/60">•</span> Hacerse pasar por otra persona o crear perfiles falsos.</li>
                            <li className="flex gap-2"><span className="text-red-500/60">•</span> Usar la app para actividades comerciales no autorizadas o spam.</li>
                            <li className="flex gap-2"><span className="text-red-500/60">•</span> Intentar acceder a cuentas ajenas o sistemas no autorizados.</li>
                            <li className="flex gap-2"><span className="text-red-500/60">•</span> Manipular el sistema de puntos GX o rankings de forma fraudulenta.</li>
                            <li className="flex gap-2"><span className="text-red-500/60">•</span> Publicar datos personales de terceros sin su consentimiento.</li>
                        </ul>
                        <div className="mt-3 bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-3">
                            <p className="text-red-400/80 text-xs">
                                El incumplimiento de estas normas puede resultar en la suspensión permanente
                                de tu cuenta sin previo aviso.
                            </p>
                        </div>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* 04 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">04</span>
                            Contenido del usuario
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                            Conservas la propiedad de todo el contenido que publicas (fotos, vídeos, datos
                            de entrenamiento, etc.). Al publicarlo en GINX, nos concedes una licencia no
                            exclusiva, mundial y gratuita para mostrar, almacenar y distribuir ese contenido
                            dentro de la plataforma con el fin de operar el servicio.
                        </p>
                        <p className="text-neutral-400 text-xs leading-relaxed">
                            Eres el único responsable del contenido que publicas. GINX no asume
                            responsabilidad por contenido generado por usuarios.
                        </p>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* 05 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">05</span>
                            Propiedad intelectual
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed">
                            Todos los elementos de la app (diseño, código, logotipos, nombre "GINX",
                            sistema GX, iconografía y funcionalidades) son propiedad de GINX y están
                            protegidos por las leyes de propiedad intelectual aplicables. No puedes copiar,
                            modificar, distribuir ni crear obras derivadas sin autorización expresa por escrito.
                        </p>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* 06 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">06</span>
                            Aviso de salud y seguridad
                        </h2>
                        <div className="bg-yellow-400/5 border border-yellow-400/15 rounded-xl px-4 py-3 mb-3">
                            <p className="text-yellow-400/80 text-xs font-bold mb-1">⚠️ IMPORTANTE</p>
                            <p className="text-yellow-400/70 text-xs leading-relaxed">
                                GINX no proporciona asesoramiento médico ni de entrenamiento profesional.
                                El contenido de la app es solo de carácter informativo y social.
                            </p>
                        </div>
                        <p className="text-neutral-400 text-xs leading-relaxed">
                            Consulta siempre con un médico o profesional del deporte antes de comenzar
                            cualquier programa de ejercicio. Las actividades físicas conllevan riesgo de
                            lesión. GINX no se hace responsable de daños físicos derivados del uso de la app
                            o de la información compartida en ella.
                        </p>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* 07 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">07</span>
                            Limitación de responsabilidad
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                            En la máxima medida permitida por la ley aplicable, GINX no será responsable de:
                        </p>
                        <ul className="space-y-2 text-neutral-400 text-xs leading-relaxed">
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Pérdidas de datos, interrupciones del servicio o fallos técnicos.</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Conductas de otros usuarios dentro o fuera de la plataforma.</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Daños indirectos, incidentales o consecuentes derivados del uso de la app.</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Pérdida de puntos GX, logros o datos por errores técnicos.</li>
                        </ul>
                        <p className="text-neutral-400 text-xs leading-relaxed mt-2">
                            La app se proporciona <em>"tal como está"</em> sin garantías de disponibilidad
                            continua o ausencia de errores.
                        </p>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* 08 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">08</span>
                            Suspensión y terminación de cuentas
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed mb-2">
                            GINX se reserva el derecho a suspender o eliminar cualquier cuenta que:
                        </p>
                        <ul className="space-y-2 text-neutral-400 text-xs leading-relaxed mb-2">
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Incumpla estos Términos o la Política de Privacidad.</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Sea reportada múltiples veces por otros usuarios.</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Muestre actividad fraudulenta o automatizada (bots).</li>
                            <li className="flex gap-2"><span className="text-yellow-400">•</span> Haya sido inactiva durante más de 24 meses.</li>
                        </ul>
                        <p className="text-neutral-400 text-xs leading-relaxed">
                            También puedes eliminar tu cuenta en cualquier momento desde{' '}
                            <strong className="text-white">Menú de usuario → Eliminar cuenta</strong>.
                        </p>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* 09 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">09</span>
                            Modificaciones del servicio y los términos
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed">
                            GINX puede modificar estas condiciones o las características de la app en
                            cualquier momento. Notificaremos los cambios importantes a través de la app.
                            El uso continuado tras la publicación de los nuevos términos implica su aceptación.
                            Si no estás de acuerdo con los nuevos términos, debes dejar de usar la app y
                            eliminar tu cuenta.
                        </p>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* 10 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">10</span>
                            Ley aplicable
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed">
                            Estos Términos se rigen por la legislación española y, en lo que corresponda,
                            por la normativa de la Unión Europea (incluyendo el RGPD). Cualquier disputa
                            se resolverá ante los tribunales competentes de España.
                        </p>
                    </section>

                    <div className="border-t border-white/5" />

                    {/* 11 */}
                    <section>
                        <h2 className="text-white font-black text-base uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-yellow-400 text-xs font-black">11</span>
                            Contacto
                        </h2>
                        <p className="text-neutral-400 text-xs leading-relaxed mb-3">
                            Para cualquier consulta sobre estos Términos:
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

                {/* Privacy Policy link */}
                <div className="mt-10 bg-white/3 border border-white/8 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-white text-xs font-bold">¿Tienes dudas sobre tus datos?</p>
                        <p className="text-neutral-500 text-xs mt-0.5">Consulta nuestra Política de Privacidad</p>
                    </div>
                    <Link
                        to="/privacy"
                        className="text-yellow-400 hover:text-yellow-300 text-xs font-black uppercase tracking-wide transition-colors no-underline flex items-center gap-1"
                    >
                        Ver →
                    </Link>
                </div>

                {/* Back link */}
                <div className="mt-8 pt-8 border-t border-white/5">
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
