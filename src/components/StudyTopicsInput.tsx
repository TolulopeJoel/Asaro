import React, { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Bell, Plus, XCircle } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { useBibleRefPicker } from '../hooks/useBibleRefPicker';
import { ReferenceInput } from './ReferenceInput';
import { Button } from './Button';
import { ScalePressable } from './ScalePressable';
import { Text, textStyle } from './ui';
import type { StudyTopicDraft } from '../data/studyTopics';

/** Question 5 as a list: one topic per field, each with its own reminder. Spec: design/answer-lists.html#topics. */
export function StudyTopicsInput({
    topics,
    onChange,
    disabled = false,
}: {
    topics: StudyTopicDraft[];
    onChange: (topics: StudyTopicDraft[]) => void;
    disabled?: boolean;
}) {
    const { colors } = useTheme();
    const list = topics.length ? topics : [{ topic: '' }];
    const fields = useRef<(TextInput | null)[]>([]);
    // Changes build on the latest list, not the one this render drew: two can land before the next render.
    const latest = useRef(list);
    latest.current = list;
    const commit = (next: StudyTopicDraft[]) => {
        latest.current = next;
        onChange(next);
    };
    const focus = (index: number) => setTimeout(() => fields.current[index]?.focus(), 50);

    const update = (index: number, patch: Partial<StudyTopicDraft>) =>
        commit(latest.current.map((t, i) => (i === index ? { ...t, ...patch } : t)));

    // A blank topic is filled in before another is added.
    const add = () => {
        const current = latest.current;
        const blank = current.findIndex(t => !t.topic.trim());
        if (blank >= 0) {
            focus(blank);
            return;
        }
        commit([...current, { topic: '' }]);
        focus(current.length);
    };

    // Return finishes a topic: the next one is focused, or started when this is the last.
    const submit = (index: number) => {
        const current = latest.current;
        if (!current[index]?.topic.trim()) return;
        if (index < current.length - 1) focus(index + 1);
        else add();
    };

    // Backspace in an empty topic takes the slot away and goes back to the one above.
    const removeBlank = (index: number) => {
        const current = latest.current;
        if (current.length < 2 || current[index]?.topic) return;
        commit(current.filter((_, i) => i !== index));
        focus(Math.max(0, index - 1));
    };

    return (
        <View>
            <View style={{ backgroundColor: colors.backgroundSubtle }}>
                {list.map((item, index) => (
                    <View
                        key={index}
                        style={[styles.topic, index > 0 && [styles.nextTopic, { borderTopColor: `${colors.accentSecondary}33` }]]}
                    >
                        <TopicField
                            value={item.topic}
                            onChange={topic => update(index, { topic })}
                            onSubmit={() => submit(index)}
                            onRemove={() => removeBlank(index)}
                            inputRef={node => { fields.current[index] = node; }}
                            disabled={disabled}
                        />
                        {!disabled && item.topic.trim().length > 0 && (
                            <ReminderChip value={item.reminder ?? null} onChange={reminder => update(index, { reminder })} />
                        )}
                    </View>
                ))}
            </View>
            {!disabled && (
                <Button label="add topic" variant="outline" icon={Plus} onPress={add} style={styles.add} />
            )}
        </View>
    );
}

function TopicField({
    value,
    onChange,
    onSubmit,
    onRemove,
    inputRef,
    disabled,
}: {
    value: string;
    onChange: (text: string) => void;
    onSubmit: () => void;
    onRemove: () => void;
    inputRef: (node: TextInput | null) => void;
    disabled: boolean;
}) {
    const { colors, style: themeStyle } = useTheme();
    const input = useRef<TextInput | null>(null);
    const body = textStyle(themeStyle, 'body');
    // Four lines to start, growing to eight; past that it scrolls inside.
    const line = body.lineHeight ?? 24;
    const picker = useBibleRefPicker({
        getValue: () => value,
        setValue: onChange,
        getInputRef: () => input.current,
        mode: 'context',
    });

    return (
        <View style={styles.field}>
            <ReferenceInput
                text={value}
                pendingFrom={picker.refStartIndex}
                ref={node => { input.current = node; inputRef(node); }}
                inputAccessoryViewID="bible-picker"
                style={[styles.input, body, { color: colors.text, minHeight: line * 4, maxHeight: line * 8 }]}
                onChangeText={picker.handleTextChange}
                onSubmitEditing={onSubmit}
                onKeyPress={e => { if (e.nativeEvent.key === 'Backspace' && !value) onRemove(); }}
                submitBehavior="submit"
                returnKeyType="next"
                multiline
                editable={!disabled}
            />
            {!disabled && value.length > 0 && (
                <ScalePressable
                    onPress={() => onChange('')}
                    hitSlop={14}
                    accessibilityRole="button"
                    accessibilityLabel="Clear this topic"
                    style={styles.clear}
                >
                    <XCircle size={16} color={colors.textTertiary} />
                </ScalePressable>
            )}
        </View>
    );
}

/** Dashed until set. Android asks for the date, then the time. */
function ReminderChip({ value, onChange }: { value: string | null; onChange: (reminder: string | null) => void }) {
    const { colors } = useTheme();
    const [mode, setMode] = useState<'date' | 'time' | null>(null);
    const shown = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    return (
        <View style={styles.reminderRow}>
            <ScalePressable
                onPress={() => setMode('date')}
                accessibilityRole="button"
                accessibilityLabel={value ? 'Change the reminder' : 'Set a reminder'}
                style={[
                    styles.reminder,
                    // Solid named outright: Android keeps a dashed border that is merely dropped.
                    value
                        ? { backgroundColor: colors.background, borderColor: colors.border, borderStyle: 'solid' }
                        : { borderColor: colors.border, borderStyle: 'dashed' },
                ]}
            >
                <Bell size={13} color={colors.textSecondary} strokeWidth={1.9} />
                <Text variant="label" tone="secondary">
                    {value ? shown.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Remind me'}
                </Text>
            </ScalePressable>
            {value && (
                <ScalePressable
                    onPress={() => onChange(null)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Remove the reminder"
                >
                    <XCircle size={14} color={colors.textTertiary} />
                </ScalePressable>
            )}
            {mode && (
                <DateTimePicker
                    value={shown}
                    mode={mode}
                    is24Hour={false}
                    display="default"
                    onChange={(event, selected) => {
                        setMode(null);
                        if (event.type === 'dismissed' || !selected) return;
                        onChange(selected.toISOString());
                        if (mode === 'date') setMode('time');
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    topic: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    nextTopic: { borderTopWidth: 1.5 },
    field: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    input: { flex: 1, padding: 0, textAlignVertical: 'top' },
    clear: { paddingTop: 6 },
    reminderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
    reminder: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
    },
    add: { alignSelf: 'flex-start', marginTop: Spacing.md },
});
