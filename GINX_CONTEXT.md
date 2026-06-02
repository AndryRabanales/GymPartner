# GINX — Documento de Contexto para Sesiones de Claude

> Pega este documento al inicio de cada sesión para que Claude entienda la app sin explorar el código.
> Fecha de última actualización: 2026-06-02 (schema BD agregado)

---

## 1. STACK & ENTORNO

| Elemento | Detalle |
|---|---|
| Framework | React 19 + Vite + TypeScript (strict) |
| Styling | Tailwind CSS (dark-first, color clave: `gym-primary` = yellow-400) |
| Backend/DB | Supabase (PostgreSQL + Auth + Realtime + RLS) |
| Imágenes | Cloudinary |
| Mapas | Google Maps / @vis.gl/react-google-maps (lib: `places`) |
| Mobile | Capacitor (Geolocation nativa) |
| Notificaciones | react-hot-toast |
| Charts | Recharts |
| Deploy | Web (Vite SPA) + APK (Capacitor) |

Env vars requeridas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`

---

## 2. ESTRUCTURA DE DIRECTORIOS

```
src/
├── App.tsx                   ← Router raíz
├── main.tsx                  ← Punto de entrada (envuelve con AuthProvider)
├── components/
│   ├── arsenal/              ← EquipmentForm, ArsenalCard, ArsenalGrid
│   ├── common/               ← LocationAccessModal, ReferralModal, PublicTeaser, CoopWorkoutModal
│   ├── gamification/         ← Leaderboard, UserBadge, AlphaBadge, StreakFlame, GPointsDisplay, RescueModal
│   ├── map/                  ← GymMap (canvas de Google Maps + markers)
│   ├── navigation/           ← BottomNav
│   ├── onboarding/           ← GymSelector, TacticalTutorialModal, InteractiveOverlay
│   ├── profile/              ← EditProfileModal, BoostModal, PlayerProfileModal, RoutineViewModal, ShareRoutineModal, ShareRoutinesToUserModal, ShareHistoryModal
│   ├── social/               ← UploadModal, ReelItem, MediaCarousel, CommentsSheet, FeedViewerOverlay
│   ├── stats/                ← MuscleRadarChart, OneRepMaxCard, VolumeTrendChart, WorkoutHeatmap, ShareOverlay
│   ├── ui/                   ← NotificationBell, MessagesButton, UserProfileCard, FadeInImage
│   ├── workout/              ← WorkoutSession(comp), WorkoutCarousel, WorkoutCatalog, BattleTimer, LockedExerciseOverlay, ActiveWorkoutBubble, ActiveSessionRescueModal
│   └── GlobalGPSGuard.tsx    ← Fuerza permiso GPS antes de continuar
├── context/
│   ├── AuthContext.tsx        ← user, session, loading, signIn*, signOut
│   └── BottomNavContext.tsx   ← isBottomNavVisible, hide/show
├── data/
│   ├── exerciseCatalog.ts    ← BaseExercise[] agrupados por músculo
│   ├── imageManifest.ts      ← Mapa ejercicio→ruta de imagen (auto-generado con `npm run catalog`)
│   ├── mockGyms.ts           ← Datos mock para desarrollo
│   └── mockUsers.ts          ← Usuarios mock
├── hooks/
│   ├── useAutoCheckin.ts     ← Detecta gimnasio cercano cada 10 min y registra en passport
│   ├── useGeolocation.ts     ← Vigila GPS con caché 5 min en localStorage
│   ├── useSwipe.ts           ← Detección de swipe táctil (izq/der)
│   └── useUnlockedExercises.ts ← Set de ejercicios desbloqueados (localStorage)
├── layouts/
│   └── AppLayout.tsx         ← Shell principal: header, BottomNav, modals globales, realtime
├── lib/
│   └── supabase.ts           ← Cliente Supabase
├── pages/                    ← ~20 páginas mapeadas a rutas
├── services/                 ← Lógica de negocio / llamadas a Supabase
├── types/
│   └── user.ts               ← User, UserRank (funciones XP deprecadas, rank ahora por followers)
└── utils/
    ├── distance.ts           ← Haversine (km)
    ├── geolocationUtils.ts   ← GPS helpers, isWithinDistance (200m para checkin)
    ├── inventoryUtils.ts     ← normalizeText, getMuscleGroup
    └── StatsAnalyzer.ts      ← calculate1RM (Epley), processMuscleBalance
