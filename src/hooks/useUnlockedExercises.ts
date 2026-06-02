import { useState, useCallback } from 'react';

const KEY = 'ginx_unlocked_exercises';

const load = (): Set<string> => {
    try {
        const raw = localStorage.getItem(KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
};

const save = (s: Set<string>) =>
    localStorage.setItem(KEY, JSON.stringify([...s]));

/**
 * Tracks which locked exercises the user has chosen to unlock.
 * An exercise is "unlocked" when the user taps the lock overlay.
 * Persisted to localStorage so it survives page reloads.
 */
export const useUnlockedExercises = () => {
    const [unlocked, setUnlocked] = useState<Set<string>>(load);

    const unlock = useCallback((exerciseId: string) => {
        setUnlocked(prev => {
            const next = new Set(prev);
            next.add(exerciseId);
            save(next);
            return next;
        });
    }, []);

    const isUnlocked = useCallback(
        (exerciseId: string) => unlocked.has(exerciseId),
        [unlocked]
    );

    return { unlock, isUnlocked };
};
