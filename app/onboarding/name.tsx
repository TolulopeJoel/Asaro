import { useState } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    ScrollView,
    } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { Asaro, Hero, Screen, Text, ThemedButton } from '@/src/components/ui';
import { onboardingStepLabel } from '@/src/utils/onboardingSteps';
import { useAsaroLook } from '@/src/storage/asaroLook';
import { useAuth } from '@/src/context/AuthContext';
import { useFootPadding } from '@/src/hooks/useScreenInsets';

export default function NameScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [name, setName] = useState('');
    const [isValid, setIsValid] = useState(false);
    const look = useAsaroLook();
    const { updateName } = useAuth();
    const footPadding = useFootPadding(Spacing.layout.screenPadding);

    const handleContinue = async () => {
        if (name.trim().length > 0) {
            try {
                await updateName(name);
                router.push('/onboarding/tour');
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
                <Text variant="label" tone="onHero" style={styles.heroStep}>{onboardingStepLabel('name')}</Text>
                <Text variant="display" tone="onBand">Hello.</Text>
            </Hero>
            {/* Scrolls so the keyboard can never cover the field: Android's
              * ScrollView keeps the focused input on screen as the window
              * shrinks for the keyboard. */}
            <ScrollView
                style={styles.keyboardView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[styles.content, { paddingBottom: footPadding }]}>
                    <View style={styles.textContainer}>
                        <View style={styles.introBlock}>
                            <View style={styles.asaro}>
                                <Asaro size={104} look={look} action="wave" />
                            </View>

                            <Text variant="body" style={styles.introText}>
                                I want to help you stay consistent with your reading.
                                But I can&apos;t be friends with a stranger, can I?
                                {'\n\n'}
                                <Text style={{ fontStyle: 'italic', opacity: 0.6 }}>Let&apos;s make this official.</Text>
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
                        <ThemedButton label="Continue" block disabled={!isValid} onPress={handleContinue} />
                    </View>
                </View>
            </ScrollView>
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
    scrollContent: { flexGrow: 1 },
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
    asaro: { alignItems: 'center', marginBottom: Spacing.lg },
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
});