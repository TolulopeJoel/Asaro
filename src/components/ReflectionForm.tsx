// src/components/ReflectionForm.tsx
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export interface ReflectionAnswers {
  reflection1: string;
  reflection2: string;
  reflection3: string;
  reflection4: string;
  reflection5: string;
  notes: string;
}

interface ReflectionFormProps {
  initialAnswers?: ReflectionAnswers;
  onAnswersChange?: (answers: ReflectionAnswers) => void;
  onSave?: (answers: ReflectionAnswers) => void;
  disabled?: boolean;
}

// Fixed reflection questions - customize these as needed
interface ReflectionQuestion {
  id: keyof ReflectionAnswers;
  question: string;
  placeholder: string;
}

const REFLECTION_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'reflection1',
    question: 'What did this passage teach me about God?',
    placeholder: 'Reflect on God\'s character, attributes, or actions...',
  },
  {
    id: 'reflection2',
    question: 'What did this passage teach me about myself or humanity?',
    placeholder: 'Consider human nature, your own heart, or relationships...',
  },
  {
    id: 'reflection3',
    question: 'How can I apply this to my life today?',
    placeholder: 'Think of specific, practical applications...',
  },
  {
    id: 'reflection4',
    question: 'What is one thing I want to remember from this study?',
    placeholder: 'Key verse, insight, or lesson to carry forward...',
  },
  {
    id: 'reflection5',
    question: 'How does this passage connect to other parts of Scripture?',
    placeholder: 'Cross-references, themes, or biblical connections...',
  },
];

export const ReflectionForm: React.FC<ReflectionFormProps> = ({
  initialAnswers,
  onAnswersChange,
  onSave,
  disabled = false,
}) => {
  const [answers, setAnswers] = useState<ReflectionAnswers>({
    reflection1: initialAnswers?.reflection1 || '',
    reflection2: initialAnswers?.reflection2 || '',
    reflection3: initialAnswers?.reflection3 || '',
    reflection4: initialAnswers?.reflection4 || '',
    reflection5: initialAnswers?.reflection5 || '',
    notes: initialAnswers?.notes || '',
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track when answers change
  useEffect(() => {
    if (onAnswersChange) {
      onAnswersChange(answers);
    }
    
    // Check if there are any answers to mark as unsaved changes
    const hasContent = Object.values(answers).some(answer => answer.trim().length > 0);
    setHasUnsavedChanges(hasContent);
  }, [answers, onAnswersChange]);

  const updateAnswer = (questionId: keyof ReflectionAnswers, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSave = () => {
    // Check if at least one reflection question is answered
    const hasReflections = [
      answers.reflection1,
      answers.reflection2,
      answers.reflection3,
      answers.reflection4,
      answers.reflection5,
    ].some(answer => answer.trim().length > 0);

    if (!hasReflections) {
      Alert.alert(
        'Incomplete Reflection',
        'Please answer at least one reflection question before saving.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (onSave) {
      onSave(answers);
      setHasUnsavedChanges(false);
    }
  };

  const clearForm = () => {
    Alert.alert(
      'Clear Form',
      'Are you sure you want to clear all your answers?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            const emptyAnswers = {
              reflection1: '',
              reflection2: '',
              reflection3: '',
              reflection4: '',
              reflection5: '',
              notes: '',
            };
            setAnswers(emptyAnswers);
            setHasUnsavedChanges(false);
          },
        },
      ]
    );
  };

  const getAnswerCount = (): number => {
    return [
      answers.reflection1,
      answers.reflection2,
      answers.reflection3,
      answers.reflection4,
      answers.reflection5,
    ].filter(answer => answer.trim().length > 0).length;
  };

  const renderQuestion = (questionData: ReflectionQuestion) => {
    const { id, question, placeholder } = questionData;
    const value = answers[id as keyof ReflectionAnswers];
    const isAnswered = value.trim().length > 0;

    return (
      <View key={id} style={styles.questionContainer}>
        <View style={styles.questionHeader}>
          <Text style={styles.questionText}>{question}</Text>
          {isAnswered && <Text style={styles.answeredIndicator}>✓</Text>}
        </View>
        
        <TextInput
          style={[
            styles.answerInput,
            isAnswered && styles.answerInputAnswered,
            disabled && styles.disabledInput,
          ]}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          value={value}
          onChangeText={(text) => updateAnswer(id as keyof ReflectionAnswers, text)}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!disabled}
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Bible Study Reflection</Text>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {getAnswerCount()} of {REFLECTION_QUESTIONS.length} questions answered
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(getAnswerCount() / REFLECTION_QUESTIONS.length) * 100}%` }
                ]} 
              />
            </View>
          </View>
        </View>

        <View style={styles.questionsContainer}>
          {REFLECTION_QUESTIONS.map(renderQuestion)}

          {/* Additional notes section */}
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>Additional Notes (Optional)</Text>
            <TextInput
              style={[
                styles.answerInput,
                styles.notesInput,
                disabled && styles.disabledInput,
              ]}
              placeholder="Any additional thoughts, insights, or personal notes..."
              placeholderTextColor="#9ca3af"
              value={answers.notes}
              onChangeText={(text) => updateAnswer('notes', text)}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              editable={!disabled}
            />
          </View>
        </View>

        {!disabled && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.clearButton]}
              onPress={clearForm}
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.saveButton,
                !hasUnsavedChanges && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!hasUnsavedChanges}
            >
              <Text style={[
                styles.saveButtonText,
                !hasUnsavedChanges && styles.saveButtonTextDisabled,
              ]}>
                Save Reflection
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && !disabled && (
          <View style={styles.unsavedIndicator}>
            <Text style={styles.unsavedText}>• You have unsaved changes</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  questionsContainer: {
    padding: 20,
  },
  questionContainer: {
    marginBottom: 32,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    lineHeight: 24,
  },
  answeredIndicator: {
    fontSize: 16,
    color: '#10b981',
    marginLeft: 8,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#ffffff',
    minHeight: 100,
  },
  answerInputAnswered: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  notesInput: {
    minHeight: 120,
    backgroundColor: '#f9fafb',
  },
  disabledInput: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
  },
  saveButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  saveButtonTextDisabled: {
    color: '#9ca3af',
  },
  unsavedIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  unsavedText: {
    fontSize: 14,
    color: '#f59e0b',
    fontStyle: 'italic',
  },
});