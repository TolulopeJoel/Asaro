/**
 * The surfaces every screen is assembled from.
 *
 * Twenty screens in the mockups are built from roughly this set — hero, strip,
 * card, row, segments, button. Nothing invents its own container, which is
 * what keeps the three styles as themes rather than three separate apps.
 *
 * Shape comes from the theme rather than from constants here, because Classic
 * is rounded and bordered where the other two are flat and square.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeContext';
import { Motif, Spacing } from '../../theme/spacing';
import { ClothGround, ClothStrip } from './Cloth';
import { Text } from './Text';

/** Full-bleed screen background. Always use this rather than a bare View. */
export function Screen({ children, style, edges = ['top'] }: {
    children: React.ReactNode;
    style?: ViewStyle;
    edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
    const { colors } = useTheme();
    return (
        <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }, style]} edges={edges}>
            {children}
        </SafeAreaView>
    );
}

/**
 * The hero band.
 *
 * Cloth: indigo ground carrying the rings motif, followed by the crosshatch
 * strip. Colossal: no band at all — the title sits on the page as a small
 * eyebrow, because that style marks a screen by scale, not by a coloured area.
 */
export function Hero({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
    const { colors, style: themeStyle } = useTheme();

    // Neither Colossal nor Classic wears a band: Colossal marks a screen by
    // scale, Classic simply put its title on the page.
    if (themeStyle !== 'cloth') {
        return <View style={[styles.heroPlain, style]}>{children}</View>;
    }

    return (
        <>
            <View style={[styles.heroCloth, { backgroundColor: colors.textPrimary }, style]}>
                <ClothGround />
                <View style={styles.heroContent}>{children}</View>
            </View>
            <ClothStrip />
        </>
    );
}

/**
 * A panel.
 *
 * Cloth fills it, Colossal separates with a hairline and no fill, Classic
 * rounds and outlines it — the three ways this app has ever grouped things.
 */
export function Card({ children, style, ...rest }: ViewProps & { children: React.ReactNode }) {
    const { colors, shape, style: themeStyle } = useTheme();

    if (themeStyle === 'colossal') {
        return (
            <View
                style={[styles.cardColossal, { borderBottomColor: colors.border }, style]}
                {...rest}
            >
                {children}
            </View>
        );
    }

    return (
        <View
            style={[
                styles.cardFilled,
                {
                    backgroundColor: colors.cardBackground,
                    borderRadius: shape.card,
                    borderWidth: shape.cardBorder ? shape.hairline : 0,
                    borderColor: colors.cardBorder,
                },
                shape.elevation,
                style,
            ]}
            {...rest}
        >
            {children}
        </View>
    );
}

/** A list row with a hairline underneath. */
export function Row({ children, style, ...rest }: ViewProps & { children: React.ReactNode }) {
    const { colors } = useTheme();
    return (
        <View style={[styles.row, { borderBottomColor: colors.border }, style]} {...rest}>
            {children}
        </View>
    );
}

export interface SegmentItem {
    key: string;
    label: string;
}

export interface SegmentsProps {
    items: readonly SegmentItem[];
    value: string;
    onChange: (key: string) => void;
    /**
     * Let the row scroll instead of sharing the width evenly. Needed once
     * there are more than about four tabs — Library has six, and flexing them
     * into 390px shrinks the labels below the type scale's smallest size.
     */
    scrollable?: boolean;
}

/**
 * The tab strip.
 *
 * Underline in Cloth, plain weighted text in Colossal, tinted pills in
 * Classic — which is how the original Library row looked.
 */
export function Segments({ items, value, onChange, scrollable = false }: SegmentsProps) {
    const { colors, shape, style: themeStyle } = useTheme();
    const isCloth = themeStyle === 'cloth';
    const isClassic = themeStyle === 'classic';

    const buttons = items.map((item) => {
        const active = item.key === value;

        if (isClassic) {
            return (
                <Pressable
                    key={item.key}
                    onPress={() => onChange(item.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[
                        styles.segClassic,
                        {
                            borderRadius: shape.button,
                            backgroundColor: active ? colors.accent + '15' : colors.backgroundSubtle,
                        },
                    ]}
                >
                    <Text variant="label" tone={active ? 'accent' : 'secondary'}>
                        {item.label}
                    </Text>
                </Pressable>
            );
        }

        return (
            <Pressable
                key={item.key}
                onPress={() => onChange(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[
                    isCloth ? styles.segCloth : styles.segColossal,
                    scrollable && isCloth && styles.segScrollable,
                    isCloth && active && { borderBottomColor: colors.accent },
                ]}
            >
                <Text variant="label" tone={active ? 'primary' : 'tertiary'}>
                    {item.label}
                </Text>
            </Pressable>
        );
    });

    const inlineStyle = isCloth ? styles.segsCloth : isClassic ? styles.segsClassic : styles.segsColossal;
    const scrollStyle = isCloth ? styles.segsScrollCloth : isClassic ? styles.segsClassic : styles.segsColossal;

    if (scrollable) {
        return (
            <View style={isClassic ? undefined : { borderBottomWidth: Spacing.border.hairline, borderBottomColor: colors.border }}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={scrollStyle}
                >
                    {buttons}
                </ScrollView>
            </View>
        );
    }

    return <View style={[inlineStyle, !isClassic && { borderBottomColor: colors.border }]}>{buttons}</View>;
}

const styles = StyleSheet.create({
    flex: { flex: 1 },

    heroCloth: {
        position: 'relative',
        overflow: 'hidden',
        paddingTop: Spacing.layout.heroPaddingTop,
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingBottom: Spacing.xl - 2,
    },
    heroContent: { position: 'relative' },
    heroPlain: {
        paddingTop: Spacing.layout.heroPaddingTop,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
    },

    cardFilled: {
        padding: Spacing.layout.cardPadding,
    },
    cardColossal: {
        paddingVertical: Spacing.lg - 1,
        borderBottomWidth: Spacing.border.hairline,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: Spacing.md + 2,
        paddingVertical: Spacing.lg,
        borderBottomWidth: Spacing.border.hairline,
    },

    segsCloth: {
        flexDirection: 'row',
        borderBottomWidth: Spacing.border.hairline,
    },
    segCloth: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.md + 1,
        borderBottomWidth: Spacing.border.marker,
        borderBottomColor: 'transparent',
    },
    segsColossal: {
        flexDirection: 'row',
        gap: Spacing.lg + 2,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingBottom: Spacing.md + 2,
        borderBottomWidth: Spacing.border.hairline,
    },
    segColossal: { paddingVertical: Spacing.xs },
    segsClassic: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    segClassic: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs + 2,
        paddingHorizontal: Spacing.md + 2,
        paddingVertical: Spacing.sm + 1,
    },
    segScrollable: { flex: 0, paddingHorizontal: Spacing.lg },
    segsScrollCloth: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.sm,
    },

    strip: { height: Motif.stripHeight },
});
