/**
 * Convergence: the passage your entries circle and you have never written about.
 *
 * This is the detector the whole feature was reorganised around, because it is
 * the only one whose evidence the reader could not have assembled themselves.
 * Everything else Àṣàrò notices, it learned from them — what they wrote, when,
 * about which chapter. This one joins that to 341,000 cross-references nobody
 * holds in their head, and the join is where "how did it know that" lives.
 *
 * The claim is narrow on purpose: *these passages you chose are connected to
 * each other, and here is the one at their centre that you have not read.* It
 * is checkable, it can be wrong, and it is falsifiable against public data —
 * which is what separates it from a horoscope that happens to be about you.
 *
 * Split in two deliberately. `findConvergence` is pure: entries and a graph in,
 * candidates out, no database, no clock. That is what
 * scripts/verify-convergence.mjs exercises against the real asset. The IO lives
 * in `detectConvergence` below it, where it cannot be tested and therefore
 * should not hold any of the reasoning.
 */

import { withDatabase } from '../../data/db';
import { BibleGraph, loadGraph } from '../../bible/graph';
import {
    CitedRange,
    VerseId,
    bookNumberFromName,
    bookNumberOf,
    citationsIn,
    verseOf,
} from '../../bible/ref';
import { recordObservation, retractObservations } from '../observation';

/** Reflection columns scanned for `[[...]]` citations. */
const CITATION_FIELDS = ['reflection_1', 'reflection_2', 'reflection_3', 'reflection_4', 'notes'];

const DAY_MS = 86_400_000;

export interface SeedEntry {
    entryId: number;
    bookName: string;
    chapterStart: number;
    chapterEnd?: number;
    createdAt: string;
    /** Passages the writer cited in their own words, via `[[...]]`. */
    citations: CitedRange[];
}

export interface ConvergenceOptions {
    /**
     * Distinct entries that must reach a passage before it is a convergence.
     *
     * The floor that makes the claim true rather than merely computable. Two
     * entries share a cross-reference constantly — the Bible is a dense graph
     * and almost any pair of passages is two hops apart. Four separate
     * occasions is the point where "you keep circling this" stops being a
     * description of scripture and starts being one of the reader.
     */
    minEntries?: number;
    /**
     * Distinct Bible books those entries must span.
     *
     * One book is the reading plan talking. Read Genesis 12-15 across four
     * sittings and of course they converge — they cross-reference each other
     * because they are one narrative. Requiring two books is what makes the
     * convergence the reader's rather than the text's.
     */
    minBooks?: number;
    /**
     * Days between the earliest and latest contributing entry.
     *
     * The same argument as `themeQuality.spanLabel` makes for themes: a
     * connection drawn across months is evidence the reader had forgotten the
     * first passage by the time they wrote the second, so the thread is theirs.
     * Inside a fortnight it is one study session.
     */
    minSpanDays?: number;
    /**
     * Total weight one entry contributes through the chapter it was assigned.
     *
     * A budget per entry, not per verse. Weighting each verse of a chapter
     * equally with each citation sounds like a 3:1 preference for citations
     * and is not one: a chapter puts twenty or thirty verses into the seed set
     * and an entry carries at most a couple of citations, so volume decides
     * the outcome and the intended preference never lands. Splitting a fixed
     * budget across whatever a channel produced makes the ratio mean what it
     * says — and incidentally stops long chapters counting for more than short
     * ones, which was never a fact about the reader either.
     */
    chapterBudget?: number;
    /** Total weight one entry contributes through verses its writer chose to cite. */
    citationBudget?: number;
    /**
     * Contributors that must reach the passage through a verse they CITED,
     * rather than through a chapter the plan assigned them.
     *
     * The gate that separates a convergence about the reader from one about
     * the text. A chapter enters the seed set whole, carrying every theme it
     * contains — so four entries on Genesis 8, Genesis 35 and Exodus 18 all
     * reach Isaac's altar at Genesis 26:25, because each of those chapters
     * happens to contain someone building an altar. The reader was writing
     * about compassion, false worship and humility. The link is real in the
     * Treasury and absent from the journal.
     *
     * A citation does not have that problem. It is the reader reaching into
     * a passage and pointing at one verse, so what it drags into the seed set
     * is what they meant. Requiring two of them is requiring that the thread
     * was drawn by the person, not inferred from their reading schedule.
     */
    minCitingEntries?: number;
    /**
     * How much a plan-shaped convergence is demoted, 0–1.
     *
     * Àṣàrò ships ONE reading plan — `READING_PLAN_DATA`, 364 readings, the
     * same order for everybody. So "the chapters I have read lately" is very
     * nearly the same sentence for every user on the same week of the plan,
     * and a detector that leans on chapters is at risk of handing two friends
     * in the same congregation the identical private discovery. That is the
     * Barnum failure wearing a citation: it feels personal, it is checkable,
     * and it is not about them.
     */
    planPenalty?: number;
    /** How many candidates to keep. The pacing layer decides what is shown. */
    maxCandidates?: number;
}

