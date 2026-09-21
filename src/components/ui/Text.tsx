/**
 * Typed text.
 *
 * Callers ask for a role — `title`, `label`, `quote` — and the active style
 * decides the face, size and weight. Cloth answers in Fraunces over Work Sans;
 * Colossal answers in Schibsted Grotesk and lets weight do the hierarchy;
 * Classic answers in the system face, as the app originally did.
 *
 * Screens should not set `fontSize` or `fontFamily` directly. That habit is
 * what produced 13 raw font sizes and a serif token that was defined and then
 * never used anywhere in the app.
 */
import React from 'react';
import { Text as RNText, StyleSheet, TextProps as RNTextProps, TextStyle } from 'react-native';

import { ThemeStyle, useTheme } from '../../theme/ThemeContext';
import { ThemeColors } from '../../theme/colors';
import { FontFamily, TextVariant, Typography } from '../../theme/typography';

export interface TextProps extends RNTextProps {
    variant?: TextVariant;
    /** Named palette role. Defaults to the sensible one for the variant. */
    tone?: 'primary' | 'secondary' | 'tertiary' | 'muted' | 'accent' | 'inverse'
    | 'success' | 'warning' | 'danger' | 'info';
    children?: React.ReactNode;
}

function toneColor(tone: TextProps['tone'], colors: ThemeColors): string {
    switch (tone) {
        case 'secondary': return colors.textSecondary;
        case 'tertiary': return colors.textTertiary;
        case 'muted': return colors.textMuted;
        case 'accent': return colors.accent;
        case 'inverse': return colors.textInverse;
        case 'success': return colors.success;
        case 'warning': return colors.warning;
        case 'danger': return colors.danger;
        case 'info': return colors.info;
        default: return colors.textPrimary;
    }
}

const { size, lineHeight, letterSpacing } = Typography;

const cloth: Record<TextVariant, TextStyle> = {
    hero: {
        fontFamily: FontFamily.displayHeavy,
        fontSize: size.display,
        lineHeight: lineHeight.display,
        letterSpacing: letterSpacing.tighter,
    },
    display: {
        fontFamily: FontFamily.displayHeavy,
        fontSize: size.xxl,
        lineHeight: lineHeight.xxl,
        letterSpacing: letterSpacing.tight,
    },
    title: {
        fontFamily: FontFamily.display,
        fontSize: size.xl,
        lineHeight: lineHeight.xl,
        letterSpacing: letterSpacing.tight,
    },
    subtitle: {
        fontFamily: FontFamily.display,
        fontSize: size.lg,
        lineHeight: lineHeight.lg,
        letterSpacing: letterSpacing.tight,
    },
    body: {
        fontFamily: FontFamily.body,
        fontSize: size.md,
        lineHeight: lineHeight.lg,
    },
    bodySmall: {
        fontFamily: FontFamily.body,
        fontSize: size.sm,
        lineHeight: lineHeight.md,
    },
    label: {
        fontFamily: FontFamily.bodySemibold,
        fontSize: size.xs,
        lineHeight: lineHeight.xs,
        letterSpacing: letterSpacing.wider,
        textTransform: 'uppercase',
    },
    caption: {
        fontFamily: FontFamily.body,
        fontSize: size.sm,
        lineHeight: lineHeight.md,
    },
    quote: {
        fontFamily: FontFamily.displayItalic,
        fontSize: size.lg,
        lineHeight: lineHeight.xl,
        fontStyle: 'italic',
    },
    button: {
        fontFamily: FontFamily.bodySemibold,
        fontSize: size.md,
        lineHeight: lineHeight.md,
        letterSpacing: letterSpacing.wide,
    },
};

