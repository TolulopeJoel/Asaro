/** The groups data model as the screens read it (design/GROUPS.md#data-model). Times are epoch ms. */

export const SCHEMA = 2;
/** Own readings, shares and practices older than this many weeks are deleted. */
export const KEEP_WEEKS = 8;

export type Role = 'creator' | 'admin' | 'member';

export interface Group {
    id: string;
    name: string;
    description: string;
    code: string;
    createdBy: string;
    createdAt: number | null;
    /** The group's time zone, which sets its open window. */
    utcOffsetMinutes: number;
}

export interface Member {
    uid: string;
    displayName: string;
    role: Role;
    joinedAt: number | null;
}

/** One member's days read in one week, readable only while the group is open. */
export interface MemberWeek {
    id: string;
    userId: string;
    weekKey: string;
    /** Monday-first. */
    days: boolean[];
}

export interface Reading {
    id: string;
    userId: string;
    bookName: string;
    chapters: string;
    /** Questions answered, 0 to 5. */
    answered: number;
    /** Local `YYYY-MM-DD` it was read. */
    day: string;
    weekKey: string;
    createdAt: number | null;
}

export interface Share {
    id: string;
    userId: string;
    entryId: number;
    questionId: string;
    question: string;
    text: string;
    passage: string;
    weekKey: string;
    createdAt: number | null;
}

export interface SharedPractice {
    id: string;
    userId: string;
    itemId: number;
    entryId: number;
    action: string;
    cadence: string;
    weekKey: string;
    /** Monday-first. */
    keptDays: boolean[];
}

export type MilestoneKind = 'book' | 'section' | 'plan' | 'fruit' | 'year';

export interface GroupMilestone {
    id: string;
    userId: string;
    kind: MilestoneKind;
    label: string;
    weekKey: string;
    createdAt: number | null;
}

export interface Nudge {
    id: string;
    fromUid: string;
    fromName: string;
    groupId: string;
    groupName: string;
    createdAt: number | null;
}

/** One answer from the reader's own entries, as the Bring sheet offers it. */
export interface WeekAnswer {
    entryId: number;
    questionId: 'reflection1' | 'reflection2' | 'reflection3' | 'reflection4' | 'studyFurther';
    /** "About Jehovah". */
    label: string;
    text: string;
    /** "Romans 8". */
    passage: string;
}

/** One group's week, as the Sunday screen reads it. */
export interface GroupWeek {
    readings: Reading[];
    shares: Share[];
    practices: SharedPractice[];
    milestones: GroupMilestone[];
    weeks: MemberWeek[];
}
