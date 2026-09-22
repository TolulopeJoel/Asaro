/**
 * The àdìrẹ motifs, as real resist patterns.
 *
 * `expo-linear-gradient` draws one gradient, not a repeating tile, so every
 * motif here is an SVG <Pattern>. That is also why swapping motifs is cheap:
 * the geometry lives in `Motif` (src/theme/spacing.ts) and the ink comes from
 * the palette, so a new motif is a new <Pattern> body and nothing else.
 *
 * In Colossal these render nothing — `patternOpacity` is 0 and the components
 * bail out early. Locked In wears no cloth.
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
     * The rings are sized from a measured layout rather than from `100%`.
     *
     * react-native-svg resolves a percentage dimension once, against the size
     * the <Svg> had when it first laid out, and does not re-resolve it when the
     * parent grows. A band whose height is stable never shows this, but one
     * that fills in after a fetch does: Group detail renders its title alone
     * while loading, then adds `.cl-hsub` underneath, and the band gets taller
     * than the rings were measured for — leaving the bottom strip of indigo
     * bare, with the pattern stopping in mid-air partway down.
     *
     * Reading the layout and passing pixels means the <Rect> is re-issued at
     * the band's real height every time it changes.
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
 * The divider strip under a hero band: crosshatch at ~38% ink.
 *
 * Calibrated deliberately. 50% read as a solid bar, 21% vanished, 31% was
 * correct but inert. 38% sits just above the weight of a plain dashed rule,
 * which is enough to register as texture rather than as a line.
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
 * Colossal's own header has the identical problem — its search row only
 * appears on Recent — so `force` lets Library reuse this there too. It draws
 * with `markInk`, the same ochre accent Colossal already uses for its other
 * small marks, rather than the wallpaper-style patterns (`patternOpacity`)
 * Colossal otherwise carries none of.
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
 * In Colossal it paints a flat ochre block instead of a weave, which is the
 * right translation: that style marks by weight, not by texture.
 */
export function ClothMark({ style }: { style?: ViewStyle }) {
    const { colors, style: themeStyle } = useTheme();
    const pid = `mark-${useId()}`;

    if (themeStyle === 'colossal') {
        return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.markInk }, style]} pointerEvents="none" />;
    }

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
     * Matches `.cl-input`'s own rendered height — `Spacing.md+2` padding
     * top and bottom, `lineHeight.lg` of text, one hairline border each
     * side — so the ribbon fills exactly the box a search field would.
     */
    /*
     * `flex: 1` matters here: this sits as the sole child of `heroSearch`, a
     * row flex container that otherwise held the search field's own
     * `flex: 1` TextInput. Without it the ribbon collapses to its intrinsic
     * (near-zero) width instead of filling the row — the space is still
     * reserved, but nothing draws across it.
     */
    zigzag: { flex: 1, height: 54, justifyContent: 'center' },
});
