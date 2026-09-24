/**
 * The question you answer least.
 *
 * Negative space, which nobody sees about themselves because nobody counts
 * what they did not do. The entry wizard asks four things and stores each in
 * its own column, so "how often does this reader answer each one" is a
 * straight count of data the app already has. No model, no graph, every device.
 *
 * ---
 *
 * The trap this detector was nearly built on top of, recorded because it would
 * have shipped a false finding to every reader on earth:
 *
 * `reflection_3` — "How can I realistically apply this in my life?" — is
 * hardcoded to '' on every save (`app/addEntry.tsx`, the `reflections` array).
 * The wizard replaced that question with the action-items step, so the action
 * items ARE the answer to it and the column can never fill again. Counting
 * columns alone would have found a question answered zero times out of every
 * recent entry, for everybody, and announced it. Hence `answeredApply` below:
 * the apply channel reads the action items, and the old column only so that
 * entries written before the change still count.
 *
 * The general rule that falls out of it, and the reason for `minPoorest`: a
 * question nobody has EVER answered is far more likely to be a fact about the
 * app than about the reader. A question answered a handful of times proves the
 * reader can reach it and knows it is there, and chooses it rarely anyway.
 * That second thing is provable; the first is a guess about a form.
 *
 * ---
 *
 * What the card may say is bounded by the same rule as every other detector:
 * say only what the data can prove. This one counts *writing*, not living.
 * Somebody may help others constantly and never journal about it, so the claim
 * is a pair of counts about entries and nothing else — never a shortfall,
 * never a should. The counts are checkable against the reader's own list,
 * which is the whole difference between this and a horoscope.
 */

import { withDatabase } from '../../data/db';
import { recordObservation, retractObservations } from '../observation';

/** One of the wizard's four questions, as something countable. */
export interface Channel {
    key: 'jehovah' | 'message' | 'apply' | 'others';
    question: string;
}

export const CHANNELS: Channel[] = [
    { key: 'jehovah', question: 'What does this tell me about Jehovah?' },
    {
        key: 'message',
        question: "How does this section of the Scriptures contribute to the Bible's message?",
    },
    { key: 'apply', question: 'How can I realistically apply this in my life?' },
    { key: 'others', question: 'How can I use these verses to help others?' },
];

const QUESTION_OF: Record<Channel['key'], string> = CHANNELS.reduce(
    (map, channel) => ({ ...map, [channel.key]: channel.question }),
    {} as Record<Channel['key'], string>,
);

/** One entry, reduced to which of the four it answered. */
export interface AbsenceEntry {
    entryId: number;
    createdAt: string;
    answered: Channel['key'][];
}

export interface AbsenceConfig {
    /** Below this the journal is too short for a ratio to mean anything. */
    minEntries: number;
    /** The busiest question must be genuinely busy, or there is no contrast. */
    minRichest: number;
    /** Answered less than this share of the richest to count as neglected. */
    maxRatio: number;
    /** Never fire on a question with no answers at all — see the header. */
    minPoorest: number;
    /** How many receipt entries to carry. */
    evidenceLimit: number;
}

export const DEFAULT_ABSENCE_CONFIG: AbsenceConfig = {
    minEntries: 12,
    minRichest: 10,
    maxRatio: 1 / 3,
    minPoorest: 1,
    evidenceLimit: 8,
};

export interface AbsenceCandidate {
    richKey: Channel['key'];
    richQuestion: string;
    richCount: number;
    poorKey: Channel['key'];
    poorQuestion: string;
    poorCount: number;
    totalEntries: number;
    /** Entries that DID answer the neglected question, oldest first. */
    entryIds: number[];
}

/** How often each question was answered. */
export function countChannels(entries: AbsenceEntry[]): Record<Channel['key'], number> {
    const counts = { jehovah: 0, message: 0, apply: 0, others: 0 };
    for (const entry of entries) {
        for (const key of entry.answered) counts[key] += 1;
    }
    return counts;
}

/**
 * The single widest gap, or null if the journal has nothing to say yet.
 *
 * One candidate rather than every pair below the threshold. Three cards each
 * naming a question the reader skips is a performance review, and the point of
 * the finding is that it is a surprise, which only the widest gap is.
 */
