# INFORME TÉCNICO: Arquitectura y Diseño de Software - GymPartner

Este documento detalla la estructura, patrones de diseño y decisiones arquitectónicas del proyecto para fines de documentación y defensa en Ingeniería de Software.

---

## 1. Arquitectura del Sistema (Macro-Arquitectura)

El proyecto sigue una arquitectura **Client-Server moderna basada en la nube**, específicamente una **Single Page Application (SPA)** con soporte **BaaS (Backend-as-a-Service)**.

### Diagrama Conceptual
```
[ CLIENTE (Browser/PWA) ]  <--->  [ API GATEWAY / SDK ]  <--->  [ NUBE (Supabase) ]
      |                                   |                            |
  - React 19                          - HTTPS / WSS                - PostgreSQL (Datos)
  - Capa de Servicios                                              - Auth (Identidad)
  - UI Components                                                  - Storage (Archivos)
```

### Características Clave:
*   **Desacoplamiento:** El Frontend es agnóstico a la infraestructura del Backend, comunicándose únicamente a través de APIs (Supabase SDK).
*   **Serverless:** No se gestiona un servidor de aplicaciones monolítico; la lógica de backend se distribuye entre funciones de base de datos (RPCs) y servicios del cliente.
*   **PWA (Progressive Web App):** Capacidad de instalación y funcionamiento offline limitado, comportándose como software nativo.

---

## 2. Patrones de Diseño Implementados

Se han aplicado patrones de diseño estándar de la industria para garantizar la mantenibilidad (uno de los requisitos del proyecto) y escalabilidad.

### A. Patrón Singleton (Creacional)
Todos los servicios de la aplicación se instancian como Singletons. Esto asegura que exista una única instancia del servicio manejando la conexión y el estado durante el ciclo de vida de la sesión.

*   **Evidencia en código:**
    ```typescript
    // src/services/UserService.ts
    class UserService { ... }
    export const userService = new UserService(); // exportación directa de la instancia
    ```
*   **Beneficio:** Reducción de consumo de memoria y punto central de acceso a la lógica de negocio.

### B. Patrón Facade / Fachada (Estructural)
Los archivos en `src/services/` actúan como una "Fachada" que oculta la complejidad de las consultas a la base de datos (Supabase, SQL, Joins) a los componentes de la interfaz.

*   **Funcionamiento:** Un componente (`UserProfile.tsx`) llama a `userService.getUserGyms()`. No sabe si los datos vienen de SQL, de una API REST o de un archivo local; solo recibe los datos limpios.
*   **Beneficio:** Cumple con el principio de **Separation of Concerns (Separación de Intereses)**. Si cambiamos Supabase por Firebase en el futuro, solo modificamos los Servicios, no la Vista.

### C. Patrón Observer / Provider (Comportamiento)
Implementado a través de **React Context API** para el manejo del estado global (ej. `AuthContext`).

*   **Funcionamiento:** Los componentes se "suscriben" a cambios en el estado de autenticación. Cuando el usuario inicia sesión, la UI se actualiza automáticamente en toda la aplicación sin necesidad de pasar props manualmente ("prop drilling").
*   **Beneficio:** Gestión eficiente del estado global y reactividad en tiempo real.

### D. Patrón Repository (Adaptado)
Las funciones dentro de los servicios actúan como un Repositorio de Datos, encapsulando las consultas `SELECT`, `INSERT`, `UPDATE` de SQL.

---

## 3. Principios de Ingeniería de Software Aplicados

### 1. Modularidad
El código está organizado en módulos funcionales claros:
*   `/components`: Bloques de construcción visual (Botones, Tarjetas).
*   `/pages`: Vistas completas que agrupan componentes.
*   `/services`: Lógica pura y comunicación de datos.
*   `/hooks`: Lógica de estado reutilizable.

### 2. High Cohesion (Alta Cohesión)
Cada archivo tiene una responsabilidad única. `UserService.ts` solo maneja usuarios; no maneja rutinas de gimnasio (que están en `WorkoutService.ts`). Esto facilita el **mantenimiento correctivo**, ya que un error en rutinas se aísla en un solo archivo.

### 3. Low Coupling (Bajo Acoplamiento)
Los componentes visuales son, en su mayoría, independientes de la lógica compleja. Reciben datos y funciones como propiedades o a través de Hooks, lo que permite reutilizarlos o testearlos aisladamente.

### 4. Tipado Estático (Robustez)
El uso de **TypeScript** impone contratos estrictos (Interfaces) sobre los datos.
*   *Mantenimiento Preventivo:* Evita errores de tipo "undefined is not a function" antes de compilar.
*   *Documentación:* Las interfaces (`UserPrimaryGym`, `Routine`) sirven como documentación viva de la estructura de datos.

---

## 4. Diseño de Base de Datos (Persistencia)

*   **Modelo:** Relacional (SQL).
*   **Normalización:** Se ha aplicado normalización para evitar redundancia de datos (Tablas separadas para `users`, `gyms`, `routines`, `routine_exercises`).
*   **Seguridad (RLS):** Implementación de **Row Level Security**. La seguridad no depende solo del código frontend, sino que está forzada a nivel de motor de base de datos (ej. "Un usuario solo puede ver sus propias rutinas privadas").

---

## 5. Conclusión para la Presentación

El proyecto **GymPartner** no es un script desordenado; es un sistema de software diseñado bajo **arquitectura modular de capas**, utilizando **patrones de diseño reconocidos** (Singleton, Facade) y **mejores prácticas de ingeniería** (TypeScript, CI/CD, Code Reviews implícitos en la estructura) que facilitan directamente los procesos de **Mantenimiento Perfectivo, Adaptativo, Correctivo y Preventivo**.
