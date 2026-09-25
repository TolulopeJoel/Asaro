/**
 * Something you said you would look into.
 *
 * `journal_entries.study_further` is written during the entry flow and then,
 * unless the writer also set a date, is never seen again — it lives two taps
 * deep in the Library under Topics and nothing ever brings it up. That is the
 * same shape of problem the rest of this substrate exists for: the reader
 * produces something and the app keeps it rather than giving it back.
 *
 * What it is NOT is a list of things owed. A study topic is a question
 * somebody found interesting enough to write down mid-reflection, and the
 * useful thing about it is that curiosity fades faster than the note does.
 * Handing one back months later is returning an interest, not chasing a task
 * — so the framing is what they wondered, never what they failed to do, and
 * exactly one is offered at a time. A queue of them would be a debt counter,
 * which is the one thing this must never become.
 *
 * Two courtesy filters keep it honest. A topic already marked studied is
 * finished with. And a topic whose reminder is still in the FUTURE has a plan
 * attached — the reader has already told the app when they want it back, and
 * pre-empting that is both rude and redundant.
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
     * How long a topic must sit before it is worth handing back.
     *
     * Three weeks. Shorter than `commitment`'s eight, deliberately: a standing
     * commitment about character is still in mind months later, whereas a
     * question you meant to look into has usually slipped within a fortnight.
     * The floor exists only to guarantee the app never reads somebody their
     * own sentence back at them minutes after they wrote it.
     */
    minAgeDays?: number;
    /**
     * Minimum length, after citations are stripped.
     *
     * Measured on the prose, not the markup — same rule as `commitment`. A
     * topic that is only `[[Romans 5:12]]` is a bookmark, not a question, and
     * handing it back tells the reader nothing they could not see already.
     */
    minChars?: number;
    /**
     * The same floor, for a topic whose reminder has already passed.
     *
     * Much lower, because naming a date changes what the shortness means. An
     * eight-word note nobody ever dated is probably a scribble; the same note
     * with a day attached is somebody who meant it and then missed it. The
     * length gate exists to filter scribbles, and a date is better evidence
     * than length that this was not one.
     *
     * Not zero. An empty topic still has nothing to hand back, whatever the
     * reader intended.
     */
    minCharsIfDated?: number;
    /**
     * One. Never more.
     *
     * Two study topics side by side stop reading as "here is something you
     * were curious about" and start reading as a backlog — and a backlog of
     * things you promised to study, shown every time you save, is a debt
     * counter. The detector may hold many; the reader is offered one.
     */
    maxCandidates?: number;
}

const DEFAULTS: Required<StudyOptions> = {
    minAgeDays: 21,
    minChars: 25,
    minCharsIfDated: 10,
    maxCandidates: 1,
};

/**
 * Everything still open, before any of it is ranked.
 *
 * Separate from `rankTopics` because retraction needs the whole qualifying
 * set: a detector that records only its best would otherwise withdraw the
 * runner-up on every run and rediscover it on the next.
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

    /*
     * Scored the way commitments are: length carries it, because how much
     * somebody bothered to write is what marks a question as having mattered,
     * and age enters logarithmically as a tilt rather than as the driver.
     * Ranking by age alone would hand the oldest topic the slot for ever and
     * the reader would never see a second one.
     */
    const scored = qualifying.map(topic => ({
        topic,
        score:
            (Math.min(stripReferences(topic.topic).trim().length, 240) / 240) *
            Math.log2(1 + topic.ageDays / 7),
    }));

    /*
     * A passed reminder sorts ahead of everything, as its own key rather than
     * as a bonus added to the score. It was a bonus first, and that quietly
     * did not work: the length-times-age term is unbounded in practice — a
     * four-hundred-day-old topic scores near six — so any fixed bonus is
     * swamped by exactly the old, long topics it was meant to outrank.
     *
     * And it should outrank them. The reader naming a day and the day going
     * by is the only intention in this data stated outright rather than
     * inferred, so it is not one signal among several; it is the signal.
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
                    /*
                     * A reminder still ahead means the reader has already said
                     * when they want this back. Pre-empting their own plan is
                     * both redundant and presumptuous, so it is filtered here
                     * rather than merely ranked down.
                     */
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

    /*
     * `loadTopics` already drops anything marked studied, emptied, or given a
     * future date — so whatever it no longer returns is exactly what should no
     * longer be queued. Without this a topic the reader ticked off went on
     * waiting to be offered, because detectors only ever wrote and nothing
     * withdrew.
     */
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
                 * Low and steady. Like `commitment`, this cannot be wrong
                 * about its facts — it is quoting the reader — so confidence
                 * is not measuring truth, only how much of the queue it should
                 * take against detectors that are inferring something. It sits
                 * below commitment because a passing curiosity is a lighter
                 * thing than a standing resolution.
                 */
                confidence: 0.4,
                evidence: [{ kind: 'entry', entryId: topic.entryId, field: 'study_further' }],
            }),
        );
    }

    return ids;
}
