// ── Network-hang guard ───────────────────────────────────────────────────────
// The core problem this file solves: `navigator.onLine` can report `true`
// even when the connection is actually dead (wifi just dropped, weak signal,
// captive portal, etc.). Code that gates on `navigator.onLine` to decide
// "should I await the database or use the cache?" gets this wrong constantly:
// it believes there's a connection, awaits a Supabase call with NO timeout,
// and that call hangs (native NSURLSession waits ~60s+ before giving up).
// The screen freezes waiting for a response that never comes.
//
// The fix is architectural, not a patch: NEVER let a database call be the
// thing standing between the user and seeing their data. `navigator.onLine`
// is not used anywhere in this file — it's irrelevant. Instead:
//   1. Always read the local cache first and show it immediately (no network).
//   2. Race the real network call against a short timer in the background.
//   3. If the network wins in time, update silently. If not, do nothing —
//      the user already has the cached data on screen.

/**
 * Resolves to `fallback` if `promise` doesn't settle within `ms`. Never
 * rejects — network errors are swallowed and treated the same as a timeout.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        Promise.resolve(promise).catch(() => fallback),
        new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
    ]);
}

/**
 * The standard "cache-first, DB-never-blocks" pattern used across the app.
 *
 * - Loads the local cache and calls `onCache` with it IMMEDIATELY if present
 *   (synchronous-feeling — no network involved).
 * - In parallel, races the network fetch against `timeoutMs`. If it wins,
 *   `onFresh` is called with the live data and the cache is refreshed via
 *   `saveCache`. If it loses (timeout or error), nothing else happens — the
 *   cached render already satisfied the user.
 *
 * Returns once both the cache attempt and the network attempt have settled,
 * so callers can flip a `loading` flag off deterministically.
 */
export async function cacheFirst<T>(opts: {
    loadCache: () => Promise<T | null>;
    fetchFresh: () => Promise<T | null>;
    saveCache: (data: T) => void;
    onCache: (data: T) => void;
    onFresh: (data: T) => void;
    timeoutMs?: number;
}): Promise<void> {
    const { loadCache, fetchFresh, saveCache, onCache, onFresh, timeoutMs = 3500 } = opts;

    const cached = await loadCache().catch(() => null);
    if (cached) onCache(cached);

    const fresh = await withTimeout(fetchFresh(), timeoutMs, null);
    if (fresh) {
        onFresh(fresh);
        saveCache(fresh);
    }
}