const DEFAULTS: Required<ConvergenceOptions> = {
    minEntries: 4,
    minBooks: 2,
    minSpanDays: 45,
    chapterBudget: 1,
    citationBudget: 3,
    minCitingEntries: 2,
    /*
     * Demoted, not dropped — the same call `themeQuality.ts` already made for
     * plan artifacts, and for the same reason. Someone reading Exodus and
     * Leviticus really is being pointed at Hebrews 9, and that is worth
     * knowing; it just is not a discovery about them, so it ranks below
     * anything that is.
     */
    planPenalty: 0.6,
    maxCandidates: 3,
};

/** "Genesis 12-15", as the journal recorded the reading. */
function passageLabel(entry: SeedEntry): string {
    const range =
        entry.chapterEnd && entry.chapterEnd !== entry.chapterStart
            ? `${entry.chapterStart}\u2013${entry.chapterEnd}`
            : `${entry.chapterStart}`;
    return `${entry.bookName} ${range}`;
}

export interface ConvergenceCandidate {
    hubVerseId: VerseId;
    /** How many references the hub has in total. High means famous, not personal. */
    hubDegree: number;
    /** Contributing entries, oldest first — the order the card reads them in. */
    entryIds: number[];
    bookNames: string[];
    /** The passages themselves, oldest first — what the card actually lists. */
    passages: string[];
    /** Of those entries, how many reached the hub through a verse they cited. */
    citingEntryCount: number;
    /**
     * The share of contributors that pointed rather than merely passed nearby.
     *
     * Two of four is a different claim from two of seven. Both have two people
     * pointing, but in the second case five arrived because the schedule sent
     * them, so most of the evidence is about the plan and the finding is
     * diluted. Count is how much evidence there is; this is how much of it the
     * reader chose.
     */
    citingFraction: number;
    spanDays: number;
    /**
     * How much the contributing entries look like someone reading straight
     * through, 0 to 1. See `sequentiality`.
     */
    planShape: number;
    score: number;
}

/**
 * How straight-through the contributing entries are, as rank correlation.
 *
 * Distinct books was the wrong test for "is this the reader or the plan", and
 * this journal is why: Genesis, Exodus and Leviticus clears a two-book gate
 * easily and is still just the plan, read in order, for thirteen months.
 * Contiguity is not the tell either — plenty of people legitimately read
 * Genesis then Exodus.
 *
 * The tell is ORDER. A reading plan marches forward: later entries sit later
 * in the canon, so date rank and canonical rank move together and the
 * correlation approaches 1. A thread the reader owns jumps around — Genesis in
 * October, Habakkuk in March, James in June — and the correlation collapses.
 * One number, no lists of books to maintain, and it says the thing the book
 * count was only gesturing at.
 *
 * Spearman's rho, floored at zero: reading the canon backwards is not evidence
 * of anything, so negative correlation is treated as simply not-sequential.
 *
 * Then scaled by how tightly the entries sit in the canon, because order alone
 * over four or five points says very little. A set running Genesis to Jeremiah
 * scored 0.80 on rho and was demoted as plan-shaped — but crossing twenty-one
 * books in the three days between two entries is the opposite of marching
 * through a schedule. Reading forward through a few books is a plan; arriving
 * at the far end of the canon is the reader going somewhere.
 */
