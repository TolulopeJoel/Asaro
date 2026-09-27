/** What the groups screens work out from members' documents. Pure; `now` is passed in. */

import { answeredCount } from '../data/questions';
import { weekKey, weekStart } from './week';
import { GroupWindow, isOffset } from './window';
import {
    Group, GroupMilestone, GroupWeek, KEEP_WEEKS, Member, MemberWeek, Nudge, Reading, Role, Share, SharedPractice,
} from './model';

const pad = (n: number) => String(n).padStart(2, '0');

/** A local date as `YYYY-MM-DD`. */
export const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** A local `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS` (SQLite's `'localtime'` output) as a Date. */
export function parseLocalDateTime(value: string | null | undefined): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value ?? '');
    if (!match) return null;
    const [, y, m, d, h = '0', mi = '0', s = '0'] = match;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(mi), Number(s));
}

/** The week key `weeks` weeks after `key` (negative for before). */
export function shiftWeek(key: string, weeks: number): string {
    const monday = parseLocalDateTime(key) ?? new Date();
    return weekKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weeks * 7));
}

/** Docs whose week key sorts before this are older than KEEP_WEEKS and get deleted. */
export const pruneBefore = (now: Date, weeks: number = KEEP_WEEKS) => shiftWeek(weekKey(now), -weeks);

/** Monday-first: which of the week `key`'s seven days appear in `days` (local `YYYY-MM-DD`). */
export function daysInWeek(days: Iterable<string>, key: string): boolean[] {
    const monday = parseLocalDateTime(key);
    const week = [false, false, false, false, false, false, false];
    if (!monday) return week;
    const dates = week.map((_, i) => dayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
    for (const day of days) {
        const at = dates.indexOf(day.slice(0, 10));
        if (at >= 0) week[at] = true;
    }
    return week;
}

// ─── Readings ─────────────────────────────────────────────────────────────────

/** An entry as the groups layer reads it from SQLite. */
export interface EntryRow {
    id: number;
    book_name: string;
    chapter_start: number | null;
    chapter_end: number | null;
    /** `datetime(created_at, 'localtime')`. */
    created_local: string;
    reflection_1: string | null;
    reflection_2: string | null;
    reflection_4: string | null;
    study_further: string | null;
    /** 1 when the entry has an action item with an action written. */
    has_action: number | boolean | null;
}

export const chaptersOf = (start: number | null, end: number | null) =>
    !start ? '' : end && end !== start ? `${start}-${end}` : `${start}`;

/** A reading's fields, less `createdAt`, which the writer stamps from `readAt`. */
export function readingOf(row: EntryRow, uid: string) {
    const readAt = parseLocalDateTime(row.created_local) ?? new Date();
    return {
        readAt,
        data: {
            userId: uid,
            bookName: row.book_name,
            chapters: chaptersOf(row.chapter_start, row.chapter_end),
            answered: answeredCount({
                reflection1: row.reflection_1,
                reflection2: row.reflection_2,
                reflection4: row.reflection_4,
                studyFurther: row.study_further,
                actionItems: row.has_action ? [{ action: 'x' }] : [],
            }),
            day: dayKey(readAt),
            weekKey: weekKey(readAt),
        },
    };
}

/** Members with no day read in the week `key`, for Sunday's "didn't read this week". */
export function didNotRead<M extends Pick<Member, 'uid'>>(members: M[], weeks: Pick<MemberWeek, 'userId' | 'weekKey' | 'days'>[], key: string): M[] {
    const readers = new Set(weeks.filter(w => w.weekKey === key && w.days.some(Boolean)).map(w => w.userId));
    return members.filter(m => !readers.has(m.uid));
}

/** "Read N days" on Sunday's member list. */
export const daysRead = (week: Pick<MemberWeek, 'days'> | null | undefined) => week?.days.filter(Boolean).length ?? 0;

// ─── Counting ─────────────────────────────────────────────────────────────────

/** Entry ids already added to each group's weekly counter: gid → weekKey → ids. */
export type Counted = Record<string, Record<string, number[]>>;

/** The week an entry was counted under in `gid`, or null if it was not. */
export function countedWeek(counted: Counted, gid: string, entryId: number): string | null {
    const weeks = counted[gid] ?? {};
    return Object.keys(weeks).find(key => weeks[key].includes(entryId)) ?? null;
}

export function markCounted(counted: Counted, gid: string, key: string, entryId: number): Counted {
    const weeks = counted[gid] ?? {};
    const ids = weeks[key] ?? [];
    return ids.includes(entryId) ? counted : { ...counted, [gid]: { ...weeks, [key]: [...ids, entryId] } };
}

export function unmarkCounted(counted: Counted, gid: string, entryId: number): Counted {
    const weeks: Record<string, number[]> = {};
    for (const [key, ids] of Object.entries(counted[gid] ?? {})) {
        const kept = ids.filter(id => id !== entryId);
        if (kept.length) weeks[key] = kept;
    }
    return { ...counted, [gid]: weeks };
}

/** Weeks before `cutoff` are pruned from the server too, so their record goes. */
export function pruneCounted(counted: Counted, cutoff: string): Counted {
    const next: Counted = {};
    for (const [gid, weeks] of Object.entries(counted)) {
        const kept = Object.fromEntries(Object.entries(weeks).filter(([key, ids]) => key >= cutoff && ids.length));
        if (Object.keys(kept).length) next[gid] = kept;
    }
    return next;
}

// ─── Lines ────────────────────────────────────────────────────────────────────

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The hub row: "8 members · 23 reads this week", or the window's label while it is open. */
export function hubLine(memberCount: number, reads: number, window: Pick<GroupWindow, 'open' | 'label'>): string {
    if (window.open) return window.label;
    return `${plural(memberCount, 'member', 'members')} · ${plural(reads, 'read', 'reads')} this week`;
}

/** The whole-group line on the group screen. No names. */
export function wholeGroupLine(reads: number): string {
    if (reads === 0) return 'The group hasn’t read yet this week';
    if (reads === 1) return 'The group read once this week';
    return `The group read ${reads} times this week`;
}

// ─── Sunday ───────────────────────────────────────────────────────────────────

export interface FeedPerson<M extends Member = Member> {
    member: M;
    readings: Reading[];
    share: Share | null;
    practices: SharedPractice[];
    milestones: GroupMilestone[];
    /** Monday-first days read. */
    days: boolean[];
    read: boolean;
}

/** Each member's week, in member order; nobody is ranked. */
export function feedByMember<M extends Member>(members: M[], week: GroupWeek, key: string): FeedPerson<M>[] {
    const mine = <T extends { userId: string; weekKey: string }>(list: T[], uid: string) =>
        list.filter(item => item.userId === uid && item.weekKey === key);
    return members.map(member => {
        const readings = mine(week.readings, member.uid)
            .sort((a, b) => a.day.localeCompare(b.day) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
        const dots = mine(week.weeks, member.uid)[0]?.days ?? [false, false, false, false, false, false, false];
        return {
            member,
            readings,
            share: mine(week.shares, member.uid)[0] ?? null,
            practices: mine(week.practices, member.uid),
            milestones: mine(week.milestones, member.uid).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
            days: dots,
            read: readings.length > 0 || dots.some(Boolean),
        };
    });
}

/** By name, so the list never orders people by how much they did. */
export const byName = <M extends Pick<Member, 'displayName'>>(members: M[]) =>
    [...members].sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));

