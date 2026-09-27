import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    ScrollView,
} from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Hero, Screen, Text, ThemedButton, textStyle } from '@/src/components/ui';
import { ScalePressable } from '@/src/components/ScalePressable';
import { joinGroup } from '@/src/groups/repository';

export default function JoinGroupScreen() {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const { colors, style: themeStyle } = useTheme();
    const { showAlert } = useAlert();
    const router = useRouter();

    // joinGroup hands a second tap the first tap's result, so no guard is needed here.
    const handleJoin = async () => {
        if (!code.trim()) return;
        if (!user) {
            router.push('/(tabs)/groups/auth' as any);
            return;
        }

        setLoading(true);
        try {
            const result = await joinGroup(code);
            switch (result.status) {
                case 'invalid':
                    showAlert({ title: 'Invalid Code', message: 'No group found with this access code. Please check and try again.' });
                    break;
                case 'offline':
                    showAlert({ title: "You're offline", message: 'Joining a group needs a connection. Try again once you are back online.' });
                    break;
                case 'signed-out':
                    router.push('/(tabs)/groups/auth' as any);
                    break;
                case 'already':
                    showAlert({ title: 'Already a Member', message: `You are already part of "${result.name}".` });
                    router.replace(`/(tabs)/groups/${result.groupId}` as any);
                    break;
                case 'joined':
                    showAlert({ title: 'Welcome!', message: `You have joined "${result.name}". This week's readings are on their way to the group.` });
                    router.replace(`/(tabs)/groups/${result.groupId}` as any);
                    break;
            }
        } catch (error: any) {
            console.error(error);
            showAlert({ title: 'Error', message: 'Failed to join group: ' + (error?.message ?? 'something went wrong') });
        } finally {
            setLoading(false);
        }
    };

    /*
     * design/all-screens.html #join, the `.cl` slot.
     *
     * A near-empty screen, which the design note calls "where a style has
     * nowhere to hide", so it stays plain: back arrow and title on the band,
     * then the sub-line, the labelled field, the primary button (plain
     * `.cl-btn`, not the ochre variant), and the "No code?" panel with its own
     * ghost button — the only way Cloth reaches auth.tsx.
     */
    return (
        <Screen edges={[]}>
            <Hero ownsTopInset>
                <View style={styles.clothTop}>
                    <ScalePressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        hitSlop={Spacing.md}
                        style={styles.backArrow}
                    >
                        <ChevronLeft size={20} color={colors.accent} strokeWidth={1.9} />
                    </ScalePressable>
                </View>
                <Text variant="display" tone="onBand" style={styles.clothHeroTitle}>
                    Enter{'\n'}Group Code
                </Text>
            </Hero>

            <ScrollView contentContainerStyle={styles.clothBody} keyboardShouldPersistTaps="handled">
                <Text variant="sub">
                    Ask whoever set up the circle for its six-character code.
                </Text>

                <View>
                    <Text variant="label" style={styles.clothFieldLabel}>Group code</Text>
                    <TextInput
                        style={[
                            styles.clothInput,
                            textStyle(themeStyle, 'headline'),
                            { color: colors.textPrimary, backgroundColor: colors.backgroundSubtle, letterSpacing: 6.6 },
                        ]}
                        placeholder="XXXXXX"
                        placeholderTextColor={colors.textMuted}
                        value={code}
                        onChangeText={setCode}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={10}
                        accessibilityLabel="Group code"
                    />
                </View>

                <ThemedButton
                    label={loading ? 'Joining…' : 'Join this circle'}
                    block
                    loading={loading}
                    disabled={loading || !code.trim()}
                    onPress={handleJoin}
                />

                <View style={[styles.clothPanel, { backgroundColor: colors.backgroundSubtle }]}>
                    <Text variant="label" style={styles.clothPanelLabel}>No code?</Text>
                    {user ? (
                        <Text variant="body" tone="secondary">
                            Ask anyone in the group to share it with you. It&apos;s six letters
                            and numbers.
                        </Text>
                    ) : (
                        <>
                            <Text variant="body" tone="secondary">
                                Groups sync through your account, so you&apos;ll need to sign in before
                                joining one.
                            </Text>
                            <ThemedButton
                                label="Sign in to Join Them"
                                variant="secondary"
                                style={styles.clothSignIn}
                                onPress={() => router.push('/(tabs)/groups/auth' as any)}
                            />
                        </>
                    )}
                </View>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    backArrow: { marginLeft: -6 },

    // ── Cloth ─────────────────────────────────────────────────────────────
    /** `.cl-top` — just the back arrow on this screen. */
    clothTop: { flexDirection: 'row', alignItems: 'center' },
    /** `.cl-htitle{margin-top:10px}` */
    clothHeroTitle: { marginTop: 10 },
    /** `.cl-body{padding:22px 24px 0; gap:18px}` */
    clothBody: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.layout.cardPadding + 4,
        paddingBottom: Spacing.xxl,
        gap: Spacing.layout.cardPadding,
    },
    /** `.cl-label{display:block}` above the field. */
    clothFieldLabel: { marginBottom: Spacing.sm },
    /** `.cl-input{padding:20px}`, Fraunces at 30/700/.22em, centred. */
    clothInput: {
        textAlign: 'center',
        padding: 20,
    },
    /** `.cl-panel` — the only panel on this screen. */
    clothPanel: {
        padding: Spacing.layout.cardPadding,
        gap: Spacing.xs,
    },
    clothPanelLabel: { marginBottom: 7 },
    /** `.cl-btn.ghost{margin-top:14px}` — not full width. */
    clothSignIn: { marginTop: Spacing.md + 2, alignSelf: 'flex-start' },
});
