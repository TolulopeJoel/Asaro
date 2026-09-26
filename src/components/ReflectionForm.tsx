/**
 * The writing surface — one question at a time. design/all-screens.html #entry:
 * a question number, the question, the answer between two rules, and a
 * five-step progress bar. The screen people spend the most time on gets the
 * least decoration, and asks one thing rather than showing five.
 *
 * The step is named in a `.cl-label` rather than enlarged, so the question
 * itself carries the page.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { Spacing } from '../theme/spacing';
import { TextArea } from './TextArea';
import { ActionItemPair, ActionItemsInput } from './ActionItemsInput';
import { Button } from './Button';
import { ScalePressable } from './ScalePressable';
import { Text as UIText, ThemedButton } from './ui';
import { ClothMark } from './ui/Cloth';

export interface ReflectionAnswers {
  reflection1: string;
  reflection2: string;
  actionItems: ActionItemPair[];
  reflection4: string;
  studyFurther?: string;
  studyFurtherReminder?: string;
  notes: string;
}

interface ReflectionFormProps {
  initialAnswers?: ReflectionAnswers;
  onAnswersChange?: (answers: ReflectionAnswers) => void;
  onSave?: (answers: ReflectionAnswers) => void;
  disabled?: boolean;
  saveButtonText?: string;
  /** What is being reflected on — the `.co-mark` at the top of the screen. */
  reference: string;
  /** Leave the entry. */
  onExit: () => void;
  /** Step back off the first question, to the passage you chose. */
  onChangePassage: () => void;
  /** Throw the draft away. Absent when editing an entry that already exists. */
  onDiscard?: () => void;
}

