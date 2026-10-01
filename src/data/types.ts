export interface ActionItem {
    id?: number;
    entry_id?: number;
    action: string;
    motivation: string;
    sort_order: number;
    is_completed?: boolean;
    is_pinned?: boolean;
    pinned_at?: string | null;
    /**
     * Set makes this a practice — see `actionKindOf`. The kind is derived from
     * these two rather than stored, so a row can never claim to be one thing
     * while carrying the fields of another.
     */
    cadence?: string | null;
    /** Set makes this an action with a deadline. */
    due_at?: string | null;
    /**
     * When it was archived, or null while it still stands.
     *
     * Archived is not deleted: the item stays on its entry, a practice keeps
     * its completions, and only the surfaces that ask "what am I working on"
     * stop showing it.
     */
    archived_at?: string | null;
}

/** One thing to study further, with its own reminder and done flag. */
export interface StudyItem {
    id: number;
    entry_id: number;
    topic: string;
    reminder: string | null;
    completed: boolean;
    sort_order: number;
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
    created_at: string;
    updated_at?: string;
    action_items?: ActionItem[];
    study_items?: StudyItem[];
}

export interface JournalEntryInput {
    bookName: string;
    chapterStart?: number;
    chapterEnd?: number;
    verseStart?: string;
    verseEnd?: string;
    reflections: string[];
    notes?: string;
    studyTopics?: {
        /** The row being edited; absent for a new topic. */
        id?: number;
        topic: string;
        reminder?: string | null;
    }[];
    actionItems?: {
        /** The row being edited; absent for a new item. */
        id?: number;
        action: string;
        motivation: string;
        cadence?: string | null;
        due_at?: string | null;
        archived_at?: string | null;
    }[];
    readingItemId?: number;
}

export interface EnhancedActionItem extends ActionItem {
    book_name: string;
    chapter_start: number;
    chapter_end?: number;
    created_at: string;
    is_completed: boolean;
}
