# DOCUMENTO MAESTRO DE REQUISITOS DE SOFTWARE - GYM PARTNER
**Versión:** 1.0.0
**Estado:** Aprobado para Mantenimiento

Este documento detalla exhaustivamente todos los requisitos funcionales y no funcionales del sistema GymPartner, así como la lista de defectos conocidos (bugs) a corregir.

---

# 1. REQUISITOS FUNCIONALES (RF)

## Módulo A: Gestión de Usuarios y Acceso
1.  **RF-01**: El sistema debe permitir el registro de nuevos usuarios mediante correo electrónico y contraseña.
2.  **RF-02**: El sistema debe permitir el inicio de sesión mediante autenticación social (Google OAuth).
3.  **RF-03**: El sistema debe validar que las contraseñas tengan un nivel mínimo de seguridad (longitud).
4.  **RF-04**: El sistema debe permitir al usuario cerrar sesión de forma segura.
5.  **RF-05**: El sistema debe permitir recuperar la contraseña mediante un enlace al correo electrónico.
6.  **RF-06**: El sistema debe mantener la sesión iniciada (persistencia) aunque se cierre el navegador.

## Módulo B: Perfil y Personalización
7.  **RF-07**: El usuario debe poder subir y cambiar su foto de perfil (Avatar).
8.  **RF-08**: El usuario debe poder subir una imagen de portada (Banner) para su perfil.
9.  **RF-09**: El sistema debe permitir editar el "Nombre de Pantalla" (Username).
10. **RF-10**: El sistema debe permitir redactar una biografía corta (Bio) de hasta 150 caracteres.
11. **RF-11**: El usuario debe poder visualizar sus propias estadísticas acumuladas (Días entrenados, Nivel actual).
12. **RF-12**: El usuario debe poder visualizar el gráfico de radar (Spider Chart) con sus niveles de habilidad.

## Módulo C: Geolocalización y gimnasios
13. **RF-13**: El sistema debe solicitar permisos de ubicación al dispositivo del usuario.
14. **RF-14**: El sistema debe mostrar un mapa interactivo centrado en la ubicación actual del usuario.
15. **RF-15**: El sistema debe identificar y mostrar marcadores de gimnasios registrados en un radio de 120 metros.
16. **RF-16**: El usuario debe poder ver los detalles de un gimnasio al hacer clic en su marcador (Nombre, Dirección).
17. **RF-17**: El usuario debe poder seleccionar un gimnasio principal ("Sede") para su pasaporte.
18. **RF-18**: El sistema debe permitir realizar "Check-in" solo si el GPS valida que el usuario está físicamente en el rango geográfico del gimnasio.
19. **RF-19**: El usuario debe poder registrar un nuevo gimnasio si este no existe en el mapa (Crowdsourcing).

## Módulo D: Gestión de Rutinas y Ejercicios
20. **RF-20**: El usuario debe poder crear una nueva rutina de entrenamiento vacía.
21. **RF-21**: El usuario debe poder asignar un nombre y una descripción a su rutina.
22. **RF-22**: El sistema debe permitir agregar ejercicios a una rutina desde un catálogo predefinido.
23. **RF-23**: El usuario debe poder buscar ejercicios por nombre o filtrar por grupo muscular.
24. **RF-24**: El usuario debe poder reordenar los ejercicios dentro de una rutina.
25. **RF-25**: El usuario debe poder eliminar ejercicios de una rutina.
26. **RF-26**: El usuario debe poder marcar una rutina como "Pública" (visible para otros) o "Privada".
27. **RF-27**: El sistema debe permitir clonar (copiar) la rutina de otro usuario a la biblioteca personal.

