/**
 * Observations: the one thing every detector produces and the reader sees.
 *
 * A detector's job ends at a *claim with evidence*. Wording, ranking and pacing
 * are three separate problems handled elsewhere, so no detector decides how it
 * is phrased, whether it is shown, or when.
 *
 *   claim      structured, never prose. Rendered at display time.
 *   evidence   the entries, verses and action items it rests on.
 *   confidence for ranking, not for display.
 *
 * Evidence is mandatory — an observation with no receipts cannot be constructed
 * here. Being checkable is the only thing separating a finding from a horoscope.
 *
 * Pacing, surfaces and the archive rule: design/DETECTORS.md#pacing-and-surfaces
 */

import { withDatabase } from '../data/db';
import { VerseId } from '../bible/ref';

/**
 * Every detector, in one place. A list rather than a bare union because the
 * archive query and the scorecard both need to enumerate them, and a second
 * hand-kept copy is how a renamed detector goes on being queried under a dead
 * name.
 */
export const DETECTORS = [
    'convergence',
    'milestone',
    'commitment',
    'study',
    'absence',
    'divineName',
    'recurrence',
    'motif',
    'turn',
] as const;

/** Which detector found it. Also the key the pacing rules group by. */
export type DetectorName = (typeof DETECTORS)[number];

/**
 * Detectors whose findings are shown but not archived.
 *
 * The rule is: archive discoveries, not echoes of what is already yours. A
 * convergence names a connection that lives nowhere else, so losing the card
 * loses it. A commitment, study topic or finished book already has a home
 * elsewhere in the app. Absence fails for a sharper reason — its claim is not
 * permanent, and a permanent record of a retractable claim is a contradiction.
 *
 * Storing and showing are separate: every observation is stored regardless.
 */
const EPHEMERAL: DetectorName[] = ['milestone', 'commitment', 'study', 'absence'];

/**
 * Where a finding belongs — a question about timing as much as place.
 *
 * `home` is for a discovery: you open the app and there is something you did
 * not know. `afterSave` is for findings that land as a reward rather than an
 * interruption, and where they would lose to the reading, the practices and the
 * plan if shown on Home.
 */
export type Surface = 'home' | 'afterSave';

const AFTER_SAVE: DetectorName[] = ['milestone', 'commitment', 'study', 'absence'];

export function surfaceOf(detector: DetectorName): Surface {
    return AFTER_SAVE.includes(detector) ? 'afterSave' : 'home';
}

/**
 * Findings that come round again. A discovery is shown once; a commitment names
 * something with no end, so meeting it once in a lifetime is a coincidence
 * rather than a reminder.
 *
 * Spacing comes from ROTATION, not long intervals — least-recently-shown goes
 * next, so it tunes itself to how much someone has written down. `REST_DAYS` is
 * only a floor under that.
 */
const REPEATS: DetectorName[] = ['commitment', 'study', 'absence'];

/**
 * How long each recurring detector rests, in days. Per detector because
 * rotation does not do the same work for each: commitments rotate among
 * themselves, but absence produces exactly one candidate, so its rest interval
 * is the only thing between a monthly observation and the same sentence after
 * every entry.
 */
const REST_DAYS: Partial<Record<DetectorName, number>> = {
    commitment: 7,
    // Longer than a commitment's: a curiosity handed back twice in a fortnight
    // reads as nagging about homework.
    study: 14,
    absence: 30,
};
const DEFAULT_REST_DAYS = 7;

export function restDaysOf(detector: DetectorName): number {
    return REST_DAYS[detector] ?? DEFAULT_REST_DAYS;
}

export function repeats(detector: DetectorName): boolean {
    return REPEATS.includes(detector);
}

export function appearsInArchive(detector: DetectorName): boolean {
    return !EPHEMERAL.includes(detector);
}

export interface EvidenceItem {
    kind: 'entry' | 'verse' | 'actionItem';
    entryId?: number;
    field?: string;
    verseId?: VerseId;
    actionItemId?: number;
}

