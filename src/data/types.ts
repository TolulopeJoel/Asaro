export interface ActionItem {
    id?: number;
    entry_id?: number;
    action: string;
    motivation: string;
    sort_order: number;
    is_completed?: boolean;
    is_pinned?: boolean;
    pinned_at?: string | null;
}

export interface JournalEntry {
    id?: number;
    book_name: string;
    chapter_start: number;
    chapter_end?: number;
    verse_start?: string;
    verse_end?: string;
    reflection_1?: string;
    reflection_2?: string;
    reflection_3?: string;
    reflection_4?: string;
    notes?: string;
    study_further?: string;
    study_further_reminder?: string;
    study_completed?: boolean;
    created_at: string;
    updated_at?: string;
    action_items?: ActionItem[];
}

export interface JournalEntryInput {
    bookName: string;
    chapterStart?: number;
    chapterEnd?: number;
    verseStart?: string;
    verseEnd?: string;
    reflections: string[];
    notes?: string;
    studyFurther?: string;
    studyFurtherReminder?: string;
    actionItems?: { action: string; motivation: string }[];
    readingItemId?: number;
}

export interface StudyTopic {
    id: number;
    title: string;
    content: string;
    color: string;
    created_at: string;
    updated_at: string;
    references?: StudyTopicReference[];
}

export interface StudyTopicReference {
    id: number;
    topic_id: number;
    book_name: string;
    chapter: number;
    verse_start?: string;
    verse_end?: string;
}

export interface StudyTopicInput {
    title: string;
    content?: string;
    color?: string;
    references?: Omit<StudyTopicReference, 'id' | 'topic_id'>[];
}

export interface EnhancedActionItem extends ActionItem {
    book_name: string;
    chapter_start: number;
    chapter_end?: number;
    created_at: string;
    is_completed: boolean;
}
