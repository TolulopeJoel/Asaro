import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { ScalePressable } from '@/src/components/ScalePressable';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';

export default function GroupsScreen() {
    const { user, loading, displayName } = useAuth();
    const { colors } = useTheme();
    const router = useRouter();
    const [userGroupIds, setUserGroupIds] = React.useState<string[]>([]);
    const [checkingGroup, setCheckingGroup] = React.useState(true);

    React.useEffect(() => {
        if (!user) {
            setCheckingGroup(false);
            return;
        }

        const unsubscribe = firestore()
            .collection('users')
            .doc(user.uid)
            .onSnapshot((doc) => {
                const data = doc.data();
                if (data && data.groupIds) {
                    setUserGroupIds(data.groupIds);
                } else {
                    setUserGroupIds([]);
                }
                setCheckingGroup(false);
            }, (error) => {
                console.error('Error fetching user groups:', error);
                setCheckingGroup(false);
            });

        return unsubscribe;
    }, [user]);

    const [activities, setActivities] = React.useState<any[]>([]);
    const [members, setMembers] = React.useState<any[]>([]);

    React.useEffect(() => {
        if (userGroupIds.length === 0) return;

        const groupId = 'official-accountability-group';

        // Listen for activities
        const unsubscribeActivities = firestore()
            .collection('groups')
            .doc(groupId)
            .collection('activities')
            .orderBy('timestamp', 'desc')
            .limit(30)
            .onSnapshot((querySnapshot) => {
                const feed = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setActivities(feed);
            });

        // Listen for members
        const unsubscribeMembers = firestore()
            .collection('groups')
            .doc(groupId)
            .collection('members')
            .onSnapshot((querySnapshot) => {
                const memberList = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMembers(memberList);
            });

        return () => {
            unsubscribeActivities();
            unsubscribeMembers();
        };
    }, [userGroupIds]);

    if (loading || checkingGroup) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.textSecondary }}>Checking status...</Text>
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
                        <ScalePressable
                            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                            onPress={() => router.push('/groups/auth' as any)}
                        >
                            <Text style={[styles.buttonText, { color: colors.background }]}>Sign in to Join</Text>
                        </ScalePressable>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // If user is in at least one group
    if (userGroupIds.length > 0) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.headerRow}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Accountability</Text>
                    <Ionicons name="sparkles" size={24} color={colors.accent} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Members Header */}
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>COMMUNITY ({members.length})</Text>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberList}>
                        {members.map((member) => (
                            <View key={member.id} style={styles.memberItem}>
                                <View style={[styles.memberAvatar, { backgroundColor: colors.accentSecondaryLight }]}>
                                    <Text style={[styles.memberInitial, { color: colors.accent }]}>
                                        {member.displayName?.charAt(0).toUpperCase()}
                                    </Text>
                                    <View style={[styles.onlineDot, { backgroundColor: '#4CAF50' }]} />
                                </View>
                                <Text style={[styles.memberName, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {member.displayName}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Activity Feed */}
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>LIVE FEED</Text>
                    </View>

                    {activities.length > 0 ? (
                        activities.map((activity) => (
                            <View key={activity.id} style={[styles.activityCard, { borderColor: colors.border }]}>
                                <View style={[styles.userBadge, { backgroundColor: colors.accentSecondaryLight }]}>
                                    <Text style={[styles.userInitial, { color: colors.accent }]}>
                                        {activity.userName?.charAt(0).toUpperCase() || '?'}
                                    </Text>
                                </View>
                                <View style={styles.activityContent}>
                                    <View style={styles.activityHeader}>
                                        <Text style={[styles.userName, { color: colors.textPrimary }]}>{activity.userName}</Text>
                                        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                                            {activity.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                    <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                                        just finished reading {activity.bookName} {activity.chapters}
                                    </Text>
                                </View>
                                <View style={styles.activityIcon}>
                                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyFeed}>
                            <Text style={[styles.emptyFeedText, { color: colors.textTertiary }]}>No activity yet today. Be the first!</Text>
                        </View>
                    )}
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
                        You haven't joined the official accountability group yet.
                    </Text>
                </View>

                <View style={[styles.emptyState, { borderColor: colors.border }]}>
                    <Ionicons name="add-circle-outline" size={32} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Enter the secret code to join friends growing in the Word.</Text>

                    <ScalePressable
                        style={[styles.secondaryButton, { borderColor: colors.accent }]}
                        onPress={() => router.push('/groups/join' as any)}
                    >
                        <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>Enter Group Code</Text>
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
    primaryButton: {
        paddingVertical: 18,
        borderRadius: Spacing.borderRadius.md,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.bold,
        letterSpacing: 1,
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
    secondaryButton: {
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: Spacing.borderRadius.md,
        marginTop: Spacing.sm,
    },
    secondaryButtonText: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.semibold,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    sectionHeader: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        letterSpacing: 1.5,
    },
    memberList: {
        marginBottom: Spacing.xl,
    },
    memberItem: {
        alignItems: 'center',
        marginRight: Spacing.lg,
        width: 60,
    },
    memberAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xs,
        position: 'relative',
    },
    memberInitial: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.bold,
    },
    memberName: {
        fontSize: Typography.size.xs,
        textAlign: 'center',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: 'white', // TODO: use theme background
    },
    activityCard: {
        flexDirection: 'row',
        padding: Spacing.md,
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1,
        marginBottom: Spacing.md,
        alignItems: 'center',
        gap: Spacing.md,
    },
    userBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInitial: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.bold,
    },
    activityContent: {
        flex: 1,
        gap: 2,
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    userName: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.semibold,
    },
    timestamp: {
        fontSize: Typography.size.xs,
    },
    activityText: {
        fontSize: Typography.size.xs,
        lineHeight: 16,
    },
    activityIcon: {
        marginLeft: Spacing.xs,
    },
    emptyFeed: {
        padding: Spacing.xxl * 2,
        alignItems: 'center',
    },
    emptyFeedText: {
        fontSize: Typography.size.sm,
        fontStyle: 'italic',
    },
});
