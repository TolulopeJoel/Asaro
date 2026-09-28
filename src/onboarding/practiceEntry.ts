/**
 * The practice entry the chosen sibling walks a new user through. Nothing in it
 * is ever saved: see `practice` in app/addEntry.tsx. The passage is Reading 1.
 */
import type { AsaroAction } from '../theme/asaroRig';
import type { ReflectionAnswers } from '../components/ReflectionForm';

export const PRACTICE_BOOK = 'Genesis';
export const PRACTICE_CHAPTERS = { start: 1, end: 3 };

/** Typed in, letter by letter, when a page opens empty. */
export const PRACTICE_ANSWERS: ReflectionAnswers = {
    reflection1: 'He made everything with order and care, and he called it good.',
    reflection2: 'It starts the whole story: a good creation, then the first rebellion, and the first promise to fix it, [[Genesis 3:15]]. ',
    actionItems: [{
        action: 'Thank Jehovah for one thing he made, every morning',
        motivation: '[[Genesis 1:31]] says it was all good, and I hardly ever say thank you',
        // Left for them to tap: see the task on page 3.
        cadence: null,
    }],
    reflection4: 'My sister worries about the state of the world. [[Genesis 3:15]] shows it was always going to be fixed.',
    studyFurther: 'What “watery deep” means in [[Genesis 1:2]]',
    studyFurtherReminder: undefined,
    notes: '',
};

/**
 * What the sibling says on a practice page, one beat at a time.
 * - `tell` explains something; the user taps Got it to hear the next.
 * - `do` asks them to do it; it moves on by itself once `done` is true.
 * - `end` closes the page and unlocks its button.
 */
export type Beat =
    | { kind: 'tell'; action?: AsaroAction; line: string }
    | { kind: 'do'; action?: AsaroAction; line: string; done: (answers: ReflectionAnswers) => boolean }
    | { kind: 'end'; action?: AsaroAction; line: string };

/** Also the face and line of a single remark, like the saved screen's. */
export type CoachBeat = { action?: AsaroAction; line: string };

const refs = (text: string) => (text.match(/\[\[.+?\]\]/g) ?? []).length;

export const COACH = {
    chapter: [
        { kind: 'tell', action: 'wave', line: 'Before you start, we do one together. Practice, so nothing is saved. Today’s reading is Genesis 1–3, Reading 1 of the plan. I already picked it for you.' },
        { kind: 'end', action: 'smug', line: 'Another day, read something else? Tap a chapter, or drag across a few. Only some verses? Turn on I read verses. For now, leave it on Genesis 1–3 and tap the button.' },
    ] as Beat[],
    /** One sequence per reflection page: the five questions, then notes. */
    pages: [
        [
            { kind: 'tell', action: 'smug', line: 'Every entry is five questions, one at a time. First: what does this tell you about Jehovah? Watch me.' },
            {
                kind: 'do', action: 'point', line: 'That’s mine. Now add a line of your own, anything.',
                done: (a) => a.reflection1.trim() !== PRACTICE_ANSWERS.reflection1 && a.reflection1.trim().length >= 10,
            },
            { kind: 'end', action: 'nod', line: 'Ehen. In a real entry, answers save as you go, so if you stop halfway, it’s waiting on Home.' },
        ],
        [
            { kind: 'tell', action: 'think', line: 'How does it fit the Bible’s big story? Watch the end of mine: I’m quoting a verse.' },
            {
                kind: 'do', action: 'point', line: 'You can quote one in any answer. At the end, type @ and start typing a book, like John. Then pick the chapter and the verse.',
                done: (a) => refs(a.reflection2) > refs(PRACTICE_ANSWERS.reflection2),
            },
            { kind: 'end', action: 'celebrate', line: 'That’s it! Later, tap a verse like that and it opens in JW Library. Every verse you quote also helps me find what connects your entries.' },
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
            { kind: 'end', action: 'smug', line: 'Who could this help? Think of one person, and how you’d bring it up. Nothing to say on a question? Leave it empty and Next becomes Skip. Honest beats full.' },
        ],
        [
            { kind: 'end', action: 'think', line: 'Something to dig into later. Write it down before it’s gone. In a real entry, Set Reminder brings it back on the day you pick, and it waits in Library until you’ve studied it.' },
        ],
        [
            { kind: 'end', action: 'nod', line: 'Anything else: a thought, something you noticed. Or nothing. Then tap Record it. It’s practice, so nothing counts.' },
        ],
    ] as Beat[][],
    saved: { action: 'celebrate', line: 'That’s one! When you do your real one, this is what it makes.' } as CoachBeat,
};

/** Where a page's conversation stands; it has finished once it reaches its `end`. */
export const beatsFinished = (beats: Beat[] | undefined, at: number) => !beats || beats[at]?.kind === 'end' || at >= beats.length;
