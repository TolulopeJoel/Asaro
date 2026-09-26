/**
 * The levelled achievements on the stats page. Each is levelled on a figure
 * that only rises — the best run, books, chapters, the plan — never on the
 * current run, so nothing on the page can be lost. design/all-screens.html #stats.
 */

export type AchievementKey = 'faithful' | 'books' | 'chapters' | 'plan';

export const TIERS: Record<AchievementKey, number[]> = {
    /** Best run, in days. */
    faithful: [7, 14, 30, 100, 365],
    books: [1, 5, 10, 27, 66],
    chapters: [100, 250, 500, 1189],
    /** Percent of the plan's readings. */
    plan: [25, 50, 75, 100],
};

export interface Achievement {
    key: AchievementKey;
    title: string;
    /** Tiers reached. 0 is locked. */
    level: number;
    /** Where the figure stands, in the same unit as `need`. */
    have: number;
    /** The next tier in that unit, or the last one once every tier is reached. */
    need: number;
    /** What the next tier asks, or what the last one said. */
    description: string;
    maxed: boolean;
}

export interface StatsRecord {
    bestRun: number;
    booksFinished: number;
    chaptersWorked: number;
    planDone: number;
    planTotal: number;
}

/** How many tiers `value` has reached, and the next one if any. */
export function levelOf(tiers: number[], value: number): { level: number; next: number | null } {
    const level = tiers.filter(tier => value >= tier).length;
    return { level, next: tiers[level] ?? null };
}

const PLAN_WORDS: Record<number, string> = {
    25: 'Reach a quarter of the reading plan',
    50: 'Reach half the reading plan',
    75: 'Reach three quarters of the reading plan',
    100: 'Finish the reading plan',
};

export function achievements(record: StatsRecord): Achievement[] {
    const make = (
        key: AchievementKey,
        title: string,
        value: number,
        describe: (next: number) => string,
        done: string,
        unit: (tier: number) => number = tier => tier,
    ): Achievement => {
        const tiers = TIERS[key];
        const { level, next } = levelOf(tiers.map(unit), value);
        const maxed = next === null;
        return {
            key,
            title,
            level,
            have: value,
            need: maxed ? unit(tiers[tiers.length - 1]) : next,
            description: maxed ? done : describe(tiers[level]),
            maxed,
        };
    };

    // The plan's tiers are percents; progress is counted in readings, so a
    // tier is the first reading count at or past it.
    const readings = (percent: number) => Math.ceil((record.planTotal * percent) / 100);

    return [
        make('faithful', 'Faithful', record.bestRun,
            next => `Reach a ${next}-day best run`,
            'A year without a gap. Nothing left to reach.'),
        make('books', 'Book by book', record.booksFinished,
            next => (next === 1 ? 'Finish your first book of the Bible' : `Finish ${next} books of the Bible`),
            'Every book. All sixty-six.'),
        make('chapters', 'Every chapter', record.chaptersWorked,
            next => (next === 1189 ? 'Write about every chapter of the Bible' : `Write about ${next.toLocaleString('en-GB')} chapters`),
            'Every chapter of the Bible.'),
        make('plan', 'The plan', record.planDone,
            next => PLAN_WORDS[next] ?? `Reach ${next}% of the reading plan`,
            'The whole plan. Finished.',
            readings),
    ];
}
