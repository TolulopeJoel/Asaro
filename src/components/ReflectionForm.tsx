import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { ScalePressable } from './ScalePressable';
import { TextArea } from './TextArea';
import { ActionItemPair, ActionItemsInput } from './ActionItemsInput';

export interface ReflectionAnswers {
  reflection1: string;
  reflection2: string;
  actionItems: ActionItemPair[];
  reflection4: string;
  notes: string;
}

interface ReflectionFormProps {
  initialAnswers?: ReflectionAnswers;
  onAnswersChange?: (answers: ReflectionAnswers) => void;
  onSave?: (answers: ReflectionAnswers) => void;
  disabled?: boolean;
  saveButtonText?: string;
}

export const ReflectionForm: React.FC<ReflectionFormProps> = React.memo(({
  initialAnswers,
  onAnswersChange,
  onSave,
  disabled = false,
  saveButtonText = 'Save It',
}) => {
  const { colors } = useTheme();
  const [answers, setAnswers] = useState<ReflectionAnswers>({
    reflection1: initialAnswers?.reflection1 || '',
    reflection2: initialAnswers?.reflection2 || '',
    actionItems: initialAnswers?.actionItems || [{ action: '', motivation: '' }],
    reflection4: initialAnswers?.reflection4 || '',
    notes: initialAnswers?.notes || '',
  });

  // Animation values
  const saveButtonScale = useRef(new Animated.Value(0)).current;
  const saveButtonOpacity = useRef(new Animated.Value(0)).current;
  const questionAnims = useRef(REFLECTION_QUESTIONS.map(() => new Animated.Value(0))).current;

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

  // Staggered entrance animation for questions
  useEffect(() => {
    const animations = questionAnims.map((anim, index) => {
      return Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      });
    });

    const staggerAnimation = Animated.stagger(100, animations);
    staggerAnimation.start();

    return () => {
      staggerAnimation.stop();
      animations.forEach(anim => anim.stop());
    };
  }, [questionAnims]);

  const updateAnswer = (questionId: keyof ReflectionAnswers, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const hasContent = (() => {
    const { actionItems, ...textAnswers } = answers;
    const hasText = Object.values(textAnswers).some(answer => typeof answer === 'string' && answer.trim().length > 0);
    const hasActions = actionItems.some(item => item.action.trim().length > 0 || item.motivation.trim().length > 0);
    return hasText || hasActions;
  })();

  // Animate save button based on content presence
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.spring(saveButtonScale, {
        toValue: hasContent ? 1 : 0,
        useNativeDriver: true,
        friction: 6,
        tension: 50,
      }),
      Animated.timing(saveButtonOpacity, {
        toValue: hasContent ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]);
    animation.start();

    return () => {
      animation.stop();
    };
  }, [hasContent, saveButtonScale, saveButtonOpacity]);

  const handleSave = () => {
    if (!hasContent) return;

    if (onSave) {
      onSave(answers);
    }
  };

  const handleClear = () => {
    if (!hasContent) return;

    Alert.alert(
      'Re-write',
      'This will clear everything you\'ve written. Are you sure? 👀',
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            const emptyAnswers: ReflectionAnswers = {
              reflection1: '',
              reflection2: '',
              actionItems: [{ action: '', motivation: '' }],
              reflection4: '',
              notes: '',
            };
            setAnswers(emptyAnswers);
          },
        },
      ]
    );
  };

  const renderQuestion = (questionData: ReflectionQuestion, index: number) => {
    const { id, question, placeholder, isActionList } = questionData;
    const anim = questionAnims[index];

    return (
      <Animated.View
        key={id}
        style={[
          styles.questionContainer,
          {
            opacity: anim,
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.questionHeader}>
          <Text style={[styles.questionNumber, { backgroundColor: colors.badge, color: colors.primary }]}>{index + 1}</Text>
          <View style={styles.questionTitleContainer}>
            <Text style={[styles.questionTitle, { color: colors.text }]}>{question}</Text>
          </View>
        </View>

        {isActionList ? (
          <ActionItemsInput
            label={question}
            items={answers.actionItems}
            onChange={(items) => setAnswers(prev => ({ ...prev, actionItems: items }))}
            disabled={disabled}
          />
        ) : (
          <TextArea
            label={question}
            value={answers[id as keyof ReflectionAnswers] as string}
            placeholder={placeholder}
            onChange={(text) => updateAnswer(id as keyof ReflectionAnswers, text)}
            disabled={disabled}
            isAnswered={(answers[id as keyof ReflectionAnswers] as string).trim().length > 0}
          />
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.questionsContainer}>
        {REFLECTION_QUESTIONS.map((question, index) =>
          renderQuestion(question, index)
        )}

        <View style={styles.notesContainer}>
          <View style={styles.notesHeader}>
            <Text style={[styles.notesTitle, { color: colors.textSecondary }]}>Additional Thoughts</Text>
            <Text style={[styles.notesSubtitle, { color: colors.textTertiary }]}>Optional</Text>
          </View>
          <TextArea
            label=""
            value={answers.notes}
            placeholder="Any other insights, questions, or reflections..."
            onChange={(text) => updateAnswer('notes', text)}
            disabled={disabled}
            isAnswered={answers.notes.trim().length > 0}
          />
        </View>
      </View>

      {!disabled && (
        <View style={styles.actionsContainer}>
          <ScalePressable
            style={[styles.clearButton, { borderColor: colors.border }]}
            onPress={handleClear}
          >
            <Text style={[styles.clearButtonText, { color: colors.textSecondary }]}>Start Over</Text>
          </ScalePressable>

          <Animated.View
            style={{
              flex: 1,
              transform: [{ scale: saveButtonScale }],
              opacity: saveButtonOpacity,
            }}
          >
            <ScalePressable
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={!hasContent}
            >
              <Text style={[styles.saveButtonText, { color: colors.buttonPrimaryText }]}>{saveButtonText}</Text>
            </ScalePressable>
          </Animated.View>
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
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  questionsContainer: {
    // Removed paddingHorizontal since parent handles it
  },
  questionContainer: {
    marginBottom: Spacing.xxxl,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  questionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
    textAlign: 'center',
    lineHeight: 24,
    marginRight: Spacing.md,
    marginTop: 2,
    overflow: 'hidden',
  },
  questionTitleContainer: {
    flex: 1,
  },
  questionTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.regular,
    lineHeight: Typography.lineHeight.md,
    letterSpacing: 0.1,
  },
  notesContainer: {
    marginTop: Spacing.xl,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  notesTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.regular,
    letterSpacing: 0.2,
    marginRight: Spacing.sm,
  },
  notesSubtitle: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.regular,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 18,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: Spacing.borderRadius.lg,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
    letterSpacing: 0.3,
  },
  saveButton: {
    width: '100%', // Ensure it fills the Animated.View
    paddingVertical: 18,
    borderRadius: Spacing.borderRadius.lg,
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    letterSpacing: 0.3,
  },
});