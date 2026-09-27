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
    | 'groups-row' | 'group-days' | 'group-share' | 'group-practice' | 'group-members'
    | 'tab-home'
    | 'back-stats' | 'back-land' | 'back-settings' | 'back-entry' | 'back-group'
    | 'settings-sleep' | 'settings-look' | 'settings-backup'
    | 'library-section-unfinished' | 'library-section-echoes'
    | 'library-sub-books' | 'library-sub-topics';

/** Things the user can do that a walk stop waits for. */
export type CoachEvent = 'today-kept' | 'library-searched';

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

/** A stable callback ref per name, so re-renders don't unregister and re-register. */
export function coachTarget(name: CoachTarget) {
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

/** Where the element is in the window, or null if it isn't on screen now. */
export function measureTarget(name: CoachTarget): Promise<Rect | null> {
    const node = nodes.get(name);
    if (!node) return Promise.resolve(null);
    return new Promise((resolve) => {
        node.measureInWindow((x, y, width, height) => {
            resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
        });
    });
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
