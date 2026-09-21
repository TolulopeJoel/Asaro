/**
 * Safe-area insets with a floor under the top edge.
 *
 * The app hides the status bar. Under edge-to-edge Android, React Native hides
 * it in transient mode (WindowUtil.statusBarHide → BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE),
 * and a transient bar consumes no window insets: insets.top reads 0 while the
 * bar still paints over whatever sits at the top of the screen. It comes back
 * that way on a swipe down, when the keyboard opens, and on a notification —
 * each time landing on the header. Floor the top edge at the status bar's own
 * height so nothing is ever under it.
 */
import { useMemo } from 'react';
import { Platform, StatusBar } from 'react-native';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The height the status bar occupies when shown. Read from the platform rather
 * than from live insets, because the insets are exactly what goes missing when
 * the bar is hidden. iOS reports its own top inset even while hidden, so it
 * needs no floor.
 */
export const MIN_TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

export function useScreenInsets(): EdgeInsets {
  const insets = useSafeAreaInsets();
  return useMemo(
    () => ({ ...insets, top: Math.max(insets.top, MIN_TOP_INSET) }),
    [insets]
  );
}
