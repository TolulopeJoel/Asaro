import type { JournalEntry } from '../data/types';
import { REFLECTION_QUESTIONS } from '../data/questions';

/** "John 3:16–21", "Genesis 12–15", "Genesis 12:4–13:2" — the passage as the entry records it. */
export function entryReference(entry: JournalEntry): string {
    const { book_name, chapter_start: c1, verse_start: v1, verse_end: v2 } = entry;
    const c2 = entry.chapter_end && entry.chapter_end !== c1 ? entry.chapter_end : undefined;
    if (c2) {
        return v1 || v2
            ? `${book_name} ${c1}${v1 ? `:${v1}` : ''}–${c2}${v2 ? `:${v2}` : ''}`
            : `${book_name} ${c1}–${c2}`;
    }
    if (!v1) return `${book_name} ${c1}`;
    return `${book_name} ${c1}:${v1}${v2 && v2 !== v1 ? `–${v2}` : ''}`;
}

/** Brackets off, lines kept: shared text is read outside the app, where the markup means nothing. */
const plain = (text: string) => text.replace(/\[\[(.+?)\]\]/g, '$1').trim();

/** The whole entry as text to send: every answered question under its own heading, in order. */
export function entryShareText(entry: JournalEntry): string {
    const actions = (entry.action_items ?? [])
        .filter(item => item.action.trim())
        .map(item => (item.motivation.trim() ? `${item.action.trim()}\n${item.motivation.trim()}` : item.action.trim()))
        .join('\n\n');
    const topics = (entry.study_items ?? []).map(item => item.topic.trim()).filter(Boolean);
    const study = topics.length > 1 ? topics.map(topic => `- ${topic}`).join('\n') : topics.join('');

    const [about, message, apply, help, further] = REFLECTION_QUESTIONS.map(q => q.question);
    const answers: [string, string | undefined][] = [
        [about, entry.reflection_1],
        [message, entry.reflection_2],
        [apply, actions],
        [help, entry.reflection_4],
        [further, study],
        ['Anything else?', entry.notes],
    ];
    const body = answers
        .filter(([, answer]) => answer?.trim())
        .map(([question, answer]) => `${question}\n${plain(answer!)}`)
        .join('\n\n');

    return `Reflection on ${entryReference(entry)}\n\n${body ? `${body}\n\n` : ''}🫶 Created with Àṣàrò`;
}
