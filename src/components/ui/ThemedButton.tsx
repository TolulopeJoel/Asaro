/**
 * The button, in both styles.
 *
 * Named `ThemedButton` so it can live alongside the existing `Button` while
 * screens migrate. Press feedback is built in — the old code had 15 bare
 * TouchableOpacity call sites with no feedback and 31 ScalePressable ones
 * with it, so whether a tap felt like anything depended on which file you
 * were in.
 */
import React, { useCallback, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { Text } from './Text';

export interface ThemedButtonProps {
    label: string;
    onPress: () => void;
    /** primary = filled · secondary = outlined · accent = ochre fill */
    variant?: 'primary' | 'secondary' | 'accent';
    block?: boolean;
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    accessibilityHint?: string;
}

export function ThemedButton({
    label,
    onPress,
    variant = 'primary',
    block = false,
    disabled = false,
    loading = false,
    style,
    accessibilityHint,
}: ThemedButtonProps) {
    const { colors, shape, style: themeStyle } = useTheme();
    const scale = useRef(new Animated.Value(1)).current;

    const spring = useCallback((to: number) => {
        Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
    }, [scale]);

    const isColossal = themeStyle === 'colossal';

    const surface: ViewStyle =
        variant === 'secondary'
            ? { backgroundColor: colors.buttonSecondary, borderWidth: Spacing.border.hairline, borderColor: colors.buttonSecondaryBorder }
            : variant === 'accent'
                ? { backgroundColor: colors.accent }
                : { backgroundColor: colors.buttonPrimary };

    // Colossal's accent button sits on black, so its label must be black too.
    const labelColor =
        variant === 'secondary' ? colors.buttonSecondaryText
            : variant === 'accent' ? colors.background
                : colors.buttonPrimaryText;

    const inactive = disabled || loading;

    return (
        <Animated.View style={[{ transform: [{ scale }] }, block && styles.block, style]}>
            <Pressable
                onPress={onPress}
                onPressIn={() => !inactive && spring(0.97)}
                onPressOut={() => spring(1)}
                disabled={inactive}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint={accessibilityHint}
                accessibilityState={{ disabled: inactive, busy: loading }}
                style={[
                    styles.base,
                    isColossal ? styles.padColossal : styles.padCloth,
                    { borderRadius: shape.button },
                    surface,
                    block && styles.block,
                    inactive && styles.inactive,
                ]}
            >
                {loading
                    ? <ActivityIndicator size="small" color={labelColor} />
                    : <Text variant="button" style={{ color: labelColor }}>{label}</Text>}
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    base: {
        minHeight: Spacing.touchTarget,
        alignItems: 'center',
        justifyContent: 'center',

    },
    padCloth: { paddingVertical: Spacing.md + 1, paddingHorizontal: Spacing.xl - 2 },
    padColossal: { paddingVertical: Spacing.lg + 1, paddingHorizontal: Spacing.xl - 2 },
    block: { width: '100%', alignSelf: 'stretch' },
    inactive: { opacity: 0.45 },
});
