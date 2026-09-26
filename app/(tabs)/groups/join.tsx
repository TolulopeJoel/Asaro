import React, { useRef, useState } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    ScrollView,
} from 'react-native';
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, query, where, limit, increment, arrayUnion, serverTimestamp, writeBatch } from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Hero, Screen, Text, ThemedButton, textStyle } from '@/src/components/ui';
import { ScalePressable } from '@/src/components/ScalePressable';

// In a real app, this might be a dynamic code or fetched from a config

export default function JoinGroupScreen() {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const { user, displayName } = useAuth();
    const { colors, style: themeStyle } = useTheme();
    const { showAlert } = useAlert();
    const router = useRouter();
    const db = getFirestore();

    const joining = useRef(false);

    const handleJoin = async () => {
        const inputCode = code.trim().toUpperCase();
        if (!inputCode) return;

        if (!user) return;
        if (joining.current) return;
        joining.current = true;

        setLoading(true);
        try {
            // Query for group with this code
            const groupQuery = await getDocs(
                query(collection(db, 'groups'), where('code', '==', inputCode), limit(1))
            );

            // A cached answer means no connection, and joining needs one.
            if (groupQuery.metadata.fromCache) {
                showAlert({ title: "You're offline", message: 'Joining a group needs a connection. Try again once you are back online.' });
                return;
            }

            if (groupQuery.empty) {
                showAlert({ title: 'Invalid Code', message: 'No group found with this access code. Please check and try again.' });
                return;
            }

            const groupDoc = groupQuery.docs[0];
            const groupId = groupDoc.id;
            const groupData = groupDoc.data();

            const memberRef = doc(db, 'groups', groupId, 'members', user.uid);
            const userRef = doc(db, 'users', user.uid);

            const [existingMember, userDocSnap] = await Promise.all([getDoc(memberRef), getDoc(userRef)]);
            const userDocData = userDocSnap.data() || {};
            const inUserGroups: boolean = (userDocData.groupIds || []).includes(groupId);

            if (existingMember.exists()) {
                if (inUserGroups) {
                    showAlert({ title: 'Already a Member', message: `You are already part of "${groupData.name}".` });
                } else {
                    // A member doc without the group in groupIds: finish that join.
                    await setDoc(userRef, {
                        groupIds: arrayUnion(groupId),
                        lastModified: serverTimestamp(),
                    }, { merge: true });
                    showAlert({ title: 'Welcome!', message: `You have joined "${groupData.name}".` });
                }
                router.replace('/(tabs)/groups' as any);
                return;
            }

            const resolvedName = displayName || user.displayName || user.email?.split('@')[0] || 'User';

            // All four writes land together or not at all.
            const batch = writeBatch(db);
            batch.set(memberRef, {
                userId: user.uid,
                displayName: displayName || user.email?.split('@')[0] || 'User',
                gender: userDocData.gender || 'm',
                photoURL: userDocData.photoURL || null,
                joinedAt: serverTimestamp(),
                lastActive: serverTimestamp(),
            });
            batch.set(doc(db, 'groups', groupId), { memberCount: increment(1) }, { merge: true });
            batch.set(userRef, {
                groupIds: arrayUnion(groupId),
                lastModified: serverTimestamp(),
            }, { merge: true });
            batch.set(doc(db, 'groups', groupId, 'activities', `joined_${user.uid}`), {
                userId: user.uid,
                userName: resolvedName,
                type: 'member_joined',
                timestamp: serverTimestamp(),
            });
            await batch.commit();

            showAlert({ title: 'Welcome!', message: `You have joined "${groupData.name}".` });
            router.replace('/(tabs)/groups' as any);
        } catch (error: any) {
            console.error(error);
            showAlert({ title: 'Error', message: 'Failed to join group: ' + error.message });
        } finally {
            joining.current = false;
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
