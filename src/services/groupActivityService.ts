import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { queueActivity, syncPendingActivities } from '../utils/syncActivities';
import { JournalEntry } from '../data/database';

/**
 * Shares a specific reflection from a journal entry to the user's groups.
 * False when signed out, in no group, or the queue write failed.
 */
export const shareReflectionToGroup = async (
    entry: JournalEntry,
    sharedText: string,
    questionTitle: string
): Promise<boolean> => {
    try {
        const user = getAuth().currentUser;
        if (!user) return false;

        // An unreadable user doc (offline, never cached) still queues; the sync decides then.
        const userDoc = await getDoc(doc(getFirestore(), 'users', user.uid)).catch(() => null);
        if (userDoc && (userDoc.data()?.groupIds || []).length === 0) return false;

        const chapters = entry.chapter_end && entry.chapter_end !== entry.chapter_start
            ? `${entry.chapter_start}-${entry.chapter_end}`
            : `${entry.chapter_start}`;

        const resolvedName = user.displayName || user.email?.split('@')[0] || 'Reader';

        const activity = {
            userId: user.uid,
            activityId: `${user.uid}_reflection_${entry.id}_${Date.now()}`,
            userName: resolvedName,
            bookName: entry.book_name,
            chapters,
            type: 'reflection_shared' as any,
            queuedAt: new Date().toISOString(),
            sharedQuestionTitle: questionTitle,
            sharedReflectionText: sharedText,
        };

        await queueActivity(activity);
        void syncPendingActivities(); // Runs sync in background
        return true;
    } catch (error) {
        console.error('[shareReflectionToGroup] Error queuing shared reflection:', error);
        return false;
    }
};
