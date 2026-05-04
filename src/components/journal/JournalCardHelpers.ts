import { JournalEntry } from '../../data/database';

export const getChapterText = (entry: JournalEntry): string => {
    if (entry.chapter_end && entry.chapter_end !== entry.chapter_start) {
        return `${entry.chapter_start}–${entry.chapter_end}`;
    }
    return entry.chapter_start?.toString() || '';
};

export const getAnsweredStatus = (entry: JournalEntry): boolean[] => {
    return [
        (entry.reflection_1 ?? '').trim().length > 0,
        (entry.reflection_2 ?? '').trim().length > 0,
        (entry.action_items && entry.action_items.some(item => item.action.trim() || item.motivation.trim())) || false,
        (entry.reflection_4 ?? '').trim().length > 0,
    ];
};

export const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString.replace(' ', 'T'));
    const isCurrentYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: isCurrentYear ? undefined : 'numeric',
    });
};

export const getPreviewText = (entry: JournalEntry): string => {
    const reflections = [entry.reflection_1, entry.reflection_2, entry.reflection_4]
        .filter((r): r is string => !!r && r.trim().length > 0);
    const substantialReflection = reflections.sort((a, b) => (b?.length || 0) - (a?.length || 0))[0];
    if (substantialReflection) {
        return substantialReflection.length > 80
            ? substantialReflection.substring(0, 80) + '...'
            : substantialReflection;
    }
    if (entry.action_items && entry.action_items.length > 0) {
        const firstAction = entry.action_items.find(i => i.action.trim());
        if (firstAction) {
            const text = `→ ${firstAction.action.trim()}`;
            return text.length > 80 ? text.substring(0, 80) + '...' : text;
        }
    }
    if (entry.notes?.trim()) {
        return entry.notes.length > 80
            ? entry.notes.substring(0, 80) + '...'
            : entry.notes;
    }
    return 'No reflection recorded';
};

export const getDynamicCardStyle = (text: string) => {
    const length = text.length;
    if (length < 60) return { fontSize: 18, lineHeight: 28, padding: 24 };
    if (length < 120) return { fontSize: 16, lineHeight: 24, padding: 20 };
    return { fontSize: 14, lineHeight: 22, padding: 16 };
};
