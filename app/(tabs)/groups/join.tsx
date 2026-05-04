import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';

// In a real app, this might be a dynamic code or fetched from a config

export default function JoinGroupScreen() {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const { user, displayName } = useAuth();
    const { colors } = useTheme();
    const { showAlert } = useAlert();
    const router = useRouter();

    const handleJoin = async () => {
        const inputCode = code.trim().toUpperCase();
        if (!inputCode) return;

        if (!user) return;

        setLoading(true);
        try {
            // Query for group with this code
            const groupQuery = await firestore()
                .collection('groups')
                .where('code', '==', inputCode)
                .limit(1)
                .get();

            if (groupQuery.empty) {
                showAlert({ title: 'Invalid Code', message: 'No group found with this access code. Please check and try again.' });
                setLoading(false);
                return;
            }

            const groupDoc = groupQuery.docs[0];
            const groupId = groupDoc.id;
            const groupData = groupDoc.data();

            // Add user to the members subcollection of the group
            const memberRef = firestore()
                .collection('groups')
                .doc(groupId)
                .collection('members')
                .doc(user.uid);

            const existingMember = await memberRef.get();
            if (existingMember.exists()) {
                showAlert({ title: 'Already a Member', message: `You are already part of "${groupData.name}".` });
                router.replace('/(tabs)/groups' as any);
                return;
            }

            const userDocData = (await firestore().collection('users').doc(user.uid).get()).data() || {};
            const userGender = userDocData.gender;

            await memberRef.set({
                userId: user.uid,
                displayName: displayName || user.email?.split('@')[0] || 'User',
                gender: userGender || 'm',
                photoURL: userDocData.photoURL || null,
                joinedAt: firestore.FieldValue.serverTimestamp(),
                lastActive: firestore.FieldValue.serverTimestamp(),
            });

            // Keep memberCount accurate on the group doc
            await firestore()
                .collection('groups')
                .doc(groupId)
                .set({ memberCount: firestore.FieldValue.increment(1) }, { merge: true });

            // Also keep track of groups the user is in at the user level
            await firestore()
                .collection('users')
                .doc(user.uid)
                .set({
                    groupIds: firestore.FieldValue.arrayUnion(groupId),
                    lastModified: firestore.FieldValue.serverTimestamp(),
                }, { merge: true });

            // 5. Success - Trigger joined activity
            const resolvedName = displayName || user.displayName || user.email?.split('@')[0] || 'User';

            await firestore()
                .collection('groups')
                .doc(groupId)
                .collection('activities')
                .add({
                    userId: user.uid,
                    userName: resolvedName,
                    type: 'member_joined',
                    timestamp: firestore.FieldValue.serverTimestamp(),
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <View style={styles.intro}>
                        <View style={[styles.iconContainer, { backgroundColor: colors.accentSecondaryLight + '30' }]}>
                            <Ionicons name="key-outline" size={32} color={colors.accentSecondary} />
                        </View>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Access Code</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
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
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -1.5,
        marginBottom: Spacing.xs,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 24,
        opacity: 0.6,
        paddingHorizontal: Spacing.md,
    },
    form: {
        width: '100%',
        gap: Spacing.lg,
    },
    input: {
        fontSize: 32,
        textAlign: 'center',
        height: 72,
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        letterSpacing: 6,
        fontWeight: '800',
        marginBottom: Spacing.lg,
    },
});