function sequentiality(contributors: SeedEntry[]): number {
    const n = contributors.length;
    if (n < 3) return 0;

    const canonPosition = (entry: SeedEntry) =>
        bookNumberFromName(entry.bookName) * 1000 + entry.chapterStart;

    const dateRank = new Map<number, number>();
    [...contributors]
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        .forEach((entry, index) => dateRank.set(entry.entryId, index));

    const canonRank = new Map<number, number>();
    [...contributors]
        .sort((a, b) => canonPosition(a) - canonPosition(b))
        .forEach((entry, index) => canonRank.set(entry.entryId, index));

    // Pearson over ranks is Spearman. The mean rank is the same either way.
    const mean = (n - 1) / 2;
    let covariance = 0;
    let varianceX = 0;
    let varianceY = 0;

    for (const entry of contributors) {
        const x = dateRank.get(entry.entryId)! - mean;
        const y = canonRank.get(entry.entryId)! - mean;
        covariance += x * y;
        varianceX += x * x;
        varianceY += y * y;
    }

    if (varianceX === 0 || varianceY === 0) return 0;
    const rho = Math.max(0, covariance / Math.sqrt(varianceX * varianceY));

    /*
     * Half-weight at roughly ten books of spread, tailing off from there. The
     * scale is a judgement, not a derivation: it is set so a Genesis-to-
     * Leviticus march still reads as the schedule while a Genesis-to-Jeremiah
     * reach does not, which is the distinction real journals actually turn on.
     */
    const positions = contributors.map(canonPosition);
    const canonRange = Math.max(...positions) - Math.min(...positions);
    const density = 1 / (1 + canonRange / 10_000);

    return rho * density;
}

/**
 * Passages a reader's entries converge on, best first.
 *
 * Pure. No database, no clock, no side effects.
 */
