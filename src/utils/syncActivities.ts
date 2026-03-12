import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { parseLocalDateString, getDaysDifference } from './dateUtils';

const PENDING_ACTIVITIES_KEY = 'pending_firestore_activities';

export interface PendingActivity {
    userId: string;
    userName?: string;
    bookName?: string;
    chapters?: string;
    type: 'journal_entry' | 'member_joined' | 'member_absent' | 'member_removed';
    /** ISO timestamp recorded at queue time */
    queuedAt: string;
    /** Short reflection preview, if present */
    reflectionPreview?: string;
}

// ─── Weekly Heatmap Helpers ───────────────────────────────────────────────────

/**
 * Returns the ISO week string for a given date, e.g. "2026-W10".
 * Week starts on Monday (ISO-8601).
 */
export const getISOWeekString = (date: Date): string => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // ISO week: Thursday of the current week determines the year
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

/**
 * Returns the 0-indexed day-of-week for a date, where 0=Monday … 6=Sunday.
 */
const getMondayBasedDayIndex = (date: Date): number => {
    return (date.getDay() + 6) % 7; // Sun=0 in JS, we want Mon=0
};

/**
 * Given existing weeklyActivity (7-element bool array) and its week string,
 * returns the updated array for activityDate. Resets if the week has rolled.
 */
export const computeWeeklyActivity = (
    existing: boolean[] | undefined,
    existingWeek: string | undefined,
    activityDate: Date
): { weeklyActivity: boolean[]; weeklyActivityWeek: string } => {
    const currentWeek = getISOWeekString(activityDate);
    const base: boolean[] = (existingWeek === currentWeek && Array.isArray(existing) && existing.length === 7)
        ? [...existing]
        : [false, false, false, false, false, false, false];
    base[getMondayBasedDayIndex(activityDate)] = true;
    return { weeklyActivity: base, weeklyActivityWeek: currentWeek };
};

// ─── Group Streak Helper ──────────────────────────────────────────────────────

/**
 * Computes the updated group streak given the current state on the group doc
 * and the date of the new activity.
 */
const computeGroupStreak = (
    existingStreak: number,
    lastDateStr: string | undefined,
    activityDateStr: string
): { groupStreak: number; groupStreakLastDate: string } => {
    if (!lastDateStr) {
        return { groupStreak: 1, groupStreakLastDate: activityDateStr };
    }
    try {
        const last = parseLocalDateString(lastDateStr);
        const current = parseLocalDateString(activityDateStr);
        const diff = getDaysDifference(last, current);
        if (diff === 0) {
            // Same day — no change
            return { groupStreak: existingStreak, groupStreakLastDate: lastDateStr };
        } else if (diff === 1) {
            // Consecutive day
            return { groupStreak: existingStreak + 1, groupStreakLastDate: activityDateStr };
        } else {
            // Streak broken
            return { groupStreak: 1, groupStreakLastDate: activityDateStr };
        }
    } catch {
        return { groupStreak: 1, groupStreakLastDate: activityDateStr };
    }
};

// ─── Queue ────────────────────────────────────────────────────────────────────

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

