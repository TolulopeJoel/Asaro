/**
 * The walk around the whole app after the practice entry. The user does the
 * using: the screen dims except one real element, the ring lands on it, and
 * then the chosen sibling's bubble opens beside it, pointing at it. A stop that
 * explains moves on with Got it or a tap on the element; a stop that asks for
 * something says so on the element and waits until it's done (the screen they
 * tapped into has opened, the tree has opened, the tick is in). Where a real
 * tap would change something real, it is only explained. Screens show example
 * content while it runs (src/onboarding/demo.ts).
 * It ends back on Home, sending them off to do their real first reading. No
 * skip, by decision.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
    Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { useAsaroLook } from '../../storage/asaroLook';
import { takeOffThinkingCap } from '../../storage/thinkingCap';
import {
    measureTarget, onCoachEvent, revealTarget, waitForTarget,
    type CoachEvent, type CoachTarget, type Rect, type Room,
} from '../../onboarding/coachTargets';
import { endTour, setTourStop, useTour } from '../../onboarding/tour';
import { setFirstRun } from '../../onboarding/firstRun';
import { DEMO_GROUP_ID } from '../../onboarding/demo';
import { PRACTICE_BOOK, PRACTICE_CHAPTERS } from '../../onboarding/practiceEntry';
import { Text, ThemedButton, type AsaroAction, type AsaroMood } from '../ui';
import { CoachLine } from './CoachLine';

/** How a stop moves on. `got` is an explanation; everything else waits for the user. */
type Then =
    | { got: true }
    | { path: string }
    | { shows: CoachTarget }
    /** `hint` goes on the element: what to do there, since it isn't only a tap. */
    | { event: CoachEvent; hint: string }
    | { end: true };

interface Stop { target: CoachTarget | null; action: AsaroAction; mood?: AsaroMood; line: string; then: Then; part?: string }

/** A stretch of the walk, named in the bubble with how far into it the reader is. */
const part = (name: string, list: Stop[]): Stop[] => list.map(s => ({ ...s, part: name }));

/**
 * @param other the sibling they didn't pick
 * @param handle the kind of name people give themselves online, for their gender
 */
