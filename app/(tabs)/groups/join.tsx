import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    ScrollView,
} from 'react-native';
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, query, where, limit, increment, arrayUnion, serverTimestamp, addDoc } from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { useRouter } from 'expo-router';
import { ChevronLeft, Key } from 'lucide-react-native';
import { Button } from '@/src/components/Button';
import { Hero, Screen, Text, ThemedButton, textStyle } from '@/src/components/ui';
import { ScalePressable } from '@/src/components/ScalePressable';

// In a real app, this might be a dynamic code or fetched from a config

export default function JoinGroupScreen() {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const { user, displayName } = useAuth();
    const { colors, style: themeStyle, isLockedIn } = useTheme();
    const { showAlert } = useAlert();
    const router = useRouter();
    const db = getFirestore();

    const handleJoin = async () => {
        const inputCode = code.trim().toUpperCase();
        if (!inputCode) return;

        if (!user) return;

        setLoading(true);
        try {
            // Query for group with this code
            const groupQuery = await getDocs(
                query(collection(db, 'groups'), where('code', '==', inputCode), limit(1))
            );

            if (groupQuery.empty) {
                showAlert({ title: 'Invalid Code', message: 'No group found with this access code. Please check and try again.' });
                setLoading(false);
                return;
            }

            const groupDoc = groupQuery.docs[0];
            const groupId = groupDoc.id;
            const groupData = groupDoc.data();

            // Add user to the members subcollection of the group
            const memberRef = doc(db, 'groups', groupId, 'members', user.uid);

            const existingMember = await getDoc(memberRef);
            if (existingMember.exists()) {
                showAlert({ title: 'Already a Member', message: `You are already part of "${groupData.name}".` });
                router.replace('/(tabs)/groups' as any);
                return;
            }

            const userDocSnap = await getDoc(doc(db, 'users', user.uid));
            const userDocData = userDocSnap.data() || {};
            const userGender = userDocData.gender;

            await setDoc(memberRef, {
                userId: user.uid,
                displayName: displayName || user.email?.split('@')[0] || 'User',
                gender: userGender || 'm',
                photoURL: userDocData.photoURL || null,
                joinedAt: serverTimestamp(),
                lastActive: serverTimestamp(),
            });

            // Keep memberCount accurate on the group doc
            await setDoc(doc(db, 'groups', groupId), { memberCount: increment(1) }, { merge: true });

            // Also keep track of groups the user is in at the user level
            await setDoc(doc(db, 'users', user.uid), {
                groupIds: arrayUnion(groupId),
                lastModified: serverTimestamp(),
            }, { merge: true });

            // 5. Success - Trigger joined activity
            const resolvedName = displayName || user.displayName || user.email?.split('@')[0] || 'User';

            await addDoc(collection(db, 'groups', groupId, 'activities'), {
                userId: user.uid,
                userName: resolvedName,
                type: 'member_joined',
                timestamp: serverTimestamp(),
            });

            showAlert({ title: 'Welcome!', message: `You have joined "${groupData.name}".` });
            router.replace('/(tabs)/groups' as any);
        } catch (error: any) {
            console.error(error);
            showAlert({ title: 'Error', message: 'Failed to join group: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    if (isLockedIn) {
        /*
         * design/all-screens.html #join, the `.co` slot.
         *
         * The code is the whole screen: no card, no icon, just the field set
         * large on an ochre underline so it reads as the one thing to fill in.
         * The sign-in path sits below its own rule, because it answers a
         * different question — "what if I have no code?" — rather than being a
         * second way to do the same thing.
         */
        return (
            <Screen>
                <View style={styles.colossalTop}>
                    <ScalePressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        hitSlop={Spacing.md}
                        style={styles.backArrow}
                    >
                        <ChevronLeft size={20} color={colors.textTertiary} strokeWidth={2} />
                    </ScalePressable>
                    <Text variant="tab">Join a circle</Text>
                </View>

                <ScrollView contentContainerStyle={styles.colossalContent} keyboardShouldPersistTaps="handled">
                    <Text variant="label">Group code</Text>
                    <TextInput
                        style={[
                            styles.colossalInput,
                            textStyle(themeStyle, 'display'),
                            // The design tracks the code apart rather than
                            // together — it is six separate characters to read
                            // back to someone, not a word.
                            { letterSpacing: 2.4, color: colors.textPrimary, borderBottomColor: colors.accent },
                        ]}
                        placeholder="XXXXXX"
                        placeholderTextColor={colors.textTertiary}
                        value={code}
                        onChangeText={setCode}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={10}
                        accessibilityLabel="Group code"
                    />
                    <Text variant="sub" style={styles.colossalHint}>
                        Ask whoever set up the circle for its six-character code.
                    </Text>

                    <View style={[styles.rule, { backgroundColor: colors.border }]} />

                    <ThemedButton
                        label={loading ? 'Joining…' : 'Join this circle'}
                        variant="accent"
                        block
                        loading={loading}
                        disabled={loading || !code.trim()}
                        onPress={handleJoin}
                    />

                    <View style={[styles.rule, { backgroundColor: colors.border }]} />

                    <Text variant="label">No code?</Text>
                    <Text variant="sub" style={styles.colossalHint}>
                        Groups sync through your account, so you&apos;ll need to sign in before
                        joining one.
                    </Text>
                    <ThemedButton
                        label="Sign in to Join Them"
                        variant="secondary"
                        block
                        style={styles.signIn}
                        onPress={() => router.push('/(tabs)/groups/auth' as any)}
                    />
                </ScrollView>
            </Screen>
        );
    }

    return (
        <Screen>
            <Hero>
                <Text variant="display" tone="inverse">Enter{'\n'}Group Code</Text>
            </Hero>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <View style={styles.intro}>
                        <View style={[styles.iconContainer, { backgroundColor: colors.accentSecondaryLight + '30' }]}>
                            <Key size={32} color={colors.accentSecondary} />
                        </View>
                        <Text variant="body" tone="secondary" style={styles.subtitle}>
                            Enter the code to join a group.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <TextInput
                            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.cardBackground, borderColor: colors.borderSubtle }]}
                            placeholder="X X X X X X"
                            placeholderTextColor={colors.textMuted}
                            value={code}
                            onChangeText={setCode}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            maxLength={10}
                        />

                        <Button
                            label={loading ? 'Joining Group...' : 'Continue to Group'}
                            variant="primary"
                            size="lg"
                            onPress={handleJoin}
                            disabled={loading || !code.trim()}
                            loading={loading}
                            fullWidth
                        />
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

    // ── Colossal ──────────────────────────────────────────────────────────
    colossalTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.lg,
    },
    backArrow: { marginLeft: -6 },
    colossalContent: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.xl + 2,
        paddingBottom: Spacing.xxl,
    },
    /** Underlined, not boxed — the field is the screen. */
    colossalInput: {
        textAlign: 'center',
        paddingVertical: Spacing.xl,
        borderBottomWidth: Spacing.border.strong,
    },
    colossalHint: { marginTop: Spacing.lg },
    /** `.co-hr` */
    rule: { height: Spacing.border.hairline, marginVertical: Spacing.xl + 2 },
    signIn: { marginTop: Spacing.layout.cardPadding },
    content: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xl,
    },
    card: {
        padding: Spacing.xl,
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        alignItems: 'center',
    },
    intro: {
        alignItems: 'center',
        marginBottom: Spacing.xxxl,
    },
    iconContainer: {
        width: 84,
        height: 84,
        borderRadius: Spacing.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    title: { marginBottom: Spacing.xs },
    subtitle: { textAlign: 'center', opacity: 0.6, paddingHorizontal: Spacing.md },
    form: {
        width: '100%',
        gap: Spacing.lg,
    },
    input: {
        fontSize: 34,
        textAlign: 'center',
        height: 72,
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        letterSpacing: 6,
        fontWeight: '800',
        marginBottom: Spacing.lg,
    },
});
