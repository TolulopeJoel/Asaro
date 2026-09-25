/**
 * Something you are trying to be, and the reason you gave for it.
 *
 * `action_items.motivation` is the only place someone writes *why* a thing
 * matters in their own words.
 *
 * These are not tasks. "I will be kinder to my parents" is a standing
 * commitment about character — nobody completes it — so nothing here is gated
 * on `is_completed`, and the framing is present tense: this is something you
 * are working on, and here is why you said it mattered. Age is the reason to
 * resurface (the resolution is remembered, the reason fades), never an
 * accusation of lateness. Completion and pinning are courtesy filters only.
 *
 * Thresholds and ranking: design/DETECTORS.md#commitment
 */

import { withDatabase } from '../../data/db';
import { actionKindOf } from '../../data/actionKind';
import { stripReferences } from '../../utils/reference';
import { recordObservation, retractObservations } from '../observation';

const DAY_MS = 86_400_000;

export interface StandingCommitment {
    actionItemId: number;
    entryId: number;
    action: string;
    motivation: string;
    /** Days since the entry it was written in. */
    ageDays: number;
    /** "Exodus 22-25", as the journal recorded the reading. */
    passage: string;
    writtenAt: string;
}

export interface CommitmentOptions {
    /**
     * How old a resolution must be before it is worth handing back. Set past
     * `ActionReminders`' five-week ceiling so the two do not compete — the
     * point here is that the reason has faded.
     */
    minAgeDays?: number;
    /**
     * Minimum motivation length, measured on prose with citations stripped. A
     * motivation that is only `[[Exodus 20:12]]` is a pointer, not a reason.
     */
    minMotivationChars?: number;
    maxCandidates?: number;
}

const DEFAULTS: Required<CommitmentOptions> = {
    minAgeDays: 56,
    minMotivationChars: 40,
    // Two, against convergence's three: these are the reader's own sentences
    // handed back, and a queue of them reads as a list of failures.
    maxCandidates: 2,
};

/**
 * Everything that still holds, before ranking. Separate from `rankCommitments`
 * because retraction needs the whole set — otherwise the third is withdrawn
 * every run and found again the next.
 */
export function qualifyingCommitments(
    open: StandingCommitment[],
    options: CommitmentOptions = {},
): StandingCommitment[] {
    const config = { ...DEFAULTS, ...options };
    return open.filter(
        item =>
            item.ageDays >= config.minAgeDays &&
            stripReferences(item.motivation).trim().length >= config.minMotivationChars,
    );
}

export function rankCommitments(
    open: StandingCommitment[],
    options: CommitmentOptions = {},
): StandingCommitment[] {
    const config = { ...DEFAULTS, ...options };
    const qualifying = qualifyingCommitments(open, options);

    // Length of the reason carries the score (saturating, so bulk alone cannot
    // dominate) with age as a logarithmic tilt. Age times length would pin the
    // oldest item in the top slot for ever.
    const scored = qualifying.map(item => ({
        item,
        score:
            (Math.min(stripReferences(item.motivation).trim().length, 300) / 300) *
            Math.log2(1 + item.ageDays / 7),
    }));

    scored.sort((a, b) => b.score - a.score || b.item.ageDays - a.item.ageDays);
    return scored.slice(0, config.maxCandidates).map(s => s.item);
}

/** Every commitment still standing, with the entry it was written in. */
export async function loadCommitments(now: number = Date.now()): Promise<StandingCommitment[]> {
    return withDatabase(async database => {
        const rows = await database.getAllAsync<any>(
            `SELECT a.id, a.entry_id, a.action, a.motivation,
                    j.book_name, j.chapter_start, j.chapter_end,
                    datetime(j.created_at, 'localtime') AS created_at
             FROM action_items a
             JOIN journal_entries j ON j.id = a.entry_id
             WHERE COALESCE(a.is_completed, 0) = 0
               AND COALESCE(a.is_pinned, 0) = 0
               AND TRIM(COALESCE(a.action, '')) != ''
               -- Applications only: a practice has its own rhythm and a dated
               -- action has a deadline, so both are already served elsewhere.
               -- This detector is for the commitment with no end.
               AND a.cadence IS NULL
               AND a.due_at IS NULL
               -- Archived: the reader has said this one is finished with.
               AND a.archived_at IS NULL`,
        );

        return rows.filter(row => actionKindOf(row) === 'application').map(row => {
            const range =
                row.chapter_end && row.chapter_end !== row.chapter_start
                    ? `${row.chapter_start}–${row.chapter_end}`
                    : `${row.chapter_start}`;
            const written = Date.parse(row.created_at);

            return {
                actionItemId: row.id,
                entryId: row.entry_id,
                action: (row.action ?? '').trim(),
                motivation: (row.motivation ?? '').trim(),
                ageDays: Number.isFinite(written) ? Math.max(0, (now - written) / DAY_MS) : 0,
                passage: `${row.book_name} ${range}`,
                writtenAt: row.created_at,
            };
        });
    });
}

/**
 * Find commitments worth handing back, and record them.
 *
 * Keyed on the action item, so one resolution is offered once however many
 * times the detector runs — and a reader who says "that's not it" is not asked
 * about it again.
 */
export async function detectCommitments(options: CommitmentOptions = {}): Promise<number[]> {
    const open = await loadCommitments();

    // `loadCommitments` already excludes anything promoted to a practice,
    // dated, or archived, so whatever it stops returning should stop being
    // queued.
    await retractObservations(
        'commitment',
        qualifyingCommitments(open, options).map(item => `action:${item.actionItemId}`),
    );

    const chosen = rankCommitments(open, options);

    const ids: number[] = [];
    for (const item of chosen) {
        ids.push(
            await recordObservation({
                detector: 'commitment',
                dedupeKey: `action:${item.actionItemId}`,
                claim: {
                    action: item.action,
                    motivation: item.motivation,
                    passage: item.passage,
                    writtenAt: item.writtenAt,
                    ageDays: Math.round(item.ageDays),
                },
                // Quoting the reader, so it cannot be wrong about its facts:
                // confidence only sets how much of the queue it takes against
                // detectors that are inferring.
                confidence: 0.5,
                evidence: [
                    { kind: 'actionItem', actionItemId: item.actionItemId, entryId: item.entryId },
                    { kind: 'entry', entryId: item.entryId },
                ],
            }),
        );
    }

    return ids;
}
