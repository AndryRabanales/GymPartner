# PROYECTO DE MANTENIMIENTO DE SOFTWARE: GymPartner

> Este documento contiene el texto sugerido para las diapositivas de la presentación. Copia y pega el contenido en tu PowerPoint.

---

## 1. Diapositiva de Título (Portada)

**Título del Proyecto:**
GymPartner: Tu compañero de entrenamiento inteligente.

**Equipo de Desarrollo:**
*   [Nombre del Integrante 1]
*   [Nombre del Integrante 2]
*   [Nombre del Integrante 3]
*   [Nombre del Integrante 4]

**Materia:**
Mantenimiento de Software

---

## 2. Necesidad y Motivación

**El Problema:**
*   Los entusiastas del gimnasio a menudo pierden el rastro de sus progresos al usar notas de papel o aplicaciones genéricas poco intuitivas.
*   Falta de validación real de asistencia al gimnasio (la gente dice que va, pero no va).
*   Entrenar solo puede ser desmotivante sin un componente social o competitivo.

**La Solución (GymPartner):**
*   Una aplicación web progresiva (PWA) que digitaliza la gestión de rutinas y ejercicios.
*   **Innovación:** Validación de asistencia mediante Geolocalización (GPS) para garantizar que el usuario realmente está en un gimnasio ("Proof of Workout").
*   Gamificación y redes sociales para aumentar la retención y motivación.

---

## 3. Principales Requerimientos Funcionales

El sistema cumple con los siguientes módulos clave para garantizar su operación:

1.  **Gestión de Entrenamiento (Core):**
    *   Creación y personalización de rutinas.
    *   Registro de sesiones de entrenamiento en tiempo real (Series, Repeticiones, Peso en Kg/Lb).
    *   Cronómetro de descanso integrado.

2.  **Geolocalización y Validación:**
    *   Detección de gimnasios cercanos (Radio de 120m).
    *   Check-in automático o manual verificado por coordenadas GPS.

3.  **Componente Social:**
    *   Perfil de usuario con estadísticas (Nivel, Días entrenados).
    *   Feed de actividades (ver entrenamientos de amigos).
    *   Sistema de "Likes" para interacción.

4.  **Análisis de Progreso:**
    *   Gráficos de volumen de carga por grupo muscular (Radar Chart).
    *   Historial detallado de sesiones anteriores.

---

## 4. Arquitectura de Software

El proyecto sigue una arquitectura **Client-Server moderna y desacoplada**:

**Front-End (Cliente):**
*   **Tecnología:** React 19 + Vite.
*   **Lenguaje:** TypeScript (para robustez y mantenimiento preventivo).
*   **Estilos:** TailwindCSS (Diseño modular y responsive).
*   **Estado:** React Context API + Custom Hooks.

**Back-End (BaaS - Backend as a Service):**
*   **Plataforma:** Supabase.
*   **Base de Datos:** PostgreSQL (Relacional).
*   **Lógica de Negocio:**
    *   Row Level Security (RLS) para seguridad de datos.
    *   PostgreSQL Functions (PL/pgSQL) para lógica compleja (ej. cálculo de scores, geolocalización).
*   **Almacenamiento:** Supabase Storage para fotos y medios.

**Infraestructura y Despliegue:**
*   **Hosting Frontend:** Railway / Vercel.
*   **Integración Continua:** Flujo de desarrollo basado en Git.

---

## 5. Estrategia de Mantenimiento

Se aplicarán los cuatro tipos de mantenimiento al proyecto durante el curso:

*   **🛠️ Correctivo:** Solución de bugs reportados (ej. errores en el cálculo de coordenadas GPS, fallos visuales en móviles).
*   **✨ Perfectivo:** Mejoras de rendimiento y usabilidad (ej. optimizar la carga del Feed, añadir opción de modo oscuro/claro, soportar unidades imperiales/métricas).
*   **🛡️ Preventivo:** Refactorización de código legado, actualización de dependencias (React, Vite) y mejora de la cobertura de tipos en TypeScript.
*   **🔄 Adaptativo:** Ajustes para compatibilidad con nuevos navegadores móviles o cambios en las APIs externas (Google Maps API).

---