function stops(other: string, handle: string): Stop[] {
    return [
        ...part('Home', [
            { target: 'reading', action: 'point', then: { got: true }, line: 'This is today’s reading, from the plan. Go and read it in your Bible first, not in between scrolling your phone o. When you finish, come and tap Begin reflection.' },
            { target: 'add', action: 'nod', then: { got: true }, line: 'You read something that doesn’t follow the plan? It’s allowed. Tap the + and write about it, any day.' },
            { target: 'home-today', action: 'point', then: { event: 'today-kept', hint: 'Tap the box' }, line: 'Remember what you said you’ll do? It waits for you here every day. Once you’ve done it, tap the box. Oya, I’m waiting.' },
            { target: 'home-today', action: 'thumbsUp', then: { got: true }, line: 'Ticked. Every tick waters its tree. Tomorrow, same thing. If you tick the wrong one, just tap it again.' },
            { target: 'home-observation', action: 'think', then: { got: true }, line: 'Write for a few weeks and I’ll start noticing things in your entries. When I find something, I’ll bring it here. Not every time.' },
        ]),

        ...part('Stats', [
            { target: 'week', action: 'smug', then: { path: '/stats' }, line: 'See your week. Any day you reflect, that day fills up. Tap it.' },
            { target: 'stats-tiles', action: 'nod', then: { got: true }, line: 'This is your record. This one is just an example, so you can see it full. Your own starts today.' },
            { target: 'stats-calendar', action: 'point', then: { got: true }, line: 'Here is every day you wrote, month by month. The days you missed show too. Don’t worry, everybody has them.' },
            { target: 'stats-grove', action: 'smug', then: { shows: 'stats-rooted' }, line: 'Every practice you keep grows a tree. Tap one, let me show you.' },
            { target: 'stats-rooted', action: 'think', then: { got: true }, line: 'This shows how rooted it is, how much it has become part of you. The more you keep it, the deeper it goes. If you miss it, it gets thirsty. Don’t panic, it’s not dead.' },
            { target: 'back-stats', action: 'nod', then: { path: '/' }, line: 'Okay, let’s go back. Tap the arrow.' },
        ]),

        ...part('Your land', [
            { target: 'progress', action: 'point', then: { path: '/land' }, line: 'This one shows how far you’ve gone in the whole Bible. Tap it.' },
            { target: 'land-field', action: 'nod', then: { got: true }, line: 'This is your land, Genesis to Revelation. Any chapter you write about, we clear it and farm it. The rest is still bush. We start somewhere.' },
            { target: 'land-tree', action: 'point', then: { shows: 'land-card' }, line: 'Your trees are planted on the chapter they came from. Tap that one.' },
            { target: 'land-card', action: 'smug', then: { got: true }, line: 'This one came from Genesis 1. Any time you want to see how a tree is doing, just tap it.' },
            { target: 'back-land', action: 'nod', then: { path: '/' }, line: 'Now back to Home. Tap the arrow.' },
        ]),

        // Every Settings row does real work, so they are shown, not tapped.
        ...part('Settings', [
            { target: 'settings', action: 'point', then: { path: '/settings' }, line: 'Settings. Come, let me show you.' },
            { target: 'settings-profile', action: 'smug', then: { got: true }, line: `Your name is up here. Tap it to change it, and add a photo once you’re in a group. And please use your real name, not ${handle}. Your group needs to know who they’re reading with.` },
            { target: 'settings-you', action: 'sideEye', then: { got: true }, line: `Your sleep time. My last reminder comes one hour before it, and you can change it once a month. That’s me above it. If you ever want my ${other} instead… it’s there. Don’t try it.` },
            { target: 'settings-backup', action: 'think', then: { got: true }, line: 'Phones get lost, get stolen, fall in water. Share a backup once in a while, so your entries don’t go with the phone.' },
            { target: 'back-settings', action: 'nod', then: { path: '/' }, line: 'We’re done here. Tap the arrow to go back.' },
        ]),

        ...part('Library', [
            { target: 'tab-library', action: 'point', then: { path: '/library' }, line: 'Everything you write goes into your Library. Tap it.' },
            { target: 'library-entry', action: 'nod', then: { got: true }, line: 'These ones are just examples. Your own will come here, newest on top. Tap one to read it again, and any verse in orange opens in JW Library.' },
            { target: 'library-search', action: 'point', then: { event: 'library-searched', hint: 'Type dark' }, line: 'You wrote about something months ago and now you can’t find it? Search for it. Type dark.' },
            { target: 'library-search', action: 'smug', then: { got: true }, line: 'There it is. Anything you’ve ever written, you can find it like that. You’re welcome.' },
            { target: 'library-sub-books', action: 'nod', then: { shows: 'library-books' }, line: 'Or you can go book by book. Tap By book.' },
            { target: 'library-books', action: 'nod', then: { got: true }, line: 'Every book you’ve written about is here, with how many entries. Tap any one to see all of them.' },
        ]),

        ...part('Working on', [
            { target: 'library-section-unfinished', action: 'point', then: { shows: 'library-practice' }, line: 'Everything you said you’ll do is under Working on. Tap it.' },
            { target: 'library-practice', action: 'smug', then: { got: true }, line: 'Each one is here with its reason, and how well you’re keeping it. You can tick it here or on Home, it’s the same thing.' },
            { target: 'library-sub-topics', action: 'think', then: { shows: 'library-question' }, line: 'Now tap Questions.' },
            { target: 'library-question', action: 'nod', then: { got: true }, line: 'The things you wanted to study further wait for you here. When you’ve studied one, tick it.' },
        ]),

        ...part('Echoes', [
            { target: 'library-section-echoes', action: 'think', then: { got: true }, line: 'And this is Echoes. It’s where I keep what I’ve noticed in your entries and the things you keep coming back to. Yours will start filling up after a few weeks of writing. Then come and see.' },
        ]),

        ...part('Plan', [
            { target: 'library-section-plan', action: 'point', then: { shows: 'plan-legend' }, line: 'Do you want to read the whole Bible in one year? That’s what the plan is for. Tap Plan.' },
            { target: 'plan-legend', action: 'nod', then: { got: true }, line: 'It’s Genesis to Revelation, one reading every day. The diamonds are the Hebrew Scriptures, the dots are the Christian Greek Scriptures.' },
            { target: 'plan-next', action: 'point', then: { got: true }, line: 'This is where Home gets today’s reading from. Once you reflect on it, it ticks itself here. Come back any time to see how far you’ve gone.' },
            { target: 'plan-footnote', action: 'smug', then: { got: true }, line: 'It comes from the Bible reading plan on jw.org. Tap jw.org any time to read more about it.' },
        ]),

        ...part('Groups', [
            { target: 'tab-groups', action: 'sheepish', then: { path: '/groups' }, line: 'Last part, I promise. Now, your people. Tap Groups.' },
            { target: 'groups-row', action: 'nod', then: { path: `/groups/${DEMO_GROUP_ID}` }, line: 'Your groups will be here. This one is not real, it’s just so you can see inside. Tap it.' },
            { target: 'group-share', action: 'point', then: { event: 'group-brought', hint: 'Choose, then Bring' }, line: 'Every Sunday the group opens, and everybody brings one answer from their week. Tap Choose, pick one, then tap Bring.' },
            { target: 'group-privacy', action: 'nod', mood: 'sincere', then: { got: true }, line: 'That’s a good one to bring. Only this group can see it, and you can take it back any time. Everything else you write stays on your phone. The group will see which chapters you read and how many questions you answered, but not your answers. Only the one you bring in.' },
            { target: 'group-practice', action: 'smug', then: { got: true }, line: 'Share a practice if you want people checking on you too, not only me.' },
            { target: 'group-members', action: 'sideEye', then: { got: true }, line: 'Members shows who read this week. Anybody that didn’t, you can nudge them. Gently o.' },
            { target: 'back-group', action: 'nod', then: { path: '/groups' }, line: 'Back to your groups. Tap the arrow.' },
            { target: 'tab-home', action: 'wave', then: { path: '/' }, line: 'That’s everything. Tap Home.' },
        ]),

        {
            target: null,
            action: 'wave',
            mood: 'sincere',
            then: { end: true },
            line: `Now it’s your turn: go and read ${PRACTICE_BOOK} ${PRACTICE_CHAPTERS.start}–${PRACTICE_CHAPTERS.end}. You won’t see me like this again, unless you’re doing something right… or something wrong. Either way, I’ll know. And I’m on your side o. That’s why I disturb.`,
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
/** Until the first bubble has laid out. */
const BUBBLE_GUESS = 200;
/** The longest a screen gets to scroll a target clear before it is lit where it is. */
const REVEAL_MS = 1500;

/** Only the tab bar is fixed; a hero's icons scroll with their page on Home and Settings. */
const fixed = (t: CoachTarget) => t.startsWith('tab-');

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Viewport { H: number; top: number; bottom: number }
interface Box { x: number; y: number; w: number; h: number }

/** The bubble's tail, pointing at the element. */
const TAIL = 14;
/** The ring lands before the bubble opens, so the eye goes to the element first. */
const RING_MS = 380;

/**
 * Where a target has to sit to be seen whole with the bubble above it. Room
 * above is always kept, so whichever side the bubble takes, it fits.
 */
const roomUnder = (bubbleH: number, s: Viewport): Room => ({
    top: s.top + GAP + bubbleH + TAIL / 2 + GAP + PAD,
    bottom: s.H - s.bottom - PAD,
});

type Side = 'above' | 'below';

/**
 * The bubble sits right beside what it is about and never covers it: below an
 * element in the top half of the screen, above one in the bottom half, or
 * whichever side has room. Only something taller than the screen can hold
 * beside it (the land) is lit in part: the bubble takes whichever end hides
 * less, and the spotlight is the rest.
 */
function place(box: Box | null, bubbleH: number, s: Viewport): { bubbleTop: number; hole: Box | null; side: Side | null } {
    const topSlot = s.top + GAP;
    const floor = s.H - s.bottom - GAP;
    if (!box) return { bubbleTop: topSlot, hole: null, side: null };
    const need = bubbleH + TAIL / 2 + GAP;
    const fitsAbove = box.y - topSlot >= need;
    const fitsBelow = floor - (box.y + box.h) >= need;
    const upper = box.y + box.h / 2 < s.H / 2;
    if (fitsBelow && (upper || !fitsAbove)) return { bubbleTop: box.y + box.h + TAIL / 2 + GAP, hole: box, side: 'below' };
    if (fitsAbove) return { bubbleTop: box.y - need, hole: box, side: 'above' };
    const up = { top: topSlot + need, bottom: s.H };
    const down = { top: 0, bottom: floor - need };
    const seen = (band: Room) => Math.min(box.y + box.h, band.bottom) - Math.max(box.y, band.top);
    const band = seen(up) >= seen(down) ? up : down;
    const top = Math.max(box.y, band.top);
    return {
        bubbleTop: band === up ? topSlot : floor - bubbleH,
        hole: { ...box, y: top, h: Math.max(0, Math.min(box.y + box.h, band.bottom) - top) },
        side: band === up ? 'above' : 'below',
    };
}

/**
 * The spotlight's ring. It lands with a spring and one ripple; on a stop that
 * waits for the user, the ripple keeps going, so the element reads as the thing to use.
 */
function Ring({ hole, color, waiting }: { hole: Box; color: string; waiting: boolean }) {
    const reduceMotion = useReducedMotion();
    const land = useSharedValue(reduceMotion ? 1 : 0);
    const ripple = useSharedValue(0);

    useEffect(() => {
        if (reduceMotion) return;
        land.value = withSpring(1, { damping: 11, stiffness: 190 });
        const once = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
        ripple.value = waiting
            ? withRepeat(withSequence(withTiming(0, { duration: 0 }), once, withTiming(1, { duration: 500 })), -1)
            : once;
    }, [reduceMotion, waiting, land, ripple]);

    const ringStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, land.value * 1.5),
        transform: [{ scale: 1.18 - 0.18 * land.value }],
    }));
    const rippleStyle = useAnimatedStyle(() => ({
        opacity: ripple.value <= 0 || ripple.value >= 1 ? 0 : 0.7 * (1 - ripple.value),
        transform: [{ scale: 1 + 0.12 * ripple.value }],
    }));
    const at = { top: hole.y, left: hole.x, width: hole.w, height: hole.h };

    return (
        <>
            <Animated.View pointerEvents="none" style={[styles.ring, at, { borderColor: color }, rippleStyle]} />
            <Animated.View pointerEvents="none" style={[styles.ring, at, { borderColor: color }, ringStyle]} />
        </>
    );
}

