/**
 * Turns a structured observation into the words a reader sees.
 *
 * Templates, not generation — every string is assembled from numbers the
 * detector already measured. The governing rule: say only what the graph can
 * prove. Detectors know which chapters were written on and how they connect,
 * never what an entry is ABOUT, so no card names a theme or characterises
 * anyone's spiritual life.
 *
 * Copy rationale: design/DECISIONS.md#observation-copy
 */

import { VerseId, formatVerseId } from '../bible/ref';
import { unwrapReferences } from '../utils/reference';
import { spanLabel } from '../ml/themeQuality';
import { StoredObservation } from './observation';
import type { AsaroAction } from '../theme/asaroRig';

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
     * What the card calls its own receipts. Undefined makes the card
     * unpressable, which is correct for a finding that inferred nothing and so
     * has no evidence worth a tap — see `renderAbsence`.
     */
    openLabel?: string;
    /**
     * Whether the subject is the card's topic (render it first, as a heading)
     * rather than its destination (hold it for last, as the payoff).
     */
    subjectFirst?: boolean;
    /** A closing remark, used only on cards with no receipts to open. */
    aside?: string;
    /**
     * Set only when the subject is scripture. Absent for detectors whose
     * subject is something the reader wrote, so the receipts don't offer a
     * "Read it" button pointing nowhere.
     */
    subjectVerseId?: VerseId;
    /** What Àṣàrò performs beside the card. Only milestones carry one. */
    face?: AsaroAction;
    /** Keep `face` on its peak, where the resting smile would contradict the line. */
    holdFace?: boolean;
}

/** Sentence-case a span: `spanLabel` speaks in fragments ("across 8 months"). */
function spanPhrase(spanDays: number): string | null {
    const label = spanLabel(spanDays);
    if (!label) return null;
    return label.replace(/^across /, 'Across ');
}

