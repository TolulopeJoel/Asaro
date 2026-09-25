import React from 'react';
import {
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    View,
    ViewStyle,
} from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { ScalePressable } from './ScalePressable';
import { BouncingDots } from './BouncingDots';
import { textStyle } from './ui/Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
    label?: string;
    onPress: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: LucideIcon;
    iconPosition?: 'left' | 'right';
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    style?: StyleProp<ViewStyle>;
    labelStyle?: StyleProp<TextStyle>;
    children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    icon,
    iconPosition = 'left',
    loading = false,
    disabled = false,
    fullWidth = false,
    style,
    labelStyle,
    children,
}) => {
    const { colors, style: themeStyle } = useTheme();

    const getVariantStyles = (): StyleProp<ViewStyle> => {
        switch (variant) {
            case 'primary':
                return {
                    backgroundColor: colors.buttonPrimary,
                    borderColor: 'transparent',
                };
            case 'secondary':
                return {
                    backgroundColor: colors.buttonSecondary,
                    borderColor: colors.buttonSecondaryBorder,
                    borderWidth: 1,
                };
            case 'outline':
                return {
                    backgroundColor: 'transparent',
                    borderColor: colors.accent,
                    borderWidth: 1,
                };
            case 'ghost':
                return {
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                };
            case 'danger':
                return {
                    backgroundColor: colors.danger,
                    borderColor: 'transparent',
                };
            default:
                return {};
        }
    };

    const getVariantLabelStyles = (): StyleProp<TextStyle> => {
        switch (variant) {
            case 'primary':
                return { color: colors.buttonPrimaryText };
            case 'secondary':
                return { color: colors.buttonSecondaryText };
            case 'outline':
            case 'ghost':
                return { color: colors.accent };
            case 'danger':
                return { color: '#ffffff' };
            default:
                return {};
        }
    };

    const getSizeStyles = (): StyleProp<ViewStyle> => {
        switch (size) {
            case 'sm':
                return {
                    paddingVertical: Spacing.xs,
                    paddingHorizontal: Spacing.sm,
                    borderRadius: Spacing.borderRadius.sm,
                };
            case 'lg':
                return {
                    paddingVertical: 18,
                    paddingHorizontal: Spacing.xl,
                    borderRadius: Spacing.borderRadius.lg,
                };
            case 'md':
            default:
                return {
                    paddingVertical: Spacing.md,
                    paddingHorizontal: Spacing.lg,
                    borderRadius: Spacing.borderRadius.md,
                };
        }
    };

    const getSizeLabelStyles = (): StyleProp<TextStyle> => {
        switch (size) {
            case 'sm':
                return { fontSize: Typography.size.sm };
            case 'lg':
                return { fontSize: Typography.size.lg, fontWeight: Typography.weight.semibold };
            case 'md':
            default:
                return { fontSize: Typography.size.md, fontWeight: Typography.weight.medium };
        }
    };

    const combinedStyle = [
        styles.base,
        getVariantStyles(),
        getSizeStyles(),
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
    ];

    /*
     * Face, transform and tracking come off the design system's `button` role
     * (`.cl-btn` / `.co-btn`), the same as ThemedButton. A bare `Text` here
     * falls back to the platform system face, never Work Sans and never
     * uppercased. This component is legacy but still has call sites.
     */
    const designLabelStyle = textStyle(themeStyle, 'button');

    const combinedLabelStyle = [
        styles.labelBase,
        { fontFamily: designLabelStyle.fontFamily, textTransform: designLabelStyle.textTransform },
        getVariantLabelStyles(),
        getSizeLabelStyles(),
        disabled && styles.disabledLabel,
        labelStyle,
    ];

    const iconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
    const iconColor = (getVariantLabelStyles() as TextStyle).color;

    /*
     * The loading dots have to sit on the button they are inside.
     *
     * This was a literal '#FFFFFF', which is white-on-white on a light
     * primary — that style's `buttonPrimary` IS white, so a loading button
     * looked empty. Reading the label colour back off the variant keeps the
     * dots legible in both styles without a per-style branch.
     */
    const dotColor = (variant === 'outline' || variant === 'ghost')
        ? colors.accent
        : ((getVariantLabelStyles() as TextStyle).color as string) ?? colors.buttonPrimaryText;

    return (
        <ScalePressable
            onPress={onPress}
            disabled={disabled || loading}
            style={combinedStyle as any}
        >
            <View style={styles.content}>
                <View style={[styles.innerContent, loading && { opacity: 0 }]}>
                    {icon && iconPosition === 'left' && (
                        <View style={styles.leftIcon}>
                            {React.createElement(icon, {
                                size: iconSize,
                                color: iconColor as string,
                                strokeWidth: 2,
                            })}
                        </View>
                    )}
                    {label ? <Text style={combinedLabelStyle}>{label}</Text> : children}
                    {icon && iconPosition === 'right' && (
                        <View style={styles.rightIcon}>
                            {React.createElement(icon, {
                                size: iconSize,
                                color: iconColor as string,
                                strokeWidth: 2,
                            })}
                        </View>
                    )}
                </View>
                {loading && (
                    <View style={styles.loaderContainer}>
                        <BouncingDots color={dotColor} size={size === 'sm' ? 4 : 6} />
                    </View>
                )}
            </View>
        </ScalePressable>
    );
};

const styles = StyleSheet.create({
    base: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
        overflow: 'hidden',
    },
    labelBase: {
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loaderContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullWidth: {
        width: '100%',
    },
    disabled: {
        opacity: 0.5,
    },
    disabledLabel: {
        opacity: 0.8,
    },
    leftIcon: {
        marginRight: Spacing.sm,
    },
    rightIcon: {
        marginLeft: Spacing.sm,
    },
});
