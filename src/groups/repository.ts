/** Making, joining, leaving and running a group, and nudges (design/GROUPS.md#roles). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    arrayRemove, arrayUnion, deleteDoc, doc, getDoc, getDocFromServer, serverTimestamp, setDoc, updateDoc, where,
} from '@react-native-firebase/firestore';

import { STORAGE_KEYS } from '../storage/storageKeys';
import { generateCode, isCode, normaliseCode, nudgeId } from './ids';
import { Role, SCHEMA } from './model';
import {
    OWN_COLLECTIONS, codeRef, groupCollection, groupRef, groupsRef, memberRef, membersRef, nudgeRef, nudgesRef,
    readQuery, readQueryFromServer, select, userRef,
} from './paths';
import { publishToGroup, uncountGroup } from './publish';
import { Settled, commitInBatches, currentMe, errorCode, isOffline, myGroupIds, newBatch, settle } from './session';
import { weekKey } from './week';
import { deviceOffsetMinutes, isOffset } from './window';

export type SignedOut = { status: 'signed-out' };
export type Offline = { status: 'offline' };

/** A code no group holds yet, checked on the server. Throws when offline. */
async function freshCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
        const code = generateCode();
        if (!(await getDocFromServer(codeRef(code))).exists()) return code;
    }
    throw new Error('No free group code found');
}

// ─── Create and join ──────────────────────────────────────────────────────────

export type CreateResult = { status: 'created'; groupId: string; code: string } | { status: 'invalid' } | Offline | SignedOut;

/** Make a group with a new code, in the creator's time zone; the creator is its first member. Needs a connection. */
export async function createGroup(name: string, description: string = ''): Promise<CreateResult> {
    const me = await currentMe();
    if (!me) return { status: 'signed-out' };
    if (!name.trim()) return { status: 'invalid' };

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const code = await freshCode();
            const gid = doc(groupsRef()).id;
            const batch = newBatch();
            batch.set(codeRef(code), { groupId: gid });
            batch.set(groupRef(gid), {
                name: name.trim(),
                description: description.trim(),
                code,
                createdBy: me.uid,
                createdAt: serverTimestamp(),
                schema: SCHEMA,
                utcOffsetMinutes: deviceOffsetMinutes(),
            });
            batch.set(memberRef(gid, me.uid), {
                displayName: me.name,
                role: 'creator',
                joinedAt: serverTimestamp(),
                joinCode: code,
            });
            batch.set(userRef(me.uid), { groupIds: arrayUnion(gid) }, { merge: true });
            await settle(batch.commit());
            void publishToGroup(gid);
            return { status: 'created', groupId: gid, code };
        } catch (error) {
            if (isOffline(error)) return { status: 'offline' };
            // Someone took the code between the check and the write: try another.
            if (errorCode(error) !== 'permission-denied') throw error;
        }
    }
    throw new Error('Could not create the group');
}

export type JoinResult =
    | { status: 'joined' | 'already'; groupId: string; name: string }
    | { status: 'invalid' }
    | Offline
    | SignedOut;

const joining = new Map<string, Promise<JoinResult>>();

/**
 * Join by code, then publish this week's readings there. A second tap while one
 * is running gets the same result. Needs a connection: a cached answer is refused.
 */
export function joinGroup(input: string): Promise<JoinResult> {
    const code = normaliseCode(input);
    const running = joining.get(code);
    if (running) return running;
    const run = joinNow(code).finally(() => joining.delete(code));
    joining.set(code, run);
    return run;
}

