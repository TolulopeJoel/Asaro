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
import React, { useId } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, Rect } from 'react-native-svg';

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
    if (colors.patternOpacity === 0) return null;

    const { tile, centre, radius, strokeWidth } = Motif.rings;

    return (
        <View style={[StyleSheet.absoluteFill, { opacity: colors.patternOpacity }, style]} pointerEvents="none">
            <Svg width="100%" height="100%">
                <Defs>
                    <Pattern id={pid} width={tile} height={tile} patternUnits="userSpaceOnUse">
                        <Circle
                            cx={centre}
                            cy={centre}
                            r={radius}
                            fill="none"
                            stroke={colors.patternInk}
                            strokeWidth={strokeWidth}
                        />
                        {/* the second ring of the tie, half a tile out */}
                        <Circle
                            cx={centre}
                            cy={centre}
                            r={radius + 7.5}
                            fill="none"
                            stroke={colors.patternInk}
                            strokeWidth={strokeWidth}
                        />
                    </Pattern>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${pid})`} />
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
