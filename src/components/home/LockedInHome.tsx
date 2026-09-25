/**
 * Home, in Colossal.
 *
 * This is a distinct composition, not the Cloth screen restyled. The mockup's
 * Locked In home (design/all-screens.html #home, the `.co` slot) carries five
 * things and nothing else:
 *
 *   the wordmark and settings      .co-top
 *   a greeting                     15px / 500, secondary
 *   today's reading, enlarged      the screen's one colossal element
 *   the week, as seven bars        6px tall, gap 4
 *   one flashback line             .co-hr between each
 *
 * Everything the Cloth home also shows — the entry count, action reminders,
 * study reminders, the add button — is deliberately absent. "One thing at a
 * time" is the whole premise of the style, so the omissions are the design.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ScalePressable } from '../ScalePressable';
import { SettingsGlyph } from '../ui/SettingsGlyph';
import { Text } from '../ui/Text';
import { ThemedButton } from '../ui/ThemedButton';
import { DayStatus } from '../WeeklyStreak';
import { useTheme } from '../../theme/ThemeContext';
import { FontFamily, Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { formatRange } from '../../utils/reference';

const { size, lineHeight, tracking } = Typography;

/** The Colossal column of `tracking`, resolved against a size. */
const track = (px: number, em: number) => Math.round(px * em * 10) / 10;

export interface LockedInHomeProps {
    /** The rotating line at the top of the screen. */
    greeting: string;
    /** Today's reading, or null when the plan has nothing queued. */
    reading: { book: string; chapters: string; section?: string } | null;
/**
     * Which reading of the plan today is — the plan's own `id`, so Genesis
     * 12–15 reads "Reading 4" exactly as the mockup has it.
     */
    readingNumber?: number;
    weekDays: DayStatus[];
    /** One line of an older entry, with the reference and how long ago. */
    flashback?: { text: string; reference: string; when: string } | null;
    onBeginReflection: () => void;
    onSettings: () => void;
    onWeekPress?: () => void;
    onFlashbackPress?: () => void;
    /**
     * A noticing, when there is one.
     *
     * Passed as a node rather than as data: the card decides its own weight
     * from the active style, so neither Home has to know how it is drawn —
     * and there is one card rather than two that must be kept in step.
     */
    observation?: React.ReactNode;
    /** What is live today. Absent on most days — see `TodayStrip`. */
    today?: React.ReactNode;
    /**
     * Progress through the reading plan.
     *
     * Replaces the entry count, which only ever went up. "34 of 364" is a goal
     * with an end, and finishing the Bible in a year is a real one for this
     * reader; a monotonic counter of entries written is a fact about the
     * database that nothing follows from.
     */
    planProgress?: { completed: number; total: number; percent: number } | null;
    /** Opening the land — see ClothHome, where this is argued out. */
    onProgressPress?: () => void;
}

/**
 * The week, as seven bars.
 *
 * Each bar is one of three states and nothing more: written (foreground),
 * missed (a hairline-dark bar) and today (ochre). Days still to come read as
 * missed, which is correct — they are simply not written yet.
 */
function WeekBars({ days }: { days: DayStatus[] }) {
    const { colors } = useTheme();

    return (
        <View style={styles.week}>
            {days.map((day) => {
                const ink = day.isToday
                    ? colors.accent
                    : day.hasEntry
                        ? colors.textPrimary
                        : colors.backgroundSubtle;
                return <View key={day.date.toISOString()} style={[styles.weekBar, { backgroundColor: ink }]} />;
            })}
        </View>
    );
}

