/**
 * Spacing, radius and elevation.
 *
 * Both styles are flat and square: Cloth's edges come from colour blocks and
 * hairlines, Colossal's from weight. The radius set is deliberately tiny —
 * the app previously used 23 distinct border radii, which is the main reason
 * nothing looked like it belonged to the same product.
 */

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,

    layout: {
        screenPadding: 24,
        screenPaddingTight: 22,   // Colossal runs slightly narrower gutters
        cardPadding: 18,
        gutter: 16,
        heroPaddingTop: 52,
        tabBarPadding: 30,
    },

    /**
     * Four values, and `round` only for avatars and true pills.
     * If a new radius seems necessary, the answer is almost always `none`.
     */
    borderRadius: {
        none: 0,
        sm: 2,
        md: 4,
        lg: 8,
        round: 9999,
        /** @deprecated was 24px. Aliased to `lg` so unmigrated callers land on
         *  the real scale instead of keeping a radius the system doesn't have. */
        xl: 8,
    },

    /** Hairlines carry separation, not shadows. */
    border: {
        hairline: 1,
        strong: 2,
        marker: 3,
    },

    /** Minimum tap target. Grid cells and pills are sized against this. */
    touchTarget: 44,

    /**
     * Elevation presets. Both styles are flat, so `none` is the default and
     * `overlay` exists only for modals and the FAB, which must float above
     * content to be legible. Replaces 7 ad-hoc shadowOpacity values.
     */
    elevation: {
        none: {
            shadowColor: 'transparent',
            shadowOpacity: 0,
            shadowRadius: 0,
            shadowOffset: { width: 0, height: 0 },
            elevation: 0,
        },
        overlay: {
            shadowColor: '#000000',
            shadowOpacity: 0.28,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 12,
        },
    },
} as const;

/** Motif geometry, shared by the Pattern component and anything drawing marks. */
export const Motif = {
    /** Àdìrẹ onikọ — tied resist. The signature, hero bands only. */
    rings: {
        tile: 32,
        centre: 16,
        radius: 4.5,
        strokeWidth: 1,
    },
    /** Crosshatch — the supporting texture. ~38% ink: presence without weight. */
    crosshatch: {
        spacing: 7,
        strokeWidth: 1.5,
        opacity: 0.55,
    },
    /** The woven mark: today, selected chapters, completed days. */
    mark: {
        spacing: 6,
        strokeWidth: 1.5,
    },
    /** Height of the divider strip under a hero band. */
    stripHeight: 14,
} as const;
