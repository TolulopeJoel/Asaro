import { useState } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Asaro, Hero, Screen, Text } from '@/src/components/ui';


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
        <Screen>
            <Hero>
                <Text variant="label" tone="onHero" style={styles.heroStep}>Step 1 of 3</Text>
                <Text variant="display" tone="inverse">Hello.</Text>
            </Hero>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <View style={styles.textContainer}>
                        <View style={styles.introBlock}>
                            {/* Àṣàrò waves hello. The copy already spoke in the
                                first person; this gives the voice a form. */}
                            <Asaro size={124} action="wave" />

                            <Text variant="body" style={styles.introText}>
                                I want to help you stay consistent with your reading.
                                But I can&apos;t be friends with a stranger, can I?
                                {'\n\n'}
                                <Text style={{ fontStyle: 'italic', opacity: 0.6 }}>Let&apos;s make this official 😏</Text>
                            </Text>
                        </View>

                        <View style={styles.nameSection}>
                            <Text variant="label" tone="secondary" style={styles.label}>
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
                                    backgroundColor: isValid ? colors.textPrimary : colors.cardBackground,
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
        </Screen>
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
        paddingTop: Spacing.layout.screenPadding,
    },
    textContainer: {
        flex: 1,
        width: '100%',
    },
    introBlock: {
        marginBottom: Spacing.xxxl,
    },
    heroStep: { marginBottom: Spacing.sm },
    introText: { opacity: 0.8 },
    nameSection: {
        gap: Spacing.md,
        marginTop: Spacing.xl,
    },
    label: { opacity: 0.5 },
    inputContainer: {
        borderRadius: Spacing.borderRadius.md,
        overflow: 'hidden',
    },
    input: {
        fontSize: Typography.size.xxxl,
        fontWeight: Typography.weight.bold,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        letterSpacing: -0.5,
    },
    footer: {
        paddingTop: Spacing.xxl,
    },
    button: {
        paddingVertical: 20,
        borderRadius: Spacing.borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    buttonText: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.semibold,
        letterSpacing: 0.3,
    },
});