# DOCUMENTO DE ENTREGA FINAL: PROYECTO GYM PARTNER
**Materia:** Mantenimiento de Software

Este documento consolida toda la información requerida para la presentación y el plan de trabajo del curso.

---

# PARTE 1: INFORMACIÓN DEL PROYECTO

## 1.1 Necesidad y Motivación (¿Por qué se hizo?)
**El Problema:**
*   Los usuarios de gimnasio pierden el control de sus progresos al usar notas de papel desorganizadas.
*   Existe una falta de validación real de la asistencia ("No fui, pero dije que sí").
*   Entrenar solo es desmotivante sin un factor social.

**La Solución (GymPartner):**
*   Una App Web Progresiva (PWA) que digitaliza el entrenamiento.
*   **Innovación:** Usa geolocalización (GPS) para validar que el usuario realmente está en el gimnasio antes de permitirle registrar datos ("Proof of Workout").
*   **Factor Social:** Un feed de actividad local y gamificación (XP) para competir con amigos.

## 1.2 Principales Requerimientos
1.  **Gestión de Rutinas:** Crear rutinas personalizadas y registrar series/repeticiones/peso en tiempo real.
2.  **Geolocalización:** Mapa interactivo con detección de gimnasios en un radio de 120m.
3.  **Red Social:** Feed de noticias, sistema de "Likes" y Perfiles de Usuario.
4.  **Gamificación:** Sistema de Niveles (XP) y Gráficas de Radar de habilidades.

## 1.3 Arquitectura de Software
El sistema utiliza una arquitectura **Client-Server moderna basada en servicios**:
*   **Frontend (Cliente):** React 19 + TypeScript (Single Page Application).
*   **Backend (Servicios):** Supabase (BaaS - Backend as a Service) para Base de Datos y Autenticación.
*   **Persistencia:** Base de Datos Relacional (PostgreSQL) con seguridad a nivel de fila (RLS).
*   **Patrones:** Singleton (Servicios), Facade (API), Observer (Estado Global) y Atomic Design (Componentes).

---

# PARTE 2: PLAN DE MANTENIMIENTOS (LOS 8 PUNTOS)

A continuación, los mantenimientos específicos que se realizarán durante las sesiones 7-10.

## BLOQUE A: MANTENIMIENTO CORRECTIVO (Arreglar lo que falla)
*Objetivo: Corregir errores (bugs) detectados en el uso real.*

### 1. Corrección de Duplicidad en Historial
*   **El Error:** Al revisar el historial de entrenamientos pasados, los ejercicios aparecen duplicados o triplicados, falseando el volumen total de carga.
*   **La Solución:** Depurar la consulta `JOIN` en la base de datos y filtrar IDs únicos en la interfaz para mostrar solo una entrada por ejercicio.

### 2. Corrección de Notificaciones Persistentes
*   **El Error:** Las notificaciones (ej. "A Juan le gustó tu rutina") siguen apareciendo como "No leídas" incluso después de abrirlas.
*   **La Solución:** Reparar la función de actualización de estado (`markAsRead`) para asegurar que el cambio se guarde permanentemente en la base de datos.

## BLOQUE B: MANTENIMIENTO PERFECTIVO (Mejorar la experiencia)
*Objetivo: Hacer que el software sea mejor, más rápido o más bonito, aunque no esté "roto".*

### 3. Rediseño de Claridad Visual en Historial
*   **La Mejora:** Actualmente los datos del historial son confusos de leer. Se rediseñará la tarjeta de visualización para que sea más clara, con mejor jerarquía visual y separación de series.
*   **Beneficio:** Mejor usabilidad para el usuario final.

### 4. Refinamiento del Estado "En Línea"
*   **La Mejora:** El indicador verde de "En Línea" a veces se queda pegado aunque el usuario ya no esté. Se ajustará el algoritmo para detectar la desconexión más rápido.
*   **Beneficio:** Información más precisa y ahorro de batería/recursos.

## BLOQUE C: MANTENIMIENTO PREVENTIVO (Cuidar el futuro)
*Objetivo: Mejorar la calidad interna del código para evitar errores futuros.*

### 5. Blindaje de Tipos (TypeScript Hardening)
*   **La Tarea:** Reemplazar el uso de variables tipo `any` (que aceptan cualquier cosa) por Interfaces estrictas.
*   **Beneficio:** Evita que el programa falle si en el futuro la base de datos envía un texto en lugar de un número.

### 6. Centralización de Constantes y Textos
*   **La Tarea:** Mover todos los nombres de tablas repetidos y rutas a un solo archivo `AppConstants.ts`.
*   **Beneficio:** Si cambia el nombre de una tabla, solo se edita un archivo en lugar de 50.

## BLOQUE D: MANTENIMIENTO ADAPTATIVO (Adaptarse al mundo)
*Objetivo: Que la app sobreviva a cambios en celulares o navegadores nuevos.*

### 7. Adaptación a GPS de Alta Seguridad
*   **La Tarea:** Actualizar el código de mapas para cumplir con los nuevos requisitos de permisos de los navegadores modernos (Chrome 120+).
*   **Beneficio:** Evita que la función de mapa deje de funcionar en los celulares nuevos.

### 8. Adaptación a Pantallas con "Notch" (Isla Dinámica)
*   **La Tarea:** Ajustar el diseño visual superior para respetar las "áreas seguras" de los iPhones y Androids modernos.
*   **Beneficio:** Evita que la cámara frontal tape los botones del menú.
