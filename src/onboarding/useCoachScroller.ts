/**
 * Lets the app walk scroll a screen's list to bring a stop's target into view,
 * below the walk's bubble. Registered while the screen is focused.
 */
import { RefObject, useCallback, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { clearCoachScroller, setCoachScroller, type Rect } from './coachTargets';

/** Where a target should sit after scrolling, from the top of the window: clear of the walk's bubble up there. */
const TOP = 240;
/** Room kept free below it, over the tab bar. */
const BUBBLE_ROOM = 110;
const SETTLE_MS = 450;

/** Returns the `onScroll` to put on the ScrollView, which is how it knows where the list is. */
export function useCoachScroller(ref: RefObject<ScrollView | null>) {
    const y = useRef(0);
    const { height } = useWindowDimensions();

    useFocusEffect(useCallback(() => {
        const mine = async (rect: Rect) => {
            if (rect.y >= TOP && rect.y + rect.height <= height - BUBBLE_ROOM) return;
            ref.current?.scrollTo({ y: Math.max(0, y.current + rect.y - TOP), animated: true });
            await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
        };
        setCoachScroller(mine);
        return () => clearCoachScroller(mine);
    }, [ref, height]));

    return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        y.current = event.nativeEvent.contentOffset.y;
    }, []);
}
