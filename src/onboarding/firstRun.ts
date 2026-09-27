/**
 * A new user's first run: a practice entry with the chosen sibling, then a walk
 * around Home. Onboarding starts it; users who never onboarded never see it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../storage/storageKeys';

export type FirstRun = 'practice' | 'walk' | 'done';

export async function getFirstRun(): Promise<FirstRun | null> {
    try {
        return (await AsyncStorage.getItem(STORAGE_KEYS.FIRST_RUN)) as FirstRun | null;
    } catch {
        return null;
    }
}

export async function setFirstRun(stage: FirstRun): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.FIRST_RUN, stage);
    } catch (error) {
        console.error('Failed to save first run stage:', error);
    }
}
