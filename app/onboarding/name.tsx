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
        <Screen edges={[]}>
            {/* Scrolls so the keyboard can never cover the field: Android's
              * ScrollView keeps the focused input on screen as the window
              * shrinks for the keyboard. */}
            <ScrollView
                style={styles.keyboardView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <Hero ownsTopInset topPadding={64}>
                    <Text variant="label" tone="onHero" style={styles.heroStep}>{onboardingStepLabel('name')}</Text>
                    <Text variant="display" tone="onBand">Hello.</Text>
                </Hero>

                {/* The field sits high, under the sibling's line, so a keyboard opening never covers it. */}
                <View style={[styles.clothBody, { paddingBottom: footPadding }]}>
                    <View style={styles.speech}>
                        <Asaro size={74} look={look} action="wave" />
                        <Text variant="body" style={styles.speechText}>
                            I want to help you stay consistent with your reading.
                            But I can&apos;t be friends with a stranger, can I? Let&apos;s make this official.
                        </Text>
                    </View>

                    <View style={styles.nameSection}>
                        <Text variant="label" tone="secondary">What do your friends call you?</Text>
                        <View style={[styles.inputContainer, { backgroundColor: colors.backgroundSubtle }]}>
                            <TextInput
                                style={[styles.input, { color: colors.textPrimary }]}
                                placeholder="Your name"
                                placeholderTextColor={colors.textMuted}
                                value={name}
                                onChangeText={handleTextChange}
                                autoCorrect={false}
                                returnKeyType="done"
                                onSubmitEditing={handleContinue}
                                accessibilityLabel="Your name"
                            />
                        </View>
                    </View>

                    <View style={styles.foot}>
                        <ThemedButton label="Continue" block disabled={!isValid} onPress={handleContinue} />
                    </View>
                </View>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    keyboardView: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    /** The band's eyebrow: `margin:0 0 10px`. */
    heroStep: { marginBottom: 10 },
    /** `.cl-body{padding-top:30px; gap:18px}` */
    clothBody: {
        flex: 1,
        paddingTop: Spacing.xxl - 2,
        paddingHorizontal: Spacing.layout.screenPadding,
        gap: Spacing.layout.cardPadding,
    },
    speech: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    speechText: { flex: 1 },
    nameSection: { gap: Spacing.sm, marginTop: Spacing.sm },
    inputContainer: { overflow: 'hidden' },
    input: {
        fontSize: Typography.size.xxxl,
        fontWeight: Typography.weight.bold,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        letterSpacing: -0.5,
    },
    /** Continue sits at the foot, like every onboarding page's button. */
    foot: { marginTop: 'auto', paddingTop: Spacing.xl },
});
