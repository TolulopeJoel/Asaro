import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { ScalePressable } from '@/src/components/ScalePressable';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { Button } from '@/src/components/Button';

export default function GroupsScreen() {
    const { user, loading, displayName } = useAuth();
    const { colors } = useTheme();
    const router = useRouter();
    const [joinedGroups, setJoinedGroups] = React.useState<any[]>([]);
    const [checkingGroups, setCheckingGroups] = React.useState(true);

    React.useEffect(() => {
        if (!user) {
            setCheckingGroups(false);
            return;
        }

        // Listen for user's group IDs
        const unsubscribeUser = firestore()
            .collection('users')
            .doc(user.uid)
            .onSnapshot(async (doc) => {
                const userData = doc.data();
                const groupIds = userData?.groupIds || [];

                if (groupIds.length > 0) {
                    try {
                        // Fetch basic info for each group
                        const groupsData = await Promise.all(
                            groupIds.map(async (id: string) => {
                                const groupDoc = await firestore().collection('groups').doc(id).get();
                                return { id: groupDoc.id, ...groupDoc.data() };
                            })
                        );
                        setJoinedGroups(groupsData);
                    } catch (error) {
                        console.error('Error fetching group metadata:', error);
                    }
                } else {
                    setJoinedGroups([]);
                }
                setCheckingGroups(false);
            }, (error) => {
                console.error('Error fetching user groups:', error);
                setCheckingGroups(false);
            });

        return unsubscribeUser;
    }, [user]);

    if (loading || checkingGroups) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.textSecondary }}>Checking groups...</Text>
            </View>
        );
    }

    if (!user) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.authContainer}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.accentSecondaryLight }]}>
                        <Ionicons name="people" size={48} color={colors.accent} />
                    </View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Accountability Groups</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Read the Bible with friends and stay consistent together.
                    </Text>

                    <View style={styles.actionContainer}>
                        <Button
                            label="Sign in to Join"
                            variant="primary"
                            onPress={() => router.push('/(tabs)/groups/auth' as any)}
                            fullWidth
                        />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // If user has joined groups
    if (joinedGroups.length > 0) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>My Groups</Text>
                        <TouchableOpacity onPress={() => router.push('/(tabs)/groups/join' as any)}>
                            <Ionicons name="add-circle-outline" size={28} color={colors.accent} />
                        </TouchableOpacity>
                    </View>
                    {joinedGroups.map((group) => (
                        <ScalePressable
                            key={group.id}
                            style={[styles.groupCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                            onPress={() => router.push(`/(tabs)/groups/${group.id}` as any)}
                        >
                            <View style={[styles.groupIcon, { backgroundColor: colors.accentSecondaryLight }]}>
                                <Ionicons name="people" size={24} color={colors.accent} />
                            </View>
                            <View style={styles.groupInfo}>
                                <Text style={[styles.groupName, { color: colors.textPrimary }]}>{group.name}</Text>
                                <Text style={[styles.groupDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {group.description || 'No description available.'}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                        </ScalePressable>
                    ))}
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.headerRow}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Your Groups</Text>
                <Ionicons name="people-outline" size={24} color={colors.textSecondary} />
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.welcomeHeader}>
                    <Text style={[styles.label, { color: colors.accent }]}>HELLO, {displayName?.toUpperCase() || 'READER'}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'left', paddingHorizontal: 0 }]}>
                        You haven't joined any accountability groups yet.
                    </Text>
                </View>

                <View style={[styles.emptyState, { borderColor: colors.border }]}>
                    <Ionicons name="add-circle-outline" size={32} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Enter the secret code to join friends growing in the Word.</Text>

                    <Button
                        label="Enter Group Code"
                        variant="outline"
                        onPress={() => router.push('/(tabs)/groups/join' as any)}
                        style={{ marginTop: Spacing.sm }}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    authContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
        gap: Spacing.md,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    scrollContent: {
        padding: Spacing.layout.screenPadding,
    },
    welcomeHeader: {
        marginBottom: Spacing.xxl,
    },
    label: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        letterSpacing: 2,
        marginBottom: Spacing.xs,
    },
    title: {
        fontSize: Typography.size.xxxl,
        fontWeight: Typography.weight.semibold,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: Typography.size.md,
        textAlign: 'center',
        opacity: 0.8,
        lineHeight: 22,
        paddingHorizontal: Spacing.xl,
    },
    actionContainer: {
        width: '100%',
        marginTop: Spacing.xl,
    },
    emptyState: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderRadius: Spacing.borderRadius.lg,
        padding: Spacing.xxl,
        alignItems: 'center',
        gap: Spacing.md,
        marginTop: Spacing.xl,
    },
    emptyText: {
        fontSize: Typography.size.md,
        textAlign: 'center',
        lineHeight: 22,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.lg,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    groupCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        marginBottom: Spacing.md,
        gap: Spacing.md,
    },
    groupIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    groupInfo: {
        flex: 1,
        gap: 2,
    },
    groupName: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.bold,
    },
    groupDesc: {
        fontSize: Typography.size.sm,
        opacity: 0.7,
    },
});
