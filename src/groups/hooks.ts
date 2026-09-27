/** Live reads for the groups screens. Week data is asked for only while the group is open. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { FirebaseFirestoreTypes, onSnapshot, where } from '@react-native-firebase/firestore';

import { useAuth } from '../context/AuthContext';
import { useLocalDay } from '../hooks/useLocalDay';
import {
    byName, groupFrom, hubLine, memberFrom, milestoneFrom, nudgeFrom, parseLocalDateTime, practiceFrom, readingFrom,
    shareFrom, weekFrom,
} from './derive';
import { weekDocId } from './ids';
import { Group, GroupWeek, Member, Nudge, Role } from './model';
import { GroupCollection, groupCollection, groupDocRef, groupRef, membersRef, nudgesRef, select, userRef, weekCountRef } from './paths';
import { checkMembership } from './publish';
import { clearNudges } from './repository';
import { errorCode } from './session';
import { weekKey } from './week';
import { GroupWindow, groupWindow, nextWindowChange } from './window';

type Data = Record<string, any>;
type Docs = { id: string; data: Data }[];

const docsOf = (snap: FirebaseFirestoreTypes.QuerySnapshot) => snap.docs.map(d => ({ id: d.id, data: d.data() ?? {} }));

/** The reader's own week key, turning over at local midnight on Monday. */
export function useWeekKey(): string {
    const day = useLocalDay();
    return useMemo(() => weekKey(parseLocalDateTime(day) ?? new Date()), [day]);
}

/** Now, refreshed at the next window change of any of these zones and when the app comes back. */
export function useWindowNow(offsets: number[]): number {
    const [now, setNow] = useState(Date.now);
    const key = offsets.join(',');

    useEffect(() => {
        const zones = key ? key.split(',').map(Number) : [];
        const next = zones.length ? Math.min(...zones.map(o => nextWindowChange(now, o))) : Number.POSITIVE_INFINITY;
        const timer = Number.isFinite(next) ? setTimeout(() => setNow(Date.now()), Math.max(0, next - Date.now()) + 1000) : undefined;
        const sub = AppState.addEventListener('change', state => {
            if (state === 'active') setNow(Date.now());
        });
        return () => {
            if (timer) clearTimeout(timer);
            sub.remove();
        };
    }, [key, now]);

    return now;
}

/** One group's window, live. Null until the group doc is known. */
export function useGroupWindow(group: Pick<Group, 'utcOffsetMinutes'> | null | undefined): GroupWindow | null {
    const offset = group?.utcOffsetMinutes;
    const now = useWindowNow(offset === undefined ? [] : [offset]);
    return useMemo(() => (offset === undefined ? null : groupWindow(now, offset)), [now, offset]);
}

type Stop = () => void;

/**
 * A listener that restarts after a refusal, since a group joined a moment ago
 * is refused until the join reaches the server. After the last try it gives up.
 */
function retrying(start: (fail: (error: unknown) => void) => Stop, onError: (error: unknown) => void): Stop {
    let stop: Stop = () => { };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    let closed = false;
    const run = () => {
        stop = start(error => {
            if (closed) return;
            if (errorCode(error) === 'permission-denied' && tries < 3) {
                tries += 1;
                timer = setTimeout(run, 2000 * tries);
            } else onError(error);
        });
    };
    run();
    return () => {
        closed = true;
        if (timer) clearTimeout(timer);
        stop();
    };
}

/** A group doc gone on the server, or still refused, may mean the reader was removed. */
function watchGroup(gid: string, onData: (data: Data | null) => void, onError: () => void): Stop {
    return retrying(
        fail => onSnapshot(
            groupRef(gid),
            snap => {
                if (snap.exists()) onData(snap.data() ?? {});
                else if (!snap.metadata.fromCache) {
                    onData(null);
                    void checkMembership(gid);
                }
            },
            fail,
        ),
        error => {
            if (errorCode(error) === 'permission-denied') void checkMembership(gid);
            onError();
        },
    );
}

const watchQuery = (q: FirebaseFirestoreTypes.Query, onData: (docs: Docs) => void, onError: () => void): Stop =>
    retrying(fail => onSnapshot(q, snap => onData(docsOf(snap)), fail), () => onError());

/** `users/{uid}.groupIds`, live. */
export function useMyGroupIds(): { ids: string[]; loading: boolean; error: boolean } {
    const uid = useAuth().user?.uid;
    const [state, setState] = useState<{ key: string; loading: boolean; error: boolean }>({ key: '', loading: true, error: false });

    useEffect(() => {
        if (!uid) {
            setState({ key: '', loading: false, error: false });
            return;
        }
        setState(s => ({ ...s, loading: true }));
        return onSnapshot(
            userRef(uid),
            snap => {
                const ids = snap.data()?.groupIds;
                const list = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
                setState({ key: list.join(','), loading: false, error: false });
            },
            () => setState(s => ({ ...s, loading: false, error: true })),
        );
    }, [uid]);

    const ids = useMemo(() => (state.key ? state.key.split(',') : []), [state.key]);
    return { ids, loading: state.loading, error: state.error };
}

