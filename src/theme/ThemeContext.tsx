import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, useColorScheme } from 'react-native';
import { Colors, ThemeColors } from './colors';
import { STORAGE_KEYS } from '../storage/storageKeys';

type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Which of the two styles is active.
 *
 *   cloth     — the default
 *   colossal  — Locked In
 *
 * This used to be ad hoc: four screens read LOCKED_IN_MODE from AsyncStorage
 * themselves and imported `Colors.lockedIn` directly, so the two styles could
 * drift out of step. Locked In is a theme, so it lives in the theme.
 */
export type ThemeStyle = 'cloth' | 'colossal';

/** Emitted when Locked In is toggled, so non-subscribed screens can refresh. */
export const LOCKED_IN_EVENT = 'locked-in-mode-changed';

interface ThemeContextType {
    theme: ThemeMode;
    colors: ThemeColors;
    setTheme: (mode: ThemeMode) => void;
    isDark: boolean;

    style: ThemeStyle;
    isLockedIn: boolean;
    setLockedIn: (on: boolean) => Promise<void>;
    /** True once the stored preference has been read; avoids a Cloth flash on launch. */
    ready: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'system',
    colors: Colors.cloth,
    setTheme: () => { },
    isDark: false,
    style: 'cloth',
    isLockedIn: false,
    setLockedIn: async () => { },
    ready: false,
});

const THEME_STORAGE_KEY = 'user_theme_preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [theme, setThemeState] = useState<ThemeMode>('light');
    const [isLockedIn, setIsLockedIn] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;

        Promise.all([
            AsyncStorage.getItem(THEME_STORAGE_KEY),
            AsyncStorage.getItem(STORAGE_KEYS.LOCKED_IN_MODE),
        ]).then(([savedTheme, savedLockedIn]) => {
            if (cancelled) return;
            if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
                setThemeState(savedTheme);
            }
            setIsLockedIn(savedLockedIn === 'true');
            setReady(true);
        }).catch(() => {
            if (!cancelled) setReady(true);
        });

        // Settings writes the key directly today; keep listening so the theme
        // follows even from code paths that haven't moved to setLockedIn yet.
        const sub = DeviceEventEmitter.addListener(LOCKED_IN_EVENT, (on: boolean) => {
            setIsLockedIn(!!on);
        });

        return () => { cancelled = true; sub.remove(); };
    }, []);

    const setTheme = useCallback(async (mode: ThemeMode) => {
        setThemeState(mode);
        await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    }, []);

    const setLockedIn = useCallback(async (on: boolean) => {
        setIsLockedIn(on);
        await AsyncStorage.setItem(STORAGE_KEYS.LOCKED_IN_MODE, String(on));
        DeviceEventEmitter.emit(LOCKED_IN_EVENT, on);
    }, []);

    const isDark = useMemo(
        () => theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark'),
        [theme, systemColorScheme]
    );

    const style: ThemeStyle = isLockedIn ? 'colossal' : 'cloth';
    const colors = useMemo(() => (isLockedIn ? Colors.colossal : Colors.cloth), [isLockedIn]);

    const contextValue = useMemo(
        () => ({ theme, colors, setTheme, isDark, style, isLockedIn, setLockedIn, ready }),
        [theme, colors, setTheme, isDark, style, isLockedIn, setLockedIn, ready]
    );

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
