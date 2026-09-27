/**
 * The land as a picture to send: the whole Bible in one field, the reader's
 * trees standing on it, and words that explain the picture rather than the
 * person. No name, no count, no streak — a tree shows, never what it is for.
 */
import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookCloth } from '../../land/cloth';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { Hero, Text } from '../ui';
import { BibleCloth, LandTree } from './BibleCloth';

/** Chapters across. Near square for the whole Bible, which reads well in a status or a chat. */
const COLUMNS = 36;

export const LandShareCard = forwardRef<View, { books: BookCloth[]; trees: LandTree[]; width: number }>(
    ({ books, trees, width }, ref) => {
        const { colors } = useTheme();
        return (
            // Not collapsed, so the capture has a real native view to draw.
            <View ref={ref} collapsable={false} style={[styles.card, { width, backgroundColor: colors.background }]}>
                <Hero topPadding={Spacing.xl}>
                    <Text variant="display" tone="onBand">Genesis to Revelation</Text>
                    <Text variant="sub" tone="onHero" style={styles.sub}>
                        Green is every chapter I&apos;ve written about.
                    </Text>
                </Hero>
                <BibleCloth books={books} trees={trees} cellSize={width / COLUMNS} showNames={false} />
                <View style={styles.foot}>
                    <Text variant="label" tone="accent">Àṣàrò</Text>
                    <Text variant="meta" tone="secondary">a Bible reading journal</Text>
                </View>
            </View>
        );
    },
);

LandShareCard.displayName = 'LandShareCard';

const styles = StyleSheet.create({
    card: { overflow: 'hidden' },
    sub: { marginTop: Spacing.sm },
    foot: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
    },
});
