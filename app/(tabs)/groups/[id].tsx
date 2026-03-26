import React, { useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    Platform, UIManager, Modal, Pressable, Dimensions, DeviceEventEmitter, TextInput, Image
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { checkInactiveMembers, getISOWeekString } from '@/src/utils/syncActivities';
import { getTodayDateString } from '@/src/utils/dateUtils';
import { ALL_BADGES } from '@/src/utils/badges';
import { useEffect, useRef, useState, useCallback } from 'react';
import Animated, {
    useSharedValue, useAnimatedStyle, withSpring, withTiming,
    runOnJS,
} from 'react-native-reanimated';
import { ScalePressable } from '@/src/components/ScalePressable';
import { LoadingView } from '@/src/components/LoadingView';
import { Button } from '@/src/components/Button';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
    '#FF2D55', '#FF9500', '#FFCC00', '#34C759',
    '#00C7BE', '#007AFF', '#5856D6', '#AF52DE', '#FF375F',
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

const getAvatarColor = (id: string | undefined | null, name?: string): string => {
    const seed = (id || name || 'Guest').toString();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
        if (
            date.getDate() === yesterday.getDate() &&
            date.getMonth() === yesterday.getMonth() &&
            date.getFullYear() === yesterday.getFullYear()
        ) {
            return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return null; }
};

const formatLastRead = (dateStr: string | undefined, today: string): string => {
    if (!dateStr) return 'Never read';
    if (dateStr === today) return 'Read today 😌';
    try {
        const d = new Date(dateStr);
        const now = new Date(today);
        const diff = Math.round((now.getTime() - d.getTime()) / 86400000);
        if (diff === 1) return 'Read yesterday';
        if (diff < 14) return `${diff} days ago`;
        return `Last read ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    } catch { return dateStr; }
};

// ─── Pronoun helpers ──────────────────────────────────────────────────────────

const getPronoun = (
    members: any[],
    userId: string,
    type: 'subject' | 'object' | 'possessive' = 'object'
): string => {
    const member = members.find(m => m.userId === userId || m.id === userId);
    const gender = member?.gender;
    if (gender === 'f') {
        if (type === 'subject') return 'she';
        if (type === 'possessive') return 'her';
        return 'her';
    }
    if (type === 'subject') return 'he';
    if (type === 'possessive') return 'his';
    return 'him';
};

const formatBadgeDesc = (members: any[], desc: string, userId: string): string => {
    if (!desc) return desc;
    return desc
        .replace(/{subject}/g, getPronoun(members, userId, 'subject'))
        .replace(/{object}/g, getPronoun(members, userId, 'object'))
        .replace(/{possessive}/g, getPronoun(members, userId, 'possessive'));
};

// ─── Feed processing ──────────────────────────────────────────────────────────

const getActivityDateStr = (activity: any): string | null => {
    if (!activity.timestamp) return null;
    try {
        const d = activity.timestamp.toDate ? activity.timestamp.toDate() : new Date(activity.timestamp);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch { return null; }
};

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
    entries: any[];
}
type FeedItem = any | Separator | ReadingDigest;

const buildProcessedFeed = (
    rawActivities: any[],
    today: string,
): { pinnedMilestone: any | null; feedItems: FeedItem[] } => {
    const groupMilestones = rawActivities.filter(a => a.type === 'group_milestone');
    const normalActivities = rawActivities.filter(a => a.type !== 'group_milestone');
    const pinnedMilestone = groupMilestones.length > 0 ? groupMilestones[0] : null;

    const journalByDate: Record<string, any[]> = {};
    for (const a of normalActivities) {
        if (a.type !== 'journal_entry') continue;
        const d = getActivityDateStr(a);
        if (!d) continue;
        if (!journalByDate[d]) journalByDate[d] = [];
        journalByDate[d].push(a);
    }

    const digestDates = new Set<string>();
    const digestMap: Record<string, ReadingDigest> = {};
    for (const [dateStr, entries] of Object.entries(journalByDate)) {
        const unique = [...new Map(entries.map((e: any) => [e.userId, e])).values()];
        if (unique.length >= 3) {
            digestDates.add(dateStr);
            digestMap[dateStr] = {
                type: 'reading_digest',
                id: `digest-${dateStr}`,
                dateStr,
                names: unique.slice(0, 2).map((e: any) => e.userName || '?'),
                extraCount: Math.max(0, unique.length - 2),
                timestamp: entries[0].timestamp,
                entries: unique,
            };
        }
    }

    const feedItems: FeedItem[] = [];
    let lastDateLabel: string | null = null;
    const digestInserted = new Set<string>();

    for (const activity of normalActivities) {
        const dateStr = getActivityDateStr(activity);
        const dateLabel = formatDateLabel(dateStr, today);

        if (dateLabel !== lastDateLabel) {
            feedItems.push({ type: 'separator', id: `sep-${dateStr}`, label: dateLabel });
            lastDateLabel = dateLabel;
        }

        if (activity.type === 'journal_entry' && dateStr && digestDates.has(dateStr)) {
            if (!digestInserted.has(dateStr)) {
                feedItems.push(digestMap[dateStr]);
                digestInserted.add(dateStr);
            }
            continue;
        }

        feedItems.push(activity);
    }

    return { pinnedMilestone, feedItems };
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

export const Avatar = ({
    id, name, url, size = 44, radius, borderWidth, borderColor, opacity = 1, style,
}: {
    id?: string; name?: string; url?: string; size?: number; radius?: number;
    borderWidth?: number; borderColor?: string; opacity?: number; style?: any;
}) => (
    <View style={[{
        width: size, height: size,
        borderRadius: radius ?? size / 2,
        backgroundColor: getAvatarColor(id, name),
        justifyContent: 'center', alignItems: 'center',
        borderWidth: borderWidth ?? 0, borderColor, opacity,
        overflow: 'hidden',
    }, style]}>
        {url ? (
            <Image
                source={{ uri: url }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
            />
        ) : (
            <Text style={{ fontSize: size * 0.4, fontWeight: Typography.weight.bold as any, color: 'white' }}>
                {name?.charAt(0).toUpperCase() ?? '?'}
            </Text>
        )}
    </View>
);

// ─── Accountability Member Card ───────────────────────────────────────────────

const AccountabilityMemberCard = ({
    member, colors, styles, onPress,
}: {
    member: any; colors: any; styles: ReturnType<typeof getStyles>; onPress: () => void;
}) => {
    const isMostConsistent = !member.readToday && member.daysThisWeek >= 5;

    return (
        <ScalePressable
            style={[
                styles.accMemberCard,
                member.isMe && { backgroundColor: colors.accentSecondaryLight + '10', borderRadius: 12 },
            ]}
            onPress={onPress}
        >
            <Avatar
                id={member.userId || member.id}
                name={member.displayName}
                url={member.photoURL}
                size={44}
                radius={12}
                opacity={member.readToday ? 1 : 0.7}
            />
            <View style={styles.accMemberContent}>
                <View style={styles.accMemberRow}>
                    {member.readToday ? (
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                            <Text style={[styles.accMemberName, { color: colors.textPrimary }]} numberOfLines={1}>
                                {member.displayName}{member.isMe ? ' (You)' : ''}
                            </Text>
                            <View style={styles.statusTags}>
                                {member.isIronMan && (
                                    <View style={[styles.tag, { backgroundColor: '#5856D6' }]}>
                                        <Text style={styles.tagText}>
                                            🛡️ {member.gender === 'f' ? 'IRON WOMAN' : 'IRON MAN'}
                                        </Text>
                                    </View>
                                )}
                                {member.isOnFire && !member.isIronMan && (
                                    <View style={[styles.tag, { backgroundColor: '#FF3B30' }]}>
                                        <Text style={styles.tagText}>🔥 ON FIRE</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    ) : (
                        <Text style={[styles.accMemberName, { color: colors.textSecondary }]}>
                            {member.displayName}{member.isMe ? ' (You)' : ''}
                        </Text>
                    )}

                    {member.readToday ? (
                        <Text style={[styles.accMemberStreak, { color: colors.accent }]}>
                            {member.streak} 🔥
                        </Text>
                    ) : (
                        <View style={styles.accNudge}>
                            {member.isMe && (
                                <Text style={[styles.accNudgeText, { color: colors.accent, fontWeight: '700' }]}>
                                    Read now?
                                </Text>
                            )}
                        </View>
                    )}
                </View>

                <View style={styles.accMemberSubRow}>
                    <View style={styles.miniHeatmap}>
                        {member.dots.map((active: boolean, i: number) => (
                            <View key={i} style={[styles.miniDot, { backgroundColor: active ? colors.accent : colors.border }]} />
                        ))}
                    </View>
                    {member.readToday ? (
                        <Text style={[styles.accMemberSubtitle, { color: colors.textTertiary }]}>
                            {member.daysThisWeek}/7 days
                        </Text>
                    ) : isMostConsistent && !member.isMe ? (
                        <Text style={[styles.gingerText, { color: colors.accentSecondary }]}>
                            Don't let the streak break! ⚡
                        </Text>
                    ) : null}
                </View>
            </View>
        </ScalePressable>
    );
};


// ─── Group Edit Modal ──────────────────────────────────────────────────────────

const GroupEditModal = ({
    visible, groupData, groupId, onClose, colors
}: {
    visible: boolean; groupData: any; groupId: string; onClose: () => void; colors: any;
}) => {
    const [name, setName] = useState(groupData?.name || '');
    const [description, setDescription] = useState(groupData?.description || '');
    const [photoURL, setPhotoURL] = useState(groupData?.photoURL || '');
    const [saving, setSaving] = useState(false);
    const { showAlert } = useAlert();

    useEffect(() => {
        if (visible) {
            setName(groupData?.name || '');
            setDescription(groupData?.description || '');
            setPhotoURL(groupData?.photoURL || '');
        }
    }, [visible, groupData]);

    const handleSave = async () => {
        if (!name.trim()) {
            showAlert({ title: 'Error', message: 'Group name cannot be empty' });
            return;
        }

        setSaving(true);
        try {
            await firestore().collection('groups').doc(groupId).update({
                name: name.trim(),
                description: description.trim(),
                photoURL: photoURL.trim(),
            });
            onClose();
        } catch (error: any) {
            console.error('[GroupEditModal] Error updating group:', error);
            showAlert({ title: 'Error', message: 'Failed to update group details' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: Spacing.xl }}>
                <View style={{ backgroundColor: colors.background, borderRadius: 24, padding: Spacing.xl, gap: Spacing.lg }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
                        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 }}>Edit Group Deets</Text>
                        <ScalePressable onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </ScalePressable>
                    </View>

                    <View style={{ gap: Spacing.xs }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 }}>NAME</Text>
                        <TextInput
                            style={{ backgroundColor: colors.buttonSecondary, padding: 16, borderRadius: 14, color: colors.textPrimary, fontSize: 16 }}
                            value={name}
                            onChangeText={setName}
                            placeholder="Group Name"
                            placeholderTextColor={colors.textTertiary}
                        />
                    </View>

                    <View style={{ gap: Spacing.xs }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 }}>DESCRIPTION</Text>
                        <TextInput
                            style={{ backgroundColor: colors.buttonSecondary, padding: 16, borderRadius: 14, color: colors.textPrimary, fontSize: 16, minHeight: 80 }}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Write whatever is on your mind"
                            placeholderTextColor={colors.textTertiary}
                            multiline
                        />
                    </View>

                    <View style={{ gap: Spacing.xs }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 }}>PHOTO URL</Text>
                        <TextInput
                            style={{ backgroundColor: colors.buttonSecondary, padding: 16, borderRadius: 14, color: colors.textPrimary, fontSize: 16 }}
                            value={photoURL}
                            onChangeText={setPhotoURL}
                            placeholder="https://example.com/image.jpg"
                            placeholderTextColor={colors.textTertiary}
                            autoCapitalize="none"
                        />
                    </View>

                    <Button
                        label={saving ? "Saving Changes..." : "Save Changes"}
                        onPress={handleSave}
                        disabled={saving}
                        loading={saving}
                        variant="primary"
                        fullWidth
                        style={{ marginTop: Spacing.md }}
                    />
                </View>
            </View>
        </Modal>
    );
};


// ─── Member Profile Sheet ─────────────────────────────────────────────────────

const MemberProfileSheet = ({
    groupId,
    member,
    onClose,
    colors,
    today,
    isMe,
    members,
    activities,
}: {
    groupId: string;
    member: any;
    onClose: () => void;
    colors: any;
    today: string;
    isMe: boolean;
    members: any[];
    activities: any[];
}) => {
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const backdropOpacity = useSharedValue(0);
    const [visible, setVisible] = React.useState(true);
    const [pastReads, setPastReads] = React.useState<any[]>([]);
    const [sharedReflections, setSharedReflections] = React.useState<any[]>([]);
    const [loadingReads, setLoadingReads] = React.useState(true);
    const [activeSheetTab, setActiveSheetTab] = React.useState<'reads' | 'reflections'>('reads');

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

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

    React.useEffect(() => {
        if (!member || !groupId) { setLoadingReads(false); return; }

        const memberId = member.userId || member.id;
        const baseRef = firestore()
            .collection('groups').doc(groupId)
            .collection('activities');

        const unsubReads = baseRef
            .where('userId', '==', memberId)
            .where('type', '==', 'journal_entry')
            .orderBy('timestamp', 'desc')
            .limit(30)
            .onSnapshot(
                (snapshot) => {
                    setPastReads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                    setLoadingReads(false);
                },
                (error) => {
                    console.error('[MemberProfileSheet] Error fetching past reads:', error);
                    setLoadingReads(false);
                }
            );

        const unsubReflections = baseRef
            .where('userId', '==', memberId)
            .where('type', '==', 'reflection_shared')
            .orderBy('timestamp', 'desc')
            .limit(30)
            .onSnapshot(
                (snapshot) => {
                    setSharedReflections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                },
                (error) => {
                    console.error('[MemberProfileSheet] Error fetching reflections:', error);
                }
            );

        return () => {
            unsubReads();
            unsubReflections();
        };
    }, [groupId, member]);

    if (!visible) return null;

    const memberId = member.userId || member.id;

    // ── Heatmap ─────────────────────────────────────────────────────────────
    const currentWeek = getISOWeekString(new Date());
    const isCurrentWeek = member.weeklyActivityWeek === currentWeek;
    const dots: boolean[] = (isCurrentWeek && Array.isArray(member.weeklyActivity) && member.weeklyActivity.length === 7)
        ? member.weeklyActivity
        : [false, false, false, false, false, false, false];

    const readToday = member.lastReadDate === today;
    const totalReflections = member.totalReflections || 0;

    // ── Badges ───────────────────────────────────────────────────────────────
    const earnedBadgeIds: string[] = member.badges || [];
    const earnedBadges = ALL_BADGES.filter(b => earnedBadgeIds.includes(b.id)).sort((a, b) => a.order - b.order);
    const unearnedBadges = isMe
        ? ALL_BADGES.filter(b => !earnedBadgeIds.includes(b.id)).sort((a, b) => a.order - b.order)
        : [];

    // ── Insight 1: Most active time ──────────────────────────────────────────
    const getTimeOfDay = (ts: any): 'morning' | 'afternoon' | 'evening' | 'night' | null => {
        try {
            const hour = (ts.toDate ? ts.toDate() : new Date(ts)).getHours();
            if (hour >= 5 && hour < 12) return 'morning';
            if (hour >= 12 && hour < 17) return 'afternoon';
            if (hour >= 17 && hour < 21) return 'evening';
            return 'night';
        } catch { return null; }
    };

    const timeCounts = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    for (const read of pastReads) {
        const t = getTimeOfDay(read.timestamp);
        if (t) timeCounts[t]++;
    }

    const mostActiveTime = pastReads.length >= 5
        ? (Object.entries(timeCounts).sort((a, b) => b[1] - a[1])[0][0] as keyof typeof timeCounts)
        : null;

    const timeInsightMap: Record<string, { label: string; emoji: string }> = {
        morning: { label: 'Usually reads in the morning', emoji: '☀️' },
        afternoon: { label: 'Usually reads in the afternoon', emoji: '🌤️' },
        evening: { label: 'Usually reads in the evening', emoji: '🌙' },
        night: { label: 'Usually reads late at night', emoji: '🌃' },
    };

    // ── Insight 2: Reading style ─────────────────────────────────────────────
    const parseChapterRange = (chapters: string | undefined): number => {
        if (!chapters) return 1;
        const parts = chapters.split('-');
        if (parts.length === 1) return 1;
        try {
            const start = parseInt(parts[0], 10);
            const end = parseInt(parts[parts.length - 1], 10);
            return isNaN(start) || isNaN(end) ? 1 : Math.max(1, end - start + 1);
        } catch { return 1; }
    };

    const avgChaptersPerEntry = pastReads.length > 0
        ? pastReads.reduce((sum, r) => sum + parseChapterRange(r.chapters), 0) / pastReads.length
        : 0;

    const readingStyleInsight = pastReads.length >= 3
        ? avgChaptersPerEntry >= 4
            ? { label: 'Reads in big chunks — covers a lot at once', emoji: '📖' }
            : avgChaptersPerEntry <= 2
                ? { label: 'Reads chapter by chapter — slow and deliberate', emoji: '🔍' }
                : { label: 'Reads at a steady, measured pace', emoji: '📑' }
        : null;

    // ── Insight 3: Same books connection ─────────────────────────────────────
    // Build this member's recent book set
    const myRecentBooks = new Set(pastReads.map(r => r.bookName).filter(Boolean));

    // For each other member, find their recent books from group activities
    // and count overlap with this member's books
    const otherMemberBooks: Record<string, { name: string; books: Set<string> }> = {};
    for (const a of activities) {
        if (a.type !== 'journal_entry') continue;
        if (a.userId === memberId) continue;
        if (!a.bookName) continue;
        if (!otherMemberBooks[a.userId]) {
            const m = members.find(m => m.userId === a.userId || m.id === a.userId);
            otherMemberBooks[a.userId] = {
                name: m?.displayName || a.userName || 'Someone',
                books: new Set(),
            };
        }
        otherMemberBooks[a.userId].books.add(a.bookName);
    }

    let bestMatchName = '';
    let bestMatchCount = 0;
    for (const { name, books } of Object.values(otherMemberBooks)) {
        const overlap = [...myRecentBooks].filter(b => books.has(b)).length;
        if (overlap > bestMatchCount) {
            bestMatchCount = overlap;
            bestMatchName = name;
        }
    }

    const connectionInsight = myRecentBooks.size >= 2 && bestMatchCount >= 2
        ? { label: `Often reads the same books as ${bestMatchName}`, emoji: '🤝' }
        : null;

    // ── Assemble final insights (only show what has enough data) ─────────────
    const insights: { label: string; emoji: string }[] = [
        mostActiveTime ? timeInsightMap[mostActiveTime] : null,
        readingStyleInsight,
        connectionInsight,
    ].filter(Boolean) as { label: string; emoji: string }[];

    return (
        <Modal transparent animationType="none" onRequestClose={dismiss}>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }, backdropStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
            </Animated.View>

            <Animated.View style={[sheetStyles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom }, sheetStyle]}>
                <View style={sheetStyles.handle}>
                    <View style={[sheetStyles.handleBar, { backgroundColor: colors.border }]} />
                </View>

                <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xl }}>

                    {/* ── Avatar + name ── */}
                    <View style={sheetStyles.header}>
                        <Avatar
                            id={member.userId || member.id}
                            name={member.displayName}
                            url={member.photoURL}
                            size={80}
                            borderWidth={readToday ? 3 : 0}
                            borderColor={colors.indicatorActive}
                            style={{ marginBottom: Spacing.sm }}
                        />
                        <Text style={[sheetStyles.name, { color: colors.textPrimary }]}>{member.displayName}</Text>
                        <Text style={[sheetStyles.lastRead, { color: readToday ? colors.indicatorActive : colors.textTertiary }]}>
                            {formatLastRead(member.lastReadDate, today)}
                        </Text>
                    </View>

                    {/* ── Insights ── */}
                    {insights.length > 0 && (
                        <View style={sheetStyles.insightsContainer}>
                            {insights.map((insight, i) => (
                                <View key={i} style={[sheetStyles.insightChip, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
                                    <Text style={sheetStyles.insightEmoji}>{insight.emoji}</Text>
                                    <Text style={[sheetStyles.insightLabel, { color: colors.textSecondary }]}>
                                        {insight.label}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* ── Weekly heatmap ── */}
                    <View style={sheetStyles.section}>
                        <Text style={[sheetStyles.sectionTitle, { color: colors.textSecondary }]}>THIS WEEK</Text>
                        <View style={sheetStyles.heatmapRow}>
                            {dots.map((active, i: number) => (
                                <View key={i} style={sheetStyles.heatmapCell}>
                                    <View style={[sheetStyles.heatmapDot, { backgroundColor: active ? colors.accent : colors.border }]} />
                                    <Text style={[sheetStyles.heatmapLabel, { color: colors.textTertiary }]}>{DAY_LABELS[i]}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* ── Badges ── */}
                    <View style={sheetStyles.section}>
                        <Text style={[sheetStyles.sectionTitle, { color: colors.textSecondary }]}>BADGES</Text>
                        {earnedBadges.length === 0 && unearnedBadges.length === 0 && (
                            <Text style={[sheetStyles.emptyText, { color: colors.textTertiary }]}>{isMe ? "Keep reading to earn badges!" : "No badges earned yet"}</Text>
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
                                    <Text style={sheetStyles.badgeEmoji}>🔒</Text>
                                    <Text style={[sheetStyles.badgeLabel, { color: colors.textTertiary }]} numberOfLines={1}>{badge.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* ── Reads / Reflections tabs ── */}
                    <View style={sheetStyles.section}>
                        <View style={[sheetStyles.miniTabRow, { borderColor: colors.border }]}>
                            <ScalePressable
                                style={[sheetStyles.miniTab, activeSheetTab === 'reads' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
                                onPress={() => setActiveSheetTab('reads')}
                            >
                                <Text style={[sheetStyles.miniTabText, { color: activeSheetTab === 'reads' ? colors.textPrimary : colors.textTertiary }]}>
                                    Recent Reads
                                </Text>
                            </ScalePressable>
                            <ScalePressable
                                style={[sheetStyles.miniTab, activeSheetTab === 'reflections' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
                                onPress={() => setActiveSheetTab('reflections')}
                            >
                                <Text style={[sheetStyles.miniTabText, { color: activeSheetTab === 'reflections' ? colors.textPrimary : colors.textTertiary }]}>
                                    Reflections{totalReflections > 0 ? ` (${totalReflections})` : ''}
                                </Text>
                            </ScalePressable>
                        </View>

                        {/* Recent Reads */}
                        {activeSheetTab === 'reads' && (
                            loadingReads ? (
                                <View style={{ marginTop: Spacing.xl, alignItems: 'center' }}>
                                    <LoadingView size={24} />
                                </View>
                            ) : pastReads.length > 0 ? (
                                <View style={{ gap: Spacing.md, marginTop: Spacing.md }}>
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
                                            {read.preview && (
                                                <Text style={[sheetStyles.readCardPreview, { color: colors.textSecondary, borderLeftColor: colors.accentSecondaryLight }]} numberOfLines={2}>
                                                    "{read.preview}"
                                                </Text>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <Text style={[sheetStyles.emptyText, { color: colors.textTertiary, marginTop: Spacing.md }]}>No recent reads found.</Text>
                            )
                        )}

                        {/* Shared Reflections */}
                        {activeSheetTab === 'reflections' && (
                            sharedReflections.length > 0 ? (
                                <View style={{ gap: Spacing.lg, marginTop: Spacing.md }}>
                                    {sharedReflections.map((item) => (
                                        <View key={item.id} style={[sheetStyles.reflectionCard, { backgroundColor: colors.accentSecondaryLight + '10', borderColor: colors.accentSecondaryLight + '30' }]}>
                                            <View style={sheetStyles.reflectionCardHeader}>
                                                <View style={{ flex: 1, gap: 2 }}>
                                                    {item.sharedQuestionTitle && (
                                                        <Text style={[sheetStyles.reflectionQuestion, { color: colors.accent }]}>
                                                            {item.sharedQuestionTitle}
                                                        </Text>
                                                    )}
                                                    <Text style={[sheetStyles.reflectionSource, { color: colors.textTertiary }]}>
                                                        {item.bookName} {item.chapters}
                                                    </Text>
                                                </View>
                                                <Text style={[sheetStyles.readCardTime, { color: colors.textTertiary }]}>
                                                    {formatRelativeTime(item.timestamp)}
                                                </Text>
                                            </View>
                                            <Text style={[sheetStyles.reflectionText, { color: colors.textPrimary }]}>
                                                {item.sharedReflectionText || item.preview}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <Text style={[sheetStyles.emptyText, { color: colors.textTertiary, marginTop: Spacing.md }]}>
                                    {isMe ? "You haven't shared any reflections yet." : "No reflections shared yet."}
                                </Text>
                            )
                        )}
                    </View>

                </Animated.ScrollView>
            </Animated.View>
        </Modal>
    );
};

const sheetStyles = StyleSheet.create({
    sheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: Spacing.layout.screenPadding,
        maxHeight: SCREEN_HEIGHT * 0.85,
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12, shadowRadius: 16, elevation: 24,
    },
    handle: { alignItems: 'center', paddingTop: Spacing.md, paddingBottom: Spacing.sm },
    handleBar: { width: 40, height: 4, borderRadius: 2 },
    header: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.xs },
    name: { fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold, letterSpacing: -0.3 },
    lastRead: { fontSize: Typography.size.sm, fontWeight: Typography.weight.medium },
    // Insights
    insightsContainer: { gap: Spacing.sm, marginBottom: Spacing.lg },
    insightChip: {
        flexDirection: 'row', alignItems: 'center',
        gap: Spacing.sm, paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: Spacing.borderRadius.md, borderWidth: 1,
    },
    insightEmoji: { fontSize: 16 },
    insightLabel: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
        flex: 1, lineHeight: 20,
    },
    // Heatmap
    section: { marginBottom: Spacing.xl, gap: Spacing.md },
    sectionTitle: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, letterSpacing: 2, opacity: 0.6 },
    heatmapRow: { flexDirection: 'row', justifyContent: 'space-between' },
    heatmapCell: { alignItems: 'center', gap: 5, flex: 1 },
    heatmapDot: { width: 28, height: 28, borderRadius: 8 },
    heatmapLabel: { fontSize: Typography.size.xs, fontWeight: Typography.weight.medium },
    // Badges
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    badgeItem: {
        width: '30%', alignItems: 'center', padding: Spacing.sm,
        borderRadius: Spacing.borderRadius.md, borderWidth: 1, gap: Spacing.xs,
    },
    badgeEmoji: { fontSize: 24 },
    badgeLabel: { fontSize: 9, textAlign: 'center', fontWeight: Typography.weight.semibold, letterSpacing: 0.2 },
    emptyText: { fontSize: Typography.size.sm, fontStyle: 'italic' },
    // Mini tab switcher
    miniTabRow: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 0 },
    miniTab: {
        flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
        borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    miniTabText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
    // Reads
    readCard: { gap: 4 },
    readCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    readCardTitle: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
    readCardTime: { fontSize: Typography.size.xs },
    readCardPreview: {
        fontSize: Typography.size.sm, lineHeight: 20,
        fontStyle: 'italic', paddingLeft: Spacing.sm, borderLeftWidth: 2,
    },
    // Reflections
    reflectionCard: { borderRadius: Spacing.borderRadius.md, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
    reflectionCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    reflectionQuestion: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
    reflectionSource: { fontSize: Typography.size.xs },
    reflectionText: { fontSize: Typography.size.sm, lineHeight: 22 },
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
    const [expandedDigests, setExpandedDigests] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'feed' | 'accountability' | 'members'>('feed');
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const scrollViewRef = useRef<any>(null);

    const isAdmin = useMemo(() => {
        const me = members.find(m => m.userId === user?.uid || m.id === user?.uid);
        return me?.role === 'admin';
    }, [members, user?.uid]);

    // Scroll to top on tab press
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('tab-press-top-groups', () => {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        });
        return () => subscription.remove();
    }, []);

    const today = useMemo(() => getTodayDateString(), []);

    const tabOffset = useSharedValue(0);
    React.useEffect(() => {
        const target = activeTab === 'feed' ? 0 : activeTab === 'accountability' ? 1 : 2;
        tabOffset.value = withSpring(target, { damping: 20, stiffness: 150 });
    }, [activeTab]);

    const animatedIndicatorStyle = useAnimatedStyle(() => ({
        left: `${tabOffset.value * 33.33}%`,
    }));

    const styles = useMemo(() => getStyles(colors), [colors]);

    const pendingCount = React.useRef(3);
    const markResolved = React.useCallback(() => {
        pendingCount.current -= 1;
        if (pendingCount.current === 0) setLoading(false);
    }, []);

    React.useEffect(() => {
        if (!groupId) return;

        const unsubscribeGroup = firestore()
            .collection('groups').doc(groupId)
            .onSnapshot(
                (doc) => {
                    setIsOffline(false);
                    setGroupData(doc.data() || null);
                    markResolved();
                    if (doc.exists()) checkInactiveMembers(groupId);
                },
                (error) => {
                    console.error('[GroupDetail] group snapshot error:', error);
                    setIsOffline(true);
                    markResolved();
                }
            );

        const unsubscribeActivities = firestore()
            .collection('groups').doc(groupId)
            .collection('activities')
            .orderBy('timestamp', 'desc').limit(30)
            .onSnapshot(
                (querySnapshot) => {
                    const feed = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setActivities(feed);
                    markResolved();
                },
                (error) => {
                    console.error('[GroupDetail] activities snapshot error:', error);
                    markResolved();
                }
            );

        const unsubscribeMembers = firestore()
            .collection('groups').doc(groupId)
            .collection('members')
            .onSnapshot(
                (querySnapshot) => {
                    setMembers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                    markResolved();
                },
                (error) => {
                    console.error('[GroupDetail] members snapshot error:', error);
                    markResolved();
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
        const hasGentlemen = members.some(m => m.gender === 'm' || !m.gender);
        if (hasLadies && hasGentlemen) return 'LADIES & GENTLEMEN';
        if (hasLadies) return 'LADIES';
        return 'GENTLEMEN';
    }, [members]);

    const accountabilityData = useMemo(() => {
        const currentWeek = getISOWeekString(new Date());
        const currentMonth = today.substring(0, 7);

        const processed = members.map(m => {
            const isCurrentWeek = m.weeklyActivityWeek === currentWeek;
            const dots = (isCurrentWeek && Array.isArray(m.weeklyActivity) && m.weeklyActivity.length === 7)
                ? m.weeklyActivity
                : [false, false, false, false, false, false, false];

            const isCurrentMonth = m.monthlyActivityMonth === currentMonth;
            const monthlyStreak = isCurrentMonth ? (m.monthlyStreak || 0) : 0;
            const monthlyCount = isCurrentMonth ? (m.monthlyActivityCount || 0) : 0;

            return {
                ...m,
                daysThisWeek: dots.filter(Boolean).length,
                dots,
                readToday: m.lastReadDate === today,
                streak: monthlyStreak,
                monthlyCount,
                isOnFire: monthlyStreak >= 9,
                isIronMan: monthlyStreak >= 21,
                isMe: m.userId === user?.uid || m.id === user?.uid,
            };
        });

        const readTodayCount = processed.filter(m => m.readToday).length;
        const totalMembers = processed.length;
        const groupProgressPercent = totalMembers > 0 ? Math.round((readTodayCount / totalMembers) * 100) : 0;

        return {
            upToDate: processed.filter(m => m.readToday).sort((a, b) => b.streak - a.streak),
            needsSupport: processed.filter(m => !m.readToday).sort((a, b) => b.daysThisWeek - a.daysThisWeek),
            membersByConsistency: [...processed].sort((a, b) => a.monthlyCount - b.monthlyCount),
            groupProgressPercent,
            readTodayCount,
            totalMembers,
        };
    }, [members, user?.uid, today]);

    if (loading) {
        return (
            <ScrollView
                ref={scrollViewRef}
                style={[styles.container, { backgroundColor: colors.background }]}
                contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <LoadingView size={40} />
            </ScrollView>
        );
    }

    const sortedMembers = members
        .filter(m => m.lastReadDate === today)
        .sort((a, b) => (b.streak || 0) - (a.streak || 0));

    const groupStreak: number = groupData?.groupStreak || 0;
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

            <Animated.ScrollView
                ref={scrollViewRef}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.header, { paddingBottom: Spacing.sm }]}>
                    <View style={styles.headerLeft}>
                        <Avatar id={groupId} name={groupData?.name} url={groupData?.photoURL} size={40} radius={12} />
                        <View style={styles.titleContainer}>
                            <Text style={[styles.title, { color: colors.textPrimary }]}>{groupData?.name || 'Loading...'}</Text>
                        </View>
                    </View>
                    {isAdmin && (
                        <ScalePressable onPress={() => setIsEditModalVisible(true)}>
                            <Ionicons name="ellipsis-horizontal-circle-outline" size={24} color={colors.textSecondary} />
                        </ScalePressable>
                    )}
                </View>

                {/* ── Members who read today ── */}
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                            {memberSectionTitle} THAT READ TODAY.
                        </Text>
                    </View>
                </View>

                {sortedMembers.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberList}>
                        {sortedMembers.map((member) => (
                            <ScalePressable
                                key={member.id}
                                style={styles.memberItem}
                                onPress={() => setSelectedMember(member)}
                                activeOpacity={0.75}
                            >
                                <View style={styles.avatarContainer}>
                                    <Avatar
                                        id={member.userId || member.id}
                                        name={member.displayName}
                                        url={member.photoURL}
                                        size={52}
                                        borderWidth={1.25}
                                        borderColor={colors.indicatorActive}
                                        style={{
                                            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
                                        }}
                                    />
                                </View>
                                <Text style={[styles.memberName, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {member.displayName}
                                </Text>
                            </ScalePressable>
                        ))}
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

                {/* ── Tabs ── */}
                <View style={styles.tabContainer}>
                    <View style={styles.tabBackground}>
                        <Animated.View style={[styles.tabIndicator, { backgroundColor: colors.accent, width: '33.33%' }, animatedIndicatorStyle]} />
                        {(['feed', 'accountability', 'members'] as const).map((tab) => {
                            const label = tab === 'feed' ? 'Updates' : tab === 'accountability' ? 'Progress' : 'Circle';
                            return (
                                <ScalePressable key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
                                    <Text style={[
                                        styles.tabText, { color: colors.textSecondary },
                                        activeTab === tab && { color: colors.textPrimary, fontWeight: '600' },
                                    ]}>
                                        {label}
                                    </Text>
                                </ScalePressable>
                            );
                        })}
                    </View>
                </View>

                {/* ── Feed Tab ── */}
                {activeTab === 'feed' && (
                    <>
                        <View style={[styles.sectionHeader, { marginTop: Spacing.md }]}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>WHAT'S BEEN HAPPENING</Text>
                        </View>

                        {pinnedMilestone && (() => {
                            const timeStr = formatRelativeTime(pinnedMilestone.timestamp);
                            return (
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
                                        {formatBadgeDesc(members, pinnedMilestone.badgeDesc, pinnedMilestone.userId)}
                                    </Text>
                                    {timeStr && (
                                        <Text style={[styles.milestoneHeroTime, { color: colors.textTertiary }]}>{timeStr}</Text>
                                    )}
                                </View>
                            );
                        })()}

                        <View style={styles.feedChainContainer}>
                            <View style={[styles.feedChainLine, { backgroundColor: colors.border }]} />
                            {feedItems.length > 0 ? feedItems.map((item: FeedItem) => {

                                if (item.type === 'separator') {
                                    return (
                                        <View key={item.id} style={styles.dateSeparator}>
                                            <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
                                            <Text style={[styles.dateSeparatorLabel, { color: colors.textTertiary, backgroundColor: colors.background }]}>
                                                {item.label}
                                            </Text>
                                            <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
                                        </View>
                                    );
                                }

                                if (item.type === 'reading_digest') {
                                    const digest = item as ReadingDigest;
                                    const isExpanded = expandedDigests.has(digest.id);
                                    const nameStr = digest.extraCount > 0
                                        ? `${digest.names.join(', ')} +${digest.extraCount} more`
                                        : digest.names.join(' & ');

                                    const toggleDigest = () => {
                                        setExpandedDigests(prev => {
                                            const next = new Set(prev);
                                            if (next.has(digest.id)) next.delete(digest.id);
                                            else next.add(digest.id);
                                            return next;
                                        });
                                    };

                                    return (
                                        <View key={digest.id} style={styles.digestCard}>
                                            <ScalePressable style={styles.digestHeader} onPress={toggleDigest}>
                                                <View style={[styles.digestIconWrap, { backgroundColor: colors.accentSecondaryLight + '40' }]}>
                                                    <Ionicons name="journal-outline" size={20} color={colors.accent} />
                                                </View>
                                                <View style={styles.digestContent}>
                                                    <Text style={[styles.digestLine, { color: colors.textPrimary }]}>{nameStr}</Text>
                                                    <Text style={[styles.digestSub, { color: colors.textSecondary }]}>
                                                        {digest.entries.length} people read · {formatRelativeTime(digest.timestamp)}
                                                    </Text>
                                                </View>
                                                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
                                            </ScalePressable>

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
                                                            <Avatar id={entry.userId} name={entry.userName} url={members.find(m => m.userId === entry.userId)?.photoURL} size={28} radius={4} />
                                                            <View style={styles.digestEntryText}>
                                                                <Text style={[styles.digestEntryName, { color: colors.textPrimary }]}>{entry.userName}</Text>
                                                                <Text style={[styles.digestEntrySub, { color: colors.textTertiary }]}>{entry.bookName} {entry.chapters}</Text>
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
                                        <Avatar id={activity.userId} name={activity.userName} url={members.find(m => m.userId === activity.userId)?.photoURL} size={44} />
                                        <View style={styles.activityContent}>
                                            <View style={styles.activityHeader}>
                                                <Text style={[styles.userName, { color: colors.textPrimary }]}>
                                                    {isAbsent ? `Where is ${activity.userName}? 🥹`
                                                        : isJoined ? `Hi, ${activity.userName} 🤭`
                                                            : activity.userName}
                                                </Text>
                                                <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                                                    {timeStr ?? 'Syncing…'}
                                                </Text>
                                            </View>

                                            {isMilestone && (
                                                <View style={styles.milestoneRow}>
                                                    <Text style={[styles.activityText, { color: colors.textSecondary, flex: 1 }]}>
                                                        {formatBadgeDesc(members, activity.badgeDesc, activity.userId)}
                                                    </Text>
                                                </View>
                                            )}
                                            {isJournalEntry && (
                                                <>
                                                    <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                                                        read {activity.bookName} {activity.chapters}
                                                    </Text>
                                                    {activity.preview && (
                                                        <Text style={[styles.reflectionPreview, { color: colors.textTertiary, borderLeftColor: colors.accentSecondaryLight }]}>
                                                            "{activity.preview}"
                                                        </Text>
                                                    )}
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
                                                        ? `${getPronoun(members, activity.userId, 'subject').charAt(0).toUpperCase() + getPronoun(members, activity.userId, 'subject').slice(1)} has been away for a month. We miss ${getPronoun(members, activity.userId, 'possessive')} insights! 🫂`
                                                        : `We haven't seen ${getPronoun(members, activity.userId, 'object')} in a week. Drop a message to encourage ${getPronoun(members, activity.userId, 'object')}!`}
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
                                                        isJournalEntry || isSharedReflection ? colors.accentSecondary
                                                            : isJoined ? colors.indicatorActive
                                                                : isAbsent ? colors.accent
                                                                    : colors.textTertiary
                                                    }
                                                />
                                            )}
                                        </View>
                                    </View>
                                );
                            }) : (
                                <View style={styles.emptyFeed}>
                                    <Ionicons name={isOffline ? 'cloud-offline-outline' : 'sunny-outline'} size={28} color={colors.textTertiary} />
                                    <Text style={[styles.emptyFeedText, { color: colors.textTertiary }]}>
                                        {isOffline ? 'Feed unavailable offline. Check back when connected.' : 'No activity yet. Be the first!'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </>
                )}

                {/* ── Progress Tab ── */}
                {activeTab === 'accountability' && (
                    <View style={{ marginTop: Spacing.md }}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>WHAT YOUR PEERS DO</Text>
                        </View>

                        <View style={[styles.accountabilityHero, { backgroundColor: colors.accentSecondaryLight + '20', borderColor: colors.accentSecondaryLight + '40' }]}>
                            <View style={styles.heroTop}>
                                <View style={styles.heroMain}>
                                    <View style={styles.heroValRow}>
                                        <Text style={[styles.heroVal, { color: colors.accentSecondary }]}>
                                            {accountabilityData.readTodayCount} / {accountabilityData.totalMembers}
                                        </Text>
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
                                    ? 'A good day! Everyone is up to date. 🎉'
                                    : `Encourage the remaining ${accountabilityData.totalMembers - accountabilityData.readTodayCount}`}
                            </Text>
                        </View>

                        {accountabilityData.upToDate.length > 0 && (
                            <View style={styles.accountabilitySection}>
                                <View style={styles.subHeader}>
                                    <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                                    <Text style={[styles.subHeaderText, { color: colors.textSecondary }]}>
                                        UP TO DATE — {accountabilityData.upToDate.length}
                                    </Text>
                                </View>
                                {accountabilityData.upToDate.map((member) => (
                                    <AccountabilityMemberCard
                                        key={member.id}
                                        member={member}
                                        colors={colors}
                                        styles={styles}
                                        onPress={() => setSelectedMember(member)}
                                    />
                                ))}
                            </View>
                        )}

                        {accountabilityData.needsSupport.length > 0 && (
                            <View style={[styles.accountabilitySection, { marginTop: Spacing.xl }]}>
                                <View style={styles.subHeader}>
                                    <Ionicons name="alert-circle" size={16} color={colors.accent} />
                                    <Text style={[styles.subHeaderText, { color: colors.textSecondary }]}>
                                        NEEDS GINGERING — {accountabilityData.needsSupport.length}
                                    </Text>
                                </View>
                                {accountabilityData.needsSupport.map((member) => (
                                    <AccountabilityMemberCard
                                        key={member.id}
                                        member={member}
                                        colors={colors}
                                        styles={styles}
                                        onPress={() => setSelectedMember(member)}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* ── Circle Tab ── */}
                {activeTab === 'members' && (
                    <View style={{ marginTop: Spacing.md }}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DISTINGUISHED {memberSectionTitle}</Text>
                        </View>
                        {accountabilityData.membersByConsistency.map((member) => (
                            <ScalePressable
                                key={member.id}
                                style={styles.memberListItem}
                                onPress={() => setSelectedMember(member)}
                            >
                                <Avatar id={member.userId || member.id} name={member.displayName} url={member.photoURL} size={52} radius={16} />
                                <View style={styles.memberItemContent}>
                                    <Text style={[styles.memberItemName, { color: colors.textPrimary }]}>
                                        {member.displayName}{member.isMe ? ' (You)' : ''}
                                    </Text>
                                    <Text style={[styles.memberItemJoined, { color: colors.textTertiary }]}>
                                        {member.joinedAt
                                            ? `Joined ${new Date(member.joinedAt.toDate ? member.joinedAt.toDate() : member.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
                                            : 'Member'}
                                    </Text>
                                </View>
                                {member.role === 'admin' && (
                                    <View style={[styles.adminBadge, { backgroundColor: colors.accentSecondaryLight + '30' }]}>
                                        <Text style={[styles.adminBadgeText, { color: colors.accentSecondary }]}>ADMIN</Text>
                                    </View>
                                )}
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </ScalePressable>
                        ))}
                    </View>
                )}

            </Animated.ScrollView>

            {/* Group Edit Modal */}
            <GroupEditModal
                visible={isEditModalVisible}
                groupData={groupData}
                groupId={groupId}
                onClose={() => setIsEditModalVisible(false)}
                colors={colors}
            />

            {selectedMember && (
                <MemberProfileSheet
                    groupId={groupId}
                    member={selectedMember}
                    onClose={() => setSelectedMember(null)}
                    colors={colors}
                    today={today}
                    isMe={selectedMember.userId === user?.uid || selectedMember.id === user?.uid}
                    members={members}
                    activities={activities}
                />
            )}
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg, paddingHorizontal: 4 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    titleContainer: { gap: 2 },
    title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    offlineBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.xs, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md,
    },
    offlineBannerText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.medium, letterSpacing: 0.3 },
    scrollContent: { padding: Spacing.layout.screenPadding, paddingTop: Spacing.sm, paddingBottom: 100 },
    sectionHeader: { marginTop: Spacing.lg, marginBottom: Spacing.md },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.sm },
    sectionTitle: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, letterSpacing: 2, opacity: 0.6 },
    memberList: { marginBottom: Spacing.xl },
    memberItem: { alignItems: 'center', marginRight: Spacing.lg, width: 60, paddingBottom: Spacing.sm },
    avatarContainer: { position: 'relative', marginBottom: Spacing.xs },
    memberAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
    memberInitial: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
    memberName: { fontSize: Typography.size.xs, textAlign: 'center', fontFamily: Typography.fontFamily.medium },
    activityCard: {
        flexDirection: 'row', paddingVertical: Spacing.md,
        paddingLeft: 10, paddingRight: Spacing.md,
        marginBottom: Spacing.lg, alignItems: 'flex-start', gap: Spacing.md, position: 'relative',
    },
    feedChainContainer: { position: 'relative' },
    feedChainLine: { position: 'absolute', left: 32, top: 0, bottom: 0, width: 2, opacity: 0.5 },
    activityContent: { flex: 1, gap: 4 },
    activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    userName: { fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, letterSpacing: -0.2 },
    timestamp: { fontSize: Typography.size.xs, opacity: 0.8 },
    activityText: { fontSize: Typography.size.sm, lineHeight: 22 },
    reflectionPreview: { fontSize: Typography.size.sm, lineHeight: 20, fontStyle: 'italic', marginTop: Spacing.xs, paddingLeft: Spacing.sm, borderLeftWidth: 2 },
    activityIcon: { marginLeft: Spacing.xs, paddingTop: 4, flexShrink: 0 },
    milestoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, marginTop: 2, flexWrap: 'wrap' },
    emptyFeed: { paddingVertical: Spacing.xxl * 2, alignItems: 'center', gap: Spacing.md },
    emptyFeedText: { fontSize: Typography.size.sm, fontStyle: 'italic', textAlign: 'center' },
    dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md, gap: Spacing.sm },
    dateSeparatorLine: { flex: 1, height: 1, opacity: 0.4 },
    dateSeparatorLabel: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, letterSpacing: 0.5, paddingHorizontal: Spacing.xs },
    digestCard: {
        marginBottom: Spacing.lg, overflow: 'hidden',
        backgroundColor: colors.backgroundElevated + '40',
        borderRadius: Spacing.borderRadius.md, borderWidth: 1, borderColor: colors.borderSubtle + '80',
    },
    digestHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingLeft: 12, paddingRight: Spacing.lg, gap: Spacing.md },
    digestIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    digestContent: { flex: 1, gap: 3 },
    digestLine: { fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, letterSpacing: -0.2 },
    digestSub: { fontSize: Typography.size.xs, opacity: 0.8 },
    digestEntries: { borderTopWidth: 1 },
    digestEntry: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md, gap: Spacing.sm, marginHorizontal: Spacing.xs },
    digestEntryText: { flex: 1, gap: 1 },
    digestEntryName: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
    digestEntrySub: { fontSize: Typography.size.sm },
    milestoneHero: { borderRadius: 20, padding: Spacing.xl, marginBottom: Spacing.xl, gap: Spacing.md, borderWidth: 1.5 },
    milestoneHeroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    milestoneHeroBadge: { fontSize: 48 },
    milestoneHeroConfetti: { flex: 1 },
    milestoneHeroLabel: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, letterSpacing: -0.5 },
    milestoneHeroDesc: { fontSize: Typography.size.md, lineHeight: 24, fontWeight: Typography.weight.medium },
    milestoneHeroTime: { fontSize: Typography.size.xs, marginTop: 4, fontWeight: Typography.weight.semibold, opacity: 0.6 },
    tabContainer: { marginBottom: Spacing.lg },
    tabBackground: { flexDirection: 'row', backgroundColor: 'transparent', position: 'relative', borderBottomWidth: 0.5, borderColor: colors.border },
    tabIndicator: { position: 'absolute', bottom: 0, height: 2.5, borderRadius: 2 },
    tab: { flex: 1, paddingVertical: 14, alignItems: 'center', zIndex: 1 },
    tabText: { fontSize: 15, fontWeight: '400', letterSpacing: 0.2 },
    memberListItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, backgroundColor: colors.cardBackground, borderRadius: 16, marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.borderSubtle + '40', gap: Spacing.md },
    memberItemContent: { flex: 1, gap: 2 },
    memberItemName: { fontSize: 15, fontWeight: '600' },
    memberItemJoined: { fontSize: 12, opacity: 0.7 },
    adminBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 4 },
    adminBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
    accountabilityHero: { borderRadius: 20, padding: Spacing.xl, marginBottom: Spacing.xl, borderWidth: 1, gap: Spacing.md },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    heroMain: { gap: 2 },
    heroValRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    editButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
    heroVal: { fontSize: 42, fontWeight: '900', letterSpacing: -1 },
    heroLabel: { fontSize: Typography.size.sm, fontWeight: '600' },
    heroStats: { gap: Spacing.sm },
    miniStat: { alignItems: 'flex-end', gap: 1 },
    miniStatVal: { fontSize: 13, fontWeight: '700' },
    miniStatLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 4 },
    heroHint: { fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
    accountabilitySection: { gap: Spacing.md },
    subHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
    subHeaderText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    accMemberCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
    accMemberContent: { flex: 1, gap: 4 },
    accMemberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusTags: { flexDirection: 'row', gap: 4 },
    tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    tagText: { color: 'white', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },
    accMemberName: { fontSize: 14, fontWeight: '600' },
    accMemberStreak: { fontSize: 13, fontWeight: '700' },
    accMemberSubRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    accMemberSubtitle: { fontSize: 11, fontWeight: '500' },
    accNudge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    accNudgeText: { fontSize: 10, fontWeight: '600' },
    gingerText: { fontSize: 10, fontWeight: '600', fontStyle: 'italic' },
    miniHeatmap: { flexDirection: 'row', gap: 3 },
    miniDot: { width: 8, height: 8, borderRadius: 2 },
});