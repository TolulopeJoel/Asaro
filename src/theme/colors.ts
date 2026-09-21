/**
 * Two styles, one token set.
 *
 *   cloth     — the default. Àdìrẹ indigo on undyed cotton, ochre for "today".
 *   colossal  — Locked In. Black, white, one ochre, nothing else.
 *
 * Every screen reads these names, never a literal. If a colour is needed that
 * isn't here, it belongs here first — that is the whole point of the file.
 */

/**
 * The one colour that exists outside the themes.
 *
 * Android notification lights, the adaptive icon ground and the splash screen
 * are painted by the OS before any React code runs, so they cannot read a
 * theme. They are set in app.json and mirrored here.
 *
 * Note the mismatch this makes explicit: these platform surfaces are still the
 * original vibrant orange, while Cloth's accent is the deeper, less saturated
 * #c9762c that reads correctly on ecru. Colossal's accent is #e18f43, so the
 * icon currently matches Locked In rather than the default. Reconciling that
 * means regenerating the icon and splash assets, which is a brand decision
 * rather than a refactor — so it is flagged, not quietly changed.
 */
export const BRAND_ACCENT = '#E18F43';

/** Shape every palette must satisfy. Adding a key here forces both styles to answer for it. */
export interface ThemeColors {
    // Grounds
    background: string;
    backgroundElevated: string;
    backgroundSubtle: string;

    // Text
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    textMuted: string;
    textInverse: string;
    /**
     * Secondary text *on the hero band*, which has its own ground and so needs
     * its own role — textSecondary is mixed for the page, not for indigo.
     */
    textOnHero: string;

    // Lines
    border: string;
    borderSubtle: string;
    borderStrong: string;
    borderActive: string;

    // Accents
    accent: string;
    accentDark: string;
    accentLight: string;
    accentSecondary: string;
    accentSecondaryDark: string;
    accentSecondaryLight: string;

    // Semantic — the four states that used to be hardcoded iOS hexes
    success: string;
    successSurface: string;
    warning: string;
    warningSurface: string;
    danger: string;
    dangerSurface: string;
    info: string;
    infoSurface: string;

    // Surfaces
    cardBackground: string;
    cardBorder: string;
    cardHover: string;
    searchBackground: string;

    // Buttons
    buttonPrimary: string;
    buttonPrimaryText: string;
    buttonSecondary: string;
    buttonSecondaryText: string;
    buttonSecondaryBorder: string;

    // Indicators
    indicatorActive: string;
    indicatorInactive: string;

    // Chrome
    badge: string;
    badgeBorder: string;
    badgeText: string;
    draftBar: string;
    draftBarBorder: string;
    draftIconBg: string;

    tabBar: string;
    tabIndicator: string;
    tabLabel: string;
    tabLabelActive: string;

    icon: string;
    iconSecondary: string;
    iconActive: string;

    /**
     * Seven steps, Sunday to Saturday, shown when a whole week is complete.
     *
     * This replaces a hardcoded iOS rainbow. The celebration was worth keeping
     * — a finished week should look like something — but seven system hues
     * belonged to neither palette. Cloth reads as a cloth lowered further into
     * the vat with each dip; Colossal warms from white to ochre.
     */
    celebration: readonly string[];

    /** Identity colours for avatars. Distinguishable, and still in-palette. */
    series: readonly string[];

    /** Pattern ink. The motif is drawn in this colour at `patternOpacity`. */
    patternInk: string;
    patternOpacity: number;
    /** Ink for the woven "today / selected / done" mark. */
    markInk: string;

    // Back-compat aliases. Existing screens still reference these; do not add more.
    primary: string;
    card: string;
    text: string;
}

/**
 * Cloth — the default.
 *
 * Indigo is the ink, not the furniture: body text is #17263f rather than a
 * near-black, so the identity is present on every screen without announcing
 * itself. Ochre means exactly one thing — today — so it always reads as
 * emphasis rather than decoration.
 */