export function findConvergence(
    entries: SeedEntry[],
    graph: BibleGraph,
    options: ConvergenceOptions = {},
): ConvergenceCandidate[] {
    const config = { ...DEFAULTS, ...options };
    if (entries.length === 0) return [];

    /*
     * Seeds are tracked by PROVENANCE, not just by weight.
     *
     * Which entries put a verse into the seed set matters less than how it got
     * there: through a chapter the schedule assigned, or through a verse the
     * writer reached for. Those two carry different evidence and the gates
     * below treat them differently, so they are kept apart from the start.
     */
    const seedWeight = new Map<number, number>();
    const seedFromChapter = new Map<number, Set<number>>();
    const seedFromCitation = new Map<number, Set<number>>();
    const entryById = new Map<number, SeedEntry>();

    const addSeed = (
        ordinal: number,
        weight: number,
        entryId: number,
        source: Map<number, Set<number>>,
    ) => {
        if (ordinal < 0) return;
        seedWeight.set(ordinal, (seedWeight.get(ordinal) ?? 0) + weight);
        let bucket = source.get(ordinal);
        if (!bucket) source.set(ordinal, (bucket = new Set()));
        bucket.add(entryId);
    };

    for (const entry of entries) {
        entryById.set(entry.entryId, entry);

        const chapterOrdinals = graph.ordinalsInChapters(
            entry.bookName,
            entry.chapterStart,
            entry.chapterEnd,
        );
        if (chapterOrdinals.length > 0) {
            const each = config.chapterBudget / chapterOrdinals.length;
            for (const ordinal of chapterOrdinals) {
                addSeed(ordinal, each, entry.entryId, seedFromChapter);
            }
        }

        /*
         * A citation's whole span is seeded, with its budget split across it.
         *
         * Per citation rather than per verse, so quoting a sixteen-verse
         * passage is one act of pointing and not sixteen — otherwise a reader
         * who cites generously would drown out one who cites precisely.
         */
        /*
         * A whole-chapter citation is not the reader pointing at anything.
         *
         * "[[Leviticus 4]]" names the chapter they were already assigned, so
         * it carries exactly the information the chapter seed carries and none
         * of the specificity the citation channel exists for. Counting it as a
         * citation makes the gate trivial to clear — one such tag drags thirty
         * verses in at citation weight — and the detector goes back to
         * reporting the reading schedule in a better disguise.
         */
        const pointed = entry.citations.filter(cited => verseOf(cited.start) !== 0);
        const perCitation = pointed.length ? config.citationBudget / pointed.length : 0;

        for (const cited of pointed) {
            const ordinals = graph.ordinalsBetween(cited.start, cited.end);
            if (ordinals.length === 0) continue;
            const each = perCitation / ordinals.length;
            for (const ordinal of ordinals) {
                addSeed(ordinal, each, entry.entryId, seedFromCitation);
            }
        }
    }

    if (seedWeight.size === 0) return [];

    // One hop out. Candidates already in the seed set are passages the reader
    // has been to — the claim is about the one they haven't.
    const reachWeight = new Map<number, number>();
    const reachEntries = new Map<number, Set<number>>();
    const reachCiting = new Map<number, Set<number>>();

    const carry = (into: Map<number, Set<number>>, target: number, ids: Set<number>) => {
        let bucket = into.get(target);
        if (!bucket) into.set(target, (bucket = new Set()));
        for (const id of ids) bucket.add(id);
    };

    for (const [seed, weight] of seedWeight) {
        const viaChapter = seedFromChapter.get(seed);
        const viaCitation = seedFromCitation.get(seed);

        for (const target of graph.neighbours(seed)) {
            if (seedWeight.has(target)) continue;
            reachWeight.set(target, (reachWeight.get(target) ?? 0) + weight);
            if (viaChapter) carry(reachEntries, target, viaChapter);
            if (viaCitation) {
                carry(reachEntries, target, viaCitation);
                // Kept separately: reaching a passage from a verse someone
                // chose to quote is different evidence from reaching it
                // because the schedule opened a chapter nearby.
                carry(reachCiting, target, viaCitation);
            }
        }
    }

    const candidates: ConvergenceCandidate[] = [];

    for (const [ordinal, weight] of reachWeight) {
        const contributors = [...(reachEntries.get(ordinal) ?? [])]
            .map(id => entryById.get(id)!)
            .filter(Boolean)
            .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

        if (contributors.length < config.minEntries) continue;

        const books = [...new Set(contributors.map(e => e.bookName))];
        if (books.length < config.minBooks) continue;

        const citing = reachCiting.get(ordinal) ?? new Set<number>();
        if (citing.size < config.minCitingEntries) continue;

        const times = contributors.map(e => Date.parse(e.createdAt)).filter(Number.isFinite);
        const spanDays = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / DAY_MS : 0;
        if (spanDays < config.minSpanDays) continue;

        /*
         * Discount by how connected the passage is to everyone.
         *
         * Without this the answer is Psalm 119, Isaiah 53 and John 3:16 for
         * every reader alive — they are the highest-degree nodes in the
         * Treasury, so they are reachable from almost any seed. That is the
         * textbook Barnum failure: a result that feels personal and would be
         * identical for a stranger. Dividing by log(degree) asks instead
         * whether this passage is central to THIS reader's set.
         */
        const degree = graph.degree(ordinal);

        /*
         * Two discounts, answering two different ways this can be true and
         * still not worth saying.
         *
         * Degree asks whether the passage is central to THIS reader or merely
         * central to everyone — without it the answer is Psalm 119 and John
         * 3:16 for every user alive. Square root rather than log: degrees in
         * the Treasury run from one to several hundred, and log compresses
         * that hundred-fold range into barely two, so the discount the comment
         * promised was not one the score delivered.
         *
         * planShape asks whether the reader assembled this set or the schedule
         * did. Both discounts demote rather than exclude, so a real thread that
         * happens to run through consecutive books can still surface above the
         * noise.
         */
        const planShape = sequentiality(contributors);
        const citingFraction = citing.size / contributors.length;
        const score =
            (weight / Math.sqrt(degree)) *
            (1 - config.planPenalty * planShape) *
            citingFraction;

        candidates.push({
            hubVerseId: graph.verseAt(ordinal),
            hubDegree: degree,
            entryIds: contributors.map(e => e.entryId),
            bookNames: books,
            passages: contributors.map(passageLabel),
            citingEntryCount: citing.size,
            citingFraction,
            spanDays,
            planShape,
            score,
        });
    }

    candidates.sort(
        (a, b) => b.score - a.score || b.entryIds.length - a.entryIds.length || a.hubVerseId - b.hubVerseId,
    );
    return candidates.slice(0, config.maxCandidates);
}

