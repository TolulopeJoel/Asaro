import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, DeviceEventEmitter } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { ScalePressable } from '@/src/components/ScalePressable';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestore, { Filter } from '@react-native-firebase/firestore';
import { Button } from '@/src/components/Button';
import { Skeleton } from '@/src/components/Skeleton';
import { Avatar } from './[id]';

export default function GroupsScreen() {
    const { user, loading, displayName } = useAuth();
    const { colors } = useTheme();
    const router = useRouter();
    const [joinedGroups, setJoinedGroups] = useState<any[]>([]);
    const [checkingGroups, setCheckingGroups] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    // Scroll to top on tab press
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('tab-press-top-groups', () => {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        });
        return () => subscription.remove();
    }, []);

    useEffect(() => {
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
                            // Batch fetch groups using 'in' query (max 30 per query)
                            const chunks: string[][] = [];
                            for (let i = 0; i < groupIds.length; i += 30) {
                                chunks.push(groupIds.slice(i, i + 30));
                            }
                            const snapshots = await Promise.all(
                                chunks.map(chunk =>
                                    firestore()
                                        .collection('groups')
                                        .where(firestore.FieldPath.documentId(), 'in', chunk)
                                        .get({ source: 'default' })
                                )
                            );
                            const groupsData = snapshots.flatMap(snap =>
                                snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
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

    if (!user) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScrollView
                    ref={scrollViewRef}
                    contentContainerStyle={styles.authScroll}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.authContainer}>
                        <View style={[styles.welcomeCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                            <View style={[styles.welcomeIconIconWrap, { backgroundColor: colors.accentSecondaryLight + '20' }]}>
                                <Ionicons name="people-outline" size={34} color={colors.accentSecondary} />
                            </View>

                            <Text style={[styles.authHeroTitle, { color: colors.textPrimary }]}>Better Together</Text>
                            <Text style={[styles.authHeroSubtitle, { color: colors.textSecondary }]}>
                                "If you want to go fast, go alone. If you want to go far, go together"
                            </Text>

                            <Button
                                label="Sign in to Join Them"
                                variant="primary"
                                size="lg"
                                onPress={() => router.push('/(tabs)/groups/auth' as any)}
                                fullWidth
                                style={{ marginTop: Spacing.lg }}
                            />
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    const isLoading = loading || checkingGroups;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {(isOffline || isLoading) && (
                <View style={[styles.offlineBanner, { backgroundColor: colors.border }]}>
                    <Ionicons name={isOffline ? "cloud-offline-outline" : "sync-outline"} size={14} color={colors.textSecondary} />
                    <Text style={[styles.offlineBannerText, { color: colors.textSecondary }]}>
                        {isOffline ? "You're offline — showing cached groups" : "Syncing your groups..."}
                    </Text>
                </View>
            )}
            <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <View style={styles.headerTitleRow}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>My Groups</Text>
                        <ScalePressable onPress={() => router.push('/(tabs)/groups/join' as any)}>
                            <Ionicons name="add" size={28} color={colors.textSecondary} />
                        </ScalePressable>
                    </View>
                </View>

                {isLoading ? (
                    // ── Skeleton Loader ──
                    [1, 2, 3].map((i) => (
                        <View key={i} style={[styles.groupCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, opacity: 0.6 }]}>
                            <View style={styles.groupCardTop}>
                                <Skeleton circle height={48} width={48} />
                                <View style={styles.groupInfo}>
                                    <Skeleton width="60%" height={20} borderRadius={4} />
                                    <View style={{ height: 4 }} />
                                    <Skeleton width="90%" height={14} borderRadius={4} />
                                </View>
                            </View>
                            <View style={[styles.groupCardDivider, { backgroundColor: colors.borderSubtle + '30' }]} />
                            <View style={styles.groupCardBottom}>
                                <Skeleton width={60} height={16} borderRadius={4} />
                                <Skeleton width={40} height={20} borderRadius={8} />
                            </View>
                        </View>
                    ))
                ) : joinedGroups.length > 0 ? (
                    // ── Group Cards ──
                    joinedGroups.map((group) => {
                        const today = new Date();
                        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                        const readTodayCount = group.readTodayDate === todayStr ? (group.readTodayCount || 0) : 0;
                        const groupStreak = group.groupStreak || 0;

                        return (
                            <ScalePressable
                                key={group.id}
                                style={[styles.groupCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                                onPress={() => router.push(`/(tabs)/groups/${group.id}` as any)}
                            >
                                <View style={styles.groupCardTop}>
                                    <Avatar id={group.id} name={group.name} url={group.photoURL} size={48} radius={14} />
                                    <View style={styles.groupInfo}>
                                        <Text style={[styles.groupName, { color: colors.textPrimary }]}>{group.name}</Text>
                                        <Text style={[styles.groupDesc, { color: colors.textSecondary }]}>
                                            {group.description || 'Consistency is key. Read together!'}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                                </View>

                                <View style={[styles.groupCardDivider, { backgroundColor: colors.borderSubtle + '30' }]} />

                                <View style={styles.groupCardBottom}>
                                    <View style={styles.groupStatsRow}>
                                        <View style={styles.groupStatItem}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                <Ionicons name="bonfire" size={14} color={colors.accent} />
                                                <Text style={[styles.groupStatValue, { color: colors.accent }]}>{groupStreak}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.groupStatDivider, { backgroundColor: colors.borderSubtle }]} />
                                    </View>

                                    {readTodayCount > 0 ? (
                                        <View style={[styles.activeIndicator, { backgroundColor: colors.indicatorActive + '15' }]}>
                                            <View style={[styles.activeDot, { backgroundColor: colors.indicatorActive }]} />
                                            <Text style={[styles.activeText, { color: colors.indicatorActive }]}>
                                                {readTodayCount}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={[styles.activeIndicator, { backgroundColor: colors.backgroundSubtle, opacity: 0.5 }]}>
                                            <View style={[styles.activeDot, { backgroundColor: colors.textTertiary }]} />
                                        </View>
                                    )}
                                </View>
                            </ScalePressable>
                        );
                    })
                ) : (
                    // ── Empty State ──
                    <>
                        <View style={styles.welcomeHeader}>
                            <Text style={[styles.label, { color: colors.accentSecondary }]}>HELLO, {displayName?.toUpperCase() || 'READER'}</Text>
                            <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'left', paddingHorizontal: 0 }]}>
                                Flying solo, I see?
                            </Text>
                        </View>

                        <View style={[styles.welcomeCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                            <View style={[styles.welcomeIconIconWrap, { backgroundColor: colors.accentSecondaryLight + '20' }]}>
                                <Ionicons name="add-outline" size={34} color={colors.accentSecondary} />
                            </View>
                            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                                Accountability is a team sport. Join a group or create one so we can make sure you're actually reading.
                            </Text>

                            <Button
                                label="Enter Group Code"
                                variant="primary"
                                size="lg"
                                onPress={() => router.push('/(tabs)/groups/join' as any)}
                                style={{ marginTop: Spacing.lg, width: '100%' }}
                            />
                        </View>
                    </>
                )}
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
    welcomeCard: {
        padding: Spacing.xxl,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    authHeroTitle: {
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -1.5,
        textAlign: 'center',
    },
    authHeroSubtitle: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 24,
        opacity: 0.7,
        paddingHorizontal: Spacing.md,
    },
    welcomeIconIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    emptyStateTitle: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    emptyStateText: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        opacity: 0.6,
        paddingHorizontal: Spacing.sm,
    },
    groupCard: {
        padding: Spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: Spacing.lg,
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
        fontSize: 14,
        fontWeight: '700',
    },
    groupStatDivider: {
        width: 1,
        height: 20,
        opacity: 1,
    },
    activeIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 6,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    activeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    header: {
        marginBottom: Spacing.xl,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -1.5,
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
        padding: Spacing.layout.screenPadding,
        paddingBottom: 120, // Support for tab bar spacing
    },
});
