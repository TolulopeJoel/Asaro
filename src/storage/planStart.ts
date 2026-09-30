/**
 * Where the reader said they are in the plan, asked in onboarding after the tour,
 * or once of anyone who never answered it. It only moves which reading comes up next: the readings
 * before it are not done, because people read out of order and saying where
 * you are says nothing about what you have read.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from './storageKeys';

export interface PlanStart {
    /** The plan reading they said they are on. */
    id: number;
    /** When they said so, in SQLite's UTC form, so entries can be compared with it as text. */
    setAt: string;
}

/** Now, as SQLite's `CURRENT_TIMESTAMP` writes it: `YYYY-MM-DD HH:MM:SS`, UTC. */
function sqliteNow(): string {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export async function getPlanStart(): Promise<PlanStart | null> {
    try {
        const saved = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.PLAN_START)) ?? 'null');
        return saved && typeof saved.id === 'number' && typeof saved.setAt === 'string' ? saved : null;
    } catch {
        return null;
    }
}

export async function setPlanStart(id: number, setAt: string = sqliteNow()): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PLAN_START, JSON.stringify({ id, setAt }));
}
