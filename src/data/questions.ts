/** The five reflection questions. Notes are not a question and never count as one. */

export type QuestionId = 'reflection1' | 'reflection2' | 'reflection3' | 'reflection4' | 'studyFurther';

export interface ReflectionQuestion {
    id: QuestionId;
    question: string;
    placeholder: string;
    /** Answered with action items rather than text. */
    isActionList?: boolean;
}

/** Shown in an empty answer box on the questions that take points. */
const LIST_HINT = 'Start a line with - or * for a list';

export const REFLECTION_QUESTIONS: ReflectionQuestion[] = [
    {
        id: 'reflection1',
        question: 'What does this tell me about Jehovah?',
        placeholder: LIST_HINT,
    },
    {
        id: 'reflection2',
        question: 'How does this section of the Scriptures contribute to the Bible’s message?',
        placeholder: LIST_HINT,
    },
    {
        id: 'reflection3',
        question: 'How can I realistically apply this in my life?',
        placeholder: '',
        isActionList: true,
    },
    {
        id: 'reflection4',
        question: 'How can I use these verses to help others?',
        placeholder: LIST_HINT,
    },
    {
        id: 'studyFurther',
        question: 'What would I like to study further?',
        placeholder: '',
    },
];

export const QUESTION_COUNT = REFLECTION_QUESTIONS.length;

/** Each question in a few words, for a label over a shared answer. */
export const QUESTION_LABELS: Record<QuestionId, string> = {
    reflection1: 'About Jehovah',
    reflection2: 'The Bible’s message',
    reflection3: 'Applying it',
    reflection4: 'Helping others',
    studyFurther: 'To study further',
};

export const isQuestionId = (id: unknown): id is QuestionId =>
    typeof id === 'string' && REFLECTION_QUESTIONS.some(q => q.id === id);

/** What `answeredCount` reads: the wizard's answers, or an entry mapped onto them. */
export interface AnswerFields {
    reflection1?: string | null;
    reflection2?: string | null;
    reflection4?: string | null;
    studyTopics?: { topic?: string | null }[] | null;
    actionItems?: { action?: string | null }[] | null;
}

const filled = (text: string | null | undefined) => !!text?.trim();

/** Whether one question has an answer; the action question needs an action, not just a reason, and study further a topic. */
export function isAnswered(answers: AnswerFields, id: QuestionId): boolean {
    if (id === 'reflection3') return !!answers.actionItems?.some(item => filled(item.action));
    if (id === 'studyFurther') return !!answers.studyTopics?.some(item => filled(item.topic));
    return filled(answers[id]);
}

/** How many of the five questions have an answer, 0 to 5. */
export function answeredCount(answers: AnswerFields | null | undefined): number {
    if (!answers) return 0;
    return REFLECTION_QUESTIONS.filter(q => isAnswered(answers, q.id)).length;
}
