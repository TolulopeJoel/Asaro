/**
 * The walk around the whole app after the practice entry. The user does the
 * using: the screen dims except one real element, the chosen sibling says what
 * to do with it, and the walk waits until they have (the screen they tapped
 * into has opened, the tree has opened, the tick is in). Where a real tap
 * would change something real, the element is only explained and the tap is
 * held. Screens show example content while it runs (src/onboarding/demo.ts).
 * It ends back on Home, sending them off to do their real first reading. No
 * skip, by decision.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { useAsaroLook } from '../../storage/asaroLook';
import {
    measureTarget, onCoachEvent, revealTarget, waitForTarget,
    type CoachEvent, type CoachTarget, type Rect,
} from '../../onboarding/coachTargets';
import { endTour, setTourStop, useTour } from '../../onboarding/tour';
import { setFirstRun } from '../../onboarding/firstRun';
import { DEMO_GROUP_ID } from '../../onboarding/demo';
import { PRACTICE_BOOK, PRACTICE_CHAPTERS } from '../../onboarding/practiceEntry';
import { ScalePressable } from '../ScalePressable';
import { Text, ThemedButton, type AsaroAction } from '../ui';
import { CoachLine } from './CoachLine';

/** How a stop moves on. `got` is an explanation; everything else waits for the user. */
type Then =
    | { got: true }
    | { path: string }
    | { shows: CoachTarget }
    | { event: CoachEvent }
    | { end: true };

interface Stop { target: CoachTarget | null; action: AsaroAction; line: string; then: Then }

