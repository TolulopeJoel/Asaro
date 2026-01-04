import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, ThemeColors } from './colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: ThemeMode;
    colors: ThemeColors;
    setTheme: (mode: ThemeMode) => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'system',
    colors: Colors.light,
    setTheme: () => { },
    isDark: false,
});

const THEME_STORAGE_KEY = 'user_theme_preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [theme, setThemeState] = useState<ThemeMode>('light');


    useEffect(() => {
        // Load saved theme preference
        AsyncStorage.getItem(THEME_STORAGE_KEY).then((savedTheme) => {
            if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
                setThemeState(savedTheme as ThemeMode);
            }

        });
    }, []);

    const setTheme = React.useCallback(async (mode: ThemeMode) => {
        setThemeState(mode);
        await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    }, []);

    const isDark = useMemo(
        () => theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark'),
        [theme, systemColorScheme]
    );

    const colors = useMemo(
        () => isDark ? Colors.dark : Colors.light,
        [isDark]
    );

    const contextValue = useMemo(
        () => ({ theme, colors, setTheme, isDark }),
        [theme, colors, setTheme, isDark]
    );

    // Don't block rendering - just use default theme until loaded
    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
