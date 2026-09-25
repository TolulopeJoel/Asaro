/**
 * The moments worth marking: a book finished, a quarter of the plan crossed.
 *
 * The app had no surface for these at all. Somebody could write about the last
 * chapter of Ruth — completing a book of the Bible — and the app's entire
 * response was to save the row. Everything built before this either asks the
 * reader for something (notifications, the plan, Today) or hands back
 * something they already wrote (commitment, study). Nothing ever simply told
 * them they had done a thing.
 *
 * `design/ASARO-CHARACTER.md` §6 makes this the clearest case in the app for
 * the DELIGHT register. His defining trait — "I'm keeping absolute record",
 * "I noticed, I always notice" — has only ever been pointed at compliance. A
 * completed book is the same man with the same receipts, pleased instead of
 * disappointed, and it is the one place he is allowed to take some credit for
 * having been there.
 *
 * Both kinds are guarded against BACKFILL, which is the failure that would
 * have made this feel fake. A reader who is already sixty per cent through the
 * plan must not be congratulated on reaching a quarter, and somebody who
 * finished Ruth last spring must not be told about it now because the
 * detector has only just been written. So neither fires on a state; both fire
 * on a state that has just changed.
 */

import { getChapterCoverage } from '../../data/database';
import { ALL_BIBLE_BOOKS } from '../../data/bibleBooks';
import { weaveCloth } from '../../land/cloth';
import { recordObservation } from '../observation';

/** The plan crossings worth a word. */
export const PLAN_MARKS = [25, 50, 75, 100];

export interface MilestoneOptions {
    /**
     * How recently a book's last chapter must have been worked.
     *
     * Two days, and this is the whole anti-backfill mechanism for books. A
     * completed book is a permanent fact — it stays completed for ever — so a
     * detector keyed on completion alone would announce every book the reader
     * has ever finished the first time it ran. Keyed on "completed, and you
     * were in it this week", it can only ever fire for one they just closed.
     */
    freshDays?: number;
    /**
     * How far past a plan mark still counts as having just crossed it.
     *
     * One reading is roughly a quarter of a percent, so three points is about
     * eleven readings' grace. Someone who crosses halfway and does not open
     * the app for a fortnight misses the card — which is the right failure:
     * a "Halfway!" shown at fifty-eight per cent is a lie about when, and
     * this app does not lie about when.
     */
    markWindow?: number;
}

const DEFAULTS: Required<MilestoneOptions> = {
    freshDays: 2,
    markWindow: 3,
};

export interface Milestone {
    kind: 'book' | 'plan';
    /** Stable identity, so each is offered exactly once, ever. */
    key: string;
    /** Books only. */
    book?: string;
    chapters?: number;
    /** Plan only. */
    mark?: number;
}

export interface BookTally {
    name: string;
    worked: number;
    total: number;
    /** Days since its most recently worked chapter. Null if never worked. */
    lastWorkedDays: number | null;
}

/**
 * Which milestones have just been reached.
 *
 * Pure, so both guards can be tested at their boundaries — and they are the
 * only interesting thing in this file.
 */
export function findMilestones(
    books: BookTally[],
    planPercent: number,
    options: MilestoneOptions = {},
): Milestone[] {
    const config = { ...DEFAULTS, ...options };
    const found: Milestone[] = [];

    for (const book of books) {
        if (book.total <= 0 || book.worked < book.total) continue;
        if (book.lastWorkedDays === null || book.lastWorkedDays > config.freshDays) continue;
        found.push({
            kind: 'book',
            key: `book:${book.name}`,
            book: book.name,
            chapters: book.total,
        });
    }

    /*
     * The highest mark just crossed, never a list. Someone who finishes the
     * plan in one sitting has crossed all four, and four cards in a row is a
     * parade rather than a moment.
     */
    const crossed = PLAN_MARKS.filter(
        mark => planPercent >= mark && planPercent < mark + config.markWindow,
    );
    if (crossed.length > 0) {
        const mark = Math.max(...crossed);
        found.push({ kind: 'plan', key: `plan:${mark}`, mark });
    }

    return found;
}

/** Every book, with how much of it has been written about and how recently. */
export async function loadBookTallies(now: number = Date.now()): Promise<BookTally[]> {
    const coverage = await getChapterCoverage();
    /*
     * `weaveCloth` already expands ranges, keeps the freshest reading per
     * chapter and bounds everything by the real length of each book. Writing
     * that again here to keep `insight` from importing `land` would mean two
     * copies of range arithmetic, and the second copy is always the one that
     * is wrong.
     */
    const cloth = weaveCloth(coverage, ALL_BIBLE_BOOKS, now);
    return cloth.books.map(book => ({
        name: book.name,
        worked: book.worked,
        total: book.total,
        lastWorkedDays: book.lastWorkedDays,
    }));
}

/**
 * Find what has just been reached, and record it.
 *
 * No retraction, unlike every other detector here. A milestone is not a claim
 * that can stop being true — Ruth does not become unfinished — so there is
 * nothing to withdraw. The dedupe key is doing the only work that matters:
 * offered once, ever.
 */
export async function detectMilestones(
    planPercent: number,
    options: MilestoneOptions = {},
): Promise<number[]> {
    const books = await loadBookTallies();
    const milestones = findMilestones(books, planPercent, options);

    const ids: number[] = [];
    for (const milestone of milestones) {
        ids.push(
            await recordObservation({
                detector: 'milestone',
                dedupeKey: milestone.key,
                claim: {
                    kind: milestone.kind,
                    book: milestone.book,
                    chapters: milestone.chapters,
                    mark: milestone.mark,
                },
                /*
                 * The highest in the app, and not because it is the most
                 * important. Confidence orders the queue, and this is the only
                 * detector that is not inferring anything — it is counting. On
                 * the day somebody finishes a book, that should outrank a
                 * commitment being handed back.
                 */
                confidence: 0.95,
                evidence: [],
            }),
        );
    }

    return ids;
}
