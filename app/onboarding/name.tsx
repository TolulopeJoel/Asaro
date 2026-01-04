import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { ScalePressable } from '@/src/components/ScalePressable';


export default function NameScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [name, setName] = useState('');
    const [isValid, setIsValid] = useState(false);

    const handleContinue = async () => {
        if (name.trim().length > 0) {
            try {
                await AsyncStorage.setItem('user_name', name.trim());
                router.push('/onboarding/sleep-time');
            } catch (error) {
                console.error('Error saving name:', error);
            }
        }
    };

    const handleTextChange = (text: string) => {
        setName(text);
        setIsValid(text.trim().length > 0);
    };

    return (
        <View
            style={[styles.container, { backgroundColor: colors.background }]}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <View style={[styles.textContainer, { borderLeftColor: colors.accentSecondary }]}>
                        <View style={styles.introBlock}>
                            <Text style={[styles.greeting, { color: colors.textPrimary }]}>
                                Hello.
                            </Text>

                            <Text style={[styles.introText, { color: colors.textPrimary }]}>
                                I want to help you stay consistent with your reading.
                                But I can&apos;t be friends with a stranger, can I?
                                {'\n\n'}
                                <Text style={{ fontStyle: 'italic', opacity: 0.7 }}>Let&apos;s make this official 😏</Text>
                            </Text>
                        </View>

                        <View style={styles.nameSection}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>
                                What do your friends call you?
                            </Text>

                            <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground }]}>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            color: colors.textPrimary,
                                        }
                                    ]}
                                    placeholder=""
                                    placeholderTextColor={colors.textMuted}
                                    value={name}
                                    onChangeText={handleTextChange}
                                    autoCorrect={false}
                                    returnKeyType="next"
                                    autoFocus={true}
                                    onSubmitEditing={handleContinue}
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <ScalePressable
                            style={[
                                styles.button,
                                {
                                    backgroundColor: isValid ? colors.textPrimary : 'transparent',
                                    borderColor: isValid ? 'transparent' : colors.border,
                                    borderWidth: isValid ? 0 : 1,
                                    opacity: isValid ? 1 : 0.5,
                                }
                            ]}
                            onPress={handleContinue}
                            disabled={!isValid}
                        >
                            <Text style={[
                                styles.buttonText,
                                { color: isValid ? colors.background : colors.textSecondary }
                            ]}>
                                Continue
                            </Text>
                        </ScalePressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: Spacing.layout.screenPadding,
        justifyContent: 'space-between',
        paddingTop: 100,
    },
    textContainer: {
        flex: 1,
        width: '100%',
        paddingLeft: Spacing.lg,
        borderLeftWidth: 3,
    },
    introBlock: {
        marginBottom: Spacing.xxxl * 2,
    },
    greeting: {
        fontSize: Typography.size.display,
        fontWeight: Typography.weight.regular,
        fontFamily: Typography.fontFamily.serif,
        letterSpacing: -1,
        marginBottom: Spacing.lg,
    },
    introText: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.regular,
        lineHeight: Typography.lineHeight.xl,
        fontFamily: Typography.fontFamily.serif,
        letterSpacing: 0.2,
        opacity: 0.85,
    },
    nameSection: {
        gap: Spacing.md,
    },
    label: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        letterSpacing: 2,
        textTransform: 'uppercase',
        opacity: 0.6,
        fontFamily: Typography.fontFamily.regular, // Sans-serif for label contrast
    },
    inputContainer: {
        borderRadius: Spacing.borderRadius.sm,
        overflow: 'hidden',
    },
    input: {
        fontSize: Typography.size.xxxl,
        fontWeight: Typography.weight.regular,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.sm, // Added padding for the blur container
        letterSpacing: 0.5,
        fontFamily: Typography.fontFamily.serif,
        borderBottomWidth: 0, // Remove underline for cleaner look
    },
    footer: {
        paddingTop: Spacing.xxl,
        paddingHorizontal: Spacing.lg, // Align with content roughly
    },
    button: {
        paddingVertical: 20,
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    buttonText: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
        letterSpacing: 3,
        textTransform: 'uppercase',
    },
});