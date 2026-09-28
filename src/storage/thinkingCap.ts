/**
 * Whether the chosen sibling has the thinking cap on: from the end of the tour
 * until the app walk ends. One value for the whole app, like the look.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from './storageKeys';

let on = false;
/** Set once it is put on or taken off, so a late read can't undo it. */
let decided = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: boolean) {
    if (next === on) return;
    on = next;
    listeners.forEach((l) => l());
}

function load(): Promise<void> {
    loading ??= AsyncStorage.getItem(STORAGE_KEYS.THINKING_CAP)
        .then((v) => { if (!decided) set(v === 'on'); })
        .catch(() => { loading = null; });
    return loading;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    void load();
    return () => { listeners.delete(listener); };
}

async function save(next: boolean) {
    decided = true;
    set(next);
    try {
        if (next) await AsyncStorage.setItem(STORAGE_KEYS.THINKING_CAP, 'on');
        else await AsyncStorage.removeItem(STORAGE_KEYS.THINKING_CAP);
    } catch (error) {
        console.error('Failed to save thinking cap:', error);
    }
}

export const putOnThinkingCap = () => save(true);
export const takeOffThinkingCap = () => save(false);

export function useThinkingCap(): boolean {
    return useSyncExternalStore(subscribe, () => on);
}