async function joinNow(code: string): Promise<JoinResult> {
    const me = await currentMe();
    if (!me) return { status: 'signed-out' };
    if (!isCode(code)) return { status: 'invalid' };

    try {
        const codeSnap = await getDocFromServer(codeRef(code));
        const gid = codeSnap.data()?.groupId;
        if (!codeSnap.exists() || typeof gid !== 'string') return { status: 'invalid' };

        const [mine, groupIds] = await Promise.all([getDocFromServer(memberRef(gid, me.uid)), myGroupIds(me.uid)]);
        if (mine.exists()) {
            // A member doc without the group in groupIds: finish that join.
            if (!groupIds.includes(gid)) {
                await settle(setDoc(userRef(me.uid), { groupIds: arrayUnion(gid) }, { merge: true }));
                void publishToGroup(gid);
            }
            const name = (await getDoc(groupRef(gid))).data()?.name ?? '';
            return { status: groupIds.includes(gid) ? 'already' : 'joined', groupId: gid, name };
        }

        const batch = newBatch();
        batch.set(memberRef(gid, me.uid), {
            displayName: me.name,
            role: 'member',
            joinedAt: serverTimestamp(),
            joinCode: code,
        });
        batch.set(userRef(me.uid), { groupIds: arrayUnion(gid) }, { merge: true });
        await settle(batch.commit());

        const name = (await getDoc(groupRef(gid))).data()?.name ?? '';
        void publishToGroup(gid);
        return { status: 'joined', groupId: gid, name };
    } catch (error) {
        if (isOffline(error)) return { status: 'offline' };
        // The code was replaced between reading it and joining.
        if (errorCode(error) === 'permission-denied') return { status: 'invalid' };
        throw error;
    }
}

// ─── Leave ────────────────────────────────────────────────────────────────────

export type LeaveResult = { status: 'left' | 'deleted'; settled: Settled } | { status: 'hand-over' } | Offline | SignedOut;

/**
 * Leave, deleting the member doc and everything the reader wrote there. The
 * creator must hand over first, unless they are the last member: then the
 * group and its code go too.
 */
export async function leaveGroup(gid: string): Promise<LeaveResult> {
    const me = await currentMe();
    if (!me) return { status: 'signed-out' };

    const [mine, group] = await Promise.all([getDoc(memberRef(gid, me.uid)), getDoc(groupRef(gid))]);
    let last = false;
    if (mine.data()?.role === 'creator') {
        // From the server: a stale cache must never delete a group others are still in.
        const members = await readQueryFromServer(membersRef(gid)).catch(() => null);
        if (!members) return { status: 'offline' };
        if (members.docs.some(d => d.id !== me.uid)) return { status: 'hand-over' };
        last = true;
    }

    const own = await Promise.all([
        ...OWN_COLLECTIONS.map(name => readQuery(select(groupCollection(gid, name), where('userId', '==', me.uid)))),
        readQuery(select(nudgesRef(me.uid), where('groupId', '==', gid))),
    ]);
    const code = group.data()?.code;
    // Queued first, so the counter still takes them while the reader is a member.
    if (!last) await uncountGroup(gid);

    const settled = await commitInBatches(
        own.flatMap(snap => snap.docs).map(d => batch => batch.delete(d.ref)),
        batch => {
            if (last) {
                batch.delete(groupRef(gid));
                if (typeof code === 'string' && code) batch.delete(codeRef(code));
            }
            batch.delete(memberRef(gid, me.uid));
            batch.set(userRef(me.uid), { groupIds: arrayRemove(gid) }, { merge: true });
        },
    );
    return { status: last ? 'deleted' : 'left', settled };
}

// ─── Roles and running the group ──────────────────────────────────────────────

export type WriteResult = Settled | 'signed-out';

/**
 * Creator only. Making someone the creator hands the role over, and the
 * outgoing creator becomes an admin.
 */
export async function setRole(gid: string, uid: string, role: Role): Promise<WriteResult> {
    const me = await currentMe();
    if (!me) return 'signed-out';
    if (uid === me.uid) throw new Error('The creator hands the role over rather than changing their own');
    const batch = newBatch();
    batch.update(memberRef(gid, uid), { role });
    if (role === 'creator') batch.update(memberRef(gid, me.uid), { role: 'admin' });
    return settle(batch.commit());
}

/** Admins and the creator; the creator cannot be removed. */
export async function removeMember(gid: string, uid: string): Promise<WriteResult> {
    const me = await currentMe();
    if (!me) return 'signed-out';
    return settle(deleteDoc(memberRef(gid, uid)));
}

