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
import { unwrapReferences } from '../utils/reference';
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
     * What the card calls its own receipts, or absent when it has none to show.
     *
     * "Show me why" asks a finding to justify itself, which only makes sense
     * where it inferred something. A card that quotes the reader back has
     * nothing to justify, so it names what is actually behind the tap instead.
     * Kept here with the rest of the words rather than in the card, which
     * should not have to know one detector from another.
     *
     * Undefined makes the card unpressable, which is the honest state for a
     * finding whose evidence would tell the reader nothing they did not
     * already have — see `renderAbsence`.
     */
    openLabel?: string;
    /**
     * Whether the subject is the card's topic rather than its destination.
     *
     * Convergence keeps its subject for last because that verse is somewhere
     * the reader is being SENT — the card is an argument and the passage is
     * its payoff, so arriving at it early would give away the ending.
     *
     * Absence has no destination. Its subject is what the card is ABOUT, and a
     * topic belongs at the top like a heading. The claim then says "this one"
     * about something already on screen instead of something three lines
     * further down, which is the difference between a sentence that resolves
     * as you read it and one that asks you to hold a pronoun open.
     */
    subjectFirst?: boolean;
    /**
     * A closing remark, where a card with no receipts would have had a button.
     *
     * Only for findings that cannot be opened. It is the one line on such a
     * card that is neither a measurement nor a subject, so it is where Àṣàrò
     * gets to speak — and on a card the reader cannot tap, it is the whole
     * reason the card is worth reading rather than just true.
     */
    aside?: string;
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

    /*
     * Àṣàrò frames it; he does not make the claim.
     *
     * The rule at the top of this file — say only what the graph can prove —
     * applies to `claim` and nothing else, so that sentence stays flat and
     * checkable. The label and the button are not assertions, and they are
     * the one place on this card where the app is allowed to be pleased with
     * itself, which is the whole point of the feature.
     *
     * It is also the register he has never been given. Every line he owns
     * today is pressure — "I'm keeping absolute record. Every single day you
     * miss, I'm writing it down." That is exactly what this detector did, for
     * ten months, and here it paid off. Same nosy man, same receipts, finally
     * delighted rather than disappointed.
     */
    return {
        kind: 'Look what I found',
        evidence: passages,
        claim: claimText,
        subject: formatVerseId(hubVerseId),
        subjectVerseId: hubVerseId,
        openLabel: 'Let me show you',
    };
}

function renderAbsence(claim: Record<string, unknown>): RenderedObservation {
    const poorQuestion = String(claim.poorQuestion ?? '');
    const richShort = String(claim.richShort ?? '');
    const poorCount = Number(claim.poorCount) || 0;
    const richCount = Number(claim.richCount) || 0;
    const total = Number(claim.totalEntries) || 0;
    const times = poorCount === 1 ? 'just once' : `just ${poorCount} times`;

    /*
     * Two counts, a total, and no inference at all.
     *
     * "If it's to X, you will Y" is the construction Àṣàrò would actually
     * reach for, and it happens to be the safest thing on the card: it is the
     * two measured numbers set side by side, carrying attitude purely through
     * word order. Nothing is added to what was counted.
     *
     * The second number keeps its unit and its verb. An earlier draft ended
     * "— 38", where the dash stood in for both and left the figure to fend
     * for itself; a reader who has not already worked out what is being
     * counted has no way in.
     *
     * Note where the personality sits: inside the claim, not only around it.
     * The rule elsewhere in this file is that Àṣàrò frames a finding and does
     * not make it, and that is the right rule for convergence, whose sentence
     * asserts a connection. It was too strong here. The real constraint is
     * that nothing may be asserted which the data does not show, and "you
     * know how to do that one" is backed by the very number it sits next to.
     * Keeping him out of the sentence was a proxy for the constraint, not the
     * constraint itself.
     *
     * What is deliberately NOT here is any claim about how the reader studies.
     * A draft asked "are you sure you are reading your Bible well?", which is
     * the one sentence this data cannot support — the detector knows which
     * text fields get typed into, and nothing whatsoever about the quality of
     * anyone's reading. Somebody can study deeply and never use that field.
     * Asserting the link would be the horoscope failure this whole surface is
     * built to avoid, and the rule at the top of this file forbids it outright.
     */
    return {
        /*
         * His record-keeping, finally useful. "I'm keeping absolute record.
         * Every single day you miss, I'm writing it down" is a threat in a
         * notification and a straight description of this detector here.
         */
        kind: 'I have been counting',
        evidence: [],
        claim: `Out of ${total} entries, you have answered this one ${times}. If it's to ${richShort} ${richCount} times, you know how to do that one.`,
        /*
         * Quoted, unlike every other subject in this file.
         *
         * A convergence's subject is a verse reference and a commitment's is
         * the reader's own sentence; neither can be mistaken for the app
         * speaking. This one is a QUESTION, on a card where a character is
         * doing all the talking — left bare it reads as Àṣàrò asking it of
         * you right now, rather than as the question you keep stepping over.
         * The quotes mark it as borrowed: the wizard's words, held up.
         */
        subject: `\u201c${poorQuestion}\u201d`,
        subjectFirst: true,
        /*
         * No receipts, and so nothing to tap.
         *
         * Convergence opens because it INFERRED something — that these entries
         * point at that passage — and the entries are what stop it being a
         * horoscope. This card infers nothing. It reports two counts of the
         * reader's own writing, which they could check by scrolling their own
         * journal, so sending them through to nine old entries would be
         * proving something nobody disputes and charging a tap for it.
         *
         * Which leaves the card to be worth reading on its own, and that is
         * what the aside is for.
         *
         * It is the innocent face after the tease, which is the shape of every
         * other thing he says — "But remember I care, that's why I disturb",
         * "No lecture from me". A second joke here would be piling on; this
         * lands the first one and then steps back.
         *
         * "Just saying" is the phrase everybody understands to mean the exact
         * opposite, which is why it works: the disclaimer and the point are
         * the same sentence, and nobody is fooled, least of all him. Naming
         * judgement outright is also the plainest possible statement of the
         * rule this detector runs on — it counts, it does not appraise.
         *
         * Contracted, because he contracts everywhere else. "I am not judging"
         * is a shade stiff for a man who says "I'm keeping absolute record".
         *
         * It also does work no flat sentence can. The rule for this detector
         * is state the record, never the judgement — but a reader looking at 9
         * against 38 will supply a judgement whether or not the app does, and
         * a card that simply goes quiet leaves them to convict themselves. Him
         * declining out loud is the difference between an observation and a
         * telling-off.
         */
        aside: "I'm not judging o, just saying.",
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
    /*
     * Unwrapped, not stripped. A card is plain text so it cannot make a
     * citation tappable — but showing `[[Exodus 20:12]]` puts markup in front
     * of the reader, and removing it outright would delete the reason where
     * the reference IS the reason. Keeping the words and losing the brackets
     * is the only reading that serves both.
     */
    const clean = unwrapReferences(text);
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
        /*
         * Not "show me why" — the why is already on the card, in the reader's
         * own words. What the tap actually opens is the whole reason
         * untruncated and the entry it was written in, so it says that.
         *
         * And no Àṣàrò here, unlike the convergence card above. That one is
         * his find and he can be pleased about it; this one is the reader's
         * own sentence about the kind of person they are trying to be, handed
         * back. Putting a performer in front of that would make it his moment
         * instead of theirs.
         */
        openLabel: 'See the entry',
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
        case 'absence':
            return renderAbsence(observation.claim);
        default:
            return null;
    }
}
