/**
 * The bar under an entry: share it, edit it, throw it away.
 *
 * design/all-screens.html #entrydetail anchors it to the foot of the screen
 * behind a hairline — not floating on a shadow, which this design set does not
 * have anywhere, and which sitting on the foot makes unnecessary.
 *
 * Share carries a word because it is the one anyone looks for; edit and delete
 * are glyphs, and delete takes the quietest tone of the three. Nothing here is
 * destructive without the alert that follows it.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Share2, Edit2, Trash2 } from 'lucide-react-native';

import { useTheme } from '@/src/theme/ThemeContext';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Spacing } from '@/src/theme/spacing';
import { Text } from './ui';

interface CardFABProps {
    onShare?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    isSharing?: boolean;
    isDeleting?: boolean;
    /**
     * True when the app's tab bar sits directly below this one.
     *
     * The tab bar already carries the 30px foot and the home indicator, so the
     * bar only needs its own padding; standing alone in a modal it carries
     * them itself.
     */
    aboveTabBar?: boolean;
}

export const CardFAB: React.FC<CardFABProps> = ({
    onShare,
    onEdit,
    onDelete,
    isSharing = false,
    isDeleting = false,
    aboveTabBar = false,
}) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const divider = <View style={[styles.divider, { backgroundColor: colors.border }]} />;

    return (
        <View
            style={[
                styles.bar,
                {
                    backgroundColor: colors.cardBackground,
                    borderTopColor: colors.border,
                    paddingBottom: aboveTabBar
                        ? Spacing.md
                        : Math.max(insets.bottom, Spacing.layout.tabBarPadding),
                },
            ]}
        >
            {onShare && (
                <ScalePressable
                    style={styles.share}
                    onPress={onShare}
                    disabled={isSharing}
                    accessibilityRole="button"
                    accessibilityLabel="Share this entry"
                >
                    <Share2 size={15} color={colors.textSecondary} strokeWidth={2.2} />
                    <Text variant="button" tone="secondary">
                        {isSharing ? 'Sharing' : 'Share'}
                    </Text>
                </ScalePressable>
            )}

            {onShare && onEdit && divider}

            {onEdit && (
                <ScalePressable
                    style={styles.icon}
                    onPress={onEdit}
                    accessibilityRole="button"
                    accessibilityLabel="Edit this entry"
                >
                    <Edit2 size={16} color={colors.textSecondary} strokeWidth={1.9} />
                </ScalePressable>
            )}

            {onEdit && onDelete && divider}

            {onDelete && (
                <ScalePressable
                    style={styles.icon}
                    onPress={onDelete}
                    disabled={isDeleting}
                    accessibilityRole="button"
                    accessibilityLabel="Delete this entry"
                >
                    <Trash2 size={16} color={colors.textTertiary} strokeWidth={1.9} />
                </ScalePressable>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: Spacing.border.hairline,
        paddingHorizontal: Spacing.md + 2,
        paddingTop: Spacing.md,
    },
    /** Share takes the room; the two glyphs take only what they need. */
    share: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: Spacing.md + 1,
    },
    icon: {
        paddingVertical: Spacing.md + 1,
        paddingHorizontal: Spacing.xl - 2,
        alignItems: 'center',
    },
    divider: { width: Spacing.border.hairline, height: 22 },
});