/** Admins and the creator. `utcOffsetMinutes` moves the group's open window to another time zone. */
export async function editGroup(
    gid: string,
    fields: { name?: string; description?: string; utcOffsetMinutes?: number },
): Promise<WriteResult> {
    const me = await currentMe();
    if (!me) return 'signed-out';
    const update: Record<string, string | number> = {};
    if (fields.name !== undefined && fields.name.trim()) update.name = fields.name.trim();
    if (fields.description !== undefined) update.description = fields.description.trim();
    if (isOffset(fields.utcOffsetMinutes)) update.utcOffsetMinutes = fields.utcOffsetMinutes;
    if (Object.keys(update).length === 0) return 'done';
    return settle(updateDoc(groupRef(gid), update));
}

export type CodeResult = { status: 'done'; code: string } | Offline | SignedOut;

/** Admins and the creator: a new code, and the old one stops working. Needs a connection. */
export async function regenerateCode(gid: string): Promise<CodeResult> {
    const me = await currentMe();
    if (!me) return { status: 'signed-out' };
    try {
        const old = (await getDocFromServer(groupRef(gid))).data()?.code;
        const code = await freshCode();
        const batch = newBatch();
        batch.set(codeRef(code), { groupId: gid });
        batch.update(groupRef(gid), { code });
        if (typeof old === 'string' && old) batch.delete(codeRef(old));
        await settle(batch.commit());
        return { status: 'done', code };
    } catch (error) {
        if (isOffline(error)) return { status: 'offline' };
        throw error;
    }
}

// ─── Nudges ───────────────────────────────────────────────────────────────────

async function sentNudges(uid: string): Promise<string[]> {
    try {
        const all = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.GROUP_NUDGES_SENT)) ?? '{}');
        return Array.isArray(all?.[uid]) ? all[uid] : [];
    } catch {
        return [];
    }
}

async function recordNudge(uid: string, key: string) {
    let all: Record<string, string[]> = {};
    try {
        all = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.GROUP_NUDGES_SENT)) ?? '{}') ?? {};
    } catch {
        all = {};
    }
    const thisWeek = weekKey(new Date());
    // Only this week's are worth keeping: last week's never block a nudge.
    all[uid] = [...(all[uid] ?? []).filter(k => k.endsWith(`_${thisWeek}`)), key];
    await AsyncStorage.setItem(STORAGE_KEYS.GROUP_NUDGES_SENT, JSON.stringify(all)).catch(() => { });
}

/** Whether the reader already nudged `toUid` this week, from this phone. */
export async function hasNudged(toUid: string): Promise<boolean> {
    const me = await currentMe();
    if (!me) return false;
    return (await sentNudges(me.uid)).includes(`${toUid}_${weekKey(new Date())}`);
}

export type NudgeResult = Settled | 'already' | 'signed-out';

/** One nudge per sender per recipient per week; the fixed id makes a second one a refused overwrite. */
export async function sendNudge(gid: string, toUid: string): Promise<NudgeResult> {
    const me = await currentMe();
    if (!me) return 'signed-out';
    if (toUid === me.uid) return 'already';
    const key = `${toUid}_${weekKey(new Date())}`;
    if ((await sentNudges(me.uid)).includes(key)) return 'already';
    try {
        const groupName = await getDoc(groupRef(gid)).then(d => d.data()?.name ?? '').catch(() => '');
        const result = await settle(setDoc(nudgeRef(toUid, nudgeId(me.uid, weekKey(new Date()))), {
            fromUid: me.uid,
            fromName: me.name,
            groupId: gid,
            groupName: typeof groupName === 'string' ? groupName : '',
            createdAt: serverTimestamp(),
        }));
        await recordNudge(me.uid, key);
        return result;
    } catch (error) {
        if (errorCode(error) !== 'permission-denied') throw error;
        await recordNudge(me.uid, key);
        return 'already';
    }
}

/** Clear one of my nudges, or all of them. */
export async function clearNudges(id?: string): Promise<void> {
    const me = await currentMe();
    if (!me) return;
    if (id) {
        await settle(deleteDoc(nudgeRef(me.uid, id))).catch(() => { });
        return;
    }
    const all = await readQuery(nudgesRef(me.uid)).catch(() => null);
    if (all?.docs.length) await commitInBatches(all.docs.map(d => batch => batch.delete(d.ref)), () => { }).catch(() => { });
}
