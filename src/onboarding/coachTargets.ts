/**
 * Named on-screen elements the app walk points at. A screen registers one
 * with `ref={coachTarget('week')}`; the walk measures it where it really is.
 * A screen reports something the user just did with `coachEvent('...')`.
 */
import { DeviceEventEmitter, type View } from 'react-native';

export type CoachTarget =
    | 'reading' | 'add' | 'settings' | 'week' | 'progress' | 'tab-library' | 'tab-groups'
    | 'home-observation' | 'home-today'
    | 'library-tabs' | 'library-search' | 'library-entry' | 'library-books' | 'library-practice' | 'library-question'
    | 'library-themes'
    | 'stats-tiles' | 'stats-calendar' | 'stats-grove' | 'stats-rooted'
    | 'land-field' | 'land-tree' | 'land-card'
    | 'groups-row' | 'group-days' | 'group-share' | 'group-practice' | 'group-members' | 'group-mine'
    | 'tab-home'
    | 'back-stats' | 'back-land' | 'back-settings' | 'back-entry' | 'back-group'
    | 'settings-sleep' | 'settings-look' | 'settings-backup' | 'settings-profile' | 'entry-verse'
    | 'library-section-unfinished' | 'library-section-echoes' | 'library-section-plan'
    | 'library-sub-books' | 'library-sub-topics'
    | 'plan-legend' | 'plan-next' | 'plan-footnote';

/** Things the user can do that a walk stop waits for. */
export type CoachEvent = 'today-kept' | 'library-searched' | 'group-brought';

const EVENT = 'coach-event';

export function coachEvent(name: CoachEvent) {
    DeviceEventEmitter.emit(EVENT, name);
}

export function onCoachEvent(listener: (name: CoachEvent) => void) {
    const sub = DeviceEventEmitter.addListener(EVENT, listener);
    return () => sub.remove();
}

export interface Rect { x: number; y: number; width: number; height: number }

const nodes = new Map<CoachTarget, View>();
const refs = new Map<CoachTarget, (node: View | null) => void>();
/** Margin inside a wrapper that isn't part of the element the reader sees, taken off its box. */
const trims = new Map<CoachTarget, { top: number; bottom: number }>();

/**
 * A stable callback ref per name, so re-renders don't unregister and re-register.
 * `trim` names margin the wrapped element carries, e.g. a card's bottom margin.
 */
export function coachTarget(name: CoachTarget, trim?: { top?: number; bottom?: number }) {
    if (trim) trims.set(name, { top: trim.top ?? 0, bottom: trim.bottom ?? 0 });
    let ref = refs.get(name);
    if (!ref) {
        ref = (node: View | null) => {
            if (node) nodes.set(name, node);
            else nodes.delete(name);
        };
        refs.set(name, ref);
    }
    return ref;
}

/*
 * Targets are measured in the window and then made relative to the view the
 * walk's overlay fills. Window coordinates include how far a list has scrolled
 * (layout-tree measuring does not), and on some phones the status bar too
 * (108px on a TECNO KM6); measuring the root the same way cancels that out.
 */
let root: View | null = null;

/** The app's root view, which the walk's overlay fills. Registered once in app/_layout.tsx. */
export function coachRoot(node: View | null) {
    root = node;
}

const inWindow = (node: View) => new Promise<Rect>((resolve) => {
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
});

/** Where the element is in the walk's overlay, or null if it isn't on screen now. */
export async function measureTarget(name: CoachTarget): Promise<Rect | null> {
    const node = nodes.get(name);
    if (!node || !root) return null;
    const [el, base] = await Promise.all([inWindow(node), inWindow(root)]);
    if (!(el.width > 0 && el.height > 0)) return null;
    const trim = trims.get(name) ?? { top: 0, bottom: 0 };
    return { x: el.x - base.x, y: el.y - base.y + trim.top, width: el.width, height: el.height - trim.top - trim.bottom };
}

/**
 * The screen on show brings a target into view by scrolling its own list. Each
 * screen that has walk stops registers one while focused; the walk calls it.
 */
type Scroller = (rect: Rect) => Promise<void>;
let scroller: Scroller | null = null;

export function setCoachScroller(next: Scroller | null) {
    scroller = next;
}

/** Clears it only if it is still this screen's, since the next screen may focus first. */
export function clearCoachScroller(mine: Scroller) {
    if (scroller === mine) scroller = null;
}

export async function revealTarget(rect: Rect): Promise<void> {
    if (scroller) await scroller(rect);
}

/** Wait for a target to be laid out on a screen just navigated to. Null if it never shows. */
export async function waitForTarget(name: CoachTarget, timeoutMs = 3000): Promise<Rect | null> {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
        const rect = await measureTarget(name);
        if (rect) return rect;
        await new Promise(resolve => setTimeout(resolve, 120));
    }
    return null;
}