const sameRect = (a: Rect, b: Rect) =>
    Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

export function AppWalk() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { width: W, height: H } = useWindowDimensions();
    const pathname = usePathname();
    const look = useAsaroLook();
    const tour = useTour();
    const all = useMemo(() => look === 'female' ? stops('brother', 'Prettygirl') : stops('sister', 'Handsomeboy'), [look]);
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const [bubbleH, setBubbleH] = useState(BUBBLE_GUESS);
    /** The bubble's height and the stop it was laid out for, read while revealing. */
    const laidOut = useRef({ index: -1, height: BUBBLE_GUESS });
    const screen = useRef({ H, top: insets.top, bottom: insets.bottom });
    screen.current = { H, top: insets.top, bottom: insets.bottom };
    const stop = all[index];
    const then = stop.then;
    /** The stop whose ring has landed, so its bubble can open. */
    const [shownFor, setShownFor] = useState(-1);

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
        void takeOffThinkingCap();
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
            let first = await waitForTarget(target, FIND_MS);
            // An explanation that isn't on this reader's screen is passed over. A stop the
            // user has to act on is never skipped, or the walk runs ahead of them: it keeps looking.
            while (alive && !first && !('got' in stop.then)) first = await waitForTarget(target, FIND_MS);
            if (!alive) return;
            if (!first) {
                next();
                return;
            }
            if (!fixed(target)) {
                // Scroll it clear of this stop's bubble, so wait for the bubble to have a height.
                const until = Date.now() + 1000;
                while (alive && laidOut.current.index !== index && Date.now() < until) await pause(50);
                if (!alive) return;
                // Scrolling is a nicety: if it fails or hangs, the stop still lights up.
                await Promise.race([
                    revealTarget(first, roomUnder(laidOut.current.height, screen.current)).catch(() => undefined),
                    pause(REVEAL_MS),
                ]);
            }
            const settled = alive ? await measureTarget(target) : null;
            // The user may have moved the walk on while this was measuring; a late box would stick.
            if (!alive) return;
            setRect(settled ?? first);
            // It can move under the spotlight: a list settling, a keyboard opening.
            poll = setInterval(async () => {
                const now = await measureTarget(target);
                if (alive && now) setRect(prev => (prev && sameRect(prev, now) ? prev : now));
            }, POLL_MS * 2);
        })();
        return () => { alive = false; clearInterval(poll); };
    }, [tour.active, stop, index, next]);

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

    // The ring lands first; the bubble opens once it has.
    const lit = rect !== null;
    useEffect(() => {
        if (!lit || shownFor === index) return;
        const id = setTimeout(() => setShownFor(index), RING_MS);
        return () => clearTimeout(id);
    }, [lit, index, shownFor]);

    if (!tour.active) return null;

    const box = rect && (() => {
        const top = Math.max(0, rect.y - PAD);
        const bottom = Math.min(H, rect.y + rect.height + PAD);
        const x = Math.max(0, rect.x - PAD);
        return { x, y: top, w: Math.min(W - x, rect.width + PAD * 2), h: Math.max(0, bottom - top) };
    })();
    const { bubbleTop, hole, side } = place(box, bubbleH, screen.current);
    const shown = !stop.target || shownFor === index;

    const inPart = all.filter(s => s.part === stop.part);
    const where = !stop.part ? null
        : inPart.length > 1 ? `${stop.part} · ${inPart.indexOf(stop) + 1} of ${inPart.length}` : stop.part;

    // An explanation moves on with a tap on the element, same as Got it; a doing stop lets the tap
    // through to the real element, and says so on it.
    const explains = 'got' in then || 'end' in then;
    const hint = 'event' in then ? then.hint : 'path' in then || 'shows' in then ? 'Tap it' : null;
    const block = () => true;

    const bubbleLeft = Spacing.layout.screenPadding;
    const bubbleW = W - bubbleLeft * 2;
    // The tail and the face both point at the element.
    const aimX = hole ? hole.x + hole.w / 2 : W / 2;
    const tailX = Math.min(Math.max(aimX - bubbleLeft, TAIL * 2), bubbleW - TAIL * 2);
    const faceX = bubbleLeft + Spacing.lg + 24;
    const faceY = bubbleTop + bubbleH / 2;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const gaze = hole
        ? { x: clamp((aimX - faceX) / 140), y: clamp((hole.y + hole.h / 2 - faceY) / 140) }
        : undefined;

    return (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {hole ? (
                <>
                    <View onStartShouldSetResponder={block} style={[styles.dim, { top: 0, left: 0, right: 0, height: hole.y }]} />
                    <View onStartShouldSetResponder={block} style={[styles.dim, { top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
                    <View onStartShouldSetResponder={block} style={[styles.dim, { top: hole.y, left: 0, width: hole.x, height: hole.h }]} />
                    <View onStartShouldSetResponder={block} style={[styles.dim, { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]} />
                    {explains && (
                        <Pressable
                            onPress={shown && 'got' in then ? next : undefined}
                            accessibilityRole="button"
                            accessibilityLabel="Got it"
                            style={[styles.hole, { top: hole.y, left: hole.x, width: hole.w, height: hole.h }]}
                        />
                    )}
                    <Ring key={index} hole={hole} color={colors.accent} waiting={!explains} />
                    {hint && shown && (
                        // On the edge away from the bubble, so it never sits under the tail.
                        <View
                            pointerEvents="none"
                            style={[
                                styles.hintRow,
                                { left: Math.min(Math.max(aimX - HINT_W / 2, GAP), W - HINT_W - GAP) },
                                side === 'below'
                                    ? { top: Math.max(0, hole.y - HINT_H / 2) }
                                    : { top: Math.min(H - HINT_H, hole.y + hole.h - HINT_H / 2) },
                            ]}
                        >
                            <View style={[styles.hint, { backgroundColor: colors.accent }]}>
                                <Text variant="label" style={{ color: colors.background }} numberOfLines={1}>{hint}</Text>
                            </View>
                        </View>
                    )}
                </>
            ) : (
                <View onStartShouldSetResponder={block} style={[styles.dim, StyleSheet.absoluteFill]} />
            )}

            <View
                key={index}
                pointerEvents={shown ? 'auto' : 'none'}
                onLayout={e => {
                    laidOut.current = { index, height: e.nativeEvent.layout.height };
                    setBubbleH(e.nativeEvent.layout.height);
                }}
                style={[
                    styles.bubble,
                    { backgroundColor: colors.background, top: bubbleTop, left: bubbleLeft, right: bubbleLeft },
                    !shown && styles.waiting,
                ]}
            >
                {side && (
                    <View style={[
                        styles.tail,
                        { backgroundColor: colors.background, left: tailX - TAIL / 2 },
                        side === 'below' ? { top: -TAIL / 2 } : { bottom: -TAIL / 2 },
                    ]} />
                )}
                {where && <Text variant="label">{where}</Text>}
                {/* Remounted when it opens, so the line flips in and the face acts while they're looking. */}
                <CoachLine key={shown ? 'open' : 'held'} line={stop.line} action={stop.action} mood={stop.mood} lookAt={gaze}>
                    {'got' in then && (
                        <View style={styles.gotIt}>
                            <ThemedButton label="Got it" onPress={next} disabled={!shown} />
                        </View>
                    )}
                </CoachLine>
                {last && <ThemedButton label="Okay, let me start" block onPress={finish} />}
            </View>
        </View>
    );
}

/** The hint's row; the pill inside is as wide as its words, centred on the element. */
const HINT_W = 220;
const HINT_H = 26;

const styles = StyleSheet.create({
    dim: { position: 'absolute', backgroundColor: DIM },
    hole: { position: 'absolute' },
    ring: { position: 'absolute', borderWidth: Spacing.border.marker },
    bubble: {
        position: 'absolute',
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    tail: {
        position: 'absolute',
        width: TAIL,
        height: TAIL,
        transform: [{ rotate: '45deg' }],
    },
    hintRow: { position: 'absolute', width: HINT_W, height: HINT_H, alignItems: 'center' },
    hint: { height: HINT_H, paddingHorizontal: Spacing.md, justifyContent: 'center' },
    gotIt: { alignSelf: 'flex-end' },
    waiting: { opacity: 0 },
});