export interface ObservationInput {
    detector: DetectorName;
    /**
     * Identifies the FINDING, not the run that found it. Detectors re-run as
     * the journal grows, so rediscovery refreshes the existing row and an
     * observation already seen or rejected stays that way.
     */
    dedupeKey: string;
    /** The structured claim. Numbers, ids and dates — never a sentence. */
    claim: Record<string, unknown>;
    confidence: number;
    evidence: EvidenceItem[];
}

export interface StoredObservation {
    id: number;
    detector: DetectorName;
    dedupeKey: string;
    claim: Record<string, unknown>;
    confidence: number;
    createdAt: string;
    shownAt: string | null;
    openedAt: string | null;
    dismissedAt: string | null;
    /** null = not asked, 1 = the reader agreed, 0 = "that's not it". */
    feedback: number | null;
    /** How many times it has come round. */
    shownCount: number;
    /** When the reader tapped through to the passage, if they did. */
    followedAt: string | null;
    evidence: EvidenceItem[];
}

/**
 * Record a finding, or refresh one already recorded.
 *
 * Returns the row id either way. An existing row keeps its `shown_at`,
 * `feedback` and `created_at` — the reader's history with a finding outlives
 * any particular recomputation of it.
 */
export async function recordObservation(input: ObservationInput): Promise<number> {
    if (input.evidence.length === 0) {
        throw new Error(`${input.detector} produced an observation with no evidence`);
    }

    return withDatabase(async database => {
        const existing = await database.getFirstAsync<{ id: number }>(
            `SELECT id FROM observations WHERE detector = ? AND dedupe_key = ?`,
            [input.detector, input.dedupeKey],
        );

        if (existing) {
            await database.runAsync(
                `UPDATE observations SET payload = ?, confidence = ? WHERE id = ?`,
                [JSON.stringify(input.claim), input.confidence, existing.id],
            );
            await writeEvidence(database, existing.id, input.evidence);
            return existing.id;
        }

        const result = await database.runAsync(
            `INSERT INTO observations (detector, dedupe_key, payload, confidence)
             VALUES (?, ?, ?, ?)`,
            [input.detector, input.dedupeKey, JSON.stringify(input.claim), input.confidence],
        );
        await writeEvidence(database, result.lastInsertRowId, input.evidence);
        return result.lastInsertRowId;
    });
}

