/**
 * The settings glyph, traced from the mockup's own SVG — two slider tracks
 * with a knob on each, not a gear. Kept here rather than pulled from an icon
 * set so it is the drawing the design approved, and shared rather than
 * duplicated because both `#home` slots in design/all-screens.html draw the
 * identical path, recoloured per style.
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export function SettingsGlyph({ color, size = 19 }: { color: string; size?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
            <Path d="M4 7h9M18 7h2M4 17h5M14 17h6" />
            <Circle cx={15.5} cy={7} r={2.2} />
            <Circle cx={11.5} cy={17} r={2.2} />
        </Svg>
    );
}
