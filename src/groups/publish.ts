/**
 * What the phone publishes to the reader's groups: readings, week docs, the
 * weekly reads counter, the one thing brought, shared practices and milestones. Every write is a `set` or
 * `delete` under a fixed id, fanned out to `users/{uid}.groupIds`, one batch per
 * group. Calls resolve once the writes are queued, not when the server has them.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import {
    FirebaseFirestoreTypes, Timestamp, arrayRemove, getDoc, getDocFromServer, increment, serverTimestamp, setDoc,
    where,
} from '@react-native-firebase/firestore';
import { AppState } from 'react-native';

import { isCadence } from '../data/actionKind';
import { getAllActionItems, getFirstEntryDate, getReadingProgress } from '../data/database';
import { withDatabase } from '../data/db';
import { practiceHistory } from '../data/practiceRepository';
import { QuestionId, REFLECTION_QUESTIONS } from '../data/questions';
import { READING_PLAN_DATA } from '../data/readingPlanData';
import { keptCount } from '../grove/grove';
import { loadBookTallies } from '../insight/detectors/milestone';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { formatRange } from '../utils/reference';
import {
    Counted, EntryRow, chaptersOf, countedWeek, dayKey, daysInWeek, markCounted, pruneBefore, pruneCounted, readingOf,
    shareFrom, shiftWeek, unmarkCounted, weekStartOf,
} from './derive';
import { milestoneId, practiceId, practiceItemId, readingId, shareId, weekDocId } from './ids';
import { EarnedMilestone, PostedMilestones, earnedMilestones, nextMilestones, postedInWeek } from './milestones';
import { Share } from './model';
import {
    PRUNED_COLLECTIONS, groupCollection, groupDocRef, memberRef, nudgesRef, readQuery, select, userRef, weekCountRef,
} from './paths';
import { Me, commitInBatches, currentMe, errorCode, myGroupIds, newBatch } from './session';
import { weekKey } from './week';

type Batch = FirebaseFirestoreTypes.WriteBatch;

// ─── Local data ───────────────────────────────────────────────────────────────

const ENTRY_SELECT = `
    SELECT je.id, je.book_name, je.chapter_start, je.chapter_end,
           datetime(je.created_at, 'localtime') AS created_local,
           je.reflection_1, je.reflection_2, je.reflection_4, je.study_further,
           EXISTS (SELECT 1 FROM action_items ai WHERE ai.entry_id = je.id AND TRIM(ai.action) != '') AS has_action
      FROM journal_entries je`;

const entryRow = (id: number) =>
    withDatabase(db => db.getFirstAsync<EntryRow>(`${ENTRY_SELECT} WHERE je.id = ?`, [id]));

/** Entries read on or after a local `YYYY-MM-DD`. */
const entriesFrom = (day: string) =>
    withDatabase(db => db.getAllAsync<EntryRow>(`${ENTRY_SELECT} WHERE DATE(je.created_at, 'localtime') >= ?`, [day]));

interface PracticeRow {
    id: number;
    entry_id: number;
    action: string;
    cadence: string | null;
    archived_at: string | null;
}

const practiceRow = (id: number) =>
    withDatabase(db => db.getFirstAsync<PracticeRow>(
        `SELECT id, entry_id, action, cadence, archived_at FROM action_items WHERE id = ?`, [id],
    ));

async function session(): Promise<{ me: Me; gids: string[] } | null> {
    const me = await currentMe();
    return me ? { me, gids: await myGroupIds(me.uid) } : null;
}

// ─── Sending ──────────────────────────────────────────────────────────────────

/** Commit without waiting on the network; a refusal checks whether the reader was removed. */
function send(uid: string, gid: string, batch: Batch): void {
    batch.commit().catch(error => {
        if (errorCode(error) === 'permission-denied') void checkMembership(gid, uid);
        else console.error(`[groups] write to ${gid} failed:`, error);
    });
}

function fanOut(uid: string, gids: string[], write: (batch: Batch, gid: string) => void): void {
    for (const gid of gids) {
        const batch = newBatch();
        write(batch, gid);
        send(uid, gid, batch);
    }
}

// ─── Readings, week docs and the counter ──────────────────────────────────────

