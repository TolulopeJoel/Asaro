/**
 * Which look of Àṣàrò the reader chose. One value for the whole app, so every
 * face follows a change the moment it is made.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from './storageKeys';
import type { AsaroLook } from '../theme/asaroRig';

const LOOKS: readonly AsaroLook[] = ['male', 'female'];

let current: AsaroLook = 'male';
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((l) => l());
}

function load() {
    loading ??= AsyncStorage.getItem(STORAGE_KEYS.ASARO_LOOK)
        .then((v) => {
            if (LOOKS.includes(v as AsaroLook) && v !== current) {
                current = v as AsaroLook;
                notify();
            }
        })
        .catch(() => { loading = null; });
    return loading;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    void load();
    return () => { listeners.delete(listener); };
}

export function getAsaroLook(): AsaroLook {
    return current;
}

export async function setAsaroLook(look: AsaroLook) {
    current = look;
    notify();
    await AsyncStorage.setItem(STORAGE_KEYS.ASARO_LOOK, look);
}

export function useAsaroLook(): AsaroLook {
    return useSyncExternalStore(subscribe, getAsaroLook);
}
