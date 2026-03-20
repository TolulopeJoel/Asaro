import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { parseLocalDateString, getDaysDifference, formatDateToLocalString } from './dateUtils';
import { getNewlyEarnedStreakBadges, getNewlyEarnedReflectionBadges, MILESTONE_BADGES, GROUP_BADGES, Badge } from './badges';

const PENDING_ACTIVITIES_KEY = 'pending_firestore_activities';

export interface PendingActivity {
    userId: string;
    userName?: string;
    bookName?: string;
    chapters?: string;
    type: 'journal_entry' | 'member_joined' | 'member_absent' | 'member_removed' | 'reflection_shared';
    /** ISO timestamp recorded at queue time */
    queuedAt: string;
    /** Short reflection preview, if present */
    reflectionPreview?: string;
    /** Title of the reflection question shared */
    sharedQuestionTitle?: string;
    /** Full text of the shared reflection */
    sharedReflectionText?: string;
    /** Current total journal entry count (local) */
    totalEntries?: number;
    /** Current total reflections shared count (local) */
    totalReflections?: number;
}

// ─── Weekly Heatmap Helpers ───────────────────────────────────────────────────

/**
 * Returns a week string for a given date, e.g. "2026-W10".
 * Now starts on Sunday.
 */
export const getISOWeekString = (date: Date): string => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Find the Sunday of this week
    d.setDate(d.getDate() - d.getDay());

    // Calculate week number relative to the first Sunday of the year
    const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
    const firstSunday = new Date(firstDayOfYear);
    firstSunday.setDate(firstDayOfYear.getDate() + (7 - firstDayOfYear.getDay()) % 7);

    let weekNum = 1;
    if (d.getTime() >= firstSunday.getTime()) {
        weekNum = 1 + Math.round((d.getTime() - firstSunday.getTime()) / (7 * 86400000));
    }

    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

/**
 * Returns the 0-indexed day-of-week for a date, where 0=Sunday … 6=Saturday.
 */
const getSundayBasedDayIndex = (date: Date): number => date.getDay();

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
    base[getSundayBasedDayIndex(activityDate)] = true;
    return { weeklyActivity: base, weeklyActivityWeek: currentWeek };
};

// ─── Streak Helpers ───────────────────────────────────────────────────────────

/**
 * Increments a streak based on the day difference between last and current date.
 * - Same day  → unchanged
 * - +1 day    → incremented
 * - Gap > 1   → reset to 1
 * - No prior  → starts at 1
 */
const incrementStreak = (
    current: number,
    lastDateStr: string | undefined,
    currentDateStr: string
): number => {
    if (!lastDateStr) return 1;
    try {
        const diff = getDaysDifference(
            parseLocalDateString(lastDateStr),
            parseLocalDateString(currentDateStr)
        );
        if (diff === 1) return current + 1;
        if (diff > 1) return 1;
        return current; // same day — no change
    } catch {
        return 1;
    }
};

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
    const groupStreak = incrementStreak(existingStreak, lastDateStr, activityDateStr);
    // Same-day case: streak unchanged, keep the existing last date
    const groupStreakLastDate = groupStreak === existingStreak ? lastDateStr : activityDateStr;
    return { groupStreak, groupStreakLastDate };
};

// ─── Badge Helpers ────────────────────────────────────────────────────────────

const badgeFields = (badge: Badge) => ({
    badgeId: badge.id,
    badgeEmoji: badge.emoji,
    badgeLabel: badge.label,
    badgeDesc: badge.desc,
});

/**
 * Filters candidates to those not yet earned, writes the merged badges array
 * to docRef, and appends one feed activity per newly earned badge.
 * Uses collect-then-write so multiple badges in one batch can't clobber each other.
 */
