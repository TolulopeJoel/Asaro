/**
 * The surfaces every screen is assembled from.
 *
 * Twenty screens in the mockups are built from roughly this set — hero, strip,
 * card, row, segments, button. Nothing invents its own container, which is
 * what keeps a style a theme rather than a separate app.
 *
 * Shape comes from the theme rather than from constants here, because it is
 * the axis a second style is most likely to move.
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
 * Indigo ground carrying the rings motif, followed by the crosshatch strip.
 *
 * `topPadding` overrides the default distance from the top of the band to its
 * content (`Spacing.layout.heroPaddingTop`) for a screen whose own mockup asks
 * for more room, e.g. `.cl-hero{padding-top:64px}`. Pass a number, not a style
 * override — see the bleed comment below for why.
 */
export function Hero({ children, style, topPadding = Spacing.layout.heroPaddingTop, ownsTopInset = false }: {
    children: React.ReactNode;
    style?: ViewStyle;
    topPadding?: number;
    /**
     * Take the screen's top safe-area inset into this band's own padding.
     *
     * By default <Screen> pads its top edge by insets.top, so a transient
     * status bar never lands on a header (see useScreenInsets — the app hides
     * the bar, but Android can bring it back without reporting real insets).
     * That padding sits on Screen's own background ABOVE the band, which
     * shows as a strip of ecru above the indigo — the band stopping short of
     * the top of the screen instead of reaching it the way every mockup draws
     * it.
     *
     * A screen fixes that by dropping 'top' from <Screen edges> and setting
     * this, which moves the same reserved space inside the band: the indigo
     * now runs to the true top of the screen and the content inside sits
     * exactly where it did. It is opt-in per screen because the two have to
     * change together — doing one without the other either doubles the gap or
     * puts the header back under the bar.
     *
     * A negative margin on the band would look like it does the same job, but
     * a band inside a ScrollView is clipped to the scroll bounds, so it draws
     * nothing above them.
     */
    ownsTopInset?: boolean;
}) {
    const { colors } = useTheme();
    const insets = useScreenInsets();

    /*
     * The mockup's `padding-top:52px` is measured from the top of the display
     * — its phone frame draws no status bar, so 52 is the whole allowance
     * above the title. Adding the inset to it would double-count and leave the
     * band half again too tall. The app hides the status bar, so the inset's
     * only job here is clearing a camera cutout: it is a floor under the
     * band's own padding, not something to stack on top of it. Spacing.lg is
     * the breathing room between a cutout and the first line of type.
     */
    const top: ViewStyle = {
        paddingTop: ownsTopInset
            ? Math.max(topPadding, insets.top + Spacing.lg)
            : topPadding,
    };

    return (
        <>
            <View style={[styles.heroCloth, { backgroundColor: colors.textPrimary }, style, top]}>
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
 * Cloth fills it; the shape tokens decide whether it also rounds and outlines.
 */
export function Card({ children, style, ...rest }: ViewProps & { children: React.ReactNode }) {
    const { colors, shape } = useTheme();

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
 * An underlined row of labels.
 */
export function Segments({ items, value, onChange, scrollable = false }: SegmentsProps) {
    const { colors } = useTheme();

    const buttons = items.map((item) => {
        const active = item.key === value;


        return (
            <Pressable
                key={item.key}
                onPress={() => onChange(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[
                    styles.segCloth,
                    scrollable && styles.segScrollable,
                    active && { borderBottomColor: colors.accent },
                ]}
            >
                <Text variant="tab" tone={active ? 'primary' : 'tertiary'}>
                    {item.label}
                </Text>
            </Pressable>
        );
    });

    // Scrollable draws its hairline on the wrapper, so the content must not
    // repeat it — a second line inside the ScrollView slides with the labels.
    if (scrollable) {
        return (
            <View style={{ borderBottomWidth: Spacing.border.hairline, borderBottomColor: colors.border }}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.segsScrollCloth}
                >
                    {buttons}
                </ScrollView>
            </View>
        );
    }

    return <View style={[styles.segsCloth, { borderBottomColor: colors.border }]}>{buttons}</View>;
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

    cardFilled: {
        padding: Spacing.layout.cardPadding,
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
    segScrollable: { flex: 0, paddingHorizontal: Spacing.lg },
    segsScrollCloth: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.sm,
    },

    strip: { height: Motif.stripHeight },
});
