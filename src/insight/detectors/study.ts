/**
 * Something you said you would look into.
 *
 * `journal_entries.study_further` is written during the entry flow and then,
 * unless the writer set a date, never surfaces again — it sits two taps deep in
 * the Library under Topics.
 *
 * This is NOT a list of things owed. Handing a topic back is returning an
 * interest, not chasing a task, so the framing is what they wondered and
 * exactly one is offered at a time — a queue would be a debt counter.
 *
 * Two courtesy filters: a topic marked studied is finished with, and one whose
 * reminder is still in the future already has the reader's own plan attached.
 *
 * Thresholds and ranking: design/DETECTORS.md#study
 */

import { withDatabase } from '../../data/db';
import { stripReferences } from '../../utils/reference';
import { recordObservation, retractObservations } from '../observation';

const DAY_MS = 86_400_000;

export interface OpenTopic {
    entryId: number;
    topic: string;
    /** Days since the entry it was written in. */
    ageDays: number;
    /** "Exodus 22-25", as the journal recorded the reading. */
    passage: string;
    writtenAt: string;
    /** A reminder the reader set, if it has already come and gone. */
    reminderPassed: boolean;
}

export interface StudyOptions {
    /**
     * How long a topic must sit before it is worth handing back. Shorter than
     * `commitment`'s floor: curiosity slips within a fortnight, where a
     * standing commitment is still in mind months later.
     */
    minAgeDays?: number;
    /**
     * Minimum length, measured on prose with citations stripped. A topic that
     * is only `[[Romans 5:12]]` is a bookmark, not a question.
     */
    minChars?: number;
    /**
     * The same floor for a topic whose reminder has passed — much lower,
     * because a date is better evidence than length that this was not a
     * scribble. Not zero: an empty topic has nothing to hand back.
     */
    minCharsIfDated?: number;
    /** One, never more. Two side by side read as a backlog. */
    maxCandidates?: number;
}

const DEFAULTS: Required<StudyOptions> = {
    minAgeDays: 21,
    minChars: 25,
    minCharsIfDated: 10,
    maxCandidates: 1,
};

/**
 * Everything still open, before ranking. Separate from `rankTopics` because
 * retraction needs the whole qualifying set — otherwise the runner-up is
 * withdrawn on every run and rediscovered on the next.
 */
export function qualifyingTopics(open: OpenTopic[], options: StudyOptions = {}): OpenTopic[] {
    const config = { ...DEFAULTS, ...options };
    return open.filter(topic => {
        if (topic.ageDays < config.minAgeDays) return false;
        const length = stripReferences(topic.topic).trim().length;
        return length >= (topic.reminderPassed ? config.minCharsIfDated : config.minChars);
    });
}

export function rankTopics(open: OpenTopic[], options: StudyOptions = {}): OpenTopic[] {
    const config = { ...DEFAULTS, ...options };
    const qualifying = qualifyingTopics(open, options);

    // Length carries the score — how much someone bothered to write is what
    // marks a question as having mattered — with age as a logarithmic tilt.
    // Ranking by age alone would pin the oldest topic in the slot for ever.
    const scored = qualifying.map(topic => ({
        topic,
        score:
            (Math.min(stripReferences(topic.topic).trim().length, 240) / 240) *
            Math.log2(1 + topic.ageDays / 7),
    }));

    /*
     * A passed reminder sorts ahead of everything as its own key, not as a
     * score bonus: the length-times-age term is unbounded in practice (a
     * 400-day-old topic scores near six), so any fixed bonus is swamped by
     * exactly the topics it was meant to outrank. A named day that went by is
     * the only intention here stated outright rather than inferred.
     */
    scored.sort(
        (a, b) =>
            Number(b.topic.reminderPassed) - Number(a.topic.reminderPassed) ||
            b.score - a.score ||
            b.topic.ageDays - a.topic.ageDays,
    );
    return scored.slice(0, config.maxCandidates).map(s => s.topic);
}

/** Every topic still open, with the entry it was written in. */
export async function loadTopics(now: number = Date.now()): Promise<OpenTopic[]> {
    return withDatabase(async database => {
        const rows = await database.getAllAsync<any>(
            `SELECT id, book_name, chapter_start, chapter_end,
                    study_further, study_further_reminder,
                    datetime(created_at, 'localtime') AS created_at
             FROM journal_entries
             WHERE TRIM(COALESCE(study_further, '')) != ''
               -- Marked studied: the reader has said this one is finished with.
               AND COALESCE(study_completed, 0) = 0`,
        );

        return rows
            .map(row => {
                const range =
                    row.chapter_end && row.chapter_end !== row.chapter_start
                        ? `${row.chapter_start}–${row.chapter_end}`
                        : `${row.chapter_start}`;
                const written = Date.parse(row.created_at);
                const reminder = row.study_further_reminder
                    ? Date.parse(row.study_further_reminder)
                    : NaN;

                return {
                    entryId: row.id,
                    topic: (row.study_further ?? '').trim(),
                    ageDays: Number.isFinite(written) ? Math.max(0, (now - written) / DAY_MS) : 0,
                    passage: `${row.book_name} ${range}`,
                    writtenAt: row.created_at,
                    reminderPassed: Number.isFinite(reminder) && reminder <= now,
                    // Filtered, not merely ranked down: a reminder still ahead
                    // means the reader already said when they want this back.
                    reminderPending: Number.isFinite(reminder) && reminder > now,
                };
            })
            .filter(topic => !topic.reminderPending)
            .map(({ reminderPending, ...topic }) => topic);
    });
}

/**
 * Find a topic worth handing back, and record it.
 *
 * Keyed on the entry, so one topic is offered once however many times the
 * detector runs — and a reader who says "not that one" is not asked again.
 */
export async function detectStudy(options: StudyOptions = {}): Promise<number[]> {
    const open = await loadTopics();

    // `loadTopics` already drops anything studied, emptied, or dated ahead, so
    // whatever it stops returning is exactly what should stop being queued.
    await retractObservations(
        'study',
        qualifyingTopics(open, options).map(topic => `entry:${topic.entryId}`),
    );

    const chosen = rankTopics(open, options);

    const ids: number[] = [];
    for (const topic of chosen) {
        ids.push(
            await recordObservation({
                detector: 'study',
                dedupeKey: `entry:${topic.entryId}`,
                claim: {
                    topic: topic.topic,
                    passage: topic.passage,
                    writtenAt: topic.writtenAt,
                    ageDays: Math.round(topic.ageDays),
                    reminderPassed: topic.reminderPassed,
                },
                /*
                 * Low and steady. This quotes the reader, so it cannot be wrong
                 * about its facts — confidence here only sets how much of the
                 * queue it takes against detectors that are inferring. Below
                 * commitment: a curiosity is lighter than a resolution.
                 */
                confidence: 0.4,
                evidence: [{ kind: 'entry', entryId: topic.entryId, field: 'study_further' }],
            }),
        );
    }

    return ids;
}
