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
    const [isOffline, setIsOffline] = React.useState(false);

    React.useEffect(() => {
        if (!user) {
            setCheckingGroups(false);
            return;
        }

        // Listen for user's group IDs
        const unsubscribeUser = firestore()
            .collection('users')
            .doc(user.uid)
            .onSnapshot(
                { includeMetadataChanges: false },
                async (doc) => {
                    setIsOffline(false);
                    const userData = doc.data();
                    const groupIds: string[] = userData?.groupIds || [];

                    if (groupIds.length > 0) {
                        try {
                            // Fetch basic info for each group — Firestore cache serves these offline
                            const groupsData = await Promise.all(
                                groupIds.map(async (id: string) => {
                                    const groupDoc = await firestore()
                                        .collection('groups')
                                        .doc(id)
                                        .get({ source: 'default' }); // uses cache when offline
                                    return { id: groupDoc.id, ...groupDoc.data() };
                                })
                            );
                            setJoinedGroups(groupsData);
                        } catch (error) {
                            console.error('Error fetching group metadata:', error);
                            // Don't clear existing groups — keep showing whatever we have
                            setIsOffline(true);
                        }
                    } else {
                        setJoinedGroups([]);
                    }
                    setCheckingGroups(false);
                },
                (error) => {
                    console.error('Error fetching user groups:', error);
                    setIsOffline(true);
                    setCheckingGroups(false);
                }
            );

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
                <ScrollView contentContainerStyle={styles.authScroll}>
                    <View style={styles.authContainer}>
                        <View style={[styles.authHero, { backgroundColor: colors.accentSecondaryLight + '20', borderColor: colors.accentSecondaryLight + '40' }]}>
                            <View style={[styles.authIconCircle, { backgroundColor: colors.accentSecondaryLight }]}>
                                <Ionicons name="people" size={42} color={colors.accentSecondary} />
                            </View>
                            <Text style={[styles.authHeroTitle, { color: colors.textPrimary }]}>Better Together</Text>
                            <Text style={[styles.authHeroSubtitle, { color: colors.textSecondary }]}>
                                Join a community of readers and stay accountable on your journey through the Word.
                            </Text>
                        </View>

                        <View style={styles.authActionCard}>
                            <Text style={[styles.authActionTitle, { color: colors.textPrimary }]}>Ready to join?</Text>
                            <Text style={[styles.authActionDesc, { color: colors.textSecondary }]}>
                                Sign in to browse existing groups or join your friends with a code.
                            </Text>
                            <Button
                                label="Sign in to Get Started"
                                variant="primary"
                                onPress={() => router.push('/(tabs)/groups/auth' as any)}
                                fullWidth
                                style={{ marginTop: Spacing.md }}
                            />
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // If user has joined groups
    if (joinedGroups.length > 0) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {isOffline && (
                    <View style={[styles.offlineBanner, { backgroundColor: colors.border }]}>
                        <Ionicons name="cloud-offline-outline" size={14} color={colors.textSecondary} />
                        <Text style={[styles.offlineBannerText, { color: colors.textSecondary }]}>
                            You're offline — showing cached groups
                        </Text>
                    </View>
                )}
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>My Groups</Text>
                        <TouchableOpacity onPress={() => router.push('/(tabs)/groups/join' as any)}>
                            <Ionicons name="add-circle-outline" size={28} color={colors.accent} />
                        </TouchableOpacity>
                    </View>
                    {joinedGroups.map((group) => {
                        const today = new Date();
                        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                        const readTodayCount = group.readTodayDate === todayStr ? (group.readTodayCount || 0) : 0;
                        const groupStreak = group.groupStreak || 0;
                        const memberCount = group.memberCount || 0;

                        return (
                            <ScalePressable
                                key={group.id}
                                style={[styles.groupCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                                onPress={() => router.push(`/(tabs)/groups/${group.id}` as any)}
                            >
                                <View style={styles.groupCardTop}>
                                    <View style={[styles.groupIcon, { backgroundColor: colors.accentSecondaryLight + '40' }]}>
                                        <Ionicons name="people" size={24} color={colors.accentSecondary} />
                                    </View>
                                    <View style={styles.groupInfo}>
                                        <Text style={[styles.groupName, { color: colors.textPrimary }]}>{group.name}</Text>
                                        <Text style={[styles.groupDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                                            {group.description || 'Consistency is key. Read together!'}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                                </View>

                                <View style={[styles.groupCardDivider, { backgroundColor: colors.borderSubtle + '30' }]} />

                                <View style={styles.groupCardBottom}>
                                    <View style={styles.groupStatsRow}>
                                        <View style={styles.groupStatItem}>
                                            <Text style={[styles.groupStatValue, { color: colors.accent }]}>🔥 {groupStreak}</Text>
                                            <Text style={[styles.groupStatLabel, { color: colors.textTertiary }]}>STREAK</Text>
                                        </View>
                                        <View style={[styles.groupStatDivider, { backgroundColor: colors.borderSubtle }]} />
                                        <View style={styles.groupStatItem}>
                                            <Text style={[styles.groupStatValue, { color: colors.textPrimary }]}>{memberCount}</Text>
                                            <Text style={[styles.groupStatLabel, { color: colors.textTertiary }]}>PEOPLE</Text>
                                        </View>
                                    </View>

                                    <View style={[styles.activePill, {
                                        backgroundColor: readTodayCount > 0 ? colors.indicatorActive + '15' : colors.cardBackground,
                                        borderColor: readTodayCount > 0 ? colors.indicatorActive + '40' : colors.borderSubtle
                                    }]}>
                                        <View style={[styles.activeDot, { backgroundColor: readTodayCount > 0 ? colors.indicatorActive : colors.textTertiary }]} />
                                        <Text style={[styles.activeTodayText, { color: readTodayCount > 0 ? colors.indicatorActive : colors.textTertiary }]}>
                                            {readTodayCount > 0 ? `${readTodayCount} ACTIVE TODAY` : 'NO ACTIVITY YET'}
                                        </Text>
                                    </View>
                                </View>
                            </ScalePressable>
                        );
                    })}
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {isOffline && (
                <View style={[styles.offlineBanner, { backgroundColor: colors.border }]}>
                    <Ionicons name="cloud-offline-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.offlineBannerText, { color: colors.textSecondary }]}>
                        You're offline
                    </Text>
                </View>
            )}
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

                <View style={[styles.emptyStateCard, { backgroundColor: colors.cardBackground, borderColor: colors.borderSubtle }]}>
                    <View style={[styles.emptyStateIconWrap, { backgroundColor: colors.accentSecondaryLight + '30' }]}>
                        <Ionicons name="add" size={32} color={colors.accentSecondary} />
                    </View>
                    <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>No groups yet</Text>
                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                        Accountability is the "secret sauce" to consistency. Grab a code from a friend or join a group to start.
                    </Text>

                    <Button
                        label="Enter Group Code"
                        variant="primary"
                        onPress={() => router.push('/(tabs)/groups/join' as any)}
                        style={{ marginTop: Spacing.md, width: '100%' }}
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
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.md,
    },
    offlineBannerText: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.medium,
        letterSpacing: 0.3,
    },
    authScroll: {
        flexGrow: 1,
    },
    authContainer: {
        flex: 1,
        padding: Spacing.layout.screenPadding,
        gap: Spacing.lg,
        justifyContent: 'center',
    },
    authHero: {
        padding: Spacing.xxl,
        borderRadius: 32,
        alignItems: 'center',
        borderWidth: 1,
        gap: Spacing.md,
    },
    authIconCircle: {
        width: 84,
        height: 84,
        borderRadius: 42,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    authHeroTitle: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -1,
        textAlign: 'center',
    },
    authHeroSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        opacity: 0.8,
    },
    authActionCard: {
        padding: Spacing.xl,
        gap: Spacing.xs,
    },
    authActionTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    authActionDesc: {
        fontSize: 14,
        lineHeight: 20,
        opacity: 0.7,
    },
    emptyStateCard: {
        padding: Spacing.xxl,
        borderRadius: 32,
        alignItems: 'center',
        borderWidth: 1,
        gap: Spacing.sm,
        marginTop: Spacing.lg,
    },
    emptyStateIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    emptyStateTitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    emptyStateText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        opacity: 0.7,
        paddingHorizontal: Spacing.sm,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
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
        padding: Spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: Spacing.lg,
        elevation: 0.5,
    },
    groupCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    groupIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    groupInfo: {
        flex: 1,
        gap: 2,
    },
    groupName: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.bold,
        letterSpacing: -0.5,
    },
    groupDesc: {
        fontSize: Typography.size.sm,
        opacity: 0.6,
        lineHeight: 18,
    },
    groupCardDivider: {
        height: 1,
        marginVertical: Spacing.lg,
    },
    groupCardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    groupStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    groupStatItem: {
        alignItems: 'flex-start',
        gap: 1,
    },
    groupStatValue: {
        fontSize: 15,
        fontWeight: '800',
    },
    groupStatLabel: {
        fontSize: 8,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    groupStatDivider: {
        width: 1,
        height: 20,
        opacity: 1,
    },
    activePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    activeTodayText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    label: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.5,
        marginBottom: Spacing.xs,
    },
    subtitle: {
        fontSize: 16,
        lineHeight: 24,
    },
    welcomeHeader: {
        marginBottom: Spacing.xxl,
        marginTop: Spacing.lg,
    },
    scrollContent: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingBottom: Spacing.xl,
    },
});