const applyNewBadges = (
    batch: FirebaseFirestoreTypes.WriteBatch,
    candidates: Badge[],
    existingIds: string[],
    activityType: 'milestone_earned' | 'group_milestone',
    docRef: FirebaseFirestoreTypes.DocumentReference,
    activitiesRef: FirebaseFirestoreTypes.CollectionReference,
    extraActivityFields?: Record<string, any>
): void => {
    const earned = candidates.filter(b => !existingIds.includes(b.id));
    if (earned.length === 0) return;

    const updatedIds = [...new Set([...existingIds, ...earned.map(b => b.id)])];
    batch.set(docRef, { badges: updatedIds }, { merge: true });

    for (const badge of earned) {
        batch.set(activitiesRef.doc(), {
            type: activityType,
            ...badgeFields(badge),
            ...extraActivityFields,
            timestamp: firestore.FieldValue.serverTimestamp(),
        });
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
        const userData = userDoc.data() || {};
        const groupIds: string[] = userData.groupIds || [];
        const userGender = userData.gender;

        if (groupIds.length === 0) {
            // User is not in any groups. No need to keep these queued.
            await AsyncStorage.removeItem(PENDING_ACTIVITIES_KEY);
            return;
        }

        const remaining: PendingActivity[] = [];

        // Sort oldest-first so streak increments happen in chronological order
        queue.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());

        for (const activity of queue) {
            let successForAllGroups = true;

            const activityDate = new Date(activity.queuedAt);
            const activityLocalDateStr = formatDateToLocalString(activityDate);

            for (const groupId of groupIds) {
                try {
                    // ── Fetch current member + group state ──────────────────
                    const groupRef = firestore().collection('groups').doc(groupId);
                    const memberRef = groupRef.collection('members').doc(activity.userId);
                    const activitiesRef = groupRef.collection('activities');

                    const [memberDoc, groupDoc] = await Promise.all([
                        memberRef.get(),
                        groupRef.get(),
                    ]);

                    const memberData: Record<string, any> = memberDoc.data() || {};
                    const groupData: Record<string, any> = groupDoc.data() || {};

                    const lastReadDateStr: string | undefined = memberData.lastReadDate;

                    // ── Member streak ───────────────────────────────────────
                    const streak = incrementStreak(
                        memberData.streak || 0,
                        lastReadDateStr,
                        activityLocalDateStr
                    );

                    // ── Monthly streak & count ──────────────────────────────
                    const currentMonth = activityLocalDateStr.substring(0, 7); // "YYYY-MM"
                    const isNewMonth = memberData.monthlyActivityMonth !== currentMonth;
                    const isNewDay = !lastReadDateStr || activityLocalDateStr > lastReadDateStr;

                    let monthlyStreak = memberData.monthlyStreak || 0;
                    let monthlyActivityCount = memberData.monthlyActivityCount || 0;

                    if (isNewMonth) {
                        monthlyStreak = 1;
                        monthlyActivityCount = 1;
                    } else if (isNewDay) {
                        monthlyActivityCount += 1;
                        monthlyStreak = incrementStreak(monthlyStreak, lastReadDateStr, activityLocalDateStr);
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
                    const storedReadTodayDate: string | undefined = groupData.readTodayDate;
                    let readTodayCount: number = storedReadTodayDate === activityLocalDateStr
                        ? (groupData.readTodayCount || 0)
                        : 0;

                    const memberAlreadyCountedToday =
                        storedReadTodayDate === activityLocalDateStr &&
                        lastReadDateStr === activityLocalDateStr;

                    if (!memberAlreadyCountedToday) readTodayCount += 1;

                    const memberCount = groupData.memberCount || 1;

                    // ── Commit batch ────────────────────────────────────────
                    const batch = firestore().batch();

                    // 1. Activity feed entry
                    const activityPayload: Record<string, any> = {
                        userId: activity.userId,
                        userName: activity.userName || displayName,
                        timestamp: firestore.FieldValue.serverTimestamp(),
                        type: activity.type,
                    };

                    if (activity.bookName) activityPayload.bookName = activity.bookName;
                    if (activity.chapters) activityPayload.chapters = activity.chapters;
                    if (activity.reflectionPreview) activityPayload.preview = activity.reflectionPreview;
                    if (activity.sharedQuestionTitle) activityPayload.sharedQuestionTitle = activity.sharedQuestionTitle;
                    if (activity.sharedReflectionText) activityPayload.sharedReflectionText = activity.sharedReflectionText;

                    batch.set(activitiesRef.doc(), activityPayload);

                    // 2. Member / group updates
                    if (activity.type === 'journal_entry' || activity.type === 'reflection_shared') {

                        // ── Counts & badge candidates ───────────────────────
                        const prevStreak = memberData.streak || 0;
                        const prevReflections = memberData.totalReflections || 0;
                        const existingMemberBadgeIds: string[] = memberData.badges || [];

                        let totalEntries = Math.max(memberData.totalEntries || 0, activity.totalEntries ?? 0);
                        if (activity.totalEntries === undefined) totalEntries += 1;

                        let totalReflections = Math.max(memberData.totalReflections || 0, activity.totalReflections ?? 0);
                        if (activity.type === 'reflection_shared' && activity.totalReflections === undefined) totalReflections += 1;

                        const memberBadgeCandidates: Badge[] = [
                            ...getNewlyEarnedStreakBadges(prevStreak, streak),
                            ...getNewlyEarnedReflectionBadges(prevReflections, totalReflections),
                            ...MILESTONE_BADGES.filter(b => b.threshold && totalEntries >= b.threshold),
                        ];

                        // ── journal_entry: full member + group writes ───────
                        if (activity.type === 'journal_entry') {
                            if (!lastReadDateStr || activityLocalDateStr >= lastReadDateStr) {
                                batch.set(memberRef, {
                                    userId: activity.userId,
                                    displayName,
                                    gender: userGender,
                                    lastReadDate: activityLocalDateStr,
                                    streak,
                                    monthlyStreak,
                                    monthlyActivityMonth: currentMonth,
                                    monthlyActivityCount,
                                    weeklyActivity,
                                    weeklyActivityWeek,
                                    totalEntries,
                                    totalReflections,
                                }, { merge: true });
                            } else {
                                // Backfilled activity: still update heatmap, monthly stats, totals
                                batch.set(memberRef, {
                                    weeklyActivity,
                                    weeklyActivityWeek,
                                    totalEntries,
                                    totalReflections,
                                    monthlyStreak,
                                    monthlyActivityMonth: currentMonth,
                                    monthlyActivityCount,
                                }, { merge: true });
                            }

                            // Group streak + readToday
                            batch.set(groupRef, {
                                groupStreak,
                                groupStreakLastDate,
                                readTodayCount,
                                readTodayDate: activityLocalDateStr,
                                memberCount,
                            }, { merge: true });

                            // All-members-read-today badge
                            const allMembersReadToday =
                                !memberAlreadyCountedToday &&
                                readTodayCount >= memberCount &&
                                memberCount > 1;

                            if (allMembersReadToday) {
                                const allReadBadge = GROUP_BADGES.find(b => b.id === 'all_read_today')!;
                                batch.set(activitiesRef.doc(), {
                                    type: 'group_milestone',
                                    ...badgeFields(allReadBadge),
                                    timestamp: firestore.FieldValue.serverTimestamp(),
                                });
                            }

                            // Group streak milestone badges
                            const existingGroupBadgeIds: string[] = groupData.badges || [];
                            const groupStreakCandidates = GROUP_BADGES.filter(
                                b => b.id.startsWith('group_streak') &&
                                    b.threshold! > (groupData.groupStreak || 0) &&
                                    b.threshold! <= groupStreak
                            );

                            applyNewBadges(
                                batch,
                                groupStreakCandidates,
                                existingGroupBadgeIds,
                                'group_milestone',
                                groupRef,
                                activitiesRef
                            );

                            // ── reflection_shared: persist totalReflections ─────
                        } else if (activity.type === 'reflection_shared') {
                            batch.set(memberRef, { totalReflections }, { merge: true });
                        }

                        // ── Member milestone badges (journal_entry + reflection_shared) ──
                        applyNewBadges(
                            batch,
                            memberBadgeCandidates,
                            existingMemberBadgeIds,
                            'milestone_earned',
                            memberRef,
                            activitiesRef,
                            { userId: activity.userId, userName: activity.userName || displayName }
                        );
                    }

                    await batch.commit();

                } catch (err) {
                    console.error(`[syncActivities] Failed group ${groupId}:`, err);
                    successForAllGroups = false;
                }
            }

            if (!successForAllGroups) remaining.push(activity);
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
 * Checks for inactive members in a group and posts alerts for 7-day and 30-day absences.
 * Only posts once every 7 days per member to avoid feed spam.
 */
export const checkInactiveMembers = async (groupId: string): Promise<void> => {
    try {
        const groupRef = firestore().collection('groups').doc(groupId);
        const membersSnapshot = await groupRef.collection('members').get();
        const activitiesRef = groupRef.collection('activities');

        const today = new Date();

        for (const doc of membersSnapshot.docs) {
            const member = doc.data();
            if (!member.lastReadDate) continue;

            const diff = getDaysDifference(parseLocalDateString(member.lastReadDate), today);
            if (diff < 7) continue;

            const threshold = diff >= 30 ? 30 : 7;

            const recentAlerts = await activitiesRef
                .where('userId', '==', doc.id)
                .where('type', '==', 'member_absent')
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();

            if (!recentAlerts.empty) {
                const lastAlertDate = recentAlerts.docs[0].data().timestamp?.toDate() || new Date(0);
                if (getDaysDifference(lastAlertDate, today) < 7) continue;
            }

            await activitiesRef.add({
                userId: doc.id,
                userName: member.displayName || 'Reader',
                type: 'member_absent',
                timestamp: firestore.FieldValue.serverTimestamp(),
                threshold,
            });
        }
    } catch (error) {
        console.error('[checkInactiveMembers] Error:', error);
    }
};
