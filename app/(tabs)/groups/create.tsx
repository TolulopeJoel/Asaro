/**
 * Start a group. design/all-screens.html #create: a name and an optional line
 * about it, then the six-character code to pass on. Readers who don't meet
 * design/GROUPS.md#who-can-start-a-group yet see how far along they are instead.
 */
import React, { useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { useTheme } from '@/src/theme/ThemeContext';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { useFootPadding } from '@/src/hooks/useScreenInsets';
import { createGroup } from '@/src/groups/repository';
import { useCreateEligibility } from '@/src/groups/hooks';
import { useAuth } from '@/src/context/AuthContext';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Hero, Row, Screen, Text, ThemedButton, textStyle } from '@/src/components/ui';

export default function CreateGroupScreen() {
    const router = useRouter();
    const { colors, style: themeStyle } = useTheme();
    const { showAlert } = useAlert();
    const footPadding = useFootPadding();
    const [name, setName] = useState('');
    const [about, setAbout] = useState('');
    const [saving, setSaving] = useState(false);
    const [created, setCreated] = useState<{ groupId: string; code: string; name: string } | null>(null);
    const creating = useRef(false);
    const { user } = useAuth();
    const { eligibility, failed, refresh } = useCreateEligibility();

    const create = async () => {
        if (creating.current) return;
        if (!name.trim()) {
            showAlert({ title: 'It needs a name', message: 'Give the group a name the others will recognise.' });
            return;
        }
        creating.current = true;
        setSaving(true);
        try {
            const result = await createGroup(name, about);
            if (result.status === 'created') setCreated({ groupId: result.groupId, code: result.code, name: name.trim() });
            else if (result.status === 'offline') showAlert({ title: 'You’re offline', message: 'Starting a group needs a connection. Try again once you’re back online.' });
            else if (result.status === 'signed-out') router.push('/(tabs)/groups/auth' as any);
            else if (result.status === 'not-eligible') refresh();
            else showAlert({ title: 'It needs a name', message: 'Give the group a name the others will recognise.' });
        } catch (error) {
            console.error('[groups] create failed:', error);
            showAlert({ title: 'Not created', message: 'The group could not be made just now. Please try again.' });
        } finally {
            creating.current = false;
            setSaving(false);
        }
    };

    const input = [
        styles.input,
        textStyle(themeStyle, 'body'),
        { color: colors.textPrimary, backgroundColor: colors.backgroundSubtle, borderColor: colors.border },
    ];

    if (created) {
        return (
            <Screen edges={[]}>
                <Hero ownsTopInset>
                    <Text variant="display" tone="onBand" style={styles.title}>{created.name}</Text>
                    <Text variant="sub" tone="onHero" style={styles.heroSub}>Your group is ready.</Text>
                </Hero>
                <ScrollView contentContainerStyle={[styles.body, { paddingBottom: footPadding }]}>
                    <View style={[styles.codePanel, { backgroundColor: colors.backgroundSubtle }]}>
                        <Text variant="label" style={styles.codeLabel}>Group code</Text>
                        <Text variant="hero" style={styles.code} selectable accessibilityLabel={`Group code ${created.code.split('').join(' ')}`}>
                            {created.code}
                        </Text>
                        <Text variant="sub" style={styles.codeSub}>
                            Anyone with this code can join. You can make a new one from the group later.
                        </Text>
                    </View>
                    <ThemedButton
                        label="Share the code"
                        block
                        onPress={() => { void Share.share({ message: `Join "${created.name}" on Àṣàrò. The group code is ${created.code}.` }); }}
                    />
                    <ThemedButton
                        label="Go to the group"
                        variant="secondary"
                        block
                        onPress={() => router.replace(`/(tabs)/groups/${created.groupId}` as any)}
                    />
                </ScrollView>
            </Screen>
        );
    }

    const back = (
        <ScalePressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={Spacing.md}
            style={styles.back}
        >
            <ChevronLeft size={20} color={colors.accent} strokeWidth={1.9} />
        </ScalePressable>
    );

    if (!user || !eligibility?.eligible) {
        const rules = eligibility ? [
            {
                title: 'Read a quarter of the plan',
                line: `${eligibility.readings.have} of ${eligibility.readings.need} readings`,
                done: eligibility.readings.have >= eligibility.readings.need,
            },
            {
                title: 'Read in six different weeks',
                line: `${eligibility.weeks.have} of ${eligibility.weeks.need} weeks`,
                done: eligibility.weeks.have >= eligibility.weeks.need,
            },
            {
                title: 'Be in a group for three weeks',
                line: eligibility.groupWeeks.inGroup
                    ? `${eligibility.groupWeeks.have} of ${eligibility.groupWeeks.need} weeks`
                    : 'Join a group first',
                done: eligibility.groupWeeks.have >= eligibility.groupWeeks.need,
            },
        ] : [];

        return (
            <Screen edges={[]}>
                <Hero ownsTopInset>
                    {back}
                    <Text variant="display" tone="onBand" style={styles.title}>Start a group</Text>
                    <Text variant="sub" tone="onHero" style={styles.heroSub}>Groups are started by readers who’ve been at it a while.</Text>
                </Hero>
                <ScrollView contentContainerStyle={[styles.body, { paddingBottom: footPadding }]}>
                    {!user ? (
                        <>
                            <Text variant="sub">Sign in first. Groups sync through your account.</Text>
                            <ThemedButton label="Sign in" onPress={() => router.push('/(tabs)/groups/auth' as any)} />
                        </>
                    ) : failed ? (
                        <>
                            <Text variant="sub">Couldn’t check just now.</Text>
                            <ThemedButton label="Try again" variant="secondary" onPress={refresh} />
                        </>
                    ) : (
                        <View>
                            {rules.map(rule => (
                                <Row key={rule.title}>
                                    <View style={styles.ruleMain}>
                                        <Text variant="reference">{rule.title}</Text>
                                        <Text variant="bodySmall" style={styles.snip}>{rule.line}</Text>
                                    </View>
                                    <Text variant="meta" tone={rule.done ? 'accent' : 'secondary'}>{rule.done ? 'Done' : 'Not yet'}</Text>
                                </Row>
                            ))}
                        </View>
                    )}
                </ScrollView>
            </Screen>
        );
    }

    return (
        <Screen edges={[]}>
            <Hero ownsTopInset>
                <ScalePressable
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    hitSlop={Spacing.md}
                    style={styles.back}
                >
                    <ChevronLeft size={20} color={colors.accent} strokeWidth={1.9} />
                </ScalePressable>
                <Text variant="display" tone="onBand" style={styles.title}>Start a group</Text>
                <Text variant="sub" tone="onHero" style={styles.heroSub}>For the people you want to read with.</Text>
            </Hero>

            <ScrollView contentContainerStyle={[styles.body, { paddingBottom: footPadding }]} keyboardShouldPersistTaps="handled">
                <View>
                    <Text variant="label" style={styles.label}>Name</Text>
                    <TextInput
                        style={input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Morning Circle"
                        placeholderTextColor={colors.textTertiary}
                        maxLength={50}
                        autoCapitalize="words"
                        accessibilityLabel="Name"
                    />
                </View>
                <View>
                    <Text variant="label" style={styles.label}>About it · optional</Text>
                    <TextInput
                        style={input}
                        value={about}
                        onChangeText={setAbout}
                        placeholder="What brings you together"
                        placeholderTextColor={colors.textTertiary}
                        maxLength={200}
                        accessibilityLabel="About it"
                    />
                </View>
                <ThemedButton
                    label={saving ? 'Creating…' : 'Create group'}
                    block
                    loading={saving}
                    disabled={saving || !name.trim()}
                    onPress={create}
                />
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    back: { alignSelf: 'flex-start', marginLeft: -6 },
    /** `.cl-htitle{margin-top:10px}` */
    title: { marginTop: 10 },
    heroSub: { marginTop: Spacing.sm },
    /** `.cl-body{padding:22px 24px 0; gap:18px}` */
    body: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.layout.cardPadding + 4,
        gap: Spacing.layout.cardPadding,
    },
    label: { marginBottom: 9 },
    ruleMain: { flex: 1, minWidth: 0 },
    snip: { marginTop: 4 },
    /** `.cl-input{padding:12px 14px}` */
    input: { borderWidth: Spacing.border.hairline, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md + 2 },
    /** `.cl-panel{padding:28px 18px; text-align:center}` */
    codePanel: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: Spacing.layout.cardPadding },
    codeLabel: { marginBottom: Spacing.md },
    /** `.code{letter-spacing:.12em}` over the stat numeral, the nearest role to the mockup's 44px. */
    code: { letterSpacing: 4 },
    codeSub: { marginTop: Spacing.md, textAlign: 'center' },
});