export const cloth: ThemeColors = {
    background: '#efe6d8',
    backgroundElevated: '#f4ede1',
    backgroundSubtle: '#e3d6c1',

    textPrimary: '#17263f',
    textSecondary: '#4e5c70',
    textTertiary: '#6b7787',
    textMuted: '#8b8371',
    textInverse: '#efe6d8',
    textOnHero: '#a9b6c9',

    border: '#d8cab2',
    borderSubtle: '#e3d6c1',
    borderStrong: '#c3b294',
    borderActive: '#c9762c',

    accent: '#c9762c',
    accentDark: '#a85e1d',
    accentLight: '#dd9750',

    accentSecondary: '#17263f',
    accentSecondaryDark: '#0f1b2e',
    accentSecondaryLight: '#22385a',

    success: '#3f6b46',
    successSurface: '#dfe6d9',
    warning: '#9a6a1c',
    warningSurface: '#f0e3c8',
    danger: '#9c3324',
    dangerSurface: '#f0d9d4',
    info: '#17263f',
    infoSurface: '#dbe0e8',

    cardBackground: '#e3d6c1',
    cardBorder: '#d8cab2',
    cardHover: '#dccfb7',
    searchBackground: '#e3d6c1',

    buttonPrimary: '#17263f',
    buttonPrimaryText: '#efe6d8',
    buttonSecondary: 'transparent',
    buttonSecondaryText: '#4e5c70',
    buttonSecondaryBorder: '#d8cab2',

    indicatorActive: '#c9762c',
    indicatorInactive: '#d8cab2',

    badge: '#e3d6c1',
    badgeBorder: '#d8cab2',
    badgeText: '#c9762c',
    draftBar: '#e3d6c1',
    draftBarBorder: '#c9762c',
    draftIconBg: '#dccfb7',

    tabBar: '#17263f',
    tabIndicator: '#c9762c',
    tabLabel: '#8fa0b6',
    tabLabelActive: '#c9762c',

    icon: '#c9762c',
    iconSecondary: '#efe6d8',
    iconActive: '#a85e1d',

    celebration: ['#17263f', '#234061', '#35587f', '#5b6f7c', '#8a7a63', '#b3814a', '#c9762c'],
    series: ['#17263f', '#c9762c', '#4e5c70', '#9c5a3c', '#1f4a4f', '#a5706f'],

    patternInk: '#c9762c',
    patternOpacity: 0.16,
    markInk: '#c9762c',

    primary: '#c9762c',
    card: '#e3d6c1',
    text: '#17263f',
};

/**
 * Colossal — Locked In.
 *
 * Weight carries the whole hierarchy. One colossal element per screen at most
 * (Settings, Permissions and the reference picker deliberately use none), and
 * ochre is held in reserve for today.
 */
export const colossal: ThemeColors = {
    background: '#000000',
    backgroundElevated: '#101010',
    backgroundSubtle: '#1e1e1e',

    textPrimary: '#ffffff',
    textSecondary: '#8a8a8a',
    textTertiary: '#5c5c5c',
    textMuted: '#3d3d3d',
    textInverse: '#000000',
    textOnHero: '#8a8a8a',

    border: '#1e1e1e',
    borderSubtle: '#141414',
    borderStrong: '#333333',
    borderActive: '#e18f43',

    accent: '#e18f43',
    accentDark: '#c4762f',
    accentLight: '#eda869',

    accentSecondary: '#ffffff',
    accentSecondaryDark: '#cccccc',
    accentSecondaryLight: '#ffffff',

    success: '#6fbf7f',
    successSurface: '#12200f',
    warning: '#e0a44a',
    warningSurface: '#241a09',
    danger: '#e2685a',
    dangerSurface: '#26100d',
    info: '#8fb6e0',
    infoSurface: '#0d1620',

    cardBackground: '#101010',
    cardBorder: '#1e1e1e',
    cardHover: '#161616',
    searchBackground: '#101010',

    buttonPrimary: '#ffffff',
    buttonPrimaryText: '#000000',
    buttonSecondary: 'transparent',
    buttonSecondaryText: '#8a8a8a',
    buttonSecondaryBorder: '#1e1e1e',

    indicatorActive: '#e18f43',
    indicatorInactive: '#1e1e1e',

    badge: '#101010',
    badgeBorder: '#1e1e1e',
    badgeText: '#e18f43',
    draftBar: '#101010',
    draftBarBorder: '#e18f43',
    draftIconBg: '#1e1e1e',

    tabBar: '#000000',
    tabIndicator: '#ffffff',
    tabLabel: '#5c5c5c',
    tabLabelActive: '#ffffff',

    icon: '#e18f43',
    iconSecondary: '#000000',
    iconActive: '#eda869',

    celebration: ['#ffffff', '#f0dcc6', '#eec9a0', '#ecb87f', '#e9a862', '#e69a4f', '#e18f43'],
    series: ['#ffffff', '#e18f43', '#8a8a8a', '#c4762f', '#5c5c5c', '#eda869'],

    // Colossal wears no cloth. The pattern component renders nothing here.
    patternInk: 'transparent',
    patternOpacity: 0,
    markInk: '#e18f43',

    primary: '#e18f43',
    card: '#101010',
    text: '#ffffff',
};

export const Colors = {
    cloth,
    colossal,

    /**
     * Back-compat. `light`/`dark` both resolve to Cloth for now — Cloth's dark
     * counterpart is the next palette to design, and pointing `dark` at
     * Colossal would collapse the distinction between dark mode and Locked In.
     */
    light: cloth,
    dark: cloth,
    lockedIn: colossal,
};
