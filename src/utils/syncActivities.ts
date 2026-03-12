import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { parseLocalDateString, getDaysDifference } from './dateUtils';

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

        const displayName = user.displayName || 'Reader';

        const userDoc = await firestore().collection('users').doc(user.uid).get();
        const groupIds: string[] = userDoc.data()?.groupIds || [];

        if (groupIds.length === 0) {
            // User is not in any groups. No need to keep these queued.
            await AsyncStorage.removeItem(PENDING_ACTIVITIES_KEY);
            return;
        }

        const remaining: PendingActivity[] = [];

        // Sort queue by queuedAt so we process oldest activities first for correct streak incrementing
        queue.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());

        for (const activity of queue) {
            let successForAllGroups = true;

            const activityDate = new Date(activity.queuedAt);
            const activityYear = activityDate.getFullYear();
            const activityMonth = String(activityDate.getMonth() + 1).padStart(2, '0');
            const activityDay = String(activityDate.getDate()).padStart(2, '0');
            const activityLocalDateStr = `${activityYear}-${activityMonth}-${activityDay}`;

            for (const groupId of groupIds) {
                try {
                    const batch = firestore().batch();

                    // 1. Add Activity
                    const activityRef = firestore()
                        .collection('groups')
                        .doc(groupId)
                        .collection('activities')
                        .doc(); // Auto-gen ID

                    batch.set(activityRef, {
                        userId: activity.userId,
                        userName: displayName,
                        bookName: activity.bookName,
                        chapters: activity.chapters,
                        timestamp: firestore.FieldValue.serverTimestamp(),
                        type: activity.type,
                    });

                    // 2. Update Member Streak & Date
                    const memberRef = firestore()
                        .collection('groups')
                        .doc(groupId)
                        .collection('members')
                        .doc(activity.userId);

                    const memberDoc = await memberRef.get();
                    const memberData = memberDoc.data() || {};
                    let streak = memberData.streak || 0;
                    const lastReadDateStr = memberData.lastReadDate;

                    if (lastReadDateStr) {
                        try {
                            const lastRead = parseLocalDateString(lastReadDateStr);
                            const current = parseLocalDateString(activityLocalDateStr);
                            const diff = getDaysDifference(lastRead, current);

                            if (diff === 1) {
                                streak += 1; // Read consecutive day
                            } else if (diff > 1) {
                                streak = 1; // Missed a day, reset
                            }
                            // if diff === 0, same day, streak unchanged
                            // if diff < 0, queued activity is older than lastReadDate, don't change streak
                        } catch {
                            streak += 1;
                        }
                    } else {
                        // First time reading
                        streak = 1;
                    }

                    // Only update lastReadDate if this activity is newer or same as what's there
                    if (!lastReadDateStr || activityLocalDateStr >= lastReadDateStr) {
                        batch.set(memberRef, {
                            userId: activity.userId,
                            displayName: displayName,
                            lastReadDate: activityLocalDateStr,
                            streak: streak,
                        }, { merge: true });
                    }

                    await batch.commit();

                } catch (err) {
                    console.error(`[syncActivities] Failed group ${groupId}:`, err);
                    successForAllGroups = false;
                }
            }

            if (!successForAllGroups) {
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
