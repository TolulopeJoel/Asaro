/**
 * One action item.
 *
 * Colossal draws the design's Actions row (design/all-screens.html #actions,
 * the `.co` slot): a square checkbox, the action set in `.co-h.sm`, and — the
 * point of that composition — the motivation indented behind a hairline so it
 * reads as subordinate rather than as a second action. Cloth keeps the filled
 * panel it has today; its own pass is still to come.
 */
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';
import { EnhancedActionItem, JournalEntry, getEntryById } from '../../data/database';
import { ScalePressable } from '../ScalePressable';
import { HyperlinkedText } from '../HyperlinkedText';
import { formatDate, getDynamicCardStyle } from './JournalCardHelpers';
import { Spacing } from '../../theme/spacing';
import { Text, textStyle } from '../ui';

interface ActionCardProps {
    item: EnhancedActionItem;
    onEntryPress: (entry: JournalEntry) => void;
    handleTogglePin: (item: EnhancedActionItem) => void;
    handleToggleAction: (item: EnhancedActionItem) => void;
}

/** "Genesis 18", "Genesis 12–15" — the reading an action came out of. */
function reference(item: EnhancedActionItem): string {
    const end = item.chapter_end && item.chapter_end !== item.chapter_start ? `–${item.chapter_end}` : '';
    return `${item.book_name} ${item.chapter_start}${end}`;
}

/** The 18px box the mockup puts at the head of every action. */
function ActionCheckbox({ done, onPress }: { done: boolean; onPress: () => void }) {
    const { colors } = useTheme();
    return (
        <ScalePressable
            onPress={onPress}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={done ? 'Mark as not done' : 'Mark as done'}
            hitSlop={Spacing.md}
            style={[
                styles.checkbox,
                done
                    ? { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }
                    : { borderColor: colors.borderStrong },
            ]}
        >
            {done && (
                <Svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={colors.background} strokeWidth="3.6" strokeLinecap="round">
                    <Path d="M5 12l5 5L19 7" />
                </Svg>
            )}
        </ScalePressable>
    );
}

export const ActionCard = React.memo(({ item, onEntryPress, handleTogglePin, handleToggleAction }: ActionCardProps) => {
    const { colors, isLockedIn, style: themeStyle } = useTheme();
    const dynamic = getDynamicCardStyle(item.action);

    const openEntry = async () => {
        try {
            const entry = await getEntryById(item.entry_id!);
            if (entry) onEntryPress(entry);
        } catch (e) {
            console.error(e);
        }
    };

    if (isLockedIn) {
        const done = !!item.is_completed;
        return (
            <View style={[styles.colossalRow, { borderBottomColor: colors.border }, done && styles.done]}>
                <ActionCheckbox done={done} onPress={() => handleToggleAction(item)} />
                <View style={styles.colossalMain}>
                    <HyperlinkedText
                        style={[
                            textStyle(themeStyle, 'subtitle'),
                            { color: colors.textPrimary },
                            done && styles.struck,
                        ]}
                        text={item.action}
                    />
                    {item.motivation ? (
                        /*
                         * The motivation is indented behind a rule. That rule is
                         * the whole reason this screen works in Colossal: an
                         * action carries two texts of unequal weight, and without
                         * it the second one reads as another thing to do.
                         */
                        <View style={[styles.motivation, { borderLeftColor: colors.border }]}>
                            <HyperlinkedText
                                style={[textStyle(themeStyle, 'bodySmall'), { color: colors.textSecondary }]}
                                text={item.motivation}
                            />
                        </View>
                    ) : null}
                    <ScalePressable onPress={openEntry} accessibilityRole="button" accessibilityLabel={`Open ${reference(item)}`}>
                        <Text variant="meta" style={styles.colossalRef}>{reference(item)}</Text>
                    </ScalePressable>
                </View>
                {/*
                  * The mockup draws no pin here — it expresses pinning with the
                  * "Pinned" section above. Keeping a control means keeping the
                  * ability to pin at all, so it sits at the row's right edge in
                  * the same grey as everything else and doesn't touch the
                  * silhouette the design set.
                  */}
                <TouchableOpacity
                    onPress={() => handleTogglePin(item)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={item.is_pinned ? 'Unpin action' : 'Pin action'}
                >
                    <Svg width="15" height="15" viewBox="0 0 24 24" fill={item.is_pinned ? colors.accent : 'none'} stroke={item.is_pinned ? colors.accent : colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: '30deg' }] }}>
                        <Path d="M12 17v5" />
                        <Path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                    </Svg>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.bookCardWrapper}>
            <View style={[styles.entryCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, marginBottom: 0, padding: dynamic.padding }]}>
                <View style={[styles.entryHeader, { marginBottom: 12 }]}>
                    <View style={styles.entryHeaderLeft}>
                        <Text variant="label" tone="tertiary">{formatDate(item.created_at)}</Text>
                        <ScalePressable onPress={openEntry}>
                            <View style={[styles.refBadge, { backgroundColor: colors.accent + '15' }]}>
                                <Text variant="label" style={{ color: colors.accent + 'A5' }}>
                                    {reference(item)}
                                </Text>
                            </View>
                        </ScalePressable>
                    </View>
                    <TouchableOpacity
                        onPress={() => handleTogglePin(item)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={{ marginLeft: 'auto' }}
                    >
                        <Svg width="18" height="18" viewBox="0 0 24 24" fill={item.is_pinned ? colors.accent : 'none'} stroke={item.is_pinned ? colors.accent : colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: '30deg' }] }}>
                            <Path d="M12 17v5" />
                            <Path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                        </Svg>
                    </TouchableOpacity>
                </View>
                <HyperlinkedText
                    style={[styles.entryPreview, { color: colors.textPrimary, fontWeight: '600', fontSize: dynamic.fontSize, lineHeight: dynamic.lineHeight, marginBottom: item.motivation ? 8 : 0 }]}
                    text={item.action}
                />
                {item.motivation ? (
                    <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border + '30' }}>
                        <HyperlinkedText
                            style={[styles.entryPreview, { color: colors.textSecondary, fontStyle: 'italic', marginBottom: 0, fontSize: Math.max(13, dynamic.fontSize - 2) }]}
                            text={item.motivation}
                        />
                    </View>
                ) : null}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    // ── Colossal ──────────────────────────────────────────────────────────
    colossalRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        paddingBottom: Spacing.lg - 1,
        marginBottom: Spacing.lg - 1,
        borderBottomWidth: Spacing.border.hairline,
    },
    colossalMain: {
        flex: 1,
        minWidth: 0,
    },
    checkbox: {
        width: 18,
        height: 18,
        marginTop: 2,
        borderWidth: Spacing.border.hairline,
        alignItems: 'center',
        justifyContent: 'center',
    },
    motivation: {
        marginTop: 7,
        paddingLeft: 11,
        borderLeftWidth: Spacing.border.hairline,
    },
    colossalRef: {
        marginTop: 9,
    },
    done: {
        opacity: 0.45,
    },
    struck: {
        textDecorationLine: 'line-through',
    },

    // ── Cloth (unchanged; its own pass is still to come) ───────────────────
    bookCardWrapper: {
        marginBottom: 12,
    },
    entryCard: {
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
    },
    entryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    entryHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    refBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: Spacing.borderRadius.lg,
    },
    entryPreview: {
        fontSize: 16,
        lineHeight: 26,
        fontWeight: '500',
        letterSpacing: -0.1,
    },
});
