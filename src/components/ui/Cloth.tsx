/**
 * The àdìrẹ motifs, as real resist patterns.
 *
 * `expo-linear-gradient` draws one gradient, not a repeating tile, so every
 * motif here is an SVG <Pattern>. That is also why swapping motifs is cheap:
 * the geometry lives in `Motif` (src/theme/spacing.ts) and the ink comes from
 * the palette, so a new motif is a new <Pattern> body and nothing else.
 *
 * A palette with `patternOpacity` of 0 renders nothing — the components bail
 * out early rather than drawing an invisible weave.
 */
import React, { useCallback, useId, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '../../theme/ThemeContext';
import { Motif } from '../../theme/spacing';

/**
 * Onikọ rings — tied resist. The signature motif.
 *
 * Absolutely positioned; drop it as the first child of a hero band with
 * `overflow: 'hidden'` and put the band's content after it.
 */
export function ClothGround({ style }: { style?: ViewStyle }) {
    const { colors } = useTheme();
    const pid = `rings-${useId()}`;
    /*
     * Sized from a measured layout, never `100%`: react-native-svg resolves a
     * percentage dimension ONCE, against the size the <Svg> first laid out at,
     * and never re-resolves it when the parent grows. A band that fills in
     * after a fetch then leaves its bottom strip bare, the pattern stopping in
     * mid-air. Passing pixels re-issues the <Rect> at the real height.
     */
    const [size, setSize] = useState({ width: 0, height: 0 });
    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
    }, []);

    if (colors.patternOpacity === 0) return null;

    const { tile, centre, radius, step, count, strokeWidth } = Motif.rings;

    return (
        <View
            style={[StyleSheet.absoluteFill, { opacity: colors.patternOpacity }, style]}
            pointerEvents="none"
            onLayout={onLayout}
        >
            <Svg width={size.width} height={size.height}>
                <Defs>
                    <Pattern id={pid} width={tile} height={tile} patternUnits="userSpaceOnUse">
                        {Array.from({ length: count }, (_, i) => (
                            <Circle
                                key={i}
                                cx={centre}
                                cy={centre}
                                r={radius + i * step}
                                fill="none"
                                stroke={colors.patternInk}
                                strokeWidth={strokeWidth}
                            />
                        ))}
                    </Pattern>
                </Defs>
                <Rect x="0" y="0" width={size.width} height={size.height} fill={`url(#${pid})`} />
            </Svg>
        </View>
    );
}

/**
 * The divider strip under a hero band: crosshatch at ~38% ink. Calibrated —
 * 50% reads as a solid bar, 21% vanishes, 31% is correct but inert. 38% sits
 * just above a plain dashed rule, enough to register as texture.
 */
export function ClothStrip({ style }: { style?: ViewStyle }) {
    const { colors } = useTheme();
    const pid = `hatch-${useId()}`;
    if (colors.patternOpacity === 0) return null;

    const { spacing, strokeWidth, opacity } = Motif.crosshatch;
    const h = Motif.stripHeight;

    return (
        <View style={[{ height: h, opacity }, style]} pointerEvents="none">
            <Svg width="100%" height={h}>
                <Defs>
                    <Pattern id={pid} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
                        <Line
                            x1={0} y1={spacing} x2={spacing} y2={0}
                            stroke={colors.textPrimary}
                            strokeWidth={strokeWidth}
                        />
                        <Line
                            x1={0} y1={0} x2={spacing} y2={spacing}
                            stroke={colors.textPrimary}
                            strokeWidth={strokeWidth}
                        />
                    </Pattern>
                </Defs>
                <Rect x="0" y="0" width="100%" height={h} fill={`url(#${pid})`} />
            </Svg>
        </View>
    );
}

/**
 * A zigzag ribbon, standing in for a search field that isn't there.
 *
 * Sits at a fixed height so a tab without a search box still gives the hero
 * band the same footprint one with a field would — the alternative is a
 * blank gap, which reads as a layout bug rather than a design choice. It has
 * no meaning of its own the way the rings or the weave do; it exists only to
 * be the same height.
 *
 * `force` draws it even when the palette carries no pattern, for a screen
 * that needs the spacer regardless.
 */
export function ClothZigzag({ style, force = false }: { style?: ViewStyle; force?: boolean }) {
    const { colors } = useTheme();
    const pid = `zigzag-${useId()}`;
    if (colors.patternOpacity === 0 && !force) return null;

    const { wavelength, amplitude, strokeWidth } = Motif.zigzag;
    const h = amplitude * 2;

    return (
        <View style={[styles.zigzag, style]} pointerEvents="none">
            <Svg width="100%" height={h}>
                <Defs>
                    <Pattern id={pid} width={wavelength} height={h} patternUnits="userSpaceOnUse">
                        <Path
                            d={`M0 ${h} L${wavelength / 2} 0 L${wavelength} ${h}`}
                            fill="none"
                            stroke={colors.markInk}
                            strokeWidth={strokeWidth}
                            strokeLinejoin="round"
                        />
                    </Pattern>
                </Defs>
                <Rect x="0" y="0" width="100%" height={h} fill={`url(#${pid})`} />
            </Svg>
        </View>
    );
}

/**
 * The woven mark — today, a selected chapter, a completed day.
 *
 * Fills its parent, so give the parent a size and `overflow: 'hidden'`.
 */
export function ClothMark({ style }: { style?: ViewStyle }) {
    const { colors } = useTheme();
    const pid = `mark-${useId()}`;

    const { spacing, strokeWidth } = Motif.mark;

    return (
        <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
            <Svg width="100%" height="100%">
                <Defs>
                    <Pattern id={pid} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
                        <Line x1={0} y1={spacing} x2={spacing} y2={0} stroke={colors.markInk} strokeWidth={strokeWidth} />
                        <Line x1={0} y1={0} x2={spacing} y2={spacing} stroke={colors.markInk} strokeWidth={strokeWidth} />
                    </Pattern>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${pid})`} />
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    /*
     * `height` matches `.cl-input`'s rendered height — `Spacing.md+2` padding
     * top and bottom, `lineHeight.lg` of text, one hairline each side — so the
     * ribbon fills exactly the box a search field would.
     *
     * `flex: 1` is load-bearing: this is the sole child of `heroSearch`, a row
     * flex container that otherwise held the TextInput's own `flex: 1`. Without
     * it the ribbon collapses to near-zero width and nothing draws.
     */
    zigzag: { flex: 1, height: 54, justifyContent: 'center' },
});