/** Entries read in the week `key`. */
const entriesInWeek = (key: string) =>
    withDatabase(db => db.getAllAsync<EntryRow>(
        `${ENTRY_SELECT} WHERE DATE(je.created_at, 'localtime') >= ? AND DATE(je.created_at, 'localtime') < ?`,
        [key, shiftWeek(key, 1)],
    ));

async function weekDoc(uid: string, key: string) {
    const rows = await entriesInWeek(key);
    return { key, data: { userId: uid, weekKey: key, days: daysInWeek(rows.map(r => r.created_local), key) } };
}

const setWeekDocs = (batch: Batch, gid: string, uid: string, weeks: Awaited<ReturnType<typeof weekDoc>>[]) =>
    weeks.forEach(w => batch.set(groupDocRef(gid, 'weeks', weekDocId(uid, w.key)), w.data));

async function loadAllCounted(): Promise<Record<string, Counted>> {
    try {
        const all = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.GROUP_COUNTED)) ?? '{}');
        return all && typeof all === 'object' ? all : {};
    } catch {
        return {};
    }
}

async function saveCounted(uid: string, counted: Counted) {
    const all = await loadAllCounted();
    all[uid] = pruneCounted(counted, pruneBefore(new Date()));
    await AsyncStorage.setItem(STORAGE_KEYS.GROUP_COUNTED, JSON.stringify(all)).catch(() => { });
}

let countChain: Promise<unknown> = Promise.resolve();

/** Every read-modify-write of the counted record goes through here, one at a time. */
function withCounted<T>(uid: string, fn: (counted: Counted) => Promise<{ counted: Counted; result: T }>): Promise<T> {
    const run = countChain.then(async () => {
        const { counted, result } = await fn((await loadAllCounted())[uid] ?? {});
        await saveCounted(uid, counted);
        return result;
    });
    countChain = run.catch(() => undefined);
    return run;
}

/** One ±1 per write: the rules allow nothing else on a counter. */
function bump(uid: string, gid: string, key: string, by: 1 | -1) {
    const batch = newBatch();
    batch.set(weekCountRef(gid, key), { reads: increment(by) }, { merge: true });
    send(uid, gid, batch);
}

/** Write readings and their week docs, counting each entry once per group. */
async function publishRows(me: Me, gids: string[], rows: EntryRow[], now: Date): Promise<void> {
    const cutoff = pruneBefore(now);
    const readings = rows.map(row => ({ row, ...readingOf(row, me.uid) })).filter(r => r.data.weekKey >= cutoff);
    if (!readings.length || !gids.length) return;
    const weeks = await Promise.all([...new Set(readings.map(r => r.data.weekKey))].map(key => weekDoc(me.uid, key)));

    await withCounted(me.uid, async counted => {
        for (const gid of gids) {
            const batch = newBatch();
            const bumps: string[] = [];
            for (const r of readings) {
                const ref = groupDocRef(gid, 'readings', readingId(me.uid, r.row.id));
                batch.set(ref, { ...r.data, createdAt: Timestamp.fromDate(r.readAt) });
                if (countedWeek(counted, gid, r.row.id)) continue;
                // A reading already on the server was counted when it was first written.
                const exists = await getDoc(ref).then(d => d.exists()).catch(() => false);
                if (!exists) bumps.push(r.data.weekKey);
                counted = markCounted(counted, gid, r.data.weekKey, r.row.id);
            }
            setWeekDocs(batch, gid, me.uid, weeks);
            send(me.uid, gid, batch);
            bumps.forEach(key => bump(me.uid, gid, key, 1));
        }
        return { counted, result: undefined };
    });
}

/** Publish or overwrite one entry's reading. Call after the entry is saved. */
export async function publishReading(entryId: number): Promise<void> {
    try {
        const s = await session();
        if (!s?.gids.length) return;
        const row = await entryRow(entryId);
        if (row) await publishRows(s.me, s.gids, [row], new Date());
    } catch (error) {
        console.error('[groups] publishReading failed:', error);
    }
}

