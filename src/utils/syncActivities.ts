import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from '@react-native-firebase/auth';
import {
    getFirestore,
    doc,
    collection,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    writeBatch,
    serverTimestamp,
    deleteField,
    FirebaseFirestoreTypes
} from '@react-native-firebase/firestore';
import { parseLocalDateString, getDaysDifference, formatDateToLocalString } from './dateUtils';
import { getNewlyEarnedStreakBadges, getNewlyEarnedReflectionBadges, MILESTONE_BADGES, GROUP_BADGES, Badge } from './badges';

const PENDING_ACTIVITIES_KEY = 'pending_firestore_activities';

export interface PendingActivity {
    userId: string;
    activityId: string;
    userName?: string;
    bookName?: string;
    chapters?: string;
    type: 'journal_entry' | 'member_joined' | 'member_absent' | 'member_removed' | 'reflection_shared' | 'admin_promoted';
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
 *
 * Returns null when activityDateStr is the same or older than the last recorded
 * date — in this case, the streak should NOT be updated (handles same-day reads
 * from multiple members and out-of-order queue flushes).
 */
const computeGroupStreak = (
    existingStreak: number,
    lastDateStr: string | undefined,
    activityDateStr: string
): { groupStreak: number; groupStreakLastDate: string } | null => {
    // Same-day or stale activity — do not mutate the streak
    if (lastDateStr && activityDateStr <= lastDateStr) return null;

    if (!lastDateStr) {
        return { groupStreak: 1, groupStreakLastDate: activityDateStr };
    }
    const groupStreak = incrementStreak(existingStreak, lastDateStr, activityDateStr);
    return { groupStreak, groupStreakLastDate: activityDateStr };
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
        batch.set(doc(activitiesRef), {
            type: activityType,
            ...badgeFields(badge),
            ...extraActivityFields,
            timestamp: serverTimestamp(),
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
let isSyncing = false;

export const syncPendingActivities = async (): Promise<void> => {
    if (isSyncing) return;
    isSyncing = true;
    try {
        const existing = await AsyncStorage.getItem(PENDING_ACTIVITIES_KEY);
        if (!existing) return;

        const queue: PendingActivity[] = JSON.parse(existing);
        if (queue.length === 0) return;

        const user = getAuth().currentUser;
        if (!user) return; // Not signed in — leave the queue intact

        const displayName = user.displayName || 'Reader';

        const userDoc = await getDoc(doc(getFirestore(), 'users', user.uid));
        const userData = userDoc.data() || {};
        const groupIds: string[] = userData.groupIds || [];
        const userGender = userData.gender;

        if (groupIds.length === 0) {
            // User is not in any groups. No need to keep these queued.
            await AsyncStorage.removeItem(PENDING_ACTIVITIES_KEY);
            return;
        }

        await AsyncStorage.removeItem(PENDING_ACTIVITIES_KEY);

        const failed: PendingActivity[] = [];

        // Sort oldest-first so streak increments happen in chronological order
        queue.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());

        for (const activity of queue) {
            let successForAllGroups = true;

            const activityDate = new Date(activity.queuedAt);
            const activityLocalDateStr = formatDateToLocalString(activityDate);

            for (const groupId of groupIds) {
                try {
                    // ── Fetch current member + group state ──────────────────
                    const db = getFirestore();
                    const groupRef = doc(db, 'groups', groupId);
                    const memberRef = doc(groupRef, 'members', activity.userId);
                    const activitiesRef = collection(groupRef, 'activities');

                    const [memberDoc, groupDoc] = await Promise.all([
                        getDoc(memberRef),
                        getDoc(groupRef),
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
                    const groupStreakResult = computeGroupStreak(
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
                    const batch = writeBatch(getFirestore());

                    // 1. Activity feed entry
                    // Use activityId as the Firestore doc ID so that if this item is
                    // somehow processed twice the second write simply overwrites the
                    // same document instead of creating a duplicate feed card.
                    const activityPayload: Record<string, any> = {
                        userId: activity.userId,
                        userName: activity.userName || displayName,
                        timestamp: serverTimestamp(),
                        type: activity.type,
                    };

                    if (activity.bookName) activityPayload.bookName = activity.bookName;
                    if (activity.chapters) activityPayload.chapters = activity.chapters;
                    if (activity.reflectionPreview) activityPayload.preview = activity.reflectionPreview;
                    if (activity.sharedQuestionTitle) activityPayload.sharedQuestionTitle = activity.sharedQuestionTitle;
                    if (activity.sharedReflectionText) activityPayload.sharedReflectionText = activity.sharedReflectionText;

                    batch.set(doc(activitiesRef, activity.activityId), activityPayload);

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

                            // ── Admin qualification ─────────────────────────
                            // If the member hits 21 consecutive days this month,
                            // record it so evaluateGroupAdminRoles() can promote
                            // them to admin at the start of next month.
                            const alreadyQualifiedThisMonth =
                                memberData.adminQualifiedMonth === currentMonth;
                            const adminQualUpdate: Record<string, any> =
                                monthlyStreak >= 21 && !alreadyQualifiedThisMonth
                                    ? { adminQualifiedMonth: currentMonth }
                                    : {};

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
                                    ...adminQualUpdate,
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
                                    ...adminQualUpdate,
                                }, { merge: true });
                            }

                            // Group streak + readToday
                            const groupUpdate: Record<string, any> = {
                                readTodayCount,
                                readTodayDate: activityLocalDateStr,
                                memberCount,
                            };
                            if (groupStreakResult) {
                                groupUpdate.groupStreak = groupStreakResult.groupStreak;
                                groupUpdate.groupStreakLastDate = groupStreakResult.groupStreakLastDate;
                            }
                            batch.set(groupRef, groupUpdate, { merge: true });

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
                                    timestamp: serverTimestamp(),
                                });
                            }

                            // Group streak milestone badges
                            const existingGroupBadgeIds: string[] = groupData.badges || [];
                            const currentGroupStreak = groupStreakResult?.groupStreak ?? (groupData.groupStreak || 0);
                            const groupStreakCandidates = GROUP_BADGES.filter(
                                b => b.id.startsWith('group_streak') &&
                                    b.threshold! > (groupData.groupStreak || 0) &&
                                    b.threshold! <= currentGroupStreak
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

            if (!successForAllGroups) failed.push(activity);
        }

        if (failed.length > 0) {
            // Re-append only the items that failed to commit.
            // Merge with anything a parallel sync may have added while we were running.
            const currentRaw = await AsyncStorage.getItem(PENDING_ACTIVITIES_KEY);
            const currentQueue: PendingActivity[] = currentRaw ? JSON.parse(currentRaw) : [];
            await AsyncStorage.setItem(
                PENDING_ACTIVITIES_KEY,
                JSON.stringify([...currentQueue, ...failed])
            );
        }
    } catch (error) {
        console.error('[syncActivities] Sync failed:', error);
    } finally {
        isSyncing = false;
    }
};

/**
 * Checks for inactive members in a group and posts alerts for 7-day and 30-day absences.
 * Only posts once every 7 days per member to avoid feed spam.
 */
export const checkInactiveMembers = async (groupId: string): Promise<void> => {
    try {
        const db = getFirestore();
        const groupRef = doc(db, 'groups', groupId);
        const membersSnapshot = await getDocs(collection(groupRef, 'members'));
        const activitiesRef = collection(groupRef, 'activities');

        const today = new Date();

        for (const doc of membersSnapshot.docs) {
            const member = doc.data();
            if (!member.lastReadDate) continue;

            const diff = getDaysDifference(parseLocalDateString(member.lastReadDate), today);
            if (diff < 7) continue;

            const threshold = diff >= 30 ? 30 : 7;

            const q = query(
                activitiesRef,
                where('userId', '==', doc.id),
                where('type', '==', 'member_absent'),
                orderBy('timestamp', 'desc'),
                limit(1)
            );
            const recentAlerts = await getDocs(q);

            if (!recentAlerts.empty) {
                const lastAlertDate = recentAlerts.docs[0].data().timestamp?.toDate() || new Date(0);
                if (getDaysDifference(lastAlertDate, today) < 7) continue;
            }

            await addDoc(activitiesRef, {
                userId: doc.id,
                userName: member.displayName || 'Reader',
                type: 'member_absent',
                timestamp: serverTimestamp(),
                threshold,
            });
        }
    } catch (error) {
        console.error('[checkInactiveMembers] Error:', error);
    }
};

// ─── Admin Role Evaluation ────────────────────────────────────────────────────

/**
 * Returns a "YYYY-MM" string for the month N months before the given month string.
 */
const subtractOneMonth = (monthStr: string): string => {
    const [year, month] = monthStr.split('-').map(Number);
    if (month === 1) return `${year - 1}-12`;
    return `${year}-${String(month - 1).padStart(2, '0')}`;
};

/**
 * Evaluates admin role eligibility for all members of a group at month boundaries.
 *
 * Rules:
 * - A member qualifies for admin by achieving monthlyStreak >= 21 in a calendar
 *   month (recorded as adminQualifiedMonth on their doc).
 * - At the start of a new month, if adminQualifiedMonth === previousMonth they
 *   are promoted to role:'admin'; otherwise their role is cleared.
 * - First-contact grace: if adminRoleMonth is undefined the member's role is
 *   left untouched; only adminRoleMonth is stamped to currentMonth so the system
 *   will properly evaluate them at the *next* month boundary.
 *
 * Safe to call on every group screen load — it is idempotent within a month.
 */
export const evaluateGroupAdminRoles = async (groupId: string): Promise<void> => {
    try {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const previousMonth = subtractOneMonth(currentMonth);

        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[now.getMonth()];

        const db = getFirestore();
        const groupRef = doc(db, 'groups', groupId);
        const membersSnapshot = await getDocs(collection(groupRef, 'members'));
        const activitiesRef = collection(groupRef, 'activities');

        // Collect members that need evaluation this month
        const toEvaluate = membersSnapshot.docs.filter(
            (doc: any) => doc.data().adminRoleMonth !== currentMonth
        );

        if (toEvaluate.length === 0) return;

        const batch = writeBatch(db);

        for (const doc of toEvaluate) {
            const data = doc.data();
            const memberRef = doc(collection(groupRef, 'members'), doc.id);

            if (data.adminRoleMonth === undefined) {
                // First-contact grace period — stamp the month, leave role as-is
                batch.set(memberRef, { adminRoleMonth: currentMonth }, { merge: true });
                continue;
            }

            const qualified = data.adminQualifiedMonth === previousMonth;
            const currentRole = data.role;

            if (qualified) {
                batch.set(memberRef, {
                    role: 'admin',
                    adminRoleMonth: currentMonth,
                }, { merge: true });

                if (currentRole !== 'admin') {
                    // New promotion!
                    batch.set(doc(activitiesRef), {
                        userId: doc.id,
                        userName: data.displayName || 'Reader',
                        type: 'admin_promoted',
                        monthName,
                        timestamp: serverTimestamp(),
                    });
                }
            } else {
                // Not qualified — clear the role field
                batch.set(memberRef, {
                    role: deleteField(),
                    adminRoleMonth: currentMonth,
                }, { merge: true });
            }
        }

        await batch.commit();
    } catch (error) {
        console.error('[evaluateGroupAdminRoles] Error:', error);
    }
};