## Módulo E: Ejecución de Entrenamiento (Core)
28. **RF-28**: El usuario debe poder iniciar una "Sesión de Entrenamiento" activa basada en una rutina.
29. **RF-29**: El sistema debe permitir registrar series individualmente (Peso y Repeticiones).
30. **RF-30**: El sistema debe permitir alternar la unidad de medida de peso entre Kilogramos (KG) y Libras (LB).
31. **RF-31**: El sistema debe iniciar un cronómetro de descanso automático al completar una serie.
32. **RF-32**: El usuario debe poder marcar ejercicios como "Completados" (Check).
33. **RF-33**: El sistema debe calcular el volumen total de carga de la sesión en tiempo real.
34. **RF-34**: El sistema debe guardar el historial de la sesión al finalizar el entrenamiento.
35. **RF-35**: El usuario debe poder cancelar una sesión en curso sin guardar datos.

## Módulo F: Social y Gamificación
36. **RF-36**: El sistema debe mostrar un "Feed" (Muro) con actividades recientes de usuarios cercanos o seguidos.
37. **RF-37**: El usuario debe poder dar "Me Gusta" (Like) a las actividades de otros usuarios.
38. **RF-38**: El usuario debe recibir notificaciones visuales cuando alguien interactúa con su perfil.
39. **RF-39**: El sistema debe otorgar Puntos de Experiencia (XP) al finalizar un entrenamiento.
40. **RF-40**: El usuario debe subir de "Nivel" automáticamente al alcanzar ciertos umbrales de XP.
41. **RF-41**: El sistema debe mostrar una lista de "Check-ins activos" (Usuarios entrenando ahora mismo en el mismo gimnasio).
42. **RF-42**: El sistema debe permitir buscar a otros usuarios por nombre.

## Módulo G: Configuración y Varios
43. **RF-43**: El usuario debe poder eliminar su cuenta permanentemente (Borrado de datos/GDPR).
44. **RF-44**: El usuario debe poder activar o desactivar el sonido del cronómetro.
45. **RF-45**: El sistema debe gestionar errores de conexión (Modo Offline limitado).

---

# 2. REQUISITOS NO FUNCIONALES (RNF)

46. **RNF-01 (Portabilidad):** La aplicación debe ser una Progressive Web App (PWA) instalable en iOS y Android.
47. **RNF-02 (Rendimiento):** El tiempo de carga inicial de la aplicación (FCP) debe ser menor a 2.5 segundos en redes 4G.
48. **RNF-03 (Interfaz):** El diseño debe ser 100% Responsivo (Mobile-First) y adaptarse a pantallas desde 320px de ancho.
49. **RNF-04 (Seguridad):** El acceso a los datos de la base de datos debe estar restringido por políticas RLS (Row Level Security) donde cada usuario solo edita sus propios registros.
50. **RNF-05 (Disponibilidad):** La autenticación debe depender de servicios en la nube de alta disponibilidad (Supabase Auth 99.9% Uptime).
51. **RNF-06 (Privacidad):** La ubicación precisa del usuario NO debe guardarse en el historial, solo la referencia al gimnasio.
52. **RNF-07 (Escalabilidad):** La base de datos debe soportar el crecimiento de usuarios sin requerir cambios de arquitectura (Serverless).

---

# 3. LISTA DE BUGS (DEFECTOS) A ARREGLAR

Esta lista constituye la base para el plan de **Mantenimiento Correctivo** inmediato:

1.  **[CRÍTICO] Duplicidad en Historial:** Los ejercicios realizados aparecen duplicados en la vista de historial detallado, mostrando el doble de series de las realmente ejecutadas.
2.  **[MEDIO] Notificaciones "Zombies":** Las notificaciones marcadas como leídas vuelven a aparecer como "No leídas" al refrescar la página.
3.  **[MEDIO] Estado "En Línea" Pegado:** El indicador verde de presencia sigue activo mucho tiempo después de que el usuario ha cerrado la aplicación.
4.  **[BAJO] Visibilidad del Historial:** La tarjeta de historial tiene bajo contraste y mala jerarquía, dificultando la lectura rápida de los pesos levantados.
5.  **[BAJO] Desborde de Texto en Mapas:** Nombres de gimnasios muy largos rompen la tarjeta de información en pantallas de móviles pequeños (iPhone SE).
6.  **[BAJO] Iconos de Ejercicios:** Algunos ejercicios antiguos no cargan su icono correctamente debido a un fallo en la migración de datos (Hydration Fallback).
