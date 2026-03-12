import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const PENDING_ACTIVITIES_KEY = 'pending_firestore_activities';

export interface PendingActivity {
    userId: string;
    bookName: string;
    chapters: string;
    type: 'reading_completed';
    /** ISO timestamp recorded at queue time */
    queuedAt: string;
}

/**
 * Append one activity to the offline queue.
 * Call this when a Firestore push fails due to no network.
 */
export const queueActivity = async (activity: PendingActivity): Promise<void> => {
    try {
        const existing = await AsyncStorage.getItem(PENDING_ACTIVITIES_KEY);
        const queue: PendingActivity[] = existing ? JSON.parse(existing) : [];
        queue.push(activity);
        await AsyncStorage.setItem(PENDING_ACTIVITIES_KEY, JSON.stringify(queue));
    } catch (error) {
        console.error('[syncActivities] Failed to queue activity:', error);
    }
};

/**
 * Attempt to push all queued activities to Firestore.
 * Successfully pushed items are removed from the queue.
 * Safe to call at any time — silently exits if not online or not signed in.
 */
export const syncPendingActivities = async (): Promise<void> => {
    try {
        const existing = await AsyncStorage.getItem(PENDING_ACTIVITIES_KEY);
        if (!existing) return;

        const queue: PendingActivity[] = JSON.parse(existing);
        if (queue.length === 0) return;

        const user = auth().currentUser;
        if (!user) return; // Not signed in — leave the queue intact

        // Resolve the display name once from the authoritative source
        const displayName = user.displayName || 'Reader';

        const remaining: PendingActivity[] = [];

        for (const activity of queue) {
            try {
                await firestore()
                    .collection('groups')
                    .doc('official-accountability-group')
                    .collection('activities')
                    .add({
                        userId: activity.userId,
                        userName: displayName,
                        bookName: activity.bookName,
                        chapters: activity.chapters,
                        timestamp: firestore.FieldValue.serverTimestamp(),
                        type: activity.type,
                    });
                // Successfully synced — don't add to remaining
            } catch {
                // Still offline or transient error — keep in queue
                remaining.push(activity);
            }
        }

        if (remaining.length === 0) {
            await AsyncStorage.removeItem(PENDING_ACTIVITIES_KEY);
        } else {
            await AsyncStorage.setItem(PENDING_ACTIVITIES_KEY, JSON.stringify(remaining));
        }
    } catch (error) {
        console.error('[syncActivities] Sync failed:', error);
    }
};