export const ReflectionForm: React.FC<ReflectionFormProps> = React.memo(({
  initialAnswers,
  onAnswersChange,
  onSave,
  disabled = false,
  saveButtonText = 'Save It',
  reference,
  onExit,
  onChangePassage,
  onDiscard,
}) => {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const [answers, setAnswers] = useState<ReflectionAnswers>({
    reflection1: initialAnswers?.reflection1 || '',
    reflection2: initialAnswers?.reflection2 || '',
    actionItems: initialAnswers?.actionItems || [{ action: '', motivation: '' }],
    reflection4: initialAnswers?.reflection4 || '',
    studyFurther: initialAnswers?.studyFurther || '',
    studyFurtherReminder: initialAnswers?.studyFurtherReminder || undefined,
    notes: initialAnswers?.notes || '',
  });

  /**
   * Which page you are on: 0–4 are the five questions, 5 is the notes. Notes
   * carries no number — the mockup's label says "of five questions", and notes
   * are not a sixth.
   */
  const [page, setPage] = useState(0);
  const isNotes = page === REFLECTION_QUESTIONS.length;
  const current = REFLECTION_QUESTIONS[page];

  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [androidPickerMode, setAndroidPickerMode] = useState<'date' | 'time'>('date');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (onAnswersChange) {
      // Debounce the callback to avoid excessive parent re-renders
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        onAnswersChange(answers);
      }, 150);

      return () => {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
      };
    }
  }, [answers, onAnswersChange]);

  const updateAnswer = (questionId: keyof ReflectionAnswers, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const hasPrimaryContent = (() => {
    const { reflection1, reflection2, reflection4, notes, actionItems } = answers;
    const hasText = [reflection1, reflection2, reflection4, notes].some(t => t.trim().length > 0);
    // An action item only counts if the action itself is filled (motivation alone is not enough)
    const hasActions = actionItems.some(item => item.action.trim().length > 0);
    return hasText || hasActions;
  })();

  /** Whether a given question (not necessarily the current one) has an answer on it. */
  const isQuestionAnswered = (q: ReflectionQuestion) => {
    if (q.isActionList) return answers.actionItems.some(i => i.action.trim().length > 0);
    return ((answers[q.id as keyof ReflectionAnswers] as string) || '').trim().length > 0;
  };

  // Whether this page is answered — decides "Skip" or "Next". Plain const:
  // `isQuestionAnswered` is redefined every render anyway, so memoizing adds a
  // dependency-array footgun for nothing.
  const answeredHere = isNotes ? answers.notes.trim().length > 0 : isQuestionAnswered(current);

  // Answered questions, Notes included — what the progress bar tracks. `page`
  // alone counts a skipped question as progress just for moving past it.
  const answeredCount =
    REFLECTION_QUESTIONS.filter(isQuestionAnswered).length +
    (answers.notes.trim().length > 0 ? 1 : 0);

  const handleSave = () => {
    if (!hasPrimaryContent) return;

    // Check for motivation filled without a corresponding action
    const incompleteItem = answers.actionItems.find(
      item => item.motivation.trim().length > 0 && item.action.trim().length === 0
    );
    if (incompleteItem) {
      showAlert({
        title: 'Missing Action',
        message: 'You\'ve added a "Motivated by" note but haven\'t written the action you want to take. Please add the action, or clear the motivation.'
      });
      return;
    }

    if (onSave) {
      onSave(answers);
    }
  };

  const goBack = () => (page === 0 ? onChangePassage() : setPage(p => p - 1));
  const goForward = () => setPage(p => Math.min(p + 1, REFLECTION_QUESTIONS.length));

  const gutter = Spacing.layout.screenPadding;

  return (
    <View style={styles.container}>
      {/* ── .co-top: what you're reflecting on, and the way out ────────── */}
      <View style={[styles.topBar, { paddingHorizontal: gutter }]}>
        <UIText variant="tab" numberOfLines={1} style={styles.mark}>{reference}</UIText>
        <ScalePressable
          onPress={onExit}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={Spacing.md}
        >
          <X size={19} color={colors.textTertiary} strokeWidth={1.9} />
        </ScalePressable>
      </View>

      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        {/* ── the step you're on ─────────────────────────────────────────── */}
        {isNotes ? null : (
          <UIText variant="label">{`Question ${page + 1} of ${REFLECTION_QUESTIONS.length}`}</UIText>
        )}

        <UIText variant={isNotes ? 'display' : 'title'} style={styles.question}>
          {isNotes ? 'Anything else?' : current.question}
        </UIText>

        {/* ── the answer ─────────────────────────────────────────────────── */}
        <View style={styles.answer}>
          {!isNotes && current.isActionList ? (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <ActionItemsInput
                label={current.question}
                items={answers.actionItems}
                onChange={(items) => setAnswers(prev => ({ ...prev, actionItems: items }))}
                disabled={disabled}
              />
            </ScrollView>
          ) : (
            <TextArea
              // One field per question, not one reused: without the key React
              // keeps the same TextArea and native input across pages, so the
              // previous answer lingers and the expand-modal state carries.
              key={isNotes ? 'notes' : current.id}
              bare
              label={isNotes ? 'Additional thoughts' : current.question}
              value={isNotes
                ? answers.notes
                : (answers[current.id as keyof ReflectionAnswers] as string) || ''}
              placeholder={isNotes
                ? 'Any other insights, questions, or reflections...'
                : current.placeholder}
              onChange={(text) => updateAnswer(isNotes ? 'notes' : (current.id as keyof ReflectionAnswers), text)}
              disabled={disabled}
              isAnswered={answeredHere}
            />
          )}
        </View>

        {/* The study-further reminder belongs to its own question only. */}
        {!isNotes && current.id === 'studyFurther' && answeredHere && !disabled && (
          <View style={styles.reminderContainer}>
            <UIText variant="bodySmall" tone="secondary">Remind me at:</UIText>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={answers.studyFurtherReminder ? new Date(answers.studyFurtherReminder) : new Date(Date.now() + 24 * 60 * 60 * 1000)}
                mode="datetime"
                display="default"
                onChange={(event, selectedDate) => {
                  if (selectedDate) updateAnswer('studyFurtherReminder', selectedDate.toISOString());
                }}
              />
            ) : (
              <View style={styles.androidPickerRow}>
                <Button
                  variant="secondary"
                  label={answers.studyFurtherReminder ? new Date(answers.studyFurtherReminder).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Set Reminder"}
                  onPress={() => { setAndroidPickerMode('date'); setShowAndroidPicker(true); }}
                  fullWidth={false}
                />
                {showAndroidPicker && (
                  <DateTimePicker
                    value={answers.studyFurtherReminder ? new Date(answers.studyFurtherReminder) : new Date(Date.now() + 24 * 60 * 60 * 1000)}
                    mode={androidPickerMode}
                    is24Hour={false}
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowAndroidPicker(false);
                      if (event.type === 'dismissed') return;

                      if (selectedDate) {
                        updateAnswer('studyFurtherReminder', selectedDate.toISOString());
                        if (androidPickerMode === 'date') {
                          setAndroidPickerMode('time');
                          setShowAndroidPicker(true);
                        }
                      }
                    }}
                  />
                )}
              </View>
            )}
          </View>
        )}

        {/* ── where you are ──────────────────────────────────────────────── */}
        {/* The woven strip fills as you go — the motif doing a job rather
          * than decorating. Fills by `answeredCount`, not `page`: paging past a
          * skipped question should not read as ground covered. */}
        <View style={[styles.clothProgress, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.clothProgressFill,
              { width: `${(answeredCount / (REFLECTION_QUESTIONS.length + 1)) * 100}%` },
            ]}
          >
            <ClothMark />
          </View>
        </View>
      </View>

      {/* ── the two things you can do next ───────────────────────────────── */}
      {!disabled && (
        <View style={[styles.footer, { paddingHorizontal: gutter }]}>
          <View style={styles.footerButtons}>
            <ThemedButton
              variant="secondary"
              label="Back"
              onPress={goBack}
              accessibilityHint={page === 0 ? 'Change the passage' : 'Previous question'}
            />
            {isNotes ? (
              <ThemedButton
                label={saveButtonText}
                onPress={handleSave}
                disabled={!hasPrimaryContent}
                style={styles.grow}
              />
            ) : (
              <ThemedButton
                variant="secondary"
                label={answeredHere ? 'Next' : 'Skip'}
                onPress={goForward}
                style={styles.grow}
              />
            )}
          </View>
          {onDiscard && (
            <ScalePressable onPress={onDiscard} style={styles.discard}>
              <UIText variant="meta" tone="tertiary">Discard draft</UIText>
            </ScalePressable>
          )}
        </View>
      )}
    </View>
  );
});

