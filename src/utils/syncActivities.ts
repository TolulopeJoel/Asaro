import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { getAuth } from '@react-native-firebase/auth';
import {
    getFirestore,
    doc,
    collection,
    getDoc,
    getDocs,
    setDoc,
    writeBatch,
    runTransaction,
    serverTimestamp,
    deleteField,
    arrayUnion,
    Timestamp,
    FirebaseFirestoreTypes
} from '@react-native-firebase/firestore';
import { parseLocalDateString, getDaysDifference, formatDateToLocalString } from './dateUtils';
import { getNewlyEarnedStreakBadges, getNewlyEarnedReflectionBadges, MILESTONE_BADGES, GROUP_BADGES, Badge } from './badges';
import { markWeekDay } from '../groups/week';

const PENDING_ACTIVITIES_KEY = STORAGE_KEYS.PENDING_ACTIVITIES;

export interface PendingActivity {
    userId: string;
    activityId: string;
    userName?: string;
    bookName?: string;
    chapters?: string;
    type: 'journal_entry' | 'member_joined' | 'member_absent' | 'member_removed' | 'reflection_shared' | 'admin_promoted';
    /** ISO timestamp recorded at queue time */
    queuedAt: string;
    /** Title of the reflection question shared */
    sharedQuestionTitle?: string;
    /** Full text of the shared reflection */
    sharedReflectionText?: string;
    /** Current total journal entry count (local) */
    totalEntries?: number;
    /** Current total reflections shared count (local) */
    totalReflections?: number;
    /** Groups still to be written; unset until the first attempt. */
    pendingGroupIds?: string[];
    /** Failed attempts, not counting the network being down. */
    attempts?: number;
}

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
 * Writes one feed card per badge not yet earned and returns their ids for the
 * owner doc's `badges`. Card ids are fixed per badge, so a replay rewrites them.
 */
const writeNewBadges = (
    tx: FirebaseFirestoreTypes.Transaction,
    candidates: Badge[],
    existingIds: string[],
    activityType: 'milestone_earned' | 'group_milestone',
    activitiesRef: FirebaseFirestoreTypes.CollectionReference,
    idPrefix: string,
    timestamp: unknown,
    extraActivityFields?: Record<string, any>
): string[] => {
    const earned = [...new Map(candidates.map(b => [b.id, b])).values()]
        .filter(b => !existingIds.includes(b.id));
    for (const badge of earned) {
        tx.set(doc(activitiesRef, `${idPrefix}${badge.id}`), {
            type: activityType,
            ...badgeFields(badge),
            ...extraActivityFields,
            timestamp,
        });
    }
    return earned.map(b => b.id);
};

// ─── Queue ────────────────────────────────────────────────────────────────────

// Every read-modify-write of the stored queue goes through this one lock.
let queueLock: Promise<unknown> = Promise.resolve();
const withQueueLock = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queueLock.then(fn, fn);
    queueLock = run.catch(() => undefined);
    return run;
};

const readQueue = async (): Promise<PendingActivity[]> => {
    const raw = await AsyncStorage.getItem(PENDING_ACTIVITIES_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/** One queued item; a re-queued activity gets a new `queuedAt`, so it is a new item. */
const itemKey = (a: PendingActivity) => `${a.activityId}@${a.queuedAt}`;

/**
 * Append one activity to the offline queue.
 * Call this when a Firestore push fails due to no network.
 */
export const queueActivity = (activity: PendingActivity): Promise<void> =>
    withQueueLock(async () => {
        try {
            const queue = await readQueue();
            queue.push(activity);
            await AsyncStorage.setItem(PENDING_ACTIVITIES_KEY, JSON.stringify(queue));
        } catch (error) {
            console.error('[syncActivities] Failed to queue activity:', error);
        }
    });

// ─── Sync ─────────────────────────────────────────────────────────────────────

const COMMIT_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 5;
/** The network, not the write: these never count towards MAX_ATTEMPTS. */
const TRANSIENT_CODES = new Set(['timeout', 'unavailable', 'deadline-exceeded', 'aborted', 'resource-exhausted']);
/** The group will never take this write, so it is dropped for that group. */
const PERMANENT_CODES = new Set(['permission-denied', 'not-found']);

const errorCode = (err: unknown): string =>
    String((err as { code?: string })?.code ?? '').replace(/^firestore\//, '');

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(Object.assign(new Error('Timed out'), { code: 'timeout' })), ms);
        promise.then(
            value => { clearTimeout(timer); resolve(value); },
            error => { clearTimeout(timer); reject(error); },
        );
    });