const colossal: Record<TextVariant, TextStyle> = {
    hero: {
        fontFamily: FontFamily.monoBlack,
        fontSize: size.colossal,
        lineHeight: lineHeight.colossal,
        letterSpacing: size.colossal * letterSpacing.colossal,
    },
    display: {
        fontFamily: FontFamily.monoBlack,
        fontSize: size.xxxl,
        lineHeight: lineHeight.xxxl,
        letterSpacing: letterSpacing.tighter,
    },
    title: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.xl,
        lineHeight: lineHeight.xl,
        letterSpacing: letterSpacing.tight,
    },
    subtitle: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.lg,
        lineHeight: lineHeight.lg,
        letterSpacing: letterSpacing.tight,
    },
    body: {
        fontFamily: FontFamily.mono,
        fontSize: size.md,
        lineHeight: lineHeight.lg,
    },
    bodySmall: {
        fontFamily: FontFamily.mono,
        fontSize: size.sm,
        lineHeight: lineHeight.md,
    },
    label: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.xs,
        lineHeight: lineHeight.xs,
        letterSpacing: letterSpacing.widest,
        textTransform: 'uppercase',
    },
    caption: {
        fontFamily: FontFamily.monoMedium,
        fontSize: size.sm,
        lineHeight: lineHeight.md,
    },
    quote: {
        fontFamily: FontFamily.mono,
        fontSize: size.lg,
        lineHeight: lineHeight.xl,
    },
    button: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.sm,
        lineHeight: lineHeight.md,
        letterSpacing: letterSpacing.wider,
        textTransform: 'uppercase',
    },
};


/**
 * Classic — the original app.
 *
 * System face, the sizes the app actually shipped with, hierarchy carried by
 * weight rather than by a display face. Deliberately the plainest of the
 * three: that plainness is what it looked like.
 */
const classic: Record<TextVariant, TextStyle> = {
    hero: {
        fontFamily: FontFamily.system,
        fontSize: 40,
        lineHeight: 48,
        fontWeight: '700',
        letterSpacing: letterSpacing.tight,
    },
    display: {
        fontFamily: FontFamily.system,
        fontSize: 32,
        lineHeight: 40,
        fontWeight: '700',
        letterSpacing: letterSpacing.tight,
    },
    title: {
        fontFamily: FontFamily.system,
        fontSize: size.xl,
        lineHeight: 28,
        fontWeight: '700',
    },
    subtitle: {
        fontFamily: FontFamily.system,
        fontSize: size.lg,
        lineHeight: lineHeight.lg,
        fontWeight: '600',
    },
    body: {
        fontFamily: FontFamily.system,
        fontSize: size.md,
        lineHeight: lineHeight.lg,
    },
    bodySmall: {
        fontFamily: FontFamily.system,
        fontSize: size.sm,
        lineHeight: lineHeight.md,
    },
    label: {
        fontFamily: FontFamily.system,
        fontSize: size.xs,
        lineHeight: lineHeight.xs,
        fontWeight: '600',
        letterSpacing: letterSpacing.wide,
        textTransform: 'uppercase',
    },
    caption: {
        fontFamily: FontFamily.system,
        fontSize: size.sm,
        lineHeight: lineHeight.md,
    },
    quote: {
        fontFamily: FontFamily.systemSerif,
        fontSize: size.lg,
        lineHeight: lineHeight.xl,
        fontStyle: 'italic',
    },
    button: {
        fontFamily: FontFamily.system,
        fontSize: size.md,
        lineHeight: lineHeight.md,
        fontWeight: '600',
    },
};

const VARIANTS: Record<ThemeStyle, Record<TextVariant, TextStyle>> = { cloth, colossal, classic };

/** Variants whose natural tone is not `primary`. */
const DEFAULT_TONE: Partial<Record<TextVariant, TextProps['tone']>> = {
    label: 'accent',
    caption: 'tertiary',
    bodySmall: 'secondary',
    quote: 'primary',
};

export function Text({ variant = 'body', tone, style, children, ...rest }: TextProps) {
    const { colors, style: themeStyle } = useTheme();
    const resolved = tone ?? DEFAULT_TONE[variant] ?? 'primary';

    return (
        <RNText
            style={[VARIANTS[themeStyle][variant], { color: toneColor(resolved, colors) }, style]}
            {...rest}
        >
            {children}
        </RNText>
    );
}

/** Escape hatch for code that needs the raw variant style, e.g. TextInput. */
export function textStyle(themeStyle: ThemeStyle, variant: TextVariant): TextStyle {
    return StyleSheet.flatten(VARIANTS[themeStyle][variant]);
}
