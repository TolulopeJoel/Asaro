/**
 * Badge system for Group Milestones.
 *
 * Each badge has:
 *   id        — unique string stored in Firestore (member doc: badges[])
 *   emoji     — displayed in the UI
 *   label     — short human-readable name
 *   desc      — celebration message shown in the activity feed
 *   order     — display order (lower = shown first/leftmost)
 *   threshold — the value at which this badge is earned
 */
export interface Badge {
    id: string;
    emoji: string;
    label: string;
    desc: string;
    order: number;
    threshold?: number;
}

// ─── Individual Streak Badges ─────────────────────────────────────────────────

export const STREAK_BADGES: Badge[] = [
    {
        id: 'streak_7',
        emoji: '🔥',
        label: 'Week Warrior',
        desc: 'read every day for a week!',
        order: 10,
        threshold: 7,
    },
    {
        id: 'streak_30',
        emoji: '⚡',
        label: 'Iron Discipline',
        desc: 'read every single day for a month!',
        order: 11,
        threshold: 30,
    },
    {
        id: 'streak_100',
        emoji: '👑',
        label: 'The Devoted',
        desc: 'hit 100 days in a row — truly legendary!',
        order: 12,
        threshold: 100,
    },
    {
        id: 'streak_365',
        emoji: '🏛️',
        label: 'A Year of Faith',
        desc: 'read every day for an entire year. Extraordinary.',
        order: 13,
        threshold: 365,
    },
];

// ─── Entry Milestone Badges ───────────────────────────────────────────────────

export const MILESTONE_BADGES: Badge[] = [
    {
        id: 'entries_50',
        emoji: '📖',
        label: 'Diligent Scribe',
        desc: 'has written 50 entries — a growing treasury!',
        order: 1,
        threshold: 50,
    },
    {
        id: 'entries_100',
        emoji: '📚',
        label: 'The Chronicler',
        desc: 'has written 100 entries — remarkable dedication!',
        order: 2,
        threshold: 100,
    },
    {
        id: 'entries_200',
        emoji: '✍️',
        label: 'Living Scripture',
        desc: 'has written 200 entries. A life well-examined.',
        order: 3,
        threshold: 200,
    },
];

// ─── Reflection Badges ────────────────────────────────────────────────────────

export const REFLECTION_BADGES: Badge[] = [
    {
        id: 'reflection_first',
        emoji: '🗣',
        label: 'Spoke Up',
        desc: 'shared {possessive} very first reflection — it takes courage!',
        order: 20,
        threshold: 1,
    },
    {
        id: 'reflection_5',
        emoji: '💬',
        label: 'First Voice',
        desc: 'shared {possessive} heart with the group!',
        order: 21,
        threshold: 5,
    },
    {
        id: 'reflection_25',
        emoji: '🕊️',
        label: 'Open Book',
        desc: 'has shared 25 reflections — generously building up the group!',
        order: 22,
        threshold: 25,
    },
    {
        id: 'reflection_50',
        emoji: '🔦',
        label: 'Lamp in the Room',
        desc: 'has shared 50 reflections — a consistent light to others!',
        order: 23,
        threshold: 50,
    },
    {
        id: 'reflection_100',
        emoji: '❤️',
        label: 'Servant Heart',
        desc: 'has shared 100 reflections. Rare and beautiful.',
        order: 24,
        threshold: 100,
    },
];

// ─── Group-level Badges ───────────────────────────────────────────────────────

export const GROUP_BADGES: Badge[] = [
    {
        id: 'group_streak_7',
        emoji: '🔆',
        label: 'Group 7-Day Streak',
        desc: 'The group read for 7 days in a row!',
        order: 30,
        threshold: 7,
    },
    {
        id: 'group_streak_30',
        emoji: '🏆',
        label: 'Group 30-Day Streak',
        desc: 'The group read EVERY DAY for a whole month!',
        order: 31,
        threshold: 30,
    },
    {
        id: 'all_read_today',
        emoji: '🤝',
        label: 'All Read Today',
        desc: 'Everyone read today — amazing!',
        order: 32,
        threshold: 0,
    },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export const ALL_BADGES: Badge[] = [
    ...MILESTONE_BADGES,
    ...STREAK_BADGES,
    ...REFLECTION_BADGES,
    // ...GROUP_BADGES,
];

export const getBadgeById = (id: string): Badge | undefined =>
    ALL_BADGES.find(b => b.id === id);

/**
 * Returns streak badges crossed by moving from prevStreak → newStreak.
 */
export const getNewlyEarnedStreakBadges = (
    prevStreak: number,
    newStreak: number
): Badge[] =>
    STREAK_BADGES.filter(b => b.threshold! > prevStreak && b.threshold! <= newStreak);

/**
 * Returns reflection badges crossed by moving from prevCount → newCount.
 */
export const getNewlyEarnedReflectionBadges = (
    prevCount: number,
    newCount: number
): Badge[] =>
    REFLECTION_BADGES.filter(b => b.threshold! > prevCount && b.threshold! <= newCount);
