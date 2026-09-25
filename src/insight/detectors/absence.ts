/**
 * The question you answer least — a straight count over the wizard's four
 * reflection channels. No model, no graph, every device.
 *
 * IMPORTANT: `reflection_3` is hardcoded to '' on every save
 * (app/addEntry.tsx:243). The action-items step replaced that question, so the
 * action items ARE its answer and the column can never fill again — which is
 * why `answeredApply` reads action items first and the column only for entries
 * written before the change.
 *
 * This counts writing, not living: the claim is a pair of counts about entries
 * and nothing else, never a shortfall and never a should.
 *
 * Gates and the never-answered trap: design/DETECTORS.md#absence
 */

import { withDatabase } from '../../data/db';
import { recordObservation, retractObservations } from '../observation';

/** One of the wizard's four questions, as something countable. */
export interface Channel {
    key: 'jehovah' | 'message' | 'apply' | 'others';
    question: string;
    /**
     * The question as a verb phrase, for naming it mid-sentence — what someone
     * would call it describing it to a friend. Quoting the full question inside
     * the claim would bury it in ninety characters of someone else's wording.
     */
    short: string;
}

export const CHANNELS: Channel[] = [
    {
        key: 'jehovah',
        question: 'What does this tell me about Jehovah?',
        short: 'talk about Jehovah',
    },
    {
        key: 'message',
        question: "How does this section of the Scriptures contribute to the Bible's message?",
        short: "say how it fits the Bible's message",
    },
    {
        key: 'apply',
        question: 'How can I realistically apply this in my life?',
        short: 'say how you will apply it',
    },
    {
        key: 'others',
        question: 'How can I use these verses to help others?',
        short: 'say how it could help others',
    },
];

const QUESTION_OF: Record<Channel['key'], string> = CHANNELS.reduce(
    (map, channel) => ({ ...map, [channel.key]: channel.question }),
    {} as Record<Channel['key'], string>,
);

const SHORT_OF: Record<Channel['key'], string> = CHANNELS.reduce(
    (map, channel) => ({ ...map, [channel.key]: channel.short }),
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
 * Why the detector did or did not fire. A detector that declines looks exactly
 * like one that is broken (reading the wrong column, say), so the reason is a
 * first-class result. `rankAbsence` reads this, so the two cannot disagree.
 */
export interface AbsenceDiagnosis {
    total: number;
    counts: Record<Channel['key'], number>;
    richKey: Channel['key'] | null;
    richCount: number;
    poorKey: Channel['key'] | null;
    poorCount: number;
    ratio: number | null;
    /** Null when a candidate stands; otherwise the gate that stopped it. */
    blocked: string | null;
}

export function diagnoseAbsence(
    entries: AbsenceEntry[],
    config: AbsenceConfig = DEFAULT_ABSENCE_CONFIG,
): AbsenceDiagnosis {
    const counts = countChannels(entries);
    const base: AbsenceDiagnosis = {
        total: entries.length,
        counts,
        richKey: null,
        richCount: 0,
        poorKey: null,
        poorCount: 0,
        ratio: null,
        blocked: null,
    };

    if (entries.length < config.minEntries) {
        return { ...base, blocked: `too few entries: ${entries.length} < ${config.minEntries}` };
    }

    const keys = CHANNELS.map(channel => channel.key);
    const richKey = keys.reduce((best, key) => (counts[key] > counts[best] ? key : best), keys[0]);
    const richCount = counts[richKey];
    if (richCount < config.minRichest) {
        return {
            ...base,
            richKey,
            richCount,
            blocked: `busiest question too quiet: ${richKey} ${richCount} < ${config.minRichest}`,
        };
    }

    // Never-answered questions are excluded from the contest, not treated as
    // its winner — otherwise one unreachable question silences the detector
    // about the real gap sitting one place above it.
    const eligible = keys.filter(key => counts[key] >= config.minPoorest);
    if (eligible.length === 0) {
        return { ...base, richKey, richCount, blocked: 'no question answered even once' };
    }

    const poorKey = eligible.reduce(
        (worst, key) => (counts[key] < counts[worst] ? key : worst),
        eligible[0],
    );
    const poorCount = counts[poorKey];
    if (richKey === poorKey) {
        return {
            ...base,
            richKey,
            richCount,
            poorKey,
            poorCount,
            blocked: 'only one question has any answers',
        };
    }

    const ratio = poorCount / richCount;
    const full = { ...base, richKey, richCount, poorKey, poorCount, ratio };
    if (ratio >= config.maxRatio) {
        return {
            ...full,
            blocked: `gap too narrow: ${poorCount}/${richCount} = ${ratio.toFixed(2)} >= ${config.maxRatio.toFixed(2)}`,
        };
    }

    return full;
}

/**
 * The single widest gap, or null if the journal has nothing to say yet. One
 * candidate, not every pair below the threshold: three cards naming questions
 * the reader skips is a performance review.
 */
export function rankAbsence(
    entries: AbsenceEntry[],
    config: AbsenceConfig = DEFAULT_ABSENCE_CONFIG,
): AbsenceCandidate | null {
    const d = diagnoseAbsence(entries, config);
    if (d.blocked !== null || d.richKey === null || d.poorKey === null) return null;

    const poorKey = d.poorKey;

    // Receipts are the times they DID answer it. The claim is "this happened N
    // times", so those N entries are the proof, and handing back the exceptions
    // reads as a record rather than a reprimand.
    const entryIds = entries
        .filter(entry => entry.answered.includes(poorKey))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, config.evidenceLimit)
        .map(entry => entry.entryId);

    return {
        richKey: d.richKey,
        richQuestion: QUESTION_OF[d.richKey],
        richCount: d.richCount,
        poorKey,
        poorQuestion: QUESTION_OF[poorKey],
        poorCount: d.poorCount,
        totalEntries: d.total,
        entryIds,
    };
}

/** Non-empty after trimming. */
function answeredField(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * The apply question, which is not a column — see the header. Action items are
 * where the answer lives; the old column is still read so older entries are not
 * retroactively counted as skipped.
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
 * Retraction matters more here than anywhere else: this claim is a running
 * count, so a reader who takes the hint makes it false. Leaving it standing
 * would insist on a shortfall they have already closed.
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
            richShort: SHORT_OF[candidate.richKey],
            richCount: candidate.richCount,
            poorQuestion: candidate.poorQuestion,
            poorCount: candidate.poorCount,
            totalEntries: candidate.totalEntries,
        },
        // How lopsided it is, not how sure we are — the counts are certain.
        // A 1:10 gap is a louder finding than a 3:10 one.
        confidence: Math.min(1, 1 - candidate.poorCount / candidate.richCount),
        evidence: candidate.entryIds.map(entryId => ({ kind: 'entry' as const, entryId })),
    });

    return [id];
}
