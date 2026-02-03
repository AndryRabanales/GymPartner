# PLAN DE MANTENIMIENTOS PROPUESTOS - GYM PARTNER

A continuación, se describen las 2 tareas específicas por cada tipo de mantenimiento que se realizarán durante el curso, incluyendo la corrección de fallos reportados actualmente.

---

## 1. MANTENIMIENTO CORRECTIVO (Corregir errores)
*Se realiza para reparar defectos o "bugs" que producen resultados incorrectos en la aplicación.*

### Propuesta 1.1: Corrección de Duplicidad en Historial de Ejercicios
*   **Problema Real:** El módulo de historial (`WorkoutHistory.tsx`) renderiza dos veces el mismo ejercicio realizado en una sesión, causando confusión en los datos totales.
*   **Solución Técnica:** Depurar la consulta SQL (`join`) en `WorkoutService` o filtrar duplicados en el frontend utilizando un `Set` o validando IDs únicos antes de renderizar la lista.

### Propuesta 1.2: Corrección de Persistencia en Notificaciones Leídas
*   **Problema Real:** Las notificaciones que el usuario ya abrió o marcó como leídas siguen apareciendo como "Nuevas/No Leídas" al recargar la página.
*   **Solución Técnica:** Corregir la función `markAsRead()` en el servicio de notificaciones para asegurar que el estado `read: true` se persista correctamente en la base de datos Supabase en tiempo real.

---

## 2. MANTENIMIENTO PERFECTIVO (Mejorar lo que ya funciona)
*Se realiza para mejorar la experiencia de usuario (UX), el rendimiento o la eficiencia, sin que sea necesariamente un "error".*

### Propuesta 2.1: Rediseño de Claridad Visual en el Historial
*   **Motivación:** El usuario reporta que, aunque los datos del historial se muestran, "no se ven claramente" (son confusos o difíciles de leer).
*   **Mejora:** Rediseñar la tarjeta de historial (`HistoryCard`) para usar una jerarquía visual más limpia, mejores contrastes y agrupar las series de forma colapsable, mejorando la legibilidad de los datos.

### Propuesta 2.2: Refinamiento del Sistema de Presencia (Estado "En Línea")
*   **Motivación:** El indicador "En Línea" es demasiado agresivo y a veces muestra al usuario conectado perpetuamente, lo cual es molesto aunque técnicamente no rompe la app.
*   **Mejora:** Optimizar el algoritmo de "Heartbeat" (latido) en `PresenceService` para que el estado pase a "Ausente" u "Offline" más rápido cuando se cierra la pestaña o se pierde el foco, haciendo el sistema más preciso y eficiente.

---

## 3. MANTENIMIENTO PREVENTIVO (Prevenir fallos futuros)
*Se realiza para mejorar la estructura interna del código (Refactoring) y evitar que el software se degrade o rompa en el futuro.*

### Propuesta 3.1: Eliminación de Tipos "Any" (Hardening con TypeScript)
*   **Justificación:** El uso excesivo de `any` en los servicios de usuario pone en riesgo la estabilidad futura si la base de datos cambia.
*   **Acción:** Implementar interfaces estrictas (ej. `interface UserProfile`) para blindar el código contra cambios estructurales inesperados.

### Propuesta 3.2: Centralización de Constantes (Refactoring)
*   **Justificación:** Existen cadenas de texto "mágicas" (ej. nombres de tablas, rutas) repetidas por todo el código. Cambiar una requeriría editar 20 archivos (alto riesgo de error).
*   **Acción:** Mover todas estas cadenas a un archivo único `AppConstants.ts` para facilitar cambios globales seguros.

---

## 4. MANTENIMIENTO ADAPTATIVO (Adaptarse a cambios del entorno)
*Se realiza para adaptar el software a cambios en el entorno operativo (nuevos navegadores, nuevos dispositivos, nuevas leyes).*

### Propuesta 4.1: Adaptación a Políticas de Geolocalización (Chrome 120+)
*   **Cambio Externo:** Los navegadores modernos han endurecido los permisos para acceder al GPS de alta precisión.
*   **Acción:** Actualizar el manejo de errores de geolocalización para cumplir con los estándares W3C actuales y evitar bloqueos en versiones futuras de Chrome/Safari.

### Propuesta 4.2: Adaptación de Interfaz para "Safe Areas" (Móviles Nuevos)
*   **Cambio Externo:** Los dispositivos recientes (iPhone 15, Androids nuevos) tienen "Notch" o islas dinámicas en la pantalla que tapan el contenido antiguo.
*   **Acción:** Implementar variables CSS `env(safe-area-inset-top)` y `env(safe-area-inset-bottom)` para adaptar el diseño a las nuevas pantallas físicas del mercado.
