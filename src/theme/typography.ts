import { Platform } from 'react-native';

export const Typography = {
    fontFamily: {
        regular: Platform.select({ ios: 'System', android: 'Roboto' }),
        medium: Platform.select({ ios: 'System', android: 'Roboto-Medium' }),
        bold: Platform.select({ ios: 'System', android: 'Roboto-Bold' }),
        serif: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    size: {
        xs: 10,
        sm: 12,
        md: 14,
        lg: 16,
        xl: 20,
        xxl: 24,
        xxxl: 32,
        display: 40,
    },
    lineHeight: {
        xs: 14,
        sm: 16,
        md: 20,
        lg: 24,
        xl: 28,
        xxl: 32,
        xxxl: 40,
        display: 48,
    },
    letterSpacing: {
        tight: -0.5,
        normal: 0,
        wide: 0.5,
        wider: 1,
    },
    weight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
    } as const,
};
