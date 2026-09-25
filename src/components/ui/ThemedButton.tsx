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
    const { colors, shape } = useTheme();
    const scale = useRef(new Animated.Value(1)).current;

    const spring = useCallback((to: number) => {
        Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
    }, [scale]);

    const surface: ViewStyle =
        variant === 'secondary'
            ? { backgroundColor: colors.buttonSecondary, borderWidth: Spacing.border.hairline, borderColor: colors.buttonSecondaryBorder }
            : variant === 'accent'
                ? { backgroundColor: colors.accent }
                : { backgroundColor: colors.buttonPrimary };

    const labelColor =
        variant === 'secondary' ? colors.buttonSecondaryText
            : variant === 'accent' ? colors.background
                : colors.buttonPrimaryText;

    const inactive = disabled || loading;

    /*
     * A refusing button is a muted surface, not the fill turned down.
     *
     * Opacity keeps the hue: the accent at 45% still reads as ochre, still
     * reads as the thing to press, and on Cloth's warm ground it reads as
     * ochre gone wrong rather than ochre withheld. The mockup draws the
     * hairline colour carrying tertiary text — one flat block that is plainly
     * not the primary action.
     */
    const mutedSurface: ViewStyle = { backgroundColor: colors.border, borderWidth: 0 };

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
                    styles.padCloth,
                    { borderRadius: shape.button },
                    surface,
                    block && styles.block,
                    inactive && mutedSurface,
                ]}
            >
                {loading
                    ? <ActivityIndicator size="small" color={colors.textTertiary} />
                    : (
                        <Text
                            variant="button"
                            style={{ color: inactive ? colors.textTertiary : labelColor }}
                        >
                            {label}
                        </Text>
                    )}
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
    block: { width: '100%', alignSelf: 'stretch' },
});
