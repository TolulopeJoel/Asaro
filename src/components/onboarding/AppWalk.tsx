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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { ScalePressable } from '../ScalePressable';
import { Text, ThemedButton, type AsaroAction, type AsaroMood } from '../ui';
import { CoachLine } from './CoachLine';

/** How a stop moves on. `got` is an explanation; everything else waits for the user. */
type Then =
    | { got: true }
    | { path: string }
    | { shows: CoachTarget }
    | { event: CoachEvent }
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
            { target: 'reading', action: 'point', then: { got: true }, line: 'Today’s reading, straight from the plan. Read it in your Bible first, not while scrolling your phone. Then Begin reflection.' },
            { target: 'add', action: 'nod', then: { got: true }, line: 'Read something that isn’t on the plan? The + writes about anything, any day.' },
            { target: 'home-today', action: 'point', then: { event: 'today-kept' }, line: 'What you said you’d do waits here each day. Done it? Tap the box to tick it off. Go on.' },
            { target: 'home-today', action: 'celebrate', then: { got: true }, line: 'Ticked. Look at you, keeping your word. Every tick waters its tree. Wrong one? Tap it again.' },
            { target: 'home-observation', action: 'think', then: { got: true }, line: 'Give me a few weeks of writing and I start noticing things across your entries. I’ll put them here. Not often. I don’t talk for the sake of talking.' },
        ]),

        ...part('Stats', [
            { target: 'week', action: 'smug', then: { path: '/stats' }, line: 'Your week. Every day you reflect fills one. Tap it.' },
            { target: 'stats-tiles', action: 'nod', then: { got: true }, line: 'Your record. This one is an example so you can see it full. Yours starts today.' },
            { target: 'stats-calendar', action: 'point', then: { got: true }, line: 'Every day you wrote, month by month. The gaps show too. Everybody has some.' },
            { target: 'stats-grove', action: 'smug', then: { shows: 'stats-rooted' }, line: 'Every practice you keep grows a tree. Tap one.' },
            { target: 'stats-rooted', action: 'think', then: { got: true }, line: 'This is how rooted it is: how much it has become part of you. Keep it and it roots deeper. Miss it and it goes thirsty. Not dead. Just thirsty.' },
            { target: 'back-stats', action: 'nod', then: { path: '/' }, line: 'Now back. Tap the arrow.' },
        ]),

        ...part('Your land', [
            { target: 'progress', action: 'point', then: { path: '/land' }, line: 'How far you’ve gone through the whole Bible. Tap it.' },
            { target: 'land-field', action: 'nod', then: { got: true }, line: 'Your land, Genesis to Revelation. Every chapter you write about gets worked. The rest is bush for now. We start somewhere.' },
            { target: 'land-tree', action: 'point', then: { shows: 'land-card' }, line: 'Your trees are planted on the chapter they came from. Tap that one.' },
            { target: 'land-card', action: 'smug', then: { got: true }, line: 'This one grew out of Genesis 1. Tap any tree, any time, to see how it’s doing.' },
            { target: 'back-land', action: 'nod', then: { path: '/' }, line: 'Back to Home. Tap the arrow.' },
        ]),

        // Every Settings row does real work, so they are shown, not tapped.
        ...part('Settings', [
            { target: 'settings', action: 'point', then: { path: '/settings' }, line: 'Settings. Where people come to try and quiet me. Tap it anyway.' },
            { target: 'settings-profile', action: 'smug', then: { got: true }, line: `Your name lives up here. Tap it any time to change it, or to add a photo. And use your real name, not ${handle}. Your group has to know who they’re reading with.` },
            { target: 'settings-you', action: 'sideEye', then: { got: true }, line: `Your sleep time: my last reminder comes an hour before it. Change it once a month, not every time I annoy you. Above it, me. If you ever want my ${other} instead… it’s here. Don’t try it.` },
            { target: 'settings-backup', action: 'think', then: { got: true }, line: 'Phones get lost, stolen, dropped in water. Share a backup now and then, so your entries survive.' },
            { target: 'back-settings', action: 'nod', then: { path: '/' }, line: 'Done here. Tap the arrow to go back.' },
        ]),

        ...part('Library', [
            { target: 'tab-library', action: 'point', then: { path: '/library' }, line: 'Everything you write ends up in your Library. Tap it.' },
            { target: 'library-entry', action: 'nod', then: { got: true }, line: 'These are examples. Your own go here, newest first. Tap one any time to read it again: the verses in orange open in JW Library.' },
            { target: 'library-search', action: 'point', then: { event: 'library-searched' }, line: 'Wrote about something months ago and can’t find it? Search. Type dark.' },
            { target: 'library-search', action: 'smug', then: { got: true }, line: 'There it is. Every answer you’ve ever written, searchable. You’re welcome.' },
            { target: 'library-sub-books', action: 'nod', then: { shows: 'library-books' }, line: 'Or go book by book. Tap By book.' },
            { target: 'library-books', action: 'nod', then: { got: true }, line: 'Every book you’ve written about, with how many entries. Tap one any time to see them all.' },
        ]),

        ...part('Working on', [
            { target: 'library-section-unfinished', action: 'point', then: { shows: 'library-practice' }, line: 'What you said you’d do lives under Working on. Tap it.' },
            { target: 'library-practice', action: 'smug', then: { got: true }, line: 'Each one with its reason, and how you’re keeping it. Tick it here or on Home, same thing.' },
            { target: 'library-sub-topics', action: 'think', then: { shows: 'library-question' }, line: 'Now tap Questions.' },
            { target: 'library-question', action: 'nod', then: { got: true }, line: 'What you wanted to study further, waiting until you have. Tick it once you’ve dug in.' },
        ]),

        ...part('Echoes', [
            { target: 'library-section-echoes', action: 'think', then: { got: true }, line: 'And Echoes: what I’ve noticed across your entries, and the themes running through them. Yours fills in after a few weeks of writing. Then come and look.' },
        ]),

        ...part('Plan', [
            { target: 'library-section-plan', action: 'point', then: { shows: 'plan-legend' }, line: 'Want to read the whole Bible in a year? That’s what the plan is for. Tap Plan.' },
            { target: 'plan-legend', action: 'nod', then: { got: true }, line: 'Genesis to Revelation, one reading a day. The diamonds take you through the Hebrew Scriptures, the dots through the Christian Greek Scriptures.' },
            { target: 'plan-next', action: 'point', then: { got: true }, line: 'This is where Home gets today’s reading. Reflect on it and it ticks itself off here, so come back any time to see how far you’ve got.' },
            { target: 'plan-footnote', action: 'smug', then: { got: true }, line: 'It comes from the Bible reading plan on jw.org. Tap jw.org any time to read more about it.' },
        ]),

        ...part('Groups', [
            { target: 'tab-groups', action: 'sheepish', then: { path: '/groups' }, line: 'Last part, I promise. Your people. Tap Groups.' },
            { target: 'groups-row', action: 'nod', then: { path: `/groups/${DEMO_GROUP_ID}` }, line: 'Your groups live here. This one is made up, so you can see inside. Tap it.' },
            { target: 'group-share', action: 'point', then: { event: 'group-brought' }, line: 'On Sunday the group opens, and you bring one answer from your week. Tap Choose, pick one, then Bring.' },
            { target: 'group-privacy', action: 'nod', mood: 'sincere', then: { got: true }, line: 'That’s a good one to bring. Only this group sees it, and you can take it back any time. Everything else you write stays on your phone: the group sees the chapters you read and how many questions you answered, never your answers, except the one you bring.' },
            { target: 'group-practice', action: 'smug', then: { got: true }, line: 'Share a practice if you want people keeping you honest. It helps. Trust me.' },
            { target: 'group-members', action: 'sideEye', then: { got: true }, line: 'Members shows who read this week. Anyone who didn’t, you can nudge. Gently.' },
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

/** Where a target has to sit to be seen whole under a bubble of this height at the top. */
const roomUnder = (bubbleH: number, s: Viewport): Room => ({
    top: s.top + GAP + bubbleH + GAP + PAD,
    bottom: s.H - s.bottom - PAD,
});

/**
 * The bubble never covers what it is about. It sits at the top, where it's
 * easy to read, or just below the element when the element is up there. Only
 * something taller than the screen can hold beside it (the land) is lit in
 * part: the bubble takes whichever end hides less, and the spotlight is the rest.
 */
function place(box: Box | null, bubbleH: number, s: Viewport): { bubbleTop: number; hole: Box | null } {
    const topSlot = s.top + GAP;
    const floor = s.H - s.bottom - GAP;
    if (!box || box.y >= topSlot + bubbleH + GAP) return { bubbleTop: topSlot, hole: box };
    if (box.y + box.h + GAP + bubbleH <= floor) return { bubbleTop: box.y + box.h + GAP, hole: box };
    const up = { top: topSlot + bubbleH + GAP, bottom: s.H };
    const down = { top: 0, bottom: floor - bubbleH - GAP };
    const seen = (band: Room) => Math.min(box.y + box.h, band.bottom) - Math.max(box.y, band.top);
    const band = seen(up) >= seen(down) ? up : down;
    const top = Math.max(box.y, band.top);
    return {
        bubbleTop: band === up ? topSlot : floor - bubbleH,
        hole: { ...box, y: top, h: Math.max(0, Math.min(box.y + box.h, band.bottom) - top) },
    };
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

    if (!tour.active) return null;

    const box = rect && (() => {
        const top = Math.max(0, rect.y - PAD);
        const bottom = Math.min(H, rect.y + rect.height + PAD);
        const x = Math.max(0, rect.x - PAD);
        return { x, y: top, w: Math.min(W - x, rect.width + PAD * 2), h: Math.max(0, bottom - top) };
    })();
    const { bubbleTop, hole } = place(box, bubbleH, screen.current);

    const inPart = all.filter(s => s.part === stop.part);
    const where = !stop.part ? null
        : inPart.length > 1 ? `${stop.part} · ${inPart.indexOf(stop) + 1} of ${inPart.length}` : stop.part;

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

            <View
                key={index}
                onLayout={e => {
                    laidOut.current = { index, height: e.nativeEvent.layout.height };
                    setBubbleH(e.nativeEvent.layout.height);
                }}
                style={[styles.bubble, { backgroundColor: colors.background, top: bubbleTop }]}
            >
                {where && <Text variant="label">{where}</Text>}
                <CoachLine line={stop.line} action={stop.action} mood={stop.mood}>
                    {'got' in then && (
                        // Held, but kept in the layout, until what it explains is lit. The
                        // wrapper hides it: the pressable animates its own opacity.
                        <View style={[styles.gotIt, !hole && styles.waiting]} pointerEvents={hole ? 'auto' : 'none'}>
                            <ScalePressable onPress={next} disabled={!hole} accessibilityRole="button" hitSlop={8}>
                                <Text variant="label" tone="accent">Got it</Text>
                            </ScalePressable>
                        </View>
                    )}
                </CoachLine>
                {last && <ThemedButton label="Okay, let me start" block onPress={finish} />}
            </View>
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
    waiting: { opacity: 0 },
});
