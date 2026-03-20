export interface Badge {
    id: string;
    emoji: string;
    label: string;
    desc: string;
    order: number;
    threshold?: number; // used for streak + entry-count badges
}

export const STREAK_BADGES: Badge[] = [
    { id: 'streak_3', emoji: '🌱', label: '3-Day Streak', desc: 'read 3 days in a row — a habit is forming!', order: 10, threshold: 3 },
    { id: 'streak_7', emoji: '🔥', label: '7-Day Streak', desc: 'stayed consistent for a whole week!', order: 11, threshold: 7 },
    { id: 'streak_30', emoji: '⚡', label: '30-Day Streak', desc: 'read every day for a month — incredible discipline!', order: 12, threshold: 30 },
    { id: 'streak_100', emoji: '👑', label: '100-Day Streak', desc: 'hit 100 days in a row — truly legendary!', order: 13, threshold: 100 },
];

export const MILESTONE_BADGES: Badge[] = [
    { id: 'first_entry', emoji: '✨', label: 'First Entry', desc: 'made {possessive} very first entry!', order: 1 },
    { id: 'entries_10', emoji: '📖', label: '10 Entries', desc: 'has written 10 entries — keep it up!', order: 2, threshold: 10 },
    { id: 'entries_50', emoji: '📚', label: '50 Entries', desc: 'has written 50 entries — a goldmine of wisdom!', order: 3, threshold: 50 },
    { id: 'reflection_first', emoji: '💬', label: 'First Reflection', desc: 'shared {possessive} first reflection with us!', order: 4 },
];

export const GROUP_BADGES: Badge[] = [
    { id: 'group_streak_7', emoji: '🔆', label: 'Group 7-Day Streak', desc: 'The group read for 7 days in a row!', order: 20, threshold: 7 },
    { id: 'group_streak_30', emoji: '🏆', label: 'Group 30-Day Streak', desc: 'The group read EVERY DAY for a whole month!', order: 21, threshold: 30 },
    { id: 'all_read_today', emoji: '🤝', label: 'All Read Today', desc: 'Everyone read today — amazing!', order: 22, threshold: 0 },
];

export const ALL_BADGES: Badge[] = [...STREAK_BADGES, ...MILESTONE_BADGES, ...GROUP_BADGES];

export const getBadgeById = (id: string): Badge | undefined =>
    ALL_BADGES.find(b => b.id === id);

/**
 * Given a new streak value and the previous streak value,
 * returns the streak badges that were JUST crossed (if any).
 */
export const getNewlyEarnedStreakBadges = (prevStreak: number, newStreak: number): Badge[] =>
    STREAK_BADGES.filter(b => b.threshold! > prevStreak && b.threshold! <= newStreak);
