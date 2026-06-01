# GINX — Documento de Requisitos Técnicos
**Versión:** 1.0  
**Fecha:** 2026-06-01  
**Estado del proyecto:** Beta con usuarios reales  
**Audiencia:** Desarrollador principal  

---

## ÍNDICE

1. [Visión del Producto](#1-visión-del-producto)
2. [Stack Técnico](#2-stack-técnico)
3. [Arquitectura General](#3-arquitectura-general)
4. [Módulo: Autenticación y Onboarding](#4-módulo-autenticación-y-onboarding) — ✅ COMPLETO
5. [Módulo: Perfil de Usuario](#5-módulo-perfil-de-usuario) — ⚠️ WIP
6. [Módulo: Workout (Sesión Individual)](#6-módulo-workout-sesión-individual) — ⚠️ WIP
7. [Módulo: Multiplayer / Coop](#7-módulo-multiplayer--coop) — 🔴 BUGS CRÍTICOS
8. [Módulo: Inventario y Arsenal](#8-módulo-inventario-y-arsenal) — ⚠️ WIP
9. [Módulo: Rutinas](#9-módulo-rutinas) — ⚠️ WIP
10. [Módulo: Mapa y Gestión de Gimnasios](#10-módulo-mapa-y-gestión-de-gimnasios) — ⚠️ WIP
11. [Módulo: Social — Reels y Community](#11-módulo-social--reels-y-community) — ⚠️ WIP
12. [Módulo: Gamificación](#12-módulo-gamificación) — ⚠️ WIP
13. [Módulo: Analytics y Stats](#13-módulo-analytics-y-stats) — ⚠️ WIP
14. [Módulo: Radar (Descubrimiento)](#14-módulo-radar-descubrimiento) — ⚠️ WIP
15. [Módulo: Mensajería Directa](#15-módulo-mensajería-directa) — ⚠️ WIP
16. [Módulo: Notificaciones](#16-módulo-notificaciones) — ⚠️ WIP
17. [Módulo: Challenges (Retos GX)](#17-módulo-challenges-retos-gx) — 🔲 PENDIENTE
18. [Módulo: Suscripciones / Stripe](#18-módulo-suscripciones--stripe) — 🔲 PENDIENTE
19. [Módulo: Inteligencia Artificial (Gemini)](#19-módulo-inteligencia-artificial-gemini) — 🔲 PENDIENTE
20. [Módulo: Geofencing Configurable](#20-módulo-geofencing-configurable) — 🔲 PENDIENTE
21. [Modelo de Datos Completo](#21-modelo-de-datos-completo)
22. [Flujos de Usuario End-to-End](#22-flujos-de-usuario-end-to-end)
23. [Sistema de Puntos GX y Gamificación](#23-sistema-de-puntos-gx-y-gamificación)
24. [Variables de Entorno y Configuración](#24-variables-de-entorno-y-configuración)
25. [Deuda Técnica y Limitaciones Conocidas](#25-deuda-técnica-y-limitaciones-conocidas)

---

## Leyenda de Estado

| Icono | Significado |
|-------|-------------|
| ✅ COMPLETO | Implementado y funcionando en producción |
| ⚠️ WIP | Implementado parcialmente o con issues menores |
| 🔴 BUG CRÍTICO | Funcionalidad con bugs que afectan usuarios reales |
| 🔲 PENDIENTE | Diseñado o parcialmente scaffoldeado, no implementado |
| ❌ DEPRECADO | Código existente pero reemplazado por nuevo sistema |

---

## 1. Visión del Producto

**GINX** es una plataforma social de fitness para móvil (iOS/Android/Web) que combina:

- **Tracking de entrenamiento** con métricas avanzadas
- **Sesiones cooperativas en tiempo real** entre usuarios
- **Gamificación profunda** (puntos GX, streaks, tiers, Alpha ranking por gimnasio)
- **Red social** (Reels, Community, mensajería directa, seguir usuarios)
- **Descubrimiento de usuarios** nearby vía Radar (swipe cards)
- **Gestión de gimnasios** con leaderboards, inventario de equipos y pasaportes

### Propuesta de Valor
> El gym como juego. La consistencia como victoria. Tu progreso como reputación.

### Usuarios Objetivo
- Gym-goers de 18–35 años con mentalidad competitiva
- Atletas que entrenan con compañeros (workout buddies)
- Usuarios de gyms comerciales y boutique

---

## 2. Stack Técnico

### Frontend
| Tecnología | Versión | Uso |
|-----------|---------|-----|
| React | 19.2.0 | Framework principal |
| TypeScript | 5.9 | Tipado estático |
| Vite | 7.2.4 | Build tool |
| Tailwind CSS | 3.4 | Estilos |
| React Router | 7.11 | Routing SPA |
| Recharts | 3.6 | Gráficas de estadísticas |
| React Hot Toast | 2.6 | Notificaciones UI |
| React Swipeable | 7.0.2 | Gestos táctiles (Radar) |
| Lucide React | 0.562 | Iconos |
| HTML2Canvas | 1.4.1 | Export/screenshots |

### Backend
| Tecnología | Uso |
|-----------|-----|
| Supabase (PostgreSQL) | Base de datos principal |
| Supabase Auth | Autenticación |
| Supabase Realtime | Subscripciones en tiempo real |
| Supabase Storage | Imágenes de perfil, fondos de gym |

### Servicios Externos
| Servicio | Uso |
|---------|-----|
| Google OAuth | Login con Google |
| Meta/Facebook OAuth | Login con Meta |
| Google Maps API | Mapa de gimnasios, geocodificación |
| Cloudinary | Hosting de videos (Reels) |
| @google/generative-ai (Gemini) | IA (SDK incluido, sin implementar) |
| Stripe | Pagos premium (sin implementar) |

### Mobile
| Tecnología | Uso |
|-----------|-----|
| Capacitor 8.3.4 | Wrapper iOS/Android |
| @capacitor/geolocation | Geolocalización nativa |

### Tema Visual
```
Colores base (tailwind.config.js):
  gym-primary:  #ffd700  (Oro)
  gym-dark:     #121212  (Negro)
  gym-card:     #1e1e1e  (Gris oscuro)
  gym-text:     #e0e0e0  (Gris claro)
  gym-accent:   #ff4d4d  (Rojo)

Estética: Dark mode + Gold accents + Glassmorphism
Tipografía: Bold, uppercase, italic — tono agresivo/motivacional
```

---

## 3. Arquitectura General

### Routing (App.tsx)
```
/              → UserProfile (dashboard principal)
/login         → LoginPage
/workout       → WorkoutSession
/workout/:gymId → WorkoutSession (gym específico)
/builder       → RoutineBuilder
/builder/:id   → RoutineBuilder (editar)
/arsenal       → MyArsenal
/map           → MapPage
/territory/:gymId → GymProfile
/ranking       → RankingPage
/community     → CommunityPage
/reels         → ReelsPage
/radar         → Radar
/stats         → StatsPage
/history       → HistoryPage
/history/:sessionId → WorkoutDetailPage
/notifications → NotificationsPage
/inbox         → InboxPage
/chat/:chatId  → ChatPage
/friends       → FriendsPage
/player/:username → PublicProfile
```

### Layout
- `AppLayout.tsx` envuelve todas las rutas autenticadas
- Contiene: `BottomNav`, `<Outlet>`, modals globales, y el **Auditor de Sesiones Coop** (background service)
- `BottomNavContext` controla visibilidad del nav (se oculta durante sessión activa y ciertos modals)

### Servicios (src/services/)
```
WorkoutService.ts      — CRUD de sesiones, sets, cálculo GX
UserService.ts         — Perfil, gym passport, puntos GX, referidos
SocialService.ts       — Posts, likes, comments, follows, views
AlphaService.ts        — Rankings de gimnasio
StreakService.ts       — Streaks diarios
ChallengeService.ts    — Retos GX entre usuarios
NotificationService.ts — CRUD notificaciones
ChatService.ts         — Mensajería directa
RadarService.ts        — Descubrimiento de usuarios nearby
TierService.ts         — Cálculo de tier por checkins
SubscriptionService.ts — Estado premium (placeholder)
```

### Contextos Globales
```
AuthContext.tsx       — Session de Supabase, OAuth, perfil, daily rewards
BottomNavContext.tsx  — Visibilidad del nav bottom
```

---

## 4. Módulo: Autenticación y Onboarding

### Estado: ✅ COMPLETO

### Descripción
Sistema de autenticación multi-proveedor con PKCE flow de Supabase, detección de entorno Instagram, y creación automática de perfil.

### Requisitos Implementados

**R-AUTH-01:** El sistema debe soportar login con:
- Google OAuth
- Meta/Facebook OAuth  
- Email OTP (magic link)
- Dev mode (bypass para desarrollo local)

**R-AUTH-02:** Si el usuario accede desde la app de Instagram (Instagram IAB / In-App Browser), mostrar pantalla de escape con instrucciones para abrir en Chrome/Safari. No intentar el OAuth dentro del IAB.

**R-AUTH-03:** Si el usuario viene referido desde Instagram (detectado por `document.referrer`), auto-iniciar el flow de Meta OAuth sin necesidad de que el usuario elija proveedor.

**R-AUTH-04:** En el primer sign-in, crear automáticamente un perfil en la tabla `profiles`:
- `username` generado como `${baseName}_${4 dígitos aleatorios}` (único)
- Bio y avatar por defecto
- `g_points` inicializado en 0 (o valor seed)
- Capturar `?ref=` de la URL para referral tracking

**R-AUTH-05:** La sesión debe persistir en localStorage y recuperarse automáticamente al recargar la app (Supabase implicit flow).

**R-AUTH-06:** Al detectar el hash token de OAuth en la URL (`#access_token=...`), procesarlo silenciosamente y redirigir a `/`.

**R-AUTH-07:** Leer el parámetro `?ref=` de la URL al momento del login y almacenarlo temporalmente para procesarlo con `userService.processReferral()` después de crear el perfil.

### Notas
- El username único se garantiza con sufijo de 4 dígitos, pero no hay proceso de cambio de username post-onboarding (gap potencial).
- No hay pantalla de onboarding tutorial post-registro (existe `TacticalTutorialModal` pero su activación no está completamente integrada).

---

## 5. Módulo: Perfil de Usuario

### Estado: ⚠️ WIP

### Descripción
Dashboard principal del usuario (`/`). Muestra stats, gym passport, rutinas guardadas, y acceso a modals de edición.

### Requisitos Implementados

**R-PROFILE-01:** Mostrar el perfil del usuario autenticado con:
- Avatar, username, descripción/bio
- Tier badge (IRON/BRONZE/SILVER/GOLD/DIAMOND/VIBRANIUM)
- Balance de GX points
- Streak actual con ícono de llama animada
- Conteo de check-ins (workouts completados)
- Seguidores / siguiendo

**R-PROFILE-02:** Mostrar sección "Mis Sedes" — lista de gimnasios del usuario (gym passport).
- Cada gym card muestra: nombre, dirección, imagen de fondo personalizable
- Home base marcado con indicador especial
- Tap en gym card → GymProfile

**R-PROFILE-03:** Sección de rutinas guardadas. Click → navega a `/builder/:id` para editar.

**R-PROFILE-04:** Modal `EditProfileModal` permite:
- Cambiar avatar (upload de imagen)
- Cambiar username
- Editar descripción/bio

**R-PROFILE-05:** Botón de Boost abre `BoostModal` — permite gastar 1000 GX para visibilidad aumentada por 7 días (campo `boost_until`).

**R-PROFILE-06:** Botón de Referral abre `ReferralModal` — muestra link de invitación con `?ref=username`.

### Requisitos Pendientes / Gaps

**R-PROFILE-07 [PENDIENTE]:** No existe pantalla para cambiar contraseña desde el perfil (solo aplica a usuarios email OTP, pero debería estar accesible).

**R-PROFILE-08 [PENDIENTE]:** La visualización del historial de Alpha Rankings (cuándo fue #1 en qué gyms) no está accesible desde el perfil propio. Está en DB (`alpha_history`) pero sin UI.

**R-PROFILE-09 [WIP]:** El campo `custom_settings` (JSONB) permite configuraciones personalizadas pero la UI para editarlas es incompleta. Solo se usa internamente para reward tracking.

---

## 6. Módulo: Workout (Sesión Individual)

### Estado: ⚠️ WIP

### Descripción
Página `WorkoutSession.tsx` — la feature más compleja de la app. Maneja el ciclo completo de una sesión de entrenamiento individual.

### Flujo Principal
```
/workout (o /workout/:gymId)
  → Cargar sesión activa si existe (localStorage: ginx_active_session)
  → Si hay sesión activa: mostrar ActiveSessionRescueModal
  → Si es primera vez: mostrar selector de ejercicios / inicio
  → Click "Start Battle" → workoutService.startSession()
  → Usuario agrega ejercicios desde WorkoutCarousel
  → Por cada ejercicio: registrar sets (peso, reps, RPE, tiempo, distancia)
  → Click "Finish Battle" → workoutService.finishSession(isManual=true)
  → Calcular duración, otorgar GX si >= 20 min y es 1er workout del día
  → Redirigir a /history
```

### Requisitos Implementados

**R-WORKOUT-01:** Iniciar sesión con `workoutService.startSession(userId, gymId?, isMultiplayer?, mode?, partnerId?)`. Crea registro en `workout_sessions`.

**R-WORKOUT-02:** Persistir estado de sesión activa en `localStorage` bajo clave `ginx_active_session` para sobrevivir recargas de página.

**R-WORKOUT-03:** Al recargar con sesión activa en localStorage, mostrar `ActiveSessionRescueModal` con opciones:
- **Continuar** — Restaurar estado completo de la sesión
- **Abandonar** — Borrar sesión y limpiar localStorage

**R-WORKOUT-04:** Selector de ejercicios (`WorkoutCarousel`) con:
- Búsqueda por nombre
- Filtro por grupo muscular
- Ejercicios del catálogo global (`exercises` table)
- Equipos del arsenal del usuario (`gym_equipment` table)

**R-WORKOUT-05:** Por cada ejercicio seleccionado, permitir agregar sets con:
- Peso (kg)
- Repeticiones
- RPE (1–10, escala de esfuerzo percibido)
- Tiempo (segundos)
- Distancia (metros)
- Métricas personalizadas (si el equipo tiene `metrics` JSONB configurado)

**R-WORKOUT-06:** Cada set se persiste en `workout_logs` con todos los campos, incluyendo `category_snapshot` (snapshot del grupo muscular para análisis histórico).

**R-WORKOUT-07:** Timer de descanso entre sets. Se muestra automáticamente después de registrar un set.

**R-WORKOUT-08:** `finishSession(sessionId, isManual=true)`:
- Solo `isManual=true` otorga GX (evita premios en auto-close del sistema)
- Requiere >= 20 minutos de duración para premio
- Solo el **primer** workout calificado del día gana GX
- Solo: +2 GX | Coop: +3 GX
- Incrementa `checkins_count` en `profiles`

**R-WORKOUT-09:** Guardar nombre de rutina y notas opcionales al finalizar.

**R-WORKOUT-10:** Notificar a seguidores "ENTRENANDO AHORA" al iniciar sesión (si el usuario tiene la sesión compartida en `history_shares`).

### Requisitos Pendientes / Gaps

**R-WORKOUT-11 [WIP]:** La detección de Personal Records (PR) existe en el modelo de datos (`is_pr` en `workout_logs`) pero la lógica de detección automática en la UI no está completamente implementada.

**R-WORKOUT-12 [WIP]:** Las métricas personalizadas (`custom_metric` en `routine_exercises`) están soportadas en DB pero la UI para crearlas/configurarlas desde el workout es limitada.

**R-WORKOUT-13 [PENDIENTE]:** No existe opción de "pausar" una sesión (diferente de abandonarla). Solo existe continuar o abandonar.

---

## 7. Módulo: Multiplayer / Coop (SALA PERSISTENTE)

### Estado: ✅ ARQUITECTURA CORREGIDA — 2026-06-01

### Descripción
Sistema de sesiones cooperativas en tiempo real donde dos usuarios entrenan juntos, ya sea con los mismos ejercicios ("Conjunto") o ejercicios separados ("Separado").

### Arquitectura Técnica
```
Usuario A crea sesión → workout_sessions (is_multiplayer=true, partner_id=B)
Usuario B acepta invite → workout_sessions (is_multiplayer=true, partner_id=A)
Ambas sesiones se linkean: partner_session_id → la sesión del otro
Modo "Conjunto": mismo listado de ejercicios, tracking separado por jugador
Modo "Separado": cada uno su lista independiente
Sincronización: Supabase Realtime subscriptions
```

### Requisitos Implementados

**R-COOP-01:** Desde `FriendsPage`, usuario puede enviar invitación coop a cualquier contacto.
- Cooldown anti-spam de 2 minutos por usuario
- Selección de modo: "Conjunto" (same exercises) o "Separado" (individual)
- Se envía notificación tipo `coop_invite`

**R-COOP-02:** El invitado recibe notificación en `NotificationsPage` con opción de Aceptar/Rechazar.

**R-COOP-03:** Al aceptar, ambos usuarios quedan en sesiones vinculadas (`partner_session_id`).

**R-COOP-04:** En modo "Conjunto", los sets de ambos jugadores se trackean por separado:
- Campos `p2_weight`, `p2_reps`, etc. en los datos del set (o campo `owner_id` en `workout_logs`)
- Cada jugador ve sus propias métricas vs las del partner

**R-COOP-05:** Sincronización en tiempo real vía Supabase subscriptions:
- Cambios en `workout_logs` del partner aparecen en la UI del otro
- Rest timers sincronizados (con sanitización de timers > 2 horas = reset)

**R-COOP-06:** Premio de GX al finalizar: +3 GX (vs +2 en solo) si es 1er workout calificado del día.

**R-COOP-07:** `AppLayout.tsx` contiene un **Auditor de Sesiones Coop** en background que:
- Detecta sesiones coop donde el partner abandonó
- Ofrece al usuario continuar como sesión individual
- Previene "sesiones zombie" que quedan abiertas indefinidamente

### 🔴 Bugs Conocidos y Críticos

**BUG-COOP-01 [CRÍTICO]:** Sesiones zombie/huérfanas persisten cuando:
- Un usuario cierra la app sin finalizar la sesión coop
- El partner ya finalizó su parte
- La sesión queda con `finished_at = null` indefinidamente
- **Impacto:** El usuario al volver a la app no puede iniciar nuevo workout, queda bloqueado

**BUG-COOP-02 [CRÍTICO]:** El `ActiveSessionRescueModal` para sesiones coop muertas no siempre se activa correctamente. La lógica de detección falla si `partner_session_id` es null o si la sesión del partner fue eliminada.

**BUG-COOP-03 [ALTO]:** Cuando una sesión coop zombie se convierte a individual (via rescue modal), las métricas previas del partner pueden perderse o quedarse en un estado inconsistente en DB.

**BUG-COOP-04 [MEDIO]:** Los timers de descanso sincronizados se pueden desfasar si hay latencia > 3s entre dispositivos. La sanitización de timers > 2h es un parche, no una solución real.

**BUG-COOP-05 [MEDIO]:** Si el invitado acepta la invitación pero el invitador ya finalizó su sesión (race condition), el invitado entra a un estado inválido.

### Requisitos Pendientes

**R-COOP-08 [PENDIENTE]:** Implementar expiración automática de sesiones coop inactivas por más de 4 horas vía Supabase Edge Function (cron job).

**R-COOP-09 [PENDIENTE]:** Agregar estado "en espera de partner" durante el periodo entre invitación enviada y aceptación (actualmente el invitador puede quedar en un limbo).

**R-COOP-10 [PENDIENTE]:** UI para ver métricas comparativas al final de la sesión coop: quién hizo más volumen, más reps, mejores PRs.

---

## 8. Módulo: Inventario y Arsenal

### Estado: ⚠️ WIP

### Descripción
`MyArsenal.tsx` — Gestión del inventario de equipos por gimnasio. Los equipos se usan como ejercicios en los workouts.

### Requisitos Implementados

**R-ARSENAL-01:** Vista de grilla (`ArsenalGrid`) de todos los equipos del usuario, filtrables por gym.

**R-ARSENAL-02:** Formulario `EquipmentForm` para agregar/editar equipo con:
- Nombre, categoría (FREE_WEIGHT, STRENGTH_MACHINE, CABLE, CARDIO, ACCESSORY)
- Cantidad, condición (GOOD/FAIR/POOR/BROKEN)
- Grupo muscular objetivo (para clasificación en stats de radar)
- Métricas trackeable (peso, reps, tiempo, distancia, custom)
- Imagen URL, icono emoji, notas

**R-ARSENAL-03:** Equipo puede ser scoped a un gym específico o global.

**R-ARSENAL-04:** Equipo del arsenal aparece en el selector de ejercicios dentro de WorkoutSession.

### Requisitos Pendientes

**R-ARSENAL-05 [PENDIENTE]:** No existe forma de importar/exportar el arsenal entre gyms del mismo usuario.

**R-ARSENAL-06 [PENDIENTE]:** El campo `verified_by` en `gym_equipment` sugiere un sistema de verificación comunitaria de equipos, pero no está implementado.

**R-ARSENAL-07 [WIP]:** La UI para crear métricas personalizadas (`custom_metric`) desde el arsenal existe parcialmente pero no persiste correctamente en el flujo workout → log.

---

## 9. Módulo: Rutinas

### Estado: ⚠️ WIP

### Descripción
`RoutineBuilder.tsx` — Creación y edición de rutinas de entrenamiento.

### Requisitos Implementados

**R-ROUTINE-01:** Crear rutina con nombre, descripción y lista de ejercicios ordenados.

**R-ROUTINE-02:** Por ejercicio en rutina, configurar:
- Campos a trackear: peso, reps, tiempo, PR
- Sets objetivo (`target_sets`)
- Rango de reps objetivo (`target_reps_text`, e.g. "10-12")
- Métrica custom

**R-ROUTINE-03:** Rutinas guardadas en `routines` + `routine_exercises` tables.

**R-ROUTINE-04:** Editar rutina existente via `/builder/:id`.

**R-ROUTINE-05:** Compartir rutina con otros usuarios via `ShareRoutineModal` → crea `history_shares` entries.

**R-ROUTINE-06:** Rutinas visibles en el perfil público del usuario (si comparte).

### Requisitos Pendientes

**R-ROUTINE-07 [PENDIENTE]:** No existe opción de "aplicar una rutina" al inicio de un workout para pre-cargar los ejercicios. El usuario tiene que agregarlos manualmente.

**R-ROUTINE-08 [PENDIENTE]:** No hay funcionalidad de duplicar rutinas.

**R-ROUTINE-09 [PENDIENTE]:** No hay sorting/reordering de ejercicios dentro de la rutina (drag & drop o botones up/down).

---

## 10. Módulo: Mapa y Gestión de Gimnasios

### Estado: ⚠️ WIP

### Descripción
`MapPage.tsx` + `GymMap.tsx` — Búsqueda y adición de gymnasios al "passport" del usuario.

### Requisitos Implementados

**R-GYM-01:** Mapa interactivo (Google Maps API) centrado en la ubicación del usuario.

**R-GYM-02:** Búsqueda de gyms por nombre o ubicación usando Google Places API.

**R-GYM-03:** Tap en gym del mapa → `userService.addGymToPassport()`:
- Crea/upserta registro en `gyms` table
- Crea `user_gyms` entry para el usuario
- Si es el primer gym: `is_home_base = true`
- Otorga +3 GX

**R-GYM-04:** `GymProfile.tsx` (`/territory/:gymId`):
- Muestra info del gym, Alpha badge (#1 rankeado)
- Leaderboard de los top 10 usuarios del gym
- Equipos del gym

**R-GYM-05:** El usuario puede personalizar su gym card:
- Imagen de fondo (`uploadGymBackground()`)
- Color temático (`custom_color`)

**R-GYM-06:** Gym card del home base se sincroniza al perfil público.

### Requisitos Pendientes

**R-GYM-07 [PENDIENTE]:** No existe manera de "salir" de un gym (remover del passport) — solo se puede marcar como favorito o home base pero no eliminar.

**R-GYM-08 [PENDIENTE]:** El campo `vibe` y `crowd_level` en la tabla `gyms` existen pero no hay UI para actualizarlos o mostrarlos de forma relevante.

**R-GYM-09 [PENDIENTE]:** Geofencing para auto-check-in al llegar a un gym existe el hook `useAutoCheckin()` pero su integración en el workout flow es incompleta.

---

## 11. Módulo: Social — Reels y Community

### Estado: ⚠️ WIP

### Descripción
Dos feeds separados: `ReelsPage` (videos TikTok-style) y `CommunityPage` (posts mixtos imagen/video).

### Requisitos Implementados

**R-SOCIAL-01 (Reels):** Feed vertical de videos con scroll infinito.
- Like, comentar, compartir
- Videos hosteados en Cloudinary
- Tagging de rutina vinculada

**R-SOCIAL-02 (Community):** Feed de posts mixtos (imagen + video) con:
- Carrusel multi-media (`post_media` table + `MediaCarousel` component)
- Pull-to-refresh
- Infinite scroll con paginación
- Smart rotation: posts no vistos primero, vistos al final
- Tracking de posts vistos en localStorage (`community_seen_posts`)

**R-SOCIAL-03:** Subir post vía `UploadModal`:
- Imagen única o múltiples (`createPostWithMultipleMedia`)
- Video
- Caption + rutina vinculada opcional

**R-SOCIAL-04:** View analytics: `socialService.logView()` registra duración, porcentaje visto, loops de video.

**R-SOCIAL-05:** Algoritmo feed V3:
- Prioriza posts de usuarios con boost activo
- Pondera por `virality_score = (likes×2 + comments×3 + shares×5 + saves×4) / max`
- `is_viral` si score > 0.5
- Cold-start protection para posts nuevos sin métricas

**R-SOCIAL-06:** Seguir/dejar de seguir usuarios. Follow afecta visibilidad en feeds y notificaciones.

**R-SOCIAL-07:** Compartir historial de workout a seguidores via `ShareHistoryModal`.

### Requisitos Pendientes

**R-SOCIAL-08 [PENDIENTE]:** No existe opción de "guardar" posts (save/bookmark). El modelo de datos tiene `saves` en la fórmula de virality pero la feature no está en la UI.

**R-SOCIAL-09 [PENDIENTE]:** No hay stories (24h content) — feature que la audiencia target espera en apps fitness sociales.

**R-SOCIAL-10 [WIP]:** El `PublicTeaser.tsx` para usuarios no autenticados existe pero su integración como landing/preview de la app no está completamente definida.

---

## 12. Módulo: Gamificación

### Estado: ⚠️ WIP

### Descripción
Sistema completo de gamificación: GX points, streaks, tiers, Alpha ranking, challenges.

### Subsistema: GX Points

**R-GX-01:** Puntos GX son la moneda principal de gamificación.

**R-GX-02:** Tabla de recompensas implementadas:
| Acción | GX |
|--------|-----|
| Gym añadido al passport | +3 |
| Workout completado (solo, 1ro del día, min 20 min) | +2 |
| Workout completado (coop, 1ro del día, min 20 min) | +3 |
| 5 minutos activo en la app (1x por día) | +1 |
| Subir post (foto/video) | +10 XP (legacy) |
| Compartir perfil | +5 |
| Referido exitoso | variable |

**R-GX-03:** `userService.addGxPoints(userId, amount, reason)` con audit trail.

**R-GX-04:** `userService.spendGPoints(userId, amount, reason)` para gastos (boosts).

### Subsistema: Streaks

**R-STREAK-01:** `streakService.recordAppEntry(userId)` al abrir la app cada día.
- Streak incrementa si el día anterior también hubo entry
- Si se saltó 1 día: estado `at_risk` (24h de gracia)
- Si se saltó 2+ días: `lost`, streak resetea a 0

**R-STREAK-02:** Visualización con `StreakFlame.tsx` animado en el perfil.

**R-STREAK-03:** `RescueModal` para recuperar streak "at_risk" (mecanismo de rescate con GX).

### Subsistema: Tiers

**R-TIER-01:** Tiers basados en `checkins_count`:
| Tier | Min Workouts |
|------|-------------|
| IRON | 0 |
| BRONZE | 10 |
| SILVER | 50 |
| GOLD | 100 |
| DIAMOND | 500 |
| VIBRANIUM | 1000 |

**R-TIER-02:** Cada tier tiene color único, icono emoji, gradiente. Mostrado como badge en perfiles.

**R-TIER-03:** Barra de progreso: `(current - tier_min) / (next_tier - tier_min) * 100`.

### Subsistema: Alpha Ranking

**R-ALPHA-01:** Top 10 usuarios por gym, ordenados por `consistency_score`.

**R-ALPHA-02:** `consistency_score` = compuesto de:
- Volumen total (peso × reps × sets)
- Frecuencia de workouts (semana/mes)
- Status de streak (bonus por streak activo)
- Diversidad de equipos (balance de grupos musculares)

**R-ALPHA-03:** Rankings recalculados semanalmente vía `alphaService.calculateWeeklyRankings()`.

**R-ALPHA-04:** Historial preservado en `alpha_history` table.

**R-ALPHA-05:** Notificación enviada cuando un usuario sube o baja en el ranking (`ranking_change`).

**R-ALPHA-06:** `AlphaBadge` component muestra al #1 en la vista del gym.

### Subsistema: Boost

**R-BOOST-01:** Gastar 1000 GX → 7 días de boost activo (`boost_until` timestamp).

**R-BOOST-02:** Usuarios con boost activo rankeados primero en Radar y feeds.

---

## 13. Módulo: Analytics y Stats

### Estado: ⚠️ WIP

### Descripción
`StatsPage.tsx` — Dashboard de analytics de entrenamiento.

### Requisitos Implementados

**R-STATS-01:** Estadísticas globales:
- Total workouts completados
- Volumen total (kg movidos)
- Tiempo total de entrenamiento

**R-STATS-02:** Gráfica de radar de grupos musculares (`MuscleRadarChart`):
- Sets por grupo muscular: chest, back, legs, shoulders, arms, core, cardio
- Clasificación: snapshot > DB > heurística de nombre > cardio fallback

**R-STATS-03:** Estimador 1RM (`OneRepMaxCard`):
- Fórmula Epley: `1RM = weight × (1 + reps / 30)`
- Top ejercicios por 1RM estimado

**R-STATS-04:** Tendencias de volumen (`VolumeTrendChart`):
- Volumen semanal de las últimas 12 semanas
- Gráfica de línea con Recharts

**R-STATS-05:** Heatmap de consistencia (`WorkoutHeatmap`):
- Frecuencia de workouts por día del mes

**R-STATS-06:** Stats sociales: seguidores, siguiendo, likes totales recibidos.

### Requisitos Pendientes

**R-STATS-07 [PENDIENTE]:** No hay comparación de stats vs otros usuarios (benchmark social).

**R-STATS-08 [PENDIENTE]:** No hay filtros por gym o por fecha en la página de stats.

**R-STATS-09 [PENDIENTE]:** No hay exportación de datos de entrenamiento (CSV, PDF).

---

## 14. Módulo: Radar (Descubrimiento)

### Estado: ⚠️ WIP

### Descripción
`Radar.tsx` — Interface de swipe cards para descubrir usuarios cercanos.

### Requisitos Implementados

**R-RADAR-01:** Fetch de usuarios nearby vía:
- RPC `get_radar_profiles_prioritized` (con timeout 1.5s)
- Fallback a query directa si RPC es lento

**R-RADAR-02:** Algoritmo de sorting:
1. Mismo home gym (match prioritario)
2. Boost activo
3. Follower count
4. Actividad reciente

**R-RADAR-03:** Swipe card interface (`react-swipeable`):
- Muestra avatar, username, tier badge, gym, stats
- Swipe derecha = acción positiva

**R-RADAR-04:** Acciones disponibles:
- Ver perfil → `PlayerProfileModal`
- Seguir
- Desafiar (WIP)
- Invitar a workout (WIP)

### Requisitos Pendientes

**R-RADAR-05 [PENDIENTE]:** Las acciones "Desafiar" e "Invitar a workout" desde Radar no están completamente implementadas (UI existe, lógica incompleta).

**R-RADAR-06 [PENDIENTE]:** No hay filtros en Radar (por tier, por gym, por distancia).

---

## 15. Módulo: Mensajería Directa

### Estado: ⚠️ WIP

### Descripción
Chat 1-a-1 entre usuarios. `InboxPage` + `ChatPage`.

### Requisitos Implementados

**R-CHAT-01:** Lista de chats activos con preview de último mensaje y count de no leídos (`InboxPage`).

**R-CHAT-02:** Chat en tiempo real via Supabase Realtime subscriptions en `chat_messages`.

**R-CHAT-03:** Auto-mark as read al abrir el chat.

**R-CHAT-04:** Acciones en chat (menú contextual):
- Limpiar mensajes (conserva conexión)
- Eliminar chat (unfollow mutuo + cascade delete)
- Bloquear usuario (delete chat + unfollow + registro en block table)

**R-CHAT-05:** `chatService.getOrCreateChat(userId1, userId2)` — upsert, nunca duplica.

### Requisitos Pendientes

**R-CHAT-06 [PENDIENTE]:** No hay soporte de mensajes multimedia (imágenes, videos) en el chat. Solo texto.

**R-CHAT-07 [PENDIENTE]:** No hay indicador de "typing..." (escribiendo).

**R-CHAT-08 [PENDIENTE]:** No hay mensajes de voz (feature esperada por la audiencia target).

---

## 16. Módulo: Notificaciones

### Estado: ⚠️ WIP

### Descripción
Sistema de notificaciones in-app con badge de no leídas.

### Tipos de Notificaciones Implementados

| Tipo | Trigger |
|------|---------|
| `ranking_change` | Cambio en Alpha ranking del gym |
| `system` | Anuncios del sistema |
| `reward` | GX points ganados |
| `invitation` | Solicitudes de conexión |
| `follower` | Nuevo seguidor |
| `gym_join` | Milestone de membresía |
| `coop_invite` | Invitación a sesión cooperativa |

### Requisitos Implementados

**R-NOTIF-01:** Bell icon con badge de no leídas (`NotificationBell`). Count con throttle de 10s para evitar queries excesivos.

**R-NOTIF-02:** Lista de notificaciones en `NotificationsPage`, ordenadas por fecha DESC.

**R-NOTIF-03:** Mark as read individual (`notificationService.markAsRead`).

**R-NOTIF-04:** Al aceptar/rechazar invitación coop desde la notificación, actualizar el estado de todas las notificaciones relacionadas de ese sender.

### Requisitos Pendientes

**R-NOTIF-05 [PENDIENTE]:** No hay push notifications nativas (Capacitor push plugin no integrado). Solo notificaciones in-app.

**R-NOTIF-06 [PENDIENTE]:** No hay configuración de preferencias de notificación (el usuario no puede desactivar ciertos tipos).

**R-NOTIF-07 [PENDIENTE]:** Mark all as read no está implementado — el usuario tiene que abrir una a una.

---

## 17. Módulo: Challenges (Retos GX)

### Estado: 🔲 PENDIENTE — WIP INCOMPLETO

### Descripción
Sistema de retos entre usuarios con apuesta de GX points.

### Modelo de Datos (Implementado en DB)
```sql
challenges:
  id (UUID, PK)
  challenger_id (FK to profiles)
  defender_id (FK to profiles)
  gym_id (FK, optional)
  wager_amount (integer) -- GX en juego
  metric ('total_volume' | 'workout_count')
  status ('pending' | 'accepted' | 'declined' | 'active' | 'completed' | 'draw')
  start_time, end_time (timestamps)
  winner_id (FK, null if draw)
  created_at
```

### Requisitos a Implementar

**R-CHALLENGE-01:** Cualquier usuario puede enviar un reto a otro usuario con:
- Monto de GX apostado (debe tener el balance disponible)
- Métrica: `total_volume` (volumen total en kg) o `workout_count` (cantidad de sesiones)
- Duración: 24 horas por defecto (configurable: 12h, 24h, 48h, 1 semana)
- Gym scope opcional (solo cuenta si entrenas en el gym especificado)

**R-CHALLENGE-02:** El defensor recibe notificación tipo `invitation` con datos del reto. Puede Aceptar o Declinar.

**R-CHALLENGE-03:** Al aceptar: status → `active`, timer de cuenta regresiva comienza.

**R-CHALLENGE-04:** Durante el reto activo:
- Ambos usuarios ven el progreso comparativo (mini-widget o en perfil)
- Métricas se calculan en tiempo real o near-real-time desde `workout_logs`

**R-CHALLENGE-05:** Al expirar `end_time`: `alphaService`-like job determina ganador:
- Compara la métrica elegida entre los dos usuarios durante el período activo
- `winner_id` se asigna, GX se transfiere: ganador recibe `wager_amount * 2`
- Si empate: ambos reciben su wager de vuelta, status = `draw`

**R-CHALLENGE-06:** Historial de retos en el perfil (ganados, perdidos, empates).

**R-CHALLENGE-07:** No se puede desafiar a un usuario si ya hay un reto activo entre los dos.

**R-CHALLENGE-08:** Si un usuario no tiene suficientes GX para cubrir el wager, no puede crear el reto.

---

## 18. Módulo: Suscripciones / Stripe

### Estado: 🔲 PENDIENTE — PLACEHOLDER SOLO

### Descripción
Sistema de monetización premium. La tabla `profiles` tiene `is_subscriber` y `subscription_status` pero Stripe no está integrado.

### Requisitos a Implementar

**R-SUB-01:** Definir y documentar los planes de suscripción:
- Free tier: funcionalidad básica actual
- Premium tier: features exclusivas (a definir)

**R-SUB-02:** Integrar Stripe Checkout via Supabase Edge Function:
- `subscriptionService.createCheckoutSession(userId, planId)` ya tiene el placeholder
- Edge Function `create-checkout-session` a implementar
- Webhook `subscription-webhook` para manejar eventos Stripe

**R-SUB-03:** Al activar suscripción: `is_subscriber = true`, `subscription_status = 'active'` en profiles.

**R-SUB-04:** Features exclusivas premium (propuestas):
- Sin límite de gyms en passport (free: 3 gyms max?)
- Analíticas avanzadas
- Radar sin restricciones (distancia, filtros)
- Boost mensual gratuito
- Badge premium visible en perfil

**R-SUB-05:** Manejo de cancelación, expiración y renovación via webhooks Stripe.

**R-SUB-06:** La UI del perfil ya tiene indicador de badge premium (`is_subscriber`), solo necesita el backend.

---

## 19. Módulo: Inteligencia Artificial (Gemini)

### Estado: 🔲 PENDIENTE — SDK INCLUIDO SIN USO

### Descripción
El SDK de Gemini (`@google/generative-ai`) está instalado pero ninguna feature de IA está implementada.

### Requisitos a Implementar (Propuestos)

**R-AI-01:** **Coach IA** — Analizar el historial de workouts del usuario y generar recomendaciones:
- Desequilibrios musculares detectados en el radar chart
- Progresión de carga sugerida por ejercicio
- Días de descanso recomendados basados en frecuencia

**R-AI-02:** **Generador de Rutinas** — Input: objetivos del usuario, equipos disponibles, tiempo disponible. Output: rutina completa lista para importar al builder.

**R-AI-03:** **Análisis de Forma** — Opcional con Gemini Vision: analizar video de ejercicio y dar feedback de forma. (Alta complejidad, baja prioridad inicial)

**R-AI-04:** **Chat con Coach** — Interfaz conversacional en el perfil o workout para consultas de nutrición/entrenamiento básicas.

**Nota técnica:** Usar `VITE_GEMINI_API_KEY` como variable de entorno. Las llamadas a Gemini deben ir via Edge Function para no exponer la API key en el cliente.

---

## 20. Módulo: Geofencing Configurable

### Estado: 🔲 PENDIENTE — HARDCODEADO EN 200m

### Descripción
El hook `useAutoCheckin()` y la validación de check-in usan un radio hardcodeado de ~200m. Necesita ser configurable.

### Requisitos a Implementar

**R-GEO-01:** Radio de geofence configurable por gym (default: 200m). Campo `geofence_radius_meters` en tabla `gyms`.

**R-GEO-02:** En la UI de GymProfile (admin/creador del gym), poder ajustar el radio.

**R-GEO-03:** La validación en `useAutoCheckin()` debe leer el radio del gym antes de verificar la posición.

**R-GEO-04:** Para gyms en edificios con señal GPS débil: opción de validación por WiFi o beacon (Capacitor plugin adicional requerido).

---

## 21. Modelo de Datos Completo

### Tabla: profiles
```sql
id              UUID PK (= auth.users.id)
username        TEXT UNIQUE NOT NULL
avatar_url      TEXT
description     TEXT
g_points        INTEGER DEFAULT 0
checkins_count  INTEGER DEFAULT 0
home_gym_id     UUID FK gyms
is_subscriber   BOOLEAN DEFAULT false
subscription_status TEXT
boost_until     TIMESTAMPTZ
custom_settings JSONB  -- preferencias, reward tracking
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### Tabla: gyms
```sql
id          UUID PK
name        TEXT NOT NULL
address     TEXT
place_id    TEXT UNIQUE (Google Maps Place ID)
lat         DECIMAL
lng         DECIMAL
vibe        TEXT
crowd_level TEXT
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

### Tabla: user_gyms (Passport)
```sql
user_id       UUID FK profiles
gym_id        UUID FK gyms
since         TIMESTAMPTZ
is_home_base  BOOLEAN DEFAULT false
custom_bg_url TEXT
custom_color  TEXT
PRIMARY KEY (user_id, gym_id)
```

### Tabla: gym_equipment
```sql
id                  UUID PK
gym_id              UUID FK gyms (nullable)
name                TEXT NOT NULL
category            TEXT
quantity            INTEGER DEFAULT 1
condition           TEXT ('GOOD'|'FAIR'|'POOR'|'BROKEN')
target_muscle_group TEXT
metrics             JSONB
image_url           TEXT
icon                TEXT (emoji)
notes               TEXT
verified_by         UUID FK profiles
created_at          TIMESTAMPTZ
```

### Tabla: exercises (Catálogo Global)
```sql
id                  UUID PK
name                TEXT NOT NULL
target_muscle_group TEXT
description         TEXT
form_tips           TEXT
created_at          TIMESTAMPTZ
```

### Tabla: routines
```sql
id           UUID PK
user_id      UUID FK profiles
name         TEXT NOT NULL
description  TEXT
equipment_ids UUID[] -- Array de IDs de gym_equipment
created_at   TIMESTAMPTZ
updated_at   TIMESTAMPTZ
```

### Tabla: routine_exercises
```sql
routine_id        UUID FK routines
exercise_id       UUID FK exercises
track_weight      BOOLEAN DEFAULT true
track_reps        BOOLEAN DEFAULT true
track_time        BOOLEAN DEFAULT false
track_pr          BOOLEAN DEFAULT false
target_sets       INTEGER
target_reps_text  TEXT (e.g. "10-12")
custom_metric     TEXT
order_index       INTEGER
PRIMARY KEY (routine_id, exercise_id)
```

### Tabla: workout_sessions
```sql
id                 UUID PK
user_id            UUID FK profiles
gym_id             UUID FK gyms (nullable)
started_at         TIMESTAMPTZ NOT NULL
finished_at        TIMESTAMPTZ (null = en progreso)
end_time           TIMESTAMPTZ (alias/legacy)
notes              TEXT
routine_name       TEXT
is_multiplayer     BOOLEAN DEFAULT false
multiplayer_mode   TEXT ('conjunto'|'separado')
partner_id         UUID FK profiles
partner_session_id UUID FK workout_sessions
created_at         TIMESTAMPTZ
updated_at         TIMESTAMPTZ
```

### Tabla: workout_logs
```sql
id                UUID PK
session_id        UUID FK workout_sessions
exercise_id       UUID (FK exercises OR gym_equipment)
set_number        INTEGER NOT NULL
weight_kg         DECIMAL
reps              INTEGER
sets              INTEGER
time              INTEGER (segundos)
distance          DECIMAL (metros)
rpe               INTEGER (1-10)
metrics_data      JSONB
is_pr             BOOLEAN DEFAULT false
category_snapshot TEXT
owner_id          UUID FK profiles
created_at        TIMESTAMPTZ
```

### Tabla: gym_alphas
```sql
id                UUID PK
gym_id            UUID FK gyms
user_id           UUID FK profiles
rank              INTEGER (1-10)
total_volume      DECIMAL
total_workouts    INTEGER
consistency_score DECIMAL
is_current        BOOLEAN DEFAULT true
achieved_at       TIMESTAMPTZ
```

### Tabla: posts
```sql
id               UUID PK
user_id          UUID FK profiles
type             TEXT ('image'|'video')
media_url        TEXT (backward compat)
thumbnail_url    TEXT
caption          TEXT
linked_routine_id UUID FK routines
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
```

### Tabla: post_media
```sql
post_id     UUID FK posts
media_url   TEXT NOT NULL
media_type  TEXT ('image'|'video')
order_index INTEGER
```

### Tabla: post_likes
```sql
post_id    UUID FK posts
user_id    UUID FK profiles
created_at TIMESTAMPTZ
PRIMARY KEY (post_id, user_id)
```

### Tabla: post_comments
```sql
id         UUID PK
post_id    UUID FK posts
user_id    UUID FK profiles
content    TEXT NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### Tabla: follows
```sql
follower_id  UUID FK profiles
following_id UUID FK profiles
created_at   TIMESTAMPTZ
PRIMARY KEY (follower_id, following_id)
```

### Tabla: chats
```sql
id              UUID PK
user_a          UUID FK profiles
user_b          UUID FK profiles
last_message_at TIMESTAMPTZ
last_message    TEXT (cached preview)
created_at      TIMESTAMPTZ
```

### Tabla: chat_messages
```sql
id         UUID PK
chat_id    UUID FK chats
sender_id  UUID FK profiles
content    TEXT NOT NULL
is_read    BOOLEAN DEFAULT false
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### Tabla: notifications
```sql
id         UUID PK
user_id    UUID FK profiles
type       TEXT
title      TEXT NOT NULL
message    TEXT NOT NULL
data       JSONB
is_read    BOOLEAN DEFAULT false
created_at TIMESTAMPTZ
```

### Tabla: user_streaks
```sql
user_id           UUID FK profiles PK
current_streak    INTEGER DEFAULT 0
longest_streak    INTEGER DEFAULT 0
last_workout_date DATE
status            TEXT ('active'|'at_risk'|'frozen'|'lost')
recovery_deadline TIMESTAMPTZ
```

### Tabla: challenges
```sql
id             UUID PK
challenger_id  UUID FK profiles
defender_id    UUID FK profiles
gym_id         UUID FK gyms (nullable)
wager_amount   INTEGER
metric         TEXT ('total_volume'|'workout_count')
status         TEXT ('pending'|'accepted'|'declined'|'active'|'completed'|'draw')
start_time     TIMESTAMPTZ
end_time       TIMESTAMPTZ
winner_id      UUID FK profiles (nullable)
created_at     TIMESTAMPTZ
```

### Tabla: history_shares
```sql
shared_by   UUID FK profiles
shared_with UUID FK profiles
created_at  TIMESTAMPTZ
```

---

## 22. Flujos de Usuario End-to-End

### Flujo 1: First-Time User
```
Descarga app / abre URL
→ LoginPage (auto-detect referrer de Instagram → Meta OAuth)
→ OAuth callback → hash token procesado
→ Profile auto-creado en profiles table
→ Referral procesado si ?ref= presente
→ Redirect a / (UserProfile)
→ TacticalTutorialModal (si primer login)
→ Usuario ve perfil vacío con tier IRON
→ GlobalGPSGuard solicita permiso de ubicación
→ MapPage → busca su gym → addGymToPassport() → +3 GX
→ /workout → primer "Battle" → +2 GX al finalizar
→ Tier progress hacia BRONZE (2/10 workouts)
```

### Flujo 2: Workout Diario
```
Abre app → recordAppEntry() → streak+1 (si día consecutivo)
→ 5-min timer activo → +1 GX (una vez por día)
→ /workout → "Start Battle"
→ Agrega ejercicios del arsenal
→ Registra sets con peso/reps/RPE
→ Rest timer entre sets
→ "Finish Battle" (>= 20 min) → +2 GX
→ Stats actualizadas → Alpha ranking recalculado
```

### Flujo 3: Sesión Coop
```
Usuario A va a /friends
→ Ve a Usuario B online (training indicator)
→ "Invitar al battle" → selecciona modo Conjunto/Separado
→ Notificación coop_invite enviada a B
→ B acepta → ambos están en sesiones linkedas
→ Modo Conjunto: A y B ven los mismos ejercicios
→ A registra sus sets → sincronizado a B via Realtime
→ Ambos finalizan → ambos +3 GX
→ Resumen comparativo (pendiente implementar)
```

### Flujo 4: Alpha Ranking
```
Usuario completa workouts en gym X
→ workout_logs con gym_id
→ alphaService.calculateGymRankings(gymId) [semanal]
→ consistency_score calculado por volumen + frecuencia + streak
→ gym_alphas actualizados con top 10
→ Si cambió de rank: notificación ranking_change enviada
→ #1 aparece en GymProfile como Alpha Badge
→ alpha_history registra tiempo en cada posición
```

---

## 23. Sistema de Puntos GX y Gamificación

### Resumen de Economía GX

```
ENTRADAS (Earn):
  +3 GX  → Agregar gym al passport (una vez por gym)
  +2 GX  → Workout completado solo (1ro del día, ≥ 20 min)
  +3 GX  → Workout completado coop (1ro del día, ≥ 20 min)
  +1 GX  → 5 minutos activo en app (1x por día)
  +5 GX  → Compartir perfil / referido
  +5 GX  → Referido exitoso (cuando referido completa primer workout)
  +10 XP → Subir post (legacy, pendiente migrar a GX)
  
SALIDAS (Spend):
  -1000 GX → Boost de visibilidad 7 días
  -variable → Wager en Challenges (pendiente)

VALOR SEMANAL ESTIMADO (usuario activo):
  7 días × (+2 GX workout + +1 GX daily) = +21 GX/semana
  Boost = 1000 GX = ~47 semanas de actividad constante
```

### Tiers de Evolución

```
IRON      [0 workouts]     — Gris, ícono: ⚙️
BRONZE    [10 workouts]    — Bronce, ícono: 🥉
SILVER    [50 workouts]    — Plata, ícono: 🥈
GOLD      [100 workouts]   — Oro, ícono: 🥇
DIAMOND   [500 workouts]   — Azul diamante, ícono: 💎
VIBRANIUM [1000 workouts]  — Morado/violeta, ícono: ⚡
```

---

## 24. Variables de Entorno y Configuración

### Archivo .env requerido
```env
# Supabase (REQUERIDO)
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxx

# Google Maps (REQUERIDO para /map)
VITE_GOOGLE_MAPS_API_KEY=AIzaxxxxxxxx

# Gemini AI (PENDIENTE implementar)
VITE_GEMINI_API_KEY=xxxxxxxxxxxx

# Stripe (PENDIENTE implementar)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxx  # Solo en Edge Functions, NUNCA en cliente
```

### capacitor.config.ts
```typescript
appId: com.ginx.app (a confirmar)
appName: GINX
webDir: dist
plugins:
  Geolocation: { permissions: [location] }
```

---

## 25. Deuda Técnica y Limitaciones Conocidas

### Alta Prioridad (Bloquea usuarios en beta)

| ID | Descripción | Módulo | Impacto |
|----|-------------|--------|---------|
| TD-01 | Sesiones zombie coop no se limpian automáticamente | Multiplayer | Bloquea usuarios |
| TD-02 | Race condition invitador finaliza antes de que acepte el invitado | Multiplayer | Crash/estado inválido |
| TD-03 | PR detection (`is_pr`) no se calcula automáticamente | Workout | Feature rota |
| TD-04 | `recordAppEntry()` no se llama de forma garantizada en mobile (Capacitor) | Streaks | Streaks inconsistentes |

### Media Prioridad (Feature incompleta)

| ID | Descripción | Módulo |
|----|-------------|--------|
| TD-05 | `custom_settings` JSONB sin UI completa | Perfil |
| TD-06 | Métricas custom de equipo no fluyen completo en workout log | Arsenal/Workout |
| TD-07 | Rutinas no se pueden "aplicar" al inicio de workout | Rutinas |
| TD-08 | Algoritmo de feed V3 usa `virality_score` sin campo `saves` implementado | Social |
| TD-09 | XP legacy no migrado a GX (posts dan XP, no GX) | Gamificación |
| TD-10 | `alpha_history` sin UI de acceso desde el perfil | Alpha |

### Baja Prioridad (Nice-to-have)

| ID | Descripción | Módulo |
|----|-------------|--------|
| TD-11 | Push notifications nativas (Capacitor) no integradas | Notificaciones |
| TD-12 | Exportación de datos de workout (CSV/PDF) | Stats |
| TD-13 | Geofence hardcodeado en 200m | Geofencing |
| TD-14 | Sin opción de salir de gym (remover del passport) | Gym |
| TD-15 | Sin drag-and-drop para reordenar ejercicios en rutinas | Rutinas |
| TD-16 | Sin mark-all-read en notificaciones | Notificaciones |

### Código Deprecado a Limpiar

| Elemento | Descripción |
|----------|-------------|
| `addXP()` en UserService | Reemplazado por `addGxPoints()` |
| `isUserAlpha()` en AlphaService | Reemplazado por `getUserRanking()` |
| `UserRank` enum (Novato/Gym Rat/Elite/Legend) | Reemplazado por Tier system |
| `XP` references en posts | Migrar a GX |

---

*Documento generado automáticamente con Claude Code analizando el codebase completo de GymPartner/GINX.*  
*Última actualización: 2026-06-01*
