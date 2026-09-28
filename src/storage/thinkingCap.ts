/**
 * The thinking cap the chosen sibling wears, by cloth id: put on at the
 * thinking-cap screen, taken off when the app walk ends. One value for the
 * whole app, like the look.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from './storageKeys';

let cloth: string | null = null;
/** Set once it is put on or taken off, so a late read can't undo it. */
let decided = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: string | null) {
    if (next === cloth) return;
    cloth = next;
    listeners.forEach((l) => l());
}

function load(): Promise<void> {
    loading ??= AsyncStorage.getItem(STORAGE_KEYS.THINKING_CAP)
        .then((v) => { if (!decided) set(v); })
        .catch(() => { loading = null; });
    return loading;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    void load();
    return () => { listeners.delete(listener); };
}

async function save(next: string | null) {
    decided = true;
    set(next);
    try {
        if (next) await AsyncStorage.setItem(STORAGE_KEYS.THINKING_CAP, next);
        else await AsyncStorage.removeItem(STORAGE_KEYS.THINKING_CAP);
    } catch (error) {
        console.error('Failed to save thinking cap:', error);
    }
}

export const putOnThinkingCap = (clothId: string) => save(clothId);
export const takeOffThinkingCap = () => save(null);

/** The cloth id of the cap being worn, or null. */
export function useThinkingCap(): string | null {
    return useSyncExternalStore(subscribe, () => cloth);
}
