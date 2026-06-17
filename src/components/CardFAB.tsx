import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '@/src/theme/ThemeContext';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CardFABProps {
    onShare: () => void;
    onEdit: () => void;
    onDelete: () => void;
    isSharing?: boolean;
    isDeleting?: boolean;
    bottom?: number;
    rounded?: boolean;
}

export const CardFAB: React.FC<CardFABProps> = ({
    onShare,
    onEdit,
    onDelete,
    isSharing = false,
    isDeleting = false,
    bottom,
    rounded = false,
}) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    // Default bottom position if not provided:
    // Tab bar height (60) + bottom inset + extra spacing (Spacing.xl = 24)
    const defaultBottom = 60 + insets.bottom + Spacing.xl;
    const finalBottom = bottom !== undefined ? bottom : defaultBottom;

    return (
        <View style={[
            styles.floatingActions,
            {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
                bottom: finalBottom,
                borderRadius: rounded ? Spacing.borderRadius.lg : Spacing.borderRadius.lg,
                borderBottomEndRadius: rounded ? Spacing.borderRadius.lg : 4,
                borderBottomStartRadius: rounded ? Spacing.borderRadius.lg : 4,
            }
        ]}>
            <ScalePressable
                style={[styles.shareFloatingButton, { backgroundColor: colors.backgroundSubtle }]}
                onPress={onShare}
                disabled={isSharing}
            >
                <Text style={[styles.shareFloatingText, { color: colors.textSecondary }]}>
                    {isSharing ? '↗ sharing' : '↗ share'}
                </Text>
            </ScalePressable>

            <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />

            <ScalePressable
                style={styles.iconButton}
                onPress={onEdit}
            >
                <Text style={[styles.iconButtonText, { color: colors.textSecondary }]}>edit</Text>
            </ScalePressable>

            <ScalePressable
                style={styles.iconButton}
                onPress={onDelete}
                disabled={isDeleting}
            >
                <Text style={[styles.iconButtonText, { color: colors.textTertiary }]}>
                    {isDeleting ? 'deleting' : 'delete'}
                </Text>
            </ScalePressable>
        </View>
    );
};

const styles = StyleSheet.create({
    floatingActions: {
        position: 'absolute',
        left: Spacing.lg,
        right: Spacing.lg,
        marginBottom: 4,
        marginHorizontal: 1.5,
        borderRadius: Spacing.borderRadius.lg,
        borderBottomEndRadius: 4,
        borderBottomStartRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xs + 2,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 1.5,
    },
    shareFloatingButton: {
        flex: 1,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderRadius: Spacing.borderRadius.md,
        alignItems: 'center',
    },
    shareFloatingText: {
        fontSize: Typography.size.sm + 1,
        fontWeight: Typography.weight.medium,
    },
    actionDivider: {
        width: 1,
        height: Spacing.lg + Spacing.xs,
        marginHorizontal: Spacing.sm,
    },
    iconButton: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
    },
    iconButtonText: {
        fontSize: Typography.size.sm + 1,
        fontWeight: Typography.weight.regular,
    },
});
