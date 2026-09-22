/**
 * One action item.
 *
 * design/all-screens.html #actions. Both styles face the same problem — an
 * action carries two texts of unequal weight, the thing to do and why — and
 * each solves it with what it has. Colossal indents the motivation behind a
 * hairline on a bare row; Cloth sets the action in the serif inside a filled
 * `.cl-panel` and lets the face carry the difference. A pinned action gets an
 * ochre left rail in Cloth and a "Pinned" heading in both.
 */
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';
import { EnhancedActionItem, JournalEntry, getEntryById } from '../../data/database';
import { ScalePressable } from '../ScalePressable';
import { HyperlinkedText } from '../HyperlinkedText';
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

    /*
     * design/all-screens.html #actions, the `.cl` slot.
     *
     * Cloth answers the same two-texts-of-unequal-weight problem with the
     * serif rather than with a rule: the action is set in Fraunces at `.cl-h.md`
     * and the motivation drops to Work Sans underneath it. A pinned action
     * carries a 3px ochre rail down its left edge — the one place ochre appears
     * on this screen besides the "Pinned" label itself.
     */
    const done = !!item.is_completed;
    return (
        <View
            style={[
                styles.clothPanel,
                { backgroundColor: colors.backgroundSubtle },
                item.is_pinned && { borderLeftWidth: Spacing.border.marker, borderLeftColor: colors.accent },
                done && styles.clothDone,
            ]}
        >
            <View style={styles.clothRow}>
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
                        <HyperlinkedText
                            style={[textStyle(themeStyle, 'bodySmall'), styles.clothMotivation, { color: colors.textSecondary }]}
                            text={item.motivation}
                        />
                    ) : null}
                    <ScalePressable onPress={openEntry} accessibilityRole="button" accessibilityLabel={`Open ${reference(item)}`}>
                        <Text variant="meta" style={styles.clothRef}>{reference(item)}</Text>
                    </ScalePressable>
                </View>
                <TouchableOpacity
                    onPress={() => handleTogglePin(item)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={item.is_pinned ? 'Unpin action' : 'Pin action'}
                >
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill={item.is_pinned ? colors.accent : 'none'} stroke={item.is_pinned ? colors.accent : colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: '30deg' }] }}>
                        <Path d="M12 17v5" />
                        <Path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                    </Svg>
                </TouchableOpacity>
            </View>
        </View>
    );
});

ActionCard.displayName = 'ActionCard';

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

    // ── Cloth ─────────────────────────────────────────────────────────────
    /** `.cl-panel{padding:18px}`, stacked with a 10px gap by the list. */
    clothPanel: {
        padding: Spacing.layout.cardPadding,
        marginBottom: 10,
    },
    clothRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
    },
    /** The motivation sits plainly under the serif action; no rule needed. */
    clothMotivation: { marginTop: 6 },
    clothRef: { marginTop: 9 },
    clothDone: { opacity: 0.55 },
});