interface SyncContext {
    displayName: string;
    gender?: string;
    /** Set on the first network failure; the rest of the pass is left queued. */
    offline: boolean;
}

/**
 * Applies one activity to one group in a single transaction: the feed card,
 * the member's stats and the group's. The card carries `queuedAt`, so a replay
 * of an attempt that already landed changes nothing.
 */
const applyToGroup = (
    activity: PendingActivity,
    groupId: string,
    ctx: SyncContext,
    isRetry: boolean
): Promise<void> => {
    const db = getFirestore();
    const groupRef = doc(db, 'groups', groupId);
    const memberRef = doc(db, 'groups', groupId, 'members', activity.userId);
    const activitiesRef = collection(groupRef, 'activities');
    const activityRef = doc(activitiesRef, activity.activityId);

    return runTransaction(db, async tx => {
        const activitySnap = await tx.get(activityRef);
        const memberSnap = await tx.get(memberRef);
        const groupSnap = await tx.get(groupRef);

        if (activitySnap.exists() && activitySnap.data()?.queuedAt === activity.queuedAt) return;
        if (!groupSnap.exists()) {
            throw Object.assign(new Error(`Group ${groupId} no longer exists`), { code: 'not-found' });
        }

        const memberData: Record<string, any> = memberSnap.data() || {};
        const groupData: Record<string, any> = groupSnap.data() || {};
        const userName = activity.userName || ctx.displayName;

        const activityDate = new Date(activity.queuedAt);
        const day = formatDateToLocalString(activityDate);
        const month = day.substring(0, 7); // "YYYY-MM"
        // A retry keeps the time it was queued, so it can't jump to the top of a feed.
        const timestamp = isRetry ? Timestamp.fromDate(activityDate) : serverTimestamp();

        // ── Feed card ───────────────────────────────────────────────
        const activityPayload: Record<string, any> = {
            userId: activity.userId,
            userName,
            timestamp,
            queuedAt: activity.queuedAt,
            type: activity.type,
        };
        if (activity.bookName) activityPayload.bookName = activity.bookName;
        if (activity.chapters) activityPayload.chapters = activity.chapters;
        if (activity.sharedQuestionTitle) activityPayload.sharedQuestionTitle = activity.sharedQuestionTitle;
        if (activity.sharedReflectionText) activityPayload.sharedReflectionText = activity.sharedReflectionText;
        tx.set(activityRef, activityPayload);

        if (activity.type !== 'journal_entry' && activity.type !== 'reflection_shared') return;

        // ── Member stats ────────────────────────────────────────────
        const lastReadDateStr: string | undefined = memberData.lastReadDate;
        const isLatestDay = !lastReadDateStr || day >= lastReadDateStr;
        const isNewDay = !lastReadDateStr || day > lastReadDateStr;

        const prevStreak = memberData.streak || 0;
        const streak = incrementStreak(prevStreak, lastReadDateStr, day);

        let totalEntries = Math.max(memberData.totalEntries || 0, activity.totalEntries ?? 0);
        if (activity.totalEntries === undefined) totalEntries += 1;

        const prevReflections = memberData.totalReflections || 0;
        let totalReflections = Math.max(prevReflections, activity.totalReflections ?? 0);
        if (activity.type === 'reflection_shared' && activity.totalReflections === undefined) totalReflections += 1;

        const memberUpdate: Record<string, any> = { totalReflections };
        const groupUpdate: Record<string, any> = {};

        if (activity.type === 'journal_entry') {
            memberUpdate.totalEntries = totalEntries;

            if (isLatestDay) {
                Object.assign(memberUpdate, {
                    userId: activity.userId,
                    displayName: ctx.displayName,
                    lastReadDate: day,
                    streak,
                });
                if (ctx.gender !== undefined) memberUpdate.gender = ctx.gender;
            }

            // Monthly stats move forward only; an older month's activity leaves them alone.
            const storedMonth: string | undefined = memberData.monthlyActivityMonth;
            if (!storedMonth || month >= storedMonth) {
                let monthlyStreak = memberData.monthlyStreak || 0;
                let monthlyActivityCount = memberData.monthlyActivityCount || 0;
                if (storedMonth !== month) {
                    monthlyStreak = 1;
                    monthlyActivityCount = 1;
                } else if (isNewDay) {
                    monthlyActivityCount += 1;
                    monthlyStreak = incrementStreak(monthlyStreak, lastReadDateStr, day);
                }
                Object.assign(memberUpdate, {
                    monthlyStreak,
                    monthlyActivityMonth: month,
                    monthlyActivityCount,
                });
                // 21 days in a month qualifies them; evaluateGroupAdminRoles() promotes next month.
                if (monthlyStreak >= 21 && memberData.adminQualifiedMonth !== month) {
                    memberUpdate.adminQualifiedMonth = month;
                }
            }

            const week = markWeekDay(memberData.weeklyActivity, memberData.weeklyActivityWeek, activityDate);
            if (week) Object.assign(memberUpdate, week);

            // ── Group streak and read-today ─────────────────────────
            const groupStreakResult = computeGroupStreak(
                groupData.groupStreak || 0,
                groupData.groupStreakLastDate,
                day
            );
            if (groupStreakResult) Object.assign(groupUpdate, groupStreakResult);

            const storedReadTodayDate: string | undefined = groupData.readTodayDate;
            if (!storedReadTodayDate || day >= storedReadTodayDate) {
                const memberAlreadyCountedToday =
                    storedReadTodayDate === day && lastReadDateStr === day;
                const readTodayCount = (storedReadTodayDate === day ? (groupData.readTodayCount || 0) : 0)
                    + (memberAlreadyCountedToday ? 0 : 1);
                groupUpdate.readTodayCount = readTodayCount;
                groupUpdate.readTodayDate = day;

                // memberCount is only read here; join.tsx owns it.
                const memberCount: number = groupData.memberCount || 0;
                if (!memberAlreadyCountedToday && memberCount > 1 && readTodayCount >= memberCount) {
                    const allReadBadge = GROUP_BADGES.find(b => b.id === 'all_read_today')!;
                    tx.set(doc(activitiesRef, `all_read_today_${day}`), {
                        type: 'group_milestone',
                        ...badgeFields(allReadBadge),
                        timestamp,
                    });
                }
            }

            const currentGroupStreak = groupStreakResult?.groupStreak ?? (groupData.groupStreak || 0);
            const groupBadgeIds = writeNewBadges(
                tx,
                GROUP_BADGES.filter(
                    b => b.id.startsWith('group_streak') &&
                        b.threshold! > (groupData.groupStreak || 0) &&
                        b.threshold! <= currentGroupStreak
                ),
                groupData.badges || [],
                'group_milestone',
                activitiesRef,
                'group_',
                timestamp
            );
            if (groupBadgeIds.length > 0) groupUpdate.badges = arrayUnion(...groupBadgeIds);
        }

        // ── Member milestone badges (journal_entry + reflection_shared) ──
        const memberBadgeIds = writeNewBadges(
            tx,
            [
                ...(activity.type === 'journal_entry' ? getNewlyEarnedStreakBadges(prevStreak, streak) : []),
                ...getNewlyEarnedReflectionBadges(prevReflections, totalReflections),
                ...MILESTONE_BADGES.filter(b => b.threshold && totalEntries >= b.threshold),
            ],
            memberData.badges || [],
            'milestone_earned',
            activitiesRef,
            `milestone_${activity.userId}_`,
            timestamp,
            { userId: activity.userId, userName }
        );
        if (memberBadgeIds.length > 0) memberUpdate.badges = arrayUnion(...memberBadgeIds);

        tx.set(memberRef, memberUpdate, { merge: true });
        if (Object.keys(groupUpdate).length > 0) tx.set(groupRef, groupUpdate, { merge: true });
    });
};

