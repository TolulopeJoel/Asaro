export const Colors = {
    light: {
        // Backgrounds - warm, elegant but not muted
        background: '#f7f4ef',           // Warm paper white
        backgroundElevated: '#fdfbf7',   // Clean cream
        backgroundSubtle: '#f2ede5',     // Warm linen

        // Text - clear and readable
        textPrimary: '#3a3530',          // Rich dark brown
        textSecondary: '#7a6f63',        // Warm brown
        textTertiary: '#9d9388',         // Light brown
        textMuted: '#b5aca0',            // Subtle brown

        // Borders - elegant divisions
        border: '#e8e2d8',               // Warm border
        borderSubtle: '#f0ebe3',         // Subtle
        borderStrong: '#d9cfc1',         // Defined
        borderActive: '#e18f43',         // VIBRANT ORANGE (from logo!)

        // Accents - VIBRANT and beautiful
        accent: '#e18f43',               // VIBRANT ORANGE from logo! 🧡
        accentDark: '#c97a35',           // Rich orange
        accentLight: '#eca866',          // Bright orange

        // Secondary accent - beautiful dusty rose
        accentSecondary: '#d4a5a5',      // Dusty rose from logo
        accentSecondaryDark: '#c28f8f',  // Deeper rose
        accentSecondaryLight: '#e0b8b8', // Soft rose

        // Semantic Colors
        cardBackground: '#fdfbf7',
        cardBorder: '#e8e2d8',
        cardHover: '#f7f3eb',
        searchBackground: '#f2ede5',

        // Buttons - vibrant and inviting
        buttonPrimary: '#e18f43',        // VIBRANT ORANGE
        buttonPrimaryText: '#ffffff',
        buttonSecondary: '#fdfbf7',
        buttonSecondaryText: '#e18f43',
        buttonSecondaryBorder: '#d9cfc1',

        // Status & Indicators - vibrant
        indicatorActive: '#e18f43',      // Vibrant orange
        indicatorInactive: '#e8e2d8',

        // Special UI Elements
        badge: '#faf7f2',
        badgeBorder: '#e8e2d8',
        badgeText: '#e18f43',            // Vibrant orange
        draftBar: '#faf7f2',
        draftBarBorder: '#e18f43',       // Vibrant orange border
        draftIconBg: '#f2ede5',

        // Tab Navigation - vibrant accents
        tabBar: '#fdfbf7',
        tabIndicator: '#e18f43',         // VIBRANT ORANGE
        tabLabel: '#7a6f63',
        tabLabelActive: '#e18f43',       // VIBRANT ORANGE when active

        // Icons - vibrant presence
        icon: '#e18f43',                 // VIBRANT ORANGE
        iconSecondary: '#fdfbf7',
        iconActive: '#c97a35',

        // Backward compatibility aliases
        primary: '#e18f43',
        card: '#fdfbf7',
        text: '#3a3530',
    },
    dark: {
        // Backgrounds - elegant dark
        background: '#1c1a17',           // Rich dark
        backgroundElevated: '#26241f',   // Elevated
        backgroundSubtle: '#2d2a24',     // Subtle

        // Text - clear in darkness
        textPrimary: '#e5e0d8',          // Bright text
        textSecondary: '#b8b0a5',        // Clear secondary
        textTertiary: '#8a8278',         // Visible tertiary
        textMuted: '#6a6560',            // Subtle

        // Borders - defined
        border: '#3a3632',               // Clear border
        borderSubtle: '#2f2d2a',         // Subtle
        borderStrong: '#4a4540',         // Strong
        borderActive: '#e18f43',         // VIBRANT ORANGE

        // Accents - VIBRANT in dark mode too!
        accent: '#e18f43',               // VIBRANT ORANGE (same as light!)
        accentDark: '#c97a35',           // Rich orange
        accentLight: '#eca866',          // Bright orange

        // Secondary accent - beautiful rose
        accentSecondary: '#d4a5a5',      // Dusty rose
        accentSecondaryDark: '#c28f8f',  // Deeper
        accentSecondaryLight: '#e0b8b8', // Lighter

        // Semantic Colors
        cardBackground: '#26241f',
        cardBorder: '#3a3632',
        cardHover: '#2d2a24',
        searchBackground: '#2d2a24',

        // Buttons - vibrant
        buttonPrimary: '#e18f43',        // VIBRANT ORANGE
        buttonPrimaryText: '#1c1a17',    // Dark text on orange
        buttonSecondary: '#26241f',
        buttonSecondaryText: '#e18f43',
        buttonSecondaryBorder: '#3a3632',

        // Status & Indicators - vibrant
        indicatorActive: '#e18f43',      // Vibrant orange
        indicatorInactive: '#3a3632',

        // Special UI Elements
        badge: '#2d2a24',
        badgeBorder: '#3a3632',
        badgeText: '#e18f43',            // Vibrant orange
        draftBar: '#26241f',
        draftBarBorder: '#e18f43',       // Vibrant orange
        draftIconBg: '#2d2a24',

        // Tab Navigation - vibrant
        tabBar: '#26241f',
        tabIndicator: '#e18f43',         // VIBRANT ORANGE
        tabLabel: '#8a8278',
        tabLabelActive: '#e18f43',       // VIBRANT ORANGE

        // Icons - vibrant
        icon: '#e18f43',                 // VIBRANT ORANGE
        iconSecondary: '#1c1a17',
        iconActive: '#eca866',

        // Backward compatibility aliases
        primary: '#e18f43',
        card: '#26241f',
        text: '#e5e0d8',
    },
};

export type ThemeColors = typeof Colors.light;
