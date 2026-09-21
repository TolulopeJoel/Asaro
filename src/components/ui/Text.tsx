/**
 * Typed text.
 *
 * Callers ask for a role — `title`, `label`, `quote` — and the active style
 * decides the face, size and weight. Cloth answers in Fraunces over Work Sans;
 * Colossal answers in Archivo and lets weight do the hierarchy.
 *
 * Every value is taken from the approved mockup, design/all-screens.html — the
 * `.cl-*` rules for Cloth, `.co-*` for Colossal. Each variant below names the
 * rule it implements, so a drift from the design is a one-line diff to find.
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
    | 'onHero' | 'success' | 'warning' | 'danger' | 'info';
    children?: React.ReactNode;
}

function toneColor(tone: TextProps['tone'], colors: ThemeColors): string {
    switch (tone) {
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
 * The mockup's em tracking, resolved against a concrete size.
 *
 * Rounded to 0.1px: RN will happily take -0.775, but a tenth is already below
 * what a device can render, and the rounded number is the one a designer can
 * check against the mockup.
 */
function track(px: number, variant: TextVariant, styleIndex: 0 | 1): number {
    const em = tracking[variant as keyof typeof tracking];
    if (!em) return 0;
    return Math.round(px * em[styleIndex] * 10) / 10;
}

const CLOTH = 0;
const COLOSSAL = 1;

/**
 * Cloth — Fraunces over Work Sans.
 *
 * Every size, line height and tracking below is the value the approved mockup
 * declares for that role (design/all-screens.html, the `.cl-*` rules). Where a
 * role has no mockup rule — `quote` — it keeps the size it already had.
 */
const cloth: Record<TextVariant, TextStyle> = {
    // Cloth has no colossal slot; its largest element is the stat numeral.
    // .cl-statn
    hero: {
        fontFamily: FontFamily.displayHeavy,
        fontSize: size.xxxl,
        lineHeight: lineHeight.xxxl,
        letterSpacing: track(size.xxxl, 'hero', CLOTH),
    },
    // .cl-htitle — the hero band title.
    display: {
        fontFamily: FontFamily.displayHeavy,
        fontSize: size.xxl,
        lineHeight: lineHeight.xxl,
        letterSpacing: track(size.xxl, 'display', CLOTH),
    },
    // .cl-h.xl
    headline: {
        fontFamily: FontFamily.display,
        fontSize: size.xxlPlus,
        lineHeight: lineHeight.xxlPlus,
        letterSpacing: track(size.xxlPlus, 'headline', CLOTH),
    },
    // .cl-h.lg
    title: {
        fontFamily: FontFamily.display,
        fontSize: size.xlPlus,
        lineHeight: lineHeight.xlPlus,
        letterSpacing: track(size.xlPlus, 'title', CLOTH),
    },
    // .cl-h.md
    subtitle: {
        fontFamily: FontFamily.display,
        fontSize: size.xlMinus,
        lineHeight: lineHeight.xlMinus,
        letterSpacing: track(size.xlMinus, 'subtitle', CLOTH),
    },
    // .cl-ref
    reference: {
        fontFamily: FontFamily.display,
        fontSize: size.lgHalf,
        lineHeight: lineHeight.lgHalf,
        letterSpacing: track(size.lgHalf, 'reference', CLOTH),
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
        letterSpacing: track(size.xsHalf, 'label', CLOTH),
        textTransform: 'uppercase',
    },
    // .cl-bookc / .cl-statl
    caption: {
        fontFamily: FontFamily.body,
        fontSize: size.xsPlus,
        lineHeight: lineHeight.xsPlus,
        letterSpacing: track(size.xsPlus, 'caption', CLOTH),
    },
    // .cl-when
    meta: {
        fontFamily: FontFamily.body,
        fontSize: size.xsHalf,
        lineHeight: lineHeight.xsHalf,
        letterSpacing: track(size.xsHalf, 'meta', CLOTH),
        textTransform: 'uppercase',
    },
    // .cl-tab — the segmented control (.cl-seg) shares this role at .09em,
    // a third of a pixel tighter than the tab bar. One role covers both.
    tab: {
        fontFamily: FontFamily.bodySemibold,
        fontSize: size.xsPlus,
        lineHeight: lineHeight.xsPlus,
        letterSpacing: track(size.xsPlus, 'tab', CLOTH),
        textTransform: 'uppercase',
    },
    // .cl-cell / .cl-pill / .cl-bookn / .cl-avatar
    cell: {
        fontFamily: FontFamily.display,
        fontSize: size.mdPlus,
        lineHeight: lineHeight.mdPlus,
        letterSpacing: track(size.mdPlus, 'cell', CLOTH),
    },
    quote: {
        fontFamily: FontFamily.displayItalic,
        fontSize: size.lg,
        lineHeight: lineHeight.xl,
        fontStyle: 'italic',
    },
    // .cl-btn — note Cloth's button is not uppercased; Colossal's is.
    button: {
        fontFamily: FontFamily.bodySemibold,
        fontSize: size.smPlus,
        lineHeight: lineHeight.smPlus,
        letterSpacing: track(size.smPlus, 'button', CLOTH),
    },
};