/** Remove a deleted entry's reading and its count, and the share and practices that came from it. */
export async function unpublishReading(entryId: number): Promise<void> {
    try {
        const s = await session();
        if (!s?.gids.length) return;
        const { me, gids } = s;
        await withCounted(me.uid, async counted => {
            for (const gid of gids) {
                const ref = groupDocRef(gid, 'readings', readingId(me.uid, entryId));
                let key = countedWeek(counted, gid, entryId);
                if (!key) {
                    const snap = await getDoc(ref).catch(() => null);
                    const stored = snap?.exists() ? snap.data()?.weekKey : null;
                    key = typeof stored === 'string' ? stored : null;
                }
                const fromEntry = (name: 'shares' | 'practices') => readQuery(select(
                    groupCollection(gid, name), where('userId', '==', me.uid), where('entryId', '==', entryId),
                )).then(snap => snap.docs).catch(() => []);
                const [shares, practices] = await Promise.all([fromEntry('shares'), fromEntry('practices')]);

                const batch = newBatch();
                batch.delete(ref);
                [...shares, ...practices].forEach(d => batch.delete(d.ref));
                if (key) setWeekDocs(batch, gid, me.uid, [await weekDoc(me.uid, key)]);
                send(me.uid, gid, batch);
                if (key) bump(me.uid, gid, key, -1);
                counted = unmarkCounted(counted, gid, entryId);
            }
            return { counted, result: undefined };
        });
    } catch (error) {
        console.error('[groups] unpublishReading failed:', error);
    }
}

/** Republish this week's readings everywhere, so a missed write heals by the next day. */
export async function publishWeek(): Promise<void> {
    const s = await session();
    if (!s?.gids.length) return;
    const now = new Date();
    fanOut(s.me.uid, s.gids, (batch, gid) => batch.update(memberRef(gid, s.me.uid), { displayName: s.me.name }));
    await publishRows(s.me, s.gids, await entriesInWeek(weekKey(now)), now);
}

/** Before leaving `gid`: take this reader's readings back out of its counters. */
export async function uncountGroup(gid: string): Promise<void> {
    const me = await currentMe();
    if (!me) return;
    await withCounted(me.uid, async counted => {
        for (const [key, ids] of Object.entries(counted[gid] ?? {})) ids.forEach(() => bump(me.uid, gid, key, -1));
        const { [gid]: _dropped, ...rest } = counted;
        return { counted: rest, result: undefined };
    });
}

/** Everything of this week a group just joined or created should have. */
export async function publishToGroup(gid: string): Promise<void> {
    try {
        const s = await session();
        if (!s) return;
        const { me } = s;
        const others = s.gids.filter(g => g !== gid);
        const now = new Date();
        const [rows, posted, share, practiceIds] = await Promise.all([
            entriesInWeek(weekKey(now)),
            loadPosted(me.uid),
            others.length ? myShareIn(others[0], me.uid, now) : Promise.resolve(null),
            sharedPracticeIds(me.uid, others),
        ]);
        const practices = await practiceDocs(me.uid, [...practiceIds], now);

        await publishRows(me, [gid], rows, now);

        const batch = newBatch();
        for (const m of posted ? postedInWeek(posted, now) : []) {
            const at = posted?.[m.key]?.at ?? now.getTime();
            batch.set(groupDocRef(gid, 'milestones', milestoneId(me.uid, m.key)), milestoneDoc(me.uid, m, Timestamp.fromMillis(at), now));
        }
        if (share) {
            const { id, ...data } = share;
            batch.set(groupDocRef(gid, 'shares', id), { ...data, createdAt: Timestamp.fromMillis(share.createdAt ?? now.getTime()) });
        }
        for (const p of practices) if (p.data) batch.set(groupDocRef(gid, 'practices', practiceId(me.uid, p.itemId)), p.data);
        send(me.uid, gid, batch);
    } catch (error) {
        console.error('[groups] publishToGroup failed:', error);
    }
}

// ─── The one thing brought ────────────────────────────────────────────────────

/** Bring one answer to every group, replacing this week's. Returns the share id, or null. */
export async function shareAnswer(entryId: number, question: QuestionId, text: string): Promise<string | null> {
    const s = await session();
    if (!s?.gids.length || !text.trim()) return null;
    const row = await entryRow(entryId);
    if (!row) return null;
    const now = new Date();
    const key = weekKey(now);
    const id = shareId(s.me.uid, key);
    const data = {
        userId: s.me.uid,
        entryId,
        questionId: question,
        question: REFLECTION_QUESTIONS.find(q => q.id === question)?.question ?? '',
        text: text.trim(),
        passage: formatRange(`${row.book_name} ${chaptersOf(row.chapter_start, row.chapter_end)}`.trim()),
        weekKey: key,
        createdAt: serverTimestamp(),
    };
    fanOut(s.me.uid, s.gids, (batch, gid) => batch.set(groupDocRef(gid, 'shares', id), data));
    return id;
}

