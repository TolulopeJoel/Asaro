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
    if (length < 60) return { fontSize: 16, lineHeight: 26, padding: 24 };
    if (length < 120) return { fontSize: 16, lineHeight: 24, padding: 20 };
    return { fontSize: 14, lineHeight: 22, padding: 16 };
};

/**
 * The `.co-when` column: Today, then a weekday for the last week, then a date.
 *
 * The mockup's Colossal library reads "Today · Sat · Fri · Wed · Tue · Mon"
 * down the right edge rather than "Sep 21 · Jun 26". At 10px uppercase a
 * three-letter day is legible where a full date is not, and it is what makes
 * the column scan as a rhythm instead of a list of numbers. Anything older
 * than a week falls back to the short date, since a weekday would then be
 * ambiguous.
 */
export const formatWhen = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString.replace(' ', 'T'));
    if (isNaN(date.getTime())) return '';

    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return formatDate(dateString);
};
