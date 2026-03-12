import React from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    LayoutAnimation, Platform, UIManager, Modal, Pressable, Dimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { checkInactiveMembers } from '@/src/utils/syncActivities';
import { getBadgeById, ALL_BADGES } from '@/src/utils/badges';
import Animated, {
    useSharedValue, useAnimatedStyle, withSpring, withTiming,
    runOnJS,
} from 'react-native-reanimated';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
    '#FF2D55', '#FF9500', '#FFCC00', '#34C759',
    '#00C7BE', '#007AFF', '#5856D6', '#AF52DE', '#FF375F',
];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getAvatarColor = (id: string | undefined | null, name?: string) => {
    const seed = (id || name || 'Guest').toString();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getTodayDateString = (): string => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const getISOWeekString = (date: Date): string => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

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
        if (diffInHours < 24 && now.getDate() === date.getDate()) return `${diffInHours}h ago`;
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear()) {
            return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return null; }
};

const formatLastRead = (dateStr: string | undefined, today: string): string => {
    if (!dateStr) return 'Never read';
    if (dateStr === today) return 'Read today ✓';
    try {
        const d = new Date(dateStr);
        const now = new Date(today);
        const diff = Math.round((now.getTime() - d.getTime()) / 86400000);
        if (diff === 1) return 'Read yesterday';
        if (diff < 7) return `${diff} days ago`;
        return `Last read ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    } catch { return dateStr; }
};

// ─── Member Profile Sheet ─────────────────────────────────────────────────────

const MemberProfileSheet = ({
    member,
    onClose,
    colors,
    today,
}: {
    member: any;
    onClose: () => void;
    colors: any;
    today: string;
}) => {
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const backdropOpacity = useSharedValue(0);
    const [visible, setVisible] = React.useState(true);

    React.useEffect(() => {
        translateY.value = withSpring(0, { damping: 22, stiffness: 200 });
        backdropOpacity.value = withTiming(1, { duration: 200 });
    }, []);

    const dismiss = () => {
        translateY.value = withSpring(SCREEN_HEIGHT, { damping: 25, stiffness: 200 });
        backdropOpacity.value = withTiming(0, { duration: 200 }, () => {
            runOnJS(setVisible)(false);
            runOnJS(onClose)();
        });
    };

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));
    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    if (!visible) return null;

    // Build heatmap for display
    const currentWeek = getISOWeekString(new Date());
    const isCurrentWeek = member.weeklyActivityWeek === currentWeek;
    const dots: boolean[] = (isCurrentWeek && Array.isArray(member.weeklyActivity) && member.weeklyActivity.length === 7)
        ? member.weeklyActivity
        : [false, false, false, false, false, false, false];

    // Build badge collection — only show badges from ALL_BADGES (skip unknown ones)
    const earnedBadgeIds: string[] = member.badges || [];
    const earnedBadges = ALL_BADGES
        .filter(b => earnedBadgeIds.includes(b.id))
        .sort((a, b) => a.order - b.order);
    const unearnedBadges = ALL_BADGES
        .filter(b => !earnedBadgeIds.includes(b.id))
        .sort((a, b) => a.order - b.order);

    const readToday = member.lastReadDate === today;
    const streak = member.streak || 0;
    const avatarColor = getAvatarColor(member.userId || member.id, member.displayName);

    return (
        <Modal transparent animationType="none" onRequestClose={dismiss}>
            {/* Backdrop */}
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }, backdropStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
            </Animated.View>

            {/* Sheet */}
            <Animated.View style={[sheetStyles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + Spacing.lg }, sheetStyle]}>
                {/* ── Drag handle ── */}
                <View style={sheetStyles.handle}>
                    <View style={[sheetStyles.handleBar, { backgroundColor: colors.border }]} />
                </View>

                {/* ── Avatar + name ── */}
                <View style={sheetStyles.header}>
                    <View style={[sheetStyles.avatar, { backgroundColor: avatarColor, borderWidth: readToday ? 3 : 0, borderColor: colors.indicatorActive }]}>
                        <Text style={sheetStyles.avatarInitial}>{member.displayName?.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={[sheetStyles.name, { color: colors.textPrimary }]}>{member.displayName}</Text>
                    <Text style={[sheetStyles.lastRead, {
                        color: readToday ? colors.indicatorActive : colors.textTertiary,
                    }]}>
                        {formatLastRead(member.lastReadDate, today)}
                    </Text>
                </View>

                {/* ── Stats row ── */}
                <View style={[sheetStyles.statsRow, { borderColor: colors.border }]}>
                    <View style={sheetStyles.stat}>
                        <Text style={[sheetStyles.statValue, { color: colors.textPrimary }]}>{streak}</Text>
                        <Text style={[sheetStyles.statLabel, { color: colors.textTertiary }]}>Day streak</Text>
                    </View>
                    <View style={[sheetStyles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={sheetStyles.stat}>
                        <Text style={[sheetStyles.statValue, { color: colors.textPrimary }]}>{earnedBadges.length}</Text>
                        <Text style={[sheetStyles.statLabel, { color: colors.textTertiary }]}>Badges</Text>
                    </View>
                    <View style={[sheetStyles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={sheetStyles.stat}>
                        <Text style={[sheetStyles.statValue, { color: colors.textPrimary }]}>
                            {dots.filter(Boolean).length}
                        </Text>
                        <Text style={[sheetStyles.statLabel, { color: colors.textTertiary }]}>Days this week</Text>
                    </View>
                </View>

                {/* ── Weekly heatmap with labels ── */}
                <View style={sheetStyles.section}>
                    <Text style={[sheetStyles.sectionTitle, { color: colors.textSecondary }]}>THIS WEEK</Text>
                    <View style={sheetStyles.heatmapRow}>
                        {dots.map((active, i) => (
                            <View key={i} style={sheetStyles.heatmapCell}>
                                <View style={[sheetStyles.heatmapDot, {
                                    backgroundColor: active ? colors.accent : colors.border,
                                }]} />
                                <Text style={[sheetStyles.heatmapLabel, { color: colors.textTertiary }]}>
                                    {DAY_LABELS[i]}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* ── Badge collection ── */}
                <View style={sheetStyles.section}>
                    <Text style={[sheetStyles.sectionTitle, { color: colors.textSecondary }]}>BADGES</Text>
                    {earnedBadges.length === 0 && unearnedBadges.length === 0 && (
                        <Text style={[sheetStyles.emptyBadges, { color: colors.textTertiary }]}>
                            Keep reading to earn badges!
                        </Text>
                    )}
                    <View style={sheetStyles.badgeGrid}>
                        {earnedBadges.map(badge => (
                            <View key={badge.id} style={[sheetStyles.badgeItem, { backgroundColor: colors.cardBackground, borderColor: colors.accent }]}>
                                <Text style={sheetStyles.badgeEmoji}>{badge.emoji}</Text>
                                <Text style={[sheetStyles.badgeLabel, { color: colors.textPrimary }]} numberOfLines={1}>{badge.label}</Text>
                            </View>
                        ))}
                        {unearnedBadges.map(badge => (
                            <View key={badge.id} style={[sheetStyles.badgeItem, { backgroundColor: colors.cardBackground, borderColor: colors.border, opacity: 0.4 }]}>
                                <Text style={[sheetStyles.badgeEmoji, { filter: undefined }]}>{'🔒'}</Text>
                                <Text style={[sheetStyles.badgeLabel, { color: colors.textTertiary }]} numberOfLines={1}>{badge.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </Animated.View>
        </Modal>
    );
};

const sheetStyles = StyleSheet.create({
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: Spacing.layout.screenPadding,
        maxHeight: SCREEN_HEIGHT * 0.85,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 24,
    },
    handle: {
        alignItems: 'center',
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    header: {
        alignItems: 'center',
        paddingVertical: Spacing.lg,
        gap: Spacing.xs,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    avatarInitial: {
        fontSize: 32,
        fontWeight: Typography.weight.bold,
        color: 'white',
    },
    name: {
        fontSize: Typography.size.xxl,
        fontWeight: Typography.weight.bold,
        letterSpacing: -0.3,
    },
    lastRead: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
    },
    statsRow: {
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: Spacing.borderRadius.lg,
        marginVertical: Spacing.lg,
        overflow: 'hidden',
    },
    stat: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.md,
        gap: 2,
    },
    statDivider: {
        width: 1,
    },
    statValue: {
        fontSize: Typography.size.xl,
        fontWeight: Typography.weight.bold,
        letterSpacing: -0.5,
    },
    statLabel: {
        fontSize: Typography.size.xs,
        letterSpacing: 0.2,
    },
    section: {
        marginBottom: Spacing.xl,
        gap: Spacing.md,
    },
    sectionTitle: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        letterSpacing: 2,
        opacity: 0.6,
    },
    heatmapRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    heatmapCell: {
        alignItems: 'center',
        gap: 5,
        flex: 1,
    },
    heatmapDot: {
        width: 28,
        height: 28,
        borderRadius: 8,
    },
    heatmapLabel: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.medium,
    },
    badgeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    badgeItem: {
        width: '30%',
        alignItems: 'center',
        padding: Spacing.sm,
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1,
        gap: Spacing.xs,
    },
    badgeEmoji: {
        fontSize: 24,
    },
    badgeLabel: {
        fontSize: 9,
        textAlign: 'center',
        fontWeight: Typography.weight.semibold,
        letterSpacing: 0.2,
    },
    emptyBadges: {
        fontSize: Typography.size.sm,
        fontStyle: 'italic',
    },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function GroupDetailScreen() {
    const { id: groupId } = useLocalSearchParams<{ id: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();

    const [activities, setActivities] = React.useState<any[]>([]);
    const [members, setMembers] = React.useState<any[]>([]);
    const [groupData, setGroupData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [isOffline, setIsOffline] = React.useState(false);
    const [selectedMember, setSelectedMember] = React.useState<any>(null);

    const resolvedRef = React.useRef({ group: false, activities: false, members: false });

    const checkAllResolved = () => {
        const { group, activities, members } = resolvedRef.current;
        if (group && activities && members) setLoading(false);
    };

    React.useEffect(() => {
        if (!groupId) return;

        const unsubscribeGroup = firestore()
            .collection('groups').doc(groupId)
            .onSnapshot(
                (doc) => {
                    setIsOffline(false);
                    setGroupData(doc.data() || null);
                    resolvedRef.current.group = true;
                    checkAllResolved();
                    if (doc.exists()) checkInactiveMembers(groupId);
                },
                (error) => {
                    console.error('[GroupDetail] group snapshot error:', error);
                    setIsOffline(true);
                    resolvedRef.current.group = true;
                    checkAllResolved();
                }
            );

        const unsubscribeActivities = firestore()
            .collection('groups').doc(groupId)
            .collection('activities')
            .orderBy('timestamp', 'desc').limit(30)
            .onSnapshot(
                (querySnapshot) => {
                    const feed = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

        const unsubscribeMembers = firestore()
            .collection('groups').doc(groupId)
            .collection('members')
            .onSnapshot(
                (querySnapshot) => {
                    const memberList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

    const sortedMembers = [...members].sort((a, b) => {
        const aToday = a.lastReadDate === today ? 1 : 0;
        const bToday = b.lastReadDate === today ? 1 : 0;
        if (bToday !== aToday) return bToday - aToday;
        return (b.streak || 0) - (a.streak || 0);
    });

    const readTodayCount = sortedMembers.filter(m => m.lastReadDate === today).length;
    const totalMembers = sortedMembers.length;

    const groupStreak: number = groupData?.groupStreak || 0;
    const groupStreakLastDate: string | undefined = groupData?.groupStreakLastDate;
    const isGroupStreakActive = groupStreak >= 2 && groupStreakLastDate && (() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        return groupStreakLastDate === today || groupStreakLastDate === yStr;
    })();

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

                {/* ── Members Section ── */}
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>LADIES & GENTLEMEN</Text>
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
                            const hasBadges = Array.isArray(member.badges) && member.badges.length > 0;
                            return (
                                <TouchableOpacity
                                    key={member.id}
                                    style={styles.memberItem}
                                    onPress={() => setSelectedMember(member)}
                                    activeOpacity={0.75}
                                >
                                    <View style={styles.avatarContainer}>
                                        <View style={[styles.memberAvatar, {
                                            backgroundColor: getAvatarColor(member.userId || member.id, member.displayName),
                                            borderWidth: readToday ? 2.5 : 0,
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
                                        {/* Top badge indicator */}
                                        {hasBadges && !readToday && (
                                            <View style={[styles.topBadgeIndicator, { borderColor: colors.background, backgroundColor: colors.cardBackground }]}>
                                                <Text style={{ fontSize: 8 }}>
                                                    {getBadgeById((member.badges as string[])[0])?.emoji ?? '✨'}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={[styles.memberName, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {member.displayName}
                                    </Text>
                                    {(member.streak || 0) > 0 && (
                                        <Text style={[styles.memberStreakText, { color: colors.textTertiary }]}>
                                            🔥 {member.streak}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                ) : (
                    <Text style={[styles.emptyFeedText, { color: colors.textTertiary, marginBottom: Spacing.xl }]}>
                        {isOffline ? 'Member list unavailable offline.' : 'No members yet.'}
                    </Text>
                )}

                {/* ── Activity Feed ── */}
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
                        const isMilestone = activity.type === 'milestone_earned';
                        const isGroupMilestone = activity.type === 'group_milestone';

                        // Group milestone — full-width celebration banner
                        if (isGroupMilestone) {
                            return (
                                <View
                                    key={activity.id}
                                    style={[styles.groupMilestoneCard, { borderColor: '#FFCC00', backgroundColor: '#FFCC0018' }]}
                                >
                                    <Text style={styles.groupMilestoneEmoji}>{activity.badgeEmoji}</Text>
                                    <View style={styles.groupMilestoneText}>
                                        <Text style={[styles.groupMilestoneLabel, { color: colors.textPrimary }]}>
                                            {activity.badgeLabel}
                                        </Text>
                                        <Text style={[styles.groupMilestoneDesc, { color: colors.textSecondary }]}>
                                            {activity.badgeDesc}
                                        </Text>
                                    </View>
                                    {timeStr && (
                                        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{timeStr}</Text>
                                    )}
                                </View>
                            );
                        }

                        return (
                            <View
                                key={activity.id}
                                style={[
                                    styles.activityCard,
                                    {
                                        borderColor: isMilestone ? colors.accent
                                            : isEntry ? colors.accentSecondaryLight
                                                : isJoined ? colors.indicatorActive
                                                    : colors.border,
                                        backgroundColor: isMilestone ? colors.accent + '14'
                                            : isEntry ? colors.accentSecondaryLight + '22'
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

                                    {isMilestone && (
                                        <View style={styles.milestoneRow}>
                                            <Text style={styles.milestoneEmoji}>{activity.badgeEmoji}</Text>
                                            <Text style={[styles.activityText, { color: colors.textSecondary, flex: 1 }]}>
                                                earned the <Text style={{ fontWeight: Typography.weight.bold, color: colors.textPrimary }}>{activity.badgeLabel}</Text> badge — {activity.badgeDesc}
                                            </Text>
                                        </View>
                                    )}
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
                                    {!isEntry && !isJoined && !isAbsent && !isRemoved && !isMilestone && (
                                        <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                                            just finished reading {activity.bookName} {activity.chapters}
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.activityIcon}>
                                    <Ionicons
                                        name={
                                            isMilestone ? 'star'
                                                : isEntry ? 'book-outline'
                                                    : isJoined ? 'person-add'
                                                        : isAbsent ? 'notifications-outline'
                                                            : isRemoved ? 'exit-outline'
                                                                : 'checkmark-circle'
                                        }
                                        size={20}
                                        color={
                                            isMilestone ? colors.accent
                                                : isEntry ? colors.accentSecondary
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

            {/* Member Profile Sheet */}
            {selectedMember && (
                <MemberProfileSheet
                    member={selectedMember}
                    onClose={() => setSelectedMember(null)}
                    colors={colors}
                    today={today}
                />
            )}
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    offlineBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.xs, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md,
    },
    offlineBannerText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.medium, letterSpacing: 0.3 },
    streakPill: {
        marginHorizontal: Spacing.layout.screenPadding, marginTop: Spacing.sm,
        paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md,
        borderRadius: Spacing.borderRadius.round, borderWidth: 1, alignSelf: 'flex-start',
    },
    streakPillText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, letterSpacing: 0.3 },
    scrollContent: { padding: Spacing.layout.screenPadding, paddingTop: Spacing.sm },
    sectionHeader: { marginTop: Spacing.lg, marginBottom: Spacing.md },
    sectionTitleRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.sm,
    },
    sectionTitle: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, letterSpacing: 2, opacity: 0.6 },
    readTodayChip: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Spacing.borderRadius.round, borderWidth: 1 },
    readTodayChipText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, letterSpacing: 0.2 },
    memberList: { marginBottom: Spacing.xl },
    memberItem: { alignItems: 'center', marginRight: Spacing.lg, width: 60, paddingBottom: Spacing.sm },
    avatarContainer: { position: 'relative', marginBottom: Spacing.xs },
    memberAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
    onlineBadge: {
        position: 'absolute', bottom: 0, right: 0,
        width: 16, height: 16, borderRadius: 8, borderWidth: 2,
        justifyContent: 'center', alignItems: 'center',
    },
    topBadgeIndicator: {
        position: 'absolute', top: -2, right: -2,
        width: 16, height: 16, borderRadius: 8, borderWidth: 1.5,
        justifyContent: 'center', alignItems: 'center',
    },
    memberInitial: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
    memberName: { fontSize: Typography.size.xs, textAlign: 'center', fontFamily: Typography.fontFamily.medium },
    memberStreakText: { fontSize: 10, marginTop: 2 },
    activityCard: {
        flexDirection: 'row', padding: Spacing.md,
        borderRadius: Spacing.borderRadius.md, borderWidth: 1,
        marginBottom: Spacing.md, alignItems: 'flex-start', gap: Spacing.md,
    },
    userBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    userInitial: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold },
    activityContent: { flex: 1, gap: 2 },
    activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    userName: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
    timestamp: { fontSize: Typography.size.xs },
    activityText: { fontSize: Typography.size.sm, lineHeight: 20, marginTop: 2 },
    reflectionPreview: { fontSize: Typography.size.xs, lineHeight: 18, fontStyle: 'italic', marginTop: 4 },
    activityIcon: { marginLeft: Spacing.xs, paddingTop: 2, flexShrink: 0 },
    milestoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, marginTop: 2, flexWrap: 'wrap' },
    milestoneEmoji: { fontSize: 18, lineHeight: 22 },
    groupMilestoneCard: {
        flexDirection: 'row', alignItems: 'center',
        padding: Spacing.md, borderRadius: Spacing.borderRadius.md,
        borderWidth: 1.5, marginBottom: Spacing.md, gap: Spacing.sm,
    },
    groupMilestoneEmoji: { fontSize: 28, flexShrink: 0 },
    groupMilestoneText: { flex: 1, gap: 2 },
    groupMilestoneLabel: { fontSize: Typography.size.sm, fontWeight: Typography.weight.bold },
    groupMilestoneDesc: { fontSize: Typography.size.xs, lineHeight: 16 },
    emptyFeed: { paddingVertical: Spacing.xxl * 2, alignItems: 'center', gap: Spacing.md },
    emptyFeedText: { fontSize: Typography.size.sm, fontStyle: 'italic', textAlign: 'center' },
});
