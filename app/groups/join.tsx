import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, TouchableOpacity } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { ScalePressable } from '@/src/components/ScalePressable';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// In a real app, this might be a dynamic code or fetched from a config
const OFFICIAL_GROUP_CODE = 'ASARO2026';

export default function JoinGroupScreen() {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const { user, displayName } = useAuth();
    const { colors } = useTheme();
    const router = useRouter();

    const handleJoin = async () => {
        if (code.trim().toUpperCase() !== OFFICIAL_GROUP_CODE) {
            Alert.alert('Invalid Code', 'The group code you entered is incorrect. Please check and try again.');
            return;
        }

        if (!user) return;

        setLoading(true);
        try {
            // Add user to the members subcollection of the group
            // For simplicity, we use a fixed group ID for the single accountability group
            const groupId = 'official-accountability-group';

            await firestore().collection('groups').doc(groupId).set({
                name: 'The Official Accountability Group',
                code: OFFICIAL_GROUP_CODE,
                description: 'Growing together in the scriptures.',
            }, { merge: true });

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

            Alert.alert('Welcome!', 'You have successfully joined the group.');
            router.replace('/groups' as any);
        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', 'Failed to join group: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.intro}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.accentSecondaryLight }]}>
                        <Ionicons name="key" size={32} color={colors.accent} />
                    </View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Enter Group Code</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Enter the code shared with you to join the official accountability group.
                    </Text>
                </View>

                <View style={styles.form}>
                    <TextInput
                        style={[styles.input, { color: colors.textPrimary, borderBottomColor: colors.border }]}
                        placeholder="ASAROXXXX"
                        placeholderTextColor={colors.textMuted}
                        value={code}
                        onChangeText={setCode}
                        autoCapitalize="characters"
                        autoCorrect={false}
                    />

                    <ScalePressable
                        style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: loading ? 0.7 : 1 }]}
                        onPress={handleJoin}
                        disabled={loading || !code.trim()}
                    >
                        <Text style={[styles.buttonText, { color: colors.background }]}>
                            {loading ? 'Joining Group...' : 'Join Group'}
                        </Text>
                    </ScalePressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: Spacing.md,
    },
    backButton: {
        padding: Spacing.sm,
    },
    content: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xl,
        alignItems: 'center',
    },
    intro: {
        alignItems: 'center',
        marginBottom: Spacing.xxxl,
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
    },
    form: {
        width: '100%',
        gap: Spacing.lg,
    },
    input: {
        fontSize: Typography.size.xxxl,
        textAlign: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        letterSpacing: 4,
        fontWeight: Typography.weight.bold,
    },
    primaryButton: {
        paddingVertical: 18,
        borderRadius: Spacing.borderRadius.md,
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    buttonText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.bold,
    },
});
