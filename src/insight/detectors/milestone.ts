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

/**
 * Everything one save reached, as one card: the books it finished and at most
 * one plan mark. Saving an entry is one moment, and a second card would wait
 * for the next save and arrive stale. See design/DETECTORS.md#milestone.
 */
export interface MilestoneGroup {
    /** The group's own dedupe key: its parts, sorted and joined. */
    key: string;
    /** The individual keys it covers, so none is offered again in another group. */
    parts: string[];
    books: { book: string; chapters: number }[];
    mark?: number;
}

/** Group what was reached, less anything already offered. Null if nothing is new. */
export function groupMilestones(found: Milestone[], offered: ReadonlySet<string>): MilestoneGroup | null {
    const fresh = found.filter(m => !offered.has(m.key));
    if (fresh.length === 0) return null;
    const parts = fresh.map(m => m.key).sort();
    const plan = fresh.find(m => m.kind === 'plan');
    return {
        key: parts.join('+'),
        parts,
        books: fresh
            .filter(m => m.kind === 'book')
            .map(m => ({ book: m.book ?? '', chapters: m.chapters ?? 0 })),
        mark: plan?.mark,
    };
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
 * Every milestone key already offered. A grouped row lists its parts; a row
 * from before grouping is its own dedupe key.
 */
async function offeredKeys(): Promise<Set<string>> {
    const rows = await withDatabase(database => database.getAllAsync<{ dedupe_key: string; payload: string }>(
        `SELECT dedupe_key, payload FROM observations WHERE detector = 'milestone'`,
    ));
    const keys = new Set<string>();
    for (const row of rows) {
        let parts: unknown;
        try { parts = JSON.parse(row.payload)?.parts; } catch { parts = undefined; }
        if (Array.isArray(parts)) parts.forEach(part => keys.add(String(part)));
        else keys.add(row.dedupe_key);
    }
    return keys;
}

/**
 * Find what has just been reached, and record it as one card. No retraction,
 * unlike every other detector: Ruth does not become unfinished, so the parts
 * do the only work needed — each offered once, ever.
 */
export async function detectMilestones(
    planPercent: number,
    options: MilestoneOptions = {},
): Promise<number[]> {
    const books = await loadBookTallies();
    const found = findMilestones(books, planPercent, options);

    // A finished book with no entries behind it is a contradiction; recording
    // it would report a bug as an achievement.
    const evidence = new Set<number>();
    const standing: Milestone[] = [];
    for (const milestone of found) {
        const entries = await evidenceEntries(milestone.book);
        if (entries.length === 0) continue;
        standing.push(milestone);
        entries.forEach(id => evidence.add(id));
    }

    const group = groupMilestones(standing, await offeredKeys());
    if (!group) return [];

    return [
        await recordObservation({
            detector: 'milestone',
            dedupeKey: group.key,
            claim: { parts: group.parts, books: group.books, mark: group.mark },
            // Highest in the app: confidence orders the queue, and this is
            // the only detector that counts rather than infers.
            confidence: 0.95,
            evidence: [...evidence].map(entryId => ({ kind: 'entry' as const, entryId })),
        }),
    ];
}
