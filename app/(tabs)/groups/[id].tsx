import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';

const AVATAR_COLORS = [
    '#FF2D55', // vivid red
    '#FF9500', // vivid orange
    '#FFCC00', // vivid yellow
    '#34C759', // vivid green
    '#00C7BE', // vivid teal
    '#007AFF', // vivid blue
    '#5856D6', // vivid indigo
    '#AF52DE', // vivid purple
    '#FF375F', // vivid pink
    '#A2845E', // vivid brown
];

const getAvatarColor = (id: string | undefined | null, name?: string) => {
    const seed = (id || name || 'Guest').toString();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

/** Format a Date object to YYYY-MM-DD string */
const getTodayDateString = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/** Format a timestamp into relative time ("2h ago") or short string ("Yesterday", "Mar 12") */
const formatRelativeTime = (ts: any): string | null => {
    if (!ts) return null;
    try {
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';

        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24 && now.getDate() === date.getDate()) {
            return `${diffInHours}h ago`;
        }

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear()) {
            return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
        }

        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
        return null;
    }
};


export default function GroupDetailScreen() {
    const { id: groupId } = useLocalSearchParams<{ id: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();

    const [activities, setActivities] = React.useState<any[]>([]);
    const [members, setMembers] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isOffline, setIsOffline] = React.useState(false);

    // Track which sub-listeners have resolved so we only clear loading once all have
    const resolvedRef = React.useRef({ group: false, activities: false, members: false });

    const checkAllResolved = () => {
        const { group, activities, members } = resolvedRef.current;
        if (group && activities && members) {
            setLoading(false);
        }
    };


    React.useEffect(() => {
        if (!groupId) return;

        // Fetch group info
        const unsubscribeGroup = firestore()
            .collection('groups')
            .doc(groupId)
            .onSnapshot(
                (doc) => {
                    setIsOffline(false);
                    resolvedRef.current.group = true;
                    checkAllResolved();
                },
                (error) => {
                    console.error('[GroupDetail] group snapshot error:', error);
                    setIsOffline(true);
                    resolvedRef.current.group = true;
                    checkAllResolved();
                }
            );

        // Listen for activities
        const unsubscribeActivities = firestore()
            .collection('groups')
            .doc(groupId)
            .collection('activities')
            .orderBy('timestamp', 'desc')
            .limit(30)
            .onSnapshot(
                (querySnapshot) => {
                    const feed = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setActivities(feed);
                    resolvedRef.current.activities = true;
                    checkAllResolved();
                },
                (error) => {
                    console.error('[GroupDetail] activities snapshot error:', error);
                    // Keep whatever activities we already have cached
                    resolvedRef.current.activities = true;
                    checkAllResolved();
                }
            );

        // Listen for members
        const unsubscribeMembers = firestore()
            .collection('groups')
            .doc(groupId)
            .collection('members')
            .onSnapshot(
                (querySnapshot) => {
                    const memberList = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setMembers(memberList);
                    resolvedRef.current.members = true;
                    checkAllResolved();
                },
                (error) => {
                    console.error('[GroupDetail] members snapshot error:', error);
                    // Keep whatever members we already have cached
                    resolvedRef.current.members = true;
                    checkAllResolved();
                }
            );

        return () => {
            unsubscribeGroup();
            unsubscribeActivities();
            unsubscribeMembers();
        };
    }, [groupId]);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.textSecondary }}>Loading...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {isOffline && (
                <View style={[styles.offlineBanner, { backgroundColor: colors.border }]}>
                    <Ionicons name="cloud-offline-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.offlineBannerText, { color: colors.textSecondary }]}>
                        You're offline — showing cached data
                    </Text>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Members Section */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GENTLEMEN</Text>
                </View>

                {members.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberList}>
                        {members.map((member) => {
                            const readToday = member.lastReadDate === getTodayDateString();
                            const streak = member.streak || 0;
                            return (
                                <View key={member.id} style={styles.memberItem}>
                                    <View style={styles.avatarContainer}>
                                        <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(member.userId || member.id, member.displayName) }]}>
                                            <Text style={[styles.memberInitial, { color: 'white' }]}>
                                                {member.displayName?.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        {readToday && (
                                            <View style={[styles.onlineBadge, { borderColor: colors.background, backgroundColor: colors.indicatorActive }]}>
                                                <Ionicons name="checkmark" size={10} color="white" />
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.nameRow}>
                                        <Text style={[styles.memberName, { color: colors.textSecondary }]} numberOfLines={1}>
                                            {member.displayName}
                                        </Text>
                                    </View>
                                    {streak > 0 && (
                                        <View style={[styles.streakBadge, { backgroundColor: colors.accentSecondaryLight }]}>
                                            <Text style={[styles.streakText, { color: colors.textPrimary }]}>🔥 {streak}</Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </ScrollView>
                ) : (
                    <Text style={[styles.emptyFeedText, { color: colors.textTertiary, marginBottom: Spacing.xl }]}>
                        {isOffline ? 'Member list unavailable offline.' : 'No members yet.'}
                    </Text>
                )}

                {/* Activity Feed */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>LIVE FEED</Text>
                </View>

                {activities.length > 0 ? (
                    activities.map((activity) => {
                        const timeStr = formatRelativeTime(activity.timestamp);

                        return (
                            <View key={activity.id} style={[styles.activityCard, { borderColor: colors.border }]}>
                                <View style={[styles.userBadge, { backgroundColor: getAvatarColor(activity.userId, activity.userName) }]}>
                                    <Text style={[styles.userInitial, { color: 'white' }]}>
                                        {activity.userName?.charAt(0).toUpperCase() || '?'}
                                    </Text>
                                </View>
                                <View style={styles.activityContent}>
                                    <View style={styles.activityHeader}>
                                        <Text style={[styles.userName, { color: colors.textPrimary }]}>{activity.userName}</Text>
                                        {timeStr ? (
                                            <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{timeStr}</Text>
                                        ) : (
                                            <Text style={[styles.timestamp, { color: colors.textTertiary }]}>Syncing…</Text>
                                        )}
                                    </View>
                                    <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                                        just finished reading {activity.bookName} {activity.chapters}
                                    </Text>
                                </View>
                                <View style={styles.activityIcon}>
                                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <View style={styles.emptyFeed}>
                        <Ionicons
                            name={isOffline ? 'cloud-offline-outline' : 'sunny-outline'}
                            size={28}
                            color={colors.textTertiary}
                        />
                        <Text style={[styles.emptyFeedText, { color: colors.textTertiary }]}>
                            {isOffline
                                ? 'Feed unavailable offline. Check back when connected.'
                                : 'No activity yet. Be the first!'}
                        </Text>
                    </View>
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
    scrollContent: {
        padding: Spacing.layout.screenPadding,
        paddingTop: Spacing.xs,
    },
    sectionHeader: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        letterSpacing: 2,
        opacity: 0.6,
    },
    memberList: {
        marginBottom: Spacing.xl,
    },
    memberItem: {
        alignItems: 'center',
        marginRight: Spacing.lg,
        width: 64,
        paddingBottom: Spacing.sm,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: Spacing.xs,
    },
    memberAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    memberInitial: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.bold,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 2,
    },
    memberName: {
        fontSize: Typography.size.xs,
        textAlign: 'center',
        fontFamily: Typography.fontFamily.medium,
    },
    streakBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        marginTop: 2,
    },
    streakText: {
        fontSize: 10,
        fontWeight: Typography.weight.bold,
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
        fontSize: Typography.size.sm,
        lineHeight: 20,
        marginTop: 2,
    },
    activityIcon: {
        marginLeft: Spacing.xs,
    },
    emptyFeed: {
        paddingVertical: Spacing.xxl * 2,
        alignItems: 'center',
        gap: Spacing.md,
    },
    emptyFeedText: {
        fontSize: Typography.size.sm,
        fontStyle: 'italic',
        textAlign: 'center',
    },
});