// ─── The hub ──────────────────────────────────────────────────────────────────

export interface HubRow {
    group: Group;
    memberCount: number;
    /** From the group's counter for the week on show. */
    readsThisWeek: number;
    myRole: Role | null;
    window: GroupWindow;
    /** "8 members · 23 reads this week". */
    line: string;
}

interface HubData {
    group?: Data | null;
    members?: Docs;
}

/** One row per group the reader is in, in `groupIds` order. */
export function useMyGroups(): { rows: HubRow[]; loading: boolean; error: boolean } {
    const uid = useAuth().user?.uid;
    const { ids, loading: idsLoading, error: idsError } = useMyGroupIds();
    const [data, setData] = useState<Record<string, HubData>>({});
    const [counts, setCounts] = useState<Record<string, { key: string; reads: number }>>({});
    const [error, setError] = useState(false);

    useEffect(() => {
        setData({});
        setError(false);
        const put = (gid: string, part: HubData) => setData(prev => ({ ...prev, [gid]: { ...prev[gid], ...part } }));
        const fail = () => setError(true);
        const stops = ids.flatMap(gid => [
            watchGroup(gid, group => put(gid, { group }), fail),
            watchQuery(membersRef(gid), members => put(gid, { members }), fail),
        ]);
        return () => stops.forEach(stop => stop());
    }, [ids]);

    const groups = useMemo(
        () => ids.flatMap(gid => (data[gid]?.group ? [groupFrom(gid, data[gid].group!)] : [])),
        [ids, data],
    );
    const now = useWindowNow(groups.map(g => g.utcOffsetMinutes));
    // The week on show: the one the open window reviews, otherwise this one.
    const shownKey = (w: GroupWindow) => (w.open ? w.reviewKey : w.weekKey);
    const countKeys = groups.map(g => `${g.id}|${shownKey(groupWindow(now, g.utcOffsetMinutes))}`).join(',');

    useEffect(() => {
        const stops = (countKeys ? countKeys.split(',') : []).map(entry => {
            const [gid, key] = entry.split('|');
            return retrying(
                fail => onSnapshot(
                    weekCountRef(gid, key),
                    snap => setCounts(prev => ({ ...prev, [gid]: { key, reads: Math.max(0, Number(snap.data()?.reads) || 0) } })),
                    fail,
                ),
                () => setError(true),
            );
        });
        return () => stops.forEach(stop => stop());
    }, [countKeys]);

    const rows = useMemo(() => groups.map(group => {
        const d = data[group.id];
        const window = groupWindow(now, group.utcOffsetMinutes);
        const count = counts[group.id];
        const reads = count?.key === shownKey(window) ? count.reads : 0;
        const memberCount = d?.members?.length ?? 0;
        const mine = d?.members?.find(m => m.id === uid);
        return {
            group,
            memberCount,
            readsThisWeek: reads,
            myRole: mine ? memberFrom(mine.id, mine.data).role : null,
            window,
            line: hubLine(memberCount, reads),
        };
    }), [groups, data, counts, now, uid]);

    const loading = idsLoading || ids.some(gid => data[gid]?.group === undefined || data[gid]?.members === undefined);
    return { rows, loading: loading && !error, error: error || idsError };
}

// ─── One group ────────────────────────────────────────────────────────────────

export interface GroupState {
    group: Group | null;
    /** By name. */
    members: Member[];
    me: Member | null;
    myRole: Role | null;
    window: GroupWindow | null;
    /** From the group's counter for the week on show, for the whole-group line. */
    readsThisWeek: number;
    /** The reader's own days this week, Monday-first. */
    myDays: boolean[];
    loading: boolean;
    /** The group is gone or the reader is no longer in it. */
    missing: boolean;
    error: boolean;
}

const NO_DAYS = [false, false, false, false, false, false, false];

