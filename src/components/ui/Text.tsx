/**
 * Typed text. Callers ask for a role — `title`, `label`, `quote` — and the
 * active style decides face, size and weight; Cloth answers in Fraunces over
 * Work Sans.
 *
 * Every value comes from design/all-screens.html's `.cl-*` rules, and each
 * variant below names the rule it implements, so drift is a one-line diff.
 * Screens must never set `fontSize` or `fontFamily` directly.
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
    | 'onBand' | 'onHero' | 'success' | 'warning' | 'danger' | 'info';
    children?: React.ReactNode;
}

/**
 * `onBand` is the title of a <Hero>: Cloth's hero is an indigo band, so its
 * title is the ecru `textInverse`. It stays a named tone rather than a literal
 * so a style that draws no band can answer it differently.
 */
function toneColor(tone: TextProps['tone'], colors: ThemeColors): string {
    switch (tone) {
        case 'onBand': return colors.textInverse;
        case 'secondary': return colors.textSecondary;
        case 'tertiary': return colors.textTertiary;
        case 'muted': return colors.textMuted;
        case 'accent': return colors.accent;
        case 'inverse': return colors.textInverse;
        case 'onHero': return colors.textOnHero;
        case 'success': return colors.success;
        case 'warning': return colors.warning;
        case 'danger': return colors.danger;
        case 'info': return colors.info;
        default: return colors.textPrimary;
    }
}

const { size, lineHeight, tracking } = Typography;

/**
 * The mockup's em tracking, resolved against a concrete size. Rounded to 0.1px
 * — a tenth is already below what a device renders, and the rounded number is
 * the one a designer can check against the mockup.
 */
function track(px: number, variant: TextVariant): number {
    const em = tracking[variant as keyof typeof tracking];
    if (!em) return 0;
    return Math.round(px * em * 10) / 10;
}

/**
 * Cloth — Fraunces over Work Sans.
 *
 * Every size, line height and tracking below is the value the approved mockup
 * declares for that role (design/all-screens.html, the `.cl-*` rules). Where a
 * role has no mockup rule — `quote` — it keeps the size it already had.
 */
const cloth: Record<TextVariant, TextStyle> = {
    // Cloth's largest element is the stat numeral.
    // .cl-statn
    hero: {
        fontFamily: FontFamily.displayHeavy,
        fontSize: size.xxxl,
        lineHeight: lineHeight.xxxl,
        letterSpacing: track(size.xxxl, 'hero'),
    },
    /**
     * `.cl-statn` is the largest thing Cloth draws, so `heroSmall` answers
     * with the same value `hero` does.
     */
    // .cl-statn
    heroSmall: {
        fontFamily: FontFamily.displayHeavy,
        fontSize: size.xxxl,
        lineHeight: lineHeight.xxxl,
        letterSpacing: track(size.xxxl, 'heroSmall'),
    },
    // .cl-htitle — the hero band title.
    display: {
        fontFamily: FontFamily.displayHeavy,
        fontSize: size.xxl,
        lineHeight: lineHeight.xxl,
        letterSpacing: track(size.xxl, 'display'),
    },
    // .cl-h.xl
    headline: {
        fontFamily: FontFamily.display,
        fontSize: size.xxlPlus,
        lineHeight: lineHeight.xxlPlus,
        letterSpacing: track(size.xxlPlus, 'headline'),
    },
    // .cl-h.lg
    title: {
        fontFamily: FontFamily.display,
        fontSize: size.xlPlus,
        lineHeight: lineHeight.xlPlus,
        letterSpacing: track(size.xlPlus, 'title'),
    },
    // .cl-h.md
    subtitle: {
        fontFamily: FontFamily.display,
        fontSize: size.xlMinus,
        lineHeight: lineHeight.xlMinus,
        letterSpacing: track(size.xlMinus, 'subtitle'),
    },
    // .cl-ref
    reference: {
        fontFamily: FontFamily.display,
        fontSize: size.lgHalf,
        lineHeight: lineHeight.lgHalf,
        letterSpacing: track(size.lgHalf, 'reference'),
    },
    // .cl-input, and running text.
    body: {
        fontFamily: FontFamily.body,
        fontSize: size.md,
        lineHeight: lineHeight.lg,
    },
    // .cl-snip
    bodySmall: {
        fontFamily: FontFamily.body,
        fontSize: size.smPlus,
        lineHeight: lineHeight.smPlus,
    },
    // .cl-sub / .cl-hsub
    sub: {
        fontFamily: FontFamily.body,
        fontSize: size.mdHalf,
        lineHeight: lineHeight.mdHalf,
    },
    // .cl-label
    label: {
        fontFamily: FontFamily.bodySemibold,
        fontSize: size.xsHalf,
        lineHeight: lineHeight.xsHalf,
        letterSpacing: track(size.xsHalf, 'label'),
        textTransform: 'uppercase',
    },
    // .cl-bookc / .cl-statl
    caption: {
        fontFamily: FontFamily.body,
        fontSize: size.xsPlus,
        lineHeight: lineHeight.xsPlus,
        letterSpacing: track(size.xsPlus, 'caption'),
    },
    // .cl-when
    meta: {
        fontFamily: FontFamily.body,
        fontSize: size.xsHalf,
        lineHeight: lineHeight.xsHalf,
        letterSpacing: track(size.xsHalf, 'meta'),
        textTransform: 'uppercase',
    },
    // .cl-tab — the segmented control (.cl-seg) shares this role at .09em,
    // a third of a pixel tighter than the tab bar. One role covers both.
    tab: {
        fontFamily: FontFamily.bodySemibold,
        fontSize: size.xsPlus,
        lineHeight: lineHeight.xsPlus,
        letterSpacing: track(size.xsPlus, 'tab'),
        textTransform: 'uppercase',
    },
    // .cl-cell / .cl-pill / .cl-bookn / .cl-avatar
    cell: {
        fontFamily: FontFamily.display,
        fontSize: size.mdPlus,
        lineHeight: lineHeight.mdPlus,
        letterSpacing: track(size.mdPlus, 'cell'),
    },
    quote: {
        fontFamily: FontFamily.displayItalic,
        fontSize: size.lg,
        lineHeight: lineHeight.xl,
        fontStyle: 'italic',
    },
    // .cl-btn — note Cloth's button is not uppercased.
    button: {
        fontFamily: FontFamily.bodySemibold,
        fontSize: size.smPlus,
        lineHeight: lineHeight.smPlus,
        letterSpacing: track(size.smPlus, 'button'),
    },
};

const VARIANTS: Record<ThemeStyle, Record<TextVariant, TextStyle>> = { cloth };

/**
 * Variants whose natural tone is not `primary`, per style.
 *
 * Kept per-style because the mockup makes tone a style decision: Cloth's
 * eyebrow is ochre (`.cl-label{color:var(--ochre)}`), and another style would
 * be free to answer differently.
 */
const DEFAULT_TONE: Record<ThemeStyle, Partial<Record<TextVariant, TextProps['tone']>>> = {
    cloth: {
        label: 'accent',
        meta: 'secondary',
        caption: 'secondary',
        bodySmall: 'secondary',
        sub: 'secondary',
        tab: 'secondary',
        quote: 'primary',
    },
};

export function Text({ variant = 'body', tone, style, children, ...rest }: TextProps) {
    const { colors, style: themeStyle } = useTheme();
    const resolved = tone ?? DEFAULT_TONE[themeStyle][variant] ?? 'primary';

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