// ─── Documents in ─────────────────────────────────────────────────────────────

type Data = Record<string, any>;

const millis = (value: any): number | null =>
    typeof value?.toMillis === 'function' ? value.toMillis() : typeof value === 'number' ? value : null;
const str = (value: any) => (typeof value === 'string' ? value : '');
const num = (value: any) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const days = (value: any) =>
    Array.isArray(value) && value.length === 7 ? value.map(Boolean) : [false, false, false, false, false, false, false];
const ROLES: Role[] = ['creator', 'admin', 'member'];

export const groupFrom = (id: string, d: Data): Group => ({
    id,
    name: str(d.name),
    description: str(d.description),
    code: str(d.code),
    createdBy: str(d.createdBy),
    createdAt: millis(d.createdAt),
    utcOffsetMinutes: isOffset(d.utcOffsetMinutes) ? d.utcOffsetMinutes : 0,
});

export const memberFrom = (uid: string, d: Data): Member => ({
    uid,
    displayName: str(d.displayName) || 'Reader',
    role: ROLES.includes(d.role) ? d.role : 'member',
    joinedAt: millis(d.joinedAt),
});

export const weekFrom = (id: string, d: Data): MemberWeek => ({
    id,
    userId: str(d.userId),
    weekKey: str(d.weekKey),
    days: days(d.days),
});

export const readingFrom = (id: string, d: Data): Reading => ({
    id,
    userId: str(d.userId),
    bookName: str(d.bookName),
    chapters: str(d.chapters),
    answered: Math.max(0, Math.min(5, num(d.answered))),
    day: str(d.day),
    weekKey: str(d.weekKey),
    createdAt: millis(d.createdAt),
});

export const shareFrom = (id: string, d: Data): Share => ({
    id,
    userId: str(d.userId),
    entryId: num(d.entryId),
    questionId: str(d.questionId),
    question: str(d.question),
    text: str(d.text),
    passage: str(d.passage),
    weekKey: str(d.weekKey),
    createdAt: millis(d.createdAt),
});

export const practiceFrom = (id: string, d: Data): SharedPractice => ({
    id,
    userId: str(d.userId),
    itemId: num(d.itemId),
    entryId: num(d.entryId),
    action: str(d.action),
    cadence: str(d.cadence),
    weekKey: str(d.weekKey),
    keptDays: days(d.keptDays),
});

export const milestoneFrom = (id: string, d: Data): GroupMilestone => ({
    id,
    userId: str(d.userId),
    kind: d.kind,
    label: str(d.label),
    weekKey: str(d.weekKey),
    createdAt: millis(d.createdAt),
});

export const nudgeFrom = (id: string, d: Data): Nudge => ({
    id,
    fromUid: str(d.fromUid),
    fromName: str(d.fromName) || 'Someone',
    groupId: str(d.groupId),
    createdAt: millis(d.createdAt),
});

/** The Monday a week key names, for range queries on timestamps. */
export const weekStartOf = (key: string) => weekStart(parseLocalDateTime(key) ?? new Date());
