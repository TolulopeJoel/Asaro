import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
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
                Alert.alert('Invalid Code', 'No group found with this access code. Please check and try again.');
                setLoading(false);
                return;
            }

            const groupDoc = groupQuery.docs[0];
            const groupId = groupDoc.id;
            const groupData = groupDoc.data();

            // Add user to the members subcollection of the group
            await firestore()
                .collection('groups')
                .doc(groupId)
                .collection('members')
                .doc(user.uid)
                .set({
                    userId: user.uid,
                    displayName: displayName || user.email?.split('@')[0] || 'User',
                    joinedAt: firestore.FieldValue.serverTimestamp(),
                    lastActive: firestore.FieldValue.serverTimestamp(),
                });

            // Also keep track of groups the user is in at the user level
            await firestore()
                .collection('users')
                .doc(user.uid)
                .set({
                    groupIds: firestore.FieldValue.arrayUnion(groupId),
                    lastModified: firestore.FieldValue.serverTimestamp(),
                }, { merge: true });

            Alert.alert('Welcome!', `You have joined "${groupData.name}".`);
            router.replace('/(tabs)/groups' as any);
        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', 'Failed to join group: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <View style={styles.intro}>
                        <View style={[styles.iconContainer, { backgroundColor: colors.accentSecondaryLight }]}>
                            <Ionicons name="key-outline" size={32} color={colors.accent} />
                        </View>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Access Code</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            Enter the secret code to join the official accountability group.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <TextInput
                            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.border }]}
                            placeholder="ASAROXXXX"
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
        marginBottom: Spacing.xxl,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: Typography.size.xxl,
        fontWeight: Typography.weight.bold,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: Typography.size.md,
        textAlign: 'center',
        lineHeight: 22,
        opacity: 0.8,
    },
    form: {
        width: '100%',
        gap: Spacing.lg,
    },
    input: {
        fontSize: Typography.size.xl,
        textAlign: 'center',
        paddingVertical: Spacing.md,
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1,
        letterSpacing: 4,
        fontWeight: Typography.weight.bold,
        marginBottom: Spacing.md,
    },
});
