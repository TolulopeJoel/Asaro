/**
 * Something you are trying to be, and the reason you gave for it.
 *
 * `action_items.motivation` is the most revealing column in this schema. It is
 * the only place someone writes *why* a thing matters, in their own words,
 * unmediated by the passage that prompted it — and no other journalling app
 * asks for it, because no other app makes resolving something part of the
 * writing flow.
 *
 * The plan called this "Unfinished" and gated it on `is_completed`. Two facts
 * about a real journal took that apart.
 *
 * Forty-six entries, ten action items, and **not one ever ticked**. An unused
 * checkbox is not evidence, so reading it as "you did not do this" would be
 * inferring someone's obedience from a UI affordance they never touch.
 *
 * And more fundamentally: these are not tasks. "I will be kinder to my
 * parents", "I want to give Jehovah my best", "I want to be quick to follow
 * instructions" — nobody completes those. They are standing commitments about
 * character, the kind of thing you hold for years, and a checkbox is the wrong
 * shape for them entirely. A detector built on completion was answering a
 * question the data was never asking.
 *
 * So the framing is present tense. Not "you said this once and let it go" but
 * "this is something you are working on, and here is why you said it
 * mattered". Age is the reason to resurface — the resolution is remembered and
 * the reason fades — never an accusation of lateness. Completion and pinning
 * survive only as courtesy filters: something explicitly closed or
 * deliberately pinned should not be handed back.
 *
 * Which makes this meditation material rather than a task list, and the app is
 * named for meditation.
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
     * How old a resolution must be before it is worth handing back.
     *
     * Eight weeks, because the point is that the reason has faded. Anything
     * recent is still in mind, and the app already has somewhere for that —
     * `ActionReminders` works in windows up to five weeks, so this begins
     * where that leaves off rather than competing with it.
     */
    minAgeDays?: number;
    /**
     * Minimum motivation length, after citations are stripped.
     *
     * Measured on the prose, not the markup: a motivation that is only
     * `[[Exodus 20:12]], [[Exodus 21:15]]` is a pointer, not a reason, and
     * handing it back gives the reader nothing they did not already see. On a
     * real journal this cut four of ten — two empty, two citations-only.
     */
    minMotivationChars?: number;
    maxCandidates?: number;
}

const DEFAULTS: Required<CommitmentOptions> = {
    minAgeDays: 56,
    minMotivationChars: 40,
    /*
     * Two at a time, against convergence's three. These are the reader's own
     * sentences handed back to them, which lands harder than a passage
     * suggestion — and a queue of them would read as a list of things they
     * have failed to do, which is precisely what this must never become.
     */
    maxCandidates: 2,
};

/** Rank what is worth handing back first. */
/**
 * Everything that still holds, before any of it is ranked.
 *
 * Separate from `rankCommitments` because retraction needs the whole set: a
 * detector that records its best two would otherwise withdraw the third every
 * run and find it again the next.
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

    /*
     * Length of the reason, with age as a gentle tilt rather than the driver.
     *
     * The plan proposed age times length, which hands the oldest item the top
     * slot forever. What actually marks one of these as having meant something
     * is how much the writer bothered to explain it — age only decides whether
     * enough time has passed for the explaining to be worth repeating. So
     * length carries the score, saturating so a very long motivation cannot
     * dominate on bulk alone, and age enters logarithmically.
     */
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
               /*
                * Applications only. A practice has a rhythm of its own and a
                * dated action has a deadline — both are already spoken for by
                * something better suited than a card that says "you wrote this
                * down five months ago". This detector exists for the kind of
                * commitment nothing else can support: the one with no end.
                */
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

    /*
     * `loadCommitments` already excludes anything that has become a practice,
     * gained a date, or been archived — so whatever it no longer returns is
     * exactly what should no longer be queued. Without this a commitment
     * promoted to a practice went on waiting as a commitment, because
     * detectors only ever wrote and nothing ever withdrew.
     */
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
                /*
                 * Steady and unremarkable. This detector cannot be wrong about
                 * its facts — it is quoting the reader — so confidence is not
                 * measuring truth here, only how much of the queue it should
                 * take against detectors that are inferring something.
                 */
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
