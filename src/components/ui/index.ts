/**
 * The design system's public surface.
 *
 * Screens import from here and nowhere deeper, so the set stays small enough
 * to hold in your head — and so a new component has to be a deliberate
 * addition rather than something that quietly appears in one screen.
 */
export { Text, textStyle } from './Text';
export type { TextProps } from './Text';

export { ClothGround, ClothStrip, ClothMark, ClothZigzag } from './Cloth';
export { SettingsGlyph } from './SettingsGlyph';

export { Asaro } from './Asaro';
export type { AsaroProps, AsaroHandle, AsaroAction, AsaroLook } from './Asaro';

export { Screen, Hero, Card, Row, Segments } from './Surfaces';
export type { SegmentsProps, SegmentItem } from './Surfaces';

export { ThemedButton } from './ThemedButton';
export type { ThemedButtonProps } from './ThemedButton';