async function writeEvidence(
    database: any,
    observationId: number,
    evidence: EvidenceItem[],
): Promise<void> {
    // Replaced wholesale: a refreshed finding may rest on more entries than it
    // did last week, and evidence that no longer supports the claim must not
    // linger under it.
    await database.runAsync(`DELETE FROM observation_evidence WHERE observation_id = ?`, [
        observationId,
    ]);

    for (let i = 0; i < evidence.length; i++) {
        const item = evidence[i];
        await database.runAsync(
            `INSERT INTO observation_evidence
                (observation_id, kind, entry_id, field, verse_id, action_item_id, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                observationId,
                item.kind,
                item.entryId ?? null,
                item.field ?? null,
                item.verseId ?? null,
                item.actionItemId ?? null,
                i,
            ],
        );
    }
}

function hydrate(
    row: any,
    evidence: EvidenceItem[],
): StoredObservation {
    return {
        id: row.id,
        detector: row.detector,
        dedupeKey: row.dedupe_key,
        claim: JSON.parse(row.payload),
        confidence: row.confidence,
        createdAt: row.created_at,
        shownAt: row.shown_at,
        openedAt: row.opened_at,
        dismissedAt: row.dismissed_at,
        feedback: row.feedback,
        shownCount: row.shown_count ?? 0,
        followedAt: row.followed_at ?? null,
        evidence,
    };
}

async function evidenceFor(database: any, ids: number[]): Promise<Map<number, EvidenceItem[]>> {
    const byObservation = new Map<number, EvidenceItem[]>();
    if (ids.length === 0) return byObservation;

    const rows = await database.getAllAsync(
        `SELECT observation_id, kind, entry_id, field, verse_id, action_item_id
         FROM observation_evidence
         WHERE observation_id IN (${ids.map(() => '?').join(',')})
         ORDER BY observation_id, sort_order`,
        ids,
    );

    for (const row of rows as any[]) {
        const item: EvidenceItem = {
            kind: row.kind,
            ...(row.entry_id !== null && { entryId: row.entry_id }),
            ...(row.field !== null && { field: row.field }),
            ...(row.verse_id !== null && { verseId: row.verse_id }),
            ...(row.action_item_id !== null && { actionItemId: row.action_item_id }),
        };
        const bucket = byObservation.get(row.observation_id);
        if (bucket) bucket.push(item);
        else byObservation.set(row.observation_id, [item]);
    }

    return byObservation;
}

/**
 * Findings the reader has not seen, best first. Rejected stays rejected — a
 * memory feature that re-asks is one people turn off. Ordered by confidence
 * until the trained ranker replaces it.
 */
export async function getPendingObservations(
    limit = 10,
    surface: Surface = 'home',
): Promise<StoredObservation[]> {
    return withDatabase(async database => {
        const detectors = DETECTORS.filter(name => surfaceOf(name) === surface);
        if (detectors.length === 0) return [];

        const recurring = detectors.filter(repeats);
        const once = detectors.filter(name => !repeats(name));

        /*
         * Two rules in one query. A once-only finding must never have been
         * shown; a recurring one may have been, if it has rested, and then
         * least-recently-shown goes first. `shown_at` sorts nulls first in
         * SQLite, so never-shown is naturally ahead.
         *
         * Dismissal is a rest, not an ending — only a rejected finding stays
         * gone.
         */
        const clauses: string[] = [];
        const params: any[] = [];

        if (once.length > 0) {
            clauses.push(
                `(detector IN (${once.map(() => '?').join(',')}) AND shown_at IS NULL AND dismissed_at IS NULL)`,
            );
            params.push(...once);
        }
        // One clause per recurring detector, since each rests for its own span.
        // A single IN(...) would silently give absence the commitment cadence.
        for (const name of recurring) {
            const rest = `-${restDaysOf(name)} days`;
            clauses.push(
                `(detector = ?
                  AND (shown_at IS NULL OR shown_at <= datetime('now', ?))
                  AND (dismissed_at IS NULL OR dismissed_at <= datetime('now', ?)))`,
            );
            params.push(name, rest, rest);
        }
        if (clauses.length === 0) return [];

        const rows = await database.getAllAsync<any>(
            `SELECT * FROM observations
             WHERE (feedback IS NULL OR feedback = 1)
               AND (${clauses.join(' OR ')})
             ORDER BY shown_at ASC, confidence DESC, created_at DESC
             LIMIT ?`,
            [...params, limit],
        );

        const evidence = await evidenceFor(database, rows.map(r => r.id));
        return rows.map(row => hydrate(row, evidence.get(row.id) ?? []));
    });
}

/**
 * Everything noticed, newest first — the archive behind the Echoes tab. Keeps
 * what the reader has seen, dismissed or rejected: a card that vanishes for
 * good on dismissal teaches people not to dismiss it. Rejected findings are
 * never re-offered on Home, only kept legible here.
 */
export async function getRecentObservations(limit = 30): Promise<StoredObservation[]> {
    return withDatabase(async database => {
        // Excluded here, not at write time: those rows are still needed for
        // dedupe keys and for the verdict column.
        const archived = DETECTORS.filter(appearsInArchive);

        const rows = await database.getAllAsync<any>(
            `SELECT * FROM observations
             WHERE (shown_at IS NOT NULL OR feedback IS NOT NULL OR dismissed_at IS NOT NULL)
               AND detector IN (${archived.map(() => '?').join(',')})
             ORDER BY COALESCE(shown_at, created_at) DESC
             LIMIT ?`,
            [...archived, limit],
        );
        const evidence = await evidenceFor(database, rows.map(r => r.id));
        return rows.map(row => hydrate(row, evidence.get(row.id) ?? []));
    });
}

/**
 * Withdraw findings that have stopped being true — a queued claim the journal
 * has moved underneath, such as a passage the reader has since written about.
 *
 * Only PENDING rows go. Anything shown, dismissed or judged is history, and the
 * verdict is the only ground truth the app collects.
 *
 * `validKeys` is every finding that still holds, not just what this run
 * recorded: a detector keeping its best three would otherwise retract the
 * fourth every run and rediscover it the next.
 */
export async function retractObservations(
    detector: DetectorName,
    validKeys: string[],
): Promise<number> {
    return withDatabase(async database => {
        const pending = await database.getAllAsync<{ id: number; dedupe_key: string }>(
            `SELECT id, dedupe_key FROM observations
             WHERE detector = ?
               AND shown_at IS NULL AND dismissed_at IS NULL AND feedback IS NULL`,
            [detector],
        );

        const keep = new Set(validKeys);
        const stale = pending.filter(row => !keep.has(row.dedupe_key));
        for (const row of stale) {
            await database.runAsync(`DELETE FROM observations WHERE id = ?`, [row.id]);
        }
        return stale.length;
    });
}

export async function getObservation(id: number): Promise<StoredObservation | null> {
    return withDatabase(async database => {
        const row = await database.getFirstAsync<any>(`SELECT * FROM observations WHERE id = ?`, [id]);
        if (!row) return null;
        const evidence = await evidenceFor(database, [id]);
        return hydrate(row, evidence.get(id) ?? []);
    });
}

// ─── instrumentation ─────────────────────────────────────────────────────────

/*
 * These calls are the training set for the ranker that will replace confidence
 * ordering. They ship ahead of it because the months of history it needs start
 * accumulating the day the first card appears.
 */

/** Record a showing. `shown_at` is the LAST one, not the first. */
export async function markShown(id: number): Promise<void> {
    await withDatabase(database =>
        database.runAsync(
            `UPDATE observations
                SET shown_at = CURRENT_TIMESTAMP, shown_count = shown_count + 1
              WHERE id = ?`,
            [id],
        ),
    );
}

/**
 * The reader tapped into the passage the finding offered — the strongest
 * evidence a card worked. Not a verdict: following a suggestion and agreeing
 * with it are different, and the ranker wants both.
 */
export async function markFollowed(id: number): Promise<void> {
    await withDatabase(database =>
        database.runAsync(`UPDATE observations SET followed_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]),
    );
}

