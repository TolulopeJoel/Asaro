import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Asaro, Hero, Screen, Text, ThemedButton, type AsaroLook } from '@/src/components/ui';
import { onboardingStepLabel } from '@/src/utils/onboardingSteps';
import { setAsaroLook } from '@/src/storage/asaroLook';
import { useFootPadding } from '@/src/hooks/useScreenInsets';

const LOOK_CHOICES: { look: AsaroLook; label: string }[] = [
    { look: 'male', label: 'Him' },
    { look: 'female', label: 'Her' },
];

/** The first choice anyone makes: which Àṣàrò walks them through the rest. */
export default function CharacterScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const footPadding = useFootPadding();
    // Nothing preselected, so the choice is always the user's own.
    const [picked, setPicked] = useState<AsaroLook | null>(null);

    const handleContinue = async () => {
        if (!picked) return;
        try {
            await setAsaroLook(picked);
            router.push('/onboarding/name');
        } catch (error) {
            console.error('Error saving look:', error);
        }
    };

    return (
        <Screen edges={[]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Hero ownsTopInset topPadding={64}>
                    <Text variant="label" tone="onHero" style={styles.heroStep}>{onboardingStepLabel('character')}</Text>
                    <Text variant="display" tone="onBand">Meet Àṣàrò</Text>
                </Hero>

                <View style={[styles.clothBody, { paddingBottom: footPadding }]}>
                    <Text variant="sub">
                        Pick who you&apos;ll be reading with. They&apos;ll be the one checking up on you.
                    </Text>

                    <View style={styles.looks} accessibilityRole="radiogroup">
                        {LOOK_CHOICES.map(({ look, label }) => {
                            const on = look === picked;
                            return (
                                <ScalePressable
                                    key={look}
                                    onPress={() => setPicked(look)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: on }}
                                    accessibilityLabel={label}
                                    style={[styles.lookChoice, { opacity: picked && !on ? 0.45 : 1 }]}
                                >
                                    <View style={[
                                        styles.lookRing,
                                        { borderColor: on ? colors.textPrimary : 'transparent' },
                                    ]}>
                                        <Asaro size={120} look={look} action={on ? 'wave' : undefined} />
                                    </View>
                                    <Text variant="meta" tone={on ? 'primary' : 'secondary'}>{label}</Text>
                                </ScalePressable>
                            );
                        })}
                    </View>

                    <ThemedButton label="Continue" block disabled={!picked} onPress={handleContinue} />
                </View>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    /** The band's eyebrow: `margin:0 0 10px`. */
    heroStep: { marginBottom: 10 },
    scrollContent: { flexGrow: 1 },
    /** `.cl-body{padding-top:30px; gap:18px}` */
    clothBody: {
        flex: 1,
        paddingTop: Spacing.xxl - 2,
        paddingHorizontal: Spacing.layout.screenPadding,
        gap: Spacing.layout.cardPadding,
    },
    looks: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.xl,
        paddingVertical: Spacing.xl,
    },
    lookChoice: { alignItems: 'center', gap: Spacing.sm },
    lookRing: {
        borderWidth: Spacing.border.strong,
        borderRadius: Spacing.borderRadius.round,
        padding: 3,
    },
});