export function rankAbsence(
    entries: AbsenceEntry[],
    config: AbsenceConfig = DEFAULT_ABSENCE_CONFIG,
): AbsenceCandidate | null {
    if (entries.length < config.minEntries) return null;

    const counts = countChannels(entries);
    const keys = CHANNELS.map(channel => channel.key);

    const richKey = keys.reduce((best, key) => (counts[key] > counts[best] ? key : best), keys[0]);
    const richCount = counts[richKey];
    if (richCount < config.minRichest) return null;

    /*
     * Never-answered questions are excluded from the contest, not treated as
     * the winner of it.
     *
     * An earlier version took the lowest count outright and then rejected the
     * whole journal when that count was zero — so a reader with one unreachable
     * question (which, before the apply channel was fixed, was everybody) got
     * silence forever, including about the real gap sitting one place above it.
     * Dropping a channel has to mean dropping the channel.
     */
    const eligible = keys.filter(key => counts[key] >= config.minPoorest);
    if (eligible.length === 0) return null;

    const poorKey = eligible.reduce(
        (worst, key) => (counts[key] < counts[worst] ? key : worst),
        eligible[0],
    );
    if (richKey === poorKey) return null;

    const poorCount = counts[poorKey];
    if (poorCount / richCount >= config.maxRatio) return null;

    /*
     * Receipts are the times they DID answer it — the rare ones. The claim is
     * "this happened N times", so the proof is those N entries, and handing
     * back the exceptions reads as a record rather than a reprimand.
     */
    const entryIds = entries
        .filter(entry => entry.answered.includes(poorKey))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, config.evidenceLimit)
        .map(entry => entry.entryId);

    return {
        richKey,
        richQuestion: QUESTION_OF[richKey],
        richCount,
        poorKey,
        poorQuestion: QUESTION_OF[poorKey],
        poorCount,
        totalEntries: entries.length,
        entryIds,
    };
}

/** Non-empty after trimming. */
function answeredField(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * The apply question, which is not a column.
 *
 * Action items first, because that is where the answer has lived since the
 * wizard changed. The old column is still read so entries written before the
 * change are not retroactively counted as skipped — a reader should not watch
 * their own history change because the form did.
 */
function answeredApply(reflection3: unknown, actionCount: number): boolean {
    return actionCount > 0 || answeredField(reflection3);
}

export async function loadAbsenceEntries(limit = 500): Promise<AbsenceEntry[]> {
    return withDatabase(async database => {
        const rows = await database.getAllAsync<any>(
            `SELECT e.id,
                    datetime(e.created_at, 'localtime') AS created_at,
                    e.reflection_1, e.reflection_2, e.reflection_3, e.reflection_4,
                    (SELECT COUNT(*) FROM action_items a WHERE a.entry_id = e.id) AS action_count
             FROM journal_entries e
             ORDER BY e.created_at DESC
             LIMIT ?`,
            [limit],
        );

        return rows.map(row => {
            const answered: Channel['key'][] = [];
            if (answeredField(row.reflection_1)) answered.push('jehovah');
            if (answeredField(row.reflection_2)) answered.push('message');
            if (answeredApply(row.reflection_3, Number(row.action_count) || 0)) answered.push('apply');
            if (answeredField(row.reflection_4)) answered.push('others');
            return { entryId: row.id, createdAt: row.created_at, answered };
        });
    });
}

export interface AbsenceOptions {
    config?: AbsenceConfig;
}

/**
 * Find the widest gap and record it. Returns the observation ids.
 *
 * Retraction matters more here than for any other detector. A convergence is
 * true forever — those entries do point at that verse. This claim is a running
 * count, and a reader who takes the hint and starts answering the question
 * makes it false. Leaving it standing would have the app insisting on a
 * shortfall the reader has already closed, which is the one outcome that would
 * make the whole surface untrustworthy.
 */
export async function detectAbsence(options: AbsenceOptions = {}): Promise<number[]> {
    const config = options.config ?? DEFAULT_ABSENCE_CONFIG;
    const entries = await loadAbsenceEntries();
    const candidate = rankAbsence(entries, config);

    if (!candidate) {
        await retractObservations('absence', []);
        return [];
    }

    const dedupeKey = `${candidate.poorKey}:${candidate.richKey}`;
    await retractObservations('absence', [dedupeKey]);

    const id = await recordObservation({
        detector: 'absence',
        dedupeKey,
        claim: {
            richQuestion: candidate.richQuestion,
            richCount: candidate.richCount,
            poorQuestion: candidate.poorQuestion,
            poorCount: candidate.poorCount,
            totalEntries: candidate.totalEntries,
        },
        /*
         * How lopsided it is, not how sure we are it happened — the counts are
         * certain. A 1:10 gap is a louder finding than a 3:10 one, and the
         * ranker should be able to tell them apart.
         */
        confidence: Math.min(1, 1 - candidate.poorCount / candidate.richCount),
        evidence: candidate.entryIds.map(entryId => ({ kind: 'entry' as const, entryId })),
    });

    return [id];
}
