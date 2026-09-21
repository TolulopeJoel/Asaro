import React from 'react';
import { View, Image } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { Text } from './ui/Text';

const INK_DARK = '#12131a';
const INK_LIGHT = '#ffffff';

/** Relative luminance, WCAG 2.x. */
function luminance(hex: string): number {
    const h = hex.replace('#', '');
    const channel = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(parseInt(h.slice(0, 2), 16))
        + 0.7152 * channel(parseInt(h.slice(2, 4), 16))
        + 0.0722 * channel(parseInt(h.slice(4, 6), 16));
}

function contrast(a: string, b: string): number {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Pick the readable ink for an avatar ground.
 *
 * Chooses whichever of the two inks actually wins on contrast rather than
 * testing a luminance threshold — a threshold put white on ochre at 2.56:1,
 * which fails outright. Measured this way the worst slot across both palettes
 * is 4.54:1, so every initial clears AA at the ~17px the avatar renders.
 */
function readableOn(background: string): string {
    return contrast(background, INK_DARK) >= contrast(background, INK_LIGHT)
        ? INK_DARK
        : INK_LIGHT;
}

/**
 * Stable slot for a person, derived from their id (or name as a fallback).
 *
 * Returns an index rather than a colour so the palette stays with the theme.
 * This used to be nine hardcoded iOS system colours, which meant a group of
 * members looked like a different product from the screen they sat on.
 */
export const getAvatarIndex = (id: string | undefined | null, name: string | undefined, length: number): number => {
    const seed = (id || name || 'Guest').toString();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % Math.max(length, 1);
};

export const Avatar = ({
    id, name, url, size = 44, radius, borderWidth, borderColor, opacity = 1, style,
}: {
    id?: string; name?: string; url?: string; size?: number; radius?: number;
    borderWidth?: number; borderColor?: string; opacity?: number; style?: any;
}) => {
    const { colors } = useTheme();
    const background = colors.series[getAvatarIndex(id, name, colors.series.length)];

    // The series spans near-black indigo to light ochre, so a fixed white
    // initial is unreadable on the lighter slots.
    const initialColor = readableOn(background);

    return (
        <View style={[{
            width: size, height: size,
            borderRadius: radius ?? size / 2,
            backgroundColor: background,
            justifyContent: 'center', alignItems: 'center',
            borderWidth: borderWidth ?? 0, borderColor, opacity,
            overflow: 'hidden',
        }, style]}>
            {url ? (
                <Image
                    source={{ uri: url }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                />
            ) : (
                <Text
                    variant="subtitle"
                    style={{ color: initialColor, fontSize: size * 0.38, lineHeight: size * 0.46 }}
                >
                    {name?.charAt(0).toUpperCase() ?? '?'}
                </Text>
            )}
        </View>
    );
};
