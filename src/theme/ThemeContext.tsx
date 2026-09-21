import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, useColorScheme } from 'react-native';
import { Colors, ThemeColors } from './colors';
import { ThemeShape, clothShape, colossalShape } from './shape';
import { STORAGE_KEYS } from '../storage/storageKeys';

type ThemeMode = 'light' | 'dark' | 'system';

/**
 * The two styles.
 *
 *   cloth     — Àdìrẹ indigo on undyed cotton. The default.
 *   colossal  — Locked In. Black, white, one ochre.
 *
 * Locked In used to be a boolean read straight from AsyncStorage by four
 * separate screens. It is a style, so it lives here as one.
 */
export type ThemeStyle = 'cloth' | 'colossal';

export const THEME_STYLES: { key: ThemeStyle; label: string; blurb: string }[] = [
    { key: 'cloth', label: 'Cloth', blurb: 'Àdìrẹ indigo on undyed cotton' },
    { key: 'colossal', label: 'Locked In', blurb: 'Stark black. One thing at a time' },
];

/** Emitted when the style changes, so unsubscribed screens can refresh. */
export const LOCKED_IN_EVENT = 'locked-in-mode-changed';

const PALETTES: Record<ThemeStyle, ThemeColors> = {
    cloth: Colors.cloth,
    colossal: Colors.colossal,
};

const SHAPES: Record<ThemeStyle, ThemeShape> = {
    cloth: clothShape,
    colossal: colossalShape,
};

interface ThemeContextType {
    theme: ThemeMode;
    colors: ThemeColors;
    shape: ThemeShape;
    setTheme: (mode: ThemeMode) => void;
    isDark: boolean;

    style: ThemeStyle;
    setStyle: (style: ThemeStyle) => Promise<void>;

    /** True while Colossal is active. Kept because several screens branch on it. */
    isLockedIn: boolean;
    /** Back-compat for the old boolean toggle; prefer `setStyle`. */
    setLockedIn: (on: boolean) => Promise<void>;

    /** True once the stored preference has been read, so launch doesn't flash. */
    ready: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'system',
    colors: Colors.cloth,
    shape: clothShape,
    setTheme: () => { },
    isDark: false,
    style: 'cloth',
    setStyle: async () => { },
    isLockedIn: false,
    setLockedIn: async () => { },
    ready: false,
});

const THEME_STORAGE_KEY = 'user_theme_preference';

function isStyle(value: string | null): value is ThemeStyle {
    return value === 'cloth' || value === 'colossal';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [theme, setThemeState] = useState<ThemeMode>('light');
    const [style, setStyleState] = useState<ThemeStyle>('cloth');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;

        Promise.all([
            AsyncStorage.getItem(THEME_STORAGE_KEY),
            AsyncStorage.getItem(STORAGE_KEYS.THEME_STYLE),
            AsyncStorage.getItem(STORAGE_KEYS.LOCKED_IN_MODE),
        ]).then(([savedTheme, savedStyle, legacyLockedIn]) => {
            if (cancelled) return;
            if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
                setThemeState(savedTheme);
            }
            // Anyone who had Locked In switched on before styles existed keeps
            // it; everyone else lands on the default.
            if (isStyle(savedStyle)) setStyleState(savedStyle);
            else if (legacyLockedIn === 'true') setStyleState('colossal');
            setReady(true);
        }).catch(() => {
            if (!cancelled) setReady(true);
        });

        const sub = DeviceEventEmitter.addListener(LOCKED_IN_EVENT, (on: boolean) => {
            setStyleState((current) => (on ? 'colossal' : current === 'colossal' ? 'cloth' : current));
        });

        return () => { cancelled = true; sub.remove(); };
    }, []);

    const setTheme = useCallback(async (mode: ThemeMode) => {
        setThemeState(mode);
        await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    }, []);

    const setStyle = useCallback(async (next: ThemeStyle) => {
        setStyleState(next);
        await AsyncStorage.multiSet([
            [STORAGE_KEYS.THEME_STYLE, next],
            // kept in step so any code still reading the old key stays correct
            [STORAGE_KEYS.LOCKED_IN_MODE, String(next === 'colossal')],
        ]);
        DeviceEventEmitter.emit(LOCKED_IN_EVENT, next === 'colossal');
    }, []);

    const setLockedIn = useCallback(async (on: boolean) => {
        await setStyle(on ? 'colossal' : 'cloth');
    }, [setStyle]);

    const isDark = useMemo(
        () => theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark'),
        [theme, systemColorScheme]
    );

    const colors = PALETTES[style];
    const shape = SHAPES[style];
    const isLockedIn = style === 'colossal';

    const contextValue = useMemo(
        () => ({ theme, colors, shape, setTheme, isDark, style, setStyle, isLockedIn, setLockedIn, ready }),
        [theme, colors, shape, setTheme, isDark, style, setStyle, isLockedIn, setLockedIn, ready]
    );

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