/** Take a share back from one group, or from all of them. */
export async function removeShare(target: string | 'all', id: string): Promise<void> {
    const s = await session();
    if (!s) return;
    const gids = target === 'all' ? s.gids : [target];
    fanOut(s.me.uid, gids, (batch, gid) => batch.delete(groupDocRef(gid, 'shares', id)));
}

async function myShareIn(gid: string, uid: string, now: Date): Promise<Share | null> {
    try {
        const snap = await getDoc(groupDocRef(gid, 'shares', shareId(uid, weekKey(now))));
        return snap.exists() ? shareFrom(snap.id, snap.data() ?? {}) : null;
    } catch {
        return null;
    }
}

/** What the reader brought this week, if anything. */
export async function myShare(): Promise<Share | null> {
    const s = await session();
    if (!s?.gids.length) return null;
    return myShareIn(s.gids[0], s.me.uid, new Date());
}

// ─── Shared practices ─────────────────────────────────────────────────────────

/** Item ids of the practices shared with any of `gids`. */
async function sharedPracticeIds(uid: string, gids: string[]): Promise<Set<number>> {
    const ids = new Set<number>();
    await Promise.all(gids.map(async gid => {
        try {
            const snap = await readQuery(select(groupCollection(gid, 'practices'), where('userId', '==', uid)));
            snap.docs.forEach(d => {
                const id = practiceItemId(uid, d.id);
                if (id !== null) ids.add(id);
            });
        } catch {
            // Unreadable here; the other groups still answer.
        }
    }));
    return ids;
}

/** Each practice's doc for this week, or `data: null` for one no longer a live practice. */
async function practiceDocs(uid: string, itemIds: number[], now: Date) {
    const key = weekKey(now);
    return Promise.all(itemIds.map(async itemId => {
        const row = await practiceRow(itemId);
        if (!row || row.archived_at || !isCadence(row.cadence)) return { itemId, data: null };
        const kept = await practiceHistory(itemId);
        return {
            itemId,
            data: {
                userId: uid,
                itemId,
                entryId: row.entry_id,
                action: row.action.trim(),
                cadence: row.cadence,
                weekKey: key,
                keptDays: daysInWeek(kept, key),
            },
        };
    }));
}

async function writePractices(me: Me, gids: string[], itemIds: number[]) {
    const docs = await practiceDocs(me.uid, itemIds, new Date());
    fanOut(me.uid, gids, (batch, gid) => {
        for (const p of docs) {
            const ref = groupDocRef(gid, 'practices', practiceId(me.uid, p.itemId));
            if (p.data) batch.set(ref, p.data);
            else batch.delete(ref);
        }
    });
}

/** Share a practice and the days it was kept this week. False when it is not a live practice. */
export async function sharePractice(itemId: number): Promise<boolean> {
    const s = await session();
    if (!s?.gids.length) return false;
    const [doc] = await practiceDocs(s.me.uid, [itemId], new Date());
    if (!doc.data) return false;
    await writePractices(s.me, s.gids, [itemId]);
    return true;
}

export async function unsharePractice(itemId: number): Promise<void> {
    const s = await session();
    if (!s) return;
    fanOut(s.me.uid, s.gids, (batch, gid) => batch.delete(groupDocRef(gid, 'practices', practiceId(s.me.uid, itemId))));
}

/** Which of the reader's practices are shared, for the practice editor. */
export async function mySharedPracticeIds(): Promise<Set<number>> {
    const s = await session();
    return s ? sharedPracticeIds(s.me.uid, s.gids) : new Set();
}

/** Rewrite every shared practice's week; one no longer live is unshared. */
export async function refreshSharedPractices(): Promise<void> {
    const s = await session();
    if (!s?.gids.length) return;
    const ids = await sharedPracticeIds(s.me.uid, s.gids);
    if (ids.size) await writePractices(s.me, s.gids, [...ids]);
}

