# GymPartner — Contexto Técnico Completo

## ¿Qué es GymPartner?
App móvil-first (React + Capacitor) para **entrenar, conectar y conocer personas de gym**.
- Registro de entrenamientos: solo, dúo (2 personas) o grupo (hasta 8)
- Sistema de matches y amigos para entrenar juntos
- Radar de gymb ros cercanos (hombres/mujeres) con sus gyms
- Perfil decorable, reels, mensajes, stats, historial, rankings por gym

---

## Stack Técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Router | React Router DOM v6 (BrowserRouter) |
| Backend / DB | Supabase (Postgres + Realtime + Auth + Storage) |
| Mobile | Capacitor (Android + iOS) |
| Media | Cloudinary (fotos y videos) |
| Mapas | Google Maps API (`@vis.gl/react-google-maps`) |
| Gráficas | Recharts |
| Iconos | Lucide React |
| Notificaciones UI | react-hot-toast |
| Deploy | Railway (`npm run start:railway` → `node server.js`) |
| Repo | GitHub: `AndryRabanales/GymPartner` — rama `master` |

---

## Variables de entorno (`.env`)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GOOGLE_MAPS_API_KEY
VITE_CLOUDINARY_CLOUD_NAME
VITE_CLOUDINARY_UPLOAD_PRESET   (default: ginx_videos)
```

---

## Rutas de la app (`src/App.tsx`)

| Ruta | Componente | Descripción |
|---|---|---|
| `/` | `UserProfile` | Pantalla principal / perfil propio |
| `/workout` | `WorkoutSession` | Sesión de entrenamiento (sin gym) |
| `/workout/:gymId` | `WorkoutSession` | Sesión de entrenamiento en un gym |
| `/territory/:gymId/workout` | `WorkoutSession` | Entreno desde perfil de gym |
| `/arsenal` | `MyArsenal` | Gestor de equipamiento / ejercicios |
| `/territory/:gymId/arsenal` | `MyArsenal` | Arsenal de un gym específico |
| `/builder` | `RoutineBuilder` | Creador de rutinas |
| `/stats` | `StatsPage` | Estadísticas personales |
| `/history` | `HistoryPage` | Historial de entrenamientos |
| `/history/:sessionId` | `WorkoutDetailPage` | Detalle de sesión pasada |
| `/map` | `MapPage` | Mapa de gyms desbloqueados |
| `/radar` | `Radar` | Descubrimiento de gymb ros cercanos |
| `/friends` | `FriendsPage` | Matches y amigos |
| `/inbox` | `InboxPage` | Invitaciones (coop + match) |
| `/chat/:chatId` | `ChatPage` | Chat directo |
| `/ranking` | `RankingPage` | Ranking por gym |
| `/community` | `CommunityPage` | Feed social |
| `/reels` | `ReelsPage` | Reels de entrenamientos |
| `/notifications` | `NotificationsPage` | Centro de notificaciones |
| `/player/:username` | `PublicProfile` | Perfil público de otro usuario |
| `/territory/:gymId` | `GymProfile` | Perfil de un gym |
| `/login` | `LoginPage` | Login / registro (Supabase Auth) |

**Bottom Nav (5 tabs):** `/` (perfil) · `/friends` · `/radar` · `/inbox` · `/ranking`

---

## Estructura de archivos clave

```
src/
├── App.tsx                         # Rutas
├── index.css                       # Estilos globales (incluye iOS zoom fix)
├── layouts/
│   └── AppLayout.tsx               # Shell principal: auth guard, rescue modal,
│                                   # coop auditor, notificaciones realtime, bubble
├── pages/
│   ├── WorkoutSession.tsx          # ★ Archivo más complejo (~5000 líneas)
│   ├── UserProfile.tsx             # Perfil + inicio de sesión / invitar
│   ├── MyArsenal.tsx               # Equipamiento del gym
│   ├── RoutineBuilder.tsx          # Editor de rutinas
│   ├── FriendsPage.tsx             # Matches, enviar invitación coop
│   ├── InboxPage.tsx               # Aceptar invitaciones coop/match
│   └── ...
├── components/
│   ├── workout/
│   │   ├── ActiveWorkoutBubble.tsx # Mini bubble flotante (sesión en progreso)
│   │   └── ActiveSessionRescueModal.tsx  # Modal de recuperación de sesión
│   ├── common/
│   │   └── ForceExitModal.tsx      # Modal grande: Finalizar / Salir temp / Cancelar
│   ├── navigation/
│   │   └── BottomNav.tsx           # Barra de navegación inferior
│   └── ...
├── services/
│   ├── WorkoutService.ts           # ★ Sesiones, rutinas, logs, coop room
│   ├── UserService.ts              # Perfil, GX points, XP, passport de gyms
│   ├── NotificationService.ts      # Notificaciones push / in-app
│   ├── ChatService.ts              # Mensajes directos
│   ├── RadarService.ts             # Detección de gymb ros cercanos
│   ├── GymEquipmentService.ts      # Arsenal + COMMON_EQUIPMENT_SEEDS
│   ├── SocialService.ts            # Follows, posts, likes, comentarios
│   ├── StreakService.ts            # Rachas de entrenamiento
│   └── ...
├── context/
│   ├── AuthContext.tsx             # `user`, `session`, `loading` vía Supabase
│   └── BottomNavContext.tsx        # Control de visibilidad del bottom nav
└── lib/
    └── supabase.ts                 # Cliente Supabase (con limpieza de sesión expirada)
