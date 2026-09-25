/**
 * Home, in Cloth. design/all-screens.html #home, the `.cl` slot: the hero band
 * carries the day's line and the date over the onikọ rings, and under the
 * crosshatch strip the body is four blocks and nothing else.
 *
 *   today's reading, with the one call to action   .cl-label / .cl-h.xl / .cl-btn
 *   the week, as seven woven panels               .cl-panel ×7
 *   the entry count                               .cl-panel .cl-stat
 *   one flashback                                 .cl-panel
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ScalePressable } from '../ScalePressable';
import { ClothMark } from '../ui/Cloth';
import { SettingsGlyph } from '../ui/SettingsGlyph';
import { WavyAddIcon } from '../WavyAddIcon';
import { Hero } from '../ui/Surfaces';
import { Text } from '../ui/Text';
import { ThemedButton } from '../ui/ThemedButton';
import { DayStatus } from '../WeeklyStreak';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { formatRange } from '../../utils/reference';
import { DraftSummary, draftProgress } from '../../hooks/useEntryHooks';

export interface ClothHomeProps {
    /** The rotating line in the hero band. */
    greeting: string;
    /** "Sunday, 21 September" — the date under it. */
    dateLine: string;
    /** Today's reading, or null when the plan has nothing queued. */
    reading: { book: string; chapters: string; section?: string } | null;
    /** Which reading of the plan today is, so the eyebrow reads "Reading 4 · Today". */
    readingNumber?: number;
    weekDays: DayStatus[];
    entryCount: number;
    flashback?: { text: string; reference: string; when: string } | null;
    onBeginReflection: () => void;
    /**
     * The entry you walked away from, if there is one. design/all-screens.html
     * #draft: it takes the reading block's slot, because there is only ever one
     * draft and it IS the current reading session, whatever the plan queued.
     */
    draft?: DraftSummary | null;
    onResumeDraft?: () => void;
    /** The wavy plus in the band: an entry outside the plan. */
    onAddEntry?: () => void;
    onSettings: () => void;
    onWeekPress?: () => void;
    onFlashbackPress?: () => void;
    /**
     * A noticing, when there is one. Passed as a node rather than data so the
     * card decides its own weight from the active style, and there is one card
     * rather than two to keep in step.
     */
    observation?: React.ReactNode;
    /** What is live today. Absent on most days — see `TodayStrip`. */
    today?: React.ReactNode;
    /**
     * Progress through the reading plan. "34 of 364" is a goal with an end,
     * where a monotonic count of entries written is a fact about the database
     * that nothing follows from.
     */
    planProgress?: { completed: number; total: number; percent: number } | null;
    /**
     * Opening the land. The progress bar and the cloth are the same fact at two
     * resolutions, so the bar is the door rather than earning its own button.
     */
    onProgressPress?: () => void;
}

/**
 * The week, as seven panels. Three states as the mockup draws them: a day you
 * wrote is deep indigo, a day you did not is the bare panel, and today wears
 * the woven ochre mark — the motif doing a job rather than decorating.
 */
function WeekPanels({ days, onPress }: { days: DayStatus[]; onPress?: () => void }) {
    const { colors } = useTheme();

    return (
        <ScalePressable
            onPress={onPress}
            disabled={!onPress}
            style={styles.week}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={onPress ? 'See your reading history' : undefined}
        >
            {days.map((day) => {
                const written = day.hasEntry && !day.isToday;
                return (
                    <View
                        key={day.date.toISOString()}
                        style={[
                            styles.weekDay,
                            {
                                backgroundColor: written ? colors.textPrimary : colors.backgroundSubtle,
                            },
                        ]}
                    >
                        {day.isToday && <ClothMark />}
                        <Text
                            variant="tab"
                            style={{
                                color: written
                                    ? colors.textInverse
                                    : day.isToday
                                        ? colors.textPrimary
                                        : colors.textSecondary,
                            }}
                        >
                            {day.dayName.charAt(0)}
                        </Text>
                    </View>
                );
            })}
        </ScalePressable>
    );
}