```

---

## 3. RUTAS (App.tsx)

Todos los hijos de `<AppLayout>`:

| Path | Componente | Notas |
|------|-----------|-------|
| `/` | `UserProfile` | Dashboard principal (~1200 líneas) |
| `/login` | `LoginPage` | OAuth (Google/Meta), email, escape para Instagram IAB |
| `/map` | `MapPage` | Descubrimiento de gimnasios |
| `/workout` | `WorkoutSession` | Sesión activa (sin gym) |
| `/workout/:gymId` | `WorkoutSession` | Sesión activa en gym específico |
| `/territory/:gymId/workout` | `WorkoutSession` | idem desde perfil de gym |
| `/territory/:gymId` | `GymProfile` | Perfil/territorio del gym |
| `/territory/:gymId/arsenal` | `MyArsenal` | Equipamiento del gym |
| `/arsenal` | `MyArsenal` | Mis rutinas y equipamiento |
| `/builder` | `RoutineBuilder` | Crear/editar rutinas |
| `/stats` | `StatsPage` | Analíticas de entrenamiento |
| `/ranking` | `RankingPage` | Leaderboards Alpha |
| `/community` | `CommunityPage` | Feed social |
| `/reels` | `ReelsPage` | Videos cortos |
| `/radar` | `Radar` | Mapa de usuarios en tiempo real |
| `/notifications` | `NotificationsPage` | Centro de notificaciones |
| `/inbox` | `InboxPage` | Lista de conversaciones |
| `/chat/:chatId` | `ChatPage` | Chat 1-a-1 |
| `/player/:username` | `PublicProfile` | Ver perfil de otro usuario |
| `/friends` | `FriendsPage` | Gestión de follows/solicitudes |
| `/history` | `HistoryPage` | Historial de entrenamientos |
| `/history/:sessionId` | `WorkoutDetailPage` | Detalle de sesión |
| `/profile` | `UserProfile` | Alias de `/` |

**Provider stack** (de afuera hacia adentro): `APIProvider (GMaps)` → `BottomNavProvider` → `BrowserRouter` → `AuthProvider` (en main.tsx)

---

## 4. CONTEXTOS GLOBALES

### AuthContext (`src/context/AuthContext.tsx`)
```typescript
// Lo que expone useAuth():
user: User | null          // Supabase auth user (con user_metadata.avatar_url, .full_name)
session: Session | null    // JWT
loading: boolean
signInWithGoogle()
signInWithMeta()
signInWithEmail(email, password)
signInAsDev()              // Solo localhost
signOut()
```
**Efectos secundarios en AuthContext:**
- Crea perfil automáticamente en `profiles` al primer login
- Procesa referral desde `?ref=` en URL → guarda en `sessionStorage('gym_referral_id')`
- Registra entrada diaria (streak) via `StreakService`
- Otorga 1 GX cada 5 min de uso activo (tracker por día en `sessionStorage`)
- Limpia hash OAuth de la URL

### BottomNavContext (`src/context/BottomNavContext.tsx`)
```typescript
isBottomNavVisible: boolean
hideBottomNav()   // Usado en páginas que no quieren el nav (workout, edición de perfil)
showBottomNav()
```

---

## 5. AppLayout — EL SHELL

`src/layouts/AppLayout.tsx` es el componente padre de todas las páginas.

**Qué hace:**
- Renderiza header flotante (oculto en: radar, ranking, chat, reels, arsenal, workout/territory)
- Renderiza `BottomNav` (oculto en: workout, arsenal, stats, history, chat individual)
- Ejecuta `useAutoCheckin()` globalmente
- Suscripción realtime a `notifications` table para el usuario → muestra toasts
- Tipos de notificaciones manejadas en realtime:
  - `system` (con "EN VIVO") → toast simple
  - `system` (con "FINALIZADO") → toast de fin de sesión
  - `coop_invite` → `CoopInviteToast` (acepta/rechaza con navigate a `/workout`)
  - `coop_accepted` → navega al host a `/workout` con estado multiplayer
  - `coop_join_request` → `CoopJoinRequestToast` (acepta crea sesión o usa la activa)
  - `coop_join_accepted` → guest navega a `/workout`, persiste `ginx_coop_state` en localStorage
  - `room_closed` → toast, limpia `ginx_coop_state`
- Tracker de presencia online: actualiza `profiles.last_active_at` cada 2 min; lo pone a `null` en `beforeunload`/visibilitychange
- Preload de imágenes de equipamiento (`COMMON_EQUIPMENT_SEEDS`)
- Rescue Modal: detecta sesión activa incompleta en DB → muestra `ActiveSessionRescueModal` (respeta `ginx_temp_exit_active` en sessionStorage)
- Renderiza: `GlobalGPSGuard`, `RescueModal`, `ActiveWorkoutBubble`, `UploadModal`, `Toaster`

**Lógica de header/nav visibility:**
```typescript
shouldHideHeader = isRadarPage || isRankingPage || isChatPage || isReelsPage || isArsenalPage || isWorkoutPage
shouldShowBottomNav = user && !isWorkoutPage && !isContentPage && !isSingleChatPage && isBottomNavVisible
// isContentPage = arsenal | stats | history
// isWorkoutPage = /workout o /territory/
```

---

## 6. SERVICIOS (`src/services/`)

| Servicio | Métodos clave | Responsabilidad |
|----------|-------------|-----------------|
| `UserService` | `getUserGyms`, `addGymToPassport`, `removeGymFromPassport`, `toggleHomeBase`, `toggleFavoriteGym`, `spendGPoints`, `addGxPoints`, `processReferral`, `uploadGymBackground` | Perfil, passport de gyms, moneda GX, referrals |
| `WorkoutService` | `startSession`, `finishSession`, `logSet`, `getActiveSession`, `getUserRoutines`, `saveRoutine` | Ciclo de vida de la sesión de entrenamiento |
| `MapsService` | `searchGyms`, `getNearbyGyms`, `getGymDetails` | Wrapper de Google Places API |
| `CloudinaryService` | `uploadImage`, `getOptimizedImageUrl` | Hosting y optimización de imágenes |
| `SocialService` | `getProfileStats`, `followUser`, `unfollowUser`, `likeReel`, `addComment` | Follows, likes, comentarios |
| `ChatService` | `getConversations`, `sendMessage`, `getMessages` | Mensajería 1-a-1 |
| `NotificationService` | `getUnreadCount`, `updateInvitationStatus` | Alertas en tiempo real |
| `AlphaService` | `getUserRanking`, `getUserAlphaHistory` | Ranking Alpha por gym |
| `TierService` | `getTier`, `getProgress`, `getNextTier` | Progresión de dominance tier |
| `StreakService` | `recordAppEntry`, `getActiveStreak` | Racha diaria de uso |
| `GymEquipmentService` | `addEquipment`, `removeEquipment`, `seedCommonEquipment` | Catálogo de equipamiento |
| `ExerciseSeeder` | `seedExercisesCatalog` | Inicializa catálogo de ejercicios en DB |
| `RadarService` | `trackPresence`, `getNearbyUsers` | Presencia en tiempo real por ubicación |
| `ChallengeService` | — | Lógica de desafíos/batallas |
| `BotSeeder` | — | Generación de cuentas bot para desarrollo |

---

## 7. HOOKS PERSONALIZADOS

| Hook | Retorna | Nota crítica |
|------|---------|-------------|
| `useGeolocation` | `{ location, error, loading }` | Caché 5 min en `localStorage('ginx_last_known_location')`. `location.isFresh`: true=adquirido en sesión, false=caché |
| `useAutoCheckin` | void | Corre cada 10 min, usa GPS fresco (no caché), threshold 200m al gym, escribe en `user_gyms` |
| `useSwipe` | `{ swipeState, handlers }` | Detección touch izq/der para carousels |
| `useUnlockedExercises` | `{ unlock, isUnlocked }` | Persiste en `localStorage('ginx_unlocked_exercises')` como Set |

---

## 8. TIPOS PRINCIPALES

```typescript
// types/user.ts (las funciones XP están DEPRECADAS, rank ahora por followers)
type UserRank = 'Novato' | 'Gym Rat' | 'Elite' | 'Legend' | 'Gym God';

