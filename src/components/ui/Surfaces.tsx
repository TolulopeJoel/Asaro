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

import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useTheme } from '../../theme/ThemeContext';
import { Motif, Spacing } from '../../theme/spacing';
import { ClothGround, ClothStrip } from './Cloth';
import { Text } from './Text';

/**
 * Full-bleed screen background. Always use this rather than a bare View.
 *
 * The insets are applied here by hand rather than by SafeAreaView, so the top
 * edge can carry the floor that useScreenInsets puts under it — see that hook
 * for why a hidden status bar still needs room kept for it. They are applied
 * after `style` so a caller can never accidentally pad the header back under
 * the bar.
 */
export function Screen({ children, style, edges = ['top'] }: {
    children: React.ReactNode;
    style?: ViewStyle;
    edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
    const { colors } = useTheme();
    const insets = useScreenInsets();

    // Only the requested edges go in: an undefined entry here would still
    // flatten over whatever `style` set for that side.
    const safeArea: ViewStyle = {};
    if (edges.includes('top')) safeArea.paddingTop = insets.top;
    if (edges.includes('bottom')) safeArea.paddingBottom = insets.bottom;
    if (edges.includes('left')) safeArea.paddingLeft = insets.left;
    if (edges.includes('right')) safeArea.paddingRight = insets.right;

    return (
        <View style={[styles.flex, { backgroundColor: colors.background }, style, safeArea]}>
            {children}
        </View>
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

    // Colossal wears no band: it marks a screen by scale, not by a colour area.
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
 * Underline in Cloth, plain weighted text in Colossal.
 */
export function Segments({ items, value, onChange, scrollable = false }: SegmentsProps) {
    const { colors, shape, style: themeStyle } = useTheme();
    const isCloth = themeStyle === 'cloth';

    const buttons = items.map((item) => {
        const active = item.key === value;


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
                <Text variant="tab" tone={active ? 'primary' : 'tertiary'}>
                    {item.label}
                </Text>
            </Pressable>
        );
    });

    const inlineStyle = isCloth ? styles.segsCloth : styles.segsColossal;
    // Scrollable draws its hairline on the wrapper, so the content must not
    // repeat it — a second line inside the ScrollView slides with the labels.
    const scrollStyle = isCloth ? styles.segsScrollCloth : styles.segsScrollColossal;

    if (scrollable) {
        return (
            <View style={{ borderBottomWidth: Spacing.border.hairline, borderBottomColor: colors.border }}>
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

    return <View style={[inlineStyle, { borderBottomColor: colors.border }]}>{buttons}</View>;
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
    segsScrollColossal: {
        flexDirection: 'row',
        gap: Spacing.lg + 2,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingBottom: Spacing.md + 2,
    },
    segColossal: { paddingVertical: Spacing.xs },
    segScrollable: { flex: 0, paddingHorizontal: Spacing.lg },
    segsScrollCloth: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.sm,
    },

    strip: { height: Motif.stripHeight },
});
