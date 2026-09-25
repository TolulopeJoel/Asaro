/**
 * Spacing, radius and elevation.
 *
 * Both styles are flat and square: Cloth's edges come from colour blocks and
 * hairlines. The radius set is deliberately tiny —
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
        screenPaddingTight: 22,   // the narrower gutter, for screens that ask for it
        cardPadding: 18,
        gutter: 16,
        heroPaddingTop: 52,
        tabBarPadding: 30,
    },

    /**
     * The design has exactly two radii: square, and round for avatars.
     *
     * Cloth is flat and square — every panel, cell, input
     * and button in design/all-screens.html is `border-radius:0`, and the only
     * curve in the whole mockup is `.cl-avatar{border-radius:50%}`. The 8px
     * that screens were reaching for was never in the design; it is the single
     * biggest reason the built app read as a different product from the
     * approved one.
     *
     * `sm`/`md`/`lg`/`xl` are kept as aliases of `none` so the ~75 existing
     * call sites land on the real system instead of a radius it doesn't have.
     * New code should ask the theme — `shape.card`, `shape.button`,
     * `shape.input`, `shape.chip` — which is the axis a future style can move.
     */
    borderRadius: {
        none: 0,
        round: 9999,
        /** @deprecated was 2px. Aliased to `none`. Use `shape.chip`. */
        sm: 0,
        /** @deprecated was 4px. Aliased to `none`. Use `shape.input`. */
        md: 0,
        /** @deprecated was 8px. Aliased to `none`. Use `shape.card`. */
        lg: 0,
        /** @deprecated was 24px. Aliased to `none`. Use `shape.card`. */
        xl: 0,
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
        /** Innermost ring. Subsequent rings step out by `step`. */
        radius: 4.5,
        /**
         * Radial repeat interval.
         *
         * The mockup's motif is a repeating-radial-gradient that restarts every
         * 12px, so rings land at 4.5, 16.5 and 28.5. Deriving them from this
         * rather than an eyeballed offset is what keeps the app's cloth
         * identical to the one that was approved.
         */
        step: 12,
        /** How many rings fit before the tile's corner. */
        count: 3,
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
    /**
     * The zigzag — a small decorative stand-in, not a resist pattern of its
     * own. Fills the space a hero band's search field would take on tabs that
     * have no field, so the band is the same height everywhere without
     * leaving a blank gap where the field would have been.
     */
    zigzag: {
        wavelength: 14,
        amplitude: 5,
        strokeWidth: 1.5,
    },
    /** Height of the divider strip under a hero band. */
    stripHeight: 14,
} as const;
