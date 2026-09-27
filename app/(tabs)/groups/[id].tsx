/**
 * One group. design/groups-mockup.html #group-week and #group-sunday.
 *
 * Outside the open window: your own week, the group's reads counted together,
 * and the members by name. In the window: each person's week, and who read.
 * Roles are never shown as tags; tapping a member is how they are managed.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Share as RNShare, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/src/storage/storageKeys';
import { ChevronLeft, MoreHorizontal } from 'lucide-react-native';

import { useTheme } from '@/src/theme/ThemeContext';
import { useAlert } from '@/src/context/AlertContext';
import { useAuth } from '@/src/context/AuthContext';
import { Spacing } from '@/src/theme/spacing';
import { useLocalDay } from '@/src/hooks/useLocalDay';
import { useFootPadding } from '@/src/hooks/useScreenInsets';
import { formatRange } from '@/src/utils/reference';
import { QUESTION_LABELS, QUESTION_COUNT, isQuestionId } from '@/src/data/questions';
import { daysRead, feedByMember, parseLocalDateTime } from '@/src/groups/derive';
import { useGroup, useGroupWeek } from '@/src/groups/hooks';
import { Group, Member, Role } from '@/src/groups/model';
import { hasNudged, leaveGroup, regenerateCode, removeMember, sendNudge, setRole } from '@/src/groups/repository';
import { weekdayIndex } from '@/src/groups/week';
import { Avatar } from '@/src/components/Avatar';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Skeleton } from '@/src/components/Skeleton';
import { ActionSheet, SheetAction } from '@/src/components/groups/ActionSheet';
import { BringSheet } from '@/src/components/groups/BringSheet';
import { EditGroupSheet } from '@/src/components/groups/EditGroupSheet';
import { ClothMark, Hero, Row, Screen, Segments, Text, ThemedButton } from '@/src/components/ui';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** `.wk`: seven panels, read days filled, today hatched. */
function WeekCells({ days, today }: { days: boolean[]; today: number }) {
    const { colors } = useTheme();
    return (
        <View style={styles.week} accessibilityLabel={`Read ${days.filter(Boolean).length} days this week`}>
            {DAY_LETTERS.map((letter, i) => {
                const read = days[i] && i !== today;
                return (
                    <View key={i} style={[styles.weekDay, { backgroundColor: read ? colors.textPrimary : colors.backgroundSubtle }]}>
                        {i === today && <ClothMark />}
                        <Text
                            variant="tab"
                            style={{ color: read ? colors.textInverse : i === today ? colors.textPrimary : colors.textSecondary }}
                        >
                            {letter}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

/** A member's row: avatar, name, a line under it, and Nudge / Nudged on the right. */
function MemberRow({ member, line, isMe, nudge, onPress }: {
    member: Member;
    line?: string;
    isMe: boolean;
    /** Absent when no Nudge belongs on this row. */
    nudge?: { sent: boolean; onPress: () => void };
    onPress?: () => void;
}) {
    return (
        <ScalePressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
            <Row style={styles.memberRow}>
                <Avatar id={member.uid} name={member.displayName} size={38} radius={19} />
                <View style={styles.rowMain}>
                    <Text variant="reference">{member.displayName}</Text>
                    {!!line && <Text variant="bodySmall" style={styles.snip}>{line}</Text>}
                </View>
                {isMe ? (
                    <Text variant="meta" tone="secondary">You</Text>
                ) : nudge && (
                    <ScalePressable
                        onPress={nudge.onPress}
                        disabled={nudge.sent}
                        hitSlop={Spacing.md}
                        accessibilityRole="button"
                        accessibilityLabel={nudge.sent ? `${member.displayName} has been nudged this week` : `Nudge ${member.displayName}`}
                    >
                        <Text variant="meta" tone={nudge.sent ? 'secondary' : 'accent'}>{nudge.sent ? 'Nudged' : 'Nudge'}</Text>
                    </ScalePressable>
                )}
            </Row>
        </ScalePressable>
    );
}

export default function GroupScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const gid = typeof id === 'string' ? id : undefined;
    const router = useRouter();
    const { colors } = useTheme();
    const { showAlert } = useAlert();
    const { user } = useAuth();
    const uid = user?.uid;
    const footPadding = useFootPadding();
    const day = useLocalDay();
    const today = weekdayIndex(parseLocalDateTime(day) ?? new Date());

    const g = useGroup(gid);
    const week = useGroupWeek(g.group);
    const [tab, setTab] = useState<'week' | 'members'>('week');
    const [nudged, setNudged] = useState<Set<string>>(new Set());
    const [sheetFor, setSheetFor] = useState<Member | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [bringing, setBringing] = useState(false);
    const [introSeen, setIntroSeen] = useState(true);

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEYS.GROUP_INTRO_SEEN)
            .then(v => setIntroSeen(v === '1'))
            .catch(() => {});
    }, []);
    const dismissIntro = useCallback(() => {
        setIntroSeen(true);
        AsyncStorage.setItem(STORAGE_KEYS.GROUP_INTRO_SEEN, '1').catch(() => {});
    }, []);

    const memberKey = g.members.map(m => m.uid).join(',');
    useEffect(() => {
        let cancelled = false;
        const uids = memberKey ? memberKey.split(',') : [];
        Promise.all(uids.map(async u => ((await hasNudged(u)) ? u : null))).then(sent => {
            if (!cancelled) setNudged(new Set(sent.filter((u): u is string => !!u)));
        });
        return () => { cancelled = true; };
    }, [memberKey, day]);

    const nudge = useCallback(async (member: Member) => {
        if (!gid) return;
        setNudged(prev => new Set(prev).add(member.uid));
        try {
            await sendNudge(gid, member.uid);
        } catch (error) {
            console.error('[groups] nudge failed:', error);
            setNudged(prev => {
                const next = new Set(prev);
                next.delete(member.uid);
                return next;
            });
            showAlert({ title: 'Not sent', message: 'That nudge didn’t go through. Try again in a moment.' });
        }
    }, [gid, showAlert]);

    const nudgeFor = (member: Member) => ({ sent: nudged.has(member.uid), onPress: () => { void nudge(member); } });

    const fail = (error: unknown) => {
        console.error('[groups] action failed:', error);
        showAlert({ title: 'That didn’t go through', message: 'Check your connection and try again.' });
    };

    // ─── Managing members, without tags ───────────────────────────────────────

    const memberActions = (target: Member): SheetAction[] => {
        if (!gid || target.uid === uid) return [];
        const remove: SheetAction = {
            label: 'Remove from group',
            destructive: true,
            onPress: () => showAlert({
                title: `Remove ${target.displayName}?`,
                message: 'They leave the group and can only come back with the code.',
                buttons: [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => { removeMember(gid, target.uid).catch(fail); } },
                ],
            }),
        };
        if (g.myRole === 'creator') {
            const toggle: Role = target.role === 'admin' ? 'member' : 'admin';
            return [
                {
                    label: target.role === 'admin' ? 'Remove admin' : 'Make admin',
                    onPress: () => { setRole(gid, target.uid, toggle).catch(fail); },
                },
                {
                    label: 'Hand over as creator',
                    onPress: () => showAlert({
                        title: `Hand the group to ${target.displayName}?`,
                        message: 'They will run it from now on. You stay on as an admin.',
                        buttons: [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Hand it over', onPress: () => { setRole(gid, target.uid, 'creator').catch(fail); } },
                        ],
                    }),
                },
                remove,
            ];
        }
        if (g.myRole === 'admin' && target.role !== 'creator') return [remove];
        return [];
    };

    const openMember = (member: Member) => (memberActions(member).length ? () => setSheetFor(member) : undefined);

    // ─── The group menu ───────────────────────────────────────────────────────

    const shareCode = (group: Group, code = group.code) => {
        void RNShare.share({ message: `Join "${group.name}" on Àṣàrò. The group code is ${code}.` });
    };

    const leave = () => {
        if (!gid) return;
        const others = g.members.filter(m => m.uid !== uid).length;
        if (g.myRole === 'creator' && others > 0) {
            showAlert({
                title: 'Hand the group over first',
                message: 'Tap a member and choose Hand over as creator. Then you can leave.',
            });
            return;
        }
        const last = g.myRole === 'creator';
        showAlert({
            title: last ? 'Leave and close the group?' : 'Leave this group?',
            message: last
                ? 'You are the last one here, so leaving deletes the group and its code.'
                : 'What you shared here goes with you.',
            buttons: [
                { text: 'Stay', style: 'cancel' },
                {
                    text: last ? 'Leave and close' : 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await leaveGroup(gid);
                            if (result.status === 'hand-over') {
                                showAlert({ title: 'Hand the group over first', message: 'Someone else is still here. Tap them and choose Hand over as creator.' });
                            } else if (result.status === 'offline') {
                                showAlert({ title: 'You’re offline', message: 'Leaving needs a connection. Try again once you’re back online.' });
                            } else {
                                router.replace('/(tabs)/groups' as any);
                            }
                        } catch (error) {
                            fail(error);
                        }
                    },
                },
            ],
        });
    };

    const newCode = () => {
        if (!gid || !g.group) return;
        const group = g.group;
        showAlert({
            title: 'Make a new code?',
            message: 'The old code stops working. Everyone already in stays in.',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Make a new one',
                    onPress: async () => {
                        try {
                            const result = await regenerateCode(gid);
                            if (result.status === 'done') {
                                showAlert({
                                    title: result.code,
                                    message: 'This is the group’s code now.',
                                    buttons: [
                                        { text: 'Done', style: 'cancel' },
                                        { text: 'Share it', onPress: () => shareCode(group, result.code) },
                                    ],
                                });
                            } else if (result.status === 'offline') {
                                showAlert({ title: 'You’re offline', message: 'A new code needs a connection.' });
                            }
                        } catch (error) {
                            fail(error);
                        }
                    },
                },
            ],
        });
    };

    const menuActions: SheetAction[] = g.group ? [
        ...(g.myRole === 'creator' || g.myRole === 'admin' ? [
            { label: 'Edit the group', onPress: () => setEditing(true) },
            { label: 'Make a new code', onPress: newCode },
        ] : []),
        { label: 'Share the code', onPress: () => shareCode(g.group!) },
        { label: 'Leave group', destructive: true, onPress: leave },
    ] : [];

    // ─── The week ─────────────────────────────────────────────────────────────

    const feed = week.open && week.weekKey ? feedByMember(g.members, week, week.weekKey) : [];
    const shown = feed.filter(p => p.readings.length || p.share || p.practices.length || p.milestones.length);
    const myShare = week.shares.find(s => s.userId === uid) ?? null;

    if (g.missing) {
        return (
            <Screen edges={[]}>
                <Hero ownsTopInset>
                    <Back onPress={() => router.back()} color={colors.accent} />
                    <Text variant="display" tone="onBand" style={styles.title}>Not here any more</Text>
                </Hero>
                <View style={styles.body}>
                    <Text variant="sub">This group was closed, or you’re no longer in it.</Text>
                    <ThemedButton label="Back to my groups" onPress={() => router.replace('/(tabs)/groups' as any)} />
                </View>
            </Screen>
        );
    }

    const count = g.members.length;
    const heroSub = !g.window ? '' : week.open
        ? `${plural(count, 'member', 'members')} · ${plural(g.readsThisWeek, 'read', 'reads')} this week`
        : `${plural(count, 'member', 'members')} · ${lowerFirst(week.label || g.window.label)}`;

    return (
        <Screen edges={[]}>
            <Hero ownsTopInset>
                <View style={styles.top}>
                    <Back onPress={() => router.back()} color={colors.accent} />
                    {g.group && (
                        <ScalePressable
                            onPress={() => setMenuOpen(true)}
                            hitSlop={Spacing.md}
                            accessibilityRole="button"
                            accessibilityLabel="Group options"
                        >
                            <MoreHorizontal size={19} color={colors.accent} />
                        </ScalePressable>
                    )}
                </View>
                <Text variant="display" tone="onBand" numberOfLines={2} style={styles.title}>
                    {g.group?.name ?? ' '}
                </Text>
                {!!heroSub && <Text variant="sub" tone="onHero" style={styles.heroSub}>{heroSub}</Text>}
            </Hero>

            {week.open && (
                <Segments
                    items={[{ key: 'week', label: 'This week' }, { key: 'members', label: 'Members' }]}
                    value={tab}
                    onChange={key => setTab(key as 'week' | 'members')}
                />
            )}

            <ScrollView contentContainerStyle={[styles.body, { paddingBottom: footPadding }]} showsVerticalScrollIndicator={false}>
                {!introSeen && !g.loading && (
                    <View style={[styles.intro, { backgroundColor: colors.backgroundSubtle }]}>
                        <Text variant="body">
                            Here, your reflections stay yours. Each week you can bring one answer to share, and everyone sees each other’s week on Sunday.
                        </Text>
                        <ScalePressable onPress={dismissIntro} accessibilityRole="button" hitSlop={Spacing.sm} style={styles.introDismiss}>
                            <Text variant="meta" tone="accent">Got it</Text>
                        </ScalePressable>
                    </View>
                )}
                {g.loading ? (
                    <View style={styles.skeleton}>
                        <Skeleton width="100%" height={44} borderRadius={0} />
                        <Skeleton width="100%" height={72} borderRadius={0} />
                        <Skeleton width="60%" height={20} borderRadius={0} />
                    </View>
                ) : !week.open ? (
                    <>
                        <View>
                            <Text variant="label" style={styles.label}>Your week</Text>
                            <WeekCells days={g.myDays} today={today} />
                            <Text variant="bodySmall" style={styles.weekNote}>
                                The group opens on Sunday. Until then, the week is yours.
                            </Text>
                        </View>
                        <View style={[styles.stat, { backgroundColor: colors.backgroundSubtle }]}>
                            <Text variant="hero">{g.readsThisWeek}</Text>
                            <Text variant="caption" style={styles.statLabel}>Reads together this week</Text>
                        </View>
                        <View>
                            <Text variant="label" style={styles.label}>Members</Text>
                            {g.members.map(member => (
                                <MemberRow
                                    key={member.uid}
                                    member={member}
                                    isMe={member.uid === uid}
                                    nudge={nudgeFor(member)}
                                    onPress={openMember(member)}
                                />
                            ))}
                        </View>
                    </>
                ) : tab === 'week' ? (
                    <>
                        {!myShare && (
                            <View style={[styles.bring, { backgroundColor: colors.backgroundSubtle }]}>
                                <Text variant="body" style={styles.flex}>Bring one thing from your week.</Text>
                                <ThemedButton label="Choose" variant="accent" onPress={() => setBringing(true)} />
                            </View>
                        )}
                        {week.loading ? (
                            <Skeleton width="100%" height={96} borderRadius={0} />
                        ) : shown.length === 0 ? (
                            <Text variant="sub">Nobody has anything this week yet.</Text>
                        ) : shown.map(person => (
                            <Row key={person.member.uid} style={styles.person}>
                                <View style={styles.personHead}>
                                    <Avatar id={person.member.uid} name={person.member.displayName} size={38} radius={19} />
                                    <Text variant="reference">{person.member.displayName}</Text>
                                </View>
                                {person.readings.length > 0 && (
                                    <Text variant="bodySmall" style={styles.line}>
                                        {person.readings.map((r, i) => (
                                            <React.Fragment key={r.id}>
                                                {i > 0 ? '   ' : ''}
                                                <Text variant="button" tone="primary">{formatRange(`${r.bookName} ${r.chapters}`.trim())}</Text>
                                                {` · ${r.answered} of ${QUESTION_COUNT}`}
                                            </React.Fragment>
                                        ))}
                                    </Text>
                                )}
                                {person.share && (
                                    <View style={[styles.share, { borderLeftColor: colors.accent }]}>
                                        <Text variant="meta" tone="secondary" style={styles.tag}>
                                            {[isQuestionId(person.share.questionId) ? QUESTION_LABELS[person.share.questionId] : '', person.share.passage]
                                                .filter(Boolean).join(' · ')}
                                        </Text>
                                        <Text variant="quote">{person.share.text}</Text>
                                        {person.member.uid === uid && (
                                            <ScalePressable onPress={() => setBringing(true)} accessibilityRole="button" hitSlop={Spacing.sm} style={styles.change}>
                                                <Text variant="meta" tone="accent">Change or take back</Text>
                                            </ScalePressable>
                                        )}
                                    </View>
                                )}
                                {person.practices.map(p => (
                                    <Text key={p.id} variant="bodySmall" style={styles.line}>
                                        {`${p.action} · kept ${p.keptDays.filter(Boolean).length} of 7`}
                                    </Text>
                                ))}
                                {person.milestones.map(m => (
                                    <Text key={m.id} variant="button" tone="accent" style={styles.line}>{m.label}</Text>
                                ))}
                            </Row>
                        ))}
                    </>
                ) : (
                    <View>
                        {feed.map(person => {
                            const n = daysRead(person);
                            const isMe = person.member.uid === uid;
                            return (
                                <MemberRow
                                    key={person.member.uid}
                                    member={person.member}
                                    line={n > 0 ? `Read ${plural(n, 'day', 'days')} this week` : 'Didn’t read this week'}
                                    isMe={isMe}
                                    nudge={n === 0 ? nudgeFor(person.member) : undefined}
                                    onPress={openMember(person.member)}
                                />
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            <ActionSheet
                visible={!!sheetFor}
                title={sheetFor?.displayName ?? ''}
                actions={sheetFor ? memberActions(sheetFor) : []}
                onClose={() => setSheetFor(null)}
            />
            <ActionSheet
                visible={menuOpen}
                title={g.group?.name ?? ''}
                sub={g.group ? `Code ${g.group.code}` : undefined}
                actions={menuActions}
                onClose={() => setMenuOpen(false)}
            />
            {g.group && (
                <EditGroupSheet visible={editing} group={g.group} onClose={() => setEditing(false)} />
            )}
            {g.group && week.weekKey && (
                <BringSheet
                    visible={bringing}
                    groupId={g.group.id}
                    groupName={g.group.name}
                    weekKey={week.weekKey}
                    current={myShare}
                    onClose={() => setBringing(false)}
                />
            )}
        </Screen>
    );
}

function Back({ onPress, color }: { onPress: () => void; color: string }) {
    return (
        <ScalePressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Back" hitSlop={Spacing.md} style={styles.back}>
            <ChevronLeft size={20} color={color} strokeWidth={1.9} />
        </ScalePressable>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    back: { marginLeft: -6 },
    /** `.cl-htitle{margin-top:10px}` */
    title: { marginTop: 10 },
    heroSub: { marginTop: Spacing.sm },
    /** `.cl-body{padding:22px 24px 0; gap:18px}` */
    body: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.layout.cardPadding + 4,
        gap: Spacing.layout.cardPadding,
    },
    skeleton: { gap: Spacing.lg },
    label: { marginBottom: 9 },
    week: { flexDirection: 'row', gap: 5 },
    weekDay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, overflow: 'hidden' },
    /** `.cl-panel.cl-stat{justify-content:space-between}` */
    stat: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 9,
        padding: Spacing.layout.cardPadding,
    },
    /** `.cl-statl` is the caption role in caps. */
    statLabel: { flexShrink: 1, textAlign: 'right', textTransform: 'uppercase' },
    memberRow: { alignItems: 'center', paddingVertical: Spacing.md },
    rowMain: { flex: 1, minWidth: 0 },
    snip: { marginTop: 4 },
    intro: { padding: Spacing.layout.cardPadding, gap: Spacing.sm },
    introDismiss: { alignSelf: 'flex-end' },
    weekNote: { marginTop: 10 },
    bring: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md + 2, padding: Spacing.layout.cardPadding },
    person: { flexDirection: 'column', alignItems: 'stretch', gap: 0 },
    personHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md + 2 },
    line: { marginTop: 10 },
    share: { borderLeftWidth: Spacing.border.strong, paddingLeft: Spacing.md, marginTop: Spacing.md },
    tag: { marginBottom: 5 },
    change: { marginTop: Spacing.sm, alignSelf: 'flex-start' },
});
