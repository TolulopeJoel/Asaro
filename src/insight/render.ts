/**
 * Turning a structured observation into the words a reader sees.
 *
 * Kept out of the detectors on purpose. A detector's job ends at a claim with
 * evidence; how that claim is phrased is a separate problem with separate
 * failure modes, and folding the two together is how you end up unable to
 * improve the wording without re-deriving the finding.
 *
 * Templates, not generation. The plan reserves an on-device model for Tier 3
 * and even there it may only render a record it cannot contradict — so this is
 * where the sentences live now and where a model would have to earn its way in
 * later, behind an entailment check. Nothing here invents a fact: every string
 * is assembled from numbers the detector measured.
 *
 * The rule that shapes all the copy: say only what the graph can prove. The
 * detector does not know what the reader's entries are ABOUT — it knows which
 * chapters they wrote on, which verses they cited, and how those connect. So
 * the card never names a theme, never says "you keep writing about X", and
 * never characterises anyone's spiritual life. It says: these passages, this
 * long, all pointing here, and you have not been here. Each of those is
 * checkable against public data, which is the only thing separating this from
 * a horoscope that happens to be about you.
 */

import { VerseId, formatVerseId } from '../bible/ref';
import { spanLabel } from '../ml/themeQuality';
import { StoredObservation } from './observation';

export interface RenderedObservation {
    /** What kind of noticing this is. Sits where Flashback puts "ONE MONTH AGO". */
    kind: string;
    /** The passages it rests on, oldest first. Shown, not counted. */
    evidence: string[];
    /** The claim, in one or two sentences. */
    claim: string;
    /** What the card lands on — a passage, or the reader's own resolution. */
    subject: string;
    /**
     * Only when the subject is scripture.
     *
     * Absent for detectors whose subject is something the reader wrote, which
     * is what stops the receipts offering a "Read it" button pointing nowhere.
     */
    subjectVerseId?: VerseId;
}

/**
 * Sentence-case a span.
 *
 * `spanLabel` speaks in fragments — "across 8 months" — because it was written
 * for a meta line. Reused rather than reimplemented: the codebase already
 * learned that the list and the detail view drifting into two vocabularies for
 * one fact is its own kind of bug.
 */
function spanPhrase(spanDays: number): string | null {
    const label = spanLabel(spanDays);
    if (!label) return null;
    return label.replace(/^across /, 'Across ');
}

function renderConvergence(claim: Record<string, unknown>): RenderedObservation {
    const hubVerseId = Number(claim.hubVerseId);
    const passages = Array.isArray(claim.passages) ? (claim.passages as string[]) : [];
    const span = spanPhrase(Number(claim.spanDays) || 0);

    /*
     * The count is deliberately absent from the lead.
     *
     * "Four entries" is the least interesting true thing here — it is a fact
     * about the computation, not about the reader, and themeQuality.ts already
     * recorded that lesson for themes. The passages are listed above this
     * sentence, so the count is visible without being announced; what earns
     * the words is the reach between them.
     */
    const claimText = span
        ? `${span}, and every one of these points at the same passage. You have never written about it.`
        : 'Every one of these points at the same passage. You have never written about it.';

    return {
        kind: 'Where your entries point',
        evidence: passages,
        claim: claimText,
        subject: formatVerseId(hubVerseId),
        subjectVerseId: hubVerseId,
    };
}

/** "Five months ago", "Eleven weeks ago" — how long since they wrote it. */
function agoPhrase(ageDays: number): string {
    const months = ageDays / 30.4;
    if (months < 2) {
        const weeks = Math.max(1, Math.round(ageDays / 7));
        return `${weeks === 1 ? 'A week' : `${weeks} weeks`} ago`;
    }
    if (months < 12) return `${Math.round(months)} months ago`;
    const years = months / 12;
    return years < 2 ? 'A year ago' : `${Math.round(years)} years ago`;
}

/**
 * Trim a motivation to what a card can hold, on a word boundary.
 *
 * The whole thing is in the receipts. Cutting mid-word would make the reader's
 * own sentence look careless, which is the opposite of the effect wanted when
 * handing it back to them.
 */
function trimQuote(text: string, limit = 180): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= limit) return clean;
    const cut = clean.slice(0, limit);
    return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.]$/, '')}…`;
}

function renderCommitment(claim: Record<string, unknown>): RenderedObservation {
    const action = String(claim.action ?? '');
    const motivation = String(claim.motivation ?? '');
    const passage = String(claim.passage ?? '');
    const ago = agoPhrase(Number(claim.ageDays) || 0);

    /*
     * Present tense, and no verdict.
     *
     * An action item here is not a task someone failed to tick — it is a
     * standing commitment about character: "I will be kinder to my parents",
     * "I want to give Jehovah my best". Nobody completes those, so framing one
     * as overdue would be inventing a failure out of a checkbox the writer was
     * never really using.
     *
     * Age earns its place for a different reason. The resolution is the part
     * people remember; the reason behind it is the part that fades. So the
     * quote is the payload, the time is why it is worth repeating now, and the
     * commitment itself lands last — handed back, not chased up.
     */
    return {
        kind: 'Something you are working on',
        evidence: passage ? [passage] : [],
        claim: `You wrote this down ${ago.toLowerCase()}, and gave a reason: \u201c${trimQuote(motivation)}\u201d`,
        subject: action,
    };
}

/**
 * Render an observation, or null if this build has no words for its detector.
 *
 * Null rather than a fallback string: a card that cannot say what it found
 * should not appear at all. An observation written by a newer build and read
 * by an older one is the case this protects against, and "Something was
 * noticed" is worse than silence.
 */
export function renderObservation(observation: StoredObservation): RenderedObservation | null {
    switch (observation.detector) {
        case 'convergence':
            return renderConvergence(observation.claim);
        case 'commitment':
            return renderCommitment(observation.claim);
        default:
            return null;
    }
}
