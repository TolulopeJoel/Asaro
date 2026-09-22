import React, { useMemo } from 'react';
import {
    View,
    StyleSheet,
    Modal,
    Pressable,
    Dimensions,
    DeviceEventEmitter,
    TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    X,
    BookOpen,
    ChevronUp,
    ChevronDown,
    MessageCircle,
    NotebookPen,
    UserPlus,
    Moon,
    LogOut,
    Award,
    CheckCircle2,
    Sun,
    Info,
    MoreHorizontal,
    CloudOff,
} from 'lucide-react-native';
import { getFirestore, collection, doc, onSnapshot, updateDoc, query, where, orderBy, limit } from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { checkInactiveMembers, getISOWeekString, evaluateGroupAdminRoles } from '@/src/utils/syncActivities';
import { getTodayDateString } from '@/src/utils/dateUtils';
import { ALL_BADGES } from '@/src/utils/badges';
import { useEffect, useRef, useState } from 'react';
import Animated, {
    useSharedValue, useAnimatedStyle, withSpring, withTiming,
    runOnJS,
} from 'react-native-reanimated';
import { ChevronLeft } from 'lucide-react-native';
import { ScalePressable } from '@/src/components/ScalePressable';
import { LoadingView } from '@/src/components/LoadingView';
import { Skeleton } from '@/src/components/Skeleton';
import { Button } from '@/src/components/Button';
import { HyperlinkedText } from '@/src/components/HyperlinkedText';
import { Avatar } from '@/src/components/Avatar';
import { Hero, Screen, Segments, Text } from '@/src/components/ui';



const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

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



// ─── Accountability Member Card ───────────────────────────────────────────────

/**
 * One member's week, in Colossal.
 *
 * design/all-screens.html #group draws it as a `.co-row`: a circle, the name,
 * one line about how they read, and when they last did. The mockup's line is a
 * reading-pace description the app has never stored, so the row says what the
 * app actually knows — the streak and the days covered this week.
 */
const ColossalMemberRow = ({ member, colors, onPress }: { member: any; colors: any; onPress: () => void }) => {
    const when = member.readToday ? 'Today' : member.daysThisWeek > 0 ? 'This week' : 'Never';
    const detail = member.streak > 0
        ? `${member.streak}-day streak · ${member.daysThisWeek} of 7 this week`
        : member.daysThisWeek > 0
            ? `${member.daysThisWeek} of 7 this week`
            : 'No entries yet';

    return (
        <ScalePressable
            onPress={onPress}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.md,
                paddingVertical: Spacing.md + 3,
                borderBottomWidth: Spacing.border.hairline,
                borderBottomColor: colors.border,
            }}
        >
            <Avatar id={member.userId || member.id} name={member.displayName} url={member.photoURL} size={38} radius={19} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="reference">{member.displayName}{member.isMe ? ' (You)' : ''}</Text>
                <Text variant="bodySmall" style={{ marginTop: 3 }}>{detail}</Text>
            </View>
            <Text variant="meta" tone={member.readToday ? 'accent' : 'tertiary'}>{when}</Text>
        </ScalePressable>
    );
};

/**
 * One member's status, in Cloth.
 *
 * design/all-screens.html #group, `.cl-row`: an avatar, the name in the serif,
 * and a single `.cl-snip` line folding the read status and how long ago into
 * one sentence — there is no separate right-aligned column the way Colossal's
 * `.co-when` gives it. `formatLastRead` already produces the mockup's exact
 * "Read today 😌" / "Never read" strings from the one field every member
 * carries (`lastReadDate`); the mockup's reading-pace clause ("Usually reads
 * in the evening") is sample copy for data this app has never recorded, so
 * this substitutes the one real thing available instead — how much of the
 * week they've covered.
 */
const ClothMemberRow = ({ member, colors, today, onPress }: { member: any; colors: any; today: string; onPress: () => void }) => {
    const status = formatLastRead(member.lastReadDate, today);
    const snippet = status !== 'Never read' && member.daysThisWeek > 0
        ? `${status} · ${member.daysThisWeek} of 7 this week`
        : status;

    return (
        <ScalePressable
            onPress={onPress}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.md + 2,
                paddingVertical: Spacing.lg - 1,
                borderBottomWidth: Spacing.border.hairline,
                borderBottomColor: colors.border,
            }}
        >
            <Avatar id={member.userId || member.id} name={member.displayName} url={member.photoURL} size={38} radius={19} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="reference">{member.displayName}{member.isMe ? ' (You)' : ''}</Text>
                <Text variant="bodySmall" tone="secondary" style={{ marginTop: 4 }}>{snippet}</Text>
            </View>
        </ScalePressable>
    );
};

