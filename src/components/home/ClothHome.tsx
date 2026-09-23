/**
 * Home, in Cloth.
 *
 * design/all-screens.html #home, the `.cl` slot. The hero band carries the
 * day's line and the date over the onikọ rings; under the crosshatch strip the
 * body is four blocks and nothing else:
 *
 *   today's reading, with the one call to action   .cl-label / .cl-h.xl / .cl-btn
 *   the week, as seven woven panels               .cl-panel ×7
 *   the entry count                               .cl-panel .cl-stat
 *   one flashback                                 .cl-panel
 *
 * The design note calls Home "the one screen where both styles get to be
 * generous", and this is what generous means here — four panels on cloth,
 * rather than the eight stacked cards the screen used to carry.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ScalePressable } from '../ScalePressable';
import { ClothMark } from '../ui/Cloth';
import { SettingsGlyph } from '../ui/SettingsGlyph';
import { Hero } from '../ui/Surfaces';
import { Text } from '../ui/Text';
import { ThemedButton } from '../ui/ThemedButton';
import { DayStatus } from '../WeeklyStreak';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { formatRange } from '../../utils/reference';

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
}

/**
 * The week, as seven panels.
 *
 * Three states, exactly as the mockup draws them: a day you wrote is the deep
 * indigo block, a day you did not is the bare panel, and today wears the woven
 * ochre mark. The mark is the motif doing a job rather than decorating.
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
    onSettings,
    onWeekPress,
    onFlashbackPress,
    observation,
}: ClothHomeProps) {
    const { colors } = useTheme();

    return (
        <>
            <Hero ownsTopInset>
                <View style={styles.heroTop}>
                    <Text variant="display" tone="onBand" numberOfLines={2} style={styles.heroTitle}>
                        {greeting}
                    </Text>
                    <ScalePressable
                        onPress={onSettings}
                        accessibilityRole="button"
                        accessibilityLabel="Settings"
                        hitSlop={Spacing.md}
                    >
                        <SettingsGlyph color={colors.accent} />
                    </ScalePressable>
                </View>
                <Text variant="sub" tone="onHero" style={styles.heroSub}>{dateLine}</Text>
            </Hero>

            <View style={styles.body}>
                {reading && (
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

                <View style={[styles.panel, styles.stat, { backgroundColor: colors.backgroundSubtle }]}>
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
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Spacing.md,
    },
    heroTitle: { flex: 1 },
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
