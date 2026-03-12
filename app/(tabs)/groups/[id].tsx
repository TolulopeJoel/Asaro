import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { checkInactiveMembers } from '@/src/utils/syncActivities';

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
];

const getAvatarColor = (id: string | undefined | null, name?: string) => {
    const seed = (id || name || 'Guest').toString();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
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
        if (
            date.getDate() === yesterday.getDate() &&
            date.getMonth() === yesterday.getMonth() &&
            date.getFullYear() === yesterday.getFullYear()
        ) {
            return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
        }

        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
        return null;
    }
};

/** 7 tiny dots representing Mon–Sun activity for the current week */
const WeeklyHeatmap = ({
    weeklyActivity,
    weeklyActivityWeek,
    accentColor,
    inactiveColor,
}: {
    weeklyActivity?: boolean[];
    weeklyActivityWeek?: string;
    accentColor: string;
    inactiveColor: string;
}) => {
    // Check if the stored week matches the current ISO week
    const now = new Date();
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    const currentWeekStr = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

    const isCurrentWeek = weeklyActivityWeek === currentWeekStr;
    const dots: boolean[] = (isCurrentWeek && Array.isArray(weeklyActivity) && weeklyActivity.length === 7)
        ? weeklyActivity
        : [false, false, false, false, false, false, false];

    return (
        <View style={heatmapStyles.row}>
            {dots.map((active, i) => (
                <View
                    key={i}
                    style={[
                        heatmapStyles.dot,
                        { backgroundColor: active ? accentColor : inactiveColor },
                    ]}
                />
            ))}
        </View>
    );
};

const heatmapStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: 3,
        marginTop: 4,
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
});

