/**
 * One noticing, on Home, among the other things the app remembers for you.
 *
 * The shape is argued rather than inherited, and it is not the one the mockup
 * sketched. That draft led with "Four entries, one centre" and gave Colossal a
 * giant 4 — which is a headline about the database. `themeQuality.ts` had
 * already written down why that is wrong ("the least interesting true thing
 * about a theme — it is a fact about the clustering, not about the reader"),
 * and the draft repeated the mistake in a larger font.
 *
 * So the card runs the other way round: evidence first, passage last.
 *
 *     WHERE YOUR ENTRIES POINT          what kind of card this is
 *     Genesis 35 · Leviticus 19 · …     what you did
 *     Across ten months, every one      what connects them
 *     of these points at the same
 *     passage. You have never
 *     written about it.
 *     1 Chronicles 16:26  →             the payoff
 *
 * The passages carry the count without announcing it, and the verse arrives as
 * a reward rather than a label. Reading it top to bottom is a small argument
 * that ends somewhere the reader has not been.
 *
 * At most one tap target, like Flashback beside it: the card opens its
 * receipts. The heavy actions — read the passage, or say it is wrong — live in
 * there, where there is room and where the reader has seen the evidence before
 * they judge it. The only thing on the card itself is a quiet dismiss, because
 * "not now" and "not true" are different answers and the schema keeps them
 * apart.
 *
 * At most, because some findings have nothing worth opening. A convergence
 * inferred something and its entries are the proof; absence reports counts of
 * the reader's own writing and its "evidence" would tell them nothing they did
 * not already have. Those cards are flat and unpressable, and carry a closing
 * remark where the button would have been — a card that lifts under the thumb
 * and then does nothing teaches the reader that these cards are unreliable,
 * which is expensive for the ones that genuinely do open.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { ScalePressable } from '../ScalePressable';
import { Text } from '../ui';
import { RenderedObservation } from '../../insight/render';

interface Props {
    observation: RenderedObservation;
    /**
     * Called once when this card mounts, to record that it was shown.
     *
     * Required rather than optional on purpose. The stamp used to happen where
     * the finding was chosen, which meant a screen merely loading could spend
     * one — and `shown_at` decides whether a card returns, when it returns,
     * and whether it lands in the archive as something the reader answered.
     * Making this mandatory means a new surface cannot quietly reintroduce
     * that by leaving a prop off.
     */
    onSeen: () => void;
    onOpen: () => void;
    onDismiss: () => void;
}

export function ObservationCard({ observation, onSeen, onOpen, onDismiss }: Props) {
    const { colors, isLockedIn } = useTheme();

    /*
     * Keyed on the callback, which the hook rebuilds per finding — so this
     * fires once for each card rather than once per render.
     */
    useEffect(() => {
        onSeen();
    }, [onSeen]);

    /*
     * Both styles say the same thing in the same order. Colossal does not get
     * a different argument, only a different weight — it drops the card
     * chrome for a hairline and lets the passage carry the emphasis, which is
     * what that style does everywhere else in the app.
     */
    const subjectFirst = !!observation.subjectFirst;

    const subjectLine = (
        <Text
            variant={isLockedIn ? 'subtitle' : 'reference'}
            style={styles.subject}
            numberOfLines={subjectFirst ? 3 : 2}
        >
            {observation.subject}
        </Text>
    );

    const body = (
        <>
            <View style={styles.header}>
                <Text variant="label" tone={isLockedIn ? 'accent' : 'secondary'}>
                    {observation.kind.toUpperCase()}
                </Text>
                <ScalePressable
                    onPress={onDismiss}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss this noticing"
                >
                    <X size={15} color={colors.textTertiary} />
                </ScalePressable>
            </View>

            {/*
              * The topic, when the card has one — above the sentence that
              * refers to it, so "this one" points backwards at something the
              * reader has already met.
              */}
            {subjectFirst && (
                <View style={[styles.topic, { borderBottomColor: colors.border }]}>
                    {subjectLine}
                </View>
            )}

            {/*
              * The evidence, oldest first — the count made visible rather than
              * stated. Omitted entirely when a detector has no passages to
              * list: absence rests on counts rather than places, and an empty
              * strip would leave a gap the reader reads as a loading failure.
              */}
            {observation.evidence.length > 0 && (
                <Text variant="caption" tone="tertiary" style={styles.evidence}>
                    {observation.evidence.join('  ·  ')}
                </Text>
            )}

            <Text variant="body" tone="secondary" style={styles.claim}>
                {observation.claim}
            </Text>

            {!subjectFirst && (
                <View style={[styles.subjectRow, { borderTopColor: colors.border }]}>
                    {subjectLine}
                    {observation.openLabel && (
                        <Text variant="label" tone="accent">
                            {observation.openLabel}
                        </Text>
                    )}
                </View>
            )}

            {/*
              * Where the button would have been, on a card that has none.
              * Given its own line rather than the subject row because it is a
              * remark, not a label — it is a sentence, and squeezing it beside
              * a two-line question would wrap it into nonsense.
              */}
            {!observation.openLabel && observation.aside && (
                <Text variant="caption" tone="tertiary" style={styles.aside}>
                    {observation.aside}
                </Text>
            )}
        </>
    );

    /*
     * A card only behaves like a button when there is something behind it.
     *
     * Absence has no receipts worth opening, and a card that lifts under the
     * thumb and then does nothing is worse than a flat one — it teaches the
     * reader that this app's cards are unreliable, which is expensive for the
     * ones that genuinely do open.
     */
    const canOpen = !!observation.openLabel;

    const surface = isLockedIn
        ? [styles.colossal, { borderTopColor: colors.border }]
        : [styles.cloth, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }];

    if (!canOpen) return <View style={surface}>{body}</View>;

    return (
        <ScalePressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityHint="Opens the entries behind this"
            style={surface}
        >
            {body}
        </ScalePressable>
    );
}

const styles = StyleSheet.create({
    cloth: {
        borderWidth: 1,
        borderRadius: Spacing.borderRadius.lg,
        padding: Spacing.lg,
    },
    colossal: {
        borderTopWidth: 1,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    evidence: {
        marginTop: Spacing.md,
        lineHeight: 18,
    },
    claim: {
        marginTop: Spacing.sm,
    },
    subjectRow: {
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    subject: {
        flexShrink: 1,
    },
    aside: {
        marginTop: Spacing.sm,
        fontStyle: 'italic',
    },
    /* A heading, so the rule sits under it rather than over it. */
    topic: {
        marginTop: Spacing.md,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
    },
});