```

---

## Base de datos — Tablas principales (Supabase)

| Tabla | Uso |
|---|---|
| `profiles` | username, full_name, avatar_url, gx_points, xp, bio |
| `workout_sessions` | Sesiones activas/finalizadas. Campos clave ↓ |
| `workout_logs` | Sets individuales guardados por sesión |
| `routines` | Rutinas guardadas por usuario |
| `routine_exercises` | Ejercicios de cada rutina (con order_index) |
| `gym_equipment` | Equipamiento por gym (arsenal) |
| `gyms` | Datos de cada gym |
| `user_gyms` | Relación usuario ↔ gym (passport) |
| `notifications` | Notificaciones in-app (ver tipos abajo) |
| `chats` | Conversaciones entre usuarios |
| `chat_messages` | Mensajes de cada chat |
| `posts` / `post_media` | Feed social / reels |
| `follows` | Relaciones de follow entre usuarios |
| `user_streaks` | Rachas de entrenamiento |
| `challenges` | Retos entre usuarios |

### `workout_sessions` — campos clave
```
id                  UUID (= room_id cuando es host)
user_id             UUID del dueño
gym_id              UUID del gym (null = libre)
started_at          ISO timestamp
finished_at         ISO timestamp (null = activa)
end_time            Alias de finished_at
notes               Texto libre
routine_name        Nombre de rutina usada
is_multiplayer      boolean
partner_id          UUID del partner (para duo: el otro usuario)
partner_session_id  UUID de la sesión del host (null si eres el host)
```

**Modelo coop:**
- **Host**: `id = room_id`, `partner_session_id = null`
- **Guest**: `partner_session_id = room_id (id del host)`
- Room "activa" = host session con `finished_at = null`

---

## Sistema de Notificaciones — Tipos ENUM (`notification_type`)

| Tipo | Cuándo se usa |
|---|---|
| `coop_invite` | Alguien invita a entrenar juntos |
| `coop_accepted` | El invitado aceptó la invitación del host |
| `coop_join_request` | Alguien pide unirse a una sala abierta |
| `coop_join_accepted` | El host aceptó la solicitud |
| `room_closed` | El host cerró la sala (avisa a guests) |
| `invitation` | Match / invitación de amistad |
| `follower` | Alguien te siguió |
| `ranking_change` | Cambio de posición en el ranking |
| `reward` | Recompensa ganada |
| `system` | Mensajes del sistema |
| `gym_join` | Alguien se unió a tu gym |

---

## Gamificación

| Elemento | Descripción |
|---|---|
| **GX Points** | Moneda de gamificación. Se suman con `userService.addGxPoints(userId, amount, reason)`. RPC: `increment_gx_points` |
| **XP** | Deprecado (columna existe pero `addXP` es no-op) |
| **Streaks** | Rachas de entrenamiento diario (`StreakService`) |
| **Alpha Badge** | Insignia de usuario top (`AlphaService`) |
| **Passport de Gyms** | Gyms desbloqueados por el usuario (`user_gyms`) |

**GX por entrenar:** +3 puntos si la sesión ≥ 20 min y es la primera del día. Para coop rooms se otorga en `closeRoom()`.

---

## WorkoutSession — Arquitectura interna

### Modos de sesión
| `isMultiplayer` | `multiplayerMode` | `isInviter` | Descripción |
|---|---|---|---|
| false | null | true | Solo |
| true | `'conjunto'` | true | Host de sala grupal |
| true | `'conjunto'` | false | Guest de sala grupal |
| true | `'separado'` | — | Duo en paralelo (cada uno su rutina) |

### Estado crítico en memoria
```typescript
activeExercises: WorkoutExercise[]   // Ejercicios activos con sus sets
sessionId: string | null             // ID de la sesión en DB
startTime: Date | null               // Inicio del timer
isFinished: boolean                  // true = timer parado, guards desactivados
isLeavingPageRef: MutableRef<bool>   // true = navegación autorizada
```

### LocalStorage / SessionStorage
| Key | Tipo | Contenido |
|---|---|---|
| `ginx_active_session` | localStorage | Datos básicos de sesión activa |
| `workout_draft_${sessionId}` | localStorage | Ejercicios + sets en borrador |
| `ginx_coop_state` | localStorage | `{isMultiplayer, multiplayerMode, partnerId, chatId, partnerSessionId, isInviter}` |
| `ginx_join_time_${roomId}` | localStorage | Timestamp de entrada a la sala |
| `ginx_weight_unit` | localStorage | `'kg'` o `'lb'` |
| `ginx_temp_exit_active` | sessionStorage | `'true'` cuando el usuario salió temporalmente |

### Canal Realtime (Supabase Broadcast)
Canal: `coop-workout-${syncRoomId}` donde `syncRoomId = host session ID`

| Evento | Dirección | Contenido |
|---|---|---|
| `request_hydration` | cualquiera → todos | Solicitar estado completo |
| `sync_state` | host → guests | `exercises, routineName, isRoutineModified` |
| `sync_session_id` | guest ↔ host | `sessionId, startTime, sender` |
| `session_terminated` | host → guests | Room cerrada |
| `session_finished` | cualquiera → todos | Sesión finalizada |
| `participant_left` | guest → todos | Un participante abandonó |

### Flujo de finalización
1. `handleFinishRequest()` → verifica si la rutina ya existe (smart skip)
2. Si es nueva → `showRoutineModal = true` (con back arrow para cancelar)
3. `onSaveRoutine(name)` → crea rutina → `checkLocationStep()`
4. `checkLocationStep()` → `handleFinalizeSession()`
5. Para host coop: `workoutService.closeRoom(roomId)` → finaliza host + guests + GX + notificaciones
6. Para guest coop: `workoutService.finishSession(sessionId)` + broadcast `participant_left`
7. Para solo: `workoutService.finishSession(sessionId)`

### Guard de retroceso (Back Button)
- Pushea 2 entradas de historia al montar
- `popstate` → hace temp-exit directo (navega a `/`, setea `ginx_temp_exit_active`)
- `ActiveWorkoutBubble` aparece automáticamente como recordatorio flotante
- `ForceExitModal` solo se abre desde el botón explícito de salir dentro del workout

---

## AppLayout — Responsabilidades

- **Auth guard**: redirige a `/login` si no hay sesión
- **Rescue modal** (`ActiveSessionRescueModal`): detecta sesiones activas al navegar. Para coop respeta `ginx_temp_exit_active`. Para sesiones frías (sin el flag) siempre muestra el modal.
- **Coop auditor**: listener realtime en `notifications` que detecta `coop_accepted` y `coop_join_accepted` para navegar automáticamente a `/workout` con el estado coop correcto
- **Notificaciones realtime**: canal Supabase en `notifications` para mostrar toasts y manejar acciones inmediatas
- **ActiveWorkoutBubble**: componente flotante que aparece cuando hay sesión activa y el usuario NO está en `/workout`

---

## ActiveWorkoutBubble

Componente flotante (`bottom-24 right-4 z-50`) que aparece en cualquier ruta excepto `/workout`.
- Muestra: timer en vivo, label "En Progreso" (solo) o "Sala Activa" (coop)
- Botón `X`: cancela/elimina la sesión (con confirm)
- Botón `VOLVER`: navega de vuelta al workout pasando `sessionId + forceNewSession: false` + coop state del localStorage

---

## ActiveSessionRescueModal

Modal de recuperación que AppLayout muestra cuando detecta una sesión activa en DB al montar:

| `roomStatus` | Qué muestra | Acción principal |
|---|---|---|
| `'checking'` | Spinner | — |
| `'room_open'` | Timer + miembros activos | "VOLVER A LA SALA" |
| `'room_closed'` | Aviso de sala cerrada | "ENTENDIDO" (finaliza sesión del guest) |
| `'solo'` | Timer | "RETOMAR ENTRENAMIENTO" |

**Detección host/guest:** `amHost = !mySess.partner_session_id`

---

## WorkoutExercise + WorkoutSet — Tipos completos

```typescript
interface WorkoutSet {
  id: string                           // UI temp ID
  weight: number; reps: number
  time?: number                        // segundos
  distance?: number                    // metros
  rpe?: number                         // 1-10
  completed: boolean
  completedAt?: number                 // ms timestamp
  locked?: boolean
  restStatus?: 'running'|'paused'|'completed'
  restAccumulated?: number             // ms acumulados
  restLastStartTime?: number           // ms timestamp inicio