function stops(other: string): Stop[] {
    return [
        // Home
        { target: 'reading', action: 'point', then: { got: true }, line: 'This is today’s reading. Read it in your Bible first. Then Begin reflection, and we do what we just practised.' },
        { target: 'add', action: 'nod', then: { got: true }, line: 'Read something that isn’t on the plan? The + writes about anything, any day.' },
        { target: 'home-today', action: 'point', then: { event: 'today-kept' }, line: 'What you said you’d do waits here each day. Done it? Tap the circle to tick it off. Go on.' },
        { target: 'home-observation', action: 'think', then: { got: true }, line: 'After a few weeks I start noticing things across your entries. When I do, it shows up here. Not often.' },
        { target: 'week', action: 'smug', then: { path: '/stats' }, line: 'Your week. Every day you reflect fills one. Tap it.' },

        // Stats
        { target: 'stats-tiles', action: 'nod', then: { got: true }, line: 'Your record. This one is an example so you can see it full. Yours starts today.' },
        { target: 'stats-calendar', action: 'point', then: { got: true }, line: 'Every day you wrote, month by month. The gaps show too. I don’t hide them.' },
        { target: 'stats-grove', action: 'smug', then: { shows: 'stats-rooted' }, line: 'Every practice you keep grows a tree. Tap one.' },
        { target: 'stats-rooted', action: 'think', then: { got: true }, line: 'This is how rooted it is: how much it has become part of you. Keep it and it roots deeper. Miss it and it goes thirsty, but it waits.' },
        { target: 'back-stats', action: 'nod', then: { path: '/' }, line: 'Now back. Tap the arrow.' },

        // The land
        { target: 'progress', action: 'point', then: { path: '/land' }, line: 'How far you’ve gone through the whole Bible. Tap it.' },
        { target: 'land-field', action: 'nod', then: { got: true }, line: 'Your land, Genesis to Revelation. Every chapter you write about gets worked. Leave it and it goes quiet, but it’s never taken away.' },
        { target: 'land-tree', action: 'point', then: { shows: 'land-card' }, line: 'Your trees are planted on the chapter they came from. Tap that one.' },
        { target: 'land-card', action: 'smug', then: { got: true }, line: 'This one grew out of Genesis 1. Tap any tree, any time, to see how it’s doing.' },
        { target: 'back-land', action: 'nod', then: { path: '/' }, line: 'Back to Home.' },

        // Settings: every row here does real work, so they are shown, not tapped.
        { target: 'settings', action: 'point', then: { path: '/settings' }, line: 'Your settings. Tap it.' },
        { target: 'settings-sleep', action: 'nod', then: { got: true }, line: 'Your sleep time. My last reminder comes an hour before it. You can change it once a month.' },
        { target: 'settings-look', action: 'sideEye', then: { got: true }, line: `And this is me. If you ever want my ${other} instead… it’s here. Don’t try it.` },
        { target: 'settings-backup', action: 'think', then: { got: true }, line: 'Your entries live on this phone. Share a backup now and then, so a lost phone never takes them.' },
        { target: 'back-settings', action: 'nod', then: { path: '/' }, line: 'Back.' },

        // Library
        { target: 'tab-library', action: 'point', then: { path: '/library' }, line: 'Everything you write ends up in your Library. Tap it.' },
        { target: 'library-entry', action: 'nod', then: { path: '/library/-1' }, line: 'These are examples. Your own go here, newest first. Tap one to read it again.' },
        { target: 'back-entry', action: 'smug', then: { path: '/library' }, line: 'That’s how an entry reads back, verses and all. Tap the X to go back.' },
        { target: 'library-search', action: 'point', then: { event: 'library-searched' }, line: 'Wrote about something months ago and can’t find it? Search. Type dark.' },
        { target: 'library-sub-books', action: 'nod', then: { shows: 'library-books' }, line: 'Or go book by book. Tap By book.' },
        { target: 'library-section-unfinished', action: 'point', then: { shows: 'library-practice' }, line: 'What you said you’d do lives under Working on. Tap it.' },
        { target: 'library-practice', action: 'smug', then: { got: true }, line: 'Each one with its reason, and how you’re keeping it. Tick it here or on Home, same thing.' },
        { target: 'library-sub-topics', action: 'think', then: { shows: 'library-question' }, line: 'Now tap Questions.' },
        { target: 'library-question', action: 'nod', then: { got: true }, line: 'What you wanted to study further, waiting until you have. Tick it once you’ve dug in.' },
        { target: 'library-section-echoes', action: 'think', then: { got: true }, line: 'And Echoes: what I’ve noticed across your entries, and the themes that run through them. Those take a few weeks of writing.' },

        // Groups
        { target: 'tab-groups', action: 'smug', then: { path: '/groups' }, line: 'And when you’re ready, bring your people. Tap Groups.' },
        { target: 'groups-row', action: 'nod', then: { path: `/groups/${DEMO_GROUP_ID}` }, line: 'Your groups live here. This one is made up, so you can see inside. Tap it.' },
        { target: 'group-share', action: 'point', then: { got: true }, line: 'On Sunday the group opens. You bring one answer from your week, the one you choose. The rest stays yours.' },
        { target: 'group-days', action: 'nod', then: { got: true }, line: 'Everyone sees what the others read that week, and the one thing each person brought.' },
        { target: 'group-practice', action: 'smug', then: { got: true }, line: 'Share a practice if you want people watching you keep it. I already am.' },
        { target: 'group-members', action: 'sideEye', then: { got: true }, line: 'Members shows who read this week. Anyone who didn’t, you can nudge. Gently.' },
        { target: 'back-group', action: 'nod', then: { path: '/groups' }, line: 'Back.' },
        { target: 'tab-home', action: 'wave', then: { path: '/' }, line: 'That’s everything. Tap Home.' },

        {
            target: null,
            action: 'wave',
            then: { end: true },
            line: `Now it’s your turn. Go and read ${PRACTICE_BOOK} ${PRACTICE_CHAPTERS.start}–${PRACTICE_CHAPTERS.end}. I’ll be here.`,
        },
    ];
}

/** Space kept around the spotlit element. */
const PAD = 8;
const DIM = 'rgba(15, 20, 30, 0.72)';
const GAP = Spacing.md;
/** Long enough for a screen the user just opened to lay out its element. */
const FIND_MS = 8000;
const POLL_MS = 300;

/** Only the tab bar is fixed; a hero's icons scroll with their page on Home and Settings. */
const fixed = (t: CoachTarget) => t.startsWith('tab-');

const sameRect = (a: Rect, b: Rect) =>
    Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