function renderConvergence(claim: Record<string, unknown>): RenderedObservation {
    const hubVerseId = Number(claim.hubVerseId);
    const passages = Array.isArray(claim.passages) ? (claim.passages as string[]) : [];
    const span = spanPhrase(Number(claim.spanDays) || 0);

    // The entry count stays out of the lead: the passages are listed directly
    // above it, so it is visible without being announced. The reach is the find.
    const claimText = span
        ? `${span}, and every one of these points at the same passage. You have never written about it.`
        : 'Every one of these points at the same passage. You have never written about it.';

    // Àṣàrò frames the find; the claim itself stays flat and checkable.
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

    // Two measured counts set side by side. Nothing is asserted about HOW the
    // reader studies — this detector sees which fields get typed into and
    // nothing else. See design/DECISIONS.md#observation-copy.
    return {
        kind: 'I have been counting',
        evidence: [],
        claim: `Out of ${total} entries, you have answered this one ${times}. If it's to ${richShort} ${richCount} times, you know how to do that one.`,
        // Quoted so it reads as the wizard's question held up, not as Àṣàrò
        // asking it of the reader right now.
        subject: `“${poorQuestion}”`,
        subjectFirst: true,
        // No receipts: this reports the reader's own counts back, which they
        // could verify by scrolling their journal. The aside is what makes the
        // card worth reading instead of merely true.
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

/** Trim a motivation to what a card can hold, on a word boundary. */
function trimQuote(text: string, limit = 180): string {
    // Unwrapped rather than stripped: a card is plain text so it cannot make a
    // citation tappable, but deleting `[[Exodus 20:12]]` outright would delete
    // the reason wherever the reference IS the reason.
    const clean = unwrapReferences(text);
    if (clean.length <= limit) return clean;
    const cut = clean.slice(0, limit);
    return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.]$/, '')}…`;
}

/** "Ruth", "Obadiah and Jonah", "2 John, 3 John and Jude". */
function listOf(names: string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** What one save reached. Rows from before grouping carry a single book or mark. */
function milestoneParts(claim: Record<string, unknown>): { books: { book: string; chapters: number }[]; mark?: number } {
    if (Array.isArray(claim.books)) {
        const books = claim.books.map((b: any) => ({ book: String(b?.book ?? ''), chapters: Number(b?.chapters) || 0 }));
        return { books, mark: claim.mark == null ? undefined : Number(claim.mark) || 0 };
    }
    if (claim.kind === 'plan') return { books: [], mark: Number(claim.mark) || 0 };
    return { books: [{ book: String(claim.book ?? ''), chapters: Number(claim.chapters) || 0 }] };
}

/** The four plan marks: alone, or on a card that also finished books. */
const PLAN_LINES: Record<number, { kind: string; alone: string; phrase: string; tail: string; face: AsaroAction }> = {
    25: { kind: 'A quarter of the plan', alone: 'Ehen. Look at you.', phrase: 'a quarter of the plan', tail: 'Ehen. Look at you.', face: 'thumbsUp' },
    50: { kind: 'Half the plan', alone: "Halfway o. I'm invested now.", phrase: 'half the plan', tail: "I'm invested now.", face: 'nod' },
    75: { kind: 'Three quarters', alone: "Don't do anything stupid.", phrase: 'three quarters of the plan', tail: "Don't do anything stupid.", face: 'sideEye' },
    100: {
        kind: 'The whole plan. Finished',
        alone: 'Àṣàrò has nothing to say. That has never happened.',
        phrase: 'the whole plan',
        tail: 'Àṣàrò has nothing to say. That has never happened.',
        face: 'sheepish',
    },
};

/** "Finished", "Both finished", "All three finished" — the heading already names them. */
function finishedWord(count: number): string {
    if (count <= 1) return 'Finished';
    if (count === 2) return 'Both finished';
    return `All ${countWord(count)} finished`;
}

/**
 * Everything one save reached — books finished, a quarter of the plan crossed
 * — as one card. The plan mark leads when there is one: four in the whole plan
 * against sixty-six books. The heading names what was reached, so the line
 * never repeats it. Must not congratulate anyone on their standing with
 * Jehovah, and must not use the cheer register. See design/ASARO-CHARACTER.md §4①, §5.
 */
function renderMilestone(claim: Record<string, unknown>): RenderedObservation {
    const { books, mark } = milestoneParts(claim);
    const names = listOf(books.map(b => b.book));

    if (mark !== undefined) {
        const line = PLAN_LINES[mark] ?? {
            kind: 'The plan', alone: `${mark}% done.`, phrase: `${mark}% of the plan`, tail: '', face: 'nod' as const,
        };
        return {
            kind: line.kind,
            evidence: [],
            claim: books.length
                ? `${finishedWord(books.length)}. And ${line.phrase} with it. ${line.tail}`.trim()
                : line.alone,
            subject: books.length ? `${names} · ${mark}%` : `${mark}%`,
            subjectFirst: true,
            face: line.face,
            holdFace: line.face === 'sideEye',
        };
    }

    if (books.length > 1) {
        return {
            kind: `You finished ${countWord(books.length)} books`,
            evidence: [],
            claim: books.length === 2
                ? 'Both of them, in one sitting.'
                : `${capitalise(countWord(books.length))} books in one sitting.`,
            subject: names,
            subjectFirst: true,
            face: 'celebrate',
        };
    }

    const { book, chapters } = books[0] ?? { book: '', chapters: 0 };
    // Fifty chapters of Genesis is not four of Ruth; one sentence for both
    // would make the praise mean nothing.
    const long = chapters >= 25;

    return {
        kind: 'You finished a book',
        evidence: [],
        claim: long
            ? `${chapters} chapters. ${chapters}. I was here for all of them.`
            : `All ${chapters} chapters of it. I was counting, obviously.`,
        subject: book,
        subjectFirst: true,
        face: long ? 'celebrate' : 'smug',
    };
}

/**
 * A question the reader wrote down and has not come back to. Nothing here may
 * imply they owe anybody anything — it is a returned interest, not a debt
 * notice, which is why the passage leads and the age sits inside the sentence.
 */
function renderStudy(claim: Record<string, unknown>): RenderedObservation {
    const topic = String(claim.topic ?? '');
    const passage = String(claim.passage ?? '');
    const ago = agoPhrase(Number(claim.ageDays) || 0).toLowerCase();

    // A reminder they set and that has since passed is a different fact: they
    // named a day for it, so the card repeats their own decision back.
    const named = claim.reminderPassed === true;

    return {
        kind: 'You wanted to look into this',
        evidence: passage ? [passage] : [],
        claim: named
            ? `You set a time for this one and it went by. You wrote it ${ago}${passage ? `, while you read ${passage}` : ''}.`
            : `You wrote this down ${ago}${passage ? `, while you read ${passage}` : ''}.`,
        subject: trimQuote(topic),
        subjectFirst: true,
        openLabel: 'Open that entry',
    };
}

function renderCommitment(claim: Record<string, unknown>): RenderedObservation {
    const action = String(claim.action ?? '');
    const motivation = String(claim.motivation ?? '');
    const passage = String(claim.passage ?? '');
    const ago = agoPhrase(Number(claim.ageDays) || 0);

    // Present tense, no verdict. These are standing commitments about character
    // ("I will be kinder to my parents"), not tasks anyone completes, so
    // framing one as overdue would invent a failure. The reason is what fades,
    // so the quote is the payload and the commitment lands last.
    return {
        kind: 'Something you are working on',
        evidence: passage ? [passage] : [],
        claim: `You wrote this down ${ago.toLowerCase()}, and gave a reason: “${trimQuote(motivation)}”`,
        subject: action,
        // The why is already on the card in the reader's own words; the tap
        // opens the full reason and the entry it came from.
        openLabel: 'See the entry',
    };
}

/**
 * Render an observation, or null if this build has no words for its detector —
 * the case when a newer build wrote an observation an older one is reading.
 * Silence beats a fallback like "Something was noticed".
 */
export function renderObservation(observation: StoredObservation): RenderedObservation | null {
    switch (observation.detector) {
        case 'convergence':
            return renderConvergence(observation.claim);
        case 'commitment':
            return renderCommitment(observation.claim);
        case 'milestone':
            return renderMilestone(observation.claim);
        case 'study':
            return renderStudy(observation.claim);
        case 'absence':
            return renderAbsence(observation.claim);
        default:
            return null;
    }
}
