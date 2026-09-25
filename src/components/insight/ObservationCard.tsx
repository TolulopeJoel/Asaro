/**
 * One noticing, on Home. Evidence first, passage last — never a count as the
 * headline, which is a fact about the database rather than the reader:
 *
 *     WHERE YOUR ENTRIES POINT          what kind of card this is
 *     Genesis 35 · Leviticus 19 · …     what you did
 *     Across ten months, every one      what connects them
 *     of these points at the same
 *     passage. You have never
 *     written about it.
 *     1 Chronicles 16:26  →             the payoff
 *
 * The passages carry the count without announcing it, and reading top to
 * bottom is a small argument ending somewhere the reader has not been.
 *
 * At most ONE tap target: the card opens its receipts, and the heavy actions
 * live in there where the reader has seen the evidence first. Only a quiet
 * dismiss sits on the card, since "not now" and "not true" are different
 * answers the schema keeps apart.
 *
 * At most, because some findings have nothing worth opening — those are flat
 * and unpressable, with a closing remark where the button would have been.
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
     * Called once when this card mounts, to record that it was shown. Required
     * rather than optional so a new surface cannot spend a finding by leaving
     * the prop off — `shown_at` decides whether a card returns, when, and
     * whether it lands in the archive as something the reader answered.
     */
    onSeen: () => void;
    onOpen: () => void;
    onDismiss: () => void;
}

export function ObservationCard({ observation, onSeen, onOpen, onDismiss }: Props) {
    const { colors } = useTheme();

    /*
     * Keyed on the callback, which the hook rebuilds per finding — so this
     * fires once for each card rather than once per render.
     */
    useEffect(() => {
        onSeen();
    }, [onSeen]);

    /*
     * The card says one thing in one order: the topic, then the sentence,
     * then the passage.
     */
    const subjectFirst = !!observation.subjectFirst;

    const subjectLine = (
        <Text
            variant="reference"
            style={styles.subject}
            numberOfLines={subjectFirst ? 3 : 2}
        >
            {observation.subject}
        </Text>
    );

    const body = (
        <>
            <View style={styles.header}>
                <Text variant="label" tone="secondary">
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

            {/* The evidence, oldest first — the count made visible rather
              * than stated. Omitted entirely for detectors with no passages,
              * since an empty strip reads as a loading failure. */}
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

            {/* Where the button would have been, on a card that has none. Its
              * own line rather than the subject row: it is a sentence, and
              * squeezing it beside a two-line question wraps it to nonsense. */}
            {!observation.openLabel && observation.aside && (
                <Text variant="caption" tone="tertiary" style={styles.aside}>
                    {observation.aside}
                </Text>
            )}
        </>
    );

    // A card only behaves like a button when something is behind it: one that
    // lifts under the thumb and does nothing teaches the reader these cards
    // are unreliable, which is expensive for the ones that do open.
    const canOpen = !!observation.openLabel;

    const surface = [styles.cloth, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }];

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
