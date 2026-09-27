/** Who is signed in, which groups they are in, and how writes are committed. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from '@react-native-firebase/auth';
import { FirebaseFirestoreTypes, getDoc, getFirestore, writeBatch } from '@react-native-firebase/firestore';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { userRef } from './paths';

export interface Me {
    uid: string;
    name: string;
}

/** The signed-in reader, or null: every groups call is a no-op when signed out. */
export async function currentMe(): Promise<Me | null> {
    const user = getAuth().currentUser;
    if (!user) return null;
    const local = await AsyncStorage.getItem(STORAGE_KEYS.USER_NAME).catch(() => null);
    return { uid: user.uid, name: user.displayName || local || user.email?.split('@')[0] || 'Reader' };
}

/** `users/{uid}.groupIds`, from the server when online and the cache when not. */
export async function myGroupIds(uid: string): Promise<string[]> {
    try {
        const ids = (await getDoc(userRef(uid))).data()?.groupIds;
        return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
    } catch {
        return [];
    }
}

export const errorCode = (error: unknown): string =>
    String((error as { code?: string })?.code ?? '').replace(/^firestore\//, '');

/** No connection, as opposed to the server saying no. */
export const isOffline = (error: unknown) => ['unavailable', 'deadline-exceeded'].includes(errorCode(error));

export type Settled = 'done' | 'queued';

const SETTLE_MS = 10_000;

/** A write acknowledged in time is 'done'; one still waiting on the network is 'queued' and lands later. */
export function settle(write: Promise<unknown>, ms: number = SETTLE_MS): Promise<Settled> {
    return new Promise<Settled>((resolve, reject) => {
        const timer = setTimeout(() => resolve('queued'), ms);
        write.then(
            () => { clearTimeout(timer); resolve('done'); },
            error => { clearTimeout(timer); reject(error); },
        );
    });
}

export const newBatch = () => writeBatch(getFirestore());

/** At most this many writes per batch, under Firestore's 500. */
export const BATCH_LIMIT = 450;

/** Commits `ops` in batches, with `last` in the final one so it lands only after the rest. */
export async function commitInBatches(
    ops: ((batch: FirebaseFirestoreTypes.WriteBatch) => void)[],
    last: (batch: FirebaseFirestoreTypes.WriteBatch) => void,
): Promise<Settled> {
    let result: Settled = 'done';
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const batch = newBatch();
        ops.slice(i, i + BATCH_LIMIT).forEach(op => op(batch));
        if (i + BATCH_LIMIT >= ops.length) last(batch);
        if ((await settle(batch.commit())) === 'queued') result = 'queued';
    }
    if (ops.length === 0) {
        const batch = newBatch();
        last(batch);
        result = await settle(batch.commit());
    }
    return result;
}
