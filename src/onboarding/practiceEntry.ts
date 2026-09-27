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
    reflection2: 'It starts the whole story: a good creation, then the first rebellion, and the first promise to fix it.',
    actionItems: [{
        action: 'Thank Jehovah for one thing he made, every morning',
        motivation: 'Genesis 1 says it was all good, and I hardly ever say thank you',
        cadence: 'daily',
    }],
    reflection4: 'My sister worries about the state of the world. Genesis 3:15 shows it was always going to be fixed.',
    studyFurther: 'What “the deep” means in Genesis 1:2',
    studyFurtherReminder: undefined,
    notes: '',
};

export interface CoachBeat { action?: AsaroAction; line: string }

export const COACH = {
    chapter: { action: 'point', line: 'We start with today’s reading, Genesis 1–3. You can pick verses too. When you’re set, tap the button.' },
    /** One per reflection page: the five questions, then notes. */
    pages: [
        { action: 'smug', line: 'First one. What does it tell you about Jehovah? Watch me, then write your own if you like.' },
        { action: 'think', line: 'How does it fit the Bible’s big story? Don’t overthink it.' },
        { action: 'point', line: 'This is the big one. Something you’ll actually do, and why. Make it daily and it grows a tree.' },
        { action: 'nod', line: 'Who could this help? Think of one person.' },
        { action: 'think', line: 'Something to dig into later. Set a time and I’ll remind you.' },
        { action: 'smug', line: 'Anything else? Or nothing. Then record it. It’s practice, nothing counts.' },
    ],
    saved: { action: 'celebrate', line: 'That’s one! When you do your real one, this is what it makes.' },
} satisfies Record<string, CoachBeat | CoachBeat[]>;