// WorkoutSession (WorkoutService)
interface WorkoutSession {
  id: string;
  gym_id?: string;
  user_id: string;
  started_at: string;
  finished_at?: string;
  is_multiplayer?: boolean;
  multiplayer_mode?: 'separado' | 'conjunto';
  partner_id?: string;
}

interface WorkoutSetData {
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg?: number;
  reps?: number;
  rpe?: number;
  time?: number;
  is_pr?: boolean;
  category_snapshot?: string;
  owner_id?: string;
}

// UserPrimaryGym (UserService)
interface UserPrimaryGym {
  gym_id: string;
  google_place_id: string;
  gym_name: string;
  since: string;
  is_home_base?: boolean;
  is_favorite?: boolean;
  lat?: number; lng?: number;
  equipment_count?: number;
  custom_bg_url?: string;
  custom_color?: string;
}

// useGeolocation
interface Location {
  lat: number; lng: number;
  accuracy: number;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
  isFresh: boolean;
}
```

---

## 9. DATOS ESTÁTICOS

### exerciseCatalog.ts
BaseExercise[] con:
- `id`, `name`, `muscle` (PECHO|ESPALDA|PIERNA|HOMBRO|BÍCEPS|TRÍCEPS|ABDOMINALES|CARDIO)
- `metrics: { weight, reps, time, distance, rpe }` (booleanos)
- `variants[]: { id, label, seedName }`

### imageManifest.ts (AUTO-GENERADO con `npm run catalog`)
- Mapea ejercicio→variante→ruta de imagen en `/ejercicioimg/`
- `imagePath`, `isLocked` por variante
- **NUNCA editar a mano** — se regenera automáticamente

---

## 10. PERSISTENCIA LOCAL (localStorage / sessionStorage)

| Clave | Storage | Qué guarda |
|-------|---------|-----------|
| `ginx_last_known_location` | localStorage | Última posición GPS (TTL 5 min) |
| `ginx_unlocked_exercises` | localStorage | Set de IDs de ejercicios desbloqueados |
| `ginx_5min_reward_*` | localStorage | Control diario del premio de 5 min |
| `ginx_coop_state` | localStorage | Estado del room multiplayer activo (para rescue) |
| `ginx_temp_exit_active` | sessionStorage | Usuario salió temporalmente del workout (no mostrar rescue modal) |
| `active_secs_${userId}_${date}` | sessionStorage | Segundos activos del día para el premio |
| `gym_referral_id` | sessionStorage | Referral code pendiente de procesar |
| `sb-*` | localStorage | Tokens Supabase (auto-gestionado) |

---

## 11. SISTEMAS GAMIFICADOS

### Alpha/Ranking
- `AlphaService`: ranking del usuario 1-10 por gym
- "King of the Gym" = #1 alpha → badge especial en perfil

### Dominance Tiers
- `TierService`: progresión basada en checkins al gym
- Cada tier desbloquea funcionalidades

### GX Points (moneda)
- Earn: entrenamientos, 5 min activos/día, compartir, referrals
- Spend: boost de perfil (1000 GX = visibilidad aumentada durante X tiempo)
- Campo: `profiles.g_points`

### Streaks
- `StreakService.recordAppEntry()` en cada login
- Una entrada por día calendario
- `StreakFlame` component muestra el indicador visual

### Sistema de Referrals
- URL: `?ref=${referrer_id}` → capturado en AuthContext
- Guardado en sessionStorage, procesado al primer login
- Registra en `profiles.referred_by`

---

## 12. SISTEMA MULTIPLAYER / COOP

Modos:
- `separado`: cada uno registra sus propias series
- `conjunto`: comparten las mismas series en tiempo real

Flujo de invitación (iniciador → receptor):
1. Iniciador envía `coop_invite` a `notifications` del receptor
2. AppLayout intercepta → muestra `CoopInviteToast`
3. Si acepta → inserta `coop_accepted` para el iniciador + navega a `/workout` con `location.state`
4. AppLayout del iniciador intercepta `coop_accepted` → navega a `/workout`

Flujo de solicitud de unión (usuario random → host activo):
1. Ve sesión activa en Radar → envía `coop_join_request` al host
2. AppLayout del host intercepta → `CoopJoinRequestToast`
3. Host acepta → actualiza su sesión a multiplayer, envía `coop_join_accepted`
4. Guest navega a `/workout` con `location.state`, persiste `ginx_coop_state` en localStorage

Estado pasado a WorkoutSession via `location.state`:
```typescript
{
  isMultiplayer: boolean,
  multiplayerMode: 'separado' | 'conjunto',
  partnerId: string,
  chatId: string,           // room ID = session ID del host
  partnerSessionId: string,
  isInviter: boolean,
  forceNewSession: boolean
}
```

---

## 13. FLUJO DE DATOS PRINCIPAL

```
main.tsx
  └─ AuthProvider
       └─ App.tsx
            └─ APIProvider (GMaps)
                 └─ BottomNavProvider
                      └─ BrowserRouter
                           └─ AppLayout (shell global)
                                ├─ useAutoCheckin()        [auto-registro de gyms]
                                ├─ realtime notifications  [coop invites, live toasts]
                                ├─ presence tracker        [last_active_at cada 2 min]
                                ├─ session rescue check    [detecta sesiones colgadas]
                                └─ <Outlet />              [página activa]
                                     └─ ej: WorkoutSession
                                          ├─ useAuth() → user.id
                                          ├─ useGeolocation() → GPS
                                          ├─ workoutService.getActiveSession()
                                          ├─ workoutService.startSession()
                                          ├─ workoutService.logSet()
                                          └─ workoutService.finishSession()
