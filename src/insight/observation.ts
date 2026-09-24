/**
 * Observations: the one thing every detector produces and the reader sees.
 *
 * A detector's job ends at a *claim with evidence*. It never decides wording,
 * never decides whether the reader sees it, and never decides when. Those are
 * three different problems — phrasing, ranking, pacing — and folding them into
 * each detector is how you end up with seven features that disagree about how
 * often they may speak.
 *
 * The shape is deliberately narrow:
 *
 *   claim      structured, never prose. Rendered at display time.
 *   evidence   the entries, verses and action items it rests on.
 *   confidence how sure the detector is, for ranking, not for display.
 *
 * Evidence is mandatory. The Barnum literature is blunt that perceived
 * personalisation is easier to produce than the real thing, and that the only
 * thing separating a true observation from a horoscope is whether the reader
 * can check it. So an observation with no receipts cannot be constructed here,
 * and every card can be opened to see what it stands on.
 */

import { withDatabase } from '../data/db';
import { VerseId } from '../bible/ref';

/**
 * Every detector, in one place.
 *
 * A list rather than a bare union, because two things need to enumerate them —
 * the archive query below, and anything that reports per-detector accuracy —
 * and a second hand-kept copy is how a renamed detector goes on being queried
 * under a name nothing writes any more.
 */
export const DETECTORS = [
    'convergence',
    'commitment',
    'absence',
    'divineName',
    'recurrence',
    'motif',
    'turn',
] as const;

/** Which detector found it. Also the key the pacing rules group by. */
export type DetectorName = (typeof DETECTORS)[number];

/**
 * Whether a finding is worth looking back at, or only worth saying once.
 *
 * Every observation is STORED — that is what stops the same finding being
 * offered twice, and it is where the reader's verdict lives. This is a
 * different question: does it belong in the archive a person browses?
 *
 * It belongs there when the finding is the only place its subject exists. A
 * convergence names a passage and a connection that live nowhere else in the
 * app, so losing the card loses the discovery.
 *
 * It does not belong there when the subject already has a home. A commitment
 * card hands back words the reader wrote, about a commitment sitting two taps
 * away under Working on — filing the card beside it would put a copy of
 * something next to the thing, and an archive of reminders about items you
 * already own reads as clutter rather than as a record.
 *
 * So the rule is: archive discoveries, not echoes of what is already yours.
 */
const EPHEMERAL: DetectorName[] = ['commitment'];

/**
 * Where a finding belongs, which is a question about timing as much as place.
 *
 * `home` is for a discovery. It draws someone in — you open the app and there
 * is something you did not know, so the front page is exactly right.
 *
 * `afterSave` is for a finding that lands better as a reward than as an
 * interruption. A commitment card hands back something you wrote months ago
 * about who you are trying to be; the moment that resonates is not while you
 * are deciding whether to read today, but immediately after you have written
 * a new one — when you are already in a committing frame of mind and the older
 * words read as continuity rather than as a task. It is also earned: you did
 * the work, and this is what comes back.
 *
 * On Home it would compete with the reading, the day's practices and the plan,
 * and lose to all three. On the save screen it is the only thing there.
 */
export type Surface = 'home' | 'afterSave';

const AFTER_SAVE: DetectorName[] = ['commitment'];

export function surfaceOf(detector: DetectorName): Surface {
    return AFTER_SAVE.includes(detector) ? 'afterSave' : 'home';
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
     * Identifies the FINDING, not the run that found it.
     *
     * Detectors re-run whenever the journal grows and will keep rediscovering
     * what they already reported. Keying on the finding means the rediscovery
     * refreshes the existing row — so an observation the reader has already
     * seen, or already rejected, stays seen or rejected instead of returning
     * as though it were new.
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
 * Findings the reader has not seen, best first.
 *
 * Deliberately not "all findings". Something rejected stays rejected, and
 * something dismissed is not re-offered — a memory feature that re-asks is
 * one people turn off. Ordering is confidence for now; Phase 6 replaces this
 * with a ranker trained on the columns this module has been filling in.
 */
export async function getPendingObservations(
    limit = 10,
    surface: Surface = 'home',
): Promise<StoredObservation[]> {
    return withDatabase(async database => {
        const detectors = DETECTORS.filter(name => surfaceOf(name) === surface);
        if (detectors.length === 0) return [];

        const rows = await database.getAllAsync<any>(
            `SELECT * FROM observations
             WHERE shown_at IS NULL AND dismissed_at IS NULL AND (feedback IS NULL OR feedback = 1)
               AND detector IN (${detectors.map(() => '?').join(',')})
             ORDER BY confidence DESC, created_at DESC
             LIMIT ?`,
            [...detectors, limit],
        );

        const evidence = await evidenceFor(database, rows.map(r => r.id));
        return rows.map(row => hydrate(row, evidence.get(row.id) ?? []));
    });
}

/**
 * Everything noticed, newest first — the archive behind the Echoes tab.
 *
 * Unlike `getPendingObservations` this keeps what the reader has already seen,
 * dismissed, or rejected. A card that vanishes for good the moment it is
 * dismissed teaches people not to dismiss it; keeping the record, verdicts
 * included, is how the app shows it heard the answer. Rejected findings are
 * never re-offered on Home — they simply remain legible here.
 */
export async function getRecentObservations(limit = 30): Promise<StoredObservation[]> {
    return withDatabase(async database => {
        /*
         * Ephemeral detectors are excluded here, not at write time. They still
         * need their rows: the dedupe key is what stops one commitment being
         * offered every week, and the verdict column is the only ground truth
         * the app ever gets about whether a detector is right. Storing and
         * showing are separate decisions.
         */
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
 * Withdraw findings that have stopped being true.
 *
 * Detectors only ever write. Nothing retracted, so a finding recorded last
 * week went on waiting to be shown however much the journal had moved
 * underneath it — a commitment promoted to a practice still queued as a
 * commitment, a passage the reader has since written about still queued as one
 * they never had. The first is merely stale; the second is a card that would
 * state something false about them, which is the one failure this feature
 * cannot afford.
 *
 * Only PENDING rows go. Anything shown, dismissed or judged is history: the
 * verdict is the only ground truth the app ever collects, and deleting it to
 * tidy a queue would throw away the thing hardest to get back.
 *
 * `validKeys` is every finding that still holds — not just the ones this run
 * chose to record. A detector that keeps its best three would otherwise retract
 * the fourth every run and rediscover it the next.
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
 * These four calls are the training set for the Phase 6 ranker, which is why
 * they ship now rather than with it. A model that decides when the app should
 * speak cannot be trained on engagement that was never recorded, and the
 * months of history it wants start accumulating the day the first card
 * appears — not the day someone gets round to building the model.
 */

export async function markShown(id: number): Promise<void> {
    await withDatabase(database =>
        database.runAsync(
            `UPDATE observations SET shown_at = CURRENT_TIMESTAMP WHERE id = ? AND shown_at IS NULL`,
            [id],
        ),
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
 * The most valuable column in the schema. It is the only ground truth about
 * whether a detector is right, it is what keeps a wrong finding from coming
 * back, and it is the label the ranker learns from. It also has to stay cheap
 * to give — one tap, no dialog, no explanation asked for.
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