// ─── the IO half ──────────────────────────────────────────────────────────────

/** Everything the detector needs from the journal, in one query. */
export async function loadSeedEntries(limit = 200): Promise<SeedEntry[]> {
    return withDatabase(async database => {
        const rows = await database.getAllAsync<any>(
            `SELECT id, book_name, chapter_start, chapter_end,
                    datetime(created_at, 'localtime') AS created_at,
                    ${CITATION_FIELDS.join(', ')}
             FROM journal_entries
             ORDER BY created_at DESC
             LIMIT ?`,
            [limit],
        );

        return rows.map(row => ({
            entryId: row.id,
            bookName: row.book_name,
            chapterStart: row.chapter_start,
            chapterEnd: row.chapter_end ?? undefined,
            createdAt: row.created_at,
            citations: citationsIn(CITATION_FIELDS.map(f => row[f] ?? '').join(' ')),
        }));
    });
}

/**
 * Find convergences and record them. Returns the observation ids.
 *
 * Safe to call repeatedly: each candidate is keyed by its hub, so a second run
 * refreshes what it already found rather than queueing it again — and a hub the
 * reader has already rejected stays rejected.
 */
export async function detectConvergence(options: ConvergenceOptions = {}): Promise<number[]> {
    const [entries, graph] = await Promise.all([loadSeedEntries(), loadGraph()]);

    /*
     * The half of the claim that decays.
     *
     * "You have never written about it" is true when recorded and can stop
     * being true the moment the reader opens that passage — which is, after
     * all, what the card asked them to do. A queued finding is not re-derived
     * before it is shown, so without this the app would eventually tell
     * someone they had never read something it had sent them to read.
     *
     * Everything still unvisited is kept, not just what this run ranked
     * highest: the retraction is about truth, not about placing.
     */
    const stillUnwritten = findConvergence(entries, graph, {
        ...options,
        maxCandidates: Number.MAX_SAFE_INTEGER,
    }).map(candidate => `hub:${candidate.hubVerseId}`);
    await retractObservations('convergence', stillUnwritten);

    const candidates = findConvergence(entries, graph, options);

    const ids: number[] = [];
    for (const candidate of candidates) {
        ids.push(
            await recordObservation({
                detector: 'convergence',
                dedupeKey: `hub:${candidate.hubVerseId}`,
                claim: {
                    hubVerseId: candidate.hubVerseId,
                    hubDegree: candidate.hubDegree,
                    entryCount: candidate.entryIds.length,
                    bookNames: candidate.bookNames,
                    passages: candidate.passages,
                    spanDays: Math.round(candidate.spanDays),
                    planShape: Number(candidate.planShape.toFixed(2)),
                    hubBook: bookNumberOf(candidate.hubVerseId),
                },
                /*
                 * Built from the evidence, not from `score`.
                 *
                 * `score` exists to order candidates within one run and has no
                 * absolute scale — it moves whenever the weighting changes, as
                 * it just did. Confidence has a harder job: the pending queue
                 * mixes detectors, so the number has to mean roughly the same
                 * thing coming from convergence as from absence. Entry count
                 * and plan shape do; a raw dot-product sum does not.
                 */
                confidence:
                    Math.min(1, candidate.entryIds.length / 8) *
                    (1 - 0.5 * candidate.planShape) *
                    // Softened rather than applied straight: a finding where a
                    // third of the evidence was chosen is weaker, not worthless.
                    (0.5 + 0.5 * candidate.citingFraction),
                evidence: [
                    ...candidate.entryIds.map(entryId => ({ kind: 'entry' as const, entryId })),
                    { kind: 'verse' as const, verseId: candidate.hubVerseId },
                ],
            }),
        );
    }

    return ids;
}
