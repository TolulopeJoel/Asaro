import React, { useMemo } from 'react';
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
import { ALL_BADGES } from '@/src/utils/badges';
import Animated, {
    useSharedValue, useAnimatedStyle, withSpring, withTiming,
    runOnJS,
} from 'react-native-reanimated';
import { ScalePressable } from '@/src/components/ScalePressable';

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
        if (diff < 14) return `${diff} days ago`;
        return `Last read ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    } catch { return dateStr; }
};

// ─── Feed processing helpers ──────────────────────────────────────────────────

/** Extract a YYYY-MM-DD string from a Firestore activity's timestamp */
const getActivityDateStr = (activity: any): string | null => {
    if (!activity.timestamp) return null;
    try {
        const d = activity.timestamp.toDate ? activity.timestamp.toDate() : new Date(activity.timestamp);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch { return null; }
};

/** Returns a human-friendly date label for a section separator */
const formatDateLabel = (dateStr: string | null, today: string): string => {
    if (!dateStr) return '';
    if (dateStr === today) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (dateStr === yStr) return 'Yesterday';
    try {
        return new Date(dateStr + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
};

interface Separator { type: 'separator'; id: string; label: string; }
interface ReadingDigest {
    type: 'reading_digest';
    id: string;
    dateStr: string;
    names: string[];
    extraCount: number;
    timestamp: any;
    entries: any[]; // individual journal_entry activities (one per unique user)
}
type FeedItem = any | Separator | ReadingDigest;

/**
 * Processes the raw activity list (desc order) into a decorated list:
 * - group_milestones are extracted; only the most recent is returned as pinnedMilestone
 * - consecutive journal_entry items on the same day from 3+ unique users → reading_digest
 * - date separators are inserted between date groups
 */
const buildProcessedFeed = (
    rawActivities: any[],
    today: string,
): { pinnedMilestone: any | null; feedItems: FeedItem[] } => {
    // 1. Separate group milestones (pin most recent one)
    const groupMilestones = rawActivities.filter(a => a.type === 'group_milestone');
    const normalActivities = rawActivities.filter(a => a.type !== 'group_milestone');
    const pinnedMilestone = groupMilestones.length > 0 ? groupMilestones[0] : null;

    // 2. Build date-keyed map of journal_entry items to find digest candidates
    const journalByDate: Record<string, any[]> = {};
    for (const a of normalActivities) {
        if (a.type !== 'journal_entry') continue;
        const d = getActivityDateStr(a);
        if (!d) continue;
        if (!journalByDate[d]) journalByDate[d] = [];
        journalByDate[d].push(a);
    }
    // Dates with 3+ unique users → collapse into digest
    const digestDates = new Set<string>();
    const digestMap: Record<string, ReadingDigest> = {};
    for (const [dateStr, entries] of Object.entries(journalByDate)) {
        const unique = [...new Map(entries.map((e: any) => [e.userId, e])).values()];
        if (unique.length >= 3) {
            digestDates.add(dateStr);
            const names = unique.slice(0, 2).map((e: any) => e.userName || '?');
            const extraCount = unique.length - 2;
            digestMap[dateStr] = {
                type: 'reading_digest',
                id: `digest-${dateStr}`,
                dateStr,
                names,
                extraCount: Math.max(0, extraCount),
                timestamp: entries[0].timestamp,
                entries: unique, // keep full entries for expanded view
            };
        }
    }

    // 3. Walk through normalActivities (desc), insert separators + digest substitution
    const feedItems: FeedItem[] = [];
    let lastDateLabel: string | null = null;
    const digestInserted = new Set<string>();

    for (const activity of normalActivities) {
        const dateStr = getActivityDateStr(activity);
        const dateLabel = formatDateLabel(dateStr, today);

        // Insert separator when date changes
        if (dateLabel !== lastDateLabel) {
            feedItems.push({ type: 'separator', id: `sep-${dateStr}`, label: dateLabel });
            lastDateLabel = dateLabel;
        }

        // Collapse digest candidate
        if (activity.type === 'journal_entry' && dateStr && digestDates.has(dateStr)) {
            if (!digestInserted.has(dateStr)) {
                feedItems.push(digestMap[dateStr]);
                digestInserted.add(dateStr);
            }
            // Skip individual entry
            continue;
        }

        feedItems.push(activity);
    }

    return { pinnedMilestone, feedItems };
};

// ─── Member Profile Sheet ─────────────────────────────────────────────────────

const MemberProfileSheet = ({
    groupId,
    member,
    onClose,
    colors,
    today,
}: {
    groupId: string;
    member: any;
    onClose: () => void;
    colors: any;
    today: string;
}) => {
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const backdropOpacity = useSharedValue(0);
    const [visible, setVisible] = React.useState(true);
    const [pastReads, setPastReads] = React.useState<any[]>([]);
    const [loadingReads, setLoadingReads] = React.useState(true);

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

    React.useEffect(() => {
        if (!member || !groupId) {
            setLoadingReads(false);
            return;
        }

        const memberId = member.userId || member.id;
        const unsubscribe = firestore()
            .collection('groups')
            .doc(groupId)
            .collection('activities')
            .where('userId', '==', memberId)
            .where('type', '==', 'journal_entry')
            .orderBy('timestamp', 'desc')
            .limit(30)
            .onSnapshot(
                (snapshot) => {
                    const reads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setPastReads(reads);
                    setLoadingReads(false);
                },
                (error) => {
                    console.error('[MemberProfileSheet] Error fetching past reads:', error);
                    setLoadingReads(false);
                }
            );

        return () => unsubscribe();
    }, [groupId, member]);

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
            <Animated.View style={[sheetStyles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom }, sheetStyle]}>
                {/* ── Drag handle ── */}
                <View style={sheetStyles.handle}>
                    <View style={[sheetStyles.handleBar, { backgroundColor: colors.border }]} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
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

                    {/* ── Past Reads ── */}
                    <View style={sheetStyles.section}>
                        <Text style={[sheetStyles.sectionTitle, { color: colors.textSecondary }]}>RECENT READS</Text>
                        {loadingReads ? (
                            <Text style={[sheetStyles.emptyBadges, { color: colors.textTertiary }]}>Loading...</Text>
                        ) : pastReads.length > 0 ? (
                            <View style={{ gap: Spacing.md }}>
                                {pastReads.map((read) => (
                                    <View key={read.id} style={sheetStyles.readCard}>
                                        <View style={sheetStyles.readCardHeader}>
                                            <Text style={[sheetStyles.readCardTitle, { color: colors.textPrimary }]}>
                                                {read.bookName} {read.chapters}
                                            </Text>
                                            <Text style={[sheetStyles.readCardTime, { color: colors.textTertiary }]}>
                                                {formatRelativeTime(read.timestamp)}
                                            </Text>
                                        </View>
                                        {read.preview ? (
                                            <Text style={[sheetStyles.readCardPreview, { color: colors.textSecondary, borderLeftColor: colors.accentSecondaryLight }]} numberOfLines={2}>
                                                "{read.preview}"
                                            </Text>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={[sheetStyles.emptyBadges, { color: colors.textTertiary }]}>No recent reads found.</Text>
                        )}
                    </View>
                </ScrollView>
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
    readCard: {
        gap: 4,
    },
    readCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    readCardTitle: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.semibold,
    },
    readCardTime: {
        fontSize: Typography.size.xs,
    },
    readCardPreview: {
        fontSize: Typography.size.sm,
        lineHeight: 20,
        fontStyle: 'italic',
        paddingLeft: Spacing.sm,
        borderLeftWidth: 2,
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
    const [expandedDigests, setExpandedDigests] = React.useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = React.useState<'feed' | 'accountability' | 'members'>('feed');

    // Tab Animation
    const tabOffset = useSharedValue(0);

    React.useEffect(() => {
        const target = activeTab === 'feed' ? 0 : activeTab === 'accountability' ? 1 : 2;
        tabOffset.value = withSpring(target, { damping: 20, stiffness: 150 });
    }, [activeTab]);

    const animatedIndicatorStyle = useAnimatedStyle(() => ({
        left: `${(tabOffset.value * 33.33)}%`,
    }));

    const styles = React.useMemo(() => getStyles(colors), [colors]);

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

    const memberSectionTitle = useMemo(() => {
        const hasLadies = members.some(m => m.gender === 'f');
        const hasGentlemen = members.some(m => m.gender === 'm' || !m.gender); // Fallback to m if no gender
        if (hasLadies && hasGentlemen) return 'LADIES & GENTLEMEN';
        if (hasLadies) return 'LADIES';
        if (hasGentlemen) return 'GENTLEMEN';
        return 'MEMBERS';
    }, [members]);

    const accountabilityData = useMemo(() => {
        const today = getTodayDateString();
        const currentWeek = getISOWeekString(new Date());
        const currentMonth = today.substring(0, 7);
        const dayOfMonth = new Date(today).getDate();

        const processed = members.map(m => {
            const isCurrentWeek = m.weeklyActivityWeek === currentWeek;
            const dots = (isCurrentWeek && Array.isArray(m.weeklyActivity) && m.weeklyActivity.length === 7)
                ? m.weeklyActivity
                : [false, false, false, false, false, false, false];
            const daysThisWeek = dots.filter(Boolean).length;
            const readToday = m.lastReadDate === today;

            const isCurrentMonth = m.monthlyActivityMonth === currentMonth;
            const monthlyStreak = isCurrentMonth ? (m.monthlyStreak || 0) : 0;
            const monthlyCount = isCurrentMonth ? (m.monthlyActivityCount || 0) : 0;

            const isOnFire = monthlyStreak >= 9;
            const isIronMan = monthlyStreak >= 21;

            return {
                ...m,
                daysThisWeek,
                dots,
                readToday,
                streak: monthlyStreak,
                monthlyCount,
                isOnFire,
                isIronMan,
                isMe: m.userId === user?.uid || m.id === user?.uid
            };
        });

        const totalMembers = processed.length;
        const readTodayCount = processed.filter(m => m.readToday).length;
        const groupProgressPercent = totalMembers > 0 ? Math.round((readTodayCount / totalMembers) * 100) : 0;

        // Group members by status
        const upToDate = processed.filter(m => m.readToday).sort((a, b) => b.streak - a.streak);
        const needsSupport = processed.filter(m => !m.readToday).sort((a, b) => b.daysThisWeek - a.daysThisWeek);

        // Sort all by consistency for Members tab (least active to most active)
        const membersByConsistency = [...processed].sort((a, b) => a.monthlyCount - b.monthlyCount);

        return {
            upToDate,
            needsSupport,
            membersByConsistency,
            groupProgressPercent,
            readTodayCount,
            totalMembers
        };
    }, [members, user?.uid]);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.textSecondary }}>Loading...</Text>
            </View>
        );
    }

    const today = getTodayDateString();

    const sortedMembers = members
        .filter(m => m.lastReadDate === today)
        .sort((a, b) => (b.streak || 0) - (a.streak || 0));

    const groupStreak: number = groupData?.groupStreak || 0;

    const getPronoun = (userId: string, type: 'subject' | 'object' | 'possessive' = 'object') => {
        const member = members.find(m => m.userId === userId || m.id === userId);
        const gender = member?.gender;

        // Ladies first 😉
        if (gender === 'f') {
            if (type === 'subject') return 'she';
            if (type === 'possessive') return 'her';
            return 'her';
        }

        if (type === 'subject') return 'he';
        if (type === 'possessive') return 'his';
        return 'him';
    };

    const formatBadgeDesc = (desc: string, userId: string) => {
        if (!desc) return desc;
        return desc
            .replace(/{subject}/g, getPronoun(userId, 'subject'))
            .replace(/{object}/g, getPronoun(userId, 'object'))
            .replace(/{possessive}/g, getPronoun(userId, 'possessive'));
    };

    const { pinnedMilestone, feedItems } = buildProcessedFeed(activities, today);

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

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >

                {/* ── Members Section ── */}
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{memberSectionTitle} THAT READ TODAY.</Text>
                    </View>
                </View>

                {sortedMembers.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberList}>
                        {sortedMembers.map((member) => {
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
                                            borderColor: colors.indicatorActive,
                                        }]}>
                                            <Text style={[styles.memberInitial, { color: 'white' }]}>
                                                {member.displayName?.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.memberName, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {member.displayName}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                ) : (
                    <Text style={[styles.emptyFeedText, { color: colors.textTertiary, marginBottom: Spacing.xl }]}>
                        {isOffline
                            ? 'Member list unavailable offline.'
                            : members.length > 0
                                ? 'No one has read today yet. Be the first!'
                                : 'No members yet.'}
                    </Text>
                )}

                {/* ── Tabs Section ── */}
                <View style={styles.tabContainer}>
                    <View style={styles.tabBackground}>
                        <Animated.View
                            style={[
                                styles.tabIndicator,
                                {
                                    backgroundColor: colors.accent,
                                    width: '33.33%',
                                },
                                animatedIndicatorStyle
                            ]}
                        />
                        <ScalePressable
                            style={styles.tab}
                            onPress={() => setActiveTab('feed')}
                        >
                            <Text style={[
                                styles.tabText,
                                { color: colors.textSecondary },
                                activeTab === 'feed' && { color: colors.textPrimary, fontWeight: '600' }
                            ]}>Updates</Text>
                        </ScalePressable>

                        <ScalePressable
                            style={styles.tab}
                            onPress={() => setActiveTab('accountability')}
                        >
                            <Text style={[
                                styles.tabText,
                                { color: colors.textSecondary },
                                activeTab === 'accountability' && { color: colors.textPrimary, fontWeight: '600' }
                            ]}>Progress</Text>
                        </ScalePressable>

                        <ScalePressable
                            style={styles.tab}
                            onPress={() => setActiveTab('members')}
                        >
                            <Text style={[
                                styles.tabText,
                                { color: colors.textSecondary },
                                activeTab === 'members' && { color: colors.textPrimary, fontWeight: '600' }
                            ]}>Circle</Text>
                        </ScalePressable>
                    </View>
                </View>

                {activeTab === 'feed' && (
                    <>
                        {/* ── Activity Feed ── */}
                        <View style={[styles.sectionHeader, { marginTop: Spacing.md }]}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>WHAT'S BEEN HAPPENING</Text>
                        </View>

                        {/* Pinned group milestone hero card */}
                        {pinnedMilestone && (
                            <View style={[styles.milestoneHero, { borderColor: colors.accent, backgroundColor: colors.accent + '10' }]}>
                                <View style={styles.milestoneHeroTop}>
                                    <Text style={styles.milestoneHeroBadge}>{pinnedMilestone.badgeEmoji}</Text>
                                    <View style={styles.milestoneHeroConfetti}>
                                        <Text style={[styles.milestoneHeroLabel, { color: colors.accent }]}>
                                            {pinnedMilestone.badgeLabel.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.milestoneHeroDesc, { color: colors.textSecondary }]}>
                                    {formatBadgeDesc(pinnedMilestone.badgeDesc, pinnedMilestone.userId)}
                                </Text>
                                {formatRelativeTime(pinnedMilestone.timestamp) && (
                                    <Text style={[styles.milestoneHeroTime, { color: colors.textTertiary }]}>
                                        {formatRelativeTime(pinnedMilestone.timestamp)}
                                    </Text>
                                )}
                            </View>
                        )}

                        <View style={styles.feedChainContainer}>
                            <View style={[styles.feedChainLine, { backgroundColor: colors.border }]} />
                            {feedItems.length > 0 ? (
                                feedItems.map((item: FeedItem) => {
                                    // ── Date separator ──
                                    if (item.type === 'separator') {
                                        const sep = item as Separator;
                                        return (
                                            <View key={sep.id} style={styles.dateSeparator}>
                                                <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
                                                <Text style={[styles.dateSeparatorLabel, { color: colors.textTertiary, backgroundColor: colors.background }]}>
                                                    {sep.label}
                                                </Text>
                                                <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
                                            </View>
                                        );
                                    }

                                    // ── Reading digest ──
                                    if (item.type === 'reading_digest') {
                                        const digest = item as ReadingDigest;
                                        const isExpanded = expandedDigests.has(digest.id);
                                        const totalCount = digest.entries.length;
                                        const nameStr = digest.extraCount > 0
                                            ? `${digest.names.join(', ')} +${digest.extraCount} more`
                                            : digest.names.join(' & ');

                                        const toggleDigest = () => {
                                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                            setExpandedDigests(prev => {
                                                const next = new Set(prev);
                                                if (next.has(digest.id)) next.delete(digest.id);
                                                else next.add(digest.id);
                                                return next;
                                            });
                                        };

                                        return (
                                            <View key={digest.id} style={styles.digestCard}>
                                                {/* Header row — always visible */}
                                                <TouchableOpacity
                                                    style={styles.digestHeader}
                                                    onPress={toggleDigest}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={[styles.digestIconWrap, { backgroundColor: colors.accentSecondaryLight + '40' }]}>
                                                        <Ionicons name="journal-outline" size={20} color={colors.accent} />
                                                    </View>
                                                    <View style={styles.digestContent}>
                                                        <Text style={[styles.digestLine, { color: colors.textPrimary }]}>
                                                            {nameStr}
                                                        </Text>
                                                        <Text style={[styles.digestSub, { color: colors.textSecondary }]}>
                                                            {totalCount} people read · {formatRelativeTime(digest.timestamp)}
                                                        </Text>
                                                    </View>
                                                    <Ionicons
                                                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                                        size={18}
                                                        color={colors.textTertiary}
                                                    />
                                                </TouchableOpacity>

                                                {/* Expanded entries */}
                                                {isExpanded && (
                                                    <View style={[styles.digestEntries, { borderTopColor: colors.border }]}>
                                                        {digest.entries.map((entry: any, i: number) => (
                                                            <View
                                                                key={entry.id || `${digest.id}-${i}`}
                                                                style={[styles.digestEntry, {
                                                                    borderBottomColor: colors.border,
                                                                    borderBottomWidth: i < digest.entries.length - 1 ? 1 : 0,
                                                                }]}
                                                            >
                                                                <View style={[styles.digestEntryAvatar, { backgroundColor: getAvatarColor(entry.userId, entry.userName) }]}>
                                                                    <Text style={styles.digestEntryInitial}>
                                                                        {entry.userName?.charAt(0).toUpperCase() || '?'}
                                                                    </Text>
                                                                </View>
                                                                <View style={styles.digestEntryText}>
                                                                    <Text style={[styles.digestEntryName, { color: colors.textPrimary }]}>
                                                                        {entry.userName}
                                                                    </Text>
                                                                    <Text style={[styles.digestEntrySub, { color: colors.textTertiary }]}>
                                                                        {entry.bookName} {entry.chapters}
                                                                    </Text>
                                                                </View>
                                                                <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                                                                    {formatRelativeTime(entry.timestamp)}
                                                                </Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    }

                                    // ── Regular activity card ──
                                    const activity = item;
                                    const timeStr = formatRelativeTime(activity.timestamp);
                                    const isJournalEntry = activity.type === 'journal_entry';
                                    const isSharedReflection = activity.type === 'reflection_shared';
                                    const isAbsent = activity.type === 'member_absent';
                                    const isJoined = activity.type === 'member_joined';
                                    const isRemoved = activity.type === 'member_removed';
                                    const isMilestone = activity.type === 'milestone_earned';
                                    return (
                                        <View key={activity.id} style={styles.activityCard}>

                                            <View style={[styles.userBadge, { backgroundColor: getAvatarColor(activity.userId, activity.userName) }]}>
                                                <Text style={[styles.userInitial, { color: 'white' }]}>
                                                    {activity.userName?.charAt(0).toUpperCase() || '?'}
                                                </Text>
                                            </View>
                                            <View style={styles.activityContent}>
                                                <View style={styles.activityHeader}>
                                                    <Text style={[styles.userName, { color: colors.textPrimary }]}>
                                                        {isAbsent
                                                            ? `Where is ${activity.userName}? 🥹`
                                                            : isJoined
                                                                ? `Hi, ${activity.userName} 🤭`
                                                                : activity.userName}
                                                    </Text>
                                                    {timeStr ? (
                                                        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{timeStr}</Text>
                                                    ) : (
                                                        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>Syncing…</Text>
                                                    )}
                                                </View>

                                                {isMilestone && (
                                                    <View style={styles.milestoneRow}>
                                                        <Text style={[styles.activityText, { color: colors.textSecondary, flex: 1 }]}>
                                                            {formatBadgeDesc(activity.badgeDesc, activity.userId)}
                                                        </Text>
                                                    </View>
                                                )}
                                                {isJournalEntry && (
                                                    <>
                                                        <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                                                            read {activity.bookName} {activity.chapters}
                                                        </Text>
                                                        {activity.preview ? (
                                                            <Text style={[styles.reflectionPreview, { color: colors.textTertiary, borderLeftColor: colors.accentSecondaryLight }]}>
                                                                "{activity.preview}"
                                                            </Text>
                                                        ) : null}
                                                    </>
                                                )}
                                                {isSharedReflection && (
                                                    <>
                                                        <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                                                            shared a reflection from {activity.bookName} {activity.chapters}
                                                        </Text>
                                                        <View style={{ marginTop: Spacing.sm, marginRight: -32, padding: Spacing.md, backgroundColor: colors.accentSecondaryLight + '15', borderRadius: 8, borderWidth: 1, borderColor: colors.accentSecondaryLight + '30' }}>
                                                            {activity.sharedQuestionTitle && (
                                                                <Text style={{ fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: colors.accent, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                                    {activity.sharedQuestionTitle}
                                                                </Text>
                                                            )}
                                                            <Text style={{ fontSize: Typography.size.sm, color: colors.textPrimary, lineHeight: 20 }}>
                                                                {activity.sharedReflectionText || activity.preview}
                                                            </Text>
                                                        </View>
                                                    </>
                                                )}
                                                {isJoined && (
                                                    <Text style={[styles.activityText, { color: colors.textSecondary, fontWeight: '500' }]}>
                                                        Welcome! Let's grow together. 🎉
                                                    </Text>
                                                )}
                                                {isAbsent && (
                                                    <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                                                        {activity.threshold === 30
                                                            ? `${getPronoun(activity.userId, 'subject').charAt(0).toUpperCase() + getPronoun(activity.userId, 'subject').slice(1)} has been away for a month. We miss ${getPronoun(activity.userId, 'possessive')} insights! 🫂`
                                                            : `We haven't seen ${getPronoun(activity.userId, 'object')} in a week. Drop a message to encourage ${getPronoun(activity.userId, 'object')}!`}
                                                    </Text>
                                                )}
                                                {isRemoved && (
                                                    <Text style={[styles.activityText, { color: colors.textTertiary, fontStyle: 'italic' }]}>
                                                        has left us.
                                                    </Text>
                                                )}
                                            </View>
                                            <View style={styles.activityIcon}>
                                                {isMilestone ? (
                                                    <Text style={{ fontSize: 18, marginTop: -2 }}>{activity.badgeEmoji}</Text>
                                                ) : (
                                                    <Ionicons
                                                        name={
                                                            isJournalEntry ? 'journal-outline'
                                                                : isSharedReflection ? 'chatbubbles-outline'
                                                                    : isJoined ? 'person-add-outline'
                                                                        : isAbsent ? 'moon-outline'
                                                                            : isRemoved ? 'exit-outline'
                                                                                : 'checkmark-circle'
                                                        }
                                                        size={20}
                                                        color={
                                                            isJournalEntry ? colors.accentSecondary
                                                                : isSharedReflection ? colors.accentSecondary
                                                                    : isJoined ? colors.indicatorActive
                                                                        : isAbsent ? colors.accent
                                                                            : colors.textTertiary
                                                        }
                                                    />
                                                )}
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
                        </View>
                    </>
                )}

                {activeTab === 'accountability' && (
                    <View style={{ marginTop: Spacing.md }}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>WHAT YOUR PEERS DO</Text>
                        </View>

                        {/* Group Progress Dashboard */}
                        <View style={[styles.accountabilityHero, { backgroundColor: colors.accentSecondaryLight + '20', borderColor: colors.accentSecondaryLight + '40' }]}>
                            <View style={styles.heroTop}>
                                <View style={styles.heroMain}>
                                    <View style={styles.heroValRow}>
                                        <Text style={[styles.heroVal, { color: colors.accentSecondary }]}>{accountabilityData.readTodayCount} / {accountabilityData.totalMembers}</Text>
                                        <Ionicons name="people" size={20} color={colors.accentSecondary} />
                                    </View>
                                    <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>People read today</Text>
                                </View>
                                <View style={styles.heroStats}>
                                    <View style={styles.miniStat}>
                                        <Text style={[styles.miniStatVal, { color: colors.accent }]}>🔥 {groupStreak}</Text>
                                        <Text style={[styles.miniStatLabel, { color: colors.textTertiary }]}>Our streak</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={[styles.progressTrack, { backgroundColor: colors.borderSubtle }]}>
                                <Animated.View style={[styles.progressBar, { width: `${accountabilityData.groupProgressPercent}%`, backgroundColor: colors.accentSecondary }]} />
                            </View>
                            <Text style={[styles.heroHint, { color: colors.textTertiary }]}>
                                {accountabilityData.groupProgressPercent === 100
                                    ? "A good day! Everyone is up to date. 🎉"
                                    : `Encourage the remaining ${accountabilityData.totalMembers - accountabilityData.readTodayCount}`}
                            </Text>
                        </View>

                        {/* Up To Date Section */}
                        {accountabilityData.upToDate.length > 0 && (
                            <View style={styles.accountabilitySection}>
                                <View style={styles.subHeader}>
                                    <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                                    <Text style={[styles.subHeaderText, { color: colors.textSecondary }]}>UP TO DATE — {accountabilityData.upToDate.length}</Text>
                                </View>
                                {accountabilityData.upToDate.map((member) => (
                                    <TouchableOpacity
                                        key={member.id}
                                        style={[styles.accMemberCard, member.isMe && { backgroundColor: colors.accentSecondaryLight + '10', borderRadius: 12 }]}
                                        onPress={() => setSelectedMember(member)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[styles.memberAvatar, { width: 44, height: 44, borderRadius: 12, backgroundColor: getAvatarColor(member.userId || member.id, member.displayName) }]}>
                                            <Text style={[styles.memberInitial, { fontSize: 18, color: 'white' }]}>{member.displayName?.charAt(0).toUpperCase()}</Text>
                                        </View>
                                        <View style={styles.accMemberContent}>
                                            <View style={styles.accMemberRow}>
                                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                                                    <Text style={[styles.accMemberName, { color: colors.textPrimary }]} numberOfLines={1}>{member.displayName} {member.isMe && '(You)'}</Text>
                                                    <View style={styles.statusTags}>
                                                        {member.isIronMan && (
                                                            <View style={[styles.tag, { backgroundColor: '#5856D6' }]}>
                                                                <Text style={styles.tagText}>🛡️ {member.gender === 'f' ? 'IRON WOMAN' : 'IRON MAN'}</Text>
                                                            </View>
                                                        )}
                                                        {member.isOnFire && !member.isIronMan && <View style={[styles.tag, { backgroundColor: '#FF3B30' }]}><Text style={styles.tagText}>🔥 ON FIRE</Text></View>}
                                                    </View>
                                                </View>
                                                <Text style={[styles.accMemberStreak, { color: colors.accent }]}>{member.streak} 🔥</Text>
                                            </View>
                                            <View style={styles.accMemberSubRow}>
                                                <View style={styles.miniHeatmap}>
                                                    {member.dots.map((active: boolean, i: number) => (
                                                        <View key={i} style={[styles.miniDot, { backgroundColor: active ? colors.accent : colors.border }]} />
                                                    ))}
                                                </View>
                                                <Text style={[styles.accMemberSubtitle, { color: colors.textTertiary }]}>{member.daysThisWeek}/7 days</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Needs Support Section */}
                        {accountabilityData.needsSupport.length > 0 && (
                            <View style={[styles.accountabilitySection, { marginTop: Spacing.xl }]}>
                                <View style={styles.subHeader}>
                                    <Ionicons name="alert-circle" size={16} color={colors.accent} />
                                    <Text style={[styles.subHeaderText, { color: colors.textSecondary }]}>NEEDS GINGERING — {accountabilityData.needsSupport.length}</Text>
                                </View>
                                {accountabilityData.needsSupport.map((member) => {
                                    // ginger logic: if member was consistent but missed today
                                    const isMostConsistent = member.daysThisWeek >= 5;

                                    return (
                                        <TouchableOpacity
                                            key={member.id}
                                            style={[styles.accMemberCard, member.isMe && { backgroundColor: colors.accentSecondaryLight + '10', borderRadius: 12 }]}
                                            onPress={() => setSelectedMember(member)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.memberAvatar, { width: 44, height: 44, borderRadius: 12, backgroundColor: getAvatarColor(member.userId || member.id, member.displayName), opacity: 0.7 }]}>
                                                <Text style={[styles.memberInitial, { fontSize: 18, color: 'white' }]}>{member.displayName?.charAt(0).toUpperCase()}</Text>
                                            </View>
                                            <View style={styles.accMemberContent}>
                                                <View style={styles.accMemberRow}>
                                                    <Text style={[styles.accMemberName, { color: colors.textSecondary }]}>{member.displayName} {member.isMe && '(You)'}</Text>
                                                    <View style={styles.accNudge}>
                                                        {member.isMe ? (
                                                            <Text style={[styles.accNudgeText, { color: colors.accent, fontWeight: '700' }]}>Read now?</Text>
                                                        ) : (
                                                            <Text style={[styles.accNudgeText, { color: colors.textTertiary }]}></Text>
                                                        )}
                                                    </View>
                                                </View>
                                                <View style={styles.accMemberSubRow}>
                                                    <View style={styles.miniHeatmap}>
                                                        {member.dots.map((active: boolean, i: number) => (
                                                            <View key={i} style={[styles.miniDot, { backgroundColor: active ? colors.accent : colors.border }]} />
                                                        ))}
                                                    </View>
                                                    {isMostConsistent && !member.isMe && (
                                                        <Text style={[styles.gingerText, { color: colors.accentSecondary }]}>Don't let the streak break! ⚡</Text>
                                                    )}
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                )}

                {activeTab === 'members' && (
                    <View style={{ marginTop: Spacing.md }}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DISTINGUISHED {memberSectionTitle}</Text>
                        </View>
                        {accountabilityData.membersByConsistency.map((member) => (
                            <TouchableOpacity
                                key={member.id}
                                style={styles.memberListItem}
                                onPress={() => setSelectedMember(member)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.memberAvatar, { width: 52, height: 52, borderRadius: 16, backgroundColor: getAvatarColor(member.userId || member.id, member.displayName) }]}>
                                    <Text style={[styles.memberInitial, { fontSize: 22, color: 'white' }]}>
                                        {member.displayName?.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.memberItemContent}>
                                    <Text style={[styles.memberItemName, { color: colors.textPrimary }]}>{member.displayName} {member.isMe && '(You)'}</Text>
                                    <Text style={[styles.memberItemJoined, { color: colors.textTertiary }]}>
                                        {member.joinedAt ? `Joined ${new Date(member.joinedAt.toDate ? member.joinedAt.toDate() : member.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : 'Member'}
                                    </Text>
                                </View>
                                {member.role === 'admin' && (
                                    <View style={[styles.adminBadge, { backgroundColor: colors.accentSecondaryLight + '30' }]}>
                                        <Text style={[styles.adminBadgeText, { color: colors.accentSecondary }]}>ADMIN</Text>
                                    </View>
                                )}
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

            </ScrollView>

            {/* Member Profile Sheet */}
            {
                selectedMember && (
                    <MemberProfileSheet
                        groupId={groupId}
                        member={selectedMember}
                        onClose={() => setSelectedMember(null)}
                        colors={colors}
                        today={today}
                    />
                )
            }
        </SafeAreaView >
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1 },
    offlineBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.xs, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md,
    },
    offlineBannerText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.medium, letterSpacing: 0.3 },
    scrollContent: { padding: Spacing.layout.screenPadding, paddingTop: Spacing.sm, paddingBottom: 100, },
    sectionHeader: { marginTop: Spacing.lg, marginBottom: Spacing.md },
    sectionTitleRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.sm,
    },
    sectionTitle: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, letterSpacing: 2, opacity: 0.6 },
    memberList: { marginBottom: Spacing.xl },
    memberItem: { alignItems: 'center', marginRight: Spacing.lg, width: 60, paddingBottom: Spacing.sm },
    avatarContainer: { position: 'relative', marginBottom: Spacing.xs },
    memberAvatar: {
        width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    memberInitial: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
    memberName: { fontSize: Typography.size.xs, textAlign: 'center', fontFamily: Typography.fontFamily.medium },
    activityCard: {
        flexDirection: 'row',
        paddingVertical: Spacing.md,
        paddingLeft: 10,
        paddingRight: Spacing.md,
        marginBottom: Spacing.lg,
        alignItems: 'flex-start',
        gap: Spacing.md,
        position: 'relative',
    },
    feedChainContainer: {
        position: 'relative',
    },
    feedChainLine: {
        position: 'absolute',
        left: 32, // (44 avatar width / 2) + 10 padding
        top: 0,
        bottom: 0,
        width: 2,
        opacity: 0.5, // Even more subtle
    },
    userBadge: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    userInitial: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold },
    activityContent: { flex: 1, gap: 4 },
    activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    userName: { fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, letterSpacing: -0.2 },
    timestamp: { fontSize: Typography.size.xs, opacity: 0.8 },
    activityText: { fontSize: Typography.size.sm, lineHeight: 22, marginTop: 0 },
    reflectionPreview: {
        fontSize: Typography.size.sm,
        lineHeight: 20,
        fontStyle: 'italic',
        marginTop: Spacing.xs,
        paddingLeft: Spacing.sm,
        borderLeftWidth: 2,
    },
    activityIcon: { marginLeft: Spacing.xs, paddingTop: 4, flexShrink: 0 },
    milestoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, marginTop: 2, flexWrap: 'wrap' },
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
    // Date separator
    dateSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.md,
        gap: Spacing.sm,
    },
    dateSeparatorLine: {
        flex: 1,
        height: 1,
        opacity: 0.4,
    },
    dateSeparatorLabel: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.semibold,
        letterSpacing: 0.5,
        paddingHorizontal: Spacing.xs,
    },
    // Reading digest
    digestCard: {
        marginBottom: Spacing.lg,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: colors.backgroundElevated + '40',
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle + '80',
    },
    digestHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        paddingLeft: 12, // Adjusted for 40px icon alignment (12 + 20 = 32)
        paddingRight: Spacing.lg,
        gap: Spacing.md,
    },
    digestIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    digestContent: { flex: 1, gap: 3 },
    digestLine: { fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, letterSpacing: -0.2 },
    digestSub: { fontSize: Typography.size.xs, opacity: 0.8 },
    digestEntries: {
        borderTopWidth: 1,
    },
    digestEntry: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        paddingHorizontal: Spacing.md,
        gap: Spacing.sm,
        marginHorizontal: Spacing.xs,
    },
    digestEntryAvatar: {
        width: 28,
        height: 28,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    digestEntryInitial: {
        fontSize: 11,
        fontWeight: Typography.weight.bold,
        color: 'white',
    },
    digestEntryText: { flex: 1, gap: 1 },
    digestEntryName: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
    digestEntrySub: { fontSize: Typography.size.sm },
    // Pinned milestone hero
    milestoneHero: {
        borderRadius: 20,
        padding: Spacing.xl,
        marginBottom: Spacing.xl,
        gap: Spacing.md,
        borderWidth: 1.5,
    },
    milestoneHeroTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.lg,
    },
    milestoneHeroBadge: {
        fontSize: 48,
    },
    milestoneHeroConfetti: { flex: 1 },
    milestoneHeroLabel: {
        fontSize: Typography.size.xl,
        fontWeight: Typography.weight.bold,
        letterSpacing: -0.5,
    },
    milestoneHeroDesc: {
        fontSize: Typography.size.md,
        lineHeight: 24,
        fontWeight: Typography.weight.medium,
    },
    milestoneHeroTime: {
        fontSize: Typography.size.xs,
        marginTop: 4,
        fontWeight: Typography.weight.semibold,
        opacity: 0.6,
    },
    tabContainer: {
        marginBottom: Spacing.lg,
    },
    tabBackground: {
        flexDirection: 'row',
        backgroundColor: 'transparent',
        position: 'relative',
        borderBottomWidth: 0.5,
        borderColor: colors.border,
    },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        height: 2.5,
        borderRadius: 2,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        zIndex: 1,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '400',
        letterSpacing: 0.2,
    },
    leaderboardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 0.5,
        borderColor: colors.border,
        gap: Spacing.md,
    },
    rankText: {
        width: 24,
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.bold,
        textAlign: 'center',
    },
    leaderboardContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    leaderboardName: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.semibold,
    },
    leaderboardStreak: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.bold,
    },
    memberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 0.5,
        borderColor: colors.border,
        gap: Spacing.md,
    },
    memberInfo: {
        flex: 1,
    },
    memberListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: colors.cardBackground,
        borderRadius: 16,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle + '40',
        gap: Spacing.md,
    },
    memberItemContent: {
        flex: 1,
        gap: 2,
    },
    memberItemName: {
        fontSize: 15,
        fontWeight: '600',
    },
    memberItemJoined: {
        fontSize: 12,
        opacity: 0.7,
    },
    adminBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 4,
    },
    adminBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    memberRole: {
        fontSize: Typography.size.xs,
        opacity: 0.6,
    },
    // Accountability Styles
    accountabilityHero: {
        borderRadius: 20,
        padding: Spacing.xl,
        marginBottom: Spacing.xl,
        borderWidth: 1,
        gap: Spacing.md,
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroMain: { gap: 2 },
    heroValRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    heroVal: {
        fontSize: 42,
        fontWeight: '900',
        letterSpacing: -1,
    },
    heroLabel: {
        fontSize: Typography.size.sm,
        fontWeight: '600',
    },
    heroStats: { gap: Spacing.sm },
    miniStat: { alignItems: 'flex-end', gap: 1 },
    miniStatVal: { fontSize: 13, fontWeight: '700' },
    miniStatLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    progressTrack: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 4,
    },
    heroHint: {
        fontSize: 12,
        fontStyle: 'italic',
        lineHeight: 18,
    },
    accountabilitySection: { gap: Spacing.md },
    subHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.xs,
    },
    subHeaderText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    accMemberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        gap: Spacing.md,
    },
    accMemberContent: { flex: 1, gap: 4 },
    accMemberRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusTags: {
        flexDirection: 'row',
        gap: 4,
    },
    tag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    tagText: {
        color: 'white',
        fontSize: 8,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    accMemberName: { fontSize: 14, fontWeight: '600' },
    accMemberStreak: { fontSize: 13, fontWeight: '700' },
    accMemberSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    accMemberSubtitle: { fontSize: 11, fontWeight: '500' },
    accNudge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    accNudgeText: { fontSize: 10, fontWeight: '600' },
    gingerText: { fontSize: 10, fontWeight: '600', fontStyle: 'italic' },
    miniHeatmap: { flexDirection: 'row', gap: 3 },
    miniDot: { width: 8, height: 8, borderRadius: 2 },
});
