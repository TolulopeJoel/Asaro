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
 * One tap target, like Flashback beside it: the card opens its receipts. The
 * heavy actions — read the passage, or say it is wrong — live in there, where
 * there is room and where the reader has seen the evidence before they judge
 * it. The only thing on the card itself is a quiet dismiss, because "not now"
 * and "not true" are different answers and the schema keeps them apart.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { ScalePressable } from '../ScalePressable';
import { Text } from '../ui';
import { RenderedObservation } from '../../insight/render';

interface Props {
    observation: RenderedObservation;
    onOpen: () => void;
    onDismiss: () => void;
}

export function ObservationCard({ observation, onOpen, onDismiss }: Props) {
    const { colors, isLockedIn } = useTheme();

    /*
     * Both styles say the same thing in the same order. Colossal does not get
     * a different argument, only a different weight — it drops the card
     * chrome for a hairline and lets the passage carry the emphasis, which is
     * what that style does everywhere else in the app.
     */
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

            {/* The evidence, oldest first — the count made visible rather than stated. */}
            <Text variant="caption" tone="tertiary" style={styles.evidence}>
                {observation.evidence.join('  ·  ')}
            </Text>

            <Text variant="body" tone="secondary" style={styles.claim}>
                {observation.claim}
            </Text>

            <View style={[styles.subjectRow, { borderTopColor: colors.border }]}>
                <Text
                    variant={isLockedIn ? 'subtitle' : 'reference'}
                    style={styles.subject}
                    numberOfLines={2}
                >
                    {observation.subject}
                </Text>
                <Text variant="label" tone="accent">
                    {observation.openLabel}
                </Text>
            </View>
        </>
    );

    if (isLockedIn) {
        return (
            <ScalePressable
                onPress={onOpen}
                accessibilityRole="button"
                accessibilityHint="Opens the entries behind this"
                style={[styles.colossal, { borderTopColor: colors.border }]}
            >
                {body}
            </ScalePressable>
        );
    }

    return (
        <ScalePressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityHint="Opens the entries behind this"
            style={[
                styles.cloth,
                { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
            ]}
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
});