/**
 * Colossal — Archivo throughout, weight carrying the hierarchy.
 * Mirrors the mockup's `.co-*` rules.
 */
const colossal: Record<TextVariant, TextStyle> = {
    // .co-giant.n — the one colossal element on a screen.
    hero: {
        fontFamily: FontFamily.monoBlack,
        fontSize: size.colossal,
        lineHeight: lineHeight.colossal,
        letterSpacing: track(size.colossal, 'hero', COLOSSAL),
    },
    // .co-h.lg
    display: {
        fontFamily: FontFamily.monoBlack,
        fontSize: size.display,
        lineHeight: lineHeight.display,
        letterSpacing: track(size.display, 'display', COLOSSAL),
    },
    /**
     * .co-h.lg — Colossal has one big head, so `headline` and `display` agree.
     * The duplication is deliberate: Cloth needs the two steps, and a style is
     * allowed to answer a role with the same value it gave another.
     */
    headline: {
        fontFamily: FontFamily.monoBlack,
        fontSize: size.display,
        lineHeight: lineHeight.display,
        letterSpacing: track(size.display, 'headline', COLOSSAL),
    },
    // .co-h.md
    title: {
        fontFamily: FontFamily.monoBlack,
        fontSize: size.xl2,
        lineHeight: lineHeight.xl2,
        letterSpacing: track(size.xl2, 'title', COLOSSAL),
    },
    // .co-h.sm
    subtitle: {
        fontFamily: FontFamily.monoBlack,
        fontSize: size.lgPlus,
        lineHeight: lineHeight.lgPlus,
        letterSpacing: track(size.lgPlus, 'subtitle', COLOSSAL),
    },
    // .co-ref
    reference: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.md,
        lineHeight: lineHeight.md,
        letterSpacing: track(size.md, 'reference', COLOSSAL),
    },
    // .co-input, and running text.
    body: {
        fontFamily: FontFamily.mono,
        fontSize: size.md,
        lineHeight: lineHeight.lg,
    },
    // .co-snip
    bodySmall: {
        fontFamily: FontFamily.mono,
        fontSize: size.smHalf,
        lineHeight: lineHeight.smHalf,
    },
    // .co-sub
    sub: {
        fontFamily: FontFamily.mono,
        fontSize: size.mdHalf,
        lineHeight: lineHeight.mdHalf,
    },
    // .co-label / .co-giantl
    label: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.xs,
        lineHeight: lineHeight.xs,
        letterSpacing: track(size.xs, 'label', COLOSSAL),
        textTransform: 'uppercase',
    },
    // .co-bookc
    caption: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.xs,
        lineHeight: lineHeight.xs,
        letterSpacing: track(size.xs, 'caption', COLOSSAL),
    },
    // .co-when
    meta: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.xs,
        lineHeight: lineHeight.xs,
        letterSpacing: track(size.xs, 'meta', COLOSSAL),
        textTransform: 'uppercase',
    },
    // .co-tab — as in Cloth, .co-seg and .co-mark share this role.
    tab: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.xsPlus,
        lineHeight: lineHeight.xsPlus,
        letterSpacing: track(size.xsPlus, 'tab', COLOSSAL),
        textTransform: 'uppercase',
    },
    // .co-cell / .co-pill / .co-bookn / .co-avatar
    cell: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.mdPlus,
        lineHeight: lineHeight.mdPlus,
        letterSpacing: track(size.mdPlus, 'cell', COLOSSAL),
    },
    quote: {
        fontFamily: FontFamily.mono,
        fontSize: size.lg,
        lineHeight: lineHeight.xl,
    },
    // .co-btn
    button: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.sm,
        lineHeight: lineHeight.sm,
        letterSpacing: track(size.sm, 'button', COLOSSAL),
        textTransform: 'uppercase',
    },
};


const VARIANTS: Record<ThemeStyle, Record<TextVariant, TextStyle>> = { cloth, colossal };

/**
 * Variants whose natural tone is not `primary`, per style.
 *
 * This is per-style because the mockup makes it so: Cloth's eyebrow is ochre
 * (`.cl-label{color:var(--ochre)}`) while Colossal holds ochre in reserve for
 * today and sets its eyebrow in grey (`.co-label{color:var(--ink3)}`). A single
 * shared default would have to get one of the two styles wrong.
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
    colossal: {
        label: 'tertiary',
        meta: 'tertiary',
        caption: 'tertiary',
        bodySmall: 'secondary',
        sub: 'secondary',
        tab: 'tertiary',
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