```

---

## 14. PATRONES DE ESTADO

1. **useState en componentes** — estado local de páginas y modals
2. **AuthContext** — usuario y sesión global
3. **BottomNavContext** — visibilidad del nav
4. **Supabase realtime** — `supabase.channel(...)` para notificaciones en AppLayout
5. **localStorage** — GPS cache, ejercicios desbloqueados, coop state, daily rewards
6. **sessionStorage** — temp-exit flag, referral pendiente, active time tracker

---

## 15. REGLAS CRÍTICAS PARA NO ROMPER NADA

### Header y BottomNav
- El header se oculta en: `/radar`, `/ranking`, `/inbox`, `/chat/*`, `/reels`, `/arsenal`, `/workout`, `/territory/*`
- El BottomNav se oculta en: `/workout`, `/arsenal`, `/stats`, `/history`, `/history/*`, `/chat/*`
- Si agregas una nueva página donde quieres ocultar el header/nav, edita las variables en `AppLayout.tsx` (líneas ~637-649)

### Rescue Modal
- Condición: usuario tiene sesión activa en DB (`workout_sessions` sin `finished_at`) Y `sessionStorage('ginx_temp_exit_active') !== 'true'` Y no está en `/workout`
- El flag `ginx_temp_exit_active` lo pone WorkoutSession cuando el usuario sale intencionalmente
- **No romper**: si eliminas el flag al salir, el rescue modal aparecerá en cada navegación

### WorkoutSession state via location.state
- Siempre revisar `location.state` antes de `params.gymId` para el gym actual
- El modo multiplayer se inicializa SOLO desde `location.state.isMultiplayer`
- `forceNewSession: true` = siempre crea sesión nueva aunque exista una activa

### imageManifest.ts
- NO editar manualmente
- Ejecutar `npm run catalog` para regenerar después de agregar imágenes a `/public/ejercicioimg/`

### Supabase RLS
- Toda consulta usa el JWT del usuario autenticado
- Las políticas filtran por `user_id = auth.uid()`
- Para consultas admin usar el service role key (solo en seeds/scripts, nunca en client)

### GPS / Geolocation
- `useGeolocation` puede retornar datos del cache (`isFresh: false`)
- `useAutoCheckin` fuerza GPS fresco — nunca usar el cache para checkin
- Umbral de checkin: 200 metros (`isWithinDistance` en geolocationUtils)

### GX Points
- Siempre usar `UserService.spendGPoints()` y `addGxPoints()` — no editar `g_points` directamente
- Verificar saldo antes de gastar (throw si insuficiente)

### Notificaciones Realtime
- El channel se crea en AppLayout al montar y se destruye en cleanup
- Las notificaciones se deduplicam via `notificationSeen` ref (Set de IDs)
- El tipo `coop_*` dispara navegación → cuidado al modificar tipos de notificación

---

## 16. PÁGINAS PRINCIPALES — RESUMEN

### UserProfile (`/`)
~1200 líneas. Es el dashboard. Carga: perfil, gyms del usuario, rutinas, tier/ranking. Renderiza: header con avatar/bio/banner, badge Alpha, botón START → `/workout`, grid de rutinas rápidas, acciones rápidas (Arsenal, Gyms, Stats, History).

### WorkoutSession (`/workout`, `/workout/:gymId`)
Sesión activa. Detecta gym por GPS si no viene en params. Inicia/retoma sesión en DB. Renderiza: carousel de ejercicios, formulario weight/reps/time, timer de descanso `BattleTimer`, botón Finalizar → `finishSession()` con GX reward y checkin.

### MapPage (`/map`)
Llama `useGeolocation` + `MapsService.searchGyms()`. Renderiza `GymMap` con markers de Google Maps. Lista de gyms filtrable por distancia/rating.

### MyArsenal (`/arsenal`, `/territory/:gymId/arsenal`)
Lista de rutinas del usuario + equipamiento del gym. Permite crear/editar rutinas via `RoutineBuilder`.

### GymProfile (`/territory/:gymId`)
Perfil del gym: miembros, alpha ranking, equipamiento, background personalizado. Permite al usuario agregar/quitar de su passport.

---

## 17. BUGS CONOCIDOS / COMPORTAMIENTOS ESPECIALES

- **WorkoutSession.tsx** tiene cambios sin commitear al momento de crear este doc (ver git status)
- Los **XP functions** en `types/user.ts` están deprecadas — el ranking real es por followers
- En Instagram WebView se muestra pantalla de escape para abrir en Safari/Chrome (LoginPage.tsx)
- `profiles.last_active_at = null` significa offline; cualquier timestamp = online (Radar lo usa)
- Las imágenes de ejercicios usan resolución dinámica: intenta variante exacta → fallback a estándar → fallback a placeholder

---

## 18. SCHEMA REAL DE LA BASE DE DATOS (Supabase)

### TABLA: `profiles` ← La más importante, hub de todo
| Columna | Tipo | Default | Notas |
|---------|------|---------|-------|
| id | uuid | — | = auth.uid() |
| username | text | — | |
| description | text | — | |
| avatar_url | text | — | |
| rank | text | 'Novato' | 'Novato'\|'Gym Rat'\|'Elite'\|'Legend'\|'Gym God' |
| home_gym_id | text | — | ⚠️ text, no uuid FK |
| checkins_count | int4 | 0 | |
| photos_count | int4 | 0 | |
| custom_settings | jsonb | `{"metrics":[],"categories":[]}` | `is_history_public` vive aquí |
| featured_routine_id | uuid | — | FK → routines.id |
| g_points | int4 | 0 | ⚠️ Columna legacy |
| gx_points | int4 | 0 | ⚠️ Columna activa para GX currency |
| daily_invite_limit | int4 | 50 | |
| extra_invites_today | int4 | 0 | |
| last_invite_reset | timestamptz | now() | |
| boost_until | timestamptz | — | null = sin boost |
| is_subscriber | bool | false | |
| subscription_status | text | — | |
| total_referrals | int4 | 0 | |
| referred_by | uuid | — | FK → profiles.id |
| main_base_image | text | — | Banner del perfil |
| main_base_color | text | — | Color del banner |
| skips_count | int4 | 0 | |
| matches_count | int4 | 0 | |
| followers_count | int4 | 0 | Desnormalizado |
| following_count | int4 | 0 | Desnormalizado |
| last_active_at | timestamptz | now() | null = offline |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

> ⚠️ **ALERTA CRÍTICA**: Existen DOS columnas de puntos: `g_points` (legacy) y `gx_points` (activa). Verificar cuál usa cada servicio antes de modificar.

### TABLA: `workout_sessions`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → NO en profiles (sin FK declarada) |
| gym_id | uuid | FK → gyms.id (nullable) |
| routine_id | uuid | FK → routines.id (nullable) |
| started_at | timestamptz | |
| finished_at | timestamptz | null = sesión activa |
| notes | text | |
| end_time | timestamptz | columna redundante con finished_at |
| routine_name | text | snapshot del nombre al momento |
| is_multiplayer | bool | false |
| multiplayer_mode | text | 'separado'\|'conjunto' |
| partner_id | uuid | ID del compañero |
| partner_session_id | uuid | ID de la sesión del host (para el guest) |

> RLS: owner puede todo; history_shares o custom_settings.is_history_public abre visibilidad a terceros; chats en común permite ver sesiones activas.

### TABLA: `workout_logs`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid | PK |
| session_id | uuid | FK → workout_sessions.id |
| exercise_id | uuid | FK → **exercises.id** (no gym_equipment) |
| set_number | int4 | |
| sets | int4 | default 1 |
| weight_kg | numeric | |
| reps | int4 | |
| rpe | int4 | |
| is_pr | bool | false — ⚠️ BUG: no se auto-calcula (TD-03) |
| time | numeric | default 0 |
| distance | numeric | default 0 |
| metrics_data | jsonb | `{}` datos extra |
| category_snapshot | text | músculo al momento del log |
| owner_id | uuid | para coop: quién hizo la serie |
| created_at | timestamptz | |

### TABLA: `exercises`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid | PK |
| name | text | |
| description | text | |
| muscle_group | text | |
| target_muscle_group | varchar(100) | columna adicional más reciente |
| video_url | text | |
| created_by | uuid | null = global/sistema |
| is_verified | bool | false |
| created_at | timestamptz | |

> ⚠️ **ALERTA**: `workout_logs.exercise_id` → `exercises.id`, pero `routine_exercises.exercise_id` → `gym_equipment.id`. Son tablas DISTINTAS. No confundir al hacer queries.

### TABLA: `routine_exercises`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid | PK |
| routine_id | uuid | FK → routines.id |
| exercise_id | uuid | FK → **gym_equipment.id** (no exercises!) |
| order_index | int4 | |
| track_weight/reps/time/rpe/distance | bool | métricas a mostrar |
| target_sets | int4 | default 3 |
| target_reps_text | text | ej: "8-12" |
| custom_notes | text | |
| custom_metric | text | |
| track_pr | bool | false |
| name | text | default 'Ejercicio Personalizado' |

### TABLA: `gym_equipment`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid | PK |
| gym_id | uuid | FK → gyms.id |
| name | text | |
| category | text | |
| quantity | int4 | default 1 |
| condition | text | default 'Good' |
| verified_by | uuid | FK → profiles.id |
| metrics | jsonb | `{"reps":true,"weight":true}` |
| image_url | text | |
| icon | text | |

### TABLA: `routines`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| gym_id | uuid | FK → gyms.id (nullable) |
| name | text | |
| description | text | |
| is_active | bool | true |
| is_public | bool | true |
| created_at | timestamptz | |

### TABLA: `gyms`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid | PK |
| place_id | text | UNIQUE — Google Places ID |
| name | text | |
| address | text | |
| lat / lng | float8 | índice en (lat, lng) |
| description | text | |
| vibe | text | |
| crowd_level | text | |
| owner_id | uuid | |
| is_verified | bool | false |

### TABLA: `user_gyms` (passport del usuario)
| Columna | Tipo | Notas |
|---------|------|-------|
| user_id | uuid | PK composite |
| gym_id | uuid | PK composite, FK → gyms.id |
| since | date | CURRENT_DATE |
| is_home_base | bool | false |
| is_favorite | bool | false |
| custom_bg_url | text | |
| custom_color | text | |

> `UserPrimaryGym` en el código incluye `gym_name` y `google_place_id` — vienen de JOIN con `gyms` en UserService.

### TABLA: `notifications`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → profiles.id |
| type | text | 'system'\|'coop_invite'\|'coop_accepted'\|'coop_join_request'\|'coop_join_accepted'\|'room_closed' |
| title | text | |
| message | text | |
| data | jsonb | `{}` — payload extra (sender_id, mode, chat_id, session_id, partner_id) |
| is_read | bool | false |
| created_at | timestamptz | |

> RLS SELECT permite al sender ver sus propias notificaciones enviadas: `data->>'sender_id' = auth.uid()`

### TABLA: `follows`
| Columnas | Notas |
|----------|-------|
| follower_id → profiles.id | |
| following_id → profiles.id | |
| PK: (following_id, follower_id) | composite |

### TABLA: `gym_alphas` (ranking semanal por gym)
| Columna | Notas |
|---------|-------|
| gym_id, user_id | |
| week_start / week_end | date |
| total_volume | numeric |
| total_workouts | int4 |
| consistency_score | numeric |
| is_current | bool — true = semana activa |
| achieved_at / dethroned_at | timestamptz |

### TABLA: `alpha_history` (historial acumulado)
| Columna | Notas |
|---------|-------|
| user_id, gym_id | UNIQUE juntos |
| times_alpha | cuántas veces fue alpha |
| total_weeks | semanas totales como alpha |
| last_alpha_at | |

### TABLA: `challenges`
| Columnas clave | Notas |
|----------------|-------|
| challenger_id, defender_id | IDs de participantes |
| gym_id | FK → gyms (nullable) |
| wager_amount | int4 — apuesta en GX |
| metric | default 'total_volume' |
| status | 'pending'\|'active'\|'completed'\|... |
| challenger_score / defender_score | float8 |
| winner_id | uuid |

### TABLA: `posts`
| Columna | Notas |
|---------|-------|
| type | 'reel'\|'photo'\|... |
| media_url | URL principal |
| thumbnail_url | para videos |
| linked_routine_id | FK → routines.id |
| views_count, shares_count, saves_count | contadores desnormalizados |
| viral_score / virality_score | ⚠️ dos columnas similares |
| boost_factor | default 1.0 |

### TABLAS SOCIALES (simples)
| Tabla | Propósito | PK |
|-------|-----------|-----|
| `post_likes` | likes a posts | (post_id, user_id) |
| `post_media` | archivos adicionales por post (carousel) | id, UNIQUE(post_id, order_index) |
| `post_saves` | posts guardados | (user_id, post_id) |
| `post_views` | historial de vistas | (user_id, post_id) + duration, percentage_watched |
| `comments` | comentarios en posts | id, FK post_id → posts, user_id → profiles |

### TABLAS DE CHAT
| Tabla | Notas |
|-------|-------|
| `chats` | par (user_a, user_b) — UNIQUE pair index |
| `chat_messages` | FK chat_id → chats.id, is_read bool |

### TABLAS DE RUTINAS COMPARTIDAS
| Tabla | Notas |
|-------|-------|
| `routine_shares` | shared_by, shared_with, routine_id — UNIQUE(routine_id, shared_with) |
| `history_shares` | shared_by, shared_with — UNIQUE pair; controla visibilidad de workout_logs |

### TABLAS DE STREAKS
| Tabla | Notas |
|-------|-------|
| `user_streaks` | PK=user_id; current_streak, longest_streak, last_workout_date, status, recovery_deadline |
| `streak_logs` | event_type, streak_length — historial de eventos |

### OTRAS TABLAS
| Tabla | Notas |
|-------|-------|
| `checkins` | user_id + gym_id + created_at — log de visitas físicas |
| `gym_favorites` | (user_id, gym_id) — gyms favoritos (distinto de user_gyms.is_favorite) |
| `user_blocks` | blocked_by, blocked_user — UNIQUE pair |

---

## 19. RELACIONES CRÍTICAS BD (las que más confunden)

```
profiles.id
  ├─ user_gyms.user_id          ← passport de gyms del usuario
  ├─ workout_sessions.user_id   ← sesiones de entrenamiento
  ├─ routines.user_id           ← rutinas creadas
  ├─ follows.follower_id        ← a quién sigo
  ├─ follows.following_id       ← quiénes me siguen
  └─ notifications.user_id      ← notificaciones recibidas

workout_sessions.id
  └─ workout_logs.session_id    ← series registradas

workout_logs.exercise_id  → exercises.id          ← tabla de ejercicios GLOBAL
routine_exercises.exercise_id → gym_equipment.id   ← equipamiento del GYM (¡diferente!)

posts.id
  ├─ post_likes.(post_id)
  ├─ post_media.(post_id)
  ├─ post_saves.(post_id)
  ├─ post_views.(post_id)
  └─ comments.(post_id)

gyms.id
  ├─ user_gyms.gym_id           ← quiénes están en ese gym
  ├─ gym_equipment.gym_id       ← equipamiento del gym
  ├─ gym_alphas.gym_id          ← ranking semanal
  ├─ alpha_history.gym_id       ← historial alpha
  └─ workout_sessions.gym_id    ← sesiones en ese gym
```

### Visibilidad del historial (workout_logs RLS)
Un usuario puede ver los logs de otra persona si:
1. Es el dueño (`workout_sessions.user_id = auth.uid()`)
2. El dueño tiene `profiles.custom_settings->>'is_history_public' = true`
3. Existe una fila en `history_shares` donde `shared_by = dueño` y `shared_with = auth.uid()`