/** Pushes one item to its groups. Returns the item still to be queued, or null when done. */
const pushActivity = async (
    activity: PendingActivity,
    groupIds: string[],
    ctx: SyncContext
): Promise<PendingActivity | null> => {
    const isRetry = activity.pendingGroupIds !== undefined;
    // Groups left since it was queued are dropped.
    const targets = (activity.pendingGroupIds ?? groupIds).filter(id => groupIds.includes(id));
    const remaining: string[] = [];
    let counted = false;

    for (const groupId of targets) {
        if (ctx.offline) {
            remaining.push(groupId);
            continue;
        }
        try {
            await withTimeout(applyToGroup(activity, groupId, ctx, isRetry), COMMIT_TIMEOUT_MS);
        } catch (err) {
            const code = errorCode(err);
            if (PERMANENT_CODES.has(code)) {
                console.warn(`[syncActivities] Dropping ${activity.activityId} for group ${groupId}: ${code}`);
                continue;
            }
            console.error(`[syncActivities] Failed group ${groupId}:`, err);
            remaining.push(groupId);
            if (TRANSIENT_CODES.has(code)) ctx.offline = true;
            else counted = true;
        }
    }

    if (remaining.length === 0) return null;
    const attempts = (activity.attempts ?? 0) + (counted ? 1 : 0);
    if (attempts >= MAX_ATTEMPTS) {
        console.warn(`[syncActivities] Giving up on ${activity.activityId} after ${attempts} attempts`);
        return null;
    }
    return { ...activity, pendingGroupIds: remaining, attempts };
};