export async function markOpened(id: number): Promise<void> {
    await withDatabase(database =>
        database.runAsync(`UPDATE observations SET opened_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]),
    );
}

export async function markDismissed(id: number): Promise<void> {
    await withDatabase(database =>
        database.runAsync(`UPDATE observations SET dismissed_at = CURRENT_TIMESTAMP WHERE id = ?`, [
            id,
        ]),
    );
}

/**
 * The reader's verdict. `false` is "that's not it".
 *
 * The only ground truth about whether a detector is right, what keeps a wrong
 * finding from coming back, and the label the ranker learns from. Has to stay
 * cheap to give: one tap, no dialog.
 */
export async function recordFeedback(id: number, agreed: boolean): Promise<void> {
    await withDatabase(database =>
        database.runAsync(`UPDATE observations SET feedback = ? WHERE id = ?`, [agreed ? 1 : 0, id]),
    );
}

/** Detector accuracy as the reader has judged it. Drives thresholds later. */
export async function detectorScorecard(): Promise<
    { detector: string; shown: number; agreed: number; rejected: number }[]
> {
    return withDatabase(async database =>
        database.getAllAsync(
            `SELECT detector,
                    COUNT(shown_at) AS shown,
                    SUM(CASE WHEN feedback = 1 THEN 1 ELSE 0 END) AS agreed,
                    SUM(CASE WHEN feedback = 0 THEN 1 ELSE 0 END) AS rejected
             FROM observations
             GROUP BY detector`,
        ),
    );
}
