/**
 * Convergence: the passage your entries circle and you have never written about.
 *
 * The claim is narrow on purpose — *these passages you chose are connected, and
 * here is the one at their centre you have not read* — so it is checkable
 * against public data and can be wrong.
 *
 * `findConvergence` is pure (entries and a graph in, candidates out) and is what
 * scripts/verify-convergence.mjs exercises; the IO lives in `detectConvergence`
 * below it and holds none of the reasoning.
 *
 * Threshold and scoring rationale: design/DETECTORS.md#convergence
 */

import { withDatabase } from '../../data/db';

/**
 * Hubs the reader has already engaged with — followed through, judged, or
 * dismissed. Read straight from the observation record rather than inferred,
 * so "settled" means exactly what the reader did.
 */
async function settledHubs(): Promise<Set<VerseId>> {
    const rows = await withDatabase(database =>
        database.getAllAsync<{ dedupe_key: string }>(
            `SELECT dedupe_key FROM observations
             WHERE detector = 'convergence'
               AND (followed_at IS NOT NULL OR feedback IS NOT NULL OR dismissed_at IS NOT NULL)`,
        ),
    );
    return new Set(rows.map(row => Number(row.dedupe_key.replace('hub:', ''))));
}
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
     * Almost any pair of passages is two hops apart in a graph this dense, so
     * the floor is what makes the claim about the reader rather than the text.
     */
    minEntries?: number;
    /**
     * Distinct Bible books those entries must span. One book is the reading
     * plan talking — four sittings on Genesis 12-15 converge because they are
     * one narrative.
     */
    minBooks?: number;
    /**
     * Days between the earliest and latest contributing entry. A connection
     * drawn across months means the reader had forgotten the first passage by
     * the time they wrote the second; inside a fortnight it is one session.
     */
    minSpanDays?: number;
    /**
     * Total weight one entry contributes through the chapter it was assigned —
     * a budget per entry, not per verse, so a long chapter does not outvote a
     * short one and the chapter:citation ratio means what it says.
     */
    chapterBudget?: number;
    /** Total weight one entry contributes through verses its writer chose to cite. */
    citationBudget?: number;
    /**
     * Contributors that must reach the passage through a verse they CITED
     * rather than a chapter the plan assigned. A chapter enters the seed set
     * whole, carrying every theme it contains; a citation is the reader
     * pointing. See design/DETECTORS.md#convergence.
     */
    minCitingEntries?: number;
    /**
     * How much a plan-shaped convergence is demoted, 0–1. The app ships one
     * reading plan for everybody, so a chapter-led finding risks handing two
     * friends the identical "private" discovery.
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
    // Demoted, not dropped: Exodus and Leviticus really do point at Hebrews 9,
    // it just is not a discovery about the reader.
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
     * Two of four is a stronger claim than two of seven: count is how much
     * evidence there is, this is how much of it the reader chose.
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
 * The tell for "plan or reader" is ORDER: a plan marches forward, so date rank
 * and canonical rank move together. A thread the reader owns jumps around —
 * Genesis in October, Habakkuk in March — and the correlation collapses.
 *
 * Spearman's rho floored at zero (reading backwards is not evidence of
 * anything), then scaled by how tightly the entries sit in the canon, since
 * order alone over four or five points says very little.
 * See design/DETECTORS.md#convergence.
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

    // Half-weight at roughly ten books of spread. A judgement, not a
    // derivation: tuned so Genesis-to-Leviticus still reads as the schedule
    // while Genesis-to-Jeremiah does not.
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

    // Seeds are tracked by provenance, not just weight: arriving via an
    // assigned chapter and via a verse the writer reached for are different
    // evidence, and the gates below treat them differently.
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

        // Whole-chapter citations are dropped: "[[Leviticus 4]]" names the
        // chapter already assigned, so it carries no more than the chapter seed
        // while making the citation gate trivial to clear.
        //
        // Budget splits per citation, not per verse, so quoting sixteen verses
        // is one act of pointing and a generous citer cannot drown out a
        // precise one.
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

        const degree = graph.degree(ordinal);

        /*
         * Two discounts, for two ways this can be true and still not worth
         * saying. Degree asks whether the passage is central to THIS reader or
         * to everyone — without it the answer is Psalm 119 and John 3:16 for
         * every user alive. Square root, not log: Treasury degrees span one to
         * several hundred and log flattens that range to almost nothing.
         *
         * planShape asks whether the reader assembled this set or the schedule
         * did. Both demote rather than exclude, so a real thread running
         * through consecutive books can still surface.
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
     * "You have never written about it" decays — it stops being true the moment
     * the reader opens that passage, which is what the card asked them to do.
     * Queued findings are not re-derived before display, so without this the app
     * would tell someone they had never read what it sent them to read.
     *
     * Everything still unvisited is kept, not just this run's top candidates:
     * the retraction is about truth, not placing.
     */
    const stillUnwritten = findConvergence(entries, graph, {
        ...options,
        maxCandidates: Number.MAX_SAFE_INTEGER,
    }).map(candidate => `hub:${candidate.hubVerseId}`);
    await retractObservations('convergence', stillUnwritten);

    // A hub with any engagement behind it is never offered again, even if the
    // claim still holds. "That's not it" counts too: they looked and decided.
    const settled = await settledHubs();

    const candidates = findConvergence(entries, graph, options);

    const ids: number[] = [];
    for (const candidate of candidates) {
        if (settled.has(candidate.hubVerseId)) continue;
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
                 * Built from the evidence, not from `score`. `score` only
                 * orders candidates within one run and has no absolute scale,
                 * but the pending queue mixes detectors, so confidence has to
                 * mean roughly the same thing here as it does in absence.
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
