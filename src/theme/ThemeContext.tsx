import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, ThemeColors } from './colors';
import { ThemeShape, clothShape } from './shape';
import { STORAGE_KEYS } from '../storage/storageKeys';

type ThemeMode = 'light' | 'dark' | 'system';

/**
 * The styles.
 *
 *   cloth — Àdìrẹ indigo on undyed cotton. The only one today.
 *
 * The axis is kept with a single member on purpose: style is a real theme
 * dimension, and a second entry should slot in here rather than reintroduce
 * the per-screen branching this replaced.
 */
export type ThemeStyle = 'cloth';

export const THEME_STYLES: { key: ThemeStyle; label: string; blurb: string }[] = [
    { key: 'cloth', label: 'Cloth', blurb: 'Àdìrẹ indigo on undyed cotton' },
];

const PALETTES: Record<ThemeStyle, ThemeColors> = {
    cloth: Colors.cloth,
};

const SHAPES: Record<ThemeStyle, ThemeShape> = {
    cloth: clothShape,
};

interface ThemeContextType {
    theme: ThemeMode;
    colors: ThemeColors;
    shape: ThemeShape;
    setTheme: (mode: ThemeMode) => void;
    isDark: boolean;

    style: ThemeStyle;
    setStyle: (style: ThemeStyle) => Promise<void>;

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
    ready: false,
});

const THEME_STORAGE_KEY = 'user_theme_preference';

function isStyle(value: string | null): value is ThemeStyle {
    return value === 'cloth';
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
        ]).then(([savedTheme, savedStyle]) => {
            if (cancelled) return;
            if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
                setThemeState(savedTheme);
            }
            // A stored style from a removed style falls back to the default.
            if (isStyle(savedStyle)) setStyleState(savedStyle);
            setReady(true);
        }).catch(() => {
            if (!cancelled) setReady(true);
        });

        return () => { cancelled = true; };
    }, []);

    const setTheme = useCallback(async (mode: ThemeMode) => {
        setThemeState(mode);
        await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    }, []);

    const setStyle = useCallback(async (next: ThemeStyle) => {
        setStyleState(next);
        await AsyncStorage.setItem(STORAGE_KEYS.THEME_STYLE, next);
    }, []);

    const isDark = useMemo(
        () => theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark'),
        [theme, systemColorScheme]
    );

    const colors = PALETTES[style];
    const shape = SHAPES[style];

    const contextValue = useMemo(
        () => ({ theme, colors, shape, setTheme, isDark, style, setStyle, ready }),
        [theme, colors, shape, setTheme, isDark, style, setStyle, ready]
    );

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
