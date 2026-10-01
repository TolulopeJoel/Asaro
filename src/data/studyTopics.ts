import { answerBlocks } from '../utils/points';

/** One topic as the entry form edits it. `id` is the saved row, so an edit keeps its reminder and done state. */
export interface StudyTopicDraft {
    id?: number;
    topic: string;
    reminder?: string | null;
    completed?: boolean;
}

export const isBlankTopic = (topic: { topic?: string | null }) => !topic.topic?.trim();

/**
 * The single study-further answer that older entries, drafts and backups hold, as topics.
 * Written as points, each point is a topic; otherwise the whole answer is one. The reminder
 * goes with the first topic.
 */
export function topicsFromLegacy(text: string | null | undefined, reminder?: string | null, completed = false): StudyTopicDraft[] {
    if (!text?.trim()) return [];
    const blocks = answerBlocks(text);
    const parts = blocks.some(block => block.point) ? blocks.map(block => block.text) : [text.trim()];
    return parts.map((topic, i) => ({
        topic,
        reminder: i === 0 ? reminder ?? null : null,
        completed,
    }));
}
