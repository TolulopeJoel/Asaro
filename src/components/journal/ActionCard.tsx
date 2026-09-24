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
import { ActionKind, actionKindOf, completes } from '../../data/actionKind';
import { PracticeProgress } from '../../data/practiceRepository';

interface ActionCardProps {
    item: EnhancedActionItem;
    onEntryPress: (entry: JournalEntry) => void;
    handleTogglePin: (item: EnhancedActionItem) => void;
    handleToggleAction: (item: EnhancedActionItem) => void;
    /** Only for practices — how the rhythm has been kept. */
    progress?: PracticeProgress;
    /** Tapping the body opens the editor. The row's text was previously uneditable. */
    onEdit?: (item: EnhancedActionItem) => void;
}

/** "12 days", "3 weeks" — how long a practice has been kept. */
function streakLabel(streak: number, cadence: string | null | undefined): string | null {
    if (streak < 2) return null;
    const unit = cadence === 'weekly' ? 'week' : 'day';
    return `${streak} ${unit}s`;
}

/** "Due 3 Oct", or "Overdue" once the day has passed. */
function dueLabel(dueAt: string | null | undefined): string | null {
    if (!dueAt) return null;
    const due = new Date(dueAt);
    if (Number.isNaN(due.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const when = due.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return due < today ? `Was due ${when}` : `Due ${when}`;
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

export const ActionCard = React.memo(({ item, onEntryPress, handleTogglePin, handleToggleAction, progress, onEdit }: ActionCardProps) => {
    const { colors, isLockedIn, style: themeStyle } = useTheme();

    /*
     * What this item is decides whether a checkbox appears at all.
     *
     * An application — "I will be kinder to my parents" — has no end, so
     * offering a box to tick invites the reader to feel they failed at
     * something the app never had standing to judge. A practice ticks for
     * today and unticks tomorrow. Only an action, which has a deadline, ticks
     * once and stays ticked.
     */
    const kind: ActionKind = actionKindOf(item);
    const done = kind === 'practice' ? !!progress?.doneNow : !!item.is_completed;
    const showsCheckbox = completes(kind);
    const streak = kind === 'practice' ? streakLabel(progress?.streak ?? 0, item.cadence) : null;
    const due = kind === 'action' ? dueLabel(item.due_at) : null;
    /* Only an action stays struck through — a practice ticked today is not finished. */
    const struckOut = kind === 'action' && done;

    const openEntry = async () => {
        try {
            const entry = await getEntryById(item.entry_id!);
            if (entry) onEntryPress(entry);
        } catch (e) {
            console.error(e);
        }
    };

    if (isLockedIn) {
        return (
            <View style={[styles.colossalRow, { borderBottomColor: colors.border }, struckOut && styles.done]}>
                {showsCheckbox ? (
                    <ActionCheckbox done={done} onPress={() => handleToggleAction(item)} />
                ) : (
                    <View style={styles.checkboxSpacer} />
                )}
                <ScalePressable
                    style={styles.colossalMain}
                    onPress={onEdit ? () => onEdit(item) : undefined}
                    disabled={!onEdit}
                    accessibilityRole={onEdit ? 'button' : undefined}
                    accessibilityHint={onEdit ? 'Edit this' : undefined}
                >
                    <HyperlinkedText
                        style={[
                            textStyle(themeStyle, 'subtitle'),
                            { color: colors.textPrimary },
                            struckOut && styles.struck,
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
                    <View style={styles.metaRow}>
                        <ScalePressable onPress={openEntry} accessibilityRole="button" accessibilityLabel={`Open ${reference(item)}`}>
                            <Text variant="meta" style={styles.colossalRef}>{reference(item)}</Text>
                        </ScalePressable>
                        {streak && <Text variant="meta" tone="accent">{streak}</Text>}
                        {due && <Text variant="meta" tone="accent">{due}</Text>}
                    </View>
                </ScalePressable>
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
    return (
        <View
            style={[
                styles.clothPanel,
                { backgroundColor: colors.backgroundSubtle },
                item.is_pinned && { borderLeftWidth: Spacing.border.marker, borderLeftColor: colors.accent },
                struckOut && styles.clothDone,
            ]}
        >
            <View style={styles.clothRow}>
                {showsCheckbox ? (
                    <ActionCheckbox done={done} onPress={() => handleToggleAction(item)} />
                ) : (
                    <View style={styles.checkboxSpacer} />
                )}
                <ScalePressable
                    style={styles.colossalMain}
                    onPress={onEdit ? () => onEdit(item) : undefined}
                    disabled={!onEdit}
                    accessibilityRole={onEdit ? 'button' : undefined}
                    accessibilityHint={onEdit ? 'Edit this' : undefined}
                >
                    <HyperlinkedText
                        style={[
                            textStyle(themeStyle, 'subtitle'),
                            { color: colors.textPrimary },
                            struckOut && styles.struck,
                        ]}
                        text={item.action}
                    />
                    {item.motivation ? (
                        <HyperlinkedText
                            style={[textStyle(themeStyle, 'bodySmall'), styles.clothMotivation, { color: colors.textSecondary }]}
                            text={item.motivation}
                        />
                    ) : null}
                    <View style={styles.metaRow}>
                        <ScalePressable onPress={openEntry} accessibilityRole="button" accessibilityLabel={`Open ${reference(item)}`}>
                            <Text variant="meta" style={styles.clothRef}>{reference(item)}</Text>
                        </ScalePressable>
                        {streak && <Text variant="meta" tone="accent">{streak}</Text>}
                        {due && <Text variant="meta" tone="accent">{due}</Text>}
                    </View>
                </ScalePressable>
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
    /* Keeps an application's text on the same left edge as everything else. */
    checkboxSpacer: { width: 18 },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
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