export function AppWalk() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { width: W, height: H } = useWindowDimensions();
    const pathname = usePathname();
    const look = useAsaroLook();
    const tour = useTour();
    const all = useMemo(() => stops(look === 'female' ? 'brother' : 'sister'), [look]);
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const [bubbleH, setBubbleH] = useState(160);
    const stop = all[index];
    const then = stop.then;

    useEffect(() => {
        if (!tour.active) {
            setIndex(0);
            setRect(null);
        }
    }, [tour.active]);

    const last = index === all.length - 1;
    const next = useCallback(() => {
        setRect(null);
        setIndex(i => Math.min(i + 1, all.length - 1));
    }, [all.length]);

    const finish = () => {
        endTour();
        void setFirstRun('done');
    };

    // Find this stop's element, bring it into view, then keep measuring it while it's up.
    useEffect(() => {
        if (!tour.active) return;
        const target = stop.target;
        setTourStop(target);
        if (!target) return;
        let alive = true;
        let poll: ReturnType<typeof setInterval> | undefined;
        (async () => {
            const first = await waitForTarget(target, FIND_MS);
            if (!alive) return;
            if (!first) {
                // Not on this reader's screen: go straight past it.
                next();
                return;
            }
            if (!fixed(target)) await revealTarget(first);
            if (!alive) return;
            setRect((await measureTarget(target)) ?? first);
            // It can move under the spotlight: a list settling, a keyboard opening.
            poll = setInterval(async () => {
                const now = await measureTarget(target);
                if (alive && now) setRect(prev => (prev && sameRect(prev, now) ? prev : now));
            }, POLL_MS * 2);
        })();
        return () => { alive = false; clearInterval(poll); };
    }, [tour.active, stop, next]);

    // What the user did: the screen they tapped into.
    useEffect(() => {
        if (tour.active && 'path' in then && pathname === then.path) next();
    }, [tour.active, then, pathname, next]);

    // What the user did: the thing they tapped has opened.
    useEffect(() => {
        if (!tour.active || !('shows' in then)) return;
        const id = setInterval(async () => {
            if (await measureTarget(then.shows)) next();
        }, POLL_MS);
        return () => clearInterval(id);
    }, [tour.active, then, next]);

    // What the user did: something a screen reports.
    useEffect(() => {
        if (!tour.active || !('event' in then)) return;
        return onCoachEvent(name => { if (name === then.event) next(); });
    }, [tour.active, then, next]);

    // Back would leave a screen mid-stop; the way back is the arrow the walk points at.
    useEffect(() => {
        if (!tour.active) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => sub.remove();
    }, [tour.active]);

    if (!tour.active) return null;

    const hole = rect && (() => {
        const top = Math.max(0, rect.y - PAD);
        const bottom = Math.min(H, rect.y + rect.height + PAD);
        const x = Math.max(0, rect.x - PAD);
        return { x, y: top, w: Math.min(W - x, rect.width + PAD * 2), h: Math.max(0, bottom - top) };
    })();

    // Up top, where it's easy to read; below the element only when the element is up there itself.
    const topSlot = insets.top + GAP;
    const bubbleTop = !hole || hole.y >= topSlot + bubbleH + GAP
        ? topSlot
        : Math.min(hole.y + hole.h + GAP, H - bubbleH - insets.bottom - GAP);

    // An explanation holds the tap; a doing stop lets it through to the real element.
    const explains = 'got' in then || 'end' in then;
    const block = () => true;

    return (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {hole ? (
                <>
                    <View onStartShouldSetResponder={block} style={[styles.dim, { top: 0, left: 0, right: 0, height: hole.y }]} />
                    <View onStartShouldSetResponder={block} style={[styles.dim, { top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
                    <View onStartShouldSetResponder={block} style={[styles.dim, { top: hole.y, left: 0, width: hole.x, height: hole.h }]} />
                    <View onStartShouldSetResponder={block} style={[styles.dim, { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]} />
                    {explains && <Pressable style={[styles.hole, { top: hole.y, left: hole.x, width: hole.w, height: hole.h }]} />}
                    <View
                        pointerEvents="none"
                        style={[styles.ring, { top: hole.y, left: hole.x, width: hole.w, height: hole.h, borderColor: colors.accent }]}
                    />
                </>
            ) : (
                <View onStartShouldSetResponder={block} style={[styles.dim, StyleSheet.absoluteFill]} />
            )}

            {(rect || !stop.target) && (
                <View
                    onLayout={e => setBubbleH(e.nativeEvent.layout.height)}
                    style={[styles.bubble, { backgroundColor: colors.background, top: bubbleTop }]}
                >
                    <CoachLine key={index} line={stop.line} action={stop.action}>
                        {'got' in then && (
                            <ScalePressable onPress={next} accessibilityRole="button" style={styles.gotIt} hitSlop={8}>
                                <Text variant="label" tone="accent">Got it</Text>
                            </ScalePressable>
                        )}
                    </CoachLine>
                    {last && <ThemedButton label="Okay, let me start" block onPress={finish} />}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    dim: { position: 'absolute', backgroundColor: DIM },
    hole: { position: 'absolute' },
    ring: { position: 'absolute', borderWidth: 2 },
    bubble: {
        position: 'absolute',
        left: Spacing.layout.screenPadding,
        right: Spacing.layout.screenPadding,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    gotIt: { alignSelf: 'flex-end' },
});
