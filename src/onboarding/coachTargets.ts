/**
 * Named on-screen elements the Home walk points at. A screen registers one
 * with `ref={coachTarget('week')}`; the walk measures it where it really is.
 */
import type { View } from 'react-native';

export type CoachTarget = 'reading' | 'add' | 'settings' | 'week' | 'progress' | 'tab-library' | 'tab-groups';

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