/** Call after a practice is kept or unkept: refreshes its shared days and checks for first fruit. */
export async function practiceChanged(itemId: number): Promise<void> {
    try {
        const s = await session();
        if (!s?.gids.length) return;
        const shared = await Promise.all(s.gids.map(gid =>
            getDoc(groupDocRef(gid, 'practices', practiceId(s.me.uid, itemId))).then(d => d.exists()).catch(() => false),
        ));
        if (shared.some(Boolean)) await writePractices(s.me, s.gids, [itemId]);
        await emitMilestones();
    } catch (error) {
        console.error('[groups] practiceChanged failed:', error);
    }
}

// ─── Milestones ───────────────────────────────────────────────────────────────

async function loadAllPosted(): Promise<Record<string, PostedMilestones>> {
    try {
        const all = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.GROUP_MILESTONES)) ?? '{}');
        return all && typeof all === 'object' ? all : {};
    } catch {
        return {};
    }
}

const loadPosted = async (uid: string): Promise<PostedMilestones | null> => (await loadAllPosted())[uid] ?? null;

async function savePosted(uid: string, posted: PostedMilestones) {
    const all = await loadAllPosted();
    all[uid] = posted;
    await AsyncStorage.setItem(STORAGE_KEYS.GROUP_MILESTONES, JSON.stringify(all));
}

const milestoneDoc = (uid: string, m: EarnedMilestone, createdAt: unknown, now: Date) => ({
    userId: uid,
    kind: m.kind,
    label: m.label,
    weekKey: weekKey(now),
    createdAt,
});

async function localPractices() {
    const items = (await getAllActionItems(1000)).filter(item => item.id !== undefined && isCadence(item.cadence));
    return Promise.all(items.map(async item => {
        const history = await practiceHistory(item.id!);
        const startedOn = (item.created_at ?? dayKey(new Date())).slice(0, 10);
        const first = history[0] && history[0] < startedOn ? history[0] : startedOn;
        return {
            itemId: item.id!,
            cadence: item.cadence as 'daily' | 'weekly',
            kept: keptCount(history, item.cadence as 'daily' | 'weekly', first),
            action: item.action,
        };
    }));
}

let milestoneChain: Promise<unknown> = Promise.resolve();

/**
 * Post milestones earned since this phone first ran this for the account.
 * See design/GROUPS.md#posting-milestones for the first-run rule.
 */
export function emitMilestones(): Promise<EarnedMilestone[]> {
    const run = milestoneChain.then(emitNow, emitNow);
    milestoneChain = run.catch(() => undefined);
    return run.catch(error => {
        console.error('[groups] emitMilestones failed:', error);
        return [];
    });
}