/**
 * One line of the group's activity, in Colossal.
 *
 * The Cloth feed is a chain of illustrated cards; Colossal keeps the same
 * information as `.co-row` — who, what, when — because a monochrome column of
 * icon badges reads as noise rather than as a timeline.
 */
const ColossalFeedRow = ({ item, colors, members }: { item: FeedItem; colors: any; members: any[] }) => {
    if (item.type === 'separator') {
        return <Text variant="label" style={{ paddingTop: Spacing.xl, paddingBottom: Spacing.md }}>{item.label}</Text>;
    }

    const when = formatRelativeTime(item.timestamp);

    if (item.type === 'reading_digest') {
        const names = item.extraCount > 0
            ? `${item.names.join(', ')} +${item.extraCount} more`
            : item.names.join(' & ');
        return (
            <View style={{ paddingVertical: Spacing.md + 3, borderBottomWidth: Spacing.border.hairline, borderBottomColor: colors.border }}>
                <Text variant="reference">{names}</Text>
                <Text variant="bodySmall" style={{ marginTop: 3 }}>
                    {`${item.entries.length} ${item.entries.length === 1 ? 'person' : 'people'} read`}
                </Text>
                {when ? <Text variant="meta" style={{ marginTop: 6 }}>{when}</Text> : null}
            </View>
        );
    }

    const what =
        item.type === 'journal_entry' ? `read ${item.bookName ?? ''} ${item.chapters ?? ''}`.trim()
        : item.type === 'reflection_shared' ? 'shared a reflection'
        : item.type === 'member_joined' ? 'joined the circle'
        : item.type === 'member_removed' ? 'has left'
        : item.type === 'admin_promoted' ? 'earned admin status'
        : item.type === 'member_absent' ? 'has been away'
        : item.badgeLabel ? String(item.badgeLabel).toLowerCase()
        : 'was active';

    return (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Spacing.md, paddingVertical: Spacing.md + 3, borderBottomWidth: Spacing.border.hairline, borderBottomColor: colors.border }}>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="reference">{item.userName || 'Someone'}</Text>
                <Text variant="bodySmall" style={{ marginTop: 3 }}>{what}</Text>
            </View>
            {when ? <Text variant="meta">{when}</Text> : null}
        </View>
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
    const db = getFirestore();

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
            await updateDoc(doc(db, 'groups', groupId), {
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
                <View style={{ backgroundColor: colors.background, borderRadius: Spacing.borderRadius.lg, padding: Spacing.xl, gap: Spacing.lg }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
                        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 }}>Edit Group Deets</Text>
                        <ScalePressable onPress={onClose}>
                            <X size={24} color={colors.textSecondary} />
                        </ScalePressable>
                    </View>

                    <View style={{ gap: Spacing.xs }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 }}>NAME</Text>
                        <TextInput
                            style={{ backgroundColor: colors.buttonSecondary, padding: 16, borderRadius: Spacing.borderRadius.lg, color: colors.textPrimary, fontSize: Typography.size.lg }}
                            value={name}
                            onChangeText={setName}
                            placeholder="Group Name"
                            placeholderTextColor={colors.textTertiary}
                        />
                    </View>

                    <View style={{ gap: Spacing.xs }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 }}>DESCRIPTION</Text>
                        <TextInput
                            style={{ backgroundColor: colors.buttonSecondary, padding: 16, borderRadius: Spacing.borderRadius.lg, color: colors.textPrimary, fontSize: Typography.size.lg, minHeight: 80 }}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Write whatever is on your mind"
                            placeholderTextColor={colors.textTertiary}
                            multiline
                        />
                    </View>

                    <View style={{ gap: Spacing.xs }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 }}>PHOTO URL</Text>
                        <TextInput
                            style={{ backgroundColor: colors.buttonSecondary, padding: 16, borderRadius: Spacing.borderRadius.lg, color: colors.textPrimary, fontSize: Typography.size.lg }}
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
                    <ScalePressable
                        onPress={onClose}
                        style={{
                            paddingVertical: 12,
                            borderRadius: Spacing.borderRadius.lg,
                            width: '100%',
                            alignItems: 'center',
                            backgroundColor: colors.backgroundSubtle,
                        }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
                    </ScalePressable>
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
        const db = getFirestore();
        const baseRef = collection(db, 'groups', groupId, 'activities');

        const qReads = query(
            baseRef,
            where('userId', '==', memberId),
            where('type', '==', 'journal_entry'),
            orderBy('timestamp', 'desc'),
            limit(30)
        );

        const unsubReads = onSnapshot(
            qReads,
            (snapshot: any) => {
                setPastReads(snapshot.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() })));
                setLoadingReads(false);
            },
            (error) => {
                console.error('[MemberProfileSheet] Error fetching past reads:', error);
                setLoadingReads(false);
            }
        );

        const qReflections = query(
            baseRef,
            where('userId', '==', memberId),
            where('type', '==', 'reflection_shared'),
            orderBy('timestamp', 'desc'),
            limit(30)
        );

        const unsubReflections = onSnapshot(
            qReflections,
            (snapshot: any) => {
                setSharedReflections(snapshot.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() })));
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
                                            <HyperlinkedText style={[sheetStyles.reflectionText, { color: colors.textPrimary }]} text={item.sharedReflectionText || item.preview} />
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
    handleBar: { width: 40, height: 4, borderRadius: Spacing.borderRadius.sm },
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
    insightEmoji: { fontSize: Typography.size.lg },
    insightLabel: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
        flex: 1, lineHeight: 20,
    },
    // Heatmap
    section: { marginBottom: Spacing.xl, gap: Spacing.md },
    sectionTitle: { opacity: 0.6 },
    heatmapRow: { flexDirection: 'row', justifyContent: 'space-between' },
    heatmapCell: { alignItems: 'center', gap: 5, flex: 1 },
    heatmapDot: { width: 28, height: 28, borderRadius: Spacing.borderRadius.lg },
    heatmapLabel: { fontSize: Typography.size.xs, fontWeight: Typography.weight.medium },
    // Badges
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    badgeItem: {
        width: '30%', alignItems: 'center', padding: Spacing.sm,
        borderRadius: Spacing.borderRadius.md, borderWidth: 1, gap: Spacing.xs,
    },
    badgeEmoji: { fontSize: 26 },
    badgeLabel: { fontSize: 10, textAlign: 'center', fontWeight: Typography.weight.semibold, letterSpacing: 0.2 },
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
    const { colors, isLockedIn } = useTheme();
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

    const styles = useMemo(() => getStyles(colors), [colors]);

    const pendingCount = React.useRef(3);
    const markResolved = React.useCallback(() => {
        pendingCount.current -= 1;
        if (pendingCount.current === 0) setLoading(false);
    }, []);

    React.useEffect(() => {
        if (!groupId) return;

        const db = getFirestore();
        const unsubscribeGroup = onSnapshot(
            doc(db, 'groups', groupId),
            (docSnap: any) => {
                setIsOffline(false);
                setGroupData(docSnap.data() || null);
                markResolved();
                if (docSnap.exists()) {
                    checkInactiveMembers(groupId);
                    evaluateGroupAdminRoles(groupId);
                }
            },
            (error: any) => {
                console.error('[GroupDetail] group snapshot error:', error);
                setIsOffline(true);
                markResolved();
            }
        );

        const qActivities = query(
            collection(db, 'groups', groupId, 'activities'),
            orderBy('timestamp', 'desc'),
            limit(30)
        );
        const unsubscribeActivities = onSnapshot(
            qActivities,
            (querySnapshot: any) => {
                const feed = querySnapshot.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() }));
                setActivities(feed);
                markResolved();
            },
            (error: any) => {
                console.error('[GroupDetail] activities snapshot error:', error);
                markResolved();
            }
        );

        const unsubscribeMembers = onSnapshot(
            collection(db, 'groups', groupId, 'members'),
            (querySnapshot: any) => {
                setMembers(querySnapshot.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() })));
                markResolved();
            },
            (error: any) => {
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
            iHaveRead: processed.find(m => m.isMe)?.readToday || false,
        };
    }, [members, user?.uid, today]);

    // We no longer return early for loading, to keep the UI stable.
    const isLoading = loading;

    const { pinnedMilestone, feedItems } = buildProcessedFeed(activities, today);

    if (isLockedIn) {
        /*
         * design/all-screens.html #group, the `.co` slot.
         *
         * How many have read today is the colossal element, and the filters
         * come straight after it. The horizontal strip of faces Cloth shows
         * above the tabs is dropped: it says the same thing the giant already
         * says, and the style allows one colossal element, not one plus a
         * decorative restatement of it.
         */
        return (
            <Screen>
                <View style={styles.colossalTop}>
                    <ScalePressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back to groups"
                        hitSlop={Spacing.md}
                        style={styles.backArrow}
                    >
                        <ChevronLeft size={20} color={colors.textTertiary} strokeWidth={2} />
                    </ScalePressable>
                    <Text variant="tab" numberOfLines={1} style={{ flex: 1 }}>
                        {groupData?.name || 'Loading…'}
                    </Text>
                    <ScalePressable
                        onPress={() => router.push('/(tabs)/groups/about' as any)}
                        accessibilityRole="button"
                        accessibilityLabel="How groups work"
                        hitSlop={Spacing.md}
                    >
                        <Info size={18} color={colors.textTertiary} />
                    </ScalePressable>
                    {isAdmin && (
                        <ScalePressable
                            onPress={() => setIsEditModalVisible(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Group settings"
                            hitSlop={Spacing.md}
                        >
                            <MoreHorizontal size={18} color={colors.textTertiary} />
                        </ScalePressable>
                    )}
                </View>

                <View style={styles.colossalCount}>
                    <Text variant="hero">{accountabilityData.readTodayCount}</Text>
                    <Text variant="label" style={styles.giantLabel}>
                        {`of ${accountabilityData.totalMembers} read today`}
                    </Text>
                </View>

                <View style={styles.colossalSegs}>
                    <Segments
                        items={[
                            { key: 'accountability', label: 'Progress' },
                            { key: 'feed', label: 'Updates' },
                            { key: 'members', label: 'Members' },
                        ]}
                        value={activeTab}
                        onChange={key => setActiveTab(key as typeof activeTab)}
                    />
                </View>

                {isOffline && (
                    <Text variant="label" tone="secondary" style={styles.colossalNotice}>
                        Offline — showing cached data
                    </Text>
                )}

                <Animated.ScrollView
                    ref={scrollViewRef}
                    contentContainerStyle={styles.colossalScroll}
                    showsVerticalScrollIndicator={false}
                >
                    {activeTab === 'accountability' && (
                        <>
                            {accountabilityData.upToDate.concat(accountabilityData.needsSupport).map(member => (
                                <ColossalMemberRow
                                    key={member.id}
                                    member={member}
                                    colors={colors}
                                    onPress={() => setSelectedMember(member)}
                                />
                            ))}
                            {accountabilityData.totalMembers === 0 && (
                                <Text variant="sub">No members yet.</Text>
                            )}
                        </>
                    )}

                    {/*
                      * design/all-screens.html #group: the Members segment
                      * lists the WHOLE circle, including people who have never
                      * read ("Femi … Never"). This used to reuse a list
                      * filtered to today's readers, which silently dropped
                      * anyone who hadn't read today.
                      * `accountabilityData.membersByConsistency` already
                      * computes readToday/streak/daysThisWeek for everyone.
                      */}
                    {activeTab === 'members' && accountabilityData.membersByConsistency.map(member => (
                        <ColossalMemberRow
                            key={member.id}
                            member={member}
                            colors={colors}
                            onPress={() => setSelectedMember(member)}
                        />
                    ))}

                    {activeTab === 'feed' && (
                        feedItems.length > 0 ? (
                            feedItems.map((item: FeedItem) => (
                                <ColossalFeedRow key={item.id} item={item} colors={colors} members={members} />
                            ))
                        ) : (
                            <Text variant="sub">
                                {isOffline ? 'Feed unavailable offline.' : 'No activity yet. Be the first!'}
                            </Text>
                        )
                    )}
                </Animated.ScrollView>

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

                <GroupEditModal
                    visible={isEditModalVisible}
                    groupData={groupData}
                    groupId={groupId}
                    onClose={() => setIsEditModalVisible(false)}
                    colors={colors}
                />
            </Screen>
        );
    }

    return (
        <Screen edges={[]}>
            {/*
              * design/all-screens.html #group, the `.cl` slot: `.cl-top`
              * carries a bare back arrow, then `.cl-htitle` (margin-top:10)
              * and `.cl-hsub` state the group and how many have read today.
              * No avatar in the band — Colossal's own `.co-top` for this
              * screen carries none either, so Info/MoreHorizontal (real
              * functionality neither mockup draws explicitly, kept here for
              * the same reason the FAB stays on Home) sit alongside the back
              * arrow rather than beside a group photo.
              */}
            <Hero ownsTopInset>
                <View style={styles.clothTopRow}>
                    <ScalePressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back to groups"
                        hitSlop={Spacing.md}
                        style={styles.backArrow}
                    >
                        <ChevronLeft size={20} color={colors.accent} strokeWidth={1.9} />
                    </ScalePressable>
                    <View style={{ flex: 1 }} />
                    <ScalePressable
                        onPress={() => router.push('/(tabs)/groups/about' as any)}
                        accessibilityRole="button"
                        accessibilityLabel="How groups work"
                        hitSlop={Spacing.md}
                    >
                        <Info size={19} color={colors.accent} />
                    </ScalePressable>
                    {isAdmin && (
                        <ScalePressable
                            onPress={() => setIsEditModalVisible(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Group settings"
                            hitSlop={Spacing.md}
                            style={styles.clothEditButton}
                        >
                            <MoreHorizontal size={19} color={colors.accent} />
                        </ScalePressable>
                    )}
                </View>
                <Text variant="display" tone="onBand" numberOfLines={2} style={styles.clothGroupTitle}>
                    {groupData?.name || 'Loading…'}
                </Text>
                {!isLoading && (
                    <Text variant="sub" tone="onHero" style={styles.clothGroupSub}>
                        {`${accountabilityData.totalMembers} ${accountabilityData.totalMembers === 1 ? 'member' : 'members'} · ${accountabilityData.readTodayCount} read today`}
                    </Text>
                )}
            </Hero>

            {isOffline && (
                <View style={[styles.offlineBanner, { backgroundColor: colors.border }]}>
                    <CloudOff size={14} color={colors.textSecondary} />
                    <Text variant="label" tone="secondary">
                        You're offline — showing cached data
                    </Text>
                </View>
            )}

            <Animated.ScrollView
                ref={scrollViewRef}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/*
                  * design/all-screens.html #group, the `.cl` slot:
                  * `.cl-segs{Progress, Updates, Members}`, in that order — no
                  * horizontal avatar strip above it. Colossal's own comment on
                  * this screen already explains why: the strip restates what
                  * the tab content itself lists, and "one colossal element,
                  * not one plus a decorative repeat of it" is the rule Cloth
                  * follows too, even without a colossal slot of its own to
                  * protect. The old tab strip also mislabeled Members as
                  * "Circle" and ran the segments feed-first instead of
                  * Progress-first.
                  */}
                <Segments
                    items={[
                        { key: 'accountability', label: 'Progress' },
                        { key: 'feed', label: 'Updates' },
                        { key: 'members', label: 'Members' },
                    ]}
                    value={activeTab}
                    onChange={key => setActiveTab(key as typeof activeTab)}
                />

                {/* ── Feed Tab ── */}
                {activeTab === 'feed' && (
                    <>
                        <View style={[styles.sectionHeader, { marginTop: Spacing.md }]}>
                            <Text variant="label" tone="secondary" style={styles.sectionTitle}>WHAT'S BEEN HAPPENING</Text>
                        </View>

                        {pinnedMilestone && (() => {
                            const timeStr = formatRelativeTime(pinnedMilestone.timestamp);
                            return (
                                <View style={[styles.milestoneHero, { borderColor: colors.accent, backgroundColor: colors.accent + '10' }]}>
                                    <View style={styles.milestoneHeroTop}>
                                        <Text style={styles.milestoneHeroBadge}>{pinnedMilestone.badgeEmoji}</Text>
                                        <View style={styles.milestoneHeroConfetti}>
                                            <Text variant="title" tone="accent">
                                                {pinnedMilestone.badgeLabel.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text variant="body" tone="secondary">
                                        {formatBadgeDesc(members, pinnedMilestone.badgeDesc, pinnedMilestone.userId)}
                                    </Text>
                                    {timeStr && (
                                        <Text variant="caption" style={styles.milestoneHeroTime}>{timeStr}</Text>
                                    )}
                                </View>
                            );
                        })()}

                        <View style={styles.feedChainContainer}>
                            <View style={[styles.feedChainLine, { backgroundColor: colors.border }]} />
                            {isLoading ? (
                                // ── Feed Skeleton ──
                                [1, 2, 3].map(i => (
                                    <View key={i} style={[styles.activityCard, { opacity: 0.5 }]}>
                                        <Skeleton circle height={44} width={44} />
                                        <View style={styles.activityContent}>
                                            <View style={styles.activityHeader}>
                                                <Skeleton width="40%" height={16} borderRadius={4} />
                                                <Skeleton width="20%" height={12} borderRadius={4} />
                                            </View>
                                            <View style={{ height: 6 }} />
                                            <Skeleton width="80%" height={14} borderRadius={4} />
                                        </View>
                                    </View>
                                ))
                            ) : feedItems.length > 0 ? feedItems.map((item: FeedItem) => {

                                if (item.type === 'separator') {
                                    return (
                                        <View key={item.id} style={styles.dateSeparator}>
                                            <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
                                            <Text variant="label" tone="tertiary" style={{ backgroundColor: colors.background }}>
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
                                                    <BookOpen size={20} color={colors.accent} />
                                                </View>
                                                <View style={styles.digestContent}>
                                                    <Text variant="bodySmall">{nameStr}</Text>
                                                    <Text variant="caption" style={styles.digestSub}>
                                                        {digest.entries.length} people read · {formatRelativeTime(digest.timestamp)}
                                                    </Text>
                                                </View>
                                                <View style={styles.digestIconWrap}>
                                                    {isExpanded ? (
                                                        <ChevronUp size={18} color={colors.textTertiary} />
                                                    ) : (
                                                        <ChevronDown size={18} color={colors.textTertiary} />
                                                    )}
                                                </View>
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
                                                                <Text variant="bodySmall">{entry.userName}</Text>
                                                                <Text variant="bodySmall" tone="tertiary">{entry.bookName} {entry.chapters}</Text>
                                                            </View>
                                                            <Text variant="caption" style={styles.timestamp}>
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
                                const isAdminPromoted = activity.type === 'admin_promoted';

                                return (
                                    <View key={activity.id} style={styles.activityCard}>
                                        <Avatar id={activity.userId} name={activity.userName} url={members.find(m => m.userId === activity.userId)?.photoURL} size={44} />
                                        <View style={styles.activityContent}>
                                            <View style={styles.activityHeader}>
                                                <Text variant="bodySmall">
                                                    {isAbsent ? `Where is ${activity.userName}? 🥹`
                                                        : isJoined ? `Hi, ${activity.userName} 🤭`
                                                            : activity.userName}
                                                </Text>
                                                <Text variant="caption" style={styles.timestamp}>
                                                    {timeStr ?? 'Syncing…'}
                                                </Text>
                                            </View>

                                            {isMilestone && (
                                                <View style={styles.milestoneRow}>
                                                    <Text variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
                                                        {formatBadgeDesc(members, activity.badgeDesc, activity.userId)}
                                                    </Text>
                                                </View>
                                            )}
                                            {isJournalEntry && (
                                                <>
                                                    <Text variant="bodySmall" tone="secondary">
                                                        read {activity.bookName} {activity.chapters}
                                                    </Text>
                                                    {activity.preview && (
                                                        <HyperlinkedText
                                                            style={[styles.reflectionPreview, { color: colors.textTertiary, borderLeftColor: colors.accentSecondaryLight }]}
                                                            numberOfLines={2}
                                                            text={`"${activity.preview}"`}
                                                        />
                                                    )}
                                                </>
                                            )}
                                            {isSharedReflection && (
                                                <>
                                                    <Text variant="bodySmall" tone="secondary">
                                                        shared a reflection from {activity.bookName} {activity.chapters}
                                                    </Text>
                                                    <View style={{ marginTop: Spacing.sm, marginRight: -32, padding: Spacing.md, backgroundColor: colors.accentSecondaryLight + '15', borderRadius: Spacing.borderRadius.lg, borderWidth: 1, borderColor: colors.accentSecondaryLight + '30' }}>
                                                        {activity.sharedQuestionTitle && (
                                                            <Text style={{ fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: colors.accent, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                                {activity.sharedQuestionTitle}
                                                            </Text>
                                                        )}
                                                        <HyperlinkedText
                                                            style={{ fontSize: Typography.size.sm, color: colors.textPrimary, lineHeight: 20 }}
                                                            text={activity.sharedReflectionText || activity.preview}
                                                        />
                                                    </View>
                                                </>
                                            )}
                                            {isJoined && (
                                                <Text variant="bodySmall" tone="secondary">
                                                    Welcome! Let's grow together. 🎉
                                                </Text>
                                            )}
                                            {isAbsent && (
                                                <Text variant="bodySmall" tone="secondary">
                                                    {activity.threshold === 30
                                                        ? `${getPronoun(members, activity.userId, 'subject').charAt(0).toUpperCase() + getPronoun(members, activity.userId, 'subject').slice(1)} has been away for a month. We miss ${getPronoun(members, activity.userId, 'possessive')} insights! 🫂`
                                                        : `We haven't seen ${getPronoun(members, activity.userId, 'object')} in a week. Drop a message to encourage ${getPronoun(members, activity.userId, 'object')}!`}
                                                </Text>
                                            )}
                                            {isRemoved && (
                                                <Text variant="quote" tone="tertiary">
                                                    has left us.
                                                </Text>
                                            )}
                                            {isAdminPromoted && (
                                                <Text variant="bodySmall" tone="secondary">
                                                    earned admin status for {activity.monthName}! 👑
                                                </Text>
                                            )}
                                        </View>
                                        <View style={styles.activityIcon}>
                                            {isMilestone ? (
                                                <Text style={{ fontSize: Typography.size.lg, marginTop: -2 }}>{activity.badgeEmoji}</Text>
                                            ) : (
                                                isJournalEntry ? (
                                                    <NotebookPen size={20} color={colors.accentSecondary} fill={colors.accentSecondary + '20'} />
                                                ) : isSharedReflection ? (
                                                    <MessageCircle size={20} color={colors.accentSecondary} fill={colors.accentSecondary + '20'} />
                                                ) : isJoined ? (
                                                    <UserPlus size={20} color={colors.indicatorActive} fill={colors.indicatorActive + '20'} />
                                                ) : isAbsent ? (
                                                    <Moon size={20} color={colors.accent} fill={colors.accent + '20'} />
                                                ) : isRemoved ? (
                                                    <LogOut size={20} color={colors.textTertiary} fill={colors.textTertiary + '20'} />
                                                ) : isAdminPromoted ? (
                                                    <Award size={20} color={colors.accentSecondary} fill={colors.accentSecondary + '20'} />
                                                ) : (
                                                    <CheckCircle2 size={20} color={colors.textTertiary} fill={colors.textTertiary + '20'} />
                                                )
                                            )}
                                        </View>
                                    </View>
                                );
                            }) : (
                                <View style={styles.emptyFeed}>
                                    {isOffline ? (
                                        <CloudOff size={28} color={colors.textTertiary} />
                                    ) : (
                                        <Sun size={28} color={colors.textTertiary} />
                                    )}
                                    <Text variant="quote" tone="tertiary" style={styles.emptyFeedText}>
                                        {isOffline ? 'Feed unavailable offline. Check back when connected.' : 'No activity yet. Be the first!'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </>
                )}

                {/*
                  * design/all-screens.html #group, the `.cl` slot: Progress is
                  * a flat run of `.cl-row`s — no hero card, no progress bar,
                  * no "UP TO DATE" / "NEEDS GINGERING" split. Every member
                  * appears once, read-today first, same shape as Members.
                  */}
                {activeTab === 'accountability' && (
                    <View style={{ marginTop: Spacing.md }}>
                        {accountabilityData.upToDate.concat(accountabilityData.needsSupport).map((member) => (
                            <ClothMemberRow
                                key={member.id}
                                member={member}
                                colors={colors}
                                today={today}
                                onPress={() => setSelectedMember(member)}
                            />
                        ))}
                        {accountabilityData.totalMembers === 0 && (
                            <Text variant="sub">No members yet.</Text>
                        )}
                    </View>
                )}

                {/*
                  * design/all-screens.html #group, the `.cl` slot: Members is
                  * the same flat `.cl-row` list as Progress — no admin badges,
                  * no "joined" dates, no separate info link. Both tabs list
                  * the whole circle; only the status line differs per row.
                  */}
                {activeTab === 'members' && (
                    <View style={{ marginTop: Spacing.md }}>
                        {accountabilityData.membersByConsistency.map((member) => (
                            <ClothMemberRow
                                key={member.id}
                                member={member}
                                colors={colors}
                                today={today}
                                onPress={() => setSelectedMember(member)}
                            />
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
        </Screen>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (colors: any) => StyleSheet.create({
    // ── Colossal ──────────────────────────────────────────────────────────
    colossalTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.lg,
    },
    backArrow: { marginLeft: -6 },
    colossalCount: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.xl + 2,
    },
    giantLabel: { marginTop: 10 },
    colossalSegs: { paddingTop: Spacing.xl - 2 },
    colossalNotice: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.md,
    },
    colossalScroll: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingBottom: Spacing.xxl,
    },

    /** `.cl-top` — a bare back arrow, matching Colossal's own top row. */
    clothTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    clothEditButton: { marginLeft: Spacing.md },
    /** `.cl-htitle{margin-top:10px}` on this screen. */
    clothGroupTitle: { marginTop: 10 },
    /** `.cl-hsub{margin:8px 0 0}` */
    clothGroupSub: { marginTop: Spacing.sm },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    heroTitle: { flex: 1, minWidth: 0 },
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg, paddingHorizontal: 4 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    titleContainer: { gap: 2 },
    offlineBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.xs, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md,
    },
    scrollContent: { padding: Spacing.layout.screenPadding, paddingTop: Spacing.sm, paddingBottom: Spacing.xxl },
    sectionHeader: { marginTop: Spacing.lg, marginBottom: Spacing.md },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.sm },
    sectionTitle: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, letterSpacing: 2, opacity: 0.6 },
    memberList: { marginBottom: Spacing.xl },
    memberItem: { alignItems: 'center', marginRight: Spacing.lg, width: 60, paddingBottom: Spacing.sm },
    avatarContainer: { position: 'relative', marginBottom: Spacing.xs },
    memberAvatar: { width: 52, height: 52, borderRadius: Spacing.borderRadius.round, justifyContent: 'center', alignItems: 'center' },
    memberInitial: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
    memberName: { textAlign: 'center' },
    activityCard: {
        flexDirection: 'row', paddingVertical: Spacing.md,
        paddingLeft: 10, paddingRight: Spacing.md,
        marginBottom: Spacing.lg, alignItems: 'flex-start', gap: Spacing.md, position: 'relative',
    },
    feedChainContainer: { position: 'relative' },
    feedChainLine: { position: 'absolute', left: 32, top: 0, bottom: 0, width: 2, opacity: 0.5 },
    activityContent: { flex: 1, gap: 4 },
    activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    timestamp: { opacity: 0.8 },
    reflectionPreview: { fontSize: Typography.size.sm, lineHeight: 20, fontStyle: 'italic', marginTop: Spacing.xs, paddingLeft: Spacing.sm, borderLeftWidth: 2 },
    activityIcon: { marginLeft: Spacing.xs, paddingTop: 4, flexShrink: 0 },
    milestoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, marginTop: 2, flexWrap: 'wrap' },
    emptyFeed: { paddingVertical: Spacing.xxl * 2, alignItems: 'center', gap: Spacing.md },
    emptyFeedText: { textAlign: 'center' },
    dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md, gap: Spacing.sm },
    dateSeparatorLine: { flex: 1, height: 1, opacity: 0.4 },
    dateSeparatorLabel: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, letterSpacing: 0.5, paddingHorizontal: Spacing.xs },
    digestCard: {
        marginBottom: Spacing.lg, overflow: 'hidden',
        backgroundColor: colors.backgroundElevated + '40',
        borderRadius: Spacing.borderRadius.md, borderWidth: 1, borderColor: colors.borderSubtle + '80',
    },
    digestHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingLeft: 12, paddingRight: Spacing.lg, gap: Spacing.md },
    digestIconWrap: { width: 44, height: 44, borderRadius: Spacing.borderRadius.lg, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    digestContent: { flex: 1, gap: 3 },
    digestSub: { opacity: 0.8 },
    digestEntries: { borderTopWidth: 1 },
    digestEntry: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md, gap: Spacing.sm, marginHorizontal: Spacing.xs },
    digestEntryText: { flex: 1, gap: 1 },
    milestoneHero: { borderRadius: Spacing.borderRadius.lg, padding: Spacing.xl, marginBottom: Spacing.xl, gap: Spacing.md, borderWidth: 1.5 },
    milestoneHeroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    milestoneHeroBadge: { fontSize: Typography.size.xxxl, lineHeight: Typography.lineHeight.xxxl },
    milestoneHeroConfetti: { flex: 1 },
    milestoneHeroTime: { marginTop: 4, opacity: 0.6 },
    tabContainer: { marginBottom: Spacing.lg },
    tabBackground: { flexDirection: 'row', backgroundColor: 'transparent', position: 'relative', borderBottomWidth: 0.5, borderColor: colors.border },
    tabIndicator: { position: 'absolute', bottom: 0, height: 2.5, borderRadius: Spacing.borderRadius.sm },
    tab: { flex: 1, paddingVertical: 14, alignItems: 'center', zIndex: 1 },
    tabText: { fontSize: 14, fontWeight: '400', letterSpacing: 0.2 },
    memberListItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, backgroundColor: colors.cardBackground, borderRadius: Spacing.borderRadius.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.borderSubtle + '40', gap: Spacing.md },
    memberItemContent: { flex: 1, gap: 2 },
    memberItemJoined: { opacity: 0.7 },
    adminBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Spacing.borderRadius.md, marginRight: 4 },
    accountabilityHero: { borderRadius: Spacing.borderRadius.lg, padding: Spacing.xl, marginBottom: Spacing.xl, borderWidth: 1, gap: Spacing.md },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    heroMain: { gap: 2 },
    heroValRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    infoButton: { padding: 8, borderRadius: Spacing.borderRadius.lg },
    editButton: { padding: 8, borderRadius: Spacing.borderRadius.lg, backgroundColor: 'rgba(255,255,255,0.1)' },
    heroStats: { gap: Spacing.sm },
    miniStat: { alignItems: 'flex-end', gap: 1 },
    progressTrack: { height: 8, borderRadius: Spacing.borderRadius.round, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: Spacing.borderRadius.md },
    accountabilitySection: { gap: Spacing.md },
    subHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
    accMemberCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
    accMemberContent: { flex: 1, gap: 4 },
    accMemberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusTags: { flexDirection: 'row', gap: 4 },
    tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Spacing.borderRadius.md },
    tagText: { color: 'white', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
    accMemberSubRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    accNudge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Spacing.borderRadius.md },
    accNudgeText: { fontSize: 10, fontWeight: '600' },
    miniHeatmap: { flexDirection: 'row', gap: 3 },
    miniDot: { width: 8, height: 8, borderRadius: Spacing.borderRadius.sm },
    infoLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        borderRadius: Spacing.borderRadius.lg,
        marginTop: Spacing.xl,
        marginHorizontal: 4,
        marginBottom: Spacing.xxl,
    },
    infoLinkContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    infoIconWrap: {
        width: 36,
        height: 36,
        borderRadius: Spacing.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoLinkSubtitle: { opacity: 0.8 },
});