/** One pass over the queue. Items already tried in this sync (`tried`) wait for the next. */
const syncOnce = async (tried: Set<string>): Promise<void> => {
    const user = getAuth().currentUser;
    if (!user) return; // Not signed in — leave the queue intact

    // Another account's items stay queued for that account.
    const queue = await withQueueLock(readQueue);
    const batch = queue.filter(a => a.userId === user.uid && !tried.has(itemKey(a)));
    if (batch.length === 0) return;
    batch.forEach(a => tried.add(itemKey(a)));

    const userDoc = await getDoc(doc(getFirestore(), 'users', user.uid));
    const userData = userDoc.data() || {};
    const groupIds: string[] = userData.groupIds || [];
    const ctx: SyncContext = {
        displayName: user.displayName || 'Reader',
        gender: userData.gender,
        offline: false,
    };

    // Oldest first, so streaks advance in order.
    batch.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());

    const outcomes = new Map<string, PendingActivity | null>();
    for (const activity of batch) {
        outcomes.set(itemKey(activity), await pushActivity(activity, groupIds, ctx));
    }

    // Write back from a fresh read, so anything queued meanwhile is kept.
    await withQueueLock(async () => {
        const current = await readQueue();
        const next = current.flatMap(a => {
            const key = itemKey(a);
            if (!outcomes.has(key)) return [a];
            const kept = outcomes.get(key);
            return kept ? [kept] : [];
        });
        if (next.length === 0) await AsyncStorage.removeItem(PENDING_ACTIVITIES_KEY);
        else await AsyncStorage.setItem(PENDING_ACTIVITIES_KEY, JSON.stringify(next));
    });
};

let running: Promise<void> | null = null;
let rerunRequested = false;

/**
 * Attempt to push all queued activities to Firestore.
 * Successfully pushed items are removed from the queue.
 * Safe to call at any time — a call during a sync makes it run again when done.
 */
export const syncPendingActivities = (): Promise<void> => {
    if (running) {
        rerunRequested = true;
        return running;
    }
    running = (async () => {
        const tried = new Set<string>();
        try {
            do {
                rerunRequested = false;
                try {
                    await syncOnce(tried);
                } catch (error) {
                    console.error('[syncActivities] Sync failed:', error);
                }
            } while (rerunRequested);
        } finally {
            running = null;
        }
    })();
    return running;
};

/**
 * Posts one alert per member per absence at the 7-day and 30-day marks. The
 * doc id is the whole rule: overlapping runs and other devices write the same card.
 */
export const checkInactiveMembers = async (groupId: string): Promise<void> => {
    try {
        const db = getFirestore();
        const groupRef = doc(db, 'groups', groupId);
        const membersSnapshot = await getDocs(collection(groupRef, 'members'));
        const activitiesRef = collection(groupRef, 'activities');

        const today = new Date();

        for (const memberDoc of membersSnapshot.docs) {
            const member = memberDoc.data();
            if (!member.lastReadDate) continue;

            const diff = getDaysDifference(parseLocalDateString(member.lastReadDate), today);
            if (diff < 7) continue;

            const threshold = diff >= 30 ? 30 : 7;
            const alertRef = doc(activitiesRef, `absent_${memberDoc.id}_${member.lastReadDate}_${threshold}`);

            // Only a server answer counts; a cache miss offline would repost it.
            const existing = await getDoc(alertRef);
            if (existing.exists() || existing.metadata.fromCache) continue;

            await setDoc(alertRef, {
                userId: memberDoc.id,
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
            (memberDoc: any) => memberDoc.data().adminRoleMonth !== currentMonth
        );

        if (toEvaluate.length === 0) return;

        const batch = writeBatch(db);

        for (const memberDoc of toEvaluate) {
            const data = memberDoc.data();
            const memberRef = doc(collection(groupRef, 'members'), memberDoc.id);

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
                    // One card per member per month, however many devices run this.
                    batch.set(doc(activitiesRef, `promoted_${memberDoc.id}_${currentMonth}`), {
                        userId: memberDoc.id,
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
