/**
 * The practice entry the chosen sibling walks a new user through. Nothing in it
 * is ever saved: see `practice` in app/addEntry.tsx. The passage is Reading 1.
 */
import type { AsaroAction } from '../theme/asaroRig';
import type { ReflectionAnswers } from '../components/ReflectionForm';
import type { PickerPhase } from '../components/BibleReferencePicker';

export const PRACTICE_BOOK = 'Genesis';
export const PRACTICE_CHAPTERS = { start: 1, end: 3 };

/** Typed in, letter by letter, when a page opens empty. */
export const PRACTICE_ANSWERS: ReflectionAnswers = {
    reflection1: 'He made everything with order and care, and he called it good. ',
    reflection2: 'It starts the whole story: a good creation, then the first rebellion, and the first promise to fix it, [[Genesis 3:15]]. ',
    actionItems: [{
        action: 'Thank Jehovah for one thing he made, every morning',
        motivation: '[[Genesis 1:31]] says it was all good, and I hardly ever say thank you',
        // Left for them to tap: see the task on page 3.
        cadence: null,
    }],
    reflection4: 'My sister worries about the state of the world. [[Genesis 3:15]] shows it was always going to be fixed.',
    studyTopics: [{ topic: 'What “watery deep” means in [[Genesis 1:2]]' }],
    notes: '',
};

/**
 * What the sibling says on a practice page, one beat at a time.
 * - `tell` explains something; the user taps Got it to hear the next.
 * - `do` asks them to do it; it moves on by itself once `done` is true.
 *   `picking` swaps its line while the reference strip is open, one per step.
 * - `end` closes the page and unlocks its button.
 */
export type Beat =
    | { kind: 'tell'; action?: AsaroAction; line: string }
    | {
        kind: 'do'; action?: AsaroAction; line: string; done: (answers: ReflectionAnswers) => boolean;
        picking?: Partial<Record<PickerPhase, string>>;
    }
    | { kind: 'end'; action?: AsaroAction; line: string };

/** Also the face and line of a single remark, like the saved screen's. */
export type CoachBeat = { action?: AsaroAction; line: string };

const refs = (text: string) => (text.match(/\[\[.+?\]\]/g) ?? []).length;

export const COACH = {
    chapter: [
        { kind: 'tell', action: 'wave', line: 'Before you start, we do one together. It’s practice, nothing is saved, so relax. We’ll practise on Genesis 1–3, the first reading of the plan. I’ve already picked it for you.' },
        { kind: 'end', action: 'smug', line: 'Another day, read something else? Tap a chapter, or drag across a few. Only some verses? Turn on I read verses. For now, leave it on Genesis 1–3 and tap the button.' },
    ] as Beat[],
    /** One sequence per reflection page: the five questions, then notes. */
    pages: [
        [
            { kind: 'tell', action: 'smug', line: 'Five questions, one at a time. First: what does this tell you about Jehovah? Watch me.' },
            {
                kind: 'do', action: 'point', line: 'That’s mine. Your turn. One line, anything.',
                done: (a) => a.reflection1.trim() !== PRACTICE_ANSWERS.reflection1 && a.reflection1.trim().length >= 10,
            },
            { kind: 'end', action: 'thumbsUp', line: 'Not bad for day one. Don’t let it enter your head, there are four more. In a real entry, stopping halfway is fine: it waits for you on Home.' },
        ],
        [
            { kind: 'tell', action: 'think', line: 'How does it fit the Bible’s big story? Look at the end of mine: Genesis 3:15, in colour. That’s me referencing a verse.' },
            {
                kind: 'do', action: 'point', line: 'Your turn. Tap at the very end of the answer and type @. It’s with the symbols on your keyboard.',
                // One added to mine, or their own answer with one in it, whatever verse. Mine still typing is a prefix of mine.
                done: (a) => refs(a.reflection2) > refs(PRACTICE_ANSWERS.reflection2)
                    || (refs(a.reflection2) > 0 && !PRACTICE_ANSWERS.reflection2.startsWith(a.reflection2)),
                picking: {
                    book: 'See the strip above your keyboard? Tap the book. Type a few letters, like Jo, and John comes forward.',
                    chapter: 'Now the chapter. Tap its number.',
                    suffix: 'Tap Verse to point at one verse. Done stops at the whole chapter.',
                    verse: 'Type the verse number, then tap the tick.',
                    'verse-suffix': 'Now tap Done. To is for a few verses in a row, like 16 to 18.',
                    'range-type': 'A few verses, abi? Pick where it stops: another chapter, or a verse in this one.',
                    'end-chapter': 'Tap the chapter it stops on.',
                    'end-verse': 'Type the verse it stops on, then tap the tick.',
                },
            },
            { kind: 'end', action: 'celebrate', line: 'Ehen, like that. Type @ in any answer, any time. Later, tap a verse you’ve referenced and it opens in JW Library.' },
        ],
        [
            { kind: 'tell', action: 'point', line: 'This is the one I care about most: something you’ll actually do because of what you read. Action is what you’ll do, Motivated by is why. The why is the part you forget in a month, so I make you write it.' },
            { kind: 'tell', action: 'smug', line: 'Then how often. Every day for small habits, like thanking Jehovah each morning. Every week for bigger things, like calling someone who’s struggling on Sunday. By a date for a one-off, like talking to your brother before Friday. And no, Friday doesn’t move because you’re busy.' },
            {
                kind: 'do', action: 'point', line: 'Thanking him every morning is a habit. So tap Every day.',
                done: (a) => a.actionItems.some((item) => item.cadence === 'daily'),
            },
            { kind: 'end', action: 'thumbsUp', line: 'Planted. Every day and every week ones grow a tree. Water it well o. More than one? Tap add action.' },
        ],
        [
            { kind: 'end', action: 'smug', line: 'Who could this help? Think of one person, and how you’ll bring it up. Nothing to say on a question? Leave it empty and Next becomes Skip. I won’t vex.' },
        ],
        [
            { kind: 'end', action: 'think', line: 'Something to dig into later. Write it down before it’s gone. In a real entry, Remind me brings it back on the day you pick, and it waits in Library until you’ve studied it. More than one? Tap add topic.' },
        ],
        [
            { kind: 'end', action: 'nod', line: 'Anything else: a thought, something you noticed. Or nothing. Then tap Record it. It’s practice, so nothing counts.' },
        ],
    ] as Beat[][],
    saved: { action: 'celebrate', line: 'Five questions, and you didn’t run away. When you do your real one, this is what it makes.' } as CoachBeat,
};

/** Where a page's conversation stands; it has finished once it reaches its `end`. */
export const beatsFinished = (beats: Beat[] | undefined, at: number) => !beats || beats[at]?.kind === 'end' || at >= beats.length;
