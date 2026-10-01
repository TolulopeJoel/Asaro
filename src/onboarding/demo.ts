/**
 * The app walk's example content: what a reader's screens look like after a
 * few weeks, for someone who has written nothing yet. Built relative to today
 * so every date, week and calendar is current. Shown only while the walk runs,
 * and only by the screens — never written anywhere.
 */
import type { EnhancedActionItem, JournalEntry, StudyTopic } from '../data/database';
import type { PracticeProgress } from '../data/practiceRepository';
import { streakOf } from '../data/practiceStreak';
import { growthOf, rootedSeries } from '../grove/grove';
import type { GroveTree } from '../grove/loadGrove';
import type { TodayItem } from '../hooks/useToday';
import type { Group, GroupWeek, Member, WeekAnswer } from '../groups/model';
import { QUESTION_LABELS } from '../data/questions';
import type { GroupWindow } from '../groups/window';
import type { CoverageRow } from '../land/cloth';
import type { RenderedObservation } from '../insight/render';
import { PRACTICE_ANSWERS } from './practiceEntry';

export const DEMO_GROUP_ID = 'tour-demo-group';
/** The reader, inside the example group. */
export const DEMO_UID = 'tour-you';

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n: number, hour = 7) => {
    const d = new Date(Date.now() - n * DAY);
    d.setHours(hour, 12, 0, 0);
    return d;
};
const sqlLocal = (d: Date) => `${dayKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

/** Days back from today the example reader wrote, most recent first. A few gaps, as real weeks have. */
const WRITTEN = [0, 1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 15, 16, 18, 19, 20, 21, 23, 24];

// ─── Entries ─────────────────────────────────────────────────────────────────

const ENTRY_SPECS: { book: string; start: number; end?: number; ago: number; r1: string; r2: string; r4: string; study?: string }[] = [
    {
        book: 'Psalms', start: 23, ago: 0,
        r1: 'He leads, he restores, and he stays with me even in the dark valley, [[Psalms 23:4]].',
        r2: 'David had been a shepherd. He knew what Jehovah was doing for him.',
        r4: 'My friend who just lost her job. [[Psalms 23:1]] is for her.',
    },
    {
        book: 'Matthew', start: 6, ago: 2,
        r1: 'He sees what is done in secret, and that is enough for him, [[Matthew 6:6]].',
        r2: 'The model prayer puts his name and Kingdom first, before anything I need.',
        r4: 'My brother, who worries about money all the time. [[Matthew 6:33]].',
        study: 'What “daily bread” meant to the people listening, [[Matthew 6:11]]',
    },
    {
        book: 'Genesis', start: 1, end: 3, ago: 24,
        r1: PRACTICE_ANSWERS.reflection1,
        r2: PRACTICE_ANSWERS.reflection2,
        r4: PRACTICE_ANSWERS.reflection4,
        study: PRACTICE_ANSWERS.studyTopics[0].topic,
    },
];

export const DEMO_ENTRIES: JournalEntry[] = ENTRY_SPECS.map((e, i) => ({
    id: -(i + 1),
    book_name: e.book,
    chapter_start: e.start,
    chapter_end: e.end,
    reflection_1: e.r1,
    reflection_2: e.r2,
    reflection_3: '',
    reflection_4: e.r4,
    study_items: e.study
        ? [{ id: -(i + 1), entry_id: -(i + 1), topic: e.study, reminder: null, completed: false, sort_order: 0 }]
        : [],
    created_at: sqlLocal(daysAgo(e.ago)),
}));

export const DEMO_BOOK_COUNTS = DEMO_ENTRIES.reduce<Record<string, number>>((counts, e) => {
    counts[e.book_name] = (counts[e.book_name] ?? 0) + 1;
    return counts;
}, {});

export const DEMO_TOPICS: StudyTopic[] = DEMO_ENTRIES.flatMap(entry => (entry.study_items ?? []).map(item => ({ ...item, entry })));

// ─── Practices ───────────────────────────────────────────────────────────────

const GENESIS = DEMO_ENTRIES[2];
const MATTHEW = DEMO_ENTRIES[1];

export const DEMO_ACTIONS: EnhancedActionItem[] = [
    {
        id: -101,
        entry_id: GENESIS.id,
        action: PRACTICE_ANSWERS.actionItems[0].action,
        motivation: PRACTICE_ANSWERS.actionItems[0].motivation,
        sort_order: 0,
        cadence: 'daily',
        book_name: GENESIS.book_name,
        chapter_start: GENESIS.chapter_start,
        chapter_end: GENESIS.chapter_end,
        created_at: GENESIS.created_at,
        is_completed: false,
    },
    {
        id: -102,
        entry_id: MATTHEW.id,
        action: 'Pray about tomorrow before I sleep, not about everything at once',
        motivation: 'Matthew 6:34. Each day has enough of its own',
        sort_order: 0,
        cadence: 'daily',
        book_name: MATTHEW.book_name,
        chapter_start: MATTHEW.chapter_start,
        created_at: MATTHEW.created_at,
        is_completed: false,
    },
];

/** Kept every written day for the first, most days since it began for the second. */
const KEPT: Record<number, number[]> = {
    [-101]: WRITTEN,
    [-102]: [0, 1, 2],
};

const completionsOf = (id: number) => KEPT[id].map(n => dayKey(daysAgo(n)));

export const DEMO_PROGRESS = new Map<number, PracticeProgress>(DEMO_ACTIONS.map(a => {
    const done = completionsOf(a.id!);
    return [a.id!, { streak: streakOf(done, 'daily', dayKey(new Date())), doneNow: true, completions: done }];
}));

/** The garden as the Stats page and the land read it. */
export function demoGrove(): GroveTree[] {
    return DEMO_ACTIONS.map((item, i) => {
        const kept = KEPT[item.id!].length;
        const since = Math.round((Date.now() - new Date(item.created_at.replace(' ', 'T')).getTime()) / DAY);
        const keptSet = new Set(KEPT[item.id!]);
        const periods = Array.from({ length: since + 1 }, (_, k) => keptSet.has(since - k));
        return {
            item,
            cadence: 'daily',
            kept,
            growth: growthOf('daily', kept),
            rooted: rootedSeries(periods, 'daily'),
            thirsty: false,
            resting: false,
            species: i === 0 ? 0 : 3,
            startedOn: item.created_at.slice(0, 10),
        };
    });
}

// ─── Stats and the land ──────────────────────────────────────────────────────

export function demoDailyCounts(): Record<string, number> {
    return Object.fromEntries(WRITTEN.map(n => [dayKey(daysAgo(n)), 1]));
}

export const demoFirstEntry = () => daysAgo(WRITTEN[WRITTEN.length - 1]);

/** Chapters written about: Genesis 1–11 in plan order, then two off-plan. */
export function demoCoverage(): CoverageRow[] {
    return [
        { bookName: 'Genesis', chapterStart: 1, chapterEnd: 11, lastRead: daysAgo(10).toISOString() },
        { bookName: 'Psalms', chapterStart: 23, chapterEnd: 23, lastRead: daysAgo(0).toISOString() },
        { bookName: 'Matthew', chapterStart: 6, chapterEnd: 6, lastRead: daysAgo(2).toISOString() },
    ];
}

// ─── Home ────────────────────────────────────────────────────────────────────

/** Today's practices, not yet kept, each with the run it would extend. */
export function demoToday(): TodayItem[] {
    return DEMO_ACTIONS.map(item => ({
        item,
        kind: 'practice',
        streak: streakOf(completionsOf(item.id!).slice(1), 'daily', dayKey(new Date())),
        overdue: false,
        kept: false,
    }));
}

/** A noticing on Home, the kind that turns up after a few weeks of writing. */
export const DEMO_OBSERVATION: RenderedObservation = {
    kind: 'Where your entries point',
    evidence: ['Genesis 1', 'Psalms 23', 'Matthew 6'],
    claim: 'Three weeks apart, all three of these come back to the same thing: he looks after what he made.',
    subject: 'Matthew 6:26',
    openLabel: 'See why',
};

// ─── Groups ──────────────────────────────────────────────────────────────────

/** The group's own window, open, for the week in progress. */
export function demoWindow(): GroupWindow {
    const now = new Date();
    const monday = new Date(now.getTime() - ((now.getDay() + 6) % 7) * DAY);
    const key = dayKey(monday);
    return { open: true, weekKey: key, reviewKey: key, label: 'Open today' };
}

export function demoGroup(): Group {
    return {
        id: DEMO_GROUP_ID,
        name: 'Morning Readers',
        description: 'A chapter before breakfast.',
        code: 'READ24',
        createdBy: 'tour-fisayo',
        createdAt: daysAgo(60).getTime(),
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
    };
}

/** @param me the reader's own uid, so the page marks their row as theirs. */
export function demoMembers(me: string, myName: string): Member[] {
    return [
        { uid: me, displayName: myName || 'You', role: 'member', joinedAt: daysAgo(20).getTime(), photoAt: null },
        { uid: 'tour-tomi', displayName: 'Aunika Moyosore', role: 'admin', joinedAt: daysAgo(45).getTime(), photoAt: null },
        { uid: 'tour-fisayo', displayName: 'Fisayomi Jadesola', role: 'creator', joinedAt: daysAgo(60).getTime(), photoAt: null },
        { uid: 'tour-tunde', displayName: 'Tunde', role: 'member', joinedAt: daysAgo(30).getTime(), photoAt: null },
    ];
}

/** This week in the group: what each person read, one thing each brought, a practice shared. */
export function demoGroupWeek(me: string): GroupWeek {
    const week = demoWindow().weekKey;
    const days = (pattern: string) => [...pattern].map(c => c === 'x');
    return {
        weeks: [
            { id: `${me}_${week}`, userId: me, weekKey: week, days: days('xxx.xxx') },
            { id: `tour-fisayo_${week}`, userId: 'tour-fisayo', weekKey: week, days: days('xxxxxxx') },
            { id: `tour-tomi_${week}`, userId: 'tour-tomi', weekKey: week, days: days('xx.xx.x') },
            { id: `tour-tunde_${week}`, userId: 'tour-tunde', weekKey: week, days: days('.x..x..') },
        ],
        readings: [
            { id: 'tour-r1', userId: 'tour-fisayo', bookName: 'Genesis', chapters: '12–15', answered: 5, day: dayKey(daysAgo(1)), weekKey: week, createdAt: daysAgo(1).getTime() },
            { id: 'tour-r2', userId: 'tour-tomi', bookName: 'Psalms', chapters: '23', answered: 3, day: dayKey(daysAgo(2)), weekKey: week, createdAt: daysAgo(2).getTime() },
        ],
        shares: [
            {
                id: `tour-fisayo_${week}`, userId: 'tour-fisayo', entryId: -1, questionId: 'reflection1',
                question: 'What does this tell me about Jehovah?',
                text: 'He kept his promise to Abraham even when Abraham doubted. He’s patient with me too.',
                passage: 'Genesis 15', weekKey: week, createdAt: daysAgo(1).getTime(),
            },
        ],
        practices: [
            {
                id: 'tour-tomi_1', userId: 'tour-tomi', itemId: 1, entryId: 1,
                action: 'Read the day’s text before I pick up my phone', cadence: 'daily', weekKey: week,
                keptDays: days('xxxxx.x'),
            },
        ],
        milestones: [],
    };
}

/** What the bring sheet offers during the walk: answers from the example entries of this week. */
export function demoWeekAnswers(): WeekAnswer[] {
    return DEMO_ENTRIES.slice(0, 2).flatMap(entry => ([
        ['reflection1', entry.reflection_1],
        ['reflection4', entry.reflection_4],
    ] as const).flatMap(([questionId, text]) => text ? [{
        entryId: entry.id!,
        questionId,
        label: QUESTION_LABELS[questionId],
        text: text.trim(),
        passage: `${entry.book_name} ${entry.chapter_start}`,
    }] : []));
}
