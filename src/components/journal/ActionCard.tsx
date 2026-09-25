/**
 * One action item.
 *
 * design/all-screens.html #actions. An action carries two texts of unequal
 * weight — the thing to do and why — and the design solves it with the serif
 * rather than with a rule: the action is set in the serif inside a filled
 * `.cl-panel` and the face carries the difference. A pinned action gets an
 * ochre left rail and a "Pinned" heading.
 */
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';
import { EnhancedActionItem, JournalEntry, getEntryById } from '../../data/database';
import { ScalePressable } from '../ScalePressable';
import { CHECKBOX_WIDTH, Checkbox } from './Checkbox';
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

/**
 * "1 day", "12 days", "3 weeks" — how long a practice has been kept.
 *
 * From one, not from two. The first day kept is the most precarious a practice
 * ever is and it used to be the single day this said nothing at all, which put
 * the silence exactly where the encouragement was worth most.
 */
function streakLabel(streak: number, cadence: string | null | undefined): string | null {
    if (streak < 1) return null;
    const unit = cadence === 'weekly' ? 'week' : 'day';
    return `${streak} ${unit}${streak === 1 ? '' : 's'}`;
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
export const ActionCard = React.memo(({ item, onEntryPress, handleTogglePin, handleToggleAction, progress, onEdit }: ActionCardProps) => {
    const { colors, style: themeStyle } = useTheme();

    /*
     * What this item is decides whether a checkbox appears at all.
     *
     * An application — "I will be kinder to my parents" — has no end, so
     * offering a box to tick invites the reader to feel they failed at
     * something the app never had standing to judge. A practice ticks for
     * today and unticks tomorrow. Only an action, which has a deadline, ticks
     * once and stays ticked.
     */
    /*
     * Archived is dimmed and loses its checkbox whatever kind it is. It has
     * served its purpose, so nothing is being asked of it — but it is still
     * legible, because it is still part of what that entry said.
     */
    const isArchived = !!item.archived_at;
    const kind: ActionKind = actionKindOf(item);
    const done = kind === 'practice' ? !!progress?.doneNow : !!item.is_completed;
    const showsCheckbox = completes(kind) && !isArchived;
    const streak = kind === 'practice' ? streakLabel(progress?.streak ?? 0, item.cadence) : null;
    /*
     * The history cells used to sit here, under the meta row. They belong on
     * Stats instead: the Library is where the reader MANAGES what they are
     * carrying — edit it, tick it, pin it, archive it — and a record of the
     * last fortnight answers a different question entirely. A row that has to
     * be both a control and a chart is worse at both.
     */
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
                isArchived && styles.archived,
            ]}
        >
            <View style={styles.clothRow}>
                {showsCheckbox ? (
                    <Checkbox done={done} onPress={() => handleToggleAction(item)} />
                ) : (
                    <View style={styles.checkboxSpacer} />
                )}
                <ScalePressable
                    style={styles.rowMain}
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
    rowMain: {
        flex: 1,
        minWidth: 0,
    },
    /* Keeps an application's text on the same left edge as everything else. */
    checkboxSpacer: { width: CHECKBOX_WIDTH },
    archived: { opacity: 0.5 },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    motivation: {
        marginTop: 7,
        paddingLeft: 11,
        borderLeftWidth: Spacing.border.hairline,
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
