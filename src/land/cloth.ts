/**
 * The reader's Bible as cloth. One cell per chapter, 1,189 of them, grouped by
 * book: a cell is worked if the reader has ever written about that chapter, and
 * how recently decides how strongly it is dyed.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: nothing ever becomes unworked again. A
 * chapter read in March is still read in December, so the oldest tier fades but
 * is never empty — see `FADE_FLOOR` where it is drawn. Fading is a true
 * statement about time passing; erasure would be a false one about what they
 * did. It makes the pull a RESTORE, not a PREVENT, which is the only version
 * still bearable on the day somebody comes back after three months away.
 *
 * Pure, with `now` passed in like `practiceStreak.ts` — every boundary here is
 * a date boundary and none is testable otherwise.
 */

import { BibleBook } from '../data/bibleBooks';

/** One distinct chapter range that has been written about. */
export interface CoverageRow {
    bookName: string;
    chapterStart: number;
    chapterEnd: number | null;
    /** ISO timestamp of the most recent entry covering this range. */
    lastRead: string;
}

/**
 * How long ago a chapter was last worked. `0` is never; the rest run freshest
 * to faintest. Deliberately no tier past `5` — nine years ago and three years
 * ago are the same fact at this distance, and splitting further only pushes the
 * far end toward invisible.
 */
export type Tier = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Upper bound in days for each tier, freshest first — a month, a season, half a
 * year, a year. Chosen so anyone reading the plan at a sane pace keeps the
 * current book at tier 1 without effort: the ramp describes a life, it does not
 * police a schedule.
 */
const TIER_DAYS = [30, 90, 180, 365];

const DAY_MS = 86_400_000;

export interface BookCloth {
    name: string;
    abbrv: string;
    /** One entry per chapter, in order. Index 0 is chapter 1. */
    cells: Tier[];
    /** Chapters worked at least once. */
    worked: number;
    /** Chapters in the book. */
    total: number;
    /** Days since the most recent chapter here was worked. Null if never. */
    lastWorkedDays: number | null;
}

export interface Cloth {
    books: BookCloth[];
    worked: number;
    total: number;
}

function tierFor(days: number): Tier {
    for (let index = 0; index < TIER_DAYS.length; index++) {
        if (days <= TIER_DAYS[index]) return (index + 1) as Tier;
    }
    return 5;
}

/**
 * Whole days between an ISO timestamp and now, or null if unreadable. Clamped
 * at zero: a clock corrected backwards must not produce a negative age, which
 * would read as the freshest possible tier.
 */
function ageInDays(iso: string, now: number): number | null {
    const at = new Date(iso).getTime();
    if (!Number.isFinite(at)) return null;
    return Math.max(0, Math.floor((now - at) / DAY_MS));
}

export function weaveCloth(rows: CoverageRow[], books: BibleBook[], now: number): Cloth {
    // Freshest age per chapter, keyed by book. Built separately because
    // entries overlap constantly — the plan hands out ranges and the reader
    // writes about single chapters inside them later.
    const freshest = new Map<string, Map<number, number>>();

    for (const row of rows) {
        const days = ageInDays(row.lastRead, now);
        if (days === null) continue;

        const start = row.chapterStart;
        if (!Number.isInteger(start) || start < 1) continue;

        /*
         * A null end is a single chapter, not an open range. Treating it as
         * open would dye the rest of the book off one entry.
         */
        const end = Number.isInteger(row.chapterEnd) && (row.chapterEnd as number) >= start
            ? (row.chapterEnd as number)
            : start;

        let chapters = freshest.get(row.bookName);
        if (!chapters) {
            chapters = new Map<number, number>();
            freshest.set(row.bookName, chapters);
        }

        for (let chapter = start; chapter <= end; chapter++) {
            const existing = chapters.get(chapter);
            if (existing === undefined || days < existing) chapters.set(chapter, days);
        }
    }

    let worked = 0;
    let total = 0;

    const woven = books.map(book => {
        const chapters = freshest.get(book.name);
        const cells: Tier[] = [];
        let bookWorked = 0;
        let lastWorkedDays: number | null = null;

        for (let chapter = 1; chapter <= book.chapters; chapter++) {
            // Bounded by the book, not the data: a bad range must not add
            // cells, or the cloth takes the journal's shape instead of the
            // Bible's.
            const days = chapters?.get(chapter);
            if (days === undefined) {
                cells.push(0);
                continue;
            }
            cells.push(tierFor(days));
            bookWorked++;
            if (lastWorkedDays === null || days < lastWorkedDays) lastWorkedDays = days;
        }

        worked += bookWorked;
        total += book.chapters;

        return {
            name: book.name,
            abbrv: book.abbrv,
            cells,
            worked: bookWorked,
            total: book.chapters,
            lastWorkedDays,
        };
    });

    return { books: woven, worked, total };
}

/**
 * The books that have gone quiet — worked once, not for a long time. NEVER
 * names a book the reader has never opened: being pointed at sixty-six unread
 * books is an indictment, not a nudge. This only ever offers back land they
 * already cultivated.
 */
export function quietBooks(cloth: Cloth, sinceDays: number, limit: number): BookCloth[] {
    return cloth.books
        .filter(book => book.lastWorkedDays !== null && book.lastWorkedDays >= sinceDays)
        .sort((a, b) => {
            // Most worked first, then longest quiet. The book someone put the
            // most into is the one most worth going back to.
            if (b.worked !== a.worked) return b.worked - a.worked;
            return (b.lastWorkedDays ?? 0) - (a.lastWorkedDays ?? 0);
        })
        .slice(0, limit);
}