  // Coop N-players (mapa por user_id)
  playerWeights/Reps/Times/Distances/Rpes?: Record<string, number>
  playerCompleted/Locked?: Record<string, boolean>
  playerCompletedAt?: Record<string, string>
  playerRestStatus?: Record<string, 'running'|'paused'|'completed'>
  playerRestAccumulated/LastStartTime?: Record<string, number>

  // Campos legacy duo (p2 = primer guest)
  p2_weight/reps/time/distance/rpe?: number
  p2_completed/locked?: boolean
  p2_restStatus?: 'running'|'paused'|'completed'
  p2_restAccumulated/LastStartTime?: number
}

interface WorkoutExercise {
  id: string                           // UI temp ID
  equipmentId: string                  // ID en gym_equipment (o 'virtual-${name}')
  equipmentName: string
  metrics: { weight, reps, time, distance, rpe: boolean; [custom]: boolean }
  sets: WorkoutSet[]
  weightUnit?: 'kg' | 'lb'
  category?: string
}
```

---

## Patrones de código importantes

### Ids virtuales
Ejercicios del seed global que no existen en el gym usan `id = 'virtual-${nombre}'`. Al guardar rutina, se resuelven a UUIDs reales con upsert en `gym_equipment`.

### Normalización de texto
`normalizeText(str)` — quita acentos, lowercase, trim. Usado para comparar nombres de ejercicios sin distinguir mayúsculas/acentos.

### `resolveExerciseId(name)`
Busca o crea un registro en `gym_equipment` para un nombre de ejercicio. Usado al persistir sets en `workout_logs`.

### Detección de rutina duplicada
`routineAlreadyExists(userId, exercises)` — compara `exerciseId|exerciseId|...` en orden exacto con las rutinas guardadas del usuario. Si hay match, salta el modal de guardar rutina.

### GX duplicate-award guard
Antes de otorgar GX por entreno, consulta sesiones con `finished_at LIKE '{today}%'`. Si `count <= 1` (solo la actual) → otorga. Esto evita doble premio.

---

## Componentes de UI reutilizables clave

| Componente | Uso |
|---|---|
| `ArsenalGrid` | Grid de ejercicios con selección por toggle |
| `ArsenalCard` | Tarjeta individual de ejercicio |
| `EquipmentForm` | Formulario crear/editar ejercicio |
| `ForceExitModal` | Modal Finalizar/SalirTemp/Cancelar (uso explícito) |
| `CoopWorkoutModal` | Modal para configurar sala coop |
| `RestTimerDisplay` | Timer de descanso por participante |
| `BattleTimer` | Timer de la batalla/sesión |
| `MuscleRadarChart` | Radar chart de grupos musculares |
| `ShareOverlay` | Overlay para compartir stats |
| `EditProfileModal` | Editor de perfil |
| `PlayerProfileModal` | Ver perfil de otro jugador mid-app |

---

## Bugs conocidos / estado actual

| ID | Descripción | Estado |
|---|---|---|
| BUG-01 | Sesión perdida al apagarse el teléfono | Parcialmente resuelto (RescueModal) |
| BUG-02 | Back button guard | Solucionado (popstate → temp-exit) |
| BUG-03 | Timer sigue cuando participante se va | Solucionado |
| BUG-04 | Zoom iOS en inputs | Solucionado (text-[16px] + CSS global) |
| BUG-05 | Header coop tapa X del panel de ejercicios | Solucionado (z-[90]) |
| BUG-06 | Duplicación de ejercicios en coop | Solucionado (newlySelectedCount) |

---

## Convenciones de commits

```
feat(scope): descripción
fix(scope): descripción
```
Scopes comunes: `workout`, `ui`, `coop`, `auth`, `profile`, `social`

---

## Comandos útiles

```bash
# Desarrollo local
npm run dev

# Build
npm run build

# Deploy (Railway lo hace automáticamente al push a master)
git push origin master
```