async function emitNow(): Promise<EarnedMilestone[]> {
    const s = await session();
    if (!s) return [];
    const { me, gids } = s;
    const now = new Date();
    const [books, planDone, firstEntry, practices, before] = await Promise.all([
        loadBookTallies(now.getTime()), getReadingProgress(), getFirstEntryDate(), localPractices(), loadPosted(me.uid),
    ]);
    const input = { books, plan: READING_PLAN_DATA, planDone, firstEntry, practices, now };

    let earned = earnedMilestones(input);
    if (before && earned.some(m => m.kind === 'fruit' && !(m.key in before))) {
        earned = earnedMilestones({ ...input, sharedItemIds: await sharedPracticeIds(me.uid, gids) });
    }
    const { posted, post } = nextMilestones(before, earned, now);
    await savePosted(me.uid, posted);

    fanOut(me.uid, post.length ? gids : [], (batch, gid) => {
        for (const m of post) {
            batch.set(groupDocRef(gid, 'milestones', milestoneId(me.uid, m.key)), milestoneDoc(me.uid, m, serverTimestamp(), now));
        }
    });
    return post;
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

/** Delete the reader's own readings, shares and practices older than KEEP_WEEKS, and old nudges. */
export async function pruneOld(): Promise<void> {
    const s = await session();
    if (!s) return;
    const { me, gids } = s;
    const cutoff = pruneBefore(new Date());
    await Promise.all(gids.map(async gid => {
        const old = await Promise.all(PRUNED_COLLECTIONS.map(name => readQuery(select(
            groupCollection(gid, name), where('userId', '==', me.uid), where('weekKey', '<', cutoff),
        )).then(snap => snap.docs).catch(() => [])));
        const docs = old.flat();
        if (docs.length) await commitInBatches(docs.map(d => (batch: Batch) => batch.delete(d.ref)), () => { });
    }));
    try {
        const nudges = await readQuery(select(nudgesRef(me.uid), where('createdAt', '<', Timestamp.fromDate(weekStartOf(cutoff)))));
        if (nudges.docs.length) await commitInBatches(nudges.docs.map(d => (batch: Batch) => batch.delete(d.ref)), () => { });
    } catch {
        // Nudges wait for the next pass.
    }
}

/**
 * Whether the reader is still in `gid`. Only when the server has the group in
 * `groupIds` but no member doc were they removed (a join in flight has neither):
 * then their own docs there are deleted by id and the group leaves `groupIds`.
 */
export async function checkMembership(gid: string, uid?: string): Promise<boolean> {
    const me = await currentMe();
    if (!me || (uid && uid !== me.uid)) return true;
    try {
        const [user, mine] = await Promise.all([getDocFromServer(userRef(me.uid)), getDocFromServer(memberRef(gid, me.uid))]);
        const ids = user.data()?.groupIds;
        if (mine.exists() || !Array.isArray(ids) || !ids.includes(gid)) return true;
    } catch {
        return true;
    }
    await forgetGroup(me, gid);
    return false;
}

/** Delete everything the reader could have written in a group they can no longer read. */
async function forgetGroup(me: Me, gid: string): Promise<void> {
    const now = new Date();
    const cutoff = pruneBefore(now);
    const [rows, items, posted] = await Promise.all([
        entriesFrom(cutoff), getAllActionItems(1000), loadPosted(me.uid),
    ]);
    const refs = [
        ...rows.map(r => groupDocRef(gid, 'readings', readingId(me.uid, r.id))),
        ...items.filter(i => i.id !== undefined && isCadence(i.cadence))
            .map(i => groupDocRef(gid, 'practices', practiceId(me.uid, i.id!))),
        ...Object.keys(posted ?? {}).map(key => groupDocRef(gid, 'milestones', milestoneId(me.uid, key))),
    ];
    for (let key = cutoff; key <= weekKey(now); key = shiftWeek(key, 1)) {
        refs.push(groupDocRef(gid, 'shares', shareId(me.uid, key)), groupDocRef(gid, 'weeks', weekDocId(me.uid, key)));
    }
    // The counter can no longer be written, so its record just goes.
    await withCounted(me.uid, async ({ [gid]: _dropped, ...rest }) => ({ counted: rest, result: undefined }));
    try {
        await commitInBatches(
            refs.map(ref => (batch: Batch) => batch.delete(ref)),
            batch => batch.set(userRef(me.uid), { groupIds: arrayRemove(gid) }, { merge: true }),
        );
    } catch (error) {
        console.error(`[groups] could not forget ${gid}:`, error);
        await setDoc(userRef(me.uid), { groupIds: arrayRemove(gid) }, { merge: true }).catch(() => { });
    }
}

// ─── Upkeep ───────────────────────────────────────────────────────────────────

let upkeeping: Promise<void> | null = null;

/** Once per account per day: republish the week, refresh practices, post milestones, prune. */
function upkeep(): Promise<void> {
    upkeeping ??= upkeepNow().finally(() => { upkeeping = null; });
    return upkeeping;
}

async function upkeepNow(): Promise<void> {
    const me = await currentMe();
    if (!me) return;
    const stamp = `${me.uid}:${dayKey(new Date())}`;
    try {
        if ((await AsyncStorage.getItem(STORAGE_KEYS.GROUP_UPKEEP)) === stamp) return;
        await AsyncStorage.setItem(STORAGE_KEYS.GROUP_UPKEEP, stamp);
        await publishWeek();
        await refreshSharedPractices();
        await emitMilestones();
        await pruneOld();
    } catch (error) {
        console.error('[groups] upkeep failed:', error);
    }
}

let started = false;

/** Call once the database is ready. Drops the old activity queue and runs upkeep on sign-in and on foreground. */
export function startGroups(): void {
    if (started) return;
    started = true;
    AsyncStorage.removeItem(STORAGE_KEYS.PENDING_ACTIVITIES).catch(() => { });
    onAuthStateChanged(getAuth(), user => {
        if (user) void upkeep();
    });
    AppState.addEventListener('change', state => {
        if (state === 'active') void upkeep();
    });
}