export function ClothHome({
    greeting,
    dateLine,
    reading,
    readingNumber,
    weekDays,
    entryCount,
    flashback,
    onBeginReflection,
    draft,
    onResumeDraft,
    onAddEntry,
    onSettings,
    onWeekPress,
    onFlashbackPress,
    observation,
    today,
    planProgress,
    onProgressPress,
}: ClothHomeProps) {
    const { colors } = useTheme();

    return (
        <>
            <Hero ownsTopInset>
                <View style={styles.heroTop}>
                    <Text variant="display" tone="onBand" numberOfLines={2} style={styles.heroTitle}>
                        {greeting}
                    </Text>
                    <View style={styles.heroActions}>
                        {/* Held, not hidden, while a draft is live. There is
                          * one draft slot, so a fresh entry lets the autosave
                          * write across it — and a control that dims says
                          * finish this first, where one that vanishes teaches
                          * nothing. */}
                        <ScalePressable
                            onPress={onAddEntry}
                            disabled={!onAddEntry || !!draft}
                            accessibilityRole="button"
                            accessibilityLabel="Write an entry"
                            accessibilityState={{ disabled: !!draft }}
                            hitSlop={Spacing.md}
                            style={draft ? styles.held : undefined}
                        >
                            <WavyAddIcon size={20} color={colors.accent} />
                        </ScalePressable>
                        <ScalePressable
                            onPress={onSettings}
                            accessibilityRole="button"
                            accessibilityLabel="Settings"
                            hitSlop={Spacing.md}
                        >
                            <SettingsGlyph color={colors.accent} />
                        </ScalePressable>
                    </View>
                </View>
                <Text variant="sub" tone="onHero" style={styles.heroSub}>{dateLine}</Text>
            </Hero>

            <View style={styles.body}>
                {draft ? (
                    <View>
                        <Text variant="label" style={styles.label}>Unfinished</Text>
                        <Text variant="headline">{draft.passage}</Text>
                        <Text variant="sub">
                            {draftProgress(draft)}
                        </Text>
                        <ThemedButton
                            label="Pick it up"
                            variant="accent"
                            onPress={onResumeDraft ?? (() => { })}
                            style={styles.cta}
                            accessibilityHint={`Reopens your entry on ${draft.passage}`}
                        />
                    </View>
                ) : reading && (
                    <View>
                        <Text variant="label" style={styles.label}>
                            {readingNumber ? `Reading ${readingNumber} · Today` : 'Today'}
                        </Text>
                        {/*
                          * `.cl-h.xl` — 31px Fraunces at 700, one step above the
                          * hero title. The reading is the largest thing in the
                          * body because it is the thing to act on.
                          */}
                        <Text variant="headline">
                            {formatRange(`${reading.book} ${reading.chapters}`)}
                        </Text>
                        {reading.section && <Text variant="sub">{reading.section}</Text>}
                        {/* `.cl-btn` is not `.block` here — it sits to its own width. */}
                        <ThemedButton
                            label="Begin reflection"
                            onPress={onBeginReflection}
                            style={styles.cta}
                            accessibilityHint={`Opens a reflection for ${reading.book} ${reading.chapters}`}
                        />
                    </View>
                )}

                <WeekPanels days={weekDays} onPress={onWeekPress} />

                {today}

                {planProgress && (
                    <ScalePressable
                        style={[styles.panel, { backgroundColor: colors.backgroundSubtle }]}
                        onPress={onProgressPress}
                        disabled={!onProgressPress}
                        accessibilityRole={onProgressPress ? 'button' : undefined}
                        accessibilityLabel={onProgressPress ? 'See your land' : undefined}
                    >
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

                <View style={[styles.panel, styles.stat, styles.hiddenStat, { backgroundColor: colors.backgroundSubtle }]}>
                    <Text variant="hero">{entryCount}</Text>
                    {/*
                      * `.cl-statl` is the caption role set in caps — the only
                      * place Cloth uppercases a caption, so it is styled here
                      * rather than bent into the shared variant.
                      */}
                    <Text variant="caption" style={styles.statLabel}>Entries so far</Text>
                </View>

                {observation}

                {flashback && (
                    <ScalePressable
                        onPress={onFlashbackPress}
                        disabled={!onFlashbackPress}
                        style={[styles.panel, { backgroundColor: colors.backgroundSubtle }]}
                        accessibilityRole={onFlashbackPress ? 'button' : undefined}
                    >
                        <Text variant="label" style={styles.flashbackLabel}>{flashback.when}</Text>
                        <Text variant="quote" style={styles.flashbackText}>{flashback.text}</Text>
                        <Text variant="caption" tone="secondary" style={styles.statLabel}>
                            {flashback.reference}
                        </Text>
                    </ScalePressable>
                )}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    /* The entry count is kept in the tree but not drawn — plan progress says
     * the same encouraging thing with an end in sight. Removed rather than
     * deleted so the decision is visible if it turns out to be wrong. */
    hiddenStat: { display: 'none' },
    progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    progressTrack: { height: 6, marginTop: 10, flexDirection: 'row' },
    progressFill: { height: 6 },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Spacing.md,
    },
    heroTitle: { flex: 1 },
    heroActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    held: { opacity: 0.35 },
    /** `.cl-hsub{margin:8px 0 0}` */
    heroSub: { marginTop: Spacing.sm },

    /** `.cl-body{padding:22px 24px 0; gap:18px}` */
    body: {
        paddingTop: Spacing.xl - 2,
        paddingHorizontal: Spacing.layout.screenPadding,
        gap: Spacing.layout.cardPadding,
    },
    /** `.cl-label{margin:0 0 9px}` */
    label: { marginBottom: 9 },
    /** `.cl-btn{margin-top:16px}`, sized to its label rather than the width. */
    cta: { marginTop: Spacing.lg, alignSelf: 'flex-start' },

    /** Seven panels, gap 5. */
    week: { flexDirection: 'row', gap: 5 },
    weekDay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        overflow: 'hidden',
    },

    /** `.cl-panel{padding:18px}` */
    panel: { padding: Spacing.layout.cardPadding },
    stat: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
    },
    statLabel: { textTransform: 'uppercase' },

    /** `.cl-label{margin-bottom:7px}` inside the flashback panel. */
    flashbackLabel: { marginBottom: 7 },
    flashbackText: { marginBottom: 7 },
});