export function useGroup(gid: string | undefined): GroupState {
    const uid = useAuth().user?.uid;
    const myKey = useWeekKey();
    const [groupData, setGroupData] = useState<Data | null | undefined>(undefined);
    const [members, setMembers] = useState<Docs | undefined>(undefined);
    const [count, setCount] = useState<{ key: string; reads: number } | null>(null);
    const [myDays, setMyDays] = useState<boolean[]>(NO_DAYS);
    const [error, setError] = useState(false);

    useEffect(() => {
        setGroupData(undefined);
        setMembers(undefined);
        setError(false);
        if (!gid || !uid) return;
        const fail = () => setError(true);
        const stops = [watchGroup(gid, setGroupData, fail), watchQuery(membersRef(gid), setMembers, fail)];
        return () => stops.forEach(stop => stop());
    }, [gid, uid]);

    const group = useMemo(() => (gid && groupData ? groupFrom(gid, groupData) : null), [gid, groupData]);
    const window = useGroupWindow(group);
    // The week on show: the one the open window reviews, otherwise this one.
    const countKey = window ? (window.open ? window.reviewKey : window.weekKey) : undefined;

    useEffect(() => {
        setCount(null);
        if (!gid || !uid || !countKey) return;
        return retrying(
            fail => onSnapshot(
                weekCountRef(gid, countKey),
                snap => setCount({ key: countKey, reads: Math.max(0, Number(snap.data()?.reads) || 0) }),
                fail,
            ),
            () => setError(true),
        );
    }, [gid, uid, countKey]);

    useEffect(() => {
        setMyDays(NO_DAYS);
        if (!gid || !uid) return;
        // Your own week doc is readable any day.
        return retrying(
            fail => onSnapshot(
                groupDocRef(gid, 'weeks', weekDocId(uid, myKey)),
                snap => setMyDays(snap.exists() ? weekFrom(snap.id, snap.data() ?? {}).days : NO_DAYS),
                fail,
            ),
            () => { },
        );
    }, [gid, uid, myKey]);

    return useMemo(() => {
        const list = byName((members ?? []).map(m => memberFrom(m.id, m.data)));
        const me = list.find(m => m.uid === uid) ?? null;
        return {
            group,
            members: list,
            me,
            myRole: me?.role ?? null,
            window,
            readsThisWeek: count && count.key === countKey ? count.reads : 0,
            myDays,
            loading: !!gid && !!uid && !error && (groupData === undefined || members === undefined),
            missing: groupData === null,
            error,
        };
    }, [gid, uid, group, groupData, members, window, count, countKey, myDays, error]);
}

// ─── The open window ──────────────────────────────────────────────────────────

const EMPTY_WEEK: GroupWeek = { readings: [], shares: [], practices: [], milestones: [], weeks: [] };
const WEEK_COLLECTIONS: GroupCollection[] = ['readings', 'shares', 'practices', 'milestones', 'weeks'];

export interface GroupWeekState extends GroupWeek {
    /** Open by the phone's reckoning and not refused by the server. */
    open: boolean;
    /** "Open today", "Open until noon", "Opens tomorrow" or "Opens Sunday". */
    label: string;
    /** The week shown: on Monday morning, the week that just ended. */
    weekKey: string | null;
    loading: boolean;
    error: boolean;
}

/**
 * The week the open window shows. Nothing is asked for outside the window, a
 * refusal reads as "Opens Sunday", and cached data is never shown on its own:
 * only snapshots the server has confirmed.
 */
export function useGroupWeek(group: Group | null): GroupWeekState {
    const window = useGroupWindow(group);
    const gid = group?.id;
    const key = window?.open ? window.reviewKey : null;
    const [week, setWeek] = useState<Partial<GroupWeek>>({});
    const [denied, setDenied] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        setWeek({});
        setDenied(false);
        setError(false);
        if (!gid || !key) return;
        let stopped = false;
        const convert = {
            readings: readingFrom, shares: shareFrom, practices: practiceFrom, milestones: milestoneFrom, weeks: weekFrom,
        } as const;
        const stops = WEEK_COLLECTIONS.map(name => onSnapshot(
            select(groupCollection(gid, name), where('weekKey', '==', key)),
            { includeMetadataChanges: true },
            snap => {
                if (stopped || snap.metadata.fromCache) return;
                setWeek(w => ({ ...w, [name]: docsOf(snap).map(d => convert[name](d.id, d.data)) }));
            },
            err => {
                if (stopped) return;
                if (errorCode(err) === 'permission-denied') {
                    setDenied(true);
                    setWeek({});
                } else setError(true);
            },
        ));
        return () => {
            stopped = true;
            stops.forEach(stop => stop());
        };
    }, [gid, key]);

    const open = !!key && !denied;
    const loading = open && !error && WEEK_COLLECTIONS.some(name => !week[name]);
    return {
        ...EMPTY_WEEK,
        ...(open ? week : {}),
        open,
        label: denied ? 'Opens Sunday' : window?.label ?? '',
        weekKey: key,
        loading,
        error,
    };
}

// ─── Nudges ───────────────────────────────────────────────────────────────────

/** The reader's nudges, newest first, and a way to clear one or all. */
export function useMyNudges(): { nudges: Nudge[]; loading: boolean; clear: (id?: string) => Promise<void> } {
    const uid = useAuth().user?.uid;
    const [nudges, setNudges] = useState<Nudge[] | undefined>(undefined);

    useEffect(() => {
        setNudges(undefined);
        if (!uid) {
            setNudges([]);
            return;
        }
        return onSnapshot(
            nudgesRef(uid),
            snap => setNudges(docsOf(snap).map(d => nudgeFrom(d.id, d.data)).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))),
            () => setNudges([]),
        );
    }, [uid]);

    const clear = useCallback((id?: string) => clearNudges(id), []);
    return { nudges: nudges ?? [], loading: nudges === undefined, clear };
}