export function LockedInHome({
    greeting,
    reading,
    readingNumber,
    weekDays,
    flashback,
    onBeginReflection,
    onSettings,
    onWeekPress,
    onFlashbackPress,
    observation,
    today,
    planProgress,
    onProgressPress,
}: LockedInHomeProps) {
    const { colors } = useTheme();
    const written = weekDays.filter((d) => d.hasEntry).length;

    return (
        <View style={styles.screen}>
            <View style={styles.top}>
                {/* .co-mark — the wordmark, not a screen title. */}
                <Text variant="tab">Àṣàrò</Text>
                <ScalePressable
                    onPress={onSettings}
                    accessibilityRole="button"
                    accessibilityLabel="Settings"
                    hitSlop={Spacing.md}
                >
                    <SettingsGlyph color={colors.textTertiary} />
                </ScalePressable>
            </View>

            <View style={styles.body}>
                <Text style={[styles.greeting, { color: colors.textSecondary }]}>{greeting}</Text>

                {reading && (
                    <>
                        <Text variant="label" style={styles.todayLabel}>
                            {readingNumber ? `Today · Reading ${readingNumber}` : 'Today'}
                        </Text>

                        {/*
                          * The screen's one enlarged element: the book name, with
                          * the chapter range beneath it in ochre. Ochre means
                          * "today" everywhere in the app, and this is the only
                          * place on Home that earns it.
                          */}
                        <Text style={[styles.giantBook, { color: colors.textPrimary }]}>{reading.book}</Text>
                        <Text style={[styles.giantRef, { color: colors.accent }]}>{formatRange(reading.chapters)}</Text>

                        {reading.section ? (
                            <Text style={[styles.series, { color: colors.textTertiary }]}>{reading.section}</Text>
                        ) : (
                            <View style={styles.seriesSpacer} />
                        )}

                        <ThemedButton label="Begin reflection" onPress={onBeginReflection} block />
                    </>
                )}

                {weekDays.length > 0 && (
                    <>
                        <View style={[styles.rule, { backgroundColor: colors.border }]} />
                        <ScalePressable onPress={onWeekPress} disabled={!onWeekPress}>
                            <WeekBars days={weekDays} />
                            <Text variant="label" style={styles.weekCount}>
                                {`${written} of ${weekDays.length} this week`}
                            </Text>
                        </ScalePressable>
                    </>
                )}

                {today}

                {observation}

                {flashback && (
                    <>
                        <View style={[styles.rule, { backgroundColor: colors.border }]} />
                        <ScalePressable onPress={onFlashbackPress} disabled={!onFlashbackPress}>
                            <Text variant="body" tone="secondary" style={styles.flashbackText}>
                                {flashback.text}
                            </Text>
                            <Text variant="label" style={styles.flashbackRef}>
                                {`${flashback.reference} · ${flashback.when}`}
                            </Text>
                        </ScalePressable>
                    </>
                )}

                {planProgress && (
                    <ScalePressable
                        onPress={onProgressPress}
                        disabled={!onProgressPress}
                        accessibilityRole={onProgressPress ? 'button' : undefined}
                        accessibilityLabel={onProgressPress ? 'See your land' : undefined}
                    >
                        <View style={[styles.rule, { backgroundColor: colors.border }]} />
                        <View style={styles.progressTop}>
                            <Text variant="label">{`${planProgress.completed} of ${planProgress.total} readings`}</Text>
                            <Text variant="label" tone="accent">{`${planProgress.percent}%`}</Text>
                        </View>
                        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { backgroundColor: colors.accent, width: `${Math.min(100, planProgress.percent)}%` },
                                ]}
                            />
                        </View>
                    </ScalePressable>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 },
    progressTrack: { height: 6, marginTop: 10, flexDirection: 'row' },
    progressFill: { height: 6 },
    screen: {
        flex: 1,
    },
    // .co-top
    top: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.lg,
    },
    // .co-body
    body: {
        flex: 1,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.xl + 2,
    },
    greeting: {
        fontFamily: FontFamily.monoMedium,
        fontSize: size.mdPlus,
        lineHeight: lineHeight.mdPlusLead,
        marginBottom: Spacing.xl + 2,
    },
    todayLabel: {
        marginBottom: Spacing.xs + 2,
    },
    giantBook: {
        fontFamily: FontFamily.monoBlack,
        fontSize: size.giantBook,
        lineHeight: lineHeight.giantBook,
        letterSpacing: track(size.giantBook, tracking.giant[1]),
    },
    giantRef: {
        fontFamily: FontFamily.monoBlack,
        fontSize: size.giantRef,
        lineHeight: lineHeight.giantRef,
        letterSpacing: track(size.giantRef, tracking.giant[1]),
    },
    series: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.sm,
        lineHeight: lineHeight.sm,
        letterSpacing: track(size.sm, tracking.series[1]),
        textTransform: 'uppercase',
        marginTop: Spacing.md + 2,
        marginBottom: Spacing.xl - 2,
    },
    seriesSpacer: {
        height: Spacing.xl,
    },
    // .co-hr
    rule: {
        height: StyleSheet.hairlineWidth,
        marginVertical: Spacing.xl + 2,
    },
    week: {
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    weekBar: {
        flex: 1,
        height: 6,
    },
    weekCount: {
        marginTop: Spacing.sm + 2,
    },
    flashbackText: {
        marginBottom: Spacing.xs + 2,
    },
    flashbackRef: {},
});