export default function GroupDetailScreen() {
    const { id: groupId } = useLocalSearchParams<{ id: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();

    const [activities, setActivities] = React.useState<any[]>([]);
    const [members, setMembers] = React.useState<any[]>([]);
    const [groupData, setGroupData] = React.useState<any>(null);
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
                    setGroupData(doc.data() || null);
                    checkAllResolved();

                    // Trigger inactivity check once after loading
                    if (doc.exists()) {
                        checkInactiveMembers(groupId);
                    }
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
                    if (activities.length > 0) {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    }
                    setActivities(feed);
                    resolvedRef.current.activities = true;
                    checkAllResolved();
                },
                (error) => {
                    console.error('[GroupDetail] activities snapshot error:', error);
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

    const today = getTodayDateString();

    // Sort members: read today first, then by streak desc
    const sortedMembers = [...members].sort((a, b) => {
        const aToday = a.lastReadDate === today ? 1 : 0;
        const bToday = b.lastReadDate === today ? 1 : 0;
        if (bToday !== aToday) return bToday - aToday;
        return (b.streak || 0) - (a.streak || 0);
    });

    const readTodayCount = sortedMembers.filter(m => m.lastReadDate === today).length;
    const totalMembers = sortedMembers.length;

    // Group streak from group doc
    const groupStreak: number = groupData?.groupStreak || 0;
    const groupStreakLastDate: string | undefined = groupData?.groupStreakLastDate;
    // Only show if the streak includes today or yesterday (still active/recent)
    const isGroupStreakActive = groupStreak >= 2 && groupStreakLastDate &&
        (groupStreakLastDate === today || (() => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
            return groupStreakLastDate === yStr;
        })());

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

            {/* Group streak pill */}
            {isGroupStreakActive && (
                <View style={[styles.streakPill, { backgroundColor: colors.accentSecondaryLight, borderColor: colors.border }]}>
                    <Text style={[styles.streakPillText, { color: colors.textPrimary }]}>
                        🔥 Group on fire — {groupStreak} days in a row
                    </Text>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Members Section */}
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MEMBERS</Text>
                        {totalMembers > 0 && (
                            <View style={[styles.readTodayChip, {
                                backgroundColor: readTodayCount > 0 ? colors.indicatorActive + '22' : colors.border,
                                borderColor: readTodayCount > 0 ? colors.indicatorActive : colors.border,
                            }]}>
                                <Text style={[styles.readTodayChipText, {
                                    color: readTodayCount > 0 ? colors.indicatorActive : colors.textTertiary,
                                }]}>
                                    {readTodayCount > 0 ? `✓ ${readTodayCount} of ${totalMembers} read today` : `0 of ${totalMembers} read today`}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {sortedMembers.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberList}>
                        {sortedMembers.map((member) => {
                            const readToday = member.lastReadDate === today;
                            const streak = member.streak || 0;
                            return (
                                <View key={member.id} style={styles.memberItem}>
                                    <View style={styles.avatarContainer}>
                                        <View style={[styles.memberAvatar, {
                                            backgroundColor: getAvatarColor(member.userId || member.id, member.displayName),
                                            borderWidth: readToday ? 2 : 0,
                                            borderColor: colors.indicatorActive,
                                        }]}>
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
                                    <WeeklyHeatmap
                                        weeklyActivity={member.weeklyActivity}
                                        weeklyActivityWeek={member.weeklyActivityWeek}
                                        accentColor={colors.accent}
                                        inactiveColor={colors.border}
                                    />
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
                <View style={[styles.sectionHeader, { marginTop: Spacing.md }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>LIVE FEED</Text>
                </View>

                {activities.length > 0 ? (
                    activities.map((activity) => {
                        const timeStr = formatRelativeTime(activity.timestamp);
                        const isEntry = activity.type === 'journal_entry' || activity.type === 'reflection_shared';
                        const isAbsent = activity.type === 'member_absent';
                        const isJoined = activity.type === 'member_joined';
                        const isRemoved = activity.type === 'member_removed';

                        return (
                            <View
                                key={activity.id}
                                style={[
                                    styles.activityCard,
                                    {
                                        borderColor: isEntry ? colors.accentSecondaryLight : (isJoined ? colors.indicatorActive : colors.border),
                                        backgroundColor: isEntry ? colors.accentSecondaryLight + '22'
                                            : isJoined ? colors.indicatorActive + '11'
                                                : isAbsent ? colors.accentLight + '11'
                                                    : 'transparent',
                                    }
                                ]}
                            >
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

                                    {isEntry && (
                                        <>
                                            <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                                                shared an entry on {activity.bookName} {activity.chapters}
                                            </Text>
                                            {activity.preview ? (
                                                <Text style={[styles.reflectionPreview, { color: colors.textTertiary }]}>
                                                    "{activity.preview}"
                                                </Text>
                                            ) : null}
                                        </>
                                    )}

                                    {isJoined && (
                                        <Text style={[styles.activityText, { color: colors.textSecondary, fontWeight: '500' }]}>
                                            Welcome to the group! Let's grow together. 🎉
                                        </Text>
                                    )}

                                    {isAbsent && (
                                        <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                                            {activity.threshold === 30
                                                ? `has been away for a month. We miss your insights! 🫂`
                                                : `hasn't been seen in a week. Drop a message to encourage them! 🕊️`}
                                        </Text>
                                    )}

                                    {isRemoved && (
                                        <Text style={[styles.activityText, { color: colors.textTertiary, fontStyle: 'italic' }]}>
                                            has left the group.
                                        </Text>
                                    )}

                                    {!isEntry && !isJoined && !isAbsent && !isRemoved && (
                                        <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                                            just finished reading {activity.bookName} {activity.chapters}
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.activityIcon}>
                                    <Ionicons
                                        name={
                                            isEntry ? 'book-outline'
                                                : isJoined ? 'person-add'
                                                    : isAbsent ? 'notifications-outline'
                                                        : isRemoved ? 'exit-outline'
                                                            : 'checkmark-circle'
                                        }
                                        size={20}
                                        color={
                                            isEntry ? colors.accentSecondary
                                                : isJoined ? colors.indicatorActive
                                                    : isAbsent ? colors.accent
                                                        : colors.textTertiary
                                        }
                                    />
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
    streakPill: {
        marginHorizontal: Spacing.layout.screenPadding,
        marginTop: Spacing.sm,
        marginBottom: 0,
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.md,
        borderRadius: Spacing.borderRadius.round,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    streakPillText: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.semibold,
        letterSpacing: 0.3,
    },
    scrollContent: {
        padding: Spacing.layout.screenPadding,
        paddingTop: Spacing.sm,
    },
    sectionHeader: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.md,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    sectionTitle: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        letterSpacing: 2,
        opacity: 0.6,
    },
    readTodayChip: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: Spacing.borderRadius.round,
        borderWidth: 1,
    },
    readTodayChipText: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.semibold,
        letterSpacing: 0.2,
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
        marginTop: 4,
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
        alignItems: 'flex-start',
        gap: Spacing.md,
    },
    userBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
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
    reflectionPreview: {
        fontSize: Typography.size.xs,
        lineHeight: 18,
        fontStyle: 'italic',
        marginTop: 4,
    },
    activityIcon: {
        marginLeft: Spacing.xs,
        paddingTop: 2,
        flexShrink: 0,
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
