# REQUISITOS DEL SISTEMA: GYM PARTNER

Este documento desglosa los requerimientos funcionales y no funcionales más importantes del proyecto, organizados por módulos.

---

## 1. MÓDULO DE GESTIÓN DE USUARIOS (AUTENTICACIÓN)
*   **Registro e Inicio de Sesión:** El sistema debe permitir el registro mediante correo electrónico/contraseña y autenticación social (Google Auth).
*   **Gestión de Perfil:** El usuario debe poder personalizar su perfil con:
    *   Foto de avatar y banner.
    *   Nombre de usuario único.
    *   Descripción corta (Bio).
*   **Pasaporte de Gimnasios:** El usuario debe poder asociar uno o más gimnasios a su cuenta como "Sedes".

## 2. MÓDULO DE ENTRENAMIENTO (CORE)
*   **Creación de Rutinas:** El usuario debe poder crear rutinas personalizadas, asignándoles nombre y día de la semana.
*   **Catálogo de Ejercicios:** El sistema debe proveer una base de datos de ejercicios clasificados por grupo muscular (Pecho, Espalda, Pierna, etc.).
*   **Registro de Series (Logging):** Durante una sesión, el usuario debe poder registrar en tiempo real:
    *   Peso (Kg o Lb).
    *   Repeticiones.
    *   RPE (Esfuerzo percibido).
*   **Cronómetro de Descanso:** El sistema debe iniciar automáticamente un temporizador de descanso al finalizar una serie.
*   **Historial:** El usuario debe poder consultar el historial de sus entrenamientos pasados.

## 3. MÓDULO DE GEOLOCALIZACIÓN (GPS)
*   **Detección de Gimnasios:** El sistema debe identificar gimnasios cercanos utilizando la API de Google Maps en un radio de 120 metros.
*   **Validación de Presencia (Proof of Workout):** El sistema **solo** debe permitir iniciar ciertos eventos (como Check-ins oficiales) si las coordenadas GPS del usuario coinciden con las del gimnasio.
*   **Mapa Interactivo:** Visualización de gimnasios cercanos en un mapa integrado.

## 4. MÓDULO SOCIAL Y GAMIFICACIÓN
*   **Feed de Actividad:** El sistema debe mostrar un muro con los entrenamientos recientes de otros usuarios del mismo gimnasio o seguidos.
*   **Interacción (Likes):** Los usuarios deben poder dar "Me Gusta" a los entrenamientos de otros.
*   **Sistema de Niveles (XP):** El usuario debe ganar Puntos de Experiencia (XP) por acciones como:
    *   Registrar un entrenamiento completo.
    *   Hacer Check-in en un gimnasio.
    *   Recibir Likes.
*   **Radar de Habilidades:** Visualización gráfica (Gráfico de Radar) que muestre el balance de entrenamiento del usuario (Fuerza, Cardio, Resistencia, etc.).

## 5. REQUISITOS NO FUNCIONALES (TÉCNICOS)
*   **Disponibilidad (PWA):** La aplicación debe ser instalable en dispositivos móviles (Android/iOS) y funcionar como una App nativa.
*   **Rendimiento:** La carga inicial de la aplicación debe ser menor a 2 segundos en redes 4G.
*   **Seguridad de Datos:** Los datos privados (rutinas ocultas) no deben ser accesibles por otros usuarios (garantizado por Row Level Security).
*   **Persistencia Local:** La aplicación debe recordar la última sesión iniciada para no pedir credenciales cada vez.
*   **Adaptabilidad (Responsive):** La interfaz debe ajustarse automáticamente a pantallas de móviles, tablets y escritorio.