// ─── Sync ─────────────────────────────────────────────────────────────────────

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
            const todayDateStr = activityLocalDateStr; // same: derived from queue time

            for (const groupId of groupIds) {
                try {
                    // ── Fetch current member + group state ──────────────────
                    const groupRef = firestore().collection('groups').doc(groupId);
                    const memberRef = groupRef.collection('members').doc(activity.userId);

                    const [memberDoc, groupDoc] = await Promise.all([
                        memberRef.get(),
                        groupRef.get(),
                    ]);

                    const memberData = memberDoc.data() || {};
                    const groupData = groupDoc.data() || {};

                    // ── Member streak ───────────────────────────────────────
                    let streak = memberData.streak || 0;
                    const lastReadDateStr: string | undefined = memberData.lastReadDate;

                    if (lastReadDateStr) {
                        try {
                            const lastRead = parseLocalDateString(lastReadDateStr);
                            const current = parseLocalDateString(activityLocalDateStr);
                            const diff = getDaysDifference(lastRead, current);

                            if (diff === 1) {
                                streak += 1;
                            } else if (diff > 1) {
                                streak = 1;
                            }
                            // diff === 0 → same day, leave streak unchanged
                            // diff < 0  → older queued activity, skip
                        } catch {
                            streak += 1;
                        }
                    } else {
                        streak = 1;
                    }

                    // ── Weekly heatmap ──────────────────────────────────────
                    const { weeklyActivity, weeklyActivityWeek } = computeWeeklyActivity(
                        memberData.weeklyActivity,
                        memberData.weeklyActivityWeek,
                        activityDate
                    );

                    // ── Group streak ────────────────────────────────────────
                    const { groupStreak, groupStreakLastDate } = computeGroupStreak(
                        groupData.groupStreak || 0,
                        groupData.groupStreakLastDate,
                        activityLocalDateStr
                    );

                    // ── readTodayCount on group doc ─────────────────────────
                    // Reset count if the stored date is not today
                    const storedReadTodayDate: string | undefined = groupData.readTodayDate;
                    let readTodayCount: number = (storedReadTodayDate === todayDateStr)
                        ? (groupData.readTodayCount || 0)
                        : 0;

                    // Only increment if this member hasn't already been counted today
                    const memberAlreadyCountedToday =
                        storedReadTodayDate === todayDateStr &&
                        lastReadDateStr === todayDateStr;

                    if (!memberAlreadyCountedToday) {
                        readTodayCount += 1;
                    }

                    // ── Member count ────────────────────────────────────────
                    // Keep memberCount accurate (use subcollection size from groupData if available,
                    // otherwise rely on the group doc's denormalized field)
                    const memberCount = groupData.memberCount || 1;

                    // ── Commit batch ────────────────────────────────────────
                    const batch = firestore().batch();

                    // 1. Activity entry
                    const activityRef = groupRef.collection('activities').doc();
                    const activityDataToSet: any = {
                        userId: activity.userId,
                        userName: activity.userName || displayName || 'Reader',
                        timestamp: firestore.FieldValue.serverTimestamp(),
                        type: activity.type,
                    };

                    if (activity.bookName) activityDataToSet.bookName = activity.bookName;
                    if (activity.chapters) activityDataToSet.chapters = activity.chapters;
                    if (activity.reflectionPreview) activityDataToSet.preview = activity.reflectionPreview;

                    batch.set(activityRef, activityDataToSet);

                    // 2. Member/Group updates (only for journal entries)
                    if (activity.type === 'journal_entry') {
                        if (!lastReadDateStr || activityLocalDateStr >= lastReadDateStr) {
                            batch.set(memberRef, {
                                userId: activity.userId,
                                displayName,
                                lastReadDate: activityLocalDateStr,
                                streak,
                                weeklyActivity,
                                weeklyActivityWeek,
                            }, { merge: true });
                        } else {
                            // Still update heatmap even if date is not newer
                            batch.set(memberRef, { weeklyActivity, weeklyActivityWeek }, { merge: true });
                        }

                        batch.set(groupRef, {
                            groupStreak,
                            groupStreakLastDate,
                            readTodayCount,
                            readTodayDate: todayDateStr,
                            memberCount,
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

/**
 * Checks for inactive members in a group and segments alerts for 7-day and 30-day absences.
 * Uses lastReadDate for simplicity as requested.
 */
export const checkInactiveMembers = async (groupId: string): Promise<void> => {
    try {
        const groupRef = firestore().collection('groups').doc(groupId);
        const membersSnapshot = await groupRef.collection('members').get();
        const activitiesRef = groupRef.collection('activities');

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        for (const doc of membersSnapshot.docs) {
            const member = doc.data();
            if (!member.lastReadDate) continue;

            const lastRead = parseLocalDateString(member.lastReadDate);
            const diff = getDaysDifference(lastRead, today);

            if (diff >= 7) {
                const threshold = diff >= 30 ? 30 : 7;

                // Check if we've already alerted for this user recently to avoid spam
                // We'll search for 'member_absent' activities for this user
                const recentAlerts = await activitiesRef
                    .where('userId', '==', doc.id)
                    .where('type', '==', 'member_absent')
                    .orderBy('timestamp', 'desc')
                    .limit(1)
                    .get();

                let shouldPost = true;
                if (!recentAlerts.empty) {
                    const lastAlert = recentAlerts.docs[0].data();
                    const lastAlertDate = lastAlert.timestamp?.toDate() || new Date(0);
                    const daysSinceAlert = getDaysDifference(lastAlertDate, today);

                    // Only post once every 7 days
                    if (daysSinceAlert < 7) {
                        shouldPost = false;
                    }
                }

                if (shouldPost) {
                    await activitiesRef.add({
                        userId: doc.id,
                        userName: member.displayName || 'Reader',
                        type: 'member_absent',
                        timestamp: firestore.FieldValue.serverTimestamp(),
                        threshold, // 7 or 30
                    });
                }
            }
        }
    } catch (error) {
        console.error('[checkInactiveMembers] Error:', error);
    }
};
