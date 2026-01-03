# 🔍 Diagnóstico: Métricas Aparecen como FALSE

## El Problema

Según los logs:
```
👻 FINAL GHOST METRICS FOR Cruce de Poleas (Crossover): 
{rpe: false, reps: true, time: true, weight: true, distance: false}
```

**RPE debería estar TRUE pero aparece FALSE.**

## 3 Causas Posibles

### Causa 1: El ejercicio NO está en el inventario del gym actual
**Por qué pasa:**
- La rutina "pp" fue creada en el Arsenal Personal o en otro gym
- Cuando intentas entrenar en un gym diferente, el ejercicio no está en ese inventario
- El código lo trata como "Ghost Exercise"
- Usa `detail.equipment?.metrics` que puede venir NULL/undefined de la BD

**Solución:**
Ejecuta `DIAGNÓSTICO_COMPLETO_METRICS.sql` para verificar.

### Causa 2: La columna `metrics` en `gym_equipment` está NULL o vacía
**Por qué pasa:**
- El ejercicio existe pero nunca se le asignaron métricas
- `detail.equipment?.metrics` es `null` o `{}`
- El código hace: `const baseMetrics = detail.equipment?.metrics || defaultMetrics`
- Como es falsy, usa `defaultMetrics = {weight: true, reps: true, time: false, distance: false, rpe: false}`

**Solución:**
Ejecuta `FIX_NULL_METRICS.sql` para agregar métricas a todos los ejercicios.

### Causa 3: El LEFT JOIN en UserService no encuentra el ejercicio
**Por qué pasa:**
- `getRoutineDetails()` hace LEFT JOIN entre `routine_exercises` y `gym_equipment`
- Si el `exercise_id` no coincide con ningún registro (por gym diferente), `ge.metrics` es NULL
- Se pasa como `equipment: { metrics: null }`

**Solución:**
Necesitamos mejorar el código para que busque el ejercicio SIN importar el gym.

## 🎯 Solución Recomendada

### Paso 1: Ejecuta el Diagnóstico
```sql
-- Ejecuta este archivo completo
\i scripts/DIAGNÓSTICO_COMPLETO_METRICS.sql
```

Esto te dirá exactamente cuál es el problema.

### Paso 2: Si PASO 6 dice "NO EXISTE"
Significa que el ejercicio no está en el gym de la rutina. Tienes 2 opciones:

**Opción A:** Agregar el ejercicio al gym donde entrenas
**Opción B:** Modificar el código para que busque ejercicios globalmente (explicado abajo)

### Paso 3: Si metrics está NULL/vacío
```sql
-- Ejecuta este archivo
\i scripts/FIX_NULL_METRICS.sql
```

## 💻 Fix en el Código (si el problema es Causa 3)

Si el problema es que `getRoutineDetails()` solo busca ejercicios del mismo gym, necesitamos modificar la query:

**Archivo:** `src/services/UserService.ts` línea 293-296

**CAMBIAR:**
```typescript
const { data: dataV2, error: errorV2 } = await supabase
    .from('gym_equipment')
    .select('id, name, category, image_url, icon, metrics')
    .in('id', exerciseIds); // ← Solo busca por IDs, PERO puede estar en otro gym
```

**PROBLEMA:** Si el ejercicio está en otro gym con el mismo nombre pero diferente ID, no lo encuentra.

**SOLUCIÓN:** Agregar un fallback que busque por nombre si no se encuentra por ID:

```typescript
// Si algunos IDs no se encontraron, buscar por nombre globalmente
const foundIds = equipmentData?.map(e => e.id) || [];
const missingIds = exerciseIds.filter(id => !foundIds.includes(id));

if (missingIds.length > 0) {
    // Buscar por nombre en TODO gym_equipment
    const missingNames = routeExs
        ?.filter(re => missingIds.includes(re.exercise_id))
        .map(re => re.name);
    
    if (missingNames && missingNames.length > 0) {
        const { data: fallbackData } = await supabase
            .from('gym_equipment')
            .select('id, name, category, image_url, icon, metrics')
            .in('name', missingNames)
            .limit(missingNames.length);
        
        if (fallbackData) {
            equipmentData = [...(equipmentData || []), ...fallbackData];
        }
    }
}
```

## 📋 Próximos Pasos

1. **Ejecuta `DIAGNÓSTICO_COMPLETO_METRICS.sql`** y muéstrame los resultados
2. **Recarga la app** con los nuevos logs y cópiame la salida de:
   ```
   👻 detail.equipment FULL OBJECT: {...}
   👻 detail.equipment?.metrics: {...}
   👻 baseMetrics selected: {...}
   ```
3. Con esa info sabré exactamente cuál causa es y aplicaré el fix correcto

## 🚀 Quick Fix (mientras investigamos)

Si quieres que funcione YA, ejecuta esto:

```sql
-- Asegurar que Cruce de Poleas tenga TODAS las métricas en TRUE
UPDATE gym_equipment
SET metrics = '{"weight": true, "reps": true, "time": true, "distance": true, "rpe": true}'::jsonb
WHERE LOWER(name) LIKE '%cruce%poleas%' 
   OR id = '5bc73b06-1b7b-4faf-9722-bae74742428c';
```

Esto forzará que TODAS las métricas estén TRUE para ese ejercicio, sin importar dónde esté.
