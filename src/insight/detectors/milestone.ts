/**
 * The moments worth marking: a book finished, a quarter of the plan crossed.
 * The app's one DELIGHT register — see design/ASARO-CHARACTER.md §6.
 *
 * Both kinds guard against BACKFILL, the failure that would make this feel
 * fake: a reader already 60% through the plan must not be congratulated on
 * reaching a quarter, and somebody who finished Ruth last spring must not hear
 * about it now. So neither fires on a state, both fire on a state that has just
 * changed. See design/DETECTORS.md#milestone.
 */

import { getChapterCoverage } from '../../data/database';
import { withDatabase } from '../../data/db';
import { ALL_BIBLE_BOOKS } from '../../data/bibleBooks';
import { weaveCloth } from '../../land/cloth';
import { recordObservation } from '../observation';

/** The plan crossings worth a word. */
export const PLAN_MARKS = [25, 50, 75, 100];

export interface MilestoneOptions {
    /**
     * How recently a book's last chapter must have been worked — the whole
     * anti-backfill mechanism for books. Completion alone is permanent, so it
     * would announce every book ever finished on the first run.
     */
    freshDays?: number;
    /**
     * How far past a plan mark still counts as just having crossed it. One
     * reading is roughly a quarter point, so this is about eleven readings'
     * grace. Missing the window is the right failure: "Halfway!" at 58% is a
     * lie about when.
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

/** Which milestones have just been reached. Pure, so both guards can be
 * tested at their boundaries. */
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

    // The highest mark crossed, never a list: finishing the plan in one sitting
    // crosses all four, and four cards in a row is a parade, not a moment.
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
    // Reuses `weaveCloth` rather than reimplementing range expansion here: two
    // copies of that arithmetic means one of them is wrong.
    const cloth = weaveCloth(coverage, ALL_BIBLE_BOOKS, now);
    return cloth.books.map(book => ({
        name: book.name,
        worked: book.worked,
        total: book.total,
        lastWorkedDays: book.lastWorkedDays,
    }));
}

/**
 * The entries a milestone rests on. `recordObservation` refuses a finding with
 * no evidence.
 *
 * For a finished book that is the writing that finished it. For a plan
 * crossing it is the entry that crossed it — no single row "is" a percentage,
 * but saving that entry is the event being reported.
 */
async function evidenceEntries(book: string | undefined, limit = 6): Promise<number[]> {
    return withDatabase(async database => {
        const rows = book
            ? await database.getAllAsync<{ id: number }>(
                `SELECT id FROM journal_entries
                  WHERE book_name = ?
                  ORDER BY datetime(created_at) DESC
                  LIMIT ?`,
                [book, limit],
            )
            : await database.getAllAsync<{ id: number }>(
                `SELECT id FROM journal_entries ORDER BY datetime(created_at) DESC LIMIT 1`,
            );
        return rows.map(row => row.id);
    });
}

/**
 * Find what has just been reached, and record it. No retraction, unlike every
 * other detector: Ruth does not become unfinished, so the dedupe key does the
 * only work needed — offered once, ever.
 */
export async function detectMilestones(
    planPercent: number,
    options: MilestoneOptions = {},
): Promise<number[]> {
    const books = await loadBookTallies();
    const milestones = findMilestones(books, planPercent, options);

    const ids: number[] = [];
    for (const milestone of milestones) {
        const entries = await evidenceEntries(milestone.book);
        // A finished book with no entries behind it is a contradiction;
        // recording it would report a bug as an achievement.
        if (entries.length === 0) continue;

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
                // Highest in the app: confidence orders the queue, and this is
                // the only detector that counts rather than infers.
                confidence: 0.95,
                evidence: entries.map(entryId => ({ kind: 'entry' as const, entryId })),
            }),
        );
    }

    return ids;
}