ReflectionForm.displayName = 'ReflectionForm';

interface ReflectionQuestion {
  id: string;
  question: string;
  placeholder: string;
  isActionList?: boolean;
}

const REFLECTION_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'reflection1',
    question: 'What does this tell me about Jehovah?',
    placeholder: '',
  },
  {
    id: 'reflection2',
    question: 'How does this section of the Scriptures contribute to the Bible’s message?',
    placeholder: '',
  },
  {
    id: 'reflection3',
    question: 'How can I realistically apply this in my life?',
    placeholder: '',
    isActionList: true,
  },
  {
    id: 'reflection4',
    question: 'How can I use these verses to help others?',
    placeholder: '',
  },
  {
    id: 'studyFurther',
    question: 'What would I like to study further?',
    placeholder: '',
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
  },
  // The mockup hangs the arrow into the gutter, so the glyph lines up with
  // the text below it rather than its own box.
  mark: { flex: 1 },

  body: {
    flex: 1,
    paddingTop: Spacing.xl + 2,
  },
  question: { marginVertical: Spacing.xl },
  answer: { flex: 1 },

  /** One 10px band that fills as you go. */
  clothProgress: { height: 10, marginTop: Spacing.layout.cardPadding, overflow: 'hidden' },
  clothProgressFill: { height: 10, overflow: 'hidden' },

  footer: {
    paddingTop: Spacing.xl - 4,
    paddingBottom: Spacing.layout.tabBarPadding,
    gap: Spacing.md,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  grow: { flex: 1 },
  discard: { alignItems: 'center', paddingVertical: Spacing.xs },

  reminderContainer: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  androidPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
