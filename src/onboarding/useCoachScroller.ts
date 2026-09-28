/**
 * Lets the app walk scroll a screen's list to bring a stop's target into view,
 * clear of the walk's bubble. Registered while the screen is focused.
 */
import { RefObject, useCallback, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { clearCoachScroller, measureView, setCoachScroller, type Rect, type Room } from './coachTargets';

const SETTLE_MS = 450;

/** Returns the `onScroll` to put on the ScrollView, which is how it knows where the list is. */
export function useCoachScroller(ref: RefObject<ScrollView | null>) {
    const y = useRef(0);

    useFocusEffect(useCallback(() => {
        const mine = async (rect: Rect, room: Room) => {
            // Only the part of the room this list shows: not under a hero above it or the tab bar below.
            const frame = await measureView(ref.current?.getNativeScrollRef());
            const top = Math.max(room.top, frame?.y ?? room.top);
            const bottom = Math.min(room.bottom, frame ? frame.y + frame.height : room.bottom);
            if (rect.y >= top && rect.y + rect.height <= bottom) return;
            // As little as it takes. Too tall to fit, its top goes to the top of the room.
            const by = rect.y < top || rect.height > bottom - top ? rect.y - top : rect.y + rect.height - bottom;
            ref.current?.scrollTo({ y: Math.max(0, y.current + by), animated: true });
            await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
        };
        setCoachScroller(mine);
        return () => clearCoachScroller(mine);
    }, [ref]));

    return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        y.current = event.nativeEvent.contentOffset.y;
    }, []);
}